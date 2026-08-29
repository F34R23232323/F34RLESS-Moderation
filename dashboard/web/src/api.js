const BASE = '';

// Requests that take longer than this are treated as failures (the server is
// likely hung or unreachable) instead of leaving pages spinning forever.
const REQUEST_TIMEOUT_MS = 20_000;

// --- Global error reporting ---------------------------------------------------
// A tiny event bus so fetch failures anywhere in the app can surface as
// friendly toasts without every page wiring its own handler.
const errorListeners = new Set();

export function onApiError(fn) {
  errorListeners.add(fn);
  return () => errorListeners.delete(fn);
}

function emitApiError(err, path) {
  errorListeners.forEach((fn) => {
    try {
      fn(err, path);
    } catch {
      /* never let a listener break the app */
    }
  });
}

// Turn unknown throwables into readable messages.
export function messageOf(err) {
  if (!err) return 'Something went wrong.';
  if (err instanceof Error) return err.message || String(err);
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export async function api(path, options = {}) {
  let res;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      res = await fetch(`${BASE}/api${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        ...options,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    const wrapped = new Error(err?.name === 'AbortError' ? 'Request timed out — is the dashboard server reachable?' : 'Network error — is the dashboard server reachable?');
    wrapped.cause = err;
    emitApiError(wrapped, path);
    throw wrapped;
  }
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `HTTP ${res.status}`);
    emitApiError(err, path);
    throw err;
  }
  return res.json();
}

// Call a NON-/api endpoint (e.g. the public /oauth routes) without the
// auth-redirect behavior — used by the auth check so it never loops.
export async function raw(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      signal: controller.signal,
      ...options,
    });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getSessionCookieToken() {
  return null;
}

export function connectLiveLogs({ onLog, onAutomodLog, onMetric, onOpen, onClose }) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // The session cookie is httpOnly (not readable from JS), but the browser sends
  // it automatically on the same-origin WebSocket handshake, so no token is needed.
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', payload: { streams: ['logs', 'automod', 'metrics'] } }));
    onOpen?.();
  };
  ws.onclose = () => onClose?.();
  ws.onerror = () => onClose?.();
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'log') onLog?.(msg.payload);
      else if (msg.type === 'automod_log') onAutomodLog?.(msg.payload);
      else if (msg.type === 'metric') onMetric?.(msg.payload);
    } catch {
      /* ignore */
    }
  };
  return () => ws.close();
}

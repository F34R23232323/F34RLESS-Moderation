const BASE = '';

export async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Call a NON-/api endpoint (e.g. the public /oauth routes) without the
// auth-redirect behavior — used by the auth check so it never loops.
export async function raw(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  });
  return res.json();
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
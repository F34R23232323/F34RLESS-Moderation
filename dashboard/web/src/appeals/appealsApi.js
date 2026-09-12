// API helpers for the public appeals portal. Unlike the owner dashboard's
// api.js, these never auto-redirect on 401 — the page renders its own login
// state instead.

const CSRF_COOKIE = 'f34rless_csrf';

function csrfToken() {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${CSRF_COOKIE}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : '';
}

export class ApiError extends Error {
  constructor(status, body) {
    super((body && body.error) || `HTTP ${status}`);
    this.status = status;
    this.body = body || {};
  }
}

// Requests that take longer than this are aborted so the UI never hangs
// indefinitely when the server is slow or unreachable.
const REQUEST_TIMEOUT_MS = 30_000;

export async function appealsApi(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (method !== 'GET') {
    const csrf = csrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`/api/appeals${path}`, {
      method,
      headers,
      credentials: 'include',
      signal: controller.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (err) {
    const msg = err?.name === 'AbortError'
      ? 'Request timed out — is the server reachable?'
      : 'Network error — is the server reachable?';
    throw new ApiError(0, { error: msg });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body;
}

export async function oauthMe() {
  try {
    const res = await fetch('/oauth/appeals-me', { credentials: 'include' });
    return res.ok ? await res.json() : { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

export function loginUrl(guildId) {
  return `/oauth/appeals-login?return=${encodeURIComponent(`/appeals/${guildId}`)}`;
}

export function connectAppealWs({ guildId, appealId, onStatus, onMessage, onClose }) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        payload: { streams: ['appeals'], appeals: [{ guildId, appealId }] },
      }),
    );
  };
  ws.onclose = () => onClose?.();
  ws.onerror = () => onClose?.();
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'appeal_status' && onStatus) onStatus(msg.payload);
      else if (msg.type === 'appeal_message' && onMessage) onMessage(msg.payload.message);
    } catch {
      /* ignore */
    }
  };
  return () => ws.close();
}

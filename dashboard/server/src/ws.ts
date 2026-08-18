import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import { sign, SESSION_COOKIE_NAME } from './auth';
import type { WsClientMessage } from '../../../shared/src/index';

interface ClientState {
  ws: WebSocket;
  lastLogId: number;
  lastAutomodLogId: number;
  streams: Set<string>;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

export function createWebSocketServer(httpServer: Server, db: Pool, sessionSecret: string): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Set<ClientState>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // Browser WebSockets send the (httpOnly) session cookie automatically on the
    // handshake — use it first, and fall back to an explicit ?token= for raw clients.
    let token = url.searchParams.get('token');
    if (!token) {
      token = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME] ?? null;
    }
    if (!token) {
      ws.close(4001, 'missing token');
      return;
    }
    const [raw, mac] = token.split('.');
    if (!raw || !mac || sign(raw, sessionSecret) !== mac) {
      ws.close(4001, 'bad token');
      return;
    }
    void db
      .query<RowDataPacket[]>('SELECT revoked FROM sessions WHERE token = ?', [raw])
      .then(([rows]) => {
        const session = rows[0] as { revoked: number } | undefined;
        if (!session || session.revoked === 1) {
          ws.close(4001, 'revoked');
          return;
        }
        const state: ClientState = { ws, lastLogId: 0, lastAutomodLogId: 0, streams: new Set(['logs']) };
        clients.add(state);
        ws.send(JSON.stringify({ type: 'hello', payload: { connected: true } }));

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as WsClientMessage;
            if (msg.type === 'subscribe') {
              state.streams = new Set(msg.payload.streams);
            }
          } catch {
            /* ignore */
          }
        });
        ws.on('close', () => clients.delete(state));
      })
      .catch(() => ws.close(4001, 'db error'));
  });

  setInterval(() => {
    for (const state of clients) {
      void poll(state, db).catch(() => undefined);
    }
  }, 1500);
}

async function poll(state: ClientState, db: Pool): Promise<void> {
  if (state.ws.readyState !== WebSocket.OPEN) return;
  if (state.streams.has('logs')) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, event, guild_id, channel_id, actor_id, target_id, message, details, created_at FROM logs WHERE id > ? ORDER BY id ASC LIMIT 100',
      [state.lastLogId],
    );
    for (const row of rows) {
      state.lastLogId = Math.max(state.lastLogId, Number(row.id));
      state.ws.send(JSON.stringify({ type: 'log', payload: row }));
    }
  }
  if (state.streams.has('automod')) {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id, rule, module, user_id, channel_id, content_snippet, response_suppressed, case_ids, created_at FROM automod_logs WHERE id > ? ORDER BY id ASC LIMIT 100',
      [state.lastAutomodLogId],
    );
    for (const row of rows) {
      state.lastAutomodLogId = Math.max(state.lastAutomodLogId, Number(row.id));
      state.ws.send(JSON.stringify({ type: 'automod_log', payload: row }));
    }
  }
  if (state.streams.has('metrics')) {
    const [m] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS msgs FROM logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)",
    );
    const [triggers] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM automod_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)',
    );
    state.ws.send(
      JSON.stringify({
        type: 'metric',
        payload: {
          messagesPerMinute: Number(m[0]?.msgs ?? 0),
          automodTriggersLastHour: Number(triggers[0]?.count ?? 0),
          timestamp: Date.now(),
        },
      }),
    );
  }
}
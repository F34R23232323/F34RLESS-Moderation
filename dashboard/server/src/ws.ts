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
  userId: string | null;
  // Appeals portal live stream — scope: `${guildId}:${appealId}` keys.
  appealKeys: Set<string>;
  appealLastMessageId: Map<string, number>;
  appealStatusSnapshot: Map<string, string>;
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
      .query<RowDataPacket[]>('SELECT user_id, revoked FROM sessions WHERE token = ?', [raw])
      .then(([rows]) => {
        const session = rows[0] as { user_id: string; revoked: number } | undefined;
        if (!session || session.revoked === 1) {
          ws.close(4001, 'revoked');
          return;
        }
        const state: ClientState = {
          ws,
          lastLogId: 0,
          lastAutomodLogId: 0,
          streams: new Set(['logs']),
          userId: session.user_id,
          appealKeys: new Set(),
          appealLastMessageId: new Map(),
          appealStatusSnapshot: new Map(),
        };
        clients.add(state);
        ws.send(JSON.stringify({ type: 'hello', payload: { connected: true } }));

        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString()) as WsClientMessage;
            if (msg.type === 'subscribe') {
              state.streams = new Set(msg.payload.streams);
              const keys: string[] = [];
              if (Array.isArray(msg.payload.appeals)) {
                for (const sub of msg.payload.appeals) {
                  if (!sub || !/^\d{15,20}$/.test(sub.guildId) || !Number.isInteger(sub.appealId)) continue;
                  keys.push(`${sub.guildId}:${sub.appealId}`);
                }
              }
              // Ownership is re-verified server-side so a user can never tail
              // someone else's appeal (staff streams via dashboard polling).
              state.appealKeys = new Set();
              if (keys.length > 0 && state.userId) {
                void verifyAppealOwnership(db, state, keys).catch(() => undefined);
              }
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
  }, 2500);
}

async function verifyAppealOwnership(db: Pool, state: ClientState, keys: string[]): Promise<void> {
  for (const key of keys) {
    const [guildId, appealIdStr] = key.split(':');
    const appealId = Number(appealIdStr);
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT user_id FROM appeals WHERE id = ? AND guild_id = ?',
      [appealId, guildId],
    );
    const appeal = rows[0] as { user_id: string } | undefined;
    if (appeal && (String(appeal.user_id) === state.userId)) {
      state.appealKeys.add(key);
    }
  }
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
  if (state.streams.has('appeals') && state.appealKeys.size > 0) {
    await pollAppeals(state, db);
  }
}

async function pollAppeals(state: ClientState, db: Pool): Promise<void> {
  for (const key of state.appealKeys) {
    const [guildId, appealIdStr] = key.split(':');
    const appealId = Number(appealIdStr);

    // Status + decision changes.
    const [aRows] = await db.query<RowDataPacket[]>(
      'SELECT status, decided_at, decided_by, decision_reason FROM appeals WHERE id = ? AND guild_id = ?',
      [appealId, guildId],
    );
    const appeal = aRows[0] as { status: string; decided_at: Date | null; decided_by: string | null; decision_reason: string | null } | undefined;
    if (appeal) {
      const snap = `${appeal.status}|${appeal.decided_at ?? ''}`;
      if (state.appealStatusSnapshot.get(key) !== snap) {
        state.appealStatusSnapshot.set(key, snap);
        state.ws.send(
          JSON.stringify({
            type: 'appeal_status',
            payload: {
              guildId,
              appealId,
              status: appeal.status,
              decidedAt: appeal.decided_at ? new Date(appeal.decided_at).toISOString() : null,
              decidedBy: appeal.decided_by,
              decisionReason: appeal.decision_reason,
            },
          }),
        );
      }
    }

    // New chat messages.
    const lastId = state.appealLastMessageId.get(key) ?? 0;
    const [mRows] = await db.query<RowDataPacket[]>(
      'SELECT id, sender_type, sender_id, content, sent_at FROM appeal_messages WHERE appeal_id = ? AND id > ? ORDER BY id ASC LIMIT 100',
      [appealId, lastId],
    );
    for (const m of mRows) {
      state.appealLastMessageId.set(key, Math.max(lastId, Number(m.id)));
      state.ws.send(
        JSON.stringify({
          type: 'appeal_message',
          payload: {
            guildId,
            appealId,
            message: {
              id: Number(m.id),
              senderType: m.sender_type,
              senderId: m.sender_id,
              content: m.content,
              sentAt: new Date(m.sent_at).toISOString(),
            },
          },
        }),
      );
    }
  }
}

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
    const clientsArray = [...clients];
    if (clientsArray.length === 0) return;

    // Shared metrics — run the expensive COUNT queries once, then broadcast.
    void pollMetrics(db).then((metrics) => {
      if (!metrics) return;
      for (const state of clientsArray) {
        if (state.ws.readyState !== WebSocket.OPEN) continue;
        if (state.streams.has('metrics')) {
          state.ws.send(JSON.stringify({ type: 'metric', payload: { ...metrics, timestamp: Date.now() } }));
        }
      }
    }).catch(() => undefined);

    // Batch log + automod queries: find the max watermark across all clients,
    // query once, then fan out only the rows each client hasn't seen yet.
    void pollLogsBatch(db, clientsArray).catch(() => undefined);
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

async function pollMetrics(db: Pool): Promise<{ messagesPerMinute: number; automodTriggersLastHour: number } | null> {
  try {
    const [m] = await db.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS msgs FROM logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)",
    );
    const [triggers] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM automod_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)',
    );
    return {
      messagesPerMinute: Number(m[0]?.msgs ?? 0),
      automodTriggersLastHour: Number(triggers[0]?.count ?? 0),
    };
  } catch {
    return null;
  }
}

async function poll(state: ClientState, db: Pool): Promise<void> {
  if (state.ws.readyState !== WebSocket.OPEN) return;
  // Appeals are per-user and small — fine to poll individually.
  if (state.streams.has('appeals') && state.appealKeys.size > 0) {
    await pollAppeals(state, db);
  }
}

/**
 * Batched log + automod poll — one query each per cycle regardless of client
 * count.  Finds the minimum last-id watermark across eligible clients, fetches
 * all rows since that point, then fans out only the rows each client needs.
 */
async function pollLogsBatch(db: Pool, clients: ClientState[]): Promise<void> {
  const logsClients = clients.filter((s) => s.ws.readyState === WebSocket.OPEN && s.streams.has('logs'));
  const automodClients = clients.filter((s) => s.ws.readyState === WebSocket.OPEN && s.streams.has('automod'));

  // ── Logs ─────────────────────────────────────────────────────────────
  if (logsClients.length > 0) {
    const minLogId = Math.min(...logsClients.map((s) => s.lastLogId));
    const [logRows] = await db.query<RowDataPacket[]>(
      'SELECT id, event, guild_id, channel_id, actor_id, target_id, message, details, created_at FROM logs WHERE id > ? ORDER BY id ASC LIMIT 500',
      [minLogId],
    );
    if (logRows.length > 0) {
      for (const state of logsClients) {
        const unseen = logRows.filter((r) => Number(r.id) > state.lastLogId);
        for (const row of unseen) {
          state.lastLogId = Math.max(state.lastLogId, Number(row.id));
          state.ws.send(JSON.stringify({ type: 'log', payload: row }));
        }
      }
    }
  }

  // ── Automod logs ─────────────────────────────────────────────────────
  if (automodClients.length > 0) {
    const minAutoId = Math.min(...automodClients.map((s) => s.lastAutomodLogId));
    const [autoRows] = await db.query<RowDataPacket[]>(
      'SELECT id, rule, module, user_id, channel_id, content_snippet, response_suppressed, case_ids, created_at FROM automod_logs WHERE id > ? ORDER BY id ASC LIMIT 500',
      [minAutoId],
    );
    if (autoRows.length > 0) {
      for (const state of automodClients) {
        const unseen = autoRows.filter((r) => Number(r.id) > state.lastAutomodLogId);
        for (const row of unseen) {
          state.lastAutomodLogId = Math.max(state.lastAutomodLogId, Number(row.id));
          state.ws.send(JSON.stringify({ type: 'automod_log', payload: row }));
        }
      }
    }
  }

  // ── Appeals (per-user, kept individual — small & scoped) ──────────────
  for (const state of clients) {
    if (state.ws.readyState !== WebSocket.OPEN) continue;
    if (state.streams.has('appeals') && state.appealKeys.size > 0) {
      void pollAppeals(state, db).catch(() => undefined);
    }
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

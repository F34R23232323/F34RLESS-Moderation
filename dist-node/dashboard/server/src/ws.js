"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWebSocketServer = createWebSocketServer;
const ws_1 = require("ws");
const auth_1 = require("./auth");
function createWebSocketServer(httpServer, db, sessionSecret) {
    const wss = new ws_1.WebSocketServer({ server: httpServer, path: '/ws' });
    const clients = new Set();
    wss.on('connection', (ws, req) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
            ws.close(4001, 'missing token');
            return;
        }
        const [raw, mac] = token.split('.');
        if (!raw || !mac || (0, auth_1.sign)(raw, sessionSecret) !== mac) {
            ws.close(4001, 'bad token');
            return;
        }
        void db
            .query('SELECT revoked FROM sessions WHERE token = ?', [raw])
            .then(([rows]) => {
            const session = rows[0];
            if (!session || session.revoked === 1) {
                ws.close(4001, 'revoked');
                return;
            }
            const state = { ws, lastLogId: 0, lastAutomodLogId: 0, streams: new Set(['logs']) };
            clients.add(state);
            ws.send(JSON.stringify({ type: 'hello', payload: { connected: true } }));
            ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.type === 'subscribe') {
                        state.streams = new Set(msg.payload.streams);
                    }
                }
                catch {
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
async function poll(state, db) {
    if (state.ws.readyState !== ws_1.WebSocket.OPEN)
        return;
    if (state.streams.has('logs')) {
        const [rows] = await db.query('SELECT id, event, guild_id, channel_id, actor_id, target_id, message, details, created_at FROM logs WHERE id > ? ORDER BY id ASC LIMIT 100', [state.lastLogId]);
        for (const row of rows) {
            state.lastLogId = Math.max(state.lastLogId, Number(row.id));
            state.ws.send(JSON.stringify({ type: 'log', payload: row }));
        }
    }
    if (state.streams.has('automod')) {
        const [rows] = await db.query('SELECT id, rule, module, user_id, channel_id, content_snippet, response_suppressed, case_ids, created_at FROM automod_logs WHERE id > ? ORDER BY id ASC LIMIT 100', [state.lastAutomodLogId]);
        for (const row of rows) {
            state.lastAutomodLogId = Math.max(state.lastAutomodLogId, Number(row.id));
            state.ws.send(JSON.stringify({ type: 'automod_log', payload: row }));
        }
    }
    if (state.streams.has('metrics')) {
        const [m] = await db.query("SELECT COUNT(*) AS msgs FROM logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)");
        const [triggers] = await db.query('SELECT COUNT(*) AS count FROM automod_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 3600 SECOND)');
        state.ws.send(JSON.stringify({
            type: 'metric',
            payload: {
                messagesPerMinute: Number(m[0]?.msgs ?? 0),
                automodTriggersLastHour: Number(triggers[0]?.count ?? 0),
                timestamp: Date.now(),
            },
        }));
    }
}
//# sourceMappingURL=ws.js.map
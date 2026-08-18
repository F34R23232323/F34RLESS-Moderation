"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCasesRouter = createCasesRouter;
const express_1 = require("express");
function createCasesRouter(ctx) {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        const { user, type, status, from, to, q, limit = 100, offset = 0 } = req.query;
        const where = [];
        const params = [];
        if (user) {
            where.push('user_id = ?');
            params.push(user);
        }
        if (type) {
            where.push('type = ?');
            params.push(type);
        }
        if (status) {
            where.push('status = ?');
            params.push(status);
        }
        if (from) {
            where.push('created_at >= ?');
            params.push(new Date(from));
        }
        if (to) {
            where.push('created_at <= ?');
            params.push(new Date(to));
        }
        if (q) {
            where.push('reason LIKE ?');
            params.push(`%${q}%`);
        }
        const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const [rows] = await ctx.db.query(`SELECT * FROM cases ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]);
        const [countRows] = await ctx.db.query(`SELECT COUNT(*) AS count FROM cases ${whereSql}`, params);
        res.json({ rows, total: Number(countRows[0]?.count ?? 0) });
    });
    router.get('/:id', async (req, res) => {
        const [rows] = await ctx.db.query('SELECT * FROM cases WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            res.status(404).json({ error: 'case not found' });
            return;
        }
        res.json({ case: rows[0] });
    });
    router.patch('/:id', async (req, res) => {
        const body = req.body;
        if (body.reason !== undefined) {
            await ctx.db.execute('UPDATE cases SET reason = ? WHERE id = ?', [body.reason, req.params.id]);
        }
        if (body.status !== undefined) {
            await ctx.db.execute('UPDATE cases SET status = ? WHERE id = ?', [body.status, req.params.id]);
        }
        res.json({ ok: true });
    });
    return router;
}
//# sourceMappingURL=cases.js.map
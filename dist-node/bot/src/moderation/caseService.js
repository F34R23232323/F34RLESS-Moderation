"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseService = void 0;
class CaseService {
    db;
    constructor(db) {
        this.db = db;
    }
    async createCase(input) {
        for (let attempt = 0; attempt < 5; attempt++) {
            const caseNumber = await this.nextCaseNumber(input.guildId);
            try {
                const [result] = await this.db.execute(`INSERT INTO cases (case_number, guild_id, type, user_id, moderator_id, reason, duration_ms, evidence, linked_case_ids, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    caseNumber,
                    input.guildId,
                    input.type,
                    input.userId,
                    input.moderatorId,
                    input.reason,
                    input.durationMs ?? null,
                    JSON.stringify(input.evidence ?? []),
                    JSON.stringify(input.linkedCaseIds ?? []),
                    input.status ?? 'active',
                ]);
                const id = result.insertId;
                return (await this.getCaseById(id));
            }
            catch (err) {
                if (err.code === 'ER_DUP_ENTRY')
                    continue;
                throw err;
            }
        }
        throw new Error('Failed to create case after retries');
    }
    async nextCaseNumber(guildId) {
        const [rows] = await this.db.query('SELECT COALESCE(MAX(case_number), 0) + 1 AS next FROM cases WHERE guild_id = ?', [guildId]);
        const row = rows;
        return row[0]?.next ?? 1;
    }
    async getCaseById(id) {
        const [rows] = await this.db.query('SELECT * FROM cases WHERE id = ?', [id]);
        return rows[0] ?? null;
    }
    async getCaseByNumber(guildId, caseNumber) {
        const [rows] = await this.db.query('SELECT * FROM cases WHERE guild_id = ? AND case_number = ?', [guildId, caseNumber]);
        return rows[0] ?? null;
    }
    async listCasesForUser(guildId, userId, limit = 50) {
        const [rows] = await this.db.query('SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?', [guildId, userId, limit]);
        return rows;
    }
    async listCases(guildId, opts = {}) {
        const where = ['guild_id = ?'];
        const params = [guildId];
        if (opts.type) {
            where.push('type = ?');
            params.push(opts.type);
        }
        params.push(opts.limit ?? 100);
        params.push(opts.offset ?? 0);
        const [rows] = await this.db.query(`SELECT * FROM cases WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`, params);
        return rows;
    }
    async updateReason(id, reason) {
        await this.db.execute('UPDATE cases SET reason = ? WHERE id = ?', [reason, id]);
    }
    async voidCase(id, reason) {
        const suffix = reason ? `\nVoided: ${reason}` : '';
        await this.db.execute("UPDATE cases SET status = 'voided', reason = CONCAT(reason, ?) WHERE id = ?", [suffix, id]);
    }
    async setStatus(id, status) {
        await this.db.execute('UPDATE cases SET status = ? WHERE id = ?', [status, id]);
    }
    async bulkUpdateReason(ids, reason) {
        if (ids.length === 0)
            return;
        const placeholders = ids.map(() => '?').join(',');
        await this.db.execute(`UPDATE cases SET reason = ? WHERE id IN (${placeholders})`, [reason, ...ids]);
    }
    async linkCases(guildId, caseId, linkedIds) {
        for (const linkedId of linkedIds) {
            if (linkedId === caseId)
                continue;
            await this.db.execute('INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)', [caseId, linkedId]);
            await this.db.execute('INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)', [linkedId, caseId]);
        }
        const current = await this.getCaseById(caseId);
        if (current) {
            const existing = current.linked_case_ids ?? [];
            const merged = [...new Set([...existing, ...linkedIds])];
            await this.db.execute('UPDATE cases SET linked_case_ids = ? WHERE id = ?', [JSON.stringify(merged), caseId]);
        }
    }
    async countWarnings(guildId, userId, activeOnly = true) {
        const [rows] = await this.db.query(`SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND case_id NOT IN (SELECT id FROM cases WHERE status = 'voided')`, [guildId, userId]);
        return rows[0]?.count ?? 0;
    }
    async deactivateWarning(caseId) {
        await this.db.execute('UPDATE warnings SET active = 0 WHERE case_id = ?', [caseId]);
    }
}
exports.CaseService = CaseService;
//# sourceMappingURL=caseService.js.map
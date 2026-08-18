import type { Pool, RowDataPacket } from 'mysql2/promise';
import { generateCaseCode } from '../../../shared/src/index';

export interface CaseInput {
  guildId: string;
  type: string;
  userId: string;
  moderatorId: string | null;
  reason: string;
  durationMs?: number | null;
  evidence?: unknown[];
  linkedCaseIds?: number[];
  status?: string;
}

export interface CaseRow extends RowDataPacket {
  id: number;
  case_number: number;
  case_code: string;
  guild_id: string;
  type: string;
  user_id: string;
  moderator_id: string | null;
  reason: string;
  duration_ms: number | null;
  evidence: unknown;
  linked_case_ids: unknown;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class CaseService {
  private readonly db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  public async createCase(input: CaseInput): Promise<CaseRow> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const caseNumber = await this.nextCaseNumber(input.guildId);
      const caseCode = generateCaseCode();
      try {
        const [result] = await this.db.execute(
          `INSERT INTO cases (case_number, case_code, guild_id, type, user_id, moderator_id, reason, duration_ms, evidence, linked_case_ids, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            caseNumber,
            caseCode,
            input.guildId,
            input.type,
            input.userId,
            input.moderatorId,
            input.reason,
            input.durationMs ?? null,
            JSON.stringify(input.evidence ?? []),
            JSON.stringify(input.linkedCaseIds ?? []),
            input.status ?? 'active',
          ],
        );
        const id = (result as { insertId: number }).insertId;
        return (await this.getCaseById(id)) as CaseRow;
      } catch (err) {
        if ((err as { code?: string }).code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }
    throw new Error('Failed to create case after retries');
  }

  public async getCaseByCode(guildId: string, caseCode: string): Promise<CaseRow | null> {
    const [rows] = await this.db.query<CaseRow[]>(
      'SELECT * FROM cases WHERE guild_id = ? AND case_code = ?',
      [guildId, caseCode],
    );
    return rows[0] ?? null;
  }

  public async nextCaseNumber(guildId: string): Promise<number> {
    const [rows] = await this.db.query(
      'SELECT COALESCE(MAX(case_number), 0) + 1 AS next FROM cases WHERE guild_id = ?',
      [guildId],
    );
    const row = rows as Array<{ next: number }>;
    return row[0]?.next ?? 1;
  }

  public async getCaseById(id: number): Promise<CaseRow | null> {
    const [rows] = await this.db.query<CaseRow[]>('SELECT * FROM cases WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  public async getCaseByNumber(guildId: string, caseNumber: number): Promise<CaseRow | null> {
    const [rows] = await this.db.query<CaseRow[]>(
      'SELECT * FROM cases WHERE guild_id = ? AND case_number = ?',
      [guildId, caseNumber],
    );
    return rows[0] ?? null;
  }

  public async listCasesForUser(guildId: string, userId: string, limit = 50): Promise<CaseRow[]> {
    const [rows] = await this.db.query<CaseRow[]>(
      'SELECT * FROM cases WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?',
      [guildId, userId, limit],
    );
    return rows;
  }

  public async listCases(guildId: string, opts: { type?: string; limit?: number; offset?: number } = {}): Promise<CaseRow[]> {
    const where = ['guild_id = ?'];
    const params: unknown[] = [guildId];
    if (opts.type) {
      where.push('type = ?');
      params.push(opts.type);
    }
    params.push(opts.limit ?? 100);
    params.push(opts.offset ?? 0);
    const [rows] = await this.db.query<CaseRow[]>(
      `SELECT * FROM cases WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      params,
    );
    return rows;
  }

  public async updateReason(id: number, reason: string): Promise<void> {
    await this.db.execute('UPDATE cases SET reason = ? WHERE id = ?', [reason, id]);
  }

  public async voidCase(id: number, reason?: string): Promise<void> {
    const suffix = reason ? `\nVoided: ${reason}` : '';
    await this.db.execute(
      "UPDATE cases SET status = 'voided', reason = CONCAT(reason, ?) WHERE id = ?",
      [suffix, id],
    );
  }

  public async setStatus(id: number, status: string): Promise<void> {
    await this.db.execute('UPDATE cases SET status = ? WHERE id = ?', [status, id]);
  }

  public async bulkUpdateReason(ids: number[], reason: string): Promise<void> {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await this.db.execute(`UPDATE cases SET reason = ? WHERE id IN (${placeholders})`, [reason, ...ids]);
  }

  public async linkCases(guildId: string, caseId: number, linkedIds: number[]): Promise<void> {
    for (const linkedId of linkedIds) {
      if (linkedId === caseId) continue;
      await this.db.execute(
        'INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)',
        [caseId, linkedId],
      );
      await this.db.execute(
        'INSERT IGNORE INTO case_links (case_id, linked_case_id) VALUES (?, ?)',
        [linkedId, caseId],
      );
    }
    const current = await this.getCaseById(caseId);
    if (current) {
      const existing = (current.linked_case_ids as unknown as number[]) ?? [];
      const merged = [...new Set([...existing, ...linkedIds])];
      await this.db.execute('UPDATE cases SET linked_case_ids = ? WHERE id = ?', [JSON.stringify(merged), caseId]);
    }
  }

  public async countWarnings(guildId: string, userId: string, activeOnly = true): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1
       AND (expires_at IS NULL OR expires_at > NOW())
       AND case_id NOT IN (SELECT id FROM cases WHERE status = 'voided')`,
      [guildId, userId],
    );
    return rows[0]?.count ?? 0;
  }

  public async deactivateWarning(caseId: number): Promise<void> {
    await this.db.execute('UPDATE warnings SET active = 0 WHERE case_id = ?', [caseId]);
  }
}
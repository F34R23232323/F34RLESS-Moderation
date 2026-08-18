import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { App } from '../core/context';

interface PendingRequest {
  id: number;
  guild_id: string;
  event: string;
  actor_id: string | null;
  target_id: string | null;
  message: string | null;
  details: string | null;
}

export class DashboardLogService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async processPending(): Promise<void> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      "SELECT id, guild_id, event, actor_id, target_id, message, details FROM dashboard_log_requests WHERE status = 'pending' ORDER BY id ASC LIMIT 20",
    );
    for (const raw of rows) {
      const req = raw as unknown as PendingRequest;
      try {
        await this.app.logManager.log({
          event: req.event,
          guildId: req.guild_id,
          actorId: req.actor_id ?? null,
          targetId: req.target_id ?? null,
          message: req.message ?? undefined,
          details: req.details ? parseJson(req.details, undefined) : undefined,
        });
        await this.app.db.execute(
          "UPDATE dashboard_log_requests SET status = 'done', processed_at = NOW() WHERE id = ?",
          [req.id],
        );
      } catch (err) {
        await this.app.db.execute(
          "UPDATE dashboard_log_requests SET status = 'failed', error = ?, processed_at = NOW() WHERE id = ?",
          [(err as Error).message.slice(0, 1000), req.id],
        );
      }
    }
  }
}

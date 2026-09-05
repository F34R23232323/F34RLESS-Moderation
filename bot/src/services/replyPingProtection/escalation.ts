import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import { parseDuration } from '../../../../shared/src/index';

export interface EscalationResult {
  escalated: boolean;
  level?: number;
  actionType?: string;
  actionDuration?: string;
  error?: string;
}

export class ReplyPingEscalation {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  private get config() {
    return this.app.config.reply_ping_protection;
  }

  async recordAndEvaluate(
    guildId: string,
    userId: string,
    channelId: string,
    messageId: string,
    originalContent: string,
    sanitizedContent: string,
    blockedUserId: string,
  ): Promise<EscalationResult> {
    const cfg = this.config;
    if (!cfg.escalation.enabled) return { escalated: false };

    const levels = cfg.escalation.levels;
    if (levels.length === 0) return { escalated: false };

    const topWindow = cfg.escalation.window_seconds;

    const [countRows] = await this.app.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM reply_ping_incidents
       WHERE guild_id = ? AND user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [guildId, userId, topWindow],
    );
    const violationCount = (countRows[0] as any).cnt as number;

    let matchedLevel: (typeof levels)[number] | null = null;
    for (const level of levels) {
      if (violationCount >= level.violation_count) {
        matchedLevel = level;
      }
    }

    if (!matchedLevel) return { escalated: false, level: 0 };

    await this.app.db.execute(
      `UPDATE reply_ping_incidents SET escalation_level = ?
       WHERE guild_id = ? AND user_id = ? AND id = (
         SELECT id FROM (SELECT id FROM reply_ping_incidents
           WHERE guild_id = ? AND user_id = ?
           ORDER BY created_at DESC LIMIT 1
         ) AS sub
       )`,
      [matchedLevel.level, guildId, userId, guildId, userId],
    );

    const actionDuration = matchedLevel.action_duration ?? undefined;
    const result = await this.executeEscalation(
      guildId,
      userId,
      matchedLevel.level,
      matchedLevel.action_type,
      actionDuration,
      violationCount,
    );

    return {
      escalated: true,
      level: matchedLevel.level,
      actionType: matchedLevel.action_type,
      actionDuration,
      error: result.error,
    };
  }

  private async executeEscalation(
    guildId: string,
    userId: string,
    level: number,
    actionType: string,
    actionDuration: string | undefined,
    violationCount: number,
  ): Promise<{ error?: string }> {
    const guild = this.app.client.guilds.cache.get(guildId);
    if (!guild) return { error: 'guild_not_found' };

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { error: 'member_not_found' };

    const durationMs = actionDuration
      ? (parseDuration(actionDuration)?.milliseconds ?? 0)
      : 0;

    const result = await this.app.punishmentManager.applyFromAction(
      guild,
      actionType,
      member,
      {
        reason: `Reply ping escalation (level ${level}, ${violationCount} violations)`,
        moderatorId: this.app.client.user?.id ?? undefined,
        durationMs: durationMs || undefined,
        silent: true,
      },
    );

    if (!result.ok) return { error: result.error };

    if (result.case) {
      await this.app.db.execute(
        `UPDATE reply_ping_incidents SET case_id = ?, action_taken = ?
         WHERE guild_id = ? AND user_id = ? AND escalation_level = ? AND case_id IS NULL
         ORDER BY created_at DESC LIMIT 1`,
        [result.case.id, actionType, guildId, userId, level],
      );
    }

    return {};
  }
}

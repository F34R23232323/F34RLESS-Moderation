import type { App } from '../core/context';
import { parseDuration } from '../../../shared/src/index';

export class WarningEscalation {
  private readonly app: App;
  private readonly applied = new Map<string, number>();

  constructor(app: App) {
    this.app = app;
  }

  public async check(guildId: string, userId: string): Promise<void> {
    const ladder = this.app.config.warnings.escalation_ladder;
    if (ladder.length === 0) return;
    if (userId === this.app.client.user?.id) return;
    if (await this.app.whitelist.isWhitelisted(guildId, userId, 'escalation')) return;

    const count = await this.app.caseService.countWarnings(guildId, userId);
    const rung = [...ladder]
      .sort((a, b) => a.count - b.count)
      .filter((r) => r.count <= count)
      .pop();

    if (!rung) return;

    const key = `${guildId}:${userId}`;
    if (this.applied.get(key) === rung.count) return;
    this.applied.set(key, rung.count);

    const guild = this.app.client.guilds.cache.get(guildId);
    if (!guild) return;
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const durationMs = rung.duration ? (parseDuration(rung.duration)?.milliseconds ?? 0) : 0;
    const result = await this.app.punishmentManager.applyFromAction(guild, rung.action, member, {
      reason: `Warning escalation (${count} active warnings)`,
      moderatorId: this.app.client.user?.id ?? null,
      durationMs: durationMs || undefined,
      silent: true,
    });

    if (!result.ok) {
      this.app.logger.warn(`Warning escalation failed for ${userId}: ${result.error}`);
    }
  }
}
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

export class AntiRaidService {
  private readonly app: App;
  private active = new Set<string>();

  constructor(app: App) {
    this.app = app;
  }

  public isActive(guildId: string): boolean {
    return this.active.has(guildId);
  }

  public async trigger(guildId: string): Promise<void> {
    if (this.active.has(guildId)) return;
    const cfg = this.app.config.anti_raid;
    if (!cfg.enabled) return;
    const guild = this.app.client.guilds.cache.get(guildId);
    if (!guild) return;
    this.active.add(guildId);

    await this.app.logManager.log({
      event: 'member_join',
      guildId,
      message: 'Anti-raid mode triggered',
      details: { action: cfg.action },
    });

    if (cfg.action === 'lock_joins') {
      await guild.edit({ verificationLevel: 3 }).catch(() => undefined);
    } else if (cfg.action === 'timeout_joiners') {
      const members = await guild.members.fetch().catch(() => null);
      if (members) {
        const cutoff = Date.now() - 3600_000;
        for (const member of members.values()) {
          if (member.joinedTimestamp && member.joinedTimestamp > cutoff && !member.user.bot) {
            await member.timeout(3600_000, 'Anti-raid').catch(() => undefined);
          }
        }
      }
    }

    setTimeout(() => {
      this.active.delete(guildId);
      if (cfg.action === 'lock_joins') {
        guild.edit({ verificationLevel: 0 }).catch(() => undefined);
      }
    }, 3600_000).unref?.();
  }

  public async announce(guildId: string, channelId: string): Promise<void> {
    const guild = this.app.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) return;
    await v2Send(channel as never, 'Anti-raid mode is now active. Joins are being monitored.', { accentColor: '#ED4245' }).catch(() => undefined);
  }
}
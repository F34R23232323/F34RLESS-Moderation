import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

export class AntiRaidService {
  private readonly app: App;
  private active = new Set<string>();
  private cooldowns = new Map<string, number>();

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

    const now = Date.now();
    const lastTrigger = this.cooldowns.get(guildId) ?? 0;
    if (now - lastTrigger < cfg.cooldown_seconds * 1000) return;
    this.cooldowns.set(guildId, now);

    this.active.add(guildId);

    await this.app.logManager.log({
      event: 'member_join',
      guildId,
      message: 'Anti-raid mode triggered',
      details: { action: cfg.action },
    });

    if (cfg.alert_channel_id) {
      const channel = guild.channels.cache.get(cfg.alert_channel_id);
      if (channel && 'send' in channel) {
        const joinCount = this.app.joinRate.get(guildId)?.length ?? 0;
        await v2Send(channel as never, `🚨 **Anti-Raid Triggered**\n\n**Joins detected:** ${joinCount} in the last ${cfg.window_seconds}s\n**Action:** ${cfg.action}\n**Time:** <t:${Math.floor(now / 1000)}:R>`, { accentColor: '#ED4245' }).catch(() => undefined);
      }
    }

    if (cfg.action === 'lock_joins') {
      await guild.edit({ verificationLevel: 3 }).catch(() => undefined);
    } else if (cfg.action === 'timeout_joiners') {
      const members = await guild.members.fetch().catch(() => null);
      if (members) {
        const cutoff = now - 3600_000;
        for (const member of members.values()) {
          if (member.joinedTimestamp && member.joinedTimestamp > cutoff && !member.user.bot) {
            await member.timeout(3600_000, 'Anti-raid').catch(() => undefined);
          }
        }
      }
    } else if (cfg.action === 'quarantine_joiners') {
      if (cfg.quarantine_role_id) {
        const role = guild.roles.cache.get(cfg.quarantine_role_id);
        if (role && role.position < (guild.members.me?.roles.highest.position ?? 0)) {
          const members = await guild.members.fetch().catch(() => null);
          if (members) {
            const cutoff = now - cfg.window_seconds * 1000 * 3;
            for (const member of members.values()) {
              if (member.joinedTimestamp && member.joinedTimestamp > cutoff && !member.user.bot) {
                if (!member.roles.cache.has(cfg.quarantine_role_id)) {
                  await member.roles.add(cfg.quarantine_role_id, 'Anti-raid quarantine').catch(() => undefined);
                }
              }
            }
          }
        }
      }
    } else if (cfg.action === 'force_verify') {
      const members = await guild.members.fetch().catch(() => null);
      if (members) {
        const cutoff = now - cfg.window_seconds * 1000 * 3;
        for (const member of members.values()) {
          if (member.joinedTimestamp && member.joinedTimestamp > cutoff && !member.user.bot) {
            await this.app.db.execute(
              `INSERT INTO gates (guild_id, user_id, state) VALUES (?, ?, 'pending')
               ON DUPLICATE KEY UPDATE state = 'pending'`,
              [guild.id, member.id],
            ).catch(() => undefined);
          }
        }
      }
    }

    setTimeout(() => {
      this.active.delete(guildId);
      if (cfg.action === 'lock_joins') {
        guild.edit({ verificationLevel: 0 }).catch(() => undefined);
      }
      if (cfg.alert_channel_id) {
        const channel = guild.channels.cache.get(cfg.alert_channel_id);
        if (channel && 'send' in channel) {
          v2Send(channel as never, '✅ **Anti-Raid Deactivated** — normal operations resumed.', { accentColor: '#57F287' }).catch(() => undefined);
        }
      }
    }, cfg.cooldown_seconds * 1000).unref?.();
  }

  public async announce(guildId: string, channelId: string): Promise<void> {
    const guild = this.app.client.guilds.cache.get(guildId);
    const channel = guild?.channels.cache.get(channelId);
    if (!channel || !('send' in channel)) return;
    await v2Send(channel as never, 'Anti-raid mode is now active. Joins are being monitored.', { accentColor: '#ED4245' }).catch(() => undefined);
  }
}

import type { Guild, Invite } from 'discord.js';
import type { App } from '../core/context';

export interface InviteUseInfo {
  code: string;
  inviterId: string | null;
  inviterTag: string | null;
  channelId: string | null;
  channelName: string | null;
  uses: number;
  maxUses: number;
}

export class InviteTracker {
  private readonly app: App;
  private readonly cache = new Map<string, Map<string, number>>();

  constructor(app: App) {
    this.app = app;
  }

  public async syncGuild(guild: Guild): Promise<void> {
    try {
      const invites = await guild.invites.fetch();
      const guildCache = new Map<string, number>();
      for (const [, invite] of invites) {
        guildCache.set(invite.code, invite.uses ?? 0);
      }
      this.cache.set(guild.id, guildCache);
    } catch {
      this.cache.set(guild.id, new Map());
    }
  }

  public updateOnCreate(invite: Invite): void {
    if (!invite.guild) return;
    const guildCache = this.cache.get(invite.guild.id) ?? new Map();
    guildCache.set(invite.code, invite.uses ?? 0);
    this.cache.set(invite.guild.id, guildCache);
  }

  public updateOnDelete(invite: Invite): void {
    if (!invite.guild) return;
    const guildCache = this.cache.get(invite.guild.id);
    if (guildCache) guildCache.delete(invite.code);
  }

  public async findUsedInvite(guild: Guild): Promise<InviteUseInfo | null> {
    const oldCache = this.cache.get(guild.id) ?? new Map();
    try {
      const newInvites = await guild.invites.fetch();
      const guildCache = new Map<string, number>();

      for (const [, invite] of newInvites) {
        const oldUses = oldCache.get(invite.code) ?? 0;
        const currentUses = invite.uses ?? 0;
        if (currentUses > oldUses) {
          guildCache.set(invite.code, currentUses);
          this.cache.set(guild.id, guildCache);
          return {
            code: invite.code,
            inviterId: invite.inviter?.id ?? null,
            inviterTag: invite.inviter?.tag ?? null,
            channelId: invite.channel?.id ?? null,
            channelName: invite.channel?.name ?? null,
            uses: currentUses,
            maxUses: invite.maxUses ?? 0,
          };
        }
        guildCache.set(invite.code, currentUses);
      }

      this.cache.set(guild.id, guildCache);
    } catch {
      // fetch failed, leave cache as-is
    }
    return null;
  }

  public async storeJoin(guildId: string, inviteInfo: InviteUseInfo, userId: string): Promise<void> {
    if (!this.app.config.invite_tracking.enabled) return;
    try {
      const [result] = await this.app.db.execute(
        `INSERT INTO invite_tracking (guild_id, invite_code, inviter_id, uses, expires_at)
         VALUES (?, ?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE inviter_id = VALUES(inviter_id), uses = VALUES(uses)`,
        [guildId, inviteInfo.code, inviteInfo.inviterId, inviteInfo.uses],
      );
      const inviteId = (result as { insertId?: number }).insertId;
      if (inviteId) {
        await this.app.db.execute(
          `INSERT INTO invite_joins (guild_id, invite_id, user_id)
           VALUES (?, ?, ?)`,
          [guildId, inviteId, userId],
        );
      }
    } catch {
      // DB error, non-critical
    }
  }
}

import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import { PermissionsBitField, type PermissionResolvable, type Guild, type TextChannel, type Channel } from 'discord.js';
import type { App } from '../core/context';

interface OverwriteSnapshot {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

function isLockable(ch: Channel): ch is TextChannel {
  return 'permissionOverwrites' in ch && ch.isTextBased() && !ch.isThread();
}

export class LockingService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Lock a channel by ADDING deny overwrites for SendMessages/AddReactions.
   * All existing overwrites are preserved — only the lockdown denies are added.
   */
  public async lockChannel(channel: TextChannel, reason?: string): Promise<{ ok: boolean; error?: string }> {
    if (!isLockable(channel)) return { ok: false, error: 'This channel cannot be locked.' };
    try {
      // 1. Snapshot the current state BEFORE any changes
      await this.snapshot(channel);

      const guild = channel.guild;
      const cfg = this.app.config.channel_locking;
      const denyBitfield = PermissionsBitField.resolve(cfg.deny_permissions as PermissionResolvable[]);

      // 2. Build overwrite updates — each entry uses BigInt bitfields
      const overwrites: { id: string; type: number; allow: bigint; deny: bigint }[] = [];

      // @everyone: add lockdown deny permissions (keep existing allow/deny intact)
      const everyoneOw = channel.permissionOverwrites.cache.get(guild.id);
      overwrites.push({
        id: guild.id,
        type: 0,
        allow: everyoneOw?.allow.bitfield ?? 0n,
        deny: (everyoneOw?.deny.bitfield ?? 0n) | denyBitfield,
      });

      // All other existing overwrites: preserve as-is
      for (const ow of channel.permissionOverwrites.cache.values()) {
        if (ow.id === guild.id) continue; // already handled above
        overwrites.push({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield,
          deny: ow.deny.bitfield,
        });
      }

      // Excluded roles: add allow for the denied permissions (so they bypass the lock)
      for (const roleId of cfg.exclude_roles) {
        if (overwrites.some((o) => o.id === roleId)) continue; // already included
        const existingOw = channel.permissionOverwrites.cache.get(roleId);
        overwrites.push({
          id: roleId,
          type: 0,
          allow: (existingOw?.allow.bitfield ?? 0n) | denyBitfield,
          deny: existingOw?.deny.bitfield ?? 0n,
        });
      }

      // 3. Write the full set back — nothing is lost
      await channel.permissionOverwrites.set(overwrites, reason ?? 'Channel locked');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  /**
   * Unlock a channel by restoring the exact overwrites from the snapshot.
   * If no snapshot exists, removes the lockdown deny permissions from @everyone
   * instead of wiping all overwrites.
   */
  public async unlockChannel(channel: TextChannel, reason?: string): Promise<{ ok: boolean; error?: string }> {
    if (!isLockable(channel)) return { ok: false, error: 'This channel cannot be unlocked.' };
    try {
      const snapshot = await this.getSnapshot(channel.guildId, channel.id);
      if (snapshot && snapshot.length > 0) {
        const resolvables = snapshot.map((o) => ({
          id: o.id,
          type: o.type,
          allow: BigInt(o.allow),
          deny: BigInt(o.deny),
        }));
        await channel.permissionOverwrites.set(resolvables, reason ?? 'Channel unlocked');
      } else {
        // No snapshot or empty snapshot — remove lockdown denies from @everyone only
        const cfg = this.app.config.channel_locking;
        const denyBitfield = PermissionsBitField.resolve(cfg.deny_permissions as PermissionResolvable[]);
        const overwrites = [...channel.permissionOverwrites.cache.values()].map((ow) => ({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield,
          deny: ow.id === channel.guildId ? ow.deny.bitfield & ~denyBitfield : ow.deny.bitfield,
        }));
        await channel.permissionOverwrites.set(overwrites, reason ?? 'Channel unlocked');
      }
      await this.app.db.execute(
        'UPDATE lockdown_snapshots SET active = 0, unlocked_at = NOW() WHERE guild_id = ? AND channel_id = ? AND active = 1',
        [channel.guildId, channel.id],
      );
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  public async lockAll(guild: Guild, reason?: string): Promise<{ locked: number; failed: number }> {
    const cfg = this.app.config.channel_locking;
    let channels: TextChannel[];
    if (cfg.channels.length > 0) {
      channels = cfg.channels.map((id) => guild.channels.cache.get(id)).filter((c): c is TextChannel => !!c && isLockable(c));
    } else {
      channels = [...guild.channels.cache.filter(isLockable).values()];
    }
    let locked = 0;
    let failed = 0;
    for (const channel of channels) {
      const result = await this.lockChannel(channel, reason);
      if (result.ok) locked++;
      else failed++;
    }
    return { locked, failed };
  }

  public async unlockAll(guild: Guild, reason?: string): Promise<{ unlocked: number; failed: number }> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT channel_id FROM lockdown_snapshots WHERE guild_id = ? AND active = 1',
      [guild.id],
    );

    let unlocked = 0;
    let failed = 0;

    if (rows.length > 0) {
      for (const row of rows) {
        const channel = guild.channels.cache.get(String(row.channel_id));
        if (channel && isLockable(channel)) {
          const result = await this.unlockChannel(channel, reason);
          if (result.ok) unlocked++;
          else failed++;
        }
      }
    } else {
      // No snapshots — remove lockdown denies from @everyone on all lockable channels
      const cfg = this.app.config.channel_locking;
      const channelIds = cfg.channels.length > 0 ? cfg.channels : [...guild.channels.cache.filter(isLockable).keys()];
      for (const id of channelIds) {
        const channel = guild.channels.cache.get(id);
        if (channel && isLockable(channel)) {
          try {
            const denyBitfield = PermissionsBitField.resolve(cfg.deny_permissions as PermissionResolvable[]);
            const overwrites = [...channel.permissionOverwrites.cache.values()].map((ow) => ({
              id: ow.id,
              type: ow.type,
              allow: ow.allow.bitfield,
              deny: ow.id === guild.id ? ow.deny.bitfield & ~denyBitfield : ow.deny.bitfield,
            }));
            await channel.permissionOverwrites.set(overwrites, reason ?? 'Channel unlocked');
            unlocked++;
          } catch {
            failed++;
          }
        }
      }
    }
    return { unlocked, failed };
  }

  /** Save the current overwrites to DB before locking. */
  private async snapshot(channel: TextChannel): Promise<void> {
    const overwrites = [...channel.permissionOverwrites.cache.values()].map((o) => ({
      id: o.id,
      type: o.type,
      allow: String(o.allow.bitfield),
      deny: String(o.deny.bitfield),
    }));
    // Deactivate any previous snapshot for this channel
    await this.app.db.execute(
      'UPDATE lockdown_snapshots SET active = 0 WHERE guild_id = ? AND channel_id = ? AND active = 1',
      [channel.guildId, channel.id],
    );
    await this.app.db.execute(
      `INSERT INTO lockdown_snapshots (guild_id, channel_id, overwrites)
       VALUES (?, ?, ?)`,
      [channel.guildId, channel.id, JSON.stringify(overwrites)],
    );
  }

  /** Retrieve the most recent active snapshot for a channel. */
  private async getSnapshot(guildId: string, channelId: string): Promise<OverwriteSnapshot[] | null> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT overwrites FROM lockdown_snapshots WHERE guild_id = ? AND channel_id = ? AND active = 1 ORDER BY id DESC LIMIT 1',
      [guildId, channelId],
    );
    if (rows.length === 0) return null;
    return parseJson(String(rows[0].overwrites), []) as OverwriteSnapshot[];
  }
}

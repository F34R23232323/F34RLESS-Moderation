import type { Guild, GuildMember } from 'discord.js';
import type { App } from '../core/context';
import { evaluateRoleConnection, evaluateConnectionResult } from '../../../shared/src/index';
import type { RoleConnection } from '../../../shared/src/index';

/**
 * Role Connections — Sapphire-style automatic role management.
 *
 * Each enabled connection owns one `main_role`. When the connection's
 * conditions are met the role is added; the moment they stop being met the role
 * is removed again. Conditions are `has_role` / `must not have` checks combined
 * with `all` (AND) or `any` (OR) logic.
 *
 * Re-syncs happen:
 *   - on member role add / remove / update (guildMemberUpdate),
 *   - on member join,
 *   - when a referenced role is deleted or edited (debounced full-guild pass),
 *   - on a periodic full-guild scan (every `sync_interval_minutes` minutes).
 */
export class RoleConnectionsService {
  private readonly app: App;
  private readonly heldSince = new Map<string, number>();
  private readonly resyncTimers = new Map<string, NodeJS.Timeout>();
  private syncRunning = false;
  private queued = false;

  constructor(app: App) {
    this.app = app;
  }

  public get enabled(): boolean {
    return this.app.config.role_connections.enabled;
  }

  public get connections(): RoleConnection[] {
    return this.app.config.role_connections.connections.filter((c) => c.enabled);
  }

  private heldKey(guildId: string, userId: string, index: number): string {
    return `${guildId}:${userId}:${index}`;
  }

  /**
   * Re-sync one member against every enabled connection. Used by the
   * guildMemberUpdate / guildMemberAdd event handlers.
   */
  public async syncMember(member: GuildMember): Promise<void> {
    if (!this.enabled) return;
    const conns = this.connections;
    if (conns.length === 0) return;
    if (!member.guild) return;
    if (member.user.bot) return;

    for (const conn of conns) {
      const index = this.app.config.role_connections.connections.indexOf(conn);
      await this.applyConnection(member, conn, index).catch((err) =>
        this.app.logger.warn(
          `Role connection "${conn.name ?? conn.main_role}" for ${member.id} in ${member.guild.id} failed:`,
          err,
        ),
      );
    }
  }

  /**
   * Full-guild pass: evaluate every member. Used by the periodic scan and by
   * the debounced re-sync triggered when a referenced role changes or is
   * deleted. Members whose roles already match are skipped (no API calls).
   */
  public async syncGuild(guild: Guild): Promise<void> {
    if (!this.enabled) return;
    const conns = this.connections;
    if (conns.length === 0) return;

    let members: GuildMember[];
    try {
      members = [...(await guild.members.fetch()).values()];
    } catch (err) {
      this.app.logger.warn(`Role connections: could not fetch members of ${guild.id}:`, err);
      return;
    }

    const relevant = new Set<string>();
    for (const conn of conns) {
      relevant.add(conn.main_role);
      for (const cond of conn.conditions) relevant.add(cond.role_id);
    }

    for (const member of members) {
      if (member.user.bot) continue;
      // Skip members that don't touch any role this connection graph cares about —
      // drastically cuts the work on big guilds for the periodic scan.
      const touches = member.roles.cache.some((r) => relevant.has(r.id));
      if (!touches) continue;
      for (const conn of conns) {
        const index = this.app.config.role_connections.connections.indexOf(conn);
        await this.applyConnection(member, conn, index).catch((err) =>
          this.app.logger.warn(
            `Role connection "${conn.name ?? conn.main_role}" for ${member.id} in ${guild.id} failed:`,
            err,
          ),
        );
      }
    }
  }

  /**
   * Periodic full re-sync across every guild the bot is in. Debounced so that
   * overlapping runs never pile up.
   */
  public async resyncAllGuilds(): Promise<void> {
    if (!this.enabled) return;
    if (this.syncRunning) {
      this.queued = true;
      return;
    }
    this.syncRunning = true;
    try {
      for (const guild of this.app.client.guilds.cache.values()) {
        await this.syncGuild(guild);
      }
    } finally {
      this.syncRunning = false;
    }
    if (this.queued) {
      this.queued = false;
      void this.resyncAllGuilds();
    }
  }

  /**
   * Debounced full-guild re-sync, used by role create/update/delete events so
   * a burst of role changes only triggers one pass.
   */
  public requestResync(guildId: string): void {
    const existing = this.resyncTimers.get(guildId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.resyncTimers.delete(guildId);
      const guild = this.app.client.guilds.cache.get(guildId);
      if (!guild) return;
      void this.syncGuild(guild).catch((err) =>
        this.app.logManager.reportError(`role connections resync for ${guildId}`, err),
      );
    }, 5_000);
    timer.unref?.();
    this.resyncTimers.set(guildId, timer);
  }

  /**
   * Called from role create/update/delete events. Only triggers a (debounced)
   * guild re-sync when the changed role is actually part of a connection —
   * otherwise unrelated role edits are ignored.
   */
  public onRoleChanged(guildId: string, roleId: string): void {
    if (!this.enabled) return;
    const referenced = this.connections.some(
      (c) => c.main_role === roleId || c.conditions.some((cond) => cond.role_id === roleId),
    );
    if (!referenced) return;
    this.requestResync(guildId);
  }

  private async applyConnection(member: GuildMember, conn: RoleConnection, index: number): Promise<void> {
    if (!conn.enabled) return;
    if (this.isUnmanageableRole(member, conn.main_role)) return;

    const roleIds = new Set(member.roles.cache.keys());
    const met = evaluateRoleConnection(conn, roleIds);
    const hasMain = member.roles.cache.has(conn.main_role);
    const key = this.heldKey(member.guild.id, member.id, index);

    if (met) {
      if (conn.held_for_seconds > 0) {
        const since = this.heldSince.get(key);
        if (since === undefined) {
          // Conditions just became true — start the hold timer.
          this.heldSince.set(key, Date.now());
          return;
        }
        // Keep the hold state while conditions stay met so a manually removed
        // main role is re-applied immediately instead of waiting a full hold.
        if (Date.now() - since < conn.held_for_seconds * 1000) return;
      }
      if (!hasMain) {
        await member.roles.add(conn.main_role, 'Role connection').catch(() => undefined);
        await this.logSync(member, conn, 'added');
      }
      return;
    }

    this.heldSince.delete(key);
    if (hasMain) {
      await member.roles.remove(conn.main_role, 'Role connection').catch(() => undefined);
      await this.logSync(member, conn, 'removed');
    }
  }

  private isUnmanageableRole(member: GuildMember, roleId: string): boolean {
    const guild = member.guild;
    const role = guild.roles.cache.get(roleId);
    if (!role) return true; // role no longer exists
    if (role.managed) return true; // bot / integration roles can't be managed by us
    if (role.id === guild.id) return true; // @everyone is never granted/removed
    const me = guild.members.me;
    if (!me) return true;
    const myHighest = me.roles.highest;
    if (!myHighest) return false;
    return role.position >= myHighest.position;
  }

  private async logSync(member: GuildMember, conn: RoleConnection, action: 'added' | 'removed'): Promise<void> {
    try {
      const role = member.guild.roles.cache.get(conn.main_role);
      const result = evaluateConnectionResult(conn, new Set(member.roles.cache.keys()));
      await this.app.logManager.log({
        event: action === 'added' ? 'role_add' : 'role_remove',
        guildId: member.guild.id,
        targetId: member.id,
        message: `<@${member.id}> ${action === 'added' ? 'was given' : 'lost'} <@&${conn.main_role}> (role connection${conn.name ? ` "${conn.name}"` : ''})`,
        details: {
          source: 'role_connection',
          mainRole: conn.main_role,
          mainRoleName: role?.name ?? null,
          logic: conn.logic,
          conditions: result.conditions,
        },
      });
    } catch {
      // logging must never break the role sync
    }
  }
}

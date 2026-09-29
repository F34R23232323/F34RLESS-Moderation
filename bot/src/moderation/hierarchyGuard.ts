import type { GuildMember, Role } from 'discord.js';
import type { App } from '../core/context';
import type { BotCommand } from '../types/command';
import { HIDDEN_PERMISSION_ROLE_IDS } from '../../../shared/src/staffHierarchy';

export interface GuardResult {
  ok: boolean;
  reason?: string;
}

function hasRole(member: any, roleId: string): boolean {
  if (!member?.roles) return false;
  if (typeof member.roles.cache?.has === 'function') return member.roles.cache.has(roleId);
  if (Array.isArray(member.roles?.cache)) return member.roles.cache.some((r: any) => r.id === roleId);
  if (Array.isArray(member.roles)) return member.roles.includes(roleId);
  if (Array.isArray(member.roles?._roles)) return member.roles._roles.includes(roleId);
  return false;
}

export class ModerationCommandGuard {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public isOwner(userId: string): boolean {
    return this.app.config.bot.owner_ids.includes(userId) || userId === this.app.env.OWNER_USER_ID;
  }

  public isImmune(target: GuildMember, command: BotCommand): boolean {
    const cfg = this.app.config.commands[command.name];
    const immuneIds = cfg?.immune_roles ?? [];
    if (immuneIds.length === 0) return false;
    return immuneIds.some((id) => hasRole(target, id));
  }

  public async isTargetWhitelisted(guildId: string, userId: string): Promise<boolean> {
    return this.app.whitelist.isWhitelisted(guildId, userId, 'moderation');
  }

  public hasRequiredPermissions(member: GuildMember, command: BotCommand): GuardResult {
    if (
      this.isOwner(member.id) ||
      member.id === member.guild?.ownerId ||
      HIDDEN_PERMISSION_ROLE_IDS.some((r) => hasRole(member, r))
    ) {
      return { ok: true };
    }
    const cfg = this.app.config.commands[command.name];

    const allowedRoles = cfg?.allowed_roles ?? [];
    if (allowedRoles.length > 0) {
      const hasAllowedRole = allowedRoles.some((r) => hasRole(member, r));
      if (!hasAllowedRole) {
        return { ok: false, reason: 'you do not have a required role for this command' };
      }
    }

    if (cfg?.permission_group) {
      const group = this.app.config.staff_permission_groups.groups.find((g) => g.name === cfg.permission_group);
      if (group) {
        const holdsGroupRole = group.roles.some((r) => hasRole(member, r));
        if (!holdsGroupRole) {
          return { ok: false, reason: `requires membership in staff group "${group.name}"` };
        }
        if (!group.permissions.includes(command.name) && !group.permissions.includes('*')) {
          return { ok: false, reason: `group "${group.name}" does not include "${command.name}"` };
        }
      }
    }

    const required = (cfg?.permissions !== undefined ? cfg.permissions : command.permissions) ?? [];
    if (required.length === 0) return { ok: true };
    if (!member.permissions?.has) return { ok: false, reason: 'missing member permissions' };
    const missing = required.filter((perm) => !member.permissions.has(perm as never));
    if (missing.length > 0) {
      return { ok: false, reason: `missing permission(s): ${missing.join(', ')}` };
    }
    return { ok: true };
  }

  public canModerate(target: GuildMember, staff: GuildMember): GuardResult {
    if (this.isOwner(staff.id) || staff.id === staff.guild.ownerId) return { ok: true };
    if (target.id === staff.id) return { ok: false, reason: 'you cannot moderate yourself' };
    if (target.id === target.guild.ownerId) return { ok: false, reason: 'you cannot moderate the server owner' };
    const botMember = this.app.client.guilds.cache.get(target.guild.id)?.members.me;
    if (botMember && !this.isHigher(botMember, target)) {
      return { ok: false, reason: 'the bot is below the target in the role hierarchy' };
    }
    if (!this.isHigher(staff, target)) {
      return { ok: false, reason: 'you are below the target in the role hierarchy' };
    }
    return { ok: true };
  }

  private isHigher(a: GuildMember, b: GuildMember): boolean {
    return a.roles.highest.position > b.roles.highest.position || (a.roles.highest.position === b.roles.highest.position && a.id !== b.id);
  }

  public isAboveRole(staff: GuildMember, role: Role): GuardResult {
    const botMember = this.app.client.guilds.cache.get(staff.guild.id)?.members.me;
    if (botMember && role.position >= botMember.roles.highest.position) {
      return { ok: false, reason: 'the bot is not high enough to manage that role' };
    }
    if (!this.isOwner(staff.id) && staff.id !== staff.guild.ownerId && role.position >= staff.roles.highest.position) {
      return { ok: false, reason: 'you cannot manage that role' };
    }
    return { ok: true };
  }
}
import type { GuildMember, Role } from 'discord.js';
import type { App } from '../core/context';
import type { BotCommand } from '../types/command';

export interface GuardResult {
  ok: boolean;
  reason?: string;
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
    return target.roles.cache.some((r) => immuneIds.includes(r.id));
  }

  public hasRequiredPermissions(member: GuildMember, command: BotCommand): GuardResult {
    if (this.isOwner(member.id)) return { ok: true };
    const cfg = this.app.config.commands[command.name];

    const allowedRoles = cfg?.allowed_roles ?? [];
    if (allowedRoles.length > 0) {
      const hasAllowedRole = member.roles.cache.some((r) => allowedRoles.includes(r.id));
      if (!hasAllowedRole) {
        return { ok: false, reason: 'you do not have a required role for this command' };
      }
    }

    if (cfg?.permission_group) {
      const group = this.app.config.staff_permission_groups.groups.find((g) => g.name === cfg.permission_group);
      if (group) {
        const holdsGroupRole = member.roles.cache.some((r) => group.roles.includes(r.id));
        if (!holdsGroupRole) {
          return { ok: false, reason: `requires membership in staff group "${group.name}"` };
        }
        if (!group.permissions.includes(command.name) && !group.permissions.includes('*')) {
          return { ok: false, reason: `group "${group.name}" does not include "${command.name}"` };
        }
      }
    }

    const required = command.permissions ?? [];
    if (required.length === 0) return { ok: true };
    const missing = required.filter((perm) => !member.permissions.has(perm as never));
    if (missing.length > 0) {
      return { ok: false, reason: `missing permission(s): ${missing.join(', ')}` };
    }
    return { ok: true };
  }

  public canModerate(target: GuildMember, staff: GuildMember): GuardResult {
    if (this.isOwner(staff.id)) return { ok: true };
    if (target.id === staff.id) return { ok: false, reason: 'you cannot moderate yourself' };
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
    if (role.position >= staff.roles.highest.position) {
      return { ok: false, reason: 'you cannot manage that role' };
    }
    return { ok: true };
  }
}
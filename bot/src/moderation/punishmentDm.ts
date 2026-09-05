import type { Guild, User } from 'discord.js';
import type { App } from '../core/context';
import type { PunishmentType } from '../../../shared/src/index';
import { renderPlaceholders, humanizeDuration } from '../../../shared/src/index';
import { buildV2Content } from '../utils/v2';
import { notificationDmGuard } from './notificationDmGuard';

export interface PunishmentDmContext {
  guild: Guild;
  user: User;
  reason?: string;
  moderator?: string;
  durationMs?: number | null;
  caseCode?: string;
}

export class PunishmentDmManager {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  public async send(type: PunishmentType, ctx: PunishmentDmContext): Promise<boolean> {
    const cfg = this.app.config.punishment_dms;
    if (!cfg.enabled) return false;
    const typeCfg = cfg.types[type];
    if (!typeCfg || !typeCfg.enabled) return false;
    const priority = type === 'ban' ? 4 : type === 'kick' ? 3 : type === 'mute' || type === 'timeout' ? 2 : 1;
    const guardKey = `punishment:${ctx.guild.id}:${type}:${ctx.caseCode ?? ctx.reason ?? 'unknown'}`;
    if (!notificationDmGuard.allow(ctx.user.id, guardKey, priority, cfg.cooldown_seconds)) return false;

    const expiry = ctx.durationMs && ctx.durationMs > 0
      ? Math.floor((Date.now() + ctx.durationMs) / 1000)
      : null;

    const placeholders: Record<string, string> = {
      guild: ctx.guild.name,
      guild_id: ctx.guild.id,
      user: ctx.user.username,
      reason: ctx.reason ?? 'no reason provided',
      moderator: cfg.hide_moderator ? 'staff' : (ctx.moderator ?? 'staff'),
      duration: ctx.durationMs ? humanizeDuration(ctx.durationMs) : 'permanent',
      expires_at: expiry ? `<t:${expiry}:F> (<t:${expiry}:R>)` : 'Never',
      case_id: ctx.caseCode ?? 'n/a',
      punishment: type.replace('_', ' '),
      appeal_instructions: 'you can contact a staff member to appeal',
    };

    const content = renderPlaceholders(typeCfg.content, placeholders);
    try {
      const dm = await ctx.user.createDM();
      const payload = buildV2Content(content);
      await dm.send({ ...payload } as never);
      return true;
    } catch {
      notificationDmGuard.release(ctx.user.id, guardKey);
      return false;
    }
  }
}

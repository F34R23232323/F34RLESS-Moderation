import type { Guild, User } from 'discord.js';
import type { App } from '../core/context';
import type { PunishmentType } from '../../../shared/src/index';
import { renderPlaceholders, humanizeDuration } from '../../../shared/src/index';
import { buildV2Content } from '../utils/v2';

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

    const placeholders: Record<string, string> = {
      guild: ctx.guild.name,
      guild_id: ctx.guild.id,
      user: ctx.user.username,
      reason: ctx.reason ?? 'no reason provided',
      moderator: cfg.hide_moderator ? 'staff' : (ctx.moderator ?? 'staff'),
      duration: ctx.durationMs ? humanizeDuration(ctx.durationMs) : 'permanent',
      case_id: ctx.caseCode ?? 'n/a',
      appeal_instructions: 'you can contact a staff member to appeal',
    };

    const content = renderPlaceholders(typeCfg.content, placeholders);
    try {
      const dm = await ctx.user.createDM();
      const payload = buildV2Content(content);
      await dm.send({ ...payload } as never);
      return true;
    } catch {
      return false;
    }
  }
}
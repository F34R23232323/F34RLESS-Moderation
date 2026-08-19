import { GuildMember } from 'discord.js';
import type { Guild, User } from 'discord.js';
import type { App } from '../core/context';
import type { PunishmentType } from '../../../shared/src/index';
import { humanizeDuration } from '../../../shared/src/index';
import type { CaseRow } from './caseService';

export interface PunishOptions {
  reason?: string;
  durationMs?: number | null;
  moderatorId?: string | null;
  evidence?: unknown[];
  deleteMessageDays?: number;
  silent?: boolean;
  /** Channel to look for the target's recent messages when archiving evidence. */
  archiveChannelId?: string | null;
  /** Set to false to skip auto-archiving evidence for this punishment. */
  archive?: boolean;
  /** Which log event to emit for a timeout/mute (default member_timeout). */
  logEvent?: 'member_mute' | 'member_timeout';
}

export interface PunishResult {
  ok: boolean;
  case?: CaseRow;
  error?: string;
  dmSent: boolean;
}

export class PunishmentManager {
  private readonly app: App;

  // Bot-initiated timeout/mute changes, so the guildMemberUpdate handler
  // doesn't double-log the same transition that we already logged in the
  // punishment flow (e.g. via /mute, /timeout, /unmute).
  private readonly muteSuppressions = new Map<string, { action: 'mute' | 'unmute'; at: number }>();
  private static readonly MUTE_SUPPRESS_TTL_MS = 15_000;

  constructor(app: App) {
    this.app = app;
  }

  public markMuteChange(guildId: string, userId: string, action: 'mute' | 'unmute'): void {
    this.muteSuppressions.set(`${guildId}:${userId}`, { action, at: Date.now() });
  }

  public consumeMuteSuppression(guildId: string, userId: string, action: 'mute' | 'unmute'): boolean {
    const key = `${guildId}:${userId}`;
    const entry = this.muteSuppressions.get(key);
    if (!entry) return false;
    if (Date.now() - entry.at > PunishmentManager.MUTE_SUPPRESS_TTL_MS) {
      this.muteSuppressions.delete(key);
      return false;
    }
    if (entry.action !== action) return false;
    this.muteSuppressions.delete(key);
    return true;
  }

  private async dmBefore(
    type: PunishmentType,
    guild: Guild,
    user: User,
    options: PunishOptions,
    durationMs?: number | null,
  ): Promise<boolean> {
    if (this.app.config.punishment_dms.order !== 'before') return false;
    return this.app.punishmentDm.send(type, {
      guild,
      user,
      reason: options.reason,
      moderator: options.moderatorId ? (await guild.members.fetch(options.moderatorId).catch(() => null))?.displayName ?? undefined : undefined,
      durationMs: options.durationMs ?? durationMs,
    });
  }

  private async dmAfter(
    type: PunishmentType,
    guild: Guild,
    user: User,
    caseRow: CaseRow,
    options: PunishOptions,
  ): Promise<boolean> {
    if (this.app.config.punishment_dms.order !== 'after') return false;
    return this.app.punishmentDm.send(type, {
      guild,
      user,
      reason: options.reason,
      moderator: options.moderatorId ? (await guild.members.fetch(options.moderatorId).catch(() => null))?.displayName ?? undefined : undefined,
      durationMs: options.durationMs,
      caseCode: caseRow.case_code,
    });
  }

  private async archiveCaseEvidence(
    guild: Guild,
    userId: string,
    caseRow: CaseRow,
    options: PunishOptions,
  ): Promise<string | null> {
    if (!this.app.config.archives.enabled) return null;
    if (options.archive === false) return null;
    try {
      const result = await this.app.archives.archiveForCase({
        guild,
        userId,
        channelId: options.archiveChannelId ?? null,
        createdBy: options.moderatorId ?? null,
        caseId: caseRow.id,
        reason: options.reason ?? null,
        type: caseRow.type,
      });
      if (result?.link) {
        const evidence = Array.isArray(caseRow.evidence) ? (caseRow.evidence as unknown[]) : [];
        await this.app.db.execute('UPDATE cases SET evidence = ? WHERE id = ?', [
          JSON.stringify([...evidence, { type: 'archive', url: result.link, code: result.code, messages: result.messageCount }]),
          caseRow.id,
        ]);
      }
      return result?.link ?? null;
    } catch (err) {
      this.app.logger.warn(`Archive for case ${caseRow.case_code} failed:`, err);
      return null;
    }
  }

  public async warn(target: GuildMember | User, options: PunishOptions): Promise<PunishResult> {
    const guild = target instanceof GuildMember ? target.guild : (await this.resolveGuild());
    if (!guild) return { ok: false, error: 'guild not resolved', dmSent: false };

    const user = target instanceof GuildMember ? target.user : target;
    const dmSent = await this.dmBefore('warn', guild, user, options);
    const caseRow = await this.app.caseService.createCase({
      guildId: guild.id,
      type: 'warn',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'No reason provided',
      evidence: options.evidence,
    });

    await this.app.db.execute(
      `INSERT INTO warnings (guild_id, user_id, case_id, moderator_id, reason, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        guild.id,
        target.id,
        caseRow.id,
        options.moderatorId ?? null,
        options.reason ?? 'No reason provided',
        this.app.config.warnings.decay.enabled
          ? new Date(Date.now() + this.app.config.warnings.decay.after_days * 86400000)
          : null,
      ],
    );

    await this.dmAfter('warn', guild, user, caseRow, options);

    const archiveLink = await this.archiveCaseEvidence(guild, target.id, caseRow, options);

    await this.app.logManager.log({
      event: 'member_warn',
      guildId: guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Warned <@${target.id}> (case ${caseRow.case_code})${archiveLink ? ` — Evidence: ${archiveLink}` : ''}`,
      details: { type: 'warn', caseCode: caseRow.case_code, reason: options.reason, archiveLink },
    });

    await this.app.warningEscalation.check(guild.id, target.id);
    return { ok: true, case: caseRow, dmSent };
  }

  public async timeout(target: GuildMember, durationMs: number, options: PunishOptions): Promise<PunishResult> {
    const dmSent = await this.dmBefore('mute', target.guild, target.user, options, durationMs);
    const logEvent = options.logEvent ?? 'member_timeout';
    this.markMuteChange(target.guild.id, target.id, 'mute');
    try {
      await target.timeout(durationMs, options.reason ?? undefined);
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }

    const caseRow = await this.app.caseService.createCase({
      guildId: target.guild.id,
      type: 'mute',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'No reason provided',
      durationMs,
      evidence: options.evidence,
    });

    await this.app.db.execute(
      `INSERT INTO punishments (guild_id, user_id, type, case_id, expires_at)
       VALUES (?, ?, 'mute', ?, ?)`,
      [target.guild.id, target.id, caseRow.id, new Date(Date.now() + durationMs)],
    );

    await this.dmAfter('mute', target.guild, target.user, caseRow, options);

    const archiveLink = await this.archiveCaseEvidence(target.guild, target.id, caseRow, options);

    const verb = logEvent === 'member_mute' ? 'Muted' : 'Timed out';
    await this.app.logManager.log({
      event: logEvent,
      guildId: target.guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `${verb} <@${target.id}> for ${humanizeDuration(durationMs)} (case ${caseRow.case_code})${archiveLink ? ` — Evidence: ${archiveLink}` : ''}`,
      details: { type: 'mute', durationMs, caseCode: caseRow.case_code, reason: options.reason, archiveLink },
    });

    return { ok: true, case: caseRow, dmSent };
  }

  public async unmute(target: GuildMember, options: PunishOptions): Promise<PunishResult> {
    const dmSent = await this.dmBefore('unmute', target.guild, target.user, options);
    this.markMuteChange(target.guild.id, target.id, 'unmute');
    try {
      await target.timeout(null);
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }
    await this.app.db.execute(
      "UPDATE punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'mute' AND active = 1",
      [target.guild.id, target.id],
    );
    const caseRow = await this.app.caseService.createCase({
      guildId: target.guild.id,
      type: 'unmute',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'Mute lifted',
    });
    await this.dmAfter('unmute', target.guild, target.user, caseRow, options);

    await this.app.logManager.log({
      event: 'member_unmute',
      guildId: target.guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Unmuted <@${target.id}> (case ${caseRow.case_code})`,
      details: { type: 'unmute', caseCode: caseRow.case_code, reason: options.reason },
    });

    return { ok: true, case: caseRow, dmSent };
  }

  public async kick(target: GuildMember, options: PunishOptions): Promise<PunishResult> {
    const dmSent = await this.dmBefore('kick', target.guild, target.user, options);
    try {
      await target.kick(options.reason ?? undefined);
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }
    const caseRow = await this.app.caseService.createCase({
      guildId: target.guild.id,
      type: 'kick',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'No reason provided',
      evidence: options.evidence,
    });
    await this.dmAfter('kick', target.guild, target.user, caseRow, options);
    const archiveLink = await this.archiveCaseEvidence(target.guild, target.id, caseRow, options);
    await this.app.logManager.log({
      event: 'member_kick',
      guildId: target.guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Kicked <@${target.id}> (case ${caseRow.case_code})${archiveLink ? ` — Evidence: ${archiveLink}` : ''}`,
      details: { type: 'kick', caseCode: caseRow.case_code, reason: options.reason, archiveLink },
    });
    return { ok: true, case: caseRow, dmSent };
  }

  public async ban(target: GuildMember | User, options: PunishOptions): Promise<PunishResult> {
    const guild = target instanceof GuildMember ? target.guild : (await this.resolveGuild());
    if (!guild) return { ok: false, error: 'guild not resolved', dmSent: false };

    const user = target instanceof GuildMember ? target.user : target;
    const dmSent = await this.dmBefore('ban', guild, user, options, options.durationMs);
    try {
      await guild.bans.create(target.id, {
        reason: options.reason ?? undefined,
        deleteMessageSeconds: options.deleteMessageDays ? options.deleteMessageDays * 86400 : 0,
      });
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }

    const caseRow = await this.app.caseService.createCase({
      guildId: guild.id,
      type: options.durationMs ? 'tempban' : 'ban',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'No reason provided',
      durationMs: options.durationMs,
      evidence: options.evidence,
    });

    if (options.durationMs) {
      await this.app.db.execute(
        `INSERT INTO punishments (guild_id, user_id, type, case_id, expires_at)
         VALUES (?, ?, 'ban', ?, ?)`,
        [guild.id, target.id, caseRow.id, new Date(Date.now() + options.durationMs)],
      );
    }

    await this.dmAfter('ban', guild, user, caseRow, options);

    const archiveLink = await this.archiveCaseEvidence(guild, target.id, caseRow, options);

    await this.app.logManager.log({
      event: 'member_ban',
      guildId: guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Banned <@${target.id}>${options.durationMs ? ` for ${humanizeDuration(options.durationMs)}` : ''} (case ${caseRow.case_code})${archiveLink ? ` — Evidence: ${archiveLink}` : ''}`,
      details: { type: 'ban', caseCode: caseRow.case_code, reason: options.reason, durationMs: options.durationMs, archiveLink },
    });

    return { ok: true, case: caseRow, dmSent };
  }

  public async unban(guild: Guild, userId: string, options: PunishOptions): Promise<PunishResult> {
    const user = await guild.client.users.fetch(userId).catch(() => null);
    const dmSent = user ? await this.dmBefore('unban', guild, user, options) : false;
    try {
      await guild.bans.remove(userId, options.reason ?? undefined);
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }
    await this.app.db.execute(
      "UPDATE punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'ban' AND active = 1",
      [guild.id, userId],
    );
    const caseRow = await this.app.caseService.createCase({
      guildId: guild.id,
      type: 'unban',
      userId,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'Ban lifted',
    });
    if (user) await this.dmAfter('unban', guild, user, caseRow, options);

    await this.app.logManager.log({
      event: 'member_unban',
      guildId: guild.id,
      actorId: options.moderatorId ?? null,
      targetId: userId,
      message: `Unbanned <@${userId}> (case ${caseRow.case_code})`,
      details: { type: 'unban', caseCode: caseRow.case_code, reason: options.reason },
    });

    return { ok: true, case: caseRow, dmSent };
  }

  public async softban(target: GuildMember | User, options: PunishOptions): Promise<PunishResult> {
    const guild = target instanceof GuildMember ? target.guild : (await this.resolveGuild());
    if (!guild) return { ok: false, error: 'guild not resolved', dmSent: false };

    const user = target instanceof GuildMember ? target.user : target;
    const dmSent = await this.dmBefore('kick', guild, user, options);
    try {
      await guild.bans.create(target.id, {
        reason: `${options.reason ?? 'Softban'} (softban)`,
        deleteMessageSeconds: (options.deleteMessageDays ?? 7) * 86400,
      });
      await guild.bans.remove(target.id, 'softban automatic unban');
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent };
    }
    const caseRow = await this.app.caseService.createCase({
      guildId: guild.id,
      type: 'softban',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? 'No reason provided',
      evidence: options.evidence,
    });
    await this.dmAfter('kick', guild, user, caseRow, options);

    const archiveLink = await this.archiveCaseEvidence(guild, target.id, caseRow, options);

    await this.app.logManager.log({
      event: 'member_ban',
      guildId: guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Softbanned <@${target.id}> (case ${caseRow.case_code})${archiveLink ? ` — Evidence: ${archiveLink}` : ''}`,
      details: { type: 'softban', caseCode: caseRow.case_code, reason: options.reason, archiveLink },
    });

    return { ok: true, case: caseRow, dmSent };
  }

  public async tempRole(target: GuildMember, roleId: string, durationMs: number, options: PunishOptions): Promise<PunishResult> {
    try {
      await target.roles.add(roleId, options.reason ?? undefined);
    } catch (err) {
      return { ok: false, error: (err as Error).message, dmSent: false };
    }
    await this.app.db.execute(
      `INSERT INTO punishments (guild_id, user_id, type, role_id, case_id, expires_at)
       VALUES (?, ?, 'temp_role', ?, NULL, ?)`,
      [target.guild.id, target.id, roleId, new Date(Date.now() + durationMs)],
    );
    const caseRow = await this.app.caseService.createCase({
      guildId: target.guild.id,
      type: 'temp_role',
      userId: target.id,
      moderatorId: options.moderatorId ?? null,
      reason: options.reason ?? `Temporary role <@&${roleId}>`,
      durationMs,
    });
    await this.app.logManager.log({
      event: 'moderation_action',
      guildId: target.guild.id,
      actorId: options.moderatorId ?? null,
      targetId: target.id,
      message: `Applied temporary role <@&${roleId}> to <@${target.id}> (case ${caseRow.case_code})`,
      details: { type: 'temp_role', roleId, durationMs, caseCode: caseRow.case_code },
    });
    return { ok: true, case: caseRow, dmSent: false };
  }

  public async applyFromAction(
    guild: Guild,
    type: string,
    target: GuildMember | User,
    options: PunishOptions,
  ): Promise<PunishResult> {
    switch (type) {
      case 'warn':
        return this.warn(target, options);
      case 'mute':
      case 'timeout':
        if (!(target instanceof GuildMember)) return { ok: false, error: 'target must be a member', dmSent: false };
        return this.timeout(target, options.durationMs ?? 3600000, {
          ...options,
          logEvent: type === 'mute' ? 'member_mute' : 'member_timeout',
        });
      case 'kick':
        if (!(target instanceof GuildMember)) return { ok: false, error: 'target must be a member', dmSent: false };
        return this.kick(target, options);
      case 'ban':
        return this.ban(target, options);
      case 'softban':
        return this.softban(target, options);
      default:
        return { ok: false, error: `unknown action type ${type}`, dmSent: false };
    }
  }

  private async resolveGuild(): Promise<Guild | null> {
    return this.app.client.guilds.cache.first() ?? null;
  }
}
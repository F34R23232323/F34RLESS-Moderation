import type { Guild, GuildMember, Message, TextBasedChannel } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { resolveAppealConfig, safeDiscordText, sanitizeForDiscord } from '../../../shared/src/index';
import {
  buildAppealSystemMessage,
  buildDecidedAppealCard,
  buildOpenAppealCard,
  type AppealEmbedData,
} from './appealEmbedBuilder';

// ---------------------------------------------------------------------------
// Appeals bot service.
//
// The dashboard writes rows into `appeal_actions` (same IPC pattern as
// dashboard_log_requests); this service polls pending rows on the scheduler
// and performs the Discord-side work: posting the Components V2 card, creating
// threads, relaying chat messages, reversing punishments on accept, editing
// the card, and DMing the appellant.
// ---------------------------------------------------------------------------

interface AppealRow extends RowDataPacket {
  id: number;
  guild_id: string;
  case_id: number;
  user_id: string;
  status: 'pending' | 'accepted' | 'denied' | 'ignored';
  submitted_at: Date;
  decided_at: Date | null;
  decided_by: string | null;
  decision_reason: string | null;
  discord_message_id: string | null;
  discord_thread_id: string | null;
}

interface CaseRowLite extends RowDataPacket {
  id: number;
  case_number: number;
  case_code: string;
  type: string;
  user_id: string;
  moderator_id: string | null;
  reason: string;
  status: string;
}

interface AppealAnswerRow extends RowDataPacket {
  question_id: string;
  answer_text: string | null;
  answer_bool: number | null;
}

export interface StaffCheckInput {
  guild: Guild;
  member: GuildMember | null;
}

/**
 * Staff tier check used by both the Discord buttons and the slash commands:
 * bot owners, anyone holding a role from a staff_permission_groups group that
 * includes the `appeal` permission, or members with ModerateMembers.
 */
export function isAppealsStaff(app: App, input: StaffCheckInput): boolean {
  if (app.modGuard.isOwner(input.member?.id ?? '')) return true;
  if (!input.member) return false;
  const member = input.member as GuildMember & { roles: GuildMember['roles'] };
  if (member.permissions?.has('ModerateMembers' as never)) return true;

  // role ids: GuildMember has a Roles cache; interaction API members expose
  // a plain array — handle both shapes.
  const roleIds = new Set<string>();
  const rolesAny = member.roles as unknown as { cache?: Map<string, unknown>; ids?: string[] } | string[];
  if (Array.isArray(rolesAny)) {
    for (const id of rolesAny) roleIds.add(id);
  } else if (rolesAny.cache) {
    for (const id of rolesAny.cache.keys()) roleIds.add(id);
  } else if (Array.isArray((rolesAny as { ids?: string[] }).ids)) {
    for (const id of (rolesAny as { ids?: string[] }).ids ?? []) roleIds.add(id);
  }

  const groups = app.config.staff_permission_groups.groups;
  for (const group of groups) {
    if (!group.permissions.includes('appeal') && !group.permissions.includes('*')) continue;
    if (group.roles.some((r) => roleIds.has(r))) return true;
  }
  return false;
}

// TextBasedChannel's union includes PartialGroupDMChannel (no send); a small
// structural type is used wherever we only post messages / open threads.
type SendableMessage = { id: string; startThread: (opts: { name: string }) => Promise<SendableChannel> };
type SendableChannel = {
  id: string;
  send: (payload: never) => Promise<SendableMessage>;
};

export class AppealService {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  /** Poll the dashboard IPC queue (scheduled every 5s). */
  public async processPending(): Promise<void> {
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      `SELECT id, guild_id, appeal_id, action, payload FROM appeal_actions
       WHERE status = 'pending' ORDER BY id ASC LIMIT 20`,
    );
    for (const raw of rows) {
      const req = raw as unknown as { id: number; guild_id: string; appeal_id: number | null; action: string; payload: string | null };
      try {
        let ok = false;
        if (req.action === 'post' && req.appeal_id != null) {
          ok = await this.postAppeal(req.appeal_id);
        } else if (req.action === 'decide' && req.appeal_id != null) {
          ok = await this.executeDecision(req.appeal_id);
        } else if (req.action === 'relay' && req.appeal_id != null && req.payload) {
          const payload = JSON.parse(req.payload) as { messageId?: number };
          ok = await this.relayStaffMessage(req.appeal_id, payload.messageId ?? 0);
        } else {
          ok = false;
        }
        await this.app.db.execute("UPDATE appeal_actions SET status = 'done', processed_at = NOW() WHERE id = ?", [req.id]);
        if (!ok) {
          this.app.logger.warn(`Appeal action ${req.action} (id ${req.id}) completed without effect`);
        }
      } catch (err) {
        this.app.logger.error(`Appeal action ${req.action} (id ${req.id}) failed:`, err);
        await this.app.db.execute(
          "UPDATE appeal_actions SET status = 'failed', error = ?, processed_at = NOW() WHERE id = ?",
          [(err as Error).message.slice(0, 1000), req.id],
        );
      }
    }
  }

  private async loadAppeal(appealId: number, guildId?: string): Promise<AppealRow | null> {
    const [rows] = await this.app.db.query<AppealRow[]>(
      guildId
        ? 'SELECT * FROM appeals WHERE id = ? AND guild_id = ?'
        : 'SELECT * FROM appeals WHERE id = ?',
      guildId ? [appealId, guildId] : [appealId],
    );
    return rows[0] ?? null;
  }

  private async loadCase(caseId: number): Promise<CaseRowLite | null> {
    const [rows] = await this.app.db.query<CaseRowLite[]>(
      'SELECT id, case_number, case_code, type, user_id, moderator_id, reason, status FROM cases WHERE id = ?',
      [caseId],
    );
    return rows[0] ?? null;
  }

  private async loadAnswers(appealId: number): Promise<AppealAnswerRow[]> {
    const [rows] = await this.app.db.query<AppealAnswerRow[]>(
      'SELECT question_id, answer_text, answer_bool FROM appeal_answers WHERE appeal_id = ?',
      [appealId],
    );
    return rows;
  }

  private async insertSystemMessage(appeal: AppealRow, senderId: string, content: string): Promise<void> {
    await this.app.db.execute(
      "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'staff', ?, ?)",
      [appeal.id, senderId, sanitizeForDiscord(content, 2000)],
    );
  }

  /** Resolve the appeal thread channel (fetches once, falls back to cache). */
  private async resolveThread(appeal: AppealRow, guild: Guild): Promise<SendableChannel | null> {
    if (!appeal.discord_thread_id) return null;
    const cached = guild.channels.cache.get(appeal.discord_thread_id);
    if (cached && 'send' in cached) return cached as unknown as SendableChannel;
    const fetched = await guild.channels.fetch(appeal.discord_thread_id).catch(() => null);
    return fetched && 'send' in fetched ? (fetched as unknown as SendableChannel) : null;
  }

  /** Post the Components V2 appeal card to the guild's log channel (+ thread). */
  public async postAppeal(appealId: number): Promise<boolean> {
    const appeal = await this.loadAppeal(appealId);
    if (!appeal) return false;
    const guild = this.app.client.guilds.cache.get(appeal.guild_id);
    if (!guild) return false;
    const cfg = resolveAppealConfig(this.app.config.appeals, appeal.guild_id);
    if (!cfg.enabled) return false;
    if (!cfg.log_channel_id) {
      this.app.logger.warn(`Appeal #${appeal.id}: appeals.log_channel_id not set for guild ${appeal.guild_id}`);
      return false;
    }

    const channel = guild.channels.cache.get(cfg.log_channel_id) ?? (await guild.channels.fetch(cfg.log_channel_id).catch(() => null));
    if (!channel || !('send' in channel)) {
      this.app.logger.warn(`Appeal #${appeal.id}: log channel ${cfg.log_channel_id} not found in guild ${appeal.guild_id}`);
      return false;
    }

    const [caseRow, answers, user] = await Promise.all([
      this.loadCase(appeal.case_id),
      this.loadAnswers(appeal.id),
      this.app.client.users.fetch(appeal.user_id).catch(() => null),
    ]);
    if (!caseRow) return false;

    const cfgForm = cfg.form;
    const answerLines: Array<{ question: string; answer: string }> = [];
    for (const a of answers) {
      const q = cfgForm.find((f) => f.id === a.question_id);
      const label = q?.label ?? a.question_id;
      const value = a.answer_text != null ? a.answer_text : a.answer_bool ? 'Yes' : 'No';
      answerLines.push({ question: label, answer: value });
    }

    const card = buildOpenAppealCard({
      appealId: appeal.id,
      status: 'pending',
      caseNumber: caseRow.case_number,
      caseCode: caseRow.case_code,
      caseType: caseRow.type,
      caseReason: caseRow.reason,
      caseModeratorId: caseRow.moderator_id,
      userId: appeal.user_id,
      userTag: user?.tag ?? null,
      answers: answerLines,
    });

    const content = cfg.ping_role_id ? `<@&${cfg.ping_role_id}>` : '';
    const allowedMentions: { parse: string[]; roles?: string[] } = cfg.ping_role_id
      ? { parse: [], roles: [cfg.ping_role_id] }
      : { parse: [] };

    const sent = await (channel as unknown as SendableChannel).send({
      content,
      components: card.components,
      flags: card.flags,
      allowedMentions,
    } as never);

    await this.app.db.execute('UPDATE appeals SET discord_message_id = ? WHERE id = ?', [sent.id, appeal.id]);

    // Auto-create a thread for the discussion (if enabled).
    if (cfg.thread_auto_create && 'startThread' in sent) {
      const username = user?.username ?? 'user';
      const name = `Appeal #${appeal.id} — ${username}`.slice(0, 100);
      try {
        const thread = await sent.startThread({ name });
        await this.app.db.execute('UPDATE appeals SET discord_thread_id = ? WHERE id = ?', [thread.id, appeal.id]);
        await thread.send(buildAppealSystemMessage(`Appeal opened — staff can reply here or in the portal.`) as never).catch(() => undefined);
      } catch (err) {
        this.app.logger.warn(`Could not auto-create thread for appeal #${appeal.id}:`, err);
      }
    }

    await this.app.logManager.log({
      event: 'appeal_created',
      guildId: appeal.guild_id,
      actorId: appeal.user_id,
      targetId: appeal.user_id,
      channelId: cfg.log_channel_id,
      message: `Appeal #${appeal.id} filed for case ${caseRow.case_code} (${caseRow.type})`,
      details: { appealId: appeal.id, caseId: caseRow.id, caseCode: caseRow.case_code },
    });

    return true;
  }

  /**
   * Apply the outcome of a decision. The status is written transactionally by
   * the caller (button handler or dashboard decide endpoint) — this method is
   * idempotent and only performs the side effects:
   *   accepted -> reverse the punishment + void where applicable
   *   denied/ignored -> punishment untouched
   * plus editing the Discord card, DMing the user, system chat message.
   */
  public async executeDecision(appealId: number): Promise<boolean> {
    const appeal = await this.loadAppeal(appealId);
    if (!appeal) return false;
    if (appeal.status === 'pending') return false;
    const guild = this.app.client.guilds.cache.get(appeal.guild_id);
    const caseRow = await this.loadCase(appeal.case_id);
    if (!guild || !caseRow) return false;

    const cfg = resolveAppealConfig(this.app.config.appeals, appeal.guild_id);

    // ── Accept: reverse/remove the punishment (reuse existing logic) ────────
    if (appeal.status === 'accepted') {
      const reason = `Appeal accepted${appeal.decision_reason ? ` — ${appeal.decision_reason}` : ''}`;
      try {
        if (caseRow.type === 'ban' || caseRow.type === 'tempban') {
          await this.app.punishmentManager.unban(guild, appeal.user_id, {
            reason,
            moderatorId: appeal.decided_by ?? undefined,
            silent: true,
          });
        } else if (caseRow.type === 'mute' || caseRow.type === 'timeout') {
          const member = await guild.members.fetch(appeal.user_id).catch(() => null);
          if (member) {
            await this.app.punishmentManager.unmute(member, {
              reason,
              moderatorId: appeal.decided_by ?? undefined,
              silent: true,
            });
          } else {
            await this.app.db.execute(
              "UPDATE punishments SET active = 0 WHERE guild_id = ? AND user_id = ? AND type = 'mute' AND active = 1",
              [guild.id, appeal.user_id],
            );
            await this.app.db.execute("UPDATE cases SET status = 'voided' WHERE id = ?", [caseRow.id]);
          }
        } else if (caseRow.type === 'warn') {
          await this.app.caseService.deactivateWarning(caseRow.id);
          await this.app.caseService.voidCase(caseRow.id, `Appeal accepted by <@${appeal.decided_by ?? 'system'}>`);
        } else {
          // kick / softban — cannot be undone, void the case as the remedy.
          await this.app.caseService.voidCase(caseRow.id, `Appeal accepted by <@${appeal.decided_by ?? 'system'}>`);
        }
      } catch (err) {
        this.app.logger.warn(`Appeal #${appeal.id} accept-reversal failed:`, err);
      }
    }

    // ── Edit the Discord card to its decided state ───────────────────────────
    await this.editCard(appeal, caseRow, guild, cfg.log_channel_id);

    // ── DM the appellant ─────────────────────────────────────────────────────
    const user = await this.app.client.users.fetch(appeal.user_id).catch(() => null);
    if (user) {
      const lines = [`Your appeal #${appeal.id} for case ${caseRow.case_code} was **${appeal.status}**.`];
      if (appeal.decision_reason) lines.push(`\nReason: ${appeal.decision_reason}`);
      if (appeal.status === 'accepted') lines.push(`\nThe punishment has been reversed.`);
      else if (appeal.status === 'denied') lines.push(`\nThe punishment stands.`);
      else lines.push(`\nThe appeal was closed without a ruling.`);
      await user.send({ content: lines.join('\n') }).catch(() => undefined);
    }

    // ── System message in the chat + thread ──────────────────────────────────
    const statusLabel = appeal.status === 'accepted' ? 'accepted' : appeal.status === 'denied' ? 'denied' : 'ignored';
    const systemText = `Appeal **${statusLabel}**${appeal.decided_by ? ` by <@${appeal.decided_by}>` : ''}${appeal.decision_reason ? ` — ${appeal.decision_reason}` : ''}`;
    await this.insertSystemMessage(appeal, appeal.decided_by ?? 'system', systemText);
    const thread = await this.resolveThread(appeal, guild);
    if (thread) {
      await thread.send(buildAppealSystemMessage(systemText) as never).catch(() => undefined);
    }

    await this.app.logManager.log({
      event: 'appeal_resolved',
      guildId: appeal.guild_id,
      actorId: appeal.decided_by ?? undefined,
      targetId: appeal.user_id,
      message: `Appeal #${appeal.id} ${statusLabel} (case ${caseRow.case_code})`,
      details: { appealId: appeal.id, caseId: caseRow.id, status: appeal.status, decisionReason: appeal.decision_reason },
    });

    return true;
  }

  private async editCard(
    appeal: AppealRow,
    caseRow: CaseRowLite,
    guild: Guild,
    logChannelId: string | undefined,
  ): Promise<void> {
    if (!appeal.discord_message_id) return;
    const channel = logChannelId ? (guild.channels.cache.get(logChannelId) ?? (await guild.channels.fetch(logChannelId).catch(() => null))) : null;
    if (!channel || !('messages' in channel)) return;
    const message = await (channel as TextBasedChannel).messages.fetch(appeal.discord_message_id).catch(() => null);
    if (!message) return;

    const decidedBy = appeal.decided_by ? await this.app.client.users.fetch(appeal.decided_by).catch(() => null) : null;
    const card = buildDecidedAppealCard({
      appealId: appeal.id,
      status: appeal.status,
      caseNumber: caseRow.case_number,
      caseCode: caseRow.case_code,
      caseType: caseRow.type,
      caseReason: caseRow.reason,
      caseModeratorId: caseRow.moderator_id,
      userId: appeal.user_id,
      userTag: null,
      answers: [],
      decisionReason: appeal.decision_reason,
      decidedById: appeal.decided_by,
      decidedByTag: decidedBy?.tag ?? null,
      decidedAt: appeal.decided_at,
    });
    await message.edit({ content: '', components: card.components, flags: card.flags, allowedMentions: { parse: [] } } as never).catch(() => undefined);
  }

  /** Relay a staff web message into the Discord thread (+ DM the appellant). */
  public async relayStaffMessage(appealId: number, messageId: number): Promise<boolean> {
    const appeal = await this.loadAppeal(appealId);
    if (!appeal) return false;
    const guild = this.app.client.guilds.cache.get(appeal.guild_id);
    if (!guild) return false;
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      'SELECT id, sender_id, content, sent_at FROM appeal_messages WHERE id = ? AND appeal_id = ?',
      [messageId, appealId],
    );
    const msg = rows[0] as { id: number; sender_id: string; content: string } | undefined;
    if (!msg) return false;

    const thread = await this.resolveThread(appeal, guild);
    if (thread) {
      const staffUser = await this.app.client.users.fetch(msg.sender_id).catch(() => null);
      const prefix = staffUser ? `${staffUser.tag}: ` : '';
      await thread.send({ content: `${prefix}${safeDiscordText(msg.content, 1800)}`, allowedMentions: { parse: [] } } as never).catch(() => undefined);
    }

    // Notify the appellant by DM while the appeal is still pending.
    if (appeal.status === 'pending') {
      const user = await this.app.client.users.fetch(appeal.user_id).catch(() => null);
      if (user) {
        await user
          .send({
            content: `A staff member replied to your appeal #${appeal.id}:\n\n${safeDiscordText(msg.content, 1500)}\n\nYou can reply to this DM and your message will be sent to the appeal team.`,
            allowedMentions: { parse: [] },
          } as never)
          .catch(() => undefined);
      }
    }
    return true;
  }

  /**
   * DM reply listener: if the author has an open (pending) appeal, their DM
   * text is inserted into that appeal's chat and relayed into the thread.
   */
  public async handleDmReply(message: Message): Promise<boolean> {
    if (message.author.bot || message.guild) return false;
    const [rows] = await this.app.db.query<AppealRow[]>(
      `SELECT * FROM appeals WHERE user_id = ? AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`,
      [message.author.id],
    );
    const appeal = rows[0];
    if (!appeal) return false;

    const content = sanitizeForDiscord(message.content, 2000);
    if (!content) return false;

    await this.app.db.execute(
      "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, 'user', ?, ?)",
      [appeal.id, message.author.id, content],
    );

    const guild = this.app.client.guilds.cache.get(appeal.guild_id);
    if (guild) {
      const thread = await this.resolveThread(appeal, guild);
      if (thread) {
        await thread
          .send({ content: `**${message.author.tag}:** ${safeDiscordText(content, 1800)}`, allowedMentions: { parse: [] } } as never)
          .catch(() => undefined);
      }
    }

    await message.reply({ content: 'Your message has been added to your appeal. Staff will reply here or in the portal.', allowedMentions: { parse: [] } } as never).catch(() => undefined);
    return true;
  }

  /**
   * Thread reply listener: messages posted by staff inside the appeal thread
   * are inserted into appeal_messages so the web chat stays in sync.
   */
  public async handleThreadMessage(message: Message): Promise<boolean> {
    if (message.author.bot || !message.guild) return false;
    if (!message.channel || !('isThread' in message.channel) || !message.channel.isThread()) return false;
    const [rows] = await this.app.db.query<AppealRow[]>(
      'SELECT * FROM appeals WHERE discord_thread_id = ? AND guild_id = ? LIMIT 1',
      [message.channel.id, message.guild.id],
    );
    const appeal = rows[0];
    if (!appeal) return false;

    const content = sanitizeForDiscord(message.content, 2000);
    if (!content) return false;

    const staff = isAppealsStaff(this.app, { guild: message.guild, member: message.member as GuildMember | null });
    await this.app.db.execute(
      "INSERT INTO appeal_messages (appeal_id, sender_type, sender_id, content) VALUES (?, ?, ?, ?)",
      [appeal.id, staff ? 'staff' : 'user', message.author.id, content],
    );
    return true;
  }
}

import type { AutoModerationActionExecution, GuildTextBasedChannel, Message } from 'discord.js';
import { AutoModerationActionType, ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../../core/context';
import type { ReplyPingProtectionConfig } from '../../../../shared/src/index';
import { ReplyPingEscalation } from './escalation';
import { extractMentionedUserIds, sanitizeContent } from './sanitizer';
import { buildNotice } from './noticeBuilder';

export class ReplyPingProtectionService {
  public readonly escalation: ReplyPingEscalation;
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
    this.escalation = new ReplyPingEscalation(app);
  }

  private get config(): ReplyPingProtectionConfig {
    return this.app.config.reply_ping_protection;
  }

  loadTrackedRules(): void {
    const cfg = this.config;
    if (!cfg.enabled || !cfg.native_rule_id) {
      this.app.logger.info('Reply Ping Protection: disabled or no rule ID configured');
      return;
    }
    this.app.logger.info(`Reply Ping Protection: tracking rule ${cfg.native_rule_id}`);
  }

  isTrackedRule(ruleId: string): boolean {
    const cfg = this.config;
    return cfg.enabled && cfg.native_rule_id === ruleId;
  }

  private async getViolationCount(guildId: string, userId: string): Promise<number> {
    const cfg = this.config;
    if (!cfg.escalation.enabled) return 0;
    const [rows] = await this.app.db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM reply_ping_incidents
       WHERE guild_id = ? AND user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? SECOND)`,
      [guildId, userId, cfg.escalation.window_seconds],
    );
    return (rows[0] as any).cnt as number;
  }

  async handleExecution(execution: AutoModerationActionExecution): Promise<void> {
    const logPrefix = `[ReplyPingProtection ruleId=${execution.ruleId} userId=${execution.userId}]`;

    if (execution.action.type !== AutoModerationActionType.BlockMessage) {
      this.app.logger.debug(`${logPrefix} skipped: action type ${execution.action.type} is not BlockMessage`);
      return;
    }

    const cfg = this.config;
    if (!cfg.enabled) {
      this.app.logger.debug(`${logPrefix} skipped: disabled in config`);
      return;
    }
    if (execution.ruleId !== cfg.native_rule_id) {
      this.app.logger.debug(`${logPrefix} skipped: ruleId mismatch (config=${cfg.native_rule_id})`);
      return;
    }
    if (!execution.guild) {
      this.app.logger.debug(`${logPrefix} skipped: no guild on execution`);
      return;
    }

    const member = execution.member
      ?? (await execution.guild.members.fetch(execution.userId).catch(() => null));

    const channelId = execution.channelId;
    if (!channelId) {
      this.app.logger.warn(`${logPrefix} skipped: channelId is null — Discord did not include channel in this BlockMessage event`);
      return;
    }

    if (this.isExempt(execution.userId, member, channelId)) {
      this.app.logger.debug(`${logPrefix} skipped: user/channel/role is exempt`);
      return;
    }

    this.app.logger.info(`${logPrefix} handling — channel=${channelId} content="${execution.content?.slice(0, 80) ?? ''}"`);

    const content = execution.content ?? '';
    const sanitized = sanitizeContent(content);

    // Count existing violations before recording this one
    const previousViolations = await this.getViolationCount(execution.guild.id, execution.userId);
    const inWarningPhase = previousViolations < cfg.warning_threshold;

    if (inWarningPhase) {
      // Warning phase: record incident but send a warning notice instead of enforcement
      await this.recordIncident(execution.guild.id, execution.userId, channelId, execution.messageId ?? null, content, sanitized);

      const noticeChannelId = cfg.notice_channel_id ?? channelId;
      const noticeChannel = execution.guild.channels.cache.get(noticeChannelId)
        ?? (await execution.guild.channels.fetch(noticeChannelId).catch(() => null));

      if (noticeChannel && 'send' in noticeChannel) {
        const violatorUser = execution.user;
        const violatorTag = violatorUser ? violatorUser.tag : execution.userId;
        await (noticeChannel as GuildTextBasedChannel).send({
          components: [
            new ContainerBuilder()
              .setAccentColor(0xfee75c as never)
              .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**Reply Mention Warning**\n<@${execution.userId}> (${violatorTag}): ${cfg.warning_message}`),
              ),
          ],
          flags: MessageFlags.IsComponentsV2,
          allowedMentions: { parse: [] },
        } as never).catch(() => undefined);
      }
      return;
    }

    // Enforcement phase: record, notice, log, escalate

    const incidentId = await this.recordIncident(
      execution.guild.id,
      execution.userId,
      channelId,
      execution.messageId ?? null,
      content,
      sanitized,
    );

    this.app.logger.info(`${logPrefix} incident recorded id=${incidentId}`);

    await this.sendNotice(cfg, execution, content, execution.userId, channelId);
    await this.logIncident(cfg, execution, sanitized, incidentId);

    if (cfg.escalation.enabled) {
      const mentionedIds = extractMentionedUserIds(content);
      const blockedUserId = mentionedIds.length > 0 ? mentionedIds[0] : '';

      await this.app.db.execute(
        `UPDATE reply_ping_incidents SET blocked_user_id = ? WHERE id = ?`,
        [blockedUserId, incidentId],
      );

      const result = await this.escalation.recordAndEvaluate(
        execution.guild.id,
        execution.userId,
        channelId,
        execution.messageId ?? '',
        content,
        sanitized,
        blockedUserId,
      );

      this.app.logger.info(`${logPrefix} escalation result: escalated=${result.escalated} level=${result.level ?? 'n/a'} action=${result.actionType ?? 'n/a'} error=${result.error ?? 'none'}`);

      if (result.escalated && result.actionType) {
        await this.app.db.execute(
          `UPDATE reply_ping_incidents SET action_taken = ? WHERE id = ?`,
          [result.actionType, incidentId],
        );
      }
    }
  }

  async handleMessage(message: Message): Promise<void> {
    if (!message.inGuild()) return;

    const cfg = this.config;
    if (!cfg.enabled) return;

    const content = message.content ?? '';
    if (!content) return;

    const mentionedUserIds = [
      ...extractMentionedUserIds(content),
      ...[...message.mentions.users.keys()],
    ];
    const uniqueMentionedUserIds = [...new Set(mentionedUserIds)];
    const blockedUserId = uniqueMentionedUserIds.find((id) => cfg.protected_users.includes(id));

    const mentionedRoleIds = [...message.mentions.roles.keys()];
    const blockedRoleId = mentionedRoleIds.find((id) => cfg.protected_roles.includes(id));

    if (!blockedUserId && !blockedRoleId) return;

    // Only trigger on reply pings — not direct mentions
    if (!message.reference?.messageId) return;

    const userId = message.author.id;
    const channelId = message.channelId;
    const member = message.member ?? await message.guild.members.fetch(userId).catch(() => null);

    if (this.isExempt(userId, member, channelId)) return;

    this.app.logger.info(
      `[ReplyPingProtection] messageCreate hit — user=${userId} channel=${channelId} blockedUser=${blockedUserId ?? 'none'} blockedRole=${blockedRoleId ?? 'none'} content="${content.slice(0, 80)}"`,
    );

    // Count existing violations before recording this one
    const previousViolations = await this.getViolationCount(message.guildId, userId);
    const inWarningPhase = previousViolations < cfg.warning_threshold;

    const sanitized = sanitizeContent(content);

    if (inWarningPhase) {
      // Warning phase: don't delete, don't escalate — just warn
      await message.reply({
        content: cfg.warning_message,
        allowedMentions: { parse: [], repliedUser: true },
      }).catch(() => undefined);

      // Still record the incident for counting
      await this.recordIncident(message.guildId, userId, channelId, message.id, content, sanitized);
      return;
    }

    // Enforcement phase: delete message, escalate
    await message.delete().catch((err) =>
      this.app.logger.warn(`[ReplyPingProtection] Failed to delete message ${message.id}:`, err),
    );

    const incidentId = await this.recordIncident(
      message.guildId,
      userId,
      channelId,
      message.id,
      content,
      sanitized,
    );

    // Send notice to configured channel or fallback to incident channel
    const noticeChannelId = cfg.notice_channel_id ?? channelId;
    const noticeChannel = message.guild.channels.cache.get(noticeChannelId) ??
      await message.guild.channels.fetch(noticeChannelId).catch(() => null);

    if (noticeChannel && 'send' in noticeChannel) {
      const { buildNotice } = await import('./noticeBuilder');
      const violatorTag = message.author.tag;
      const channelMention = `<#${channelId}>`;
      const notice = buildNotice(cfg, content, violatorTag, userId, channelMention);
      await (noticeChannel as GuildTextBasedChannel).send({
        ...notice,
        allowedMentions: { parse: [] },
      } as never).catch((err) =>
        this.app.logger.warn(`[ReplyPingProtection] Notice send failed:`, err),
      );
      if (cfg.notice_delete_after_seconds > 0) {
        // handled inside sendNotice for automod path; here we skip auto-delete on the notice channel
      }
    }

    await this.logIncidentRaw(cfg, message.guild, userId, channelId, message.id, sanitized, incidentId);

    if (cfg.escalation.enabled) {
      await this.app.db.execute(
        `UPDATE reply_ping_incidents SET blocked_user_id = ? WHERE id = ?`,
        [blockedUserId ?? blockedRoleId ?? '', incidentId],
      );

      const result = await this.escalation.recordAndEvaluate(
        message.guildId,
        userId,
        channelId,
        message.id,
        content,
        sanitized,
        blockedUserId ?? blockedRoleId ?? '',
      );

      this.app.logger.info(`[ReplyPingProtection] escalation: escalated=${result.escalated} level=${result.level ?? 'n/a'} action=${result.actionType ?? 'n/a'} error=${result.error ?? 'none'}`);

      if (result.escalated && result.actionType) {
        await this.app.db.execute(
          `UPDATE reply_ping_incidents SET action_taken = ? WHERE id = ?`,
          [result.actionType, incidentId],
        );
      }
    }
  }

  private async logIncidentRaw(
    cfg: ReplyPingProtectionConfig,
    guild: import('discord.js').Guild,
    userId: string,
    channelId: string,
    messageId: string,
    sanitized: string,
    incidentId: number,
  ): Promise<void> {
    const logChannelId = cfg.log_channel_id ?? channelId;
    const channel = guild.channels.cache.get(logChannelId) ??
      await guild.channels.fetch(logChannelId).catch(() => null);
    if (!channel || !('send' in channel)) return;

    const lines: string[] = [
      '**Reply Ping Blocked**',
      `**User:** <@${userId}>`,
      `**Channel:** <#${channelId}>`,
      `**Content:** ${sanitized}`,
      `**Incident ID:** #${incidentId}`,
      `**Message:** [↗](https://discord.com/channels/${guild.id}/${channelId}/${messageId})`,
    ];

    try {
      const { buildRichV2 } = await import('../../utils/v2');
      const rich = buildRichV2({
        accentColor: 0xfee75c,
        header: 'Reply Ping Incident',
        text: lines.join('\n'),
        footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
      });
      await (channel as GuildTextBasedChannel).send({ ...rich, allowedMentions: { parse: [] } } as never);
    } catch (err) {
      this.app.logger.warn(`[ReplyPingProtection] Log send failed:`, err);
    }
  }

  private isExempt(userId: string, member: any, channelId: string): boolean {

    const cfg = this.config;

    if (cfg.exempt_users.includes(userId)) return true;
    if (cfg.exempt_channels.includes(channelId)) return true;

    if (member) {
      if (cfg.exempt_roles.some((r) => member.roles?.cache?.has(r))) return true;
    }

    return false;
  }

  private async recordIncident(
    guildId: string,
    userId: string,
    channelId: string,
    messageId: string | null,
    originalContent: string,
    sanitizedContent: string,
  ): Promise<number> {
    const [result] = await this.app.db.execute(
      `INSERT INTO reply_ping_incidents
        (guild_id, user_id, channel_id, message_id, original_content, sanitized_content)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, channelId, messageId, originalContent, sanitizedContent],
    );
    return (result as { insertId: number }).insertId;
  }

  private async sendNotice(
    cfg: ReplyPingProtectionConfig,
    execution: AutoModerationActionExecution,
    originalContent: string,
    violatorId: string,
    channelId: string,
  ): Promise<void> {
    let channel: GuildTextBasedChannel | null = null;

    // Try configured notice channel first, then fall back to the channel where the ping happened
    const candidateIds = [...new Set([cfg.notice_channel_id, channelId].filter(Boolean))] as string[];
    for (const id of candidateIds) {
      const resolved = execution.guild.channels.cache.get(id)
        ?? (await execution.guild.channels.fetch(id).catch(() => null));
      if (resolved && 'send' in resolved) {
        channel = resolved as GuildTextBasedChannel;
        break;
      }
    }

    if (!channel) {
      this.app.logger.warn(`[ReplyPingProtection] Could not resolve any notice channel — tried: ${candidateIds.join(', ')}`);
      return;
    }

    const violatorUser = execution.user;
    const violatorTag = violatorUser ? violatorUser.tag : violatorId;
    const channelMention = `<#${channelId}>`;

    const notice = buildNotice(cfg, originalContent, violatorTag, violatorId, channelMention);

    try {
      const sent = await channel.send({
        ...notice,
        allowedMentions: { parse: [] },
      } as any);

      if (cfg.notice_delete_after_seconds > 0) {
        setTimeout(() => void sent.delete().catch(() => undefined), cfg.notice_delete_after_seconds * 1000);
      }
    } catch (err) {
      this.app.logger.warn(`Reply Ping notice send failed (guild ${execution.guild.id}):`, err);
    }
  }

  private async logIncident(
    cfg: ReplyPingProtectionConfig,
    execution: AutoModerationActionExecution,
    sanitized: string,
    incidentId: number,
  ): Promise<void> {
    const logChannelId = cfg.log_channel_id ?? execution.channelId ?? '';

    const guild = execution.guild;
    if (!logChannelId) return;
    const channel = guild.channels.cache.get(logChannelId)
      ?? (await guild.channels.fetch(logChannelId).catch(() => null));
    if (!channel || !('send' in channel)) return;

    const lines: string[] = [
      '**Reply Ping Blocked**',
      `**User:** <@${execution.userId}>`,
      `**Channel:** <#${execution.channelId}>`,
      `**Content:** ${sanitized}`,
      `**Incident ID:** #${incidentId}`,
    ];

    if (execution.messageId && execution.channelId) {
      const jumpUrl = `https://discord.com/channels/${guild.id}/${execution.channelId}/${execution.messageId}`;
      lines.push(`**Message:** [↗](${jumpUrl})`);
    }

    try {
      const { buildRichV2 } = await import('../../utils/v2');
      const rich = buildRichV2({
        accentColor: 0xfee75c,
        header: 'Reply Ping Incident',
        text: lines.join('\n'),
        footer: `${guild.name} • <t:${Math.floor(Date.now() / 1000)}:R>`,
      });
      await channel.send({ ...rich, allowedMentions: { parse: [] } } as any);
    } catch (err) {
      this.app.logger.warn(`Reply Ping log send failed (guild ${guild.id}):`, err);
    }
  }

  async getRecentIncidents(guildId: string, userId?: string, limit = 25): Promise<Array<Record<string, unknown>>> {
    const params: unknown[] = [guildId];
    let where = 'WHERE guild_id = ?';
    if (userId) {
      where += ' AND user_id = ?';
      params.push(userId);
    }
    params.push(limit);
    const [rows] = await this.app.db.query(
      `SELECT id, guild_id, user_id, channel_id, message_id, sanitized_content, blocked_user_id,
              escalation_level, action_taken, case_id, created_at
       FROM reply_ping_incidents ${where}
       ORDER BY created_at DESC LIMIT ?`,
      params,
    );
    return rows as Array<Record<string, unknown>>;
  }
}

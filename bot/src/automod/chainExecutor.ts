import type { Guild, GuildMember, Message, TextChannel, User } from 'discord.js';
import type { App } from '../core/context';
import type { ActionChain, ActionChainStep, MessageFormat } from '../../../shared/src/index';
import { parseDuration, renderPlaceholders } from '../../../shared/src/index';
import { buildMessagePayload, clientEmojiIds, renderMessageSpecPlaceholders } from '../utils/messageBuilder';
import { buildV2Content, buildRichV2, hexToInt } from '../utils/v2';
import type { ResponseThrottle, ThrottleDecision } from './responseThrottle';
import { notificationDmGuard } from '../moderation/notificationDmGuard';

export interface ChainTrigger {
  rule: string;
  module: string;
  guild: Guild;
  user: User;
  member?: GuildMember | null;
  message?: Message | null;
  channel?: TextChannel | null;
  reason?: string;
  content?: string;
}

export interface ChainResult {
  actionsTaken: string[];
  actionsFailed: Array<{ step: string; error: string }>;
  caseIds: string[];
  responseSuppressed: boolean;
  suppressDecision: ThrottleDecision | null;
  throttleMode: 'silent' | 'batched_summary';
}

export class ActionChainExecutor {
  private readonly app: App;
  private readonly throttle: ResponseThrottle;

  constructor(app: App, throttle: ResponseThrottle) {
    this.app = app;
    this.throttle = throttle;
  }

  public async execute(trigger: ChainTrigger, chain: ActionChain, suppressSeconds = 0, suppressMode: 'silent' | 'batched_summary' = 'silent'): Promise<ChainResult> {
    const result: ChainResult = {
      actionsTaken: [],
      actionsFailed: [],
      caseIds: [],
      responseSuppressed: false,
      suppressDecision: null,
      throttleMode: suppressMode,
    };

    const member = trigger.member ?? (trigger.user ? await trigger.guild.members.fetch(trigger.user.id).catch(() => null) : null);

    for (const step of chain) {
      try {
        await this.executeStep(step, chain, trigger, member, result, suppressSeconds, suppressMode);
      } catch (err) {
        result.actionsFailed.push({ step: step.type, error: (err as Error).message });
        if (['mute', 'timeout', 'kick', 'ban'].includes(step.type)) {
          await this.notifyOwnerOfFailedPunishment(trigger, member, step.type, err);
        }
      }
    }

    const dmHandled = result.actionsTaken.some((action) =>
      action === 'dm_user_message' || action === 'dm_user' || action === 'send_channel_message_dm_failed',
    );
    if (trigger.message && !dmHandled) {
      const dmSent = await this.tryDm(trigger.user, this.buildAutomodDm(trigger, chain));
      if (dmSent) result.actionsTaken.push('dm_user_message');
    }

    return result;
  }

  private async executeStep(
    step: ActionChainStep,
    chain: ActionChain,
    trigger: ChainTrigger,
    member: GuildMember | null | undefined,
    result: ChainResult,
    suppressSeconds: number,
    suppressMode: 'silent' | 'batched_summary',
  ): Promise<void> {
    const placeholders: Record<string, string> = {
      user: `<@${trigger.user.id}>`,
      'user.tag': trigger.user.tag,
      rule: trigger.rule,
      reason: trigger.reason ?? 'automated moderation',
      message_content: (trigger.content ?? '').slice(0, 1000),
      channel: trigger.channel ? `<#${trigger.channel.id}>` : 'unknown',
      punishment: step.type,
      duration: 'duration' in step && step.duration ? String(step.duration) : '',
      guild: trigger.guild.name,
    };

    switch (step.type) {
      case 'delete_message':
        if (trigger.message?.deletable) {
          await trigger.message.delete();
          result.actionsTaken.push('delete_message');
        } else {
          throw new Error('message not deletable');
        }
        break;

      case 'send_channel_message': {
        const channel = trigger.channel;
        if (!channel) throw new Error('no channel');
        const decision = this.throttle.shouldSuppress(trigger.rule, channel.id, trigger.user.id, suppressSeconds, suppressMode);
        if (decision.suppressSend) {
          result.responseSuppressed = true;
          result.suppressDecision = decision;
          break;
        }

        if (step.template_id !== undefined || step.template_name !== undefined) {
          const saved =
            step.template_id !== undefined
              ? await this.app.messages.get(step.template_id)
              : await this.app.messages.getByName(trigger.guild.id, step.template_name!);
          if (saved) {
            const spec = this.app.messages.parsePayload(saved);
            const rendered = renderMessageSpecPlaceholders(spec, placeholders);
            const payload = buildMessagePayload(rendered, String(saved.id), clientEmojiIds(this.app.client));
            if (step.dm_first) {
              const dmSent = await this.tryDm(trigger.user, this.buildAutomodDm(trigger, chain));
              if (dmSent) { result.actionsTaken.push('dm_user_message'); break; }
            }
            const sent = await channel.send({ ...payload, allowedMentions: { parse: [] } } as never);
            result.actionsTaken.push(step.dm_first ? 'send_channel_message_dm_failed' : 'send_channel_message');
            if (step.delete_after_seconds && step.delete_after_seconds > 0) {
              setTimeout(() => void sent.delete().catch(() => undefined), step.delete_after_seconds * 1000);
            }
            break;
          }
          if (step.content === undefined) {
            throw new Error(`saved message template not found (${step.template_id ?? step.template_name})`);
          }
        }

        const content = renderPlaceholders(step.content!, placeholders);
        const spec = {
          title: step.title ? renderPlaceholders(step.title, placeholders) : undefined,
          description: step.description ? renderPlaceholders(step.description, placeholders) : undefined,
          footer: step.footer ? renderPlaceholders(step.footer, placeholders) : undefined,
          accentColor: step.accent_color,
          imageUrl: step.image_url ? renderPlaceholders(step.image_url, placeholders) : undefined,
          thumbnailUrl: step.thumbnail_url ? renderPlaceholders(step.thumbnail_url, placeholders) : undefined,
        };
        if (step.dm_first) {
          const dmSent = await this.tryDm(trigger.user, this.buildAutomodDm(trigger, chain, spec));
          if (dmSent) { result.actionsTaken.push('dm_user_message'); break; }
          spec.footer = spec.footer ? `${spec.footer}\n\n⚠️ DMs closed — showing publicly.` : '⚠️ DMs closed — showing publicly.';
        }
        await this.sendFormatted(channel, content, step.format, step.delete_after_seconds || undefined, trigger.rule, spec);
        result.actionsTaken.push(step.dm_first ? 'send_channel_message_dm_failed' : 'send_channel_message');
        break;
      }

      case 'dm_user': {
        const content = renderPlaceholders(step.content, placeholders);
        const payload = this.buildFormatted(content, step.format);
        const dm = await trigger.user.createDM().catch(() => null);
        if (!dm) throw new Error('cannot DM user');
        await dm.send(payload as never);
        result.actionsTaken.push('dm_user');
        break;
      }

      case 'warn': {
        if (!member) throw new Error('no member');
        const warnResult = await this.app.punishmentManager.warn(member, {
          reason: renderPlaceholders(step.reason ?? 'Automod: {rule}', placeholders),
          moderatorId: this.app.client.user?.id ?? null,
          silent: true,
          archive: false,
        });
        if (warnResult.case) result.caseIds.push(warnResult.case.case_code);
        if (!warnResult.ok) throw new Error(warnResult.error ?? 'warn failed');
        result.actionsTaken.push('warn');
        break;
      }

      case 'mute':
      case 'timeout': {
        if (!member) throw new Error('no member');
        const durationMs = step.duration ? (parseDuration(step.duration)?.milliseconds ?? 0) : 3600000;
        const muteResult = await this.app.punishmentManager.timeout(member, durationMs, {
          reason: renderPlaceholders(step.reason ?? 'Automod: {rule}', placeholders),
          moderatorId: this.app.client.user?.id ?? null,
          silent: true,
          archive: false,
          logEvent: step.type === 'mute' ? 'member_mute' : 'member_timeout',
        });
        if (muteResult.case) result.caseIds.push(muteResult.case.case_code);
        if (!muteResult.ok) throw new Error(muteResult.error ?? 'timeout failed');
        result.actionsTaken.push('timeout');
        break;
      }

      case 'kick': {
        if (!member) throw new Error('no member');
        const kickResult = await this.app.punishmentManager.kick(member, {
          reason: renderPlaceholders(step.reason ?? 'Automod: {rule}', placeholders),
          moderatorId: this.app.client.user?.id ?? null,
          silent: true,
          archive: false,
        });
        if (kickResult.case) result.caseIds.push(kickResult.case.case_code);
        if (!kickResult.ok) throw new Error(kickResult.error ?? 'kick failed');
        result.actionsTaken.push('kick');
        break;
      }

      case 'ban': {
        const banResult = await this.app.punishmentManager.ban(trigger.user, {
          reason: renderPlaceholders(step.reason ?? 'Automod: {rule}', placeholders),
          moderatorId: this.app.client.user?.id ?? null,
          durationMs: step.duration ? (parseDuration(step.duration)?.milliseconds ?? 0) || undefined : undefined,
          silent: true,
          archive: false,
        });
        if (banResult.case) result.caseIds.push(banResult.case.case_code);
        if (!banResult.ok) throw new Error(banResult.error ?? 'ban failed');
        result.actionsTaken.push('ban');
        break;
      }

      case 'add_role': {
        if (!member) throw new Error('no member');
        await member.roles.add(step.role_id, `Automod: ${trigger.rule}`);
        result.actionsTaken.push('add_role');
        break;
      }

      case 'remove_role': {
        if (!member) throw new Error('no member');
        await member.roles.remove(step.role_id, `Automod: ${trigger.rule}`);
        result.actionsTaken.push('remove_role');
        break;
      }

      case 'run_escalation_check': {
        await this.app.punishmentEscalation.recordTrigger(trigger.guild.id, trigger.user.id, trigger.rule);
        result.actionsTaken.push('run_escalation_check');
        break;
      }

      case 'create_report': {
        await this.app.reporting.createReport({
          guildId: trigger.guild.id,
          reporterId: this.app.client.user?.id ?? '0',
          targetUserId: trigger.user.id,
          targetMessageId: trigger.message?.id ?? null,
          reason: renderPlaceholders(step.reason ?? 'Automod: {rule}', placeholders),
          targetContent: (trigger.content ?? '').slice(0, 1000),
          sourceChannelId: trigger.channel?.id ?? null,
          sourceModule: trigger.module,
          sourceRule: trigger.rule,
          attachmentUrls: trigger.message ? [...trigger.message.attachments.values()].map((a) => a.url) : undefined,
        });
        result.actionsTaken.push('create_report');
        break;
      }
    }
  }

  private buildFormatted(content: string, format: MessageFormat): { content?: string; components?: unknown[] } {
    if (format === 'plain') return { content };
    return buildV2Content(content);
  }

  private buildAutomodDm(
    trigger: ChainTrigger,
    chain: ActionChain,
    spec?: { title?: string; footer?: string; accentColor?: string },
  ): { components: unknown[] } {
    const removed = chain.some((step) => step.type === 'delete_message') ||
      ['spam', 'duplicate_spam', 'mass_ping'].includes(trigger.module);
    const content = (trigger.content ?? '').trim();
    const preview = content
      ? content.slice(0, 500).split('\n').map((line) => `> ${line || ' '}`).join('\n')
      : '> No text content was available (the message may have contained only attachments).';
    const text = [
      '**What happened**',
      removed
        ? `Your message in <#${trigger.channel?.id ?? '0'}> was removed by AutoMod.`
        : `Your message in <#${trigger.channel?.id ?? '0'}> was flagged by AutoMod.`,
      '',
      '**Why**',
      trigger.reason ?? `It matched the **${trigger.rule}** rule.`,
      '',
      '**Detected content**',
      preview,
      '',
      `**Rule:** ${trigger.rule}`,
      `**Module:** ${trigger.module}`,
      '',
      'If you believe this was a mistake, contact the server staff team and include the rule shown above.',
    ].join('\n');

    return buildRichV2({
      accentColor: hexToInt(spec?.accentColor) ?? 0xed4245,
      header: spec?.title ?? 'AutoMod Message Removed',
      text,
      footer: spec?.footer ?? `${trigger.guild.name} • Automated moderation`,
    });
  }

  private async notifyOwnerOfFailedPunishment(
    trigger: ChainTrigger,
    member: GuildMember | null | undefined,
    action: string,
    error: unknown,
  ): Promise<void> {
    const cfg = this.app.config.automod.owner_alerts;
    if (!cfg.enabled) return;

    const owner = await trigger.guild.fetchOwner().catch(() => null);
    if (!owner || owner.id === trigger.user.id) return;

    const matchedRoles = member
      ? cfg.role_ids.filter((roleId) => member.roles.cache.has(roleId))
      : [];
    const guardKey = `owner-alert:${trigger.guild.id}:${trigger.user.id}:${action}`;
    if (!notificationDmGuard.allow(owner.id, guardKey, 5, cfg.cooldown_seconds)) return;

    const channelText = trigger.channel ? `<#${trigger.channel.id}>` : 'Unknown channel';
    const messageLink = trigger.channel && trigger.message
      ? `https://discord.com/channels/${trigger.guild.id}/${trigger.channel.id}/${trigger.message.id}`
      : null;
    const text = [
      '**Security warning**',
      `AutoMod triggered for <@${trigger.user.id}>, but the bot could not apply **${action}**.`,
      '',
      `**Rule:** ${trigger.rule}`,
      `**Module:** ${trigger.module}`,
      `**Trigger reason:** ${trigger.reason ?? 'No reason supplied'}`,
      `**Discord error:** ${(error as Error).message || String(error)}`,
      `**Channel:** ${channelText}`,
      matchedRoles.length > 0
        ? `**Privileged role detected:** ${matchedRoles.map((roleId) => `<@&${roleId}>`).join(', ')}`
        : '**Privileged role detected:** No configured alert role matched',
      messageLink ? `**Message:** ${messageLink}` : null,
      '',
      'This can indicate an incorrect role hierarchy, missing moderation permissions, or privileged-user abuse. Review the member, role hierarchy, and audit log immediately.',
    ].filter((line): line is string => line !== null).join('\n');

    try {
      const dm = await owner.user.createDM();
      const payload = buildRichV2({
        accentColor: 0xed4245,
        header: 'AutoMod Punishment Failed',
        text,
        footer: `${trigger.guild.name} • Owner security alert`,
      });
      await dm.send(payload as never);
    } catch {
      notificationDmGuard.release(owner.id, guardKey);
    }
  }

  private async sendFormatted(
    channel: TextChannel,
    content: string,
    format: MessageFormat,
    deleteAfterSeconds?: number,
    rule?: string,
    spec?: {
      title?: string;
      description?: string;
      footer?: string;
      accentColor?: string;
      imageUrl?: string;
      thumbnailUrl?: string;
    },
  ): Promise<void> {
    if (format === 'components_v2') {
      const rich = buildRichV2({
        accentColor: hexToInt(spec?.accentColor) ?? 0xed4245,
        header: spec?.title ?? 'Message Removed',
        text: spec?.description ?? content,
        footer: spec?.footer ?? (rule ? `Rule: ${rule}` : undefined),
        mediaUrls: [spec?.thumbnailUrl, spec?.imageUrl].filter((u): u is string => Boolean(u)),
      });
      const sent = await channel.send({ ...rich } as never);
      if (deleteAfterSeconds && deleteAfterSeconds > 0) {
        setTimeout(() => void sent.delete().catch(() => undefined), deleteAfterSeconds * 1000);
      }
      return;
    }
    const payload = this.buildFormatted(content, format);
    if (format === 'plain') {
      await channel.send({ content, deleteAfter: deleteAfterSeconds ?? 0 } as never);
    } else {
      const sent = await channel.send({ ...payload } as never);
      if (deleteAfterSeconds && deleteAfterSeconds > 0) {
        setTimeout(() => void sent.delete().catch(() => undefined), deleteAfterSeconds * 1000);
      }
    }
  }

  /** Attempt to DM the triggered user. Returns true if the DM was sent. */
  private async tryDm(user: User, payload: unknown): Promise<boolean> {
    const guardKey = `automod:${Date.now()}`;
    if (!notificationDmGuard.allow(user.id, guardKey, 0, this.app.config.punishment_dms.cooldown_seconds)) {
      return true;
    }
    try {
      const dm = await user.createDM();
      await dm.send(payload as never);
      return true;
    } catch {
      notificationDmGuard.release(user.id, guardKey);
      return false;
    }
  }
}

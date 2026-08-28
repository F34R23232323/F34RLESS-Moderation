import { AutoModerationActionType, AutoModerationRuleTriggerType, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { AutoModerationActionExecution, GuildTextBasedChannel, MessageCreateOptions } from 'discord.js';
import type { App } from '../core/context';
import { renderPlaceholders, type NativeAutomodAction, type NativeAutomodResponseConfig } from '../../../shared/src/index';
import { buildRichV2, hexToInt } from '../utils/v2';

const ACTION_MATCH: Record<number, string> = {
  [AutoModerationActionType.BlockMessage]: 'block_message',
  [AutoModerationActionType.SendAlertMessage]: 'send_alert_message',
  [AutoModerationActionType.Timeout]: 'timeout',
  [AutoModerationActionType.BlockMemberInteraction]: 'block_member_interaction',
};

const BUTTON_STYLE: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

export async function handleNativeAutomod(app: App, execution: AutoModerationActionExecution): Promise<void> {
  const cfg = app.config.native_automod;
  if (!cfg.enabled || cfg.responses.length === 0) return;

  const actionName = ACTION_MATCH[execution.action.type] as NativeAutomodAction | undefined;
  if (!actionName) return;

  const response = matchResponse(cfg.responses, execution.ruleId, actionName);
  if (!response) return;

  const placeholders = await buildPlaceholders(app, execution, actionName);
  await sendResponse(app, execution, response, placeholders);
}

function matchResponse(
  responses: NativeAutomodResponseConfig[],
  ruleId: string,
  actionName: NativeAutomodAction,
): NativeAutomodResponseConfig | null {
  for (const r of responses) {
    if (!r.enabled || r.rule_id !== ruleId) continue;
    const on = Array.isArray(r.on) ? r.on : [r.on];
    if (on.includes('any') || on.includes(actionName)) return r;
  }
  return null;
}

async function buildPlaceholders(
  app: App,
  execution: AutoModerationActionExecution,
  actionName: string,
): Promise<Record<string, string>> {
  const user = execution.user;
  const userTag = user ? user.tag : execution.userId;
  let ruleName: string | null = execution.autoModerationRule?.name ?? null;
  if (!ruleName) {
    try {
      ruleName =
        (await execution.guild.autoModerationRules.fetch(execution.ruleId).catch(() => null))?.name ?? null;
    } catch {
      ruleName = null;
    }
  }

  return {
    originmessagecontent: execution.content ?? '',
    matchedcontent: execution.matchedContent ?? execution.matchedKeyword ?? '',
    matchedkeyword: execution.matchedKeyword ?? '',
    user: userTag,
    user_tag: userTag,
    username: user?.username ?? execution.userId,
    useravatarurl: user ? user.displayAvatarURL({ size: 256, extension: 'png' }) : '',
    user_id: execution.userId,
    user_mention: `<@${execution.userId}>`,
    userping: `<@${execution.userId}>`,
    channel: execution.channelId ? `<#${execution.channelId}>` : 'unknown',
    channel_id: execution.channelId ?? 'unknown',
    channel_name: execution.channel?.name ?? 'unknown',
    guild: execution.guild.name,
    rule_name: ruleName ?? execution.ruleId,
    rule_id: execution.ruleId,
    rule_trigger: AutoModerationRuleTriggerType[execution.ruleTriggerType] ?? String(execution.ruleTriggerType),
    action: actionName,
  };
}

async function sendResponse(
  app: App,
  execution: AutoModerationActionExecution,
  response: NativeAutomodResponseConfig,
  placeholders: Record<string, string>,
): Promise<void> {
  const guild = execution.guild;
  let channel: GuildTextBasedChannel | null = null;

  if (response.channel_id) {
    const resolved =
      guild.channels.cache.get(response.channel_id) ??
      (await guild.channels.fetch(response.channel_id).catch(() => null));
    if (resolved && 'send' in resolved) channel = resolved as GuildTextBasedChannel;
  } else if (execution.channel && 'send' in execution.channel) {
    channel = execution.channel as GuildTextBasedChannel;
  }
  if (!channel) return;

  const render = (s?: string): string | undefined =>
    s !== undefined ? renderPlaceholders(s, placeholders) : undefined;
  const content = render(response.content);

  // Mentions are disabled on all native AutoMod responses (hardcoded).
  const allowedMentions = { parse: [] };

  let payload: MessageCreateOptions;
  if (response.format === 'plain') {
    if (!content) return;
    payload = { content, allowedMentions } as MessageCreateOptions;
  } else if (response.format === 'embed') {
    payload = {
      ...(content ? { content } : {}),
      embeds: [buildEmbed(response, render)],
      allowedMentions,
    } as MessageCreateOptions;
  } else {
    const buttons = (response.buttons ?? []).map((b) => ({
      customId: b.custom_id,
      label: render(b.label) ?? '',
      style: b.style ? BUTTON_STYLE[b.style] : undefined,
      url: b.url ? render(b.url) : undefined,
      disabled: b.disabled,
    }));
    const rich = buildRichV2({
      accentColor: hexToInt(response.accent_color) ?? 0xed4245,
      header: render(response.title) ?? 'Message Blocked',
      text: buildCv2Text(response, render, content),
      footer: render(response.footer),
      mediaUrls: [render(response.thumbnail_url), render(response.image_url)].filter(
        (u): u is string => Boolean(u),
      ),
      buttons,
    });
    payload = { ...rich, allowedMentions } as unknown as MessageCreateOptions;
  }

  try {
    const sent = await channel.send(payload);
    if (response.delete_after_seconds > 0) {
      setTimeout(() => void sent.delete().catch(() => undefined), response.delete_after_seconds * 1000);
    }
    void app.logManager.log({
      event: 'automod_trigger',
      guildId: execution.guild.id,
      channelId: channel.id,
      actorId: execution.userId,
      message: `Native AutoMod response sent (${response.rule_id})`,
      details: {
        source: 'native_automod',
        ruleId: execution.ruleId,
        ruleName: placeholders.rule_name,
        trigger: placeholders.rule_trigger,
        action: placeholders.action,
        contentSnippet: (execution.content ?? '').slice(0, 500),
        messageId: execution.messageId,
      },
    });
  } catch (err) {
    app.logger.warn(`Native AutoMod response failed (rule ${response.rule_id}):`, err);
  }
}

function buildCv2Text(
  response: NativeAutomodResponseConfig,
  render: (s?: string) => string | undefined,
  content?: string,
): string {
  const parts: string[] = [];
  const description = render(response.description);
  if (description) parts.push(description);
  else if (content) parts.push(content);
  for (const f of response.fields ?? []) {
    parts.push(`**${render(f.name) ?? ''}**\n${render(f.value) ?? ''}`);
  }
  return parts.join('\n\n');
}

function buildEmbed(
  response: NativeAutomodResponseConfig,
  render: (s?: string) => string | undefined,
): EmbedBuilder {
  const b = new EmbedBuilder();
  const title = render(response.title);
  if (title) b.setTitle(title);
  const description = render(response.description);
  if (description) b.setDescription(description);
  const color = hexToInt(response.accent_color);
  if (color !== undefined) b.setColor(color);
  const image = render(response.image_url);
  if (image) b.setImage(image);
  const thumbnail = render(response.thumbnail_url);
  if (thumbnail) b.setThumbnail(thumbnail);
  if (response.author) {
    b.setAuthor({
      name: render(response.author.name) ?? response.author.name,
      url: response.author.url ? render(response.author.url) : undefined,
      iconURL: response.author.icon_url ? render(response.author.icon_url) : undefined,
    });
  }
  for (const f of response.fields ?? []) {
    b.addFields({ name: render(f.name) ?? '', value: render(f.value) ?? '', inline: f.inline ?? false });
  }
  const footer = render(response.footer);
  if (footer) b.setFooter({ text: footer });
  return b;
}

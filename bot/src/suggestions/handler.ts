import type { Message, TextChannel } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { App } from '../core/context';
import { hexToInt } from '../utils/v2';

const STATUS_COLORS: Record<string, number> = {
  Open: 0x5865f2,
  Accepted: 0x57f287,
  Denied: 0xed4245,
  'In Development': 0x5865f2,
  Implemented: 0xfee75c,
};

export async function handleSuggestionMessage(app: App, message: Message): Promise<boolean> {
  const cfg = app.config.community.suggestions;
  if (!cfg.enabled || !cfg.channel_id) return false;
  if (message.channelId !== cfg.channel_id) return false;
  if (message.author.bot) return false;

  const member = message.member ?? await message.guild?.members.fetch(message.author.id).catch(() => null);
  if (!member) return false;

  // Bypass roles — leave message alone entirely
  if (app.suggestions.hasBypassRole(member)) return false;

  // Blacklisted roles — silently delete
  if (app.suggestions.isBlacklisted(member)) {
    await message.delete().catch(() => undefined);
    return true;
  }

  // Blacklisted channels — silently delete
  if (app.suggestions.isBlacklistedChannel(message.channelId)) {
    await message.delete().catch(() => undefined);
    return true;
  }

  // Length checks
  const content = message.content.trim();
  if (content.length < cfg.min_length) {
    await message.delete().catch(() => undefined);
    await app.suggestions.sendValidationDm(
      message.author.id,
      `Your suggestion must be at least **${cfg.min_length}** characters long.`,
    );
    return true;
  }
  if (content.length > cfg.max_length) {
    await message.delete().catch(() => undefined);
    await app.suggestions.sendValidationDm(
      message.author.id,
      `Your suggestion must be **${cfg.max_length}** characters or fewer.`,
    );
    return true;
  }

  // Anti-spam cooldown
  if (!app.cooldowns.tryConsume('suggestion', message.author.id, message.guildId ?? '', cfg.cooldown_seconds)) {
    const remaining = app.cooldowns.remainingSeconds('suggestion', message.author.id, message.guildId ?? '');
    await message.delete().catch(() => undefined);
    await app.suggestions.sendValidationDm(
      message.author.id,
      `Please wait **${remaining}s** before submitting another suggestion.`,
      0xfee75c,
    );
    return true;
  }

  // Delete the user's original message
  await message.delete().catch(() => undefined);

  // Save to DB
  const suggestionId = await app.suggestions.create(
    message.guildId!,
    message.author.id,
    content,
    message.id,
  );

  // Send confirmation DM
  await app.suggestions.sendConfirmationDm(
    message.author.id,
    suggestionId,
    content,
    cfg.default_status,
    message.guild?.name,
  );

  // Find status color
  const statusDef = cfg.statuses.find((s) => s.name === cfg.default_status);
  const statusColor = statusDef?.color ? hexToInt(statusDef.color) : STATUS_COLORS[cfg.default_status] ?? 0x5865f2;

  // Build the suggestion embed using CV2
  const container = new ContainerBuilder()
    .setAccentColor((statusColor ?? 0x5865f2) as never)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`# ${cfg.thread_name_prefix} #${suggestionId}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Suggestion**\n> ${content.replace(/\n/g, '\n> ')}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Status:** ${cfg.default_status}\n**By:** <@${message.author.id}>`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`suggest:status:${suggestionId}`)
          .setLabel('Change Status')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`suggest:deny:${suggestionId}`)
          .setLabel('Deny')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`suggest:accept:${suggestionId}`)
          .setLabel('Accept')
          .setStyle(ButtonStyle.Success),
      ) as never,
    );

  const sent = await (message.channel as TextChannel).send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  } as never);

  // Update DB with sent message ID
  await app.suggestions.setMessage(suggestionId, sent.id);

  // Create a thread for discussion
  const thread = await sent.startThread({
    name: `${cfg.thread_name_prefix} #${suggestionId}`,
    autoArchiveDuration: 10080,
  }).catch(() => null);

  if (thread) {
    await app.suggestions.setThread(suggestionId, thread.id);
  }

  return true;
}

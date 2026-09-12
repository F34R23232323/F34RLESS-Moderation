import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, TextChannel } from 'discord.js';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
} from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, hexToInt } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

function buildSuggestionEmbed(
  suggestionId: number,
  content: string,
  userId: string,
  status: string,
  cfg: { thread_name_prefix: string; statuses: Array<{ name: string; color?: string }> },
) {
  const statusDef = cfg.statuses.find((s) => s.name === status);
  const color = statusDef?.color ? hexToInt(statusDef.color) : 0x5865f2;

  return {
    components: [
      new ContainerBuilder()
        .setAccentColor((color ?? 0x5865f2) as never)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`# ${cfg.thread_name_prefix} #${suggestionId}`),
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Suggestion**\n> ${content.replace(/\n/g, '\n> ')}`),
        )
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**Status:** ${status}\n**By:** <@${userId}>`),
        )
        .addActionRowComponents(
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`suggest:status:${suggestionId}`).setLabel('Change Status').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`suggest:deny:${suggestionId}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`suggest:accept:${suggestionId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
          ) as never,
        ),
    ],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] as [] },
  };
}

function buildStaffStatus(statuses: Array<{ name: string }>) {
  return statuses.map((s) => ({ name: s.name, value: s.name }));
}

async function execute(interaction: ChatInputCommandInteraction, app: App) {
  if (!interaction.inGuild()) {
    await v2Reply(interaction, 'This command can only be used in a server.', { ephemeral: true });
    return;
  }

  const cfg = app.config.community.suggestions;
  if (!cfg.enabled) {
    await v2Reply(interaction, 'The suggestion system is not enabled.', { ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'submit') {
    const suggestionText = interaction.options.getString('suggestion', true);
    if (suggestionText.length < cfg.min_length) {
      await v2Reply(interaction, `Your suggestion must be at least **${cfg.min_length}** characters.`, { ephemeral: true });
      return;
    }
    if (suggestionText.length > cfg.max_length) {
      await v2Reply(interaction, `Your suggestion must be **${cfg.max_length}** characters or fewer.`, { ephemeral: true });
      return;
    }

    if (!cfg.channel_id) {
      await v2Reply(interaction, 'Suggestion channel is not configured.', { ephemeral: true });
      return;
    }

    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(cfg.channel_id) as TextChannel | undefined;
    if (!channel) {
      await v2Reply(interaction, 'Suggestion channel not found.', { ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const status = cfg.default_status;
    const suggestionId = await app.suggestions.create(interaction.guildId!, interaction.user.id, suggestionText, '');

    const payload = buildSuggestionEmbed(suggestionId, suggestionText, interaction.user.id, status, cfg);
    const sent = await channel.send(payload as any);

    await app.suggestions.setMessage(suggestionId, sent.id);

    const thread = await sent.startThread({
      name: `${cfg.thread_name_prefix} #${suggestionId}`,
      autoArchiveDuration: 10080,
    }).catch(() => null);

    if (thread) {
      await app.suggestions.setThread(suggestionId, thread.id);
    }

    await v2Reply(interaction, `Your suggestion **#${suggestionId}** has been posted.`, { ephemeral: true });
    return;
  }

  // Staff subcommands
  const member = interaction.member as any;
  if (!member?.roles?.cache || !app.suggestions.isStaff(member)) {
    await v2Reply(interaction, 'You do not have permission to manage suggestions.', { ephemeral: true });
    return;
  }

  if (sub === 'accept') {
    const id = interaction.options.getInteger('id', true);
    const note = interaction.options.getString('note') ?? undefined;
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await v2Reply(interaction, `Suggestion #${id} not found.`, { ephemeral: true });
      return;
    }
    await app.suggestions.setStatus(id, 'Accepted', interaction.user.id, note);
    await v2Reply(interaction, `Suggestion #${id} accepted.${note ? ` Note: ${note}` : ''}`, { ephemeral: true });

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, 'Accepted', interaction.user.tag, note, interaction.guild?.name,
    );

    if (suggestion.message_id && interaction.channel && 'messages' in interaction.channel) {
      const msg = await (interaction.channel as any).messages.fetch(suggestion.message_id).catch(() => null);
      if (msg) await msg.edit(buildSuggestionEmbed(id, suggestion.content, suggestion.user_id, 'Accepted', cfg) as never).catch(() => undefined);
    }
  } else if (sub === 'deny') {
    const id = interaction.options.getInteger('id', true);
    const note = interaction.options.getString('note') ?? undefined;
    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await v2Reply(interaction, `Suggestion #${id} not found.`, { ephemeral: true });
      return;
    }
    await app.suggestions.setStatus(id, 'Denied', interaction.user.id, note);
    await v2Reply(interaction, `Suggestion #${id} denied.${note ? ` Note: ${note}` : ''}`, { ephemeral: true });

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, 'Denied', interaction.user.tag, note, interaction.guild?.name,
    );

    if (suggestion.message_id && interaction.channel && 'messages' in interaction.channel) {
      const msg = await (interaction.channel as any).messages.fetch(suggestion.message_id).catch(() => null);
      if (msg) await msg.edit(buildSuggestionEmbed(id, suggestion.content, suggestion.user_id, 'Denied', cfg) as never).catch(() => undefined);
    }
  } else if (sub === 'status') {
    const id = interaction.options.getInteger('id', true);
    const newStatus = interaction.options.getString('status', true);
    const note = interaction.options.getString('note') ?? undefined;

    const validStatus = cfg.statuses.find((s) => s.name === newStatus);
    if (!validStatus) {
      const list = cfg.statuses.map((s) => s.name).join(', ');
      await v2Reply(interaction, `Invalid status. Available: ${list}`, { ephemeral: true });
      return;
    }

    const suggestion = await app.suggestions.getById(id);
    if (!suggestion) {
      await v2Reply(interaction, `Suggestion #${id} not found.`, { ephemeral: true });
      return;
    }

    await app.suggestions.setStatus(id, newStatus, interaction.user.id, note);
    await v2Reply(interaction, `Suggestion #${id} status updated to **${newStatus}**.`, { ephemeral: true });

    // DM the suggestion author
    await app.suggestions.sendStatusDm(
      suggestion.user_id, id, newStatus, interaction.user.tag, note, interaction.guild?.name,
    );

    if (suggestion.message_id && interaction.channel && 'messages' in interaction.channel) {
      const msg = await (interaction.channel as any).messages.fetch(suggestion.message_id).catch(() => null);
      if (msg) await msg.edit(buildSuggestionEmbed(id, suggestion.content, suggestion.user_id, newStatus, cfg) as never).catch(() => undefined);
    }
  } else if (sub === 'list') {
    const statusFilter = interaction.options.getString('status') ?? undefined;
    const suggestions = await app.suggestions.getByGuild(interaction.guildId!, statusFilter);
    if (suggestions.length === 0) {
      await v2Reply(interaction, 'No suggestions found.', { ephemeral: true });
      return;
    }

    const lines = suggestions.map((s) => {
      const snippet = s.content.length > 80 ? s.content.slice(0, 80) + '...' : s.content;
      return `**#${s.id}** — ${s.status} — ${snippet.replace(/\n/g, ' ')} — <@${s.user_id}>`;
    });

    const container = new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`# Suggestions${statusFilter ? ` (${statusFilter})` : ''}`),
      )
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as never);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const cfg = app.config.community.suggestions;
  if (!cfg.enabled || !cfg.channel_id || !message.guild) {
    await v2MessageReply(message, { content: 'Suggestions are not enabled.' });
    return;
  }

  const text = args.join(' ');
  if (!text) {
    await v2MessageReply(message, { content: 'Usage: `suggest <your suggestion>`' });
    return;
  }

  const suggestionId = await app.suggestions.create(message.guild.id, message.author.id, text, message.id);

  const channel = message.guild.channels.cache.get(cfg.channel_id) as TextChannel | undefined;
  if (!channel) {
    await v2MessageReply(message, { content: 'Suggestion channel not found.' });
    return;
  }

  const payload = buildSuggestionEmbed(suggestionId, text, message.author.id, cfg.default_status, cfg);
  const sent = await channel.send(payload as any);
  await app.suggestions.setMessage(suggestionId, sent.id);

  const thread = await sent.startThread({
    name: `${cfg.thread_name_prefix} #${suggestionId}`,
    autoArchiveDuration: 10080,
  }).catch(() => null);

  if (thread) {
    await app.suggestions.setThread(suggestionId, thread.id);
  }

  await v2MessageReply(message, { content: `Your suggestion **#${suggestionId}** has been posted.` });
}

const data = new SlashCommandBuilder()
  .setName('suggest')
  .setDescription('Manage suggestions')
  .addSubcommand((sub) =>
    sub
      .setName('submit')
      .setDescription('Submit a suggestion')
      .addStringOption((o) => o.setName('suggestion').setDescription('Your suggestion').setRequired(true)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('accept')
      .setDescription('Accept a suggestion')
      .addIntegerOption((o) => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Optional note').setMaxLength(500)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('deny')
      .setDescription('Deny a suggestion')
      .addIntegerOption((o) => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Optional note').setMaxLength(500)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Change suggestion status')
      .addIntegerOption((o) => o.setName('id').setDescription('Suggestion ID').setRequired(true))
      .addStringOption((o) => o.setName('status').setDescription('New status').setRequired(true))
      .addStringOption((o) => o.setName('note').setDescription('Optional note').setMaxLength(500)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List suggestions')
      .addStringOption((o) => o.setName('status').setDescription('Filter by status')),
  );

const command: BotCommand = {
  name: 'suggest',
  category: 'community',
  description: 'Manage suggestions',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;

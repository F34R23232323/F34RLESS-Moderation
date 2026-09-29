import { ApplicationCommandType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { sendConfirmation } from '../../components/moderation';
import { buildRichV2 } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('purge-until')
  .setDescription('Purge all messages after a target message')
  .addStringOption((o) => o.setName('target').setDescription('Message ID to purge up to').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const channel = interaction.channel;
  if (!channel || !('bulkDelete' in channel)) {
    await v2Reply(interaction, 'This channel does not support bulk-delete.', { ephemeral: true });
    return;
  }
  const targetId = interaction.options.getString('target', true).replace(/\D/g, '');
  await runPurgeUntil(app, interaction, channel, targetId);
}

async function purgeContext(app: App, interaction: MessageContextMenuCommandInteraction): Promise<void> {
  const channel = interaction.channel;
  if (!channel || !('bulkDelete' in channel)) {
    await interaction.reply({ content: 'This channel does not support bulk-delete.', ephemeral: true });
    return;
  }
  await runPurgeUntil(app, interaction, channel, interaction.targetMessage.id);
}

async function runPurgeUntil(app: App, interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction, channel: any, targetId: string): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  await interaction.deferReply({ ephemeral: true });

  let target;
  try {
    target = await channel.messages.fetch(targetId);
  } catch {
    await v2Reply(interaction, 'Target message not found in this channel.', { ephemeral: true });
    return;
  }

  let toDelete;
  try {
    const after = await channel.messages.fetch({ after: targetId, limit: 100 });
    toDelete = [...after.values()];
  } catch {
    await v2Reply(interaction, 'Could not fetch messages after the target.', { ephemeral: true });
    return;
  }

  const count = toDelete.length + 1;
  if (count === 0) {
    await v2Reply(interaction, 'No messages to purge.', { ephemeral: true });
    return;
  }

  const reason = [
    `This will delete **${count} message(s)** in <#${channel.id}>, including the target message.`,
    `Target: [Message](${target.url})`,
    `Author: ${target.author ? `<@${target.author.id}>` : 'unknown'}`,
    `Content: ${(target.content || '').slice(0, 200) || '(no text)'}`,
  ].join('\n');

  await sendConfirmation(interaction, {
    action: 'purge',
    display: 'Confirm Purge',
    targetUserId: target.author?.id ?? interaction.user.id,
    reason,
    guildId: guild.id,
    channelId: channel.id,
    actorId: interaction.user.id,
    purgeAfterId: targetId,
    purgeAmount: 100,
    card: (actionId) => {
      const embed = buildRichV2({
        accentColor: 0xfee75c,
        header: '⚠️ Confirm Purge',
        text: `${reason}\n\n⏱ Expires <t:${Math.floor((Date.now() + 5 * 60_000) / 1000)}:R>\n\n**Press Confirm to proceed, or Cancel to abort.**`,
      });
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`confirm:${actionId}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel:${actionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );
      return {
        ...embed,
        components: [...(embed.components as unknown[]), row],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      } as { components: unknown[]; flags: number };
    },
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const targetId = args[0]?.replace(/\D/g, '');
  if (!targetId) {
    await v2MessageReply(message, { content: 'Usage: `!purgeuntil <message_id>`' });
    return;
  }
  const channel = message.channel;
  if (!('bulkDelete' in channel)) {
    await v2MessageReply(message, { content: 'This channel does not support bulk-delete.' });
    return;
  }

  let target;
  try {
    target = await (channel as any).messages.fetch(targetId);
  } catch {
    await v2MessageReply(message, { content: 'Target message not found in this channel.' });
    return;
  }

  let toDelete;
  try {
    const after = await (channel as any).messages.fetch({ after: targetId, limit: 100 });
    toDelete = [...after.values()];
  } catch {
    await v2MessageReply(message, { content: 'Could not fetch messages after the target.' });
    return;
  }

  const count = toDelete.length + 1;
  if (count === 0) {
    await v2MessageReply(message, { content: 'No messages to purge.' });
    return;
  }

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'purge', targetId, `Purge ${count} messages until target`);
  if (!confirmed) return;

  try {
    const after = await (channel as any).messages.fetch({ after: targetId, limit: 100 });
    const ids = [...after.keys()];
    if (ids.length > 0) {
      try { await (channel as any).bulkDelete(ids, true); }
      catch { for (const m of after.values()) await m.delete().catch(() => undefined); }
    }
    await app.logManager.log({
      event: 'moderation_action',
      guildId: message.guildId!,
      channelId: channel.id,
      actorId: message.author.id,
      message: `Purged ${ids.length} messages in <#${channel.id}>`,
      details: { amount: ids.length },
    });
    const replyContent = `✅ Purged ${ids.length} message(s).`;
    await (message.channel as any).send({ content: replyContent, allowedMentions: { parse: [] } }).catch(() => undefined);
  } catch (err) {
    const errContent = `❌ Purge failed: ${(err as Error).message}`;
    await (message.channel as any).send({ content: errContent, allowedMentions: { parse: [] } }).catch(() => undefined);
  }
}

const command: BotCommand = {
  name: 'purge-until',
  category: 'moderation',
  description: 'Purge all messages after a target message',
  usage: '!purge-until <message_id>',
  details: 'Purges messages after a target message ID in the current channel; also available as a message context-menu action. Requires confirmation.',
  data,
  permissions: ['ManageMessages'],
  aliases: [],
  execute,
  prefixExecute,
  asMessageContext: true,
  async contextExecute(interaction, app) {
    if (interaction.isMessageContextMenuCommand()) {
      await purgeContext(app, interaction);
    }
  },
};

export default command;

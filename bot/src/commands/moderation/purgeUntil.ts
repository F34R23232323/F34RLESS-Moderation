import { ApplicationCommandType, SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message, MessageContextMenuCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { buildConfirmEmbed, storePendingAction } from '../../components/moderation';

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

  let fetched;
  try {
    fetched = await channel.messages.fetch({ around: targetId, limit: 100 });
  } catch {
    await (interaction as any).reply({ content: 'Could not fetch messages around the target.', ephemeral: true });
    return;
  }
  const target = fetched.get(targetId);
  if (!target) {
    await (interaction as any).reply({ content: 'Target message not found in this channel.', ephemeral: true });
    return;
  }

  const toDelete = [...fetched.values()]
    .filter((m: any) => m.createdTimestamp > target.createdTimestamp && m.id !== targetId)
    .sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);

  const count = toDelete.length + 1;
  if (count === 0) {
    await (interaction as any).reply({ content: 'No messages to purge.', ephemeral: true });
    return;
  }

  const actionId = storePendingAction({
    action: 'purge',
    targetUserId: targetId,
    guildId: guild.id,
    channelId: channel.id,
    reason: `Purge until ${targetId}`,
    actorId: interaction.user.id,
    expiresAt: Date.now() + 60_000,
  });

  const { buildRichV2 } = require('../../utils/v2');
  const embed = buildRichV2({
    accentColor: 0xfee75c,
    header: '⚠️ Confirm Purge',
    text: [
      `This will delete **${count} message(s)** in <#${channel.id}>, including the target message.`,
      '',
      `Target: [Message](${target.url})`,
      `Author: ${target.author ? `<@${target.author.id}>` : 'unknown'}`,
      `Content: ${(target.content || '').slice(0, 200) || '(no text)'}`,
      '',
      '**Press Confirm to proceed, or Cancel to abort.**',
    ].join('\n'),
  });

  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`confirm:${actionId}`).setLabel('Confirm').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`cancel:${actionId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );

  await (interaction as any).reply({
    ...embed,
    components: [row],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  } as never);
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

  let fetched;
  try {
    fetched = await (channel as any).messages.fetch({ around: targetId, limit: 100 });
  } catch {
    await v2MessageReply(message, { content: 'Could not fetch messages around the target.' });
    return;
  }
  const target = fetched.get(targetId);
  if (!target) {
    await v2MessageReply(message, { content: 'Target message not found in this channel.' });
    return;
  }

  const toDelete = [...fetched.values()]
    .filter((m: any) => m.createdTimestamp > target.createdTimestamp && m.id !== targetId)
    .sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);

  const count = toDelete.length + 1;
  if (count === 0) {
    await v2MessageReply(message, { content: 'No messages to purge.' });
    return;
  }

  const { sendButtonConfirm } = await import('../../components/moderation');
  const { confirmed } = await sendButtonConfirm(app, message, 'purge', targetId, `Purge ${count} messages until target`);
  if (!confirmed) return;

  try {
    const fetched = await (channel as any).messages.fetch({ around: targetId, limit: 100 });
    const toDelete = [...fetched.values()]
      .filter((m: any) => m.createdTimestamp >= target.createdTimestamp && m.id !== message.id)
      .sort((a: any, b: any) => a.createdTimestamp - b.createdTimestamp);
    const ids = toDelete.map((m: any) => m.id);
    if (ids.length > 0) {
      try { await (channel as any).bulkDelete(ids, true); }
      catch { for (const m of toDelete) await m.delete().catch(() => undefined); }
    }
    await app.logManager.log({
      event: 'moderation_action',
      guildId: message.guildId!,
      channelId: channel.id,
      actorId: message.author.id,
      message: `Purged ${ids.length} messages in <#${channel.id}>`,
      details: { amount: ids.length },
    });
    await v2MessageReply(message, { content: `✅ Purged ${ids.length} message(s).` });
  } catch (err) {
    await v2MessageReply(message, { content: `❌ Purge failed: ${(err as Error).message}` });
  }
}

const command: BotCommand = {
  name: 'purge-until',
  category: 'moderation',
  description: 'Purge all messages after a target message',
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

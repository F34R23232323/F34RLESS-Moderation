import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('steal')
  .setDescription('Attempt to steal coins from another user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user', true);
  const idempKey = `steal:${interaction.guildId}:${interaction.user.id}:${target.id}:${Date.now()}`;
  const result = await app.economy.stealing.attemptSteal(interaction.guildId!, interaction.user.id, target.id, idempKey);
  if (!result.success) { await v2Reply(interaction, result.error ?? 'Steal failed.'); return; }

  if (result.outcome === 'success') {
    await v2Reply(interaction, `You successfully stole **${app.economy.formatCurrency(result.amount!)}** from ${target}!`);
  } else {
    const fineText = result.fine ? `\nYou were fined **${app.economy.formatCurrency(result.fine)}**.` : '';
    await v2Reply(interaction, `Your steal attempt against ${target} failed!${fineText}`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  if (!args[0]) { await v2MessageReply(message, { content: 'Usage: `steal <user>`' }); return; }
  const targetId = args[0].replace(/[<@!>]/g, '');
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  if (target.id === message.author.id) { await v2MessageReply(message, { content: 'Cannot steal from yourself.' }); return; }
  if (target.bot) { await v2MessageReply(message, { content: 'Cannot steal from bots.' }); return; }
  const idempKey = `steal:${message.guildId}:${message.author.id}:${target.id}:${Date.now()}`;
  const result = await app.economy.stealing.attemptSteal(message.guildId!, message.author.id, target.id, idempKey);
  if (!result.success) { await v2MessageReply(message, { content: result.error ?? 'Steal failed.' }); return; }

  if (result.outcome === 'success') {
    await v2MessageReply(message, { content: `You successfully stole **${app.economy.formatCurrency(result.amount!)}** from ${target}!` });
  } else {
    const fineText = result.fine ? `\nFined **${app.economy.formatCurrency(result.fine)}**.` : '';
    await v2MessageReply(message, { content: `Steal failed against ${target}!${fineText}` });
  }
}

const command: BotCommand = {
  name: 'steal',
  category: 'community',
  description: 'Attempt to steal coins from another user',
  data,
  aliases: ['rob'],
  execute,
  prefixExecute,
};

export default command;

import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';
import { v2MessageReply } from '../../utils/v2';
import { paginateV2, chunkItems } from '../../utils/paginate';

const data = new SlashCommandBuilder()
  .setName('cases')
  .setDescription('List cases for a user')
  .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  const guild = interaction.guild;
  if (!guild) return;
  const user = await resolveUserOption(interaction, app);
  if (!user) {
    await v2Reply(interaction, 'User not found.', { ephemeral: true });
    return;
  }
  const cases = await app.caseService.listCasesForUser(guild.id, user.id);
  if (cases.length === 0) {
    await v2Reply(interaction, `No cases for <@${user.id}>.`);
    return;
  }
  const lines = cases.map((c) => `${c.case_code} [${c.status}] ${c.type} — ${c.reason} (${new Date(c.created_at).toLocaleDateString()})`);
  const pages = chunkItems(lines, 15).map((c) => c.join('\n'));
  await paginateV2({
    trigger: interaction,
    authorId: interaction.user.id,
    title: `**Cases for <@${user.id}>** (${cases.length}) — Page {page}/{total}`,
    pages,
  });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await v2MessageReply(message, { content: 'Usage: `!cases <user>`' });
    return;
  }
  const cases = await app.caseService.listCasesForUser(guild.id, targetId);
  if (cases.length === 0) {
    await v2MessageReply(message, { content: `No cases for <@${targetId}>.` });
    return;
  }
  const lines = cases.map((c) => `${c.case_code} [${c.status}] ${c.type} — ${c.reason} (${new Date(c.created_at).toLocaleDateString()})`);
  const pages = chunkItems(lines, 15).map((c) => c.join('\n'));
  await paginateV2({
    trigger: message,
    authorId: message.author.id,
    title: `**Cases for <@${targetId}>** (${cases.length}) — Page {page}/{total}`,
    pages,
  });
}

const command: BotCommand = {
  name: 'cases',
  category: 'moderation',
  description: 'List cases for a user',
  data,
  permissions: ['ModerateMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { resolveUserOption } from '../../utils/discord';

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
  await v2Reply(interaction, `**Cases for <@${user.id}>** (${cases.length})\n${lines.slice(0, 25).join('\n')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  const targetId = args[0]?.replace(/[<@!>]/g, '');
  if (!guild || !targetId) {
    await message.reply({ content: 'Usage: `!cases <user>`' });
    return;
  }
  const cases = await app.caseService.listCasesForUser(guild.id, targetId);
  await message.reply({ content: cases.length === 0 ? 'No cases.' : `**Cases for <@${targetId}>**\n${cases.slice(0, 20).map((c) => `${c.case_code} ${c.type} — ${c.reason}`).join('\n')}` });
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
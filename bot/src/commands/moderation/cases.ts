import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { paginateV2, chunkItems } from '../../utils/paginate';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtDate(d: Date | string): string {
  return `<t:${Math.floor(new Date(d).getTime() / 1000)}:f>`;
}

const data = new SlashCommandBuilder()
  .setName('cases')
  .setDescription('List all moderation cases in the server');

async function renderAll(app: App, guildId: string): Promise<{ title: string; pages: string[] } | string> {
  const cases = await app.caseService.listCases(guildId, { limit: 500 });
  if (cases.length === 0) return 'No cases have been recorded in this server yet.';

  const blocks = cases.map((c) => {
    const lines = [
      `**#${c.case_code}** · ${cap(c.type)} · ${cap(c.status)}`,
      `> User: <@${c.user_id}>`,
      `> Reason: ${c.reason || 'No reason provided'}`,
      `> When: ${fmtDate(c.created_at)}`,
    ];
    if (c.moderator_id) lines.splice(2, 0, `> Moderator: <@${c.moderator_id}>`);
    return lines.join('\n');
  });

  const pages = chunkItems(blocks, 10).map((c) => c.join('\n\n'));
  return { title: `**Server Cases (${cases.length})** — Page {page}/{total}`, pages };
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild;
  if (!guild) return;
  const result = await renderAll(app, guild.id);
  if (typeof result === 'string') {
    await v2Reply(interaction, result);
    return;
  }
  await paginateV2({ trigger: interaction, authorId: interaction.user.id, title: result.title, pages: result.pages });
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const result = await renderAll(app, guild.id);
  if (typeof result === 'string') {
    await v2MessageReply(message, { content: result });
    return;
  }
  await paginateV2({ trigger: message, authorId: message.author.id, title: result.title, pages: result.pages });
}

const command: BotCommand = {
  name: 'cases',
  category: 'moderation',
  description: 'List all moderation cases in the server',
  data,
  permissions: ['ModerateMembers'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;

import * as path from 'path';
import * as fs from 'fs';
import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { getVpsStats, vpsLines, formatUptime } from '../../utils/vps';

function getVersion(): string {
  const candidates = [
    path.join(__dirname, '../../../../package.json'),
    path.join(__dirname, '../../../../../package.json'),
    path.join(process.cwd(), 'package.json'),
  ];
  for (const c of candidates) {
    try {
      const raw = fs.readFileSync(c, 'utf8');
      const parsed = JSON.parse(raw) as { version?: string };
      if (parsed.version) return parsed.version;
    } catch {
      /* try next */
    }
  }
  return '?.?.?';
}

async function botInfoLines(app: App): Promise<string[]> {
  const mem = process.memoryUsage();
  const guilds = app.client.guilds.cache;
  let totalMembers = 0;
  let totalChannels = 0;
  for (const g of guilds.values()) {
    totalMembers += g.memberCount;
    totalChannels += g.channels.cache.size;
  }
  const vps = await getVpsStats();
  return [
    `# f34rless-moderation`,
    `**Version:** v${getVersion()}`,
    `**Node:** ${process.version}`,
    `**Uptime:** ${formatUptime(Date.now() - app.startedAt)}`,
    `**Ping:** ${app.client.ws.ping}ms`,
    `**Memory:** ${Math.round(mem.rss / 1024 / 1024)}MB RSS / ${Math.round(mem.heapUsed / 1024 / 1024)}MB heap`,
    `**Shards:** ${app.client.shard?.count ?? 1}`,
    '',
    `**Guilds:** ${guilds.size}`,
    `**Users:** ${totalMembers.toLocaleString()}`,
    `**Channels:** ${totalChannels.toLocaleString()}`,
    `**Commands loaded:** ${app.commands.size}`,
    `**Started:** <t:${Math.floor(app.startedAt / 1000)}:R>`,
    '',
    `# VPS`,
    ...vpsLines(vps),
  ];
}

const data = new SlashCommandBuilder().setName('botinfo').setDescription('Bot info: version, stats, memory, shards, VPS');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  await v2Reply(interaction, (await botInfoLines(app)).join('\n'));
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  await v2MessageReply(message, { content: (await botInfoLines(app)).join('\n') });
}

const command: BotCommand = {
  name: 'botinfo',
  category: 'utility',
  description: 'Bot info: version, stats, memory, shards',
  data,
  permissions: [],
  aliases: ['bi', 'about'],
  execute,
  prefixExecute,
};

export default command;

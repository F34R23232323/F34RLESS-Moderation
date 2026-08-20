import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { getVpsStats, vpsLines } from '../../utils/vps';

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}d ${h}h ${m}m ${sec}s`;
}

function statsLines(app: App): string[] {
  const snap = app.metrics.snapshot();
  const successRate = snap.commandsExecuted > 0 ? Math.round(((snap.commandsExecuted - snap.commandsFailed) / snap.commandsExecuted) * 100) : 100;
  return [
    `# Bot Statistics`,
    `**Uptime:** ${formatUptime(snap.uptimeSeconds * 1000)}`,
    `**Messages processed:** ${snap.messagesProcessed.toLocaleString()}`,
    `**Messages / min:** ${snap.messagesPerSecond.toLocaleString()}`,
    `**Commands executed:** ${snap.commandsExecuted.toLocaleString()}`,
    `**Commands failed:** ${snap.commandsFailed.toLocaleString()} (${successRate}% success)`,
    `**Automod triggers (last hour):** ${snap.automodTriggersLastHour.toLocaleString()}`,
    `**Active cooldowns:** ${snap.activeCooldowns.toLocaleString()}`,
    `**Memory:** ${snap.memoryMB}MB RSS`,
  ];
}

async function statsWithVps(app: App): Promise<string[]> {
  const lines = statsLines(app);
  const vps = await getVpsStats();
  lines.push('', '# VPS', ...vpsLines(vps));
  return lines;
}

const data = new SlashCommandBuilder().setName('stats').setDescription('Live bot statistics, metrics and VPS info');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  await v2Reply(interaction, (await statsWithVps(app)).join('\n'));
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  await v2MessageReply(message, { content: (await statsWithVps(app)).join('\n') });
}

const command: BotCommand = {
  name: 'stats',
  category: 'utility',
  description: 'Live bot statistics and metrics',
  data,
  permissions: [],
  aliases: ['metrics', 'botstats'],
  execute,
  prefixExecute,
};

export default command;

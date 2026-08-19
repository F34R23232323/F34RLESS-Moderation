import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2EditMessage, v2MessageReply, v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('ping')
  .setDescription('Bot latency (WebSocket + REST)');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const ws = app.client.ws.ping;
  const sent = Date.now();
  await interaction.deferReply();
  const roundtrip = Date.now() - sent;
  await v2Reply(interaction, `WebSocket: ${Math.round(ws)}ms\nRound-trip: ${roundtrip}ms`);
}

async function prefixExecute(message: Message, _args: string[], app: App): Promise<void> {
  const ws = app.client.ws.ping;
  const sent = Date.now();
  await v2MessageReply(message, { content: 'Pinging...' }).then((m) => v2EditMessage(m, `WebSocket: ${Math.round(ws)}ms | Round-trip: ${Date.now() - sent}ms`));
}

const command: BotCommand = {
  name: 'ping',
  category: 'utility',
  description: 'Bot latency (WebSocket + REST)',
  data,
  permissions: [],
  aliases: ['pong'],
  execute,
  prefixExecute,
};

export default command;
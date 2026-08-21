import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('247')
  .setDescription('Toggle 24/7 mode (bot stays in the voice channel)')
  .addStringOption((o) =>
    o
      .setName('mode')
      .setDescription('on / off (toggles if omitted)')
      .setRequired(false)
      .addChoices({ name: 'On', value: 'on' }, { name: 'Off', value: 'off' }),
  );

async function run(app: App, guildId: string, mode: string | null): Promise<string> {
  const settings = await app.music.getSettings(guildId);
  const next = mode === null ? !settings.twentyFourSeven : mode === 'on';
  const updated = await app.music.set247(guildId, next);
  return `🌙 24/7 mode is now **${updated.twentyFourSeven ? 'ON' : 'OFF'}**. ${
    updated.twentyFourSeven ? 'The bot will stay in the voice channel around the clock.' : 'The bot will leave when the queue ends.'
  }`;
}

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const mode = interaction.options.getString('mode');
  await v2Reply(interaction, await run(app, guild.id, mode));
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const raw = args[0]?.toLowerCase();
  const mode = raw === 'on' || raw === 'off' ? raw : null;
  await v2MessageReply(message, { content: await run(app, guild.id, mode) });
}

const command: BotCommand = {
  name: '247',
  category: 'music',
  description: 'Toggle 24/7 mode',
  data,
  permissions: [],
  aliases: ['24/7', 'stay'],
  execute,
  prefixExecute,
};

export default command;
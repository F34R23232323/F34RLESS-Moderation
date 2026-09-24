import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

async function weatherResult(city: string): Promise<string> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const geo = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
  const result = geo.results?.[0];
  if (!result) throw new Error(`No location found for "${city}".`);
  const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`);
  const w = (await wRes.json()) as { current_weather?: { temperature: number; windspeed: number } };
  const temp = w.current_weather?.temperature ?? '?';
  const wind = w.current_weather?.windspeed ?? '?';
  return `**${result.name}, ${result.country}**\nTemperature: ${temp}°C\nWind: ${wind} km/h`;
}

const data = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('Quick weather lookup (open-meteo, no key)')
  .addStringOption((o) => o.setName('city').setDescription('City name').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const city = interaction.options.getString('city', true);
  try {
    await v2Reply(interaction, await weatherResult(city), { ephemeral: true });
  } catch (err) {
    await v2Reply(interaction, `Weather lookup failed: ${(err as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const city = args.join(' ');
  if (!city) {
    await v2MessageReply(message, { content: 'Usage: `!weather <city>`' });
    return;
  }
  try {
    await v2MessageReply(message, { content: await weatherResult(city) });
  } catch (err) {
    await v2MessageReply(message, { content: `Weather lookup failed: ${(err as Error).message}` });
  }
}

const command: BotCommand = {
  name: 'weather',
  category: 'utility',
  description: 'Quick weather lookup',
  usage: '!weather <city>',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
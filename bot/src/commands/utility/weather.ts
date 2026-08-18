import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('weather')
  .setDescription('Quick weather lookup (open-meteo, no key)')
  .addStringOption((o) => o.setName('city').setDescription('City name').setRequired(true));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const city = interaction.options.getString('city', true);
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geo = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string; country: string }> };
    const result = geo.results?.[0];
    if (!result) {
      await v2Reply(interaction, `No location found for "${city}".`, { ephemeral: true });
      return;
    }
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`);
    const w = (await wRes.json()) as { current_weather?: { temperature: number; windspeed: number; weathercode: number } };
    const temp = w.current_weather?.temperature ?? '?';
    const wind = w.current_weather?.windspeed ?? '?';
    await v2Reply(interaction, `**${result.name}, ${result.country}**\nTemperature: ${temp}°C\nWind: ${wind} km/h`);
  } catch (err) {
    await v2Reply(interaction, `Weather lookup failed: ${(err as Error).message}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const city = args.join(' ');
  if (!city) {
    await message.reply({ content: 'Usage: `!weather <city>`' });
    return;
  }
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
  const geo = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string }> };
  const result = geo.results?.[0];
  if (!result) {
    await message.reply({ content: 'Location not found.' });
    return;
  }
  const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`);
  const w = (await wRes.json()) as { current_weather?: { temperature: number } };
  await message.reply({ content: `**${result.name}**: ${w.current_weather?.temperature ?? '?'}°C` });
}

const command: BotCommand = {
  name: 'weather',
  category: 'utility',
  description: 'Quick weather lookup',
  data,
  permissions: [],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
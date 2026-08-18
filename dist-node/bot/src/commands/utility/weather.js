"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('weather')
    .setDescription('Quick weather lookup (open-meteo, no key)')
    .addStringOption((o) => o.setName('city').setDescription('City name').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const city = interaction.options.getString('city', true);
    try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geo = (await geoRes.json());
        const result = geo.results?.[0];
        if (!result) {
            await (0, v2_1.v2Reply)(interaction, `No location found for "${city}".`, { ephemeral: true });
            return;
        }
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`);
        const w = (await wRes.json());
        const temp = w.current_weather?.temperature ?? '?';
        const wind = w.current_weather?.windspeed ?? '?';
        await (0, v2_1.v2Reply)(interaction, `**${result.name}, ${result.country}**\nTemperature: ${temp}°C\nWind: ${wind} km/h`);
    }
    catch (err) {
        await (0, v2_1.v2Reply)(interaction, `Weather lookup failed: ${err.message}`, { ephemeral: true });
    }
}
async function prefixExecute(message, args, app) {
    const city = args.join(' ');
    if (!city) {
        await message.reply({ content: 'Usage: `!weather <city>`' });
        return;
    }
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geo = (await geoRes.json());
    const result = geo.results?.[0];
    if (!result) {
        await message.reply({ content: 'Location not found.' });
        return;
    }
    const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.latitude}&longitude=${result.longitude}&current_weather=true`);
    const w = (await wRes.json());
    await message.reply({ content: `**${result.name}**: ${w.current_weather?.temperature ?? '?'}°C` });
}
const command = {
    name: 'weather',
    category: 'utility',
    description: 'Quick weather lookup',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=weather.js.map
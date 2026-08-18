"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const FLAGS = {
    t: 'Short time',
    T: 'Long time',
    d: 'Short date',
    D: 'Long date',
    f: 'Short date/time',
    F: 'Long date/time',
    R: 'Relative',
};
const data = new discord_js_1.SlashCommandBuilder()
    .setName('timestamp')
    .setDescription('Generate Discord timestamp codes for every format flag')
    .addStringOption((o) => o.setName('datetime').setDescription('Date/time string (default: now)').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const input = interaction.options.getString('datetime');
    let ts;
    if (input) {
        const parsed = Date.parse(input);
        if (Number.isNaN(parsed)) {
            await (0, v2_1.v2Reply)(interaction, 'Could not parse that date. Try ISO format, e.g. 2026-12-25 18:00.', { ephemeral: true });
            return;
        }
        ts = Math.floor(parsed / 1000);
    }
    else {
        ts = Math.floor(Date.now() / 1000);
    }
    const lines = Object.entries(FLAGS).map(([flag, label]) => `\`${flag}\` ${label}: <t:${ts}:${flag}>`);
    await (0, v2_1.v2Reply)(interaction, ['**Timestamp generator**', ...lines].join('\n'), { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const input = args.join(' ');
    const parsed = input ? Date.parse(input) : Date.now();
    if (Number.isNaN(parsed)) {
        await message.reply({ content: 'Could not parse that date.' });
        return;
    }
    const ts = Math.floor(parsed / 1000);
    await message.reply({ content: Object.entries(FLAGS).map(([f]) => `<t:${ts}:${f}>`).join(' | ') });
}
const command = {
    name: 'timestamp',
    category: 'utility',
    description: 'Generate Discord timestamp codes for every format flag',
    data,
    permissions: [],
    aliases: ['ts', 'time'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=timestamp.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const index_1 = require("../../../../shared/src/index");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a persistent reminder')
    .addSubcommand((s) => s.setName('set').setDescription('Set a reminder').addStringOption((o) => o.setName('duration').setDescription('e.g. 10m, 2h').setRequired(true)).addStringOption((o) => o.setName('message').setDescription('Reminder text').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('List your reminders'))
    .addSubcommand((s) => s.setName('cancel').setDescription('Cancel a reminder').addIntegerOption((o) => o.setName('id').setDescription('Reminder ID').setRequired(true)));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'set') {
        const duration = (0, index_1.parseDuration)(interaction.options.getString('duration', true));
        const message = interaction.options.getString('message', true);
        if (!duration || duration.isPermanent) {
            await (0, v2_1.v2Reply)(interaction, 'Provide a valid duration (e.g. 10m, 2h).', { ephemeral: true });
            return;
        }
        const [result] = await app.db.execute('INSERT INTO reminders (user_id, guild_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?, ?)', [interaction.user.id, interaction.guildId, interaction.channelId, message, new Date(Date.now() + duration.milliseconds)]);
        await (0, v2_1.v2Reply)(interaction, `Reminder set (ID ${result.insertId}) for ${duration.milliseconds / 60000} minutes.`, { ephemeral: true });
    }
    else if (sub === 'list') {
        const [rows] = await app.db.query("SELECT id, message, remind_at FROM reminders WHERE user_id = ? AND status = 'pending' ORDER BY remind_at ASC LIMIT 20", [interaction.user.id]);
        if (rows.length === 0) {
            await (0, v2_1.v2Reply)(interaction, 'No pending reminders.', { ephemeral: true });
            return;
        }
        const lines = rows.map((r) => `#${r.id} — ${r.message} (<t:${Math.floor(new Date(r.remind_at).getTime() / 1000)}:R>)`);
        await (0, v2_1.v2Reply)(interaction, `**Your reminders**\n${lines.join('\n')}`, { ephemeral: true });
    }
    else if (sub === 'cancel') {
        const id = interaction.options.getInteger('id', true);
        await app.db.execute("UPDATE reminders SET status = 'cancelled' WHERE id = ? AND user_id = ?", [id, interaction.user.id]);
        await (0, v2_1.v2Reply)(interaction, 'Reminder cancelled.', { ephemeral: true });
    }
}
async function prefixExecute(message, args, app) {
    const duration = (0, index_1.parseDuration)(args[0] ?? '');
    const text = args.slice(1).join(' ');
    if (!duration || duration.isPermanent || !text) {
        await message.reply({ content: 'Usage: `!remindme <duration> <message>`' });
        return;
    }
    await app.db.execute('INSERT INTO reminders (user_id, guild_id, channel_id, message, remind_at) VALUES (?, ?, ?, ?, ?)', [message.author.id, message.guildId, message.channelId, text, new Date(Date.now() + duration.milliseconds)]);
    await message.reply({ content: 'Reminder set.' });
}
const command = {
    name: 'remindme',
    category: 'utility',
    description: 'Set a persistent reminder',
    data,
    permissions: [],
    aliases: ['remind'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=remindme.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Appeal a punishment case')
    .addIntegerOption((o) => o.setName('case_id').setDescription('Case number').setRequired(true))
    .addStringOption((o) => o.setName('message').setDescription('Appeal message').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild)
        return;
    const caseNumber = interaction.options.getInteger('case_id', true);
    const message = interaction.options.getString('message', true);
    const c = await app.caseService.getCaseByNumber(guild.id, caseNumber);
    if (!c) {
        await (0, v2_1.v2Reply)(interaction, `Case #${caseNumber} not found.`, { ephemeral: true });
        return;
    }
    if (c.user_id !== interaction.user.id) {
        await (0, v2_1.v2Reply)(interaction, 'You can only appeal your own cases.', { ephemeral: true });
        return;
    }
    const [result] = await app.db.execute('INSERT INTO appeals (case_id, guild_id, user_id, message) VALUES (?, ?, ?, ?)', [c.id, guild.id, interaction.user.id, message]);
    await app.caseService.setStatus(c.id, 'appealed');
    await app.logManager.log({
        event: 'appeal_created',
        guildId: guild.id,
        actorId: interaction.user.id,
        targetId: c.user_id,
        message: `Appeal filed for case #${caseNumber}`,
        details: { appealId: result.insertId, message },
    });
    await (0, v2_1.v2Reply)(interaction, `Appeal filed for case #${caseNumber}. Staff will review it.`, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const caseNumber = Number(args[0]);
    const appeal = args.slice(1).join(' ');
    const guild = message.guild;
    if (!guild || !caseNumber || !appeal) {
        await message.reply({ content: 'Usage: `!appeal <case_id> <message>`' });
        return;
    }
    const c = await app.caseService.getCaseByNumber(guild.id, caseNumber);
    if (!c || c.user_id !== message.author.id) {
        await message.reply({ content: 'Case not found or not yours.' });
        return;
    }
    await app.db.execute('INSERT INTO appeals (case_id, guild_id, user_id, message) VALUES (?, ?, ?, ?)', [c.id, guild.id, message.author.id, appeal]);
    await app.caseService.setStatus(c.id, 'appealed');
    await message.reply({ content: `Appeal filed for case #${caseNumber}.` });
}
const command = {
    name: 'appeal',
    category: 'moderation',
    description: 'Appeal a punishment case',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=appeal.js.map
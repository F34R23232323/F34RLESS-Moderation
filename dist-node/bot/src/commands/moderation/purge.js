"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('purge')
    .setDescription('Purge messages with optional filters')
    .addIntegerOption((o) => o.setName('amount').setDescription('Number of messages').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption((o) => o.setName('user').setDescription('Only purge from this user').setRequired(false))
    .addStringOption((o) => o.setName('contains').setDescription('Only purge messages containing this text').setRequired(false))
    .addBooleanOption((o) => o.setName('bots').setDescription('Only purge bot messages').setRequired(false))
    .addBooleanOption((o) => o.setName('attachments').setDescription('Only purge messages with attachments').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel))
        return;
    const amount = interaction.options.getInteger('amount', true);
    const targetUser = interaction.options.getUser('user');
    const contains = interaction.options.getString('contains');
    const bots = interaction.options.getBoolean('bots') ?? false;
    const attachments = interaction.options.getBoolean('attachments') ?? false;
    const fetched = await channel.messages.fetch({ limit: Math.min(amount + 10, 100) });
    const selected = fetched.filter((m) => {
        if (m.id === interaction.id)
            return false;
        if (targetUser && m.author.id !== targetUser.id)
            return false;
        if (contains && !m.content.includes(contains))
            return false;
        if (bots && !m.author.bot)
            return false;
        if (attachments && m.attachments.size === 0)
            return false;
        return true;
    }).first(amount);
    const count = selected.length;
    const ids = selected.map((m) => m.id);
    try {
        await channel.bulkDelete(ids, true);
    }
    catch {
        for (const m of selected)
            await m.delete().catch(() => undefined);
    }
    await app.logManager.log({
        event: 'moderation_action',
        guildId: interaction.guildId,
        channelId: channel.id,
        actorId: interaction.user.id,
        message: `Purged ${count} messages in <#${channel.id}>`,
        details: { amount: count, filters: { targetUser: targetUser?.id, contains, bots, attachments } },
    });
    await (0, v2_1.v2Reply)(interaction, `Purged ${count} message(s).`, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const amount = parseInt(args[0] ?? '', 10);
    if (!amount || amount < 1 || amount > 100) {
        await message.reply({ content: 'Usage: `!purge <1-100> [user] [contains:text]`' });
        return;
    }
    const channel = message.channel;
    if (!('bulkDelete' in channel))
        return;
    const fetched = await channel.messages.fetch({ limit: amount + 5 });
    const selected = fetched.filter((m) => m.id !== message.id).first(amount);
    await channel.bulkDelete(selected.map((m) => m.id), true).catch(() => undefined);
    await message.reply({ content: `Purged ${selected.length} message(s).` }).then((m) => setTimeout(() => m.delete().catch(() => undefined), 3000));
}
const command = {
    name: 'purge',
    category: 'moderation',
    description: 'Purge messages with optional filters',
    data,
    permissions: ['ManageMessages'],
    aliases: ['clear', 'prune'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=purge.js.map
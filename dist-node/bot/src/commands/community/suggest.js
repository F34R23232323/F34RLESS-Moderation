"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit a suggestion to the community')
    .addStringOption((o) => o.setName('suggestion').setDescription('Your suggestion').setRequired(true));
async function execute(interaction, app) {
    const cfg = app.config.community.suggestions;
    const guild = interaction.guild;
    if (!cfg.enabled || !cfg.channel_id || !guild) {
        await (0, v2_1.v2Reply)(interaction, 'Suggestions are not enabled.', { ephemeral: true });
        return;
    }
    const suggestion = interaction.options.getString('suggestion', true);
    const channel = guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel)) {
        await (0, v2_1.v2Reply)(interaction, 'Suggestion channel is misconfigured.', { ephemeral: true });
        return;
    }
    await interaction.deferReply({ ephemeral: true });
    const sent = await channel.send({
        content: `**Suggestion from <@${interaction.user.id}>**\n${suggestion}`,
        components: [
            {
                type: 1,
                components: [
                    { type: 2, custom_id: `suggest:up:${interaction.id}`, label: 'Upvote', style: 3 },
                    { type: 2, custom_id: `suggest:down:${interaction.id}`, label: 'Downvote', style: 4 },
                ],
            },
        ],
    });
    await app.db.execute('INSERT INTO suggestions (guild_id, message_id, user_id, content) VALUES (?, ?, ?, ?)', [
        guild.id,
        sent.id,
        interaction.user.id,
        suggestion,
    ]);
    await (0, v2_1.v2Reply)(interaction, 'Suggestion posted.', { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const cfg = app.config.community.suggestions;
    const guild = message.guild;
    const suggestion = args.join(' ');
    if (!cfg.enabled || !cfg.channel_id || !guild || !suggestion) {
        await message.reply({ content: 'Suggestions not enabled or missing text.' });
        return;
    }
    const channel = guild.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel))
        return;
    await channel.send({ content: `**Suggestion from <@${message.author.id}>**\n${suggestion}` });
    await message.reply({ content: 'Suggestion posted.' });
}
const command = {
    name: 'suggest',
    category: 'community',
    description: 'Submit a suggestion to the community',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=suggest.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const suggestUp = {
    type: 'button',
    id: 'suggest:up:',
    async run(app, interaction) {
        await interaction.reply({ content: 'Upvote recorded.', ephemeral: true });
    },
};
const suggestDown = {
    type: 'button',
    id: 'suggest:down:',
    async run(app, interaction) {
        await interaction.reply({ content: 'Downvote recorded.', ephemeral: true });
    },
};
const giveawayEnter = {
    type: 'button',
    id: 'giveaway:enter:',
    async run(app, interaction) {
        const id = Number(interaction.customId.replace('giveaway:enter:', ''));
        const [rows] = await app.db.query('SELECT id FROM giveaways WHERE id = ? AND ended = 0', [id]);
        if (rows.length === 0) {
            await interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
            return;
        }
        const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
        if (!member) {
            await interaction.reply({ content: 'Could not verify membership.', ephemeral: true });
            return;
        }
        await interaction.reply({ content: 'You have entered the giveaway!', ephemeral: true });
    },
};
exports.default = [suggestUp, suggestDown, giveawayEnter];
//# sourceMappingURL=community.js.map
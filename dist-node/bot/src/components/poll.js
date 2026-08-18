"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const poll_1 = require("../commands/utility/poll");
exports.default = {
    type: 'button',
    id: 'poll:',
    async run(app, interaction) {
        const [pollId, action] = interaction.customId.replace('poll:', '').split(':');
        const fullId = `poll:${pollId}`;
        const poll = app.polls.get(fullId);
        if (!poll) {
            await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
            return;
        }
        if (action === 'close') {
            const member = interaction.member;
            const canClose = member && 'permissions' in member && member.permissions.has('ManageMessages');
            if (!canClose) {
                await interaction.reply({ content: 'You need Manage Messages to close this poll.', ephemeral: true });
                return;
            }
            await (0, poll_1.closePoll)(app, fullId);
            await interaction.reply({ content: 'Poll closed.', ephemeral: true });
            return;
        }
        const index = action;
        const optionIndex = Number(index);
        if (Number.isNaN(optionIndex) || optionIndex >= poll.options.length) {
            await interaction.reply({ content: 'Invalid option.', ephemeral: true });
            return;
        }
        for (const [opt, set] of poll.votes) {
            if (set.delete(interaction.user.id) && set.size === 0 && opt !== index) {
                poll.votes.delete(opt);
            }
        }
        const set = poll.votes.get(index) ?? new Set();
        if (set.has(interaction.user.id)) {
            set.delete(interaction.user.id);
        }
        else {
            set.add(interaction.user.id);
        }
        if (set.size === 0)
            poll.votes.delete(index);
        else
            poll.votes.set(index, set);
        const channel = app.client.channels.cache.get(poll.channelId);
        if (channel && 'messages' in channel) {
            const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
            if (msg) {
                const lines = [`**${poll.question}**`, ...poll.options.map((o, i) => `**${i + 1}.** ${o} — ${(poll.votes.get(String(i)) ?? new Set()).size} vote(s)`)];
                await msg.edit({ content: lines.join('\n') }).catch(() => undefined);
            }
        }
        await interaction.reply({ content: 'Vote recorded.', ephemeral: true });
    },
};
//# sourceMappingURL=poll.js.map
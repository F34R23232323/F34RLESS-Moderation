"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Create or close a support ticket')
    .addSubcommand((s) => s.setName('open').setDescription('Open a ticket').addStringOption((o) => o.setName('topic').setDescription('What do you need help with').setRequired(false)))
    .addSubcommand((s) => s.setName('close').setDescription('Close your ticket'));
async function execute(interaction, app) {
    const cfg = app.config.tickets;
    const guild = interaction.guild;
    if (!cfg.enabled || !guild || !cfg.category_id) {
        await (0, v2_1.v2Reply)(interaction, 'Tickets are not enabled.', { ephemeral: true });
        return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'open') {
        const existing = await app.db.query("SELECT id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'", [guild.id, interaction.user.id]);
        if (existing[0].length > 0) {
            await (0, v2_1.v2Reply)(interaction, 'You already have an open ticket.', { ephemeral: true });
            return;
        }
        const topic = interaction.options.getString('topic') ?? 'Support';
        const thread = await guild.channels.create({
            name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            type: 11,
            parent: cfg.category_id,
            reason: 'Ticket opened',
        });
        await thread.members.add(interaction.user.id);
        for (const roleId of cfg.support_roles) {
            const role = guild.roles.cache.get(roleId);
            if (role)
                await thread.permissionOverwrites.create(role.id, { SendMessages: true, ViewChannel: true });
        }
        await app.db.execute("INSERT INTO tickets (guild_id, thread_id, user_id, status) VALUES (?, ?, ?, 'open')", [guild.id, thread.id, interaction.user.id]);
        await thread.send({ content: `Ticket opened by <@${interaction.user.id}> — ${topic}\nUse the Close button below or \`/ticket close\`.` });
        await (0, v2_1.v2Reply)(interaction, `Ticket opened: <#${thread.id}>`, { ephemeral: true });
    }
    else {
        const [rows] = await app.db.query("SELECT id, thread_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'", [guild.id, interaction.user.id]);
        const row = rows[0];
        if (!row) {
            await (0, v2_1.v2Reply)(interaction, 'No open ticket found.', { ephemeral: true });
            return;
        }
        const thread = guild.channels.cache.get(String(row.thread_id));
        if (thread && 'delete' in thread) {
            await thread.delete().catch(() => undefined);
        }
        await app.db.execute("UPDATE tickets SET status = 'closed', closed_at = NOW() WHERE id = ?", [row.id]);
        await (0, v2_1.v2Reply)(interaction, 'Ticket closed.', { ephemeral: true });
    }
}
const command = {
    name: 'ticket',
    category: 'community',
    description: 'Create or close a support ticket',
    data,
    permissions: [],
    aliases: ['tickets'],
    execute,
};
exports.default = command;
//# sourceMappingURL=ticket.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Schedule a one-off or recurring announcement (staff)')
    .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(false))
    .addSubcommand((s) => s.setName('once').setDescription('One-off announcement').addStringOption((o) => o.setName('datetime').setDescription('ISO datetime').setRequired(true)).addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true)))
    .addSubcommand((s) => s.setName('recurring').setDescription('Recurring announcement').addStringOption((o) => o.setName('cron').setDescription('Cron expression, e.g. 0 9 * * *').setRequired(true)).addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true)));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    if (!guild)
        return;
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const message = interaction.options.getString('message', true);
    if (!channel || !('send' in channel)) {
        await (0, v2_1.v2Reply)(interaction, 'Invalid channel.', { ephemeral: true });
        return;
    }
    if (sub === 'once') {
        const dt = Date.parse(interaction.options.getString('datetime', true));
        if (Number.isNaN(dt)) {
            await (0, v2_1.v2Reply)(interaction, 'Invalid datetime.', { ephemeral: true });
            return;
        }
        await app.db.execute('INSERT INTO scheduled_announcements (guild_id, channel_id, content, cron, next_run, created_by) VALUES (?, ?, ?, ?, ?, ?)', [guild.id, channel.id, JSON.stringify({ content: message }), '@once', new Date(dt), interaction.user.id]);
        await (0, v2_1.v2Reply)(interaction, `Scheduled one-off for <t:${Math.floor(dt / 1000)}:F>.`, { ephemeral: true });
    }
    else {
        const cron = interaction.options.getString('cron', true);
        const { validate } = await Promise.resolve().then(() => __importStar(require('node-cron')));
        if (!validate(cron)) {
            await (0, v2_1.v2Reply)(interaction, 'Invalid cron expression.', { ephemeral: true });
            return;
        }
        const next = new Date(Date.now() + 60000);
        await app.db.execute('INSERT INTO scheduled_announcements (guild_id, channel_id, content, cron, next_run, created_by) VALUES (?, ?, ?, ?, ?, ?)', [guild.id, channel.id, JSON.stringify({ content: message }), cron, next, interaction.user.id]);
        await (0, v2_1.v2Reply)(interaction, `Recurring announcement scheduled (\`${cron}\`).`, { ephemeral: true });
    }
}
const command = {
    name: 'schedule',
    category: 'admin',
    description: 'Schedule a one-off or recurring announcement (staff)',
    data,
    permissions: ['ManageMessages'],
    aliases: ['announcement'],
    execute,
};
exports.default = command;
//# sourceMappingURL=schedule.js.map
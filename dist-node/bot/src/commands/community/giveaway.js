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
const index_1 = require("../../../../shared/src/index");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start or reroll a giveaway')
    .addSubcommand((s) => s.setName('start').setDescription('Start a giveaway').addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true)).addStringOption((o) => o.setName('duration').setDescription('Duration e.g. 1h, 2d').setRequired(true)).addIntegerOption((o) => o.setName('winners').setDescription('Winner count').setMinValue(1).setRequired(false)))
    .addSubcommand((s) => s.setName('reroll').setDescription('Reroll a giveaway').addStringOption((o) => o.setName('message_id').setDescription('Giveaway message ID').setRequired(true)));
async function execute(interaction, app) {
    const cfg = app.config.community.giveaways;
    if (!cfg.enabled) {
        await (0, v2_1.v2Reply)(interaction, 'Giveaways are not enabled.', { ephemeral: true });
        return;
    }
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    if (!guild)
        return;
    if (sub === 'start') {
        const prize = interaction.options.getString('prize', true);
        const duration = (0, index_1.parseDuration)(interaction.options.getString('duration', true));
        const winners = interaction.options.getInteger('winners') ?? 1;
        if (!duration || duration.isPermanent) {
            await (0, v2_1.v2Reply)(interaction, 'Provide a valid duration.', { ephemeral: true });
            return;
        }
        const endsAt = new Date(Date.now() + duration.milliseconds);
        const [result] = await app.db.execute('INSERT INTO giveaways (guild_id, channel_id, prize, winners, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?)', [guild.id, interaction.channelId, prize, winners, endsAt, interaction.user.id]);
        const id = result.insertId;
        const content = `**Giveaway: ${prize}**\nWinners: ${winners}\nEnds: <t:${Math.floor(endsAt.getTime() / 1000)}:R>\nReact to enter!`;
        const sent = await interaction.editReply({
            content,
            components: [{ type: 1, components: [{ type: 2, custom_id: `giveaway:enter:${id}`, label: 'Enter', style: 3 }] }],
        });
        await app.db.execute('UPDATE giveaways SET message_id = ? WHERE id = ?', [sent.id, id]);
        app.scheduler.setTimeout(`giveaway:${id}`, duration.milliseconds, async () => {
            const draw = await Promise.resolve().then(() => __importStar(require('../../community/giveaways')));
            await draw.draw(app, id);
        });
    }
    else {
        const messageId = interaction.options.getString('message_id', true);
        const [rows] = await app.db.query('SELECT id FROM giveaways WHERE message_id = ?', [messageId]);
        const row = rows[0];
        if (!row) {
            await (0, v2_1.v2Reply)(interaction, 'Giveaway not found.', { ephemeral: true });
            return;
        }
        const draw = await Promise.resolve().then(() => __importStar(require('../../community/giveaways')));
        await draw.draw(app, Number(row.id), true);
    }
}
const command = {
    name: 'giveaway',
    category: 'community',
    description: 'Start or reroll a giveaway',
    data,
    permissions: ['ManageMessages'],
    aliases: [],
    execute,
};
exports.default = command;
//# sourceMappingURL=giveaway.js.map
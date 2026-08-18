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
    .setName('embed')
    .setDescription('Craft an announcement message (staff)')
    .addStringOption((o) => o.setName('title').setDescription('Title').setRequired(false))
    .addStringOption((o) => o.setName('description').setDescription('Body text').setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(false))
    .addStringOption((o) => o.setName('accent').setDescription('Accent color hex').setRequired(false));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description', true);
    const accent = interaction.options.getString('accent') ?? undefined;
    const channelOpt = interaction.options.getChannel('channel');
    const target = channelOpt ?? interaction.channel;
    if (!target?.send) {
        await (0, v2_1.v2Reply)(interaction, 'Invalid target channel.', { ephemeral: true });
        return;
    }
    const content = title ? `**${title}**\n${description}` : description;
    const { v2Send } = await Promise.resolve().then(() => __importStar(require('../../utils/v2')));
    await v2Send(target, content, { accentColor: accent?.startsWith('#') ? accent : accent ? `#${accent}` : undefined });
    await (0, v2_1.v2Reply)(interaction, 'Sent.', { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const text = args.join(' ');
    if (!text) {
        await message.reply({ content: 'Usage: `!embed <title | body>`' });
        return;
    }
    const parts = text.split(' | ');
    const content = parts.length > 1 ? `**${parts[0]}**\n${parts.slice(1).join(' | ')}` : text;
    await message.delete().catch(() => undefined);
    await message.channel.send({ content });
}
const command = {
    name: 'embed',
    category: 'admin',
    description: 'Craft an announcement message (staff)',
    data,
    permissions: ['ManageMessages'],
    aliases: ['embedbuilder'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=embed.js.map
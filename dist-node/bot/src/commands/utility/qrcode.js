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
const QRCode = __importStar(require("qrcode"));
const data = new discord_js_1.SlashCommandBuilder()
    .setName('qrcode')
    .setDescription('Generate a QR code from text or URL')
    .addStringOption((o) => o.setName('text').setDescription('Text or URL').setRequired(true));
async function execute(interaction, app) {
    await interaction.deferReply();
    const text = interaction.options.getString('text', true);
    const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
    await interaction.editReply({
        content: `QR for: ${text.slice(0, 200)}`,
        files: [{ attachment: buffer, name: 'qrcode.png' }],
    });
}
async function prefixExecute(message, args, app) {
    const text = args.join(' ');
    if (!text) {
        await message.reply({ content: 'Usage: `!qrcode <text>`' });
        return;
    }
    const buffer = await QRCode.toBuffer(text, { width: 512, margin: 2 });
    await message.reply({ files: [{ attachment: buffer, name: 'qrcode.png' }] });
}
const command = {
    name: 'qrcode',
    category: 'utility',
    description: 'Generate a QR code from text or URL',
    data,
    permissions: [],
    aliases: ['qr'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=qrcode.js.map
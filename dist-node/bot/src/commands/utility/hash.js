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
const crypto = __importStar(require("crypto"));
const data = new discord_js_1.SlashCommandBuilder()
    .setName('hash')
    .setDescription('Hash a string (md5, sha1, sha256)')
    .addStringOption((o) => o.setName('algorithm').setDescription('Algorithm').addChoices({ name: 'md5', value: 'md5' }, { name: 'sha1', value: 'sha1' }, { name: 'sha256', value: 'sha256' }).setRequired(true))
    .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true));
async function execute(interaction, app) {
    const algorithm = interaction.options.getString('algorithm', true);
    const text = interaction.options.getString('text', true);
    const result = crypto.createHash(algorithm).update(text).digest('hex');
    await (0, v2_1.v2Reply)(interaction, `\`${algorithm}\`\n\`\`\`\n${result}\n\`\`\``, { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const algorithm = args[0] ?? 'sha256';
    const text = args.slice(1).join(' ');
    if (!text) {
        await message.reply({ content: 'Usage: `!hash <md5|sha1|sha256> <text>`' });
        return;
    }
    const result = crypto.createHash(algorithm).update(text).digest('hex');
    await message.reply({ content: `\`${algorithm}\`: \`${result}\`` });
}
const command = {
    name: 'hash',
    category: 'utility',
    description: 'Hash a string (md5, sha1, sha256)',
    data,
    permissions: [],
    aliases: [],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=hash.js.map
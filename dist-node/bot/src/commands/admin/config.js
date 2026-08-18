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
    .setName('config')
    .setDescription('View or validate the bot configuration (owner only)')
    .addSubcommand((s) => s.setName('view').setDescription('Show a config section'))
    .addSubcommand((s) => s.setName('validate').setDescription('Validate the current config'));
async function execute(interaction, app) {
    await interaction.deferReply({ ephemeral: true });
    if (!app.modGuard.isOwner(interaction.user.id)) {
        await (0, v2_1.v2Reply)(interaction, 'Owner only.', { ephemeral: true });
        return;
    }
    const sub = interaction.options.getSubcommand();
    if (sub === 'view') {
        const sections = Object.keys(app.config);
        await (0, v2_1.v2Reply)(interaction, `**Config sections**\n${sections.join(', ')}\n\nFull config is editable on the web dashboard (see dashboard section).`);
    }
    else if (sub === 'validate') {
        const { loadConfig, formatConfigError } = await Promise.resolve().then(() => __importStar(require('../../../../shared/src/config/load')));
        try {
            loadConfig({ configPath: app.configPath });
            await (0, v2_1.v2Reply)(interaction, 'Config is valid.');
        }
        catch (err) {
            await (0, v2_1.v2Reply)(interaction, `Config invalid:\n\`\`\`\n${formatConfigError(err)}\n\`\`\``, { ephemeral: true });
        }
    }
}
const command = {
    name: 'config',
    category: 'admin',
    description: 'View or validate the bot configuration (owner only)',
    data,
    permissions: [],
    aliases: [],
    execute,
    ownerOnly: true,
};
exports.default = command;
//# sourceMappingURL=config.js.map
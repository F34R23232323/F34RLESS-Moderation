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
    .setName('verify')
    .setDescription('Post the verification gate panel (staff)');
async function execute(interaction, app) {
    const cfg = app.config.verification_gate;
    const guild = interaction.guild;
    if (!cfg.enabled || !guild) {
        await (0, v2_1.v2Reply)(interaction, 'Verification gate is not enabled.', { ephemeral: true });
        return;
    }
    const { v2Send } = await Promise.resolve().then(() => __importStar(require('../../utils/v2')));
    await v2Send(interaction.channel, 'Click the button below to verify and gain access to the server.', {
        buttons: [{ customId: `verify:${interaction.user.id}`, label: 'Verify', style: 3 }],
    });
    await (0, v2_1.v2Reply)(interaction, 'Verification panel posted.', { ephemeral: true });
}
const command = {
    name: 'verify',
    category: 'admin',
    description: 'Post the verification gate panel (staff)',
    data,
    permissions: ['ManageGuild'],
    aliases: ['verifypanel'],
    execute,
};
exports.default = command;
//# sourceMappingURL=verify.js.map
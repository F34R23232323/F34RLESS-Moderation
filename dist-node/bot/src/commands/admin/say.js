"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
function sayCommand(name, description, staff) {
    const data = new discord_js_1.SlashCommandBuilder()
        .setName(name)
        .setDescription(description)
        .addStringOption((o) => o.setName('message').setDescription('Message text').setRequired(true))
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false));
    return {
        name,
        category: 'admin',
        description,
        data,
        permissions: staff ? ['ManageMessages'] : [],
        aliases: [],
        async execute(interaction, app) {
            await interaction.deferReply({ ephemeral: true });
            const text = interaction.options.getString('message', true);
            const channelOpt = interaction.options.getChannel('channel');
            const target = channelOpt ?? interaction.channel;
            if (!target || !('send' in target)) {
                await (0, v2_1.v2Reply)(interaction, 'Invalid target channel.', { ephemeral: true });
                return;
            }
            await target.send({ content: text });
            await (0, v2_1.v2Reply)(interaction, 'Sent.', { ephemeral: true });
        },
        async prefixExecute(message, args, app) {
            const text = args.join(' ');
            if (!text) {
                await message.reply({ content: `Usage: !${name} <text>` });
                return;
            }
            await message.delete().catch(() => undefined);
            await message.channel.send({ content: text });
        },
    };
}
exports.default = [sayCommand('say', 'Send a message as the bot', false), sayCommand('announce', 'Send an announcement as the bot', true)];
//# sourceMappingURL=say.js.map
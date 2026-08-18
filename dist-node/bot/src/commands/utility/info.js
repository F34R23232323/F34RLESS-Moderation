"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
function infoCommand(name, description, build) {
    const data = new discord_js_1.SlashCommandBuilder()
        .setName(name)
        .setDescription(description)
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(false))
        .addChannelOption((o) => o.setName('channel').setDescription('Channel').setRequired(false))
        .addStringOption((o) => o.setName('id').setDescription('ID').setRequired(false));
    return {
        name,
        category: 'utility',
        description,
        data,
        permissions: [],
        aliases: [],
        async execute(interaction, app) {
            await interaction.deferReply();
            const lines = await build(interaction);
            await (0, v2_1.v2Reply)(interaction, lines.join('\n'));
        },
    };
}
const roleinfo = infoCommand('roleinfo', 'Role details', async (interaction) => {
    const guild = interaction.guild;
    const role = interaction.options.getRole('role') ?? (interaction.options.getString('id') ? guild.roles.cache.get(interaction.options.getString('id')) : null);
    if (!role)
        return ['Role not found.'];
    return [
        `**<@&${role.id}>**`,
        `Color: #${role.color.toString(16).padStart(6, '0')}`,
        `Position: ${role.position}`,
        `Members: ${role.members.size}`,
        `Mentionable: ${role.mentionable} | Hoisted: ${role.hoist}`,
        `Created: <t:${Math.floor(role.createdTimestamp / 1000)}:f>`,
        `Permissions: ${role.permissions.toArray().slice(0, 15).join(', ') || 'none'}`,
    ];
});
const channelinfo = infoCommand('channelinfo', 'Channel details', async (interaction) => {
    const guild = interaction.guild;
    const channel = interaction.options.getChannel('channel') ?? (interaction.options.getString('id') ? guild.channels.cache.get(interaction.options.getString('id')) : interaction.channel);
    if (!channel)
        return ['Channel not found.'];
    const meta = channel;
    return [
        `**#${channel.name}**`,
        `Type: ${channel.type}`,
        meta.topic ? `Topic: ${meta.topic}` : '',
        meta.rateLimitPerUser ? `Slowmode: ${meta.rateLimitPerUser}s` : '',
        meta.nsfw ? 'NSFW: true' : '',
        meta.parentId ? `Category: <#${meta.parentId}>` : '',
        `Created: <t:${Math.floor(channel.createdTimestamp / 1000)}:f>`,
    ].filter(Boolean);
});
const emojiinfo = infoCommand('emojiinfo', 'Emoji details', async (interaction) => {
    const guild = interaction.guild;
    const id = interaction.options.getString('id');
    const emoji = id ? guild.emojis.cache.get(id) : [...guild.emojis.cache.values()][0];
    if (!emoji)
        return ['Emoji not found.'];
    return [
        `**${emoji.name}**`,
        `ID: ${emoji.id}`,
        `Animated: ${emoji.animated}`,
        `Uploaded: <t:${Math.floor(emoji.createdTimestamp / 1000)}:f>`,
        `Uploader: ${emoji.author?.tag ?? 'unknown'}`,
        emoji.url ? `[Image](${emoji.url})` : '',
    ].filter(Boolean);
});
const stickerinfo = infoCommand('stickerinfo', 'Sticker details', async (interaction) => {
    const guild = interaction.guild;
    const sticker = [...guild.stickers.cache.values()][0];
    if (!sticker)
        return ['No stickers in this server.'];
    return [
        `**${sticker.name}**`,
        `ID: ${sticker.id}`,
        `Format: ${sticker.format}`,
        `Tags: ${sticker.tags}`,
        `Created: <t:${Math.floor(sticker.createdTimestamp / 1000)}:f>`,
    ];
});
const inviteinfo = infoCommand('inviteinfo', 'Resolve an invite code', async (interaction) => {
    const code = interaction.options.getString('id');
    if (!code)
        return ['Provide an invite code, e.g. `!inviteinfo abc123`'];
    const invite = await interaction.client.fetchInvite(code).catch(() => null);
    if (!invite)
        return [`Invite \`${code}\` could not be resolved.`];
    return [
        `**Invite: ${invite.code}**`,
        `Server: ${invite.guild?.name ?? 'unknown'}`,
        `Channel: ${invite.channel?.name ?? 'unknown'}`,
        `Inviter: ${invite.inviter?.tag ?? 'unknown'}`,
        `Uses: ${invite.uses ?? 0}${invite.maxUses ? `/${invite.maxUses}` : ''}`,
        invite.expiresTimestamp ? `Expires: <t:${Math.floor(invite.expiresTimestamp / 1000)}:f>` : 'Expires: never',
    ];
});
exports.default = [roleinfo, channelinfo, emojiinfo, stickerinfo, inviteinfo];
//# sourceMappingURL=info.js.map
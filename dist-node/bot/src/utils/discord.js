"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveUserOption = resolveUserOption;
exports.resolveMemberOption = resolveMemberOption;
exports.getOptionString = getOptionString;
exports.getOptionInt = getOptionInt;
exports.getOptionBoolean = getOptionBoolean;
async function resolveUserOption(interaction, app, optionName = 'user') {
    const value = interaction.options.getUser(optionName);
    if (value)
        return value;
    const id = interaction.options.getString(optionName);
    if (!id)
        return null;
    return app.client.users.fetch(id).catch(() => null);
}
async function resolveMemberOption(interaction, guild, app, optionName = 'user') {
    const user = await resolveUserOption(interaction, app, optionName);
    if (!user)
        return null;
    const member = await guild.members.fetch(user.id).catch(() => null);
    return { member, user };
}
function getOptionString(interaction, name) {
    return interaction.options.getString(name) ?? undefined;
}
function getOptionInt(interaction, name) {
    const v = interaction.options.getInteger(name);
    return v ?? undefined;
}
function getOptionBoolean(interaction, name) {
    const v = interaction.options.getBoolean(name);
    return v ?? undefined;
}
//# sourceMappingURL=discord.js.map
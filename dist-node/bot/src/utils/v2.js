"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildV2Content = buildV2Content;
exports.v2Send = v2Send;
exports.v2Reply = v2Reply;
const discord_js_1 = require("discord.js");
function buildV2Content(content, opts = {}) {
    const container = new discord_js_1.ContainerBuilder();
    if (opts.accentColor)
        container.setAccentColor(opts.accentColor);
    container.addTextDisplayComponents(new discord_js_1.TextDisplayBuilder().setContent(content));
    if (opts.buttons && opts.buttons.length > 0) {
        const row = new discord_js_1.ActionRowBuilder();
        for (const b of opts.buttons.slice(0, 5)) {
            row.addComponents(new discord_js_1.ButtonBuilder()
                .setCustomId(b.customId)
                .setLabel(b.label)
                .setStyle(b.style ?? discord_js_1.ButtonStyle.Secondary)
                .setDisabled(b.disabled ?? false));
        }
        container.addActionRowComponents(row);
    }
    if (opts.imageUrl) {
        container.addMediaGalleryComponents(new discord_js_1.MediaGalleryBuilder().addItems(new discord_js_1.MediaGalleryItemBuilder().setURL(opts.imageUrl)));
    }
    return { components: [container], flags: discord_js_1.MessageFlags.IsComponentsV2 };
}
function v2Send(channel, content, opts = {}) {
    const payload = buildV2Content(content, opts);
    return channel.send(payload);
}
async function v2Reply(interaction, content, opts = {}) {
    const payload = buildV2Content(content, opts);
    const flags = opts.ephemeral ? discord_js_1.MessageFlags.IsComponentsV2 | discord_js_1.MessageFlags.Ephemeral : discord_js_1.MessageFlags.IsComponentsV2;
    const body = { components: payload.components, flags };
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply(body);
    }
    else {
        await interaction.reply(body);
    }
}
//# sourceMappingURL=v2.js.map
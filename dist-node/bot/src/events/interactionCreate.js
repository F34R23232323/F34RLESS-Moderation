"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInteractionCreate = handleInteractionCreate;
const componentLoader_1 = require("../core/componentLoader");
const v2_1 = require("../utils/v2");
async function handleInteractionCreate(app, interaction) {
    try {
        if (interaction.isChatInputCommand()) {
            await handleSlash(app, interaction);
        }
        else if (interaction.isMessageContextMenuCommand()) {
            const cmd = app.messageCommands.get(interaction.commandName);
            if (cmd?.contextExecute)
                await cmd.contextExecute(interaction, app);
        }
        else if (interaction.isUserContextMenuCommand()) {
            const cmd = app.userCommands.get(interaction.commandName);
            if (cmd?.contextExecute)
                await cmd.contextExecute(interaction, app);
        }
        else if (interaction.isButton()) {
            await (0, componentLoader_1.dispatchComponent)(app, 'button', interaction);
        }
        else if (interaction.isStringSelectMenu()) {
            await (0, componentLoader_1.dispatchComponent)(app, 'select', interaction);
        }
        else if (interaction.isModalSubmit()) {
            await (0, componentLoader_1.dispatchComponent)(app, 'modal', interaction);
        }
    }
    catch (err) {
        app.logger.error('interactionCreate handler threw:', err);
        await app.logManager.reportError('interactionCreate', err);
    }
}
async function handleSlash(app, interaction) {
    const command = app.commands.get(interaction.commandName);
    if (!command)
        return;
    const cfg = app.config.commands[command.name];
    if (cfg && cfg.slash === false) {
        await (0, v2_1.v2Reply)(interaction, 'This command is disabled for slash.', { ephemeral: true });
        return;
    }
    const member = interaction.member;
    if (member && 'permissions' in member) {
        const guard = app.modGuard.hasRequiredPermissions(member, command);
        if (!guard.ok) {
            await (0, v2_1.v2Reply)(interaction, `You cannot use that command: ${guard.reason}`, { ephemeral: true });
            return;
        }
        if (command.ownerOnly && !app.modGuard.isOwner(interaction.user.id))
            return;
    }
    const cooldown = cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds;
    if (!app.cooldowns.tryConsume('cmd', interaction.user.id, command.name, cooldown)) {
        const remaining = app.cooldowns.remainingSeconds('cmd', interaction.user.id, command.name);
        await (0, v2_1.v2Reply)(interaction, `Slow down! Try again in ${remaining}s.`, { ephemeral: true });
        return;
    }
    const start = Date.now();
    try {
        await command.execute(interaction, app);
        app.metrics.incCommand(true);
    }
    catch (err) {
        app.metrics.incCommand(false);
        app.logger.error(`Slash command ${command.name} failed:`, err);
        await app.logManager.reportError(`Slash command ${command.name}`, err);
        await (0, v2_1.v2Reply)(interaction, 'An error occurred while running this command.', { ephemeral: true });
    }
    finally {
        await app.logManager.logCommandUsage({
            guildId: interaction.guildId,
            command: command.name,
            userId: interaction.user.id,
            surface: 'slash',
            success: true,
            durationMs: Date.now() - start,
        });
    }
}
exports.default = { name: 'interactionCreate', run: handleInteractionCreate };
//# sourceMappingURL=interactionCreate.js.map
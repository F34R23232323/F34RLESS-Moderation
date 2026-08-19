import type { Interaction } from 'discord.js';
import type { App } from '../core/context';
import { dispatchComponent } from '../core/componentLoader';
import { v2Reply } from '../utils/v2';

export async function handleInteractionCreate(app: App, interaction: Interaction): Promise<void> {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlash(app, interaction);
    } else if (interaction.isMessageContextMenuCommand()) {
      const cmd = app.messageCommands.get(interaction.commandName);
      if (cmd?.contextExecute) await cmd.contextExecute(interaction, app);
    } else if (interaction.isUserContextMenuCommand()) {
      const cmd = app.userCommands.get(interaction.commandName);
      if (cmd?.contextExecute) await cmd.contextExecute(interaction, app);
    } else if (interaction.isButton()) {
      await dispatchComponent(app, 'button', interaction);
    } else if (interaction.isStringSelectMenu()) {
      await dispatchComponent(app, 'select', interaction);
    } else if (interaction.isModalSubmit()) {
      await dispatchComponent(app, 'modal', interaction);
    }
  } catch (err) {
    app.logger.error('interactionCreate handler threw:', err);
    await app.logManager.reportError('interactionCreate', err);
  }
}

async function handleSlash(app: App, interaction: any): Promise<void> {
  const custom = app.config.custom_commands[interaction.commandName];
  const shadowsBuiltin =
    app.commands.has(interaction.commandName) ||
    app.messageCommands.has(interaction.commandName) ||
    app.userCommands.has(interaction.commandName);
  if (custom && custom.enabled && !shadowsBuiltin) {
    if (custom.slash === false) {
      await v2Reply(interaction, 'This command is disabled for slash.', { ephemeral: true });
      return;
    }
    await app.customCommands.runSlash(app, interaction, interaction.commandName);
    return;
  }

  const command = app.commands.get(interaction.commandName);
  if (!command) return;
  const cfg = app.config.commands[command.name];
  if (cfg && cfg.slash === false) {
    await v2Reply(interaction, 'This command is disabled for slash.', { ephemeral: true });
    return;
  }

  const member = interaction.member;
  if (member && 'permissions' in member) {
    const guard = app.modGuard.hasRequiredPermissions(member, command);
    if (!guard.ok) {
      await v2Reply(interaction, `You cannot use that command: ${guard.reason}`, { ephemeral: true });
      return;
    }
    if (command.ownerOnly && !app.modGuard.isOwner(interaction.user.id)) return;
  }

  const cooldown = cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds;
  if (!app.cooldowns.tryConsume('cmd', interaction.user.id, command.name, cooldown)) {
    const remaining = app.cooldowns.remainingSeconds('cmd', interaction.user.id, command.name);
    await v2Reply(interaction, `Slow down! Try again in ${remaining}s.`, { ephemeral: true });
    return;
  }

  const start = Date.now();
  try {
    await command.execute(interaction, app);
    app.metrics.incCommand(true);
  } catch (err) {
    app.metrics.incCommand(false);
    app.logger.error(`Slash command ${command.name} failed:`, err);
    await app.logManager.reportError(`Slash command ${command.name}`, err);
    await v2Reply(interaction, 'An error occurred while running this command.', { ephemeral: true });
  } finally {
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

export default { name: 'interactionCreate', run: handleInteractionCreate };
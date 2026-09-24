import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { emojiPrefix } from '../../emoji';

const data = new SlashCommandBuilder()
  .setName('antinuke')
  .setDescription('Configure the safety-first anti-nuke system')
  .addSubcommand((command) => command.setName('status').setDescription('Show anti-nuke status and safety gates'))
  .addSubcommand((command) => command.setName('health').setDescription('Show dependency and permission health'))
  .addSubcommand((command) => command.setName('enable').setDescription('Enable after setup (root owner only)').addBooleanOption((option) => option.setName('confirm').setDescription('Confirm this sensitive change').setRequired(true)))
  .addSubcommand((command) => command.setName('disable').setDescription('Disable enforcement (root owner only)').addBooleanOption((option) => option.setName('confirm').setDescription('Confirm this sensitive change').setRequired(true)))
  .addSubcommand((command) => command.setName('mode').setDescription('Set operating mode')
    .addStringOption((option) => option.setName('value').setDescription('Mode').setRequired(true)
      .addChoices({ name: 'Observe', value: 'observe' }, { name: 'Balanced', value: 'balanced' }, { name: 'Strict', value: 'strict' }, { name: 'Lockdown', value: 'lockdown' })))
  .addSubcommandGroup((group) => group.setName('setup').setDescription('Setup controls')
    .addSubcommand((command) => command.setName('start').setDescription('Create a safe setup preview'))
    .addSubcommand((command) => command.setName('validate').setDescription('Validate permissions and configuration'))
    .addSubcommand((command) => command.setName('finish').setDescription('Finish setup in dry-run mode').addBooleanOption((option) => option.setName('confirm').setDescription('Confirm setup completion').setRequired(true))))
  .addSubcommandGroup((group) => group.setName('apps').setDescription('External application security')
    .addSubcommand((command) => command.setName('status').setDescription('Show external-app security status'))
    .addSubcommand((command) => command.setName('review-mute-enable').setDescription('Enable Pending Review Quarantine (root owner)').addBooleanOption((option) => option.setName('confirm').setDescription('Confirm this sensitive change').setRequired(true)))
    .addSubcommand((command) => command.setName('review-mute-disable').setDescription('Disable Pending Review Quarantine (root owner)').addBooleanOption((option) => option.setName('confirm').setDescription('Confirm this sensitive change').setRequired(true))));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guild) { await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}This command is only available in a server.`, { ephemeral: true }); return; }
  const loaded = await app.antiNuke.getConfig(interaction.guild.id);
  const group = interaction.options.getSubcommandGroup(false);
  const subcommand = interaction.options.getSubcommand();
  const isRootOwner = interaction.user.id === interaction.guild.ownerId;
  const isExtraOwner = await app.db.query(
    'SELECT 1 FROM antinuke_owners WHERE guild_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1',
    [interaction.guild.id, interaction.user.id],
  ).then(([rows]) => Array.isArray(rows) && rows.length > 0);
  if (!isRootOwner && !isExtraOwner) { await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}Anti-nuke owner authorization is required. Discord Administrator alone is not sufficient.`, { ephemeral: true }); return; }

  if (subcommand === 'status' && !group) {
    const config = loaded.config;
    await v2Reply(interaction, `**${emojiPrefix('vyxia_shield')}Anti-Nuke Status**\n${emojiPrefix(config.enabled ? 'antinuke_tick1' : 'antinuke_cross1')}Enabled: ${config.enabled ? 'yes' : 'no'}\n${emojiPrefix('vyxia_settings')}Mode: ${config.operatingMode}\n${emojiPrefix(config.dryRun ? 'Warning' : 'antinuke_tick2')}Dry-run: ${config.dryRun ? 'yes' : 'no'}\n${emojiPrefix(config.automaticKickEnabled ? 'antinuke_tick1' : 'disabled')}Automatic kick: ${config.automaticKickEnabled ? 'enabled' : 'disabled'}\n${emojiPrefix(config.automaticBanEnabled ? 'antinuke_tick1' : 'disabled')}Automatic ban: ${config.automaticBanEnabled ? 'enabled' : 'disabled'}\n${emojiPrefix(config.pendingReviewMuteEnabled ? 'antinuke_tick1' : 'disabled')}Pending Review Quarantine: ${config.pendingReviewMuteEnabled ? 'enabled' : 'disabled'}\n${emojiPrefix('vyxiaID')}Config version: ${loaded.version}`, { ephemeral: true });
    return;
  }
  if (subcommand === 'health') {
    const me = interaction.guild.members.me;
    const audit = me?.permissions.has(PermissionFlagsBits.ViewAuditLog) ?? false;
    const manageRoles = me?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false;
    const quarantine = loaded.config.quarantineRoleId ? interaction.guild.roles.cache.get(loaded.config.quarantineRoleId) : null;
    await v2Reply(interaction, `**${emojiPrefix('vyxia_shield')}Anti-Nuke Health**\n${emojiPrefix(audit ? 'antinuke_tick1' : 'antinuke_cross1')}Audit-log access: ${audit ? 'ok' : 'missing — alert only'}\n${emojiPrefix(manageRoles ? 'antinuke_tick1' : 'antinuke_cross1')}Manage Roles: ${manageRoles ? 'ok' : 'missing — quarantine unavailable'}\n${emojiPrefix(quarantine ? 'antinuke_tick2' : 'Warning')}Quarantine role: ${quarantine ? 'configured' : 'not configured'}\n${emojiPrefix(process.env.REDIS_URL ? 'antinuke_tick2' : '37496alert')}Redis: ${process.env.REDIS_URL ? 'configured (runtime health checked)' : 'missing — alert only'}\n${emojiPrefix(loaded.config.setupCompletedAt ? 'setup_success' : 'gears')}Setup: ${loaded.config.setupCompletedAt ? 'complete' : 'incomplete'}`, { ephemeral: true });
    return;
  }
  if (group === 'apps' && subcommand === 'status') {
    await v2Reply(interaction, `**${emojiPrefix('vyxia_shield')}External App Security**\n${emojiPrefix(loaded.config.enabled ? 'antinuke_tick1' : 'antinuke_cross1')}Monitoring: ${loaded.config.enabled ? 'active' : 'inactive'}\n${emojiPrefix(loaded.config.pendingReviewMuteEnabled ? 'antinuke_tick2' : 'disabled')}Pending Review Quarantine: ${loaded.config.pendingReviewMuteEnabled ? 'enabled' : 'disabled'}\n${emojiPrefix('vyxia_info')}Required confidence: ${loaded.config.pendingReviewMinimumConfidence}%\n${emojiPrefix('Warning')}Unattributable bot/webhook activity is alert-only.`, { ephemeral: true });
    return;
  }
  if (['enable', 'disable', 'finish', 'review-mute-enable', 'review-mute-disable'].includes(subcommand) && !isRootOwner) {
    await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}Only the current Discord guild owner may perform this operation.`, { ephemeral: true }); return;
  }
  if (['enable', 'disable', 'finish', 'review-mute-enable', 'review-mute-disable'].includes(subcommand) && interaction.options.getBoolean('confirm') !== true) {
    await v2Reply(interaction, `${emojiPrefix('antinuke_cross2')}Confirmation was not accepted; no configuration changed.`, { ephemeral: true }); return;
  }
  const next = { ...loaded.config };
  let action = 'settings';
  if (subcommand === 'start' && group === 'setup') {
    await v2Reply(interaction, `**${emojiPrefix('gears')}Anti-Nuke Setup Preview**\n${emojiPrefix('Warning')}The system starts disabled and dry-run only. Configure private log channels and a permissionless quarantine role, then run \`/antinuke setup finish\`. Automatic kick, ban, and Pending Review Quarantine remain disabled.`, { ephemeral: true });
    return;
  } else if (subcommand === 'validate' && group === 'setup') {
    const ok = interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog) ?? false;
    await v2Reply(interaction, ok ? `${emojiPrefix('antinuke_tick1')}Core audit-log permission is available. Redis and database are checked at runtime.` : `${emojiPrefix('37496alert')}Missing View Audit Log. Enforcement will remain alert-only.`, { ephemeral: true });
    return;
  } else if (subcommand === 'finish' && group === 'setup') {
    next.setupCompletedAt = new Date().toISOString(); next.dryRun = true; next.dryRunEndsAt = new Date(Date.now() + 1_800_000).toISOString(); action = 'enable';
  } else if (subcommand === 'enable') { next.enabled = true; action = 'enable';
  } else if (subcommand === 'disable') { next.enabled = false; action = 'disable';
  } else if (subcommand === 'mode') { next.operatingMode = interaction.options.getString('value', true) as typeof next.operatingMode;
  } else if (subcommand === 'review-mute-enable') { next.pendingReviewMuteEnabled = true; action = 'pending_review_mute';
  } else if (subcommand === 'review-mute-disable') { next.pendingReviewMuteEnabled = false; action = 'pending_review_mute';
  } else { await v2Reply(interaction, `${emojiPrefix('antinuke_cross1')}Unsupported anti-nuke operation.`, { ephemeral: true }); return; }
  const saved = await app.antiNuke.updateConfig(interaction.guild, interaction.user.id, loaded.version, next, action);
  await v2Reply(interaction, `${emojiPrefix(action === 'disable' ? 'antinuke_cross2' : 'antinuke_tick1')}Anti-nuke configuration updated. Version ${saved.version}.`, { ephemeral: true });
}

const command: BotCommand = { name: 'antinuke', category: 'admin', description: 'Safety-first anti-nuke controls', data,
  permissions: [], aliases: [], guildOnly: true, execute };
export default command;

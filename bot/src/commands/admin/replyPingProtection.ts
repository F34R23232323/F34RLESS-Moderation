import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('reply-ping-protection')
  .setDescription('View reply ping protection status and manage the native AutoMod rule')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((s) =>
    s.setName('dashboard').setDescription('View reply ping protection settings'),
  )
  .addSubcommand((s) =>
    s.setName('setup-rule').setDescription('Create or re-sync the native AutoMod rule keywords'),
  )
  .addSubcommand((s) =>
    s.setName('remove-rule').setDescription('Delete the native AutoMod rule'),
  )
  .addSubcommand((s) =>
    s.setName('incidents').setDescription('View recent reply ping incidents'),
  );

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  if (!interaction.guild) {
    await v2Reply(interaction, 'This command can only be used in a server.', { ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  switch (sub) {
    case 'dashboard': return handleDashboard(interaction, app);
    case 'setup-rule': return handleSetupRule(interaction, app);
    case 'remove-rule': return handleRemoveRule(interaction, app);
    case 'incidents': return handleIncidents(interaction, app);
  }
}

async function handleDashboard(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const cfg = app.config.reply_ping_protection;

  const status = cfg.enabled ? '🟢 **Enabled**' : '🔴 **Disabled**';
  const ruleStatus = cfg.native_rule_id
    ? `✅ Linked (ID: \`${cfg.native_rule_id}\`)`
    : '❌ No rule ID configured in config.yml';

  const protUserLine = cfg.protected_users.length > 0
    ? cfg.protected_users.map((id) => `<@${id}>`).join(', ')
    : '_None_';
  const protRoleLine = cfg.protected_roles.length > 0
    ? cfg.protected_roles.map((id) => `<@&${id}>`).join(', ')
    : '_None_';
  const excUserLine = cfg.exempt_users.length > 0
    ? cfg.exempt_users.map((id) => `<@${id}>`).join(', ')
    : '_None_';
  const excRoleLine = cfg.exempt_roles.length > 0
    ? cfg.exempt_roles.map((id) => `<@&${id}>`).join(', ')
    : '_None_';
  const excChanLine = cfg.exempt_channels.length > 0
    ? cfg.exempt_channels.map((id) => `<#${id}>`).join(', ')
    : '_None_';

  const escLines = cfg.escalation.levels.length > 0
    ? cfg.escalation.levels.map((l) => `Level ${l.level}: ${l.violation_count} violations → **${l.action_type}**${l.action_duration ? ` (${l.action_duration})` : ''}`).join('\n')
    : '_No escalation levels configured_';

  const noticeChan = cfg.notice_channel_id ? `<#${cfg.notice_channel_id}>` : '_Same as triggered channel_';
  const logChan = cfg.log_channel_id ? `<#${cfg.log_channel_id}>` : '_Not set_';

  const container = new ContainerBuilder()
    .setAccentColor(cfg.enabled ? 0x57f287 : 0xed4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Reply Ping Protection Dashboard'),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Status:** ${status}\n**Native Rule:** ${ruleStatus}\n**Escalation:** ${cfg.escalation.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Window:** ${cfg.escalation.window_seconds}s`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Protected Users:** ${protUserLine}\n**Protected Roles:** ${protRoleLine}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Exempt Users:** ${excUserLine}\n**Exempt Roles:** ${excRoleLine}\n**Exempt Channels:** ${excChanLine}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Notice Channel:** ${noticeChan}\n**Log Channel:** ${logChan}\n**Notice Title:** ${cfg.notice_title}\n**Auto-delete:** ${cfg.notice_delete_after_seconds > 0 ? `${cfg.notice_delete_after_seconds}s` : 'Never'}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Escalation Ladder**\n${escLines}`),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('_All settings are managed in `config.yml` under `reply_ping_protection`._'),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rpp:dashboard:${interaction.guild!.id}`)
          .setPlaceholder('Select an action...')
          .addOptions(
            { label: 'Setup Native Rule', value: 'setup_rule', description: 'Create or re-sync the AutoMod rule' },
            { label: 'Remove Native Rule', value: 'remove_rule', description: 'Delete the AutoMod rule' },
            { label: 'View Incidents', value: 'incidents', description: 'Recent blocked reply pings' },
          ),
      ) as never,
    );

  await interaction.editReply({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  } as never);
}

async function handleSetupRule(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;
  const cfg = app.config.reply_ping_protection;

  if (!cfg.enabled) {
    await v2Reply(interaction, '❌ Reply ping protection is disabled. Enable it in `config.yml` first.', { ephemeral: true });
    return;
  }

  if (!cfg.native_rule_id) {
    await v2Reply(interaction, '❌ No `native_rule_id` configured. Set it in `config.yml` under `reply_ping_protection.native_rule_id`.', { ephemeral: true });
    return;
  }

  const ruleManager = new (await import('../../services/replyPingProtection/ruleManager')).ReplyPingRuleManager(app);

  const existing = cfg.native_rule_id;
  const info = await ruleManager.getRuleInfo(guild, existing);
  if (info.exists) {
            const syncResult = await ruleManager.syncRuleKeywords(guild, existing, cfg.protected_users, cfg.protected_roles);
            if (!syncResult.ok) {
              await v2Reply(interaction, `❌ Failed to sync keywords: ${syncResult.error}`, { ephemeral: true });
              return;
            }
            await v2Reply(interaction, `✅ Synced keywords for rule \`${existing}\`. ${cfg.protected_users.length} users, ${cfg.protected_roles.length} roles protected.`, { ephemeral: true });
    return;
  }

  await v2Reply(interaction, `❌ Rule \`${existing}\` not found on Discord. Create it manually in Server Settings > AutoMod, then re-run this command.`, { ephemeral: true });
}

async function handleRemoveRule(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guild = interaction.guild!;
  const cfg = app.config.reply_ping_protection;

  if (!cfg.native_rule_id) {
    await v2Reply(interaction, '❌ No `native_rule_id` configured.', { ephemeral: true });
    return;
  }

  const ruleManager = new (await import('../../services/replyPingProtection/ruleManager')).ReplyPingRuleManager(app);
  const result = await ruleManager.deleteRule(guild, cfg.native_rule_id);

  if (!result.ok) {
    await v2Reply(interaction, `❌ Failed to delete rule: ${result.error}`, { ephemeral: true });
    return;
  }

  await v2Reply(interaction, '✅ Native AutoMod rule deleted. Remove the `native_rule_id` from `config.yml` if you no longer need it.', { ephemeral: true });
}

async function handleIncidents(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const guildId = interaction.guild!.id;
  const incidents = await app.replyPingProtection.getRecentIncidents(guildId, undefined, 15);

  if (incidents.length === 0) {
    await v2Reply(interaction, 'No recent incidents.', { ephemeral: true });
    return;
  }

  const lines = incidents.map((inc: any) => {
    const action = inc.action_taken ? ` → **${inc.action_taken}**` : '';
    return `<@${inc.user_id}> in <#${inc.channel_id}> — ${inc.sanitized_content?.slice(0, 100) ?? 'N/A'}${action} • <t:${Math.floor(new Date(inc.created_at).getTime() / 1000)}:R>`;
  });

  const container = new ContainerBuilder()
    .setAccentColor(0xfee75c)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Recent Reply Ping Incidents'),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(lines.join('\n')),
    );

  await interaction.editReply({
    components: [container] as unknown[],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  } as never);
}

const command: BotCommand = {
  name: 'reply-ping-protection',
  category: 'admin',
  description: 'View reply ping protection status and manage the native AutoMod rule',
  data,
  permissions: [PermissionFlagsBits.ManageGuild],
  execute,
};

export default command;

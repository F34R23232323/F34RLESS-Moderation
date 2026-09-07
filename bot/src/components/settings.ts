import type { StringSelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle
} from 'discord.js';
import type { App } from '../core/context';
import { renderSettingsMenu } from '../commands/admin/settings';
import { emojiPrefix } from '../emoji';

function v2Ephemeral(text: string): { components: unknown[]; flags: number } {
  const container = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
  return { components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
}

export default [
  {
    type: 'select' as const,
    id: 'settings:menu:',
    async run(app: App, interaction: StringSelectMenuInteraction) {
      const parts = interaction.customId.split(':');
      const guildId = parts[2];
      if (!guildId || !interaction.guild) {
        await interaction.update({ components: [] });
        return;
      }
      
      const category = interaction.values[0];
      const guild = interaction.guild;
      
      let container = new ContainerBuilder().setAccentColor(0x5865f2);
      let rows: ActionRowBuilder<any>[] = [];
      
      if (category === 'general') {
        const override = app.config.bot.per_guild_prefixes[guild.id] ?? null;
        const currentPrefixes = override ?? app.config.bot.prefixes;
        
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ⚙️ General Settings'))
                 .addSeparatorComponents(new SeparatorBuilder())
                 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Current Prefixes:** ${currentPrefixes.map(p => `\`${p}\``).join(', ')}`));
                 
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`settings:btn:set_prefix:${guild.id}`).setLabel('Set Prefix').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`settings:btn:back:${guild.id}`).setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        ));
      } else if (category === 'antinuke') {
        const loaded = await app.antiNuke.getConfig(guild.id);
        const config = loaded.config;
        
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🛡️ Anti-Nuke Settings'))
                 .addSeparatorComponents(new SeparatorBuilder())
                 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Status:** ${config.enabled ? '🟢 Enabled' : '🔴 Disabled'}\n**Mode:** ${config.operatingMode}\n**Dry-run:** ${config.dryRun ? 'yes' : 'no'}\n**Pending Review Quarantine:** ${config.pendingReviewMuteEnabled ? 'Enabled' : 'Disabled'}`));
                 
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`settings:btn:an_toggle:${guild.id}`).setLabel(config.enabled ? 'Disable' : 'Enable').setStyle(config.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`settings:btn:an_mode:${guild.id}`).setLabel('Change Mode').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`settings:btn:back:${guild.id}`).setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        ));
      } else if (category === 'antiraid') {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🚨 Anti-Raid Settings'))
                 .addSeparatorComponents(new SeparatorBuilder())
                 .addTextDisplayComponents(new TextDisplayBuilder().setContent('Anti-raid mode allows you to lock down the server during a raid.'));
                 
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`settings:btn:ar_trigger:${guild.id}`).setLabel('Trigger Anti-Raid').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`settings:btn:ar_disarm:${guild.id}`).setLabel('Disarm Anti-Raid').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`settings:btn:back:${guild.id}`).setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        ));
      } else if (category === 'rpp') {
        const cfg = app.config.reply_ping_protection;
        const status = cfg.enabled ? '🟢 Enabled' : '🔴 Disabled';
        const ruleStatus = cfg.native_rule_id ? `✅ Linked (\`${cfg.native_rule_id}\`)` : '❌ Not Linked';
        
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# 🔔 Reply Ping Protection'))
                 .addSeparatorComponents(new SeparatorBuilder())
                 .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Status:** ${status}\n**Native Rule:** ${ruleStatus}`));
                 
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`settings:btn:rpp_setup:${guild.id}`).setLabel('Setup Native Rule').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`settings:btn:rpp_remove:${guild.id}`).setLabel('Remove Native Rule').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`settings:btn:back:${guild.id}`).setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        ));
      } else if (category === 'config') {
        container.addTextDisplayComponents(new TextDisplayBuilder().setContent('# ✅ Config Validation'))
                 .addSeparatorComponents(new SeparatorBuilder())
                 .addTextDisplayComponents(new TextDisplayBuilder().setContent('Click below to validate your `config.yml`.'));
                 
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`settings:btn:config_val:${guild.id}`).setLabel('Validate Config').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`settings:btn:back:${guild.id}`).setLabel('Back to Menu').setStyle(ButtonStyle.Secondary)
        ));
      } else {
        await interaction.update({ components: [] });
        return;
      }
      
      rows.forEach(r => container.addActionRowComponents(r as never));
      
      await interaction.update({
        components: [container] as unknown[],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      } as never);
    }
  },
  
  {
    type: 'button' as const,
    id: 'settings:btn:',
    async run(app: App, interaction: ButtonInteraction) {
      const parts = interaction.customId.split(':');
      const action = parts[2];
      const guildId = parts[3];
      
      if (!guildId || !interaction.guild) {
        await interaction.update({ components: [] });
        return;
      }
      
      const guild = interaction.guild;
      
      if (action === 'back') {
        await renderSettingsMenu(interaction, app, true);
        return;
      }
      
      if (action === 'set_prefix') {
        const modal = new ModalBuilder()
          .setCustomId(`settings:modal:prefix:${guild.id}`)
          .setTitle('Set Prefix')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('prefix_input')
                .setLabel('New Prefix')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      
      if (action === 'an_toggle') {
        await interaction.deferUpdate();
        const loaded = await app.antiNuke.getConfig(guild.id);
        const next = { ...loaded.config, enabled: !loaded.config.enabled };
        await app.antiNuke.updateConfig(guild, interaction.user.id, loaded.version, next, next.enabled ? 'enable' : 'disable');
        await interaction.editReply(v2Ephemeral(`Anti-nuke is now ${next.enabled ? 'enabled' : 'disabled'}.`) as never);
        return;
      }
      
      if (action === 'an_mode') {
        const modal = new ModalBuilder()
          .setCustomId(`settings:modal:an_mode:${guild.id}`)
          .setTitle('Change Anti-Nuke Mode')
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId('mode_input')
                .setLabel('Mode (observe/balanced/strict/lockdown)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        await interaction.showModal(modal);
        return;
      }
      
      if (action === 'ar_trigger') {
        await interaction.deferUpdate();
        await app.antiRaid.trigger(guild.id);
        await interaction.editReply(v2Ephemeral('Anti-raid mode triggered.') as never);
        return;
      }
      
      if (action === 'ar_disarm') {
        await interaction.deferUpdate();
        await app.db.execute("UPDATE gates SET state = 'verified' WHERE guild_id = ?", [guild.id]);
        await interaction.editReply(v2Ephemeral('Anti-raid mode disarmed.') as never);
        return;
      }
      
      if (action === 'rpp_setup') {
        await interaction.deferUpdate();
        const cfg = app.config.reply_ping_protection;
        if (!cfg.native_rule_id) {
          await interaction.editReply(v2Ephemeral('❌ No native_rule_id in config.yml.') as never);
          return;
        }
        const { ReplyPingRuleManager } = await import('../services/replyPingProtection/ruleManager');
        const rm = new ReplyPingRuleManager(app);
        const info = await rm.getRuleInfo(guild, cfg.native_rule_id);
        if (info.exists) {
          const res = await rm.syncRuleKeywords(guild, cfg.native_rule_id, cfg.protected_users, cfg.protected_roles);
          if (res.ok) await interaction.editReply(v2Ephemeral('✅ Synced keywords.') as never);
          else await interaction.editReply(v2Ephemeral(`❌ Failed: ${res.error}`) as never);
        } else {
          await interaction.editReply(v2Ephemeral('❌ Rule not found on Discord.') as never);
        }
        return;
      }
      
      if (action === 'rpp_remove') {
        await interaction.deferUpdate();
        const cfg = app.config.reply_ping_protection;
        if (!cfg.native_rule_id) {
          await interaction.editReply(v2Ephemeral('❌ No rule to remove.') as never);
          return;
        }
        const { ReplyPingRuleManager } = await import('../services/replyPingProtection/ruleManager');
        const rm = new ReplyPingRuleManager(app);
        const res = await rm.deleteRule(guild, cfg.native_rule_id);
        if (res.ok) await interaction.editReply(v2Ephemeral('✅ Rule deleted.') as never);
        else await interaction.editReply(v2Ephemeral(`❌ Failed: ${res.error}`) as never);
        return;
      }
      
      if (action === 'config_val') {
        await interaction.deferUpdate();
        const { loadConfig, formatConfigError } = await import('../../../shared/src/config/load');
        try {
          loadConfig({ configPath: app.configPath });
          await interaction.editReply(v2Ephemeral('✅ Config is valid.') as never);
        } catch (err) {
          await interaction.editReply(v2Ephemeral(`❌ Config invalid:\n\`\`\`\n${formatConfigError(err)}\n\`\`\``) as never);
        }
        return;
      }
      
      await interaction.deferUpdate();
    }
  },
  
  {
    type: 'modal' as const,
    id: 'settings:modal:',
    async run(app: App, interaction: ModalSubmitInteraction) {
      const parts = interaction.customId.split(':');
      const action = parts[2];
      const guildId = parts[3];
      
      if (!guildId || !interaction.guild) {
        await interaction.reply(v2Ephemeral('Guild not found.') as never);
        return;
      }
      
      const guild = interaction.guild;
      
      if (action === 'prefix') {
        const newPrefix = interaction.fields.getTextInputValue('prefix_input');
        await app.db.execute(
          `INSERT INTO custom_config (guild_id, key_name, value) VALUES (?, 'prefix', ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value)`,
          [guild.id, JSON.stringify({ prefixes: [newPrefix] })]
        );
        app.config.bot.per_guild_prefixes[guild.id] = [newPrefix];
        await interaction.reply(v2Ephemeral(`✅ Prefix set to \`${newPrefix}\``) as never);
      } else if (action === 'an_mode') {
        const mode = interaction.fields.getTextInputValue('mode_input').toLowerCase();
        if (!['observe', 'balanced', 'strict', 'lockdown'].includes(mode)) {
          await interaction.reply(v2Ephemeral('❌ Invalid mode. Must be observe, balanced, strict, or lockdown.') as never);
          return;
        }
        const loaded = await app.antiNuke.getConfig(guild.id);
        const next = { ...loaded.config, operatingMode: mode as any };
        await app.antiNuke.updateConfig(guild, interaction.user.id, loaded.version, next, 'settings');
        await interaction.reply(v2Ephemeral(`✅ Anti-nuke mode changed to \`${mode}\``) as never);
      }
    }
  }
];

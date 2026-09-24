import type { StringSelectMenuInteraction } from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import type { App } from '../core/context';

export default [
  {
    type: 'select' as const,
    id: 'rpp:dashboard:',
    async run(app: App, interaction: StringSelectMenuInteraction): Promise<void> {
      const parts = interaction.customId.split(':');
      const guildId = parts[2];
      if (!guildId) {
        await interaction.update({ components: [] });
        return;
      }

      const value = interaction.values[0];
      if (!value) {
        await interaction.update({ components: [] });
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.update({ content: 'Guild not found.', components: [] });
        return;
      }

      const cfg = app.config.reply_ping_protection;

      switch (value) {
        case 'setup_rule': {
          await interaction.deferUpdate();
          if (!cfg.native_rule_id) {
            await interaction.editReply({ content: '❌ No `native_rule_id` configured in config.yml.', components: [] });
            return;
          }
          const { ReplyPingRuleManager } = await import('../services/replyPingProtection/ruleManager');
          const ruleManager = new ReplyPingRuleManager(app);
          const info = await ruleManager.getRuleInfo(guild, cfg.native_rule_id);
          if (info.exists) {
            const syncResult = await ruleManager.syncRuleKeywords(guild, cfg.native_rule_id, cfg.protected_users, cfg.protected_roles);
            if (syncResult.ok) {
              await interaction.editReply({ content: `✅ Synced keywords for rule \`${cfg.native_rule_id}\`.`, components: [] });
            } else {
              await interaction.editReply({ content: `❌ Sync failed: ${syncResult.error}`, components: [] });
            }
          } else {
            await interaction.editReply({ content: `❌ Rule \`${cfg.native_rule_id}\` not found on Discord.`, components: [] });
          }
          break;
        }
        case 'remove_rule': {
          await interaction.deferUpdate();
          if (!cfg.native_rule_id) {
            await interaction.editReply({ content: 'No rule ID configured.', components: [] });
            return;
          }
          const { ReplyPingRuleManager: RM } = await import('../services/replyPingProtection/ruleManager');
          const rm = new RM(app);
          const res = await rm.deleteRule(guild, cfg.native_rule_id);
          if (res.ok) {
            await interaction.editReply({ content: '✅ Rule deleted.', components: [] });
          } else {
            await interaction.editReply({ content: `❌ Failed: ${res.error}`, components: [] });
          }
          break;
        }
        case 'incidents': {
          await interaction.deferUpdate();
          const incidents = await app.replyPingProtection.getRecentIncidents(guildId, undefined, 15);
          if (incidents.length === 0) {
            await interaction.editReply({ content: 'No recent incidents.', components: [] });
            return;
          }
          const lines = incidents.map((inc: any) => {
            const action = inc.action_taken ? ` → **${inc.action_taken}**` : '';
            return `<@${inc.user_id}> in <#${inc.channel_id}> — ${inc.sanitized_content?.slice(0, 100) ?? 'N/A'}${action} • <t:${Math.floor(new Date(inc.created_at).getTime() / 1000)}:R>`;
          });
          const container = new ContainerBuilder()
            .setAccentColor(0xfee75c)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Recent Incidents'))
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join('\n')));
          await interaction.editReply({
            components: [container] as unknown[],
            flags: MessageFlags.IsComponentsV2,
          } as never);
          break;
        }
        default:
          await interaction.update({ components: [] });
          break;
      }
    },
  },
];

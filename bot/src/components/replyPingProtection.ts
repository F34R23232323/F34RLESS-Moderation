import type { StringSelectMenuInteraction } from 'discord.js';
import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MessageFlags,
} from 'discord.js';
import type { App } from '../core/context';
import { v2Result } from '../utils/v2';

export default [
  {
    type: 'select' as const,
    id: 'rpp:dashboard:',
    async run(app: App, interaction: StringSelectMenuInteraction): Promise<void> {
      const parts = interaction.customId.split(':');
      const guildId = parts[2];
      if (!guildId) {
        await interaction.deferUpdate();
        return;
      }

      const value = interaction.values[0];
      if (!value) {
        await interaction.deferUpdate();
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.update(v2Result('Guild not found.', 0xed4245) as never);
        return;
      }

      const cfg = app.config.reply_ping_protection;

      switch (value) {
        case 'setup_rule': {
          await interaction.deferUpdate();
          if (!cfg.native_rule_id) {
            await interaction.editReply(v2Result('❌ No `native_rule_id` configured in config.yml.', 0xed4245) as never);
            return;
          }
          const { ReplyPingRuleManager } = await import('../services/replyPingProtection/ruleManager');
          const ruleManager = new ReplyPingRuleManager(app);
          const info = await ruleManager.getRuleInfo(guild, cfg.native_rule_id);
          if (info.exists) {
            const syncResult = await ruleManager.syncRuleKeywords(guild, cfg.native_rule_id, cfg.protected_users, cfg.protected_roles);
            if (syncResult.ok) {
              await interaction.editReply(v2Result(`✅ Synced keywords for rule \`${cfg.native_rule_id}\`.`, 0x57f287) as never);
            } else {
              await interaction.editReply(v2Result(`❌ Sync failed: ${syncResult.error}`, 0xed4245) as never);
            }
          } else {
            await interaction.editReply(v2Result(`❌ Rule \`${cfg.native_rule_id}\` not found on Discord.`, 0xed4245) as never);
          }
          break;
        }
        case 'remove_rule': {
          await interaction.deferUpdate();
          if (!cfg.native_rule_id) {
            await interaction.editReply(v2Result('No rule ID configured.', 0xed4245) as never);
            return;
          }
          const { ReplyPingRuleManager: RM } = await import('../services/replyPingProtection/ruleManager');
          const rm = new RM(app);
          const res = await rm.deleteRule(guild, cfg.native_rule_id);
          if (res.ok) {
            await interaction.editReply(v2Result('✅ Rule deleted.', 0x57f287) as never);
          } else {
            await interaction.editReply(v2Result(`❌ Failed: ${res.error}`, 0xed4245) as never);
          }
          break;
        }
        case 'incidents': {
          await interaction.deferUpdate();
          const incidents = await app.replyPingProtection.getRecentIncidents(guildId, undefined, 15);
          if (incidents.length === 0) {
            await interaction.editReply(v2Result('No recent incidents.', 0x80848e) as never);
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
          await interaction.deferUpdate();
          break;
      }
    },
  },
];

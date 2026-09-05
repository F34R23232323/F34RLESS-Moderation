import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  Guild,
} from 'discord.js';
import type { App } from '../../core/context';

export interface RuleSyncResult {
  ruleId: string;
  created: boolean;
  error?: string;
}

export class ReplyPingRuleManager {
  private readonly app: App;

  constructor(app: App) {
    this.app = app;
  }

  async createRule(
    guild: Guild,
    name: string = 'Reply Ping Protection',
  ): Promise<RuleSyncResult> {
    try {
      const rule = await guild.autoModerationRules.create({
        name,
        eventType: AutoModerationRuleEventType.MessageSend,
        triggerType: AutoModerationRuleTriggerType.Keyword,
        triggerMetadata: {
          keywordFilter: ['*'],
        },
        actions: [
          {
            type: AutoModerationActionType.BlockMessage,
            metadata: { customMessage: null },
          },
        ],
        enabled: false,
        reason: 'Reply Ping Protection - auto-created by bot',
      });

      return { ruleId: rule.id, created: true };
    } catch (err) {
      this.app.logger.error(`Failed to create AutoMod rule for guild ${guild.id}:`, err);
      return { ruleId: '', created: false, error: (err as Error).message };
    }
  }

  async syncRuleKeywords(guild: Guild, ruleId: string, protectedUserIds: string[], protectedRoleIds: string[]): Promise<{ ok: boolean; error?: string }> {
    try {
      const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
      if (!rule) return { ok: false, error: 'rule_not_found' };

      const keywords: string[] = [];
      for (const userId of protectedUserIds) {
        keywords.push(`<@${userId}>`);
        keywords.push(`<@!${userId}>`);
      }
      for (const roleId of protectedRoleIds) {
        keywords.push(`<@&${roleId}>`);
      }

      if (keywords.length === 0) {
        keywords.push('__REPLY_PING_NO_PROTECTED__');
      }

      await rule.edit({
        triggerMetadata: {
          keywordFilter: keywords,
        },
        reason: 'Reply Ping Protection - keywords synced',
      });

      return { ok: true };
    } catch (err) {
      this.app.logger.error(`Failed to sync AutoMod rule ${ruleId}:`, err);
      return { ok: false, error: (err as Error).message };
    }
  }

  async enableRule(guild: Guild, ruleId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
      if (!rule) return { ok: false, error: 'rule_not_found' };
      await rule.edit({ enabled: true, reason: 'Reply Ping Protection - enabled' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async disableRule(guild: Guild, ruleId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
      if (!rule) return { ok: false, error: 'rule_not_found' };
      await rule.edit({ enabled: false, reason: 'Reply Ping Protection - disabled' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async deleteRule(guild: Guild, ruleId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
      if (!rule) return { ok: false, error: 'rule_not_found' };
      await rule.delete('Reply Ping Protection - removed by bot');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async getRuleInfo(guild: Guild, ruleId: string): Promise<{
    exists: boolean;
    name?: string;
    enabled?: boolean;
    triggerType?: number;
    actionType?: number;
    keywords?: string[];
    error?: string;
  }> {
    try {
      const rule = await guild.autoModerationRules.fetch(ruleId).catch(() => null);
      if (!rule) return { exists: false };
      return {
        exists: true,
        name: rule.name,
        enabled: rule.enabled,
        triggerType: rule.triggerType,
        actionType: rule.actions[0]?.type,
        keywords: [...(rule.triggerMetadata?.keywordFilter ?? [])],
      };
    } catch (err) {
      return { exists: false, error: (err as Error).message };
    }
  }

  async listRules(guild: Guild): Promise<Array<{ id: string; name: string; enabled: boolean }>> {
    try {
      const rules = await guild.autoModerationRules.fetch();
      return rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled }));
    } catch {
      return [];
    }
  }
}

import { AuditLogEvent } from 'discord.js';
import type { EnforcementAction, ProtectionPolicy, SecurityEventType } from '../types/domain';

export interface ProtectionDefinition {
  readonly type: SecurityEventType;
  readonly auditActions: readonly AuditLogEvent[];
  readonly reliableAttribution: boolean;
  readonly defaultPolicy: ProtectionPolicy;
  readonly limitations: string;
}

function policy(type: SecurityEventType, action: EnforcementAction = 'quarantine', monitorOnly = false): ProtectionPolicy {
  return { type, enabled: true, eventWeight: 10, countLimit: 3, windowMs: 10_000, warningThreshold: 1,
    quarantineThreshold: 3, kickThreshold: null, banThreshold: null, cooldownMs: 30_000,
    minimumConfidence: 100, defaultAction: action, monitorOnly };
}

const definitions = [
  ['channel_create', [AuditLogEvent.ChannelCreate], true, 'Direct target match'],
  ['channel_delete', [AuditLogEvent.ChannelDelete], true, 'Direct target match'],
  ['channel_update', [AuditLogEvent.ChannelUpdate], true, 'Changes are risk-scored; cosmetic changes are low risk'],
  ['channel_overwrite_create', [AuditLogEvent.ChannelOverwriteCreate], true, 'Audit extra data varies by Discord payload'],
  ['channel_overwrite_update', [AuditLogEvent.ChannelOverwriteUpdate], true, 'Audit extra data varies by Discord payload'],
  ['channel_overwrite_delete', [AuditLogEvent.ChannelOverwriteDelete], true, 'Audit extra data varies by Discord payload'],
  ['role_create', [AuditLogEvent.RoleCreate], true, 'Direct target match'],
  ['role_delete', [AuditLogEvent.RoleDelete], true, 'Direct target match'],
  ['role_update', [AuditLogEvent.RoleUpdate], true, 'Permission deltas receive higher weight'],
  ['member_role_update', [AuditLogEvent.MemberRoleUpdate], true, 'Member target match; changed role verified from changes'],
  ['member_ban', [AuditLogEvent.MemberBanAdd], true, 'Direct member target match'],
  ['member_kick', [AuditLogEvent.MemberKick], true, 'Member-remove is ambiguous until matching audit evidence appears'],
  ['member_prune', [AuditLogEvent.MemberPrune], false, 'Aggregate audit action has no reliable individual gateway target'],
  ['member_timeout', [AuditLogEvent.MemberUpdate], true, 'Timeout change must be present in audit changes'],
  ['bot_add', [AuditLogEvent.BotAdd], true, 'Inviter is used only when the BotAdd entry uniquely matches'],
  ['webhook_create', [AuditLogEvent.WebhookCreate], true, 'Creator may be absent for system-managed webhooks'],
  ['webhook_update', [AuditLogEvent.WebhookUpdate], true, 'Creator may be absent for system-managed webhooks'],
  ['webhook_delete', [AuditLogEvent.WebhookDelete], true, 'Creator may be absent for system-managed webhooks'],
  ['emoji_create', [AuditLogEvent.EmojiCreate], true, 'Direct target match'],
  ['emoji_update', [AuditLogEvent.EmojiUpdate], true, 'Direct target match'],
  ['emoji_delete', [AuditLogEvent.EmojiDelete], true, 'Direct target match'],
  ['sticker_create', [AuditLogEvent.StickerCreate], true, 'Direct target match'],
  ['sticker_update', [AuditLogEvent.StickerUpdate], true, 'Direct target match'],
  ['sticker_delete', [AuditLogEvent.StickerDelete], true, 'Direct target match'],
  ['scheduled_event_create', [AuditLogEvent.GuildScheduledEventCreate], true, 'Direct target match'],
  ['scheduled_event_update', [AuditLogEvent.GuildScheduledEventUpdate], true, 'Direct target match'],
  ['scheduled_event_delete', [AuditLogEvent.GuildScheduledEventDelete], true, 'Direct target match'],
  ['thread_create', [AuditLogEvent.ThreadCreate], true, 'Direct target match when audit entry is emitted'],
  ['thread_update', [AuditLogEvent.ThreadUpdate], true, 'Direct target match when audit entry is emitted'],
  ['thread_delete', [AuditLogEvent.ThreadDelete], true, 'Direct target match when audit entry is emitted'],
  ['stage_create', [AuditLogEvent.StageInstanceCreate], true, 'Direct target match'],
  ['stage_update', [AuditLogEvent.StageInstanceUpdate], true, 'Direct target match'],
  ['stage_delete', [AuditLogEvent.StageInstanceDelete], true, 'Direct target match'],
  ['invite_create', [AuditLogEvent.InviteCreate], true, 'Invite code is matched as target identity'],
  ['invite_delete', [AuditLogEvent.InviteDelete], true, 'Invite code is matched as target identity'],
  ['integration_create', [AuditLogEvent.IntegrationCreate], false, 'Some integrations omit a human executor'],
  ['integration_update', [AuditLogEvent.IntegrationUpdate], false, 'Some integrations omit a human executor'],
  ['integration_delete', [AuditLogEvent.IntegrationDelete], false, 'Some integrations omit a human executor'],
  ['automod_rule_create', [AuditLogEvent.AutoModerationRuleCreate], true, 'Direct target match'],
  ['automod_rule_update', [AuditLogEvent.AutoModerationRuleUpdate], true, 'Direct target match'],
  ['automod_rule_delete', [AuditLogEvent.AutoModerationRuleDelete], true, 'Direct target match'],
  ['guild_update', [AuditLogEvent.GuildUpdate], true, 'Audit changes determine the affected guild setting'],
] satisfies readonly [SecurityEventType, readonly AuditLogEvent[], boolean, string][];

export const protectionRegistry = new Map<SecurityEventType, ProtectionDefinition>(definitions.map(([type, auditActions, reliableAttribution, limitations]) => [type, {
  type, auditActions, reliableAttribution, limitations, defaultPolicy: policy(type, reliableAttribution ? 'quarantine' : 'alert', !reliableAttribution),
}]));

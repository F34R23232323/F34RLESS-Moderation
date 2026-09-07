export type SecurityEventType =
  | 'channel_create' | 'channel_delete' | 'channel_update' | 'channel_overwrite_create'
  | 'channel_overwrite_update' | 'channel_overwrite_delete' | 'role_create' | 'role_delete'
  | 'role_update' | 'member_role_update' | 'member_ban' | 'member_kick' | 'member_prune'
  | 'member_timeout' | 'voice_disconnect' | 'bot_add' | 'webhook_create' | 'webhook_update'
  | 'webhook_delete' | 'emoji_create' | 'emoji_update' | 'emoji_delete' | 'sticker_create'
  | 'sticker_update' | 'sticker_delete' | 'scheduled_event_create' | 'scheduled_event_update'
  | 'scheduled_event_delete' | 'thread_create' | 'thread_update' | 'thread_delete'
  | 'stage_create' | 'stage_update' | 'stage_delete' | 'invite_create' | 'invite_delete'
  | 'integration_create' | 'integration_update' | 'integration_delete' | 'automod_rule_create'
  | 'automod_rule_update' | 'automod_rule_delete' | 'guild_update' | 'soundboard_update'
  | 'unauthorized_bulk_moderation' | 'owner_command_failure' | 'external_app_observation';

export type TargetType = 'channel' | 'role' | 'member' | 'bot' | 'webhook' | 'integration' |
  'invite' | 'emoji' | 'sticker' | 'thread' | 'stage' | 'scheduled_event' | 'automod_rule' |
  'guild' | 'application' | 'unknown';

export interface SecurityEvent {
  readonly eventId: string;
  readonly guildId: string;
  readonly type: SecurityEventType;
  readonly targetType: TargetType;
  readonly targetId: string;
  readonly observedAtMs: number;
  readonly shardId: number | null;
  readonly gatewaySequence: number | null;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly actorHints?: readonly string[];
  readonly recoveryGenerated?: boolean;
}

export interface AuditEvidence {
  readonly auditEntryId: string;
  readonly action: number;
  readonly targetId: string;
  readonly executorId: string;
  readonly createdAtMs: number;
  readonly ageMs: number;
  readonly authoritative: true;
  readonly changes: readonly Readonly<Record<string, unknown>>[];
}

export type AttributionResult =
  | { readonly status: 'confirmed'; readonly executorId: string; readonly confidence: 100; readonly evidence: AuditEvidence }
  | { readonly status: 'trusted'; readonly executorId: string; readonly confidence: 100; readonly evidence: AuditEvidence; readonly reason: string }
  | { readonly status: 'ambiguous'; readonly reason: string; readonly candidates: readonly AuditEvidence[] }
  | { readonly status: 'unresolved'; readonly reason: string; readonly candidates: readonly AuditEvidence[] }
  | { readonly status: 'expired'; readonly reason: string; readonly candidates: readonly AuditEvidence[] };

export type TrustDecision =
  | { readonly trusted: true; readonly reason: 'root_owner' | 'extra_owner' | 'self' | 'approved_integration' | 'scoped_whitelist' | 'maintenance' }
  | { readonly trusted: false; readonly reason: 'not_trusted' | 'expired' | 'out_of_scope' };

export type EnforcementAction = 'alert' | 'restrict_commands' | 'quarantine' | 'remove_dangerous_roles' | 'timeout' | 'kick' | 'ban';
export type SecurityMode = 'observe' | 'balanced' | 'strict' | 'lockdown';

export interface ThresholdDecision {
  readonly crossed: boolean;
  readonly count: number;
  readonly weightedCount: number;
  readonly limit: number;
  readonly windowMs: number;
  readonly reason: 'crossed' | 'below_threshold' | 'duplicate' | 'dependency_unavailable' | 'cooldown';
  readonly diagnostic?: string;
}

export interface RiskDecision {
  readonly score: number;
  readonly threshold: number;
  readonly crossed: boolean;
  readonly contributors: readonly SecurityEventType[];
}

export interface ProposedEnforcement {
  readonly action: EnforcementAction;
  readonly executorId: string;
  readonly reason: string;
  readonly evidence: AuditEvidence;
  readonly threshold: ThresholdDecision;
  readonly risk: RiskDecision;
}

export type EnforcementDecision =
  | { readonly allowed: true; readonly proposal: ProposedEnforcement }
  | { readonly allowed: false; readonly reason: string };

export interface EnforcementResult {
  readonly action: EnforcementAction;
  readonly targetId: string;
  readonly status: 'succeeded' | 'failed' | 'suppressed' | 'already_applied' | 'dry_run';
  readonly details: Readonly<Record<string, unknown>>;
}

export type IncidentStatus = 'observed' | 'unresolved' | 'open' | 'contained' | 'resolved' | 'false_positive' | 'enforcement_failed';
export type ExternalAppCaseStatus = 'observed' | 'awaiting_evidence' | 'alert_only' |
  'quarantined_pending_review' | 'confirmed_keep_quarantined' | 'released' | 'false_positive' |
  'expired_auto_released' | 'enforcement_failed' | 'appealed' | 'closed';

export interface ProtectionPolicy {
  readonly type: SecurityEventType;
  readonly enabled: boolean;
  readonly eventWeight: number;
  readonly countLimit: number;
  readonly windowMs: number;
  readonly warningThreshold: number;
  readonly quarantineThreshold: number;
  readonly kickThreshold: number | null;
  readonly banThreshold: number | null;
  readonly cooldownMs: number;
  readonly minimumConfidence: 100;
  readonly defaultAction: EnforcementAction;
  readonly monitorOnly: boolean;
}

export interface MaintenanceScope {
  readonly users: readonly string[];
  readonly roles: readonly string[];
  readonly channels: readonly string[];
  readonly apps: readonly string[];
  readonly actions: readonly SecurityEventType[];
}

export interface WhitelistScope {
  readonly guildId: string;
  readonly entityType: 'user' | 'role' | 'bot' | 'app' | 'integration' | 'webhook' | 'channel';
  readonly entityId: string;
  readonly actions: readonly SecurityEventType[];
  readonly expiresAtMs: number | null;
}

export interface RecoveryPlan {
  readonly id: string;
  readonly guildId: string;
  readonly incidentId: string;
  readonly dryRun: true;
  readonly items: readonly { snapshotId: string; resourceType: TargetType; operation: 'recreate' | 'restore' | 'skip'; reason: string }[];
}

export type ExternalAppClassification = 'approved' | 'approved_out_of_scope' | 'unknown' |
  'suspicious' | 'confirmed_prohibited' | 'system_managed' | 'attribution_unavailable';

import type { AntiNukeConfig } from '../schemas/config';
import type { AttributionResult, EnforcementDecision, ProposedEnforcement, TrustDecision } from '../types/domain';

export interface FinalSafetyContext {
  readonly config: AntiNukeConfig;
  readonly attribution: AttributionResult;
  readonly trust: TrustDecision;
  readonly proposal: ProposedEnforcement | null;
  readonly databaseAvailable: boolean;
  readonly redisAvailable: boolean;
  readonly auditLogAvailable: boolean;
  readonly warmupComplete: boolean;
  readonly incidentAlreadyHandled: boolean;
  readonly currentGuildOwnerId: string;
  readonly botUserId: string;
}

export function evaluateFinalSafety(context: FinalSafetyContext): EnforcementDecision {
  if (!context.config.enabled || !context.config.setupCompletedAt) return { allowed: false, reason: 'system_not_enabled' };
  if (context.config.dryRun) return { allowed: false, reason: 'dry_run' };
  if (!context.databaseAvailable || !context.redisAvailable || !context.auditLogAvailable) return { allowed: false, reason: 'dependency_unavailable_alert_only' };
  if (!context.warmupComplete) return { allowed: false, reason: 'startup_warmup' };
  if (context.incidentAlreadyHandled) return { allowed: false, reason: 'incident_already_handled' };
  if (context.attribution.status !== 'confirmed') return { allowed: false, reason: `attribution_${context.attribution.status}` };
  if (context.trust.trusted) return { allowed: false, reason: `protected_${context.trust.reason}` };
  if (!context.proposal) return { allowed: false, reason: 'no_proposed_action' };
  if (context.proposal.executorId !== context.attribution.executorId) return { allowed: false, reason: 'executor_changed' };
  if (context.proposal.executorId === context.currentGuildOwnerId || context.proposal.executorId === context.botUserId) return { allowed: false, reason: 'protected_identity' };
  if (!context.proposal.threshold.crossed) return { allowed: false, reason: 'threshold_not_crossed' };
  if (context.proposal.evidence.auditEntryId !== context.attribution.evidence.auditEntryId) return { allowed: false, reason: 'evidence_changed' };
  if (context.proposal.action === 'ban' && !context.config.automaticBanEnabled) return { allowed: false, reason: 'automatic_ban_disabled' };
  if (context.proposal.action === 'kick' && !context.config.automaticKickEnabled) return { allowed: false, reason: 'automatic_kick_disabled' };
  return { allowed: true, proposal: context.proposal };
}

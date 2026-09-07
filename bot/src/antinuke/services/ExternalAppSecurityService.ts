import type { AntiNukeConfig } from '../schemas/config';
import type { AttributionResult, ExternalAppClassification } from '../types/domain';

export interface ExternalAppObservation {
  readonly humanAttribution: AttributionResult;
  readonly approved: boolean;
  readonly withinApprovedScope: boolean;
  readonly prohibitedRuleMatched: boolean;
  readonly entityIsSystemManaged: boolean;
}

export interface ExternalAppDecision {
  readonly classification: ExternalAppClassification;
  readonly createCase: boolean;
  readonly quarantineHuman: boolean;
  readonly reason: string;
}

export class ExternalAppSecurityService {
  public decide(observation: ExternalAppObservation, config: AntiNukeConfig): ExternalAppDecision {
    if (observation.entityIsSystemManaged) return { classification: 'system_managed', createCase: false, quarantineHuman: false, reason: 'Discord-managed entity' };
    if (observation.approved && observation.withinApprovedScope) return { classification: 'approved', createCase: false, quarantineHuman: false, reason: 'Approved within scope' };
    if (observation.approved) return { classification: 'approved_out_of_scope', createCase: true, quarantineHuman: false, reason: 'Approval does not cover this action' };
    if (observation.humanAttribution.status !== 'confirmed') return { classification: 'attribution_unavailable', createCase: true, quarantineHuman: false, reason: 'No unique authoritative human attribution' };
    if (!observation.prohibitedRuleMatched) return { classification: 'unknown', createCase: true, quarantineHuman: false, reason: 'Observed but no prohibited rule matched' };
    const quarantineHuman = config.pendingReviewMuteEnabled && config.pendingReviewMinimumConfidence === 100;
    return { classification: 'confirmed_prohibited', createCase: true, quarantineHuman, reason: quarantineHuman ? 'Root-owner enabled pending review quarantine' : 'Pending review quarantine is disabled' };
  }
}

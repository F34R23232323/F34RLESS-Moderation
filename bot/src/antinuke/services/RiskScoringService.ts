import type { RiskDecision, SecurityEvent, ThresholdDecision } from '../types/domain';

export class RiskScoringService {
  public calculate(event: SecurityEvent, threshold: ThresholdDecision, combinedThreshold = 30): RiskDecision {
    const permissionDelta = Array.isArray(event.after?.dangerousPermissionsAdded) ? event.after.dangerousPermissionsAdded.length * 10 : 0;
    const score = Math.max(0, threshold.weightedCount + permissionDelta);
    return { score, threshold: combinedThreshold, crossed: score >= combinedThreshold, contributors: [event.type] };
  }
}

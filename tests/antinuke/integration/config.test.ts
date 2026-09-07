import { describe, expect, it } from 'vitest';
import { antiNukeConfigSchema, balancedAntiNukeConfig } from '../../../bot/src/antinuke/schemas/config';

describe('configuration boundaries', () => {
  it('ships enforcement disabled and dry-run enabled', () => {
    expect(balancedAntiNukeConfig.enabled).toBe(false);
    expect(balancedAntiNukeConfig.dryRun).toBe(true);
    expect(balancedAntiNukeConfig.automaticKickEnabled).toBe(false);
    expect(balancedAntiNukeConfig.automaticBanEnabled).toBe(false);
    expect(balancedAntiNukeConfig.pendingReviewMuteEnabled).toBe(false);
  });
  it('rejects unsafe confidence, duration, snowflake, timezone, and unknown fields', () => {
    expect(() => antiNukeConfigSchema.parse({ minimumConfidence: 99 })).toThrow();
    expect(() => antiNukeConfigSchema.parse({ startupWarmupSeconds: 0 })).toThrow();
    expect(() => antiNukeConfigSchema.parse({ reviewerRoleId: 'everyone' })).toThrow();
    expect(() => antiNukeConfigSchema.parse({ timezone: 'Not/AZone' })).toThrow();
    expect(() => antiNukeConfigSchema.parse({ hiddenUnsafeSwitch: true })).toThrow();
  });
});

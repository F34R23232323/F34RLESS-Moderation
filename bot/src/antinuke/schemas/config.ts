import { z } from 'zod';

const snowflake = z.string().regex(/^\d{17,20}$/);
const nullableSnowflake = snowflake.nullable();

export const antiNukeConfigSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  enabled: z.boolean().default(false),
  setupCompletedAt: z.string().datetime().nullable().default(null),
  operatingMode: z.enum(['observe', 'balanced', 'strict', 'lockdown']).default('observe'),
  dryRun: z.boolean().default(true),
  dryRunEndsAt: z.string().datetime().nullable().default(null),
  startupWarmupSeconds: z.number().int().min(60).max(3600).default(60),
  auditCorrelationWindowMs: z.number().int().min(5_000).max(30_000).default(15_000),
  auditRetryScheduleMs: z.array(z.number().int().min(100).max(5_000)).min(1).max(8).default([250, 500, 1_000, 2_000]),
  minimumConfidence: z.literal(100).default(100),
  defaultAction: z.enum(['alert', 'quarantine', 'remove_dangerous_roles']).default('quarantine'),
  automaticKickEnabled: z.boolean().default(false),
  automaticBanEnabled: z.boolean().default(false),
  logChannelId: nullableSnowflake.default(null),
  alertChannelId: nullableSnowflake.default(null),
  incidentChannelId: nullableSnowflake.default(null),
  externalAppReviewChannelId: nullableSnowflake.default(null),
  reviewerRoleId: nullableSnowflake.default(null),
  quarantineRoleId: nullableSnowflake.default(null),
  appealsChannelId: nullableSnowflake.default(null),
  staffPingCooldownSeconds: z.number().int().min(300).max(86_400).default(3_600),
  evidenceRetentionDays: z.number().int().min(30).max(3_650).default(365),
  configHistoryRetentionDays: z.number().int().min(365).nullable().default(null),
  timezone: z.string().min(1).max(64).default('UTC').refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
  }, 'Invalid IANA timezone'),
  nightModeEnabled: z.boolean().default(false),
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('00:00'),
  nightEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('07:00'),
  nightWeekdays: z.array(z.number().int().min(0).max(6)).default([0, 1, 2, 3, 4, 5, 6]),
  maintenanceMaximumSeconds: z.number().int().min(300).max(86_400).default(7_200),
  whitelistMaximumSeconds: z.number().int().min(300).max(604_800).default(86_400),
  pendingReviewMuteEnabled: z.boolean().default(false),
  pendingReviewMinimumConfidence: z.literal(100).default(100),
  pendingReviewAutoReleaseSeconds: z.number().int().min(3_600).max(2_592_000).nullable().default(null),
  pendingReviewReminderSeconds: z.number().int().min(3_600).max(604_800).nullable().default(86_400),
  reconcileQuarantineRole: z.boolean().default(false),
  ownerDmAlerts: z.boolean().default(true),
  affectedMemberDmNotifications: z.boolean().default(true),
  roleWhitelistEnabled: z.boolean().default(false),
}).strict();

export type AntiNukeConfig = z.infer<typeof antiNukeConfigSchema>;
export const balancedAntiNukeConfig: AntiNukeConfig = antiNukeConfigSchema.parse({});

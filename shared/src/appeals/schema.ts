import { z } from 'zod';

// ---------------------------------------------------------------------------
// Appeals feature — zod schemas shared between the bot, the dashboard API and
// the config loader. The shape mirrors the `appeals:` section of config.yml
// (see shared/src/config/schema.ts). Guild overrides are a partial version of
// the global shape: any key absent from an override falls back to the global
// value at runtime (resolveAppealConfig).
// ---------------------------------------------------------------------------

export const APPEAL_QUESTION_TYPES = ['short_text', 'long_text', 'checkbox'] as const;
export type AppealQuestionType = (typeof APPEAL_QUESTION_TYPES)[number];

// Only punishable case types may be appealed (unban/unmute/case_closed are
// outcomes, not punishments).
export const APPEALABLE_PUNISHMENT_TYPES = ['warn', 'mute', 'kick', 'ban', 'timeout', 'softban', 'tempban'] as const;
export type AppealablePunishmentType = (typeof APPEALABLE_PUNISHMENT_TYPES)[number];

export const APPEAL_STATUSES = ['pending', 'accepted', 'denied', 'ignored'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

const snowflake = z.string().regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID (15-20 digits)');

export const appealQuestionSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9_-]+$/, 'Expected a slug (lowercase letters, numbers, "-" and "_")'),
    label: z.string().min(1).max(200),
    type: z.enum(APPEAL_QUESTION_TYPES),
    required: z.boolean().default(false),
    min_length: z.number().int().min(0).optional(),
    max_length: z.number().int().min(1).optional(),
    help_text: z.string().max(500).optional(),
  })
  .strict();

export type AppealQuestionConfig = z.infer<typeof appealQuestionSchema>;

export const appealsConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    ping_role_id: snowflake.optional(),
    log_channel_id: snowflake.optional(),
    thread_auto_create: z.boolean().default(true),
    eligible_punishment_types: z
      .array(z.enum(APPEALABLE_PUNISHMENT_TYPES))
      .min(1, 'At least one punishment type must be appealable'),
    cooldown_seconds: z.number().int().min(0).default(300),
    max_open_appeals_per_user: z.number().int().min(1).default(3),
    blocking: z
      .object({
        enabled: z.boolean().default(true),
        default_reason: z.string().min(1).max(500).default('Appeals are disabled for this user.'),
      })
      .strict()
      .default({ enabled: true }),
    form: z.array(appealQuestionSchema).max(20, 'At most 20 form questions are supported').default([]),
  })
  .strict();

// Guild-level overrides: every field optional — anything omitted falls back to
// the global `appeals:` block (see resolveAppealConfig).
export const appealsGuildOverrideSchema = appealsConfigSchema.partial().strict();

export const appealsSectionSchema = z
  .object({
    ...appealsConfigSchema.shape,
    guild_overrides: z.record(snowflake, appealsGuildOverrideSchema).default({}),
  })
  .strict();

export type AppealsConfig = z.infer<typeof appealsConfigSchema>;
export type AppealsGuildOverride = z.infer<typeof appealsGuildOverrideSchema>;
export type AppealsSectionConfig = z.infer<typeof appealsSectionSchema>;

/** Deep-merge a guild override over the global appeals config. */
export function resolveAppealConfig(globalConfig: AppealsSectionConfig, guildId: string): AppealsConfig {
  const override = globalConfig.guild_overrides?.[guildId];
  if (!override) return globalConfig;
  return {
    ...globalConfig,
    ...override,
    blocking: { ...globalConfig.blocking, ...override.blocking },
  };
}

// ---------------------------------------------------------------------------
// Sanitization helpers — user-submitted text is neutralized before it ever
// reaches a Discord embed or thread so mentions/pings cannot be weaponized.
// ---------------------------------------------------------------------------

/** Strip/neutralize mention-like tokens. Applied before any Discord output. */
export function neutralizeMentions(input: string): string {
  return String(input ?? '')
    .replace(/@(everyone|here)/gi, '@\u200b$1')
    .replace(/<@[!&]?\d+>/g, (m) => m.replace('<', '<\u200b'))
    .replace(/<#\d+>/g, (m) => m.replace('<', '<\u200b'))
    .replace(/<a?:\w+:\d+>/g, (m) => m.replace('<', '<\u200b'));
}

/** Cap length and neutralize mentions for safe Discord output. */
export function sanitizeForDiscord(input: string, maxLength = 1000): string {
  let s = neutralizeMentions(String(input ?? '')).trim();
  if (s.length > maxLength) s = `${s.slice(0, maxLength)}…`;
  return s;
}

/**
 * Render text safely as Discord output: single-line content stays inline,
 * multi-line content (or content that contained mentions) is wrapped in a
 * code block so markdown cannot be abused.
 */
export function safeDiscordText(input: string, maxLength = 1000): string {
  const s = sanitizeForDiscord(input, maxLength);
  if (s.length === 0) return s;
  const hadMentions = /@(everyone|here)|<[@#]/.test(String(input ?? ''));
  if (hadMentions || s.includes('\n')) {
    return `\`\`\`\n${s.replace(/`/g, '\u200b`')}\n\`\`\``;
  }
  return s.replace(/`/g, '\u200b`');
}

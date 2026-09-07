import { z } from 'zod';
import { actionChainSchema, durationSchema, messageFormatSchema, snowflakeSchema } from './actions';
import { DEFAULT_ACTION_CHAIN, DEFAULT_WARN_CHAIN } from './chainDefaults';
import { permissionNamesSchema } from './permissions';
import { appealsSectionSchema } from '../appeals/schema';
import type { CustomCommandActionUnion, CustomCommandConfig } from '../types/customCommands';

const snowflake = z.string().regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID');
const snowflakeArray = z.array(snowflake).default([]);
const boolean = z.boolean();

const automodModuleBase = {
  enabled: boolean.default(true),
  immune_roles: snowflakeArray,
  channel_ignore_list: snowflakeArray,
  action_chain: actionChainSchema,
  log_channel_id: snowflake.optional(),
  log_thread_id: snowflake.optional(),
  suppress_repeat_response_seconds: z.number().int().min(0).default(0),
  suppressed_response_mode: z.enum(['silent', 'batched_summary']).default('silent'),
  shadow_mode: boolean.default(false),
};

export const commandSchema = z
  .object({
    enabled: boolean.default(true),
    slash: boolean.default(true),
    prefix: boolean.default(true),
    cooldown_seconds: z.number().int().min(0).default(3),
    permissions: permissionNamesSchema,
    immune_roles: snowflakeArray,
    aliases: z.array(z.string().min(1)).default([]),
    permission_group: z.string().optional(),
    allowed_roles: snowflakeArray,
  })
  .strict();

export const logIgnoreSchema = z
  .object({
    channels: snowflakeArray,
    categories: snowflakeArray,
    users: snowflakeArray,
    roles: snowflakeArray,
  })
  .strict()
  .default({ channels: [], categories: [], users: [], roles: [] });

export type LogIgnore = z.infer<typeof logIgnoreSchema>;

export const loggingEntrySchema = z
  .object({
    enabled: boolean.default(true),
    channel_id: snowflake.optional(),
    thread_id: snowflake.optional(),
    ignore: logIgnoreSchema,
  })
  .strict();

export const escalationActionSchema = z
  .object({
    type: z.enum(['mute', 'timeout', 'kick', 'ban']),
    duration: z.string().optional(),
  })
  .strict();

export const punishmentDmTypeSchema = z
  .object({
    enabled: boolean.default(true),
    format: messageFormatSchema.default('components_v2'),
    content: z.string().min(1),
  })
  .strict();

// Which Discord AutoMod action a native_automod response reacts to.
// block_message          — message was blocked & deleted (never posted)
// send_alert_message     — message was flagged, alert sent to the mod channel
// timeout                — member was timed out
// block_member_interaction — member interaction (e.g. button/select) was blocked
// any                    — respond regardless of the action
export const nativeAutomodActionSchema = z.enum([
  'block_message',
  'send_alert_message',
  'timeout',
  'block_member_interaction',
  'any',
]);
export type NativeAutomodAction = z.infer<typeof nativeAutomodActionSchema>;

// Per-rule response for Discord's native AutoMod. `format` selects the embed
// builder:
//   plain           — raw text message
//   embed           — classic embed builder (CV1: title/description/color/
//                     author/fields/footer/image/thumbnail)
//   components_v2   — Components v2 container builder (CV2: header/text/footer/
//                     accent color/media)
// Message fields support placeholders: ${originmessagecontent} (the blocked
// content), ${user}, ${user_mention}, ${channel}, ${guild}, ${rule_name}, etc.
export const nativeAutomodResponseSchema = z
  .object({
    enabled: z.boolean().default(true),
    // The Discord AutoMod rule ID (snowflake) this response belongs to.
    rule_id: z.string().regex(/^\d{15,20}$/, 'Expected a Discord AutoMod rule ID (snowflake)'),
    // The AutoMod action this response fires on. A single value or a list.
    on: z
      .union([nativeAutomodActionSchema, z.array(nativeAutomodActionSchema)])
      .default('block_message'),
    // Where to send the response. Defaults to the channel where the action
    // happened when omitted.
    channel_id: snowflake.optional(),
    format: z.enum(['plain', 'embed', 'components_v2']).default('components_v2'),
    content: z.string().optional(),
    // Embed / CV2 builder fields (all support placeholders).
    title: z.string().optional(),
    description: z.string().optional(),
    footer: z.string().optional(),
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #ED4245').optional(),
    image_url: z.string().url().optional(),
    thumbnail_url: z.string().url().optional(),
    author: z
      .object({
        name: z.string().min(1),
        url: z.string().url().optional(),
        icon_url: z.string().url().optional(),
      })
      .strict()
      .optional(),
    fields: z
      .array(
        z
          .object({
            name: z.string(),
            value: z.string(),
            inline: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    // Buttons appended below the CV2 container (components_v2 format only).
    buttons: z
      .array(
        z
          .object({
            label: z.string().min(1).max(80),
            style: z.enum(['primary', 'secondary', 'success', 'danger', 'link']).optional(),
            custom_id: z.string().optional(),
            url: z.string().url().optional(),
            disabled: z.boolean().optional(),
          })
          .strict(),
      )
      .optional(),
    delete_after_seconds: z.number().int().min(0).default(0),
  })
  .strict();
export type NativeAutomodResponseConfig = z.infer<typeof nativeAutomodResponseSchema>;

const customEmbedFieldSchema = z
  .object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional(),
  })
  .strict();

const customEmbedSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    url: z.string().optional(),
    timestamp: z.boolean().optional(),
    image: z.string().optional(),
    thumbnail: z.string().optional(),
    author: z
      .object({
        name: z.string(),
        url: z.string().optional(),
        icon_url: z.string().optional(),
      })
      .strict()
      .optional(),
    fields: z.array(customEmbedFieldSchema).optional(),
    footer: z
      .object({
        text: z.string(),
        icon_url: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const customButtonSchema = z
  .object({
    type: z.literal('button'),
    id: z.string(),
    custom_id: z.string().optional(),
    label: z.string(),
    style: z.enum(['primary', 'secondary', 'success', 'danger', 'link']).optional(),
    emoji: z.string().optional(),
    url: z.string().optional(),
    disabled: z.boolean().optional(),
  })
  .strict();

const customSelectOptionSchema = z
  .object({
    label: z.string(),
    value: z.string(),
    description: z.string().optional(),
    emoji: z.string().optional(),
  })
  .strict();

const customSelectSchema = z
  .object({
    type: z.literal('select'),
    id: z.string(),
    custom_id: z.string().optional(),
    placeholder: z.string().optional(),
    min_values: z.number().int().optional(),
    max_values: z.number().int().optional(),
    options: z.array(customSelectOptionSchema),
  })
  .strict();

const customComponentRowSchema = z
  .object({
    components: z.array(z.union([customButtonSchema, customSelectSchema])),
  })
  .strict();

const customPayloadSchema = z
  .object({
    content: z.string().optional(),
    embeds: z.array(customEmbedSchema).optional(),
    components: z.array(customComponentRowSchema).optional(),
    files: z.array(z.string()).optional(),
  })
  .strict();

const customTargetSchema = z
  .object({
    target: z.enum(['author', 'mentioned', 'first_arg', 'args']).optional(),
    user_id: z.string().optional(),
  })
  .strict();

const customActionSchema: z.ZodType<CustomCommandActionUnion> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('send_message'), content: z.string().optional(), embeds: z.array(customEmbedSchema).optional(), components: z.array(customComponentRowSchema).optional(), files: z.array(z.string()).optional(), reply: z.boolean().optional(), ephemeral: z.boolean().optional(), delete_after_seconds: z.number().optional(), mention: z.boolean().optional() }).strict(),
    z.object({ type: z.literal('edit_message'), content: z.string().optional(), embeds: z.array(customEmbedSchema).optional(), components: z.array(customComponentRowSchema).optional(), files: z.array(z.string()).optional() }).strict(),
    z.object({ type: z.literal('send_channel'), channel_id: z.string(), content: z.string().optional(), embeds: z.array(customEmbedSchema).optional(), components: z.array(customComponentRowSchema).optional(), files: z.array(z.string()).optional(), delete_after_seconds: z.number().optional() }).strict(),
    z.object({ type: z.literal('dm'), content: z.string().optional(), embeds: z.array(customEmbedSchema).optional(), components: z.array(customComponentRowSchema).optional(), files: z.array(z.string()).optional() }).strict(),
    z.object({ type: z.literal('delete_message'), delete_after_seconds: z.number() }).strict(),
    z.object({ type: z.literal('react'), emojis: z.array(z.string()) }).strict(),
    z.object({ type: z.literal('add_role'), role_id: z.string(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('remove_role'), role_id: z.string(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('add_roles'), role_ids: z.array(z.string()), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('remove_roles'), role_ids: z.array(z.string()), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('kick'), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('ban'), reason: z.string().optional(), delete_message_days: z.number().int().min(0), duration: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('unban'), user_id: z.string(), reason: z.string().optional() }).strict(),
    z.object({ type: z.literal('timeout'), duration: z.string(), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('untimeout'), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('create_thread'), name: z.string(), auto_archive_duration: z.number().int(), reason: z.string().optional() }).strict(),
    z.object({ type: z.literal('set_nickname'), nickname: z.string(), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('move_channel'), channel_id: z.string(), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('disconnect'), reason: z.string().optional(), target: customTargetSchema.shape.target, user_id: customTargetSchema.shape.user_id }).strict(),
    z.object({ type: z.literal('create_role'), name: z.string(), color: z.string().optional(), hoist: z.boolean(), mentionable: z.boolean(), permissions: z.array(z.string()), reason: z.string().optional() }).strict(),
    z.object({ type: z.literal('delete_role'), role_id: z.string(), reason: z.string().optional() }).strict(),
    z.object({ type: z.literal('rename_channel'), name: z.string(), channel_id: z.string().optional(), reason: z.string().optional() }).strict(),
    z.object({ type: z.literal('wait'), ms: z.number().int().min(0) }).strict(),
    z.object({ type: z.literal('random_pick'), choices: z.array(customPayloadSchema) }).strict(),
    z.object({ type: z.literal('run_command'), command: z.string(), args: z.string().optional() }).strict(),
    z.object({ type: z.literal('stop') }).strict(),
    z.object({ type: z.literal('log'), content: z.string(), channel_id: z.string().optional() }).strict(),
    z.object({ type: z.literal('webhook'), url: z.string(), content: z.string().optional(), embeds: z.array(customEmbedSchema).optional(), components: z.array(customComponentRowSchema).optional(), files: z.array(z.string()).optional() }).strict(),
    z.object({ type: z.literal('counter'), name: z.string(), increment_by: z.number().int(), persist: z.boolean().optional(), send_result: z.boolean().optional() }).strict(),
    z.object({ type: z.literal('if'), condition: z.enum(['has_role', 'not_has_role', 'is_bot', 'has_permission', 'equals_arg']), role_id: z.string().optional(), permission: z.string().optional(), arg_index: z.number().int().optional(), equals: z.string().optional(), then: z.array(customActionSchema).optional(), else: z.array(customActionSchema).optional() }).strict(),
  ]),
);

const customCommandSchema: z.ZodType<CustomCommandConfig, z.ZodTypeDef, Partial<CustomCommandConfig>> = z
  .object({
    enabled: boolean.default(true),
    slash: boolean.default(true),
    prefix: boolean.default(true),
    cooldown_seconds: z.number().int().min(0).default(3),
    delete_input: z.union([boolean, z.number().int().min(0)]).default(false),
    delete_output: z.union([boolean, z.number().int().min(0)]).default(false),
    ephemeral: boolean.default(false),
    suppress_reply: boolean.default(false),
    allowed_users: z.array(z.string()).default([]),
    allowed_roles: z.array(z.string()).default([]),
    denied_roles: z.array(z.string()).default([]),
    permissions: z.array(z.string()).default([]),
    channel_ids: z.array(z.string()).default([]),
    channel_mode: z.enum(['allow', 'deny']).default('allow'),
    aliases: z.array(z.string()).default([]),
    description: z.string().default(''),
    actions: z.array(customActionSchema).default([]),
  })
  .strict();

export const roleConnectionConditionSchema = z
  .object({
    has_role: z.boolean(),
    role_id: snowflake,
  })
  .strict();

export const roleConnectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    name: z.string().min(1).max(100).optional(),
    main_role: snowflake,
    logic: z.enum(['all', 'any']).default('all'),
    held_for_seconds: z.number().int().min(0).default(0),
    conditions: z.array(roleConnectionConditionSchema).min(1).default([]),
  })
  .strict();

export type RoleConnection = z.infer<typeof roleConnectionSchema>;
export type RoleConnectionCondition = z.infer<typeof roleConnectionConditionSchema>;

const legacyRoleConnectionSchema = z
  .object({
    enabled: z.boolean().default(true),
    if_has_role: snowflake,
    held_for_seconds: z.number().int().min(0).default(0),
    then_add: snowflakeArray,
    then_remove: snowflakeArray,
  })
  .strict();

function normalizeRoleConnection(val: unknown): unknown {
  if (val && typeof val === 'object' && 'if_has_role' in (val as Record<string, unknown>)) {
    const v = val as {
      enabled?: boolean;
      if_has_role: string;
      held_for_seconds?: number;
      then_add?: string[];
    };
    const add = v.then_add ?? [];
    return {
      enabled: v.enabled ?? true,
      main_role: add[0] ?? v.if_has_role,
      logic: 'all',
      held_for_seconds: v.held_for_seconds ?? 0,
      conditions: [{ has_role: true, role_id: v.if_has_role }],
    };
  }
  return val;
}

export const configSchema = z
  .object({
    bot: z
      .object({
        prefixes: z.array(z.string().min(1).max(8)).min(1),
        prefix_enabled: boolean.default(true),
        slash_enabled: boolean.default(true),
        per_guild_prefixes: z
          .record(z.string().regex(/^\d{15,20}$/), z.array(z.string().min(1).max(8)))
          .default({}),
        status: z.enum(['online', 'idle', 'dnd', 'invisible']).default('online'),
        activity: z
          .object({
            type: z.enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Competing']).default('Watching'),
            text: z.string().default('the server'),
            url: z.string().url().or(z.literal('')).optional(),
          })
          .default({ type: 'Watching', text: 'the server' }),
        owner_ids: z.array(snowflake).min(1),
      })
      .strict(),

    commands: z.record(z.string().min(1), commandSchema).default({}),

    custom_commands: z
      .preprocess((v) => (v == null ? {} : v), z.record(z.string().min(1), customCommandSchema).default({})),

    command_defaults: z
      .object({
        cooldown_seconds: z.number().int().min(0).default(3),
      })
      .strict()
      .default({ cooldown_seconds: 3 }),

    logging: z.record(z.string().min(1), loggingEntrySchema).default({}),

    // Global logging exclusions — applied to every event, in addition to each
    // event's own `ignore` block under `logging`.
    logging_ignore: logIgnoreSchema,

    warnings: z
      .object({
        escalation_ladder: z
          .array(
            z
              .object({
                count: z.number().int().min(1),
                action: z.enum(['mute', 'kick', 'ban']),
                duration: z.string().optional(),
              })
              .strict(),
          )
          .default([]),
        decay: z
          .object({
            enabled: boolean.default(false),
            after_days: z.number().int().min(1).default(30),
          })
          .strict()
          .default({ enabled: false, after_days: 30 }),
      })
      .strict()
      .default({ escalation_ladder: [], decay: { enabled: false, after_days: 30 } }),

    reports: z
      .object({
        enabled: boolean.default(true),
        cooldown_seconds: z.number().int().min(0).default(30),
        channel_id: snowflake.optional(),
        action_roles: snowflakeArray,
        ping_role_id: snowflake.optional(),
        archive: z
          .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
          })
          .strict()
          .default({ enabled: false }),
        merge_window_seconds: z.number().int().min(0).default(300),
        false_report_warning_enabled: boolean.default(false),
      })
      .strict()
      .default({}),

    // Self-hosted NSFW image moderation (NSFWJS MobileNetV2, in-process).
    nsfw_moderation: z
      .object({
        enabled: boolean.default(false),
        // Empty = every guild; otherwise only these guilds are scanned.
        guilds: snowflakeArray,
        ignored_channels: snowflakeArray,
        exempt_roles: snowflakeArray,
        max_attachment_bytes: z.number().int().min(1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024),
        download_timeout_ms: z.number().int().min(1000).max(120000).default(15000),
        queue_capacity: z.number().int().min(1).max(500).default(25),
        worker_concurrency: z.number().int().min(1).max(10).default(1),
        review_threshold: z.number().min(0).max(1).default(0.6),
        delete_threshold: z.number().min(0).max(1).default(0.8),
        ignored_categories: z.array(z.string().min(1)).default([]),
        log_only: boolean.default(false),
      })
      .strict()
      .default({}),

    // Public appeals portal. The global block applies to every guild unless a
    // per-guild override exists under `guild_overrides` (any key omitted there
    // falls back to the global value).
    appeals: appealsSectionSchema.default({ enabled: false, eligible_punishment_types: ['ban', 'mute', 'warn', 'timeout'] }),

    archives: z
      .object({
        enabled: z.boolean().default(true),
        default_amount: z.number().int().min(1).max(5000).default(50),
        max_amount: z.number().int().min(1).max(5000).default(2000),
        case_evidence_amount: z.number().int().min(1).max(500).default(40),
        automod_context_amount: z.number().int().min(1).max(100).default(15),
        max_attachment_bytes: z.number().int().min(1).default(10 * 1024 * 1024),
        max_archive_bytes: z.number().int().min(1).default(200 * 1024 * 1024),
        allowed_roles: z.array(z.string()).default([]),
        allowed_users: z.array(z.string()).default([]),
        snapshot_messages: z.boolean().default(true),
        message_retention_days: z.number().int().min(1).max(365).default(90),
        archive_on_delete: z.boolean().default(true),
        archive_on_edit: z.boolean().default(true),
        archive_interval_hours: z.number().int().min(1).max(24).default(2),
        archive_threshold_deleted: z.number().int().min(1).default(100),
        archive_threshold_edited: z.number().int().min(1).default(50),
      })
      .strict()
      .default({}),

    automod: z
      .object({
        enabled: boolean.default(true),
        global_immune_roles: snowflakeArray,
        log_channel_id: snowflake.optional(),
        log_thread_id: snowflake.optional(),
        bulk_delete_quiet_seconds: z.number().int().min(1).max(30).default(5),
        owner_alerts: z
          .object({
            enabled: boolean.default(true),
            role_ids: snowflakeArray,
            cooldown_seconds: z.number().int().min(5).max(3600).default(300),
          })
          .strict()
          .default({}),
        modules: z
          .object({
            spam: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(2).default(5), window_seconds: z.number().int().min(1).default(5) })
              .strict(),
            cross_channel: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(2).default(5), window_seconds: z.number().int().min(1).default(10) })
              .strict(),
            link_filter: z
              .object({
                ...automodModuleBase,
                mode: z.enum(['deny_all', 'allowlist', 'denylist']).default('deny_all'),
                allowlist: z.array(z.string()).default([]),
                denylist: z.array(z.string()).default([]),
              })
              .strict(),
            image_spam: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(2).default(5), window_seconds: z.number().int().min(1).default(10) })
              .strict(),
            executable_files: z
              .object({ ...automodModuleBase, blocked_extensions: z.array(z.string()).default(['.exe', '.bat', '.cmd', '.sh', '.jar', '.msi', '.scr', '.ps1', '.vbs', '.com', '.dll']) })
              .strict(),
            mass_images: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(2).default(5), window_seconds: z.number().int().min(1).default(10) })
              .strict(),
            invites: z
              .object({ ...automodModuleBase, guild_allowlist: snowflakeArray })
              .strict(),
            emoji_spam: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(5).default(10) })
              .strict(),
            line_spam: z
              .object({
                ...automodModuleBase,
                per_message_lines: z.number().int().min(5).default(20),
                multi_message_lines: z.number().int().min(5).default(40),
                multi_message_window_seconds: z.number().int().min(1).default(10),
              })
              .strict(),
            poll_spam: z
              .object({ ...automodModuleBase, threshold: z.number().int().min(2).default(3), window_seconds: z.number().int().min(1).default(60) })
              .strict(),
            duplicate_spam: z
              .object({
                ...automodModuleBase,
                threshold: z.number().int().min(2).default(5),
                window_seconds: z.number().int().min(1).default(5),
                similarity_threshold: z.number().min(0).max(1).default(0.8),
              })
              .strict(),
            mass_ping: z
              .object({
                ...automodModuleBase,
                max_mentions: z.number().int().min(1).default(5),
                spam_threshold: z.number().int().min(2).default(3),
                spam_window_seconds: z.number().int().min(1).default(60),
              })
              .strict()
              .default(() => ({ enabled: false, action_chain: [...DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], suppress_repeat_response_seconds: 30, suppressed_response_mode: 'silent' as const, shadow_mode: false, max_mentions: 5, spam_threshold: 3, spam_window_seconds: 60 })),
            scam_images: z
              .object({
                ...automodModuleBase,
                hamming_distance_threshold: z.number().int().min(0).max(64).default(10),
              })
              .strict()
              .default(() => ({ enabled: true, action_chain: [...DEFAULT_ACTION_CHAIN], immune_roles: [], channel_ignore_list: [], suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent' as const, shadow_mode: false, hamming_distance_threshold: 10 })),
          })
          .strict(),
        risk_scoring: z
          .object({
            enabled: boolean.default(false),
            threshold: z.number().min(0).default(50),
            join_age_weight: z.number().min(0).default(1),
            automod_hit_weight: z.number().min(0).default(2),
            cross_channel_weight: z.number().min(0).default(1),
            decay_seconds: z.number().int().min(1).default(3600),
          })
          .strict()
          .default({}),
        heuristics: z
          .object({
            typing_speed: z
              .object({
                ...automodModuleBase,
                min_characters_per_second: z.number().min(1).default(15),
                window_seconds: z.number().int().min(1).default(10),
              })
              .strict()
              .default(() => ({ enabled: false, action_chain: [...DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent' as const, shadow_mode: false, min_characters_per_second: 15, window_seconds: 10 })),
            mass_identical_joins: z
              .object({
                ...automodModuleBase,
                threshold: z.number().int().min(2).default(5),
                window_seconds: z.number().int().min(1).default(120),
              })
              .strict()
              .default(() => ({ enabled: false, action_chain: [...DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent' as const, shadow_mode: false, threshold: 5, window_seconds: 120 })),
            new_account_velocity: z
              .object({
                ...automodModuleBase,
                max_account_age_days: z.number().min(0).default(7),
                threshold: z.number().int().min(2).default(3),
                window_seconds: z.number().int().min(1).default(600),
              })
              .strict()
              .default(() => ({ enabled: false, action_chain: [...DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent' as const, shadow_mode: false, max_account_age_days: 7, threshold: 3, window_seconds: 600 })),
            spam_rejoins: z
              .object({
                ...automodModuleBase,
                threshold: z.number().int().min(2).default(3),
                window_seconds: z.number().int().min(1).default(300),
              })
              .strict()
              .default(() => ({ enabled: false, action_chain: [{ type: 'create_report' as const, reason: 'Automod: {rule}' }, { type: 'ban' as const, reason: 'Automod: spam rejoining ({rule})' }], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent' as const, shadow_mode: false, threshold: 3, window_seconds: 300 })),
          })
          .strict()
          .default({}),
      })
      .strict(),

    regex_engine: z
      .object({
        enabled: boolean.default(true),
        rules: z
          .array(
            z
              .object({
                name: z.string().min(1),
                pattern: z.string().optional(),
                patterns: z
                  .array(
                    z.union([
                      z.string().min(1),
                      z
                        .object({
                          pattern: z.string().min(1),
                          // Require a Luhn-valid card number (with a valid card
                          // issuer prefix) before the pattern counts as a hit.
                          luhn: boolean.default(false),
                        })
                        .strict(),
                    ]),
                  )
                  .optional(),
                flags: z.string().max(10).default('gi'),
                scope: z.enum(['message', 'username', 'nickname']).default('message'),
                enabled: boolean.default(true),
                immune_roles: snowflakeArray,
                channel_ignore_list: snowflakeArray.optional().default([]),
                action_chain: actionChainSchema,
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({ enabled: true, rules: [] }),

    punishment_dms: z
      .object({
        enabled: boolean.default(true),
        hide_moderator: boolean.default(false),
        order: z.enum(['before', 'after']).default('after'),
        cooldown_seconds: z.number().int().min(1).max(300).default(15),
        types: z
          .record(
            z.enum(['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute', 'case_closed']),
            punishmentDmTypeSchema,
          )
          .default({}),
      })
      .strict()
      .default({}),

    // Discord's own (native) AutoMod responses. When a native AutoMod rule
    // executes an action (e.g. a message gets blocked), the bot can post a
    // configured response. Responses are keyed by AutoMod rule ID + the action
    // that fired. Mentions are ALWAYS disabled on these responses (hardcoded).
    native_automod: z
      .object({
        enabled: boolean.default(true),
        responses: z.preprocess(
          (v) => (v == null ? [] : v),
          z.array(nativeAutomodResponseSchema).default([]),
        ),
      })
      .strict()
      .default({ enabled: true, responses: [] }),

    escalation: z
      .object({
        enabled: boolean.default(true),
        window_seconds: z.number().int().min(1).default(3600),
        rules: z
          .array(
            z
              .object({
                rule: z.string().min(1),
                count: z.number().int().min(2),
                within_seconds: z.number().int().min(1).default(3600),
                action: escalationActionSchema,
              })
              .strict(),
          )
          .default([]),
        global: z
          .array(
            z
              .object({
                count: z.number().int().min(2),
                within_seconds: z.number().int().min(1).default(3600),
                action: escalationActionSchema,
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({}),

    join_roles: z
      .object({
        roles: snowflakeArray,
        bot_roles: snowflakeArray,
      })
      .strict()
      .default({ roles: [], bot_roles: [] }),

    welcome: z
      .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: z.string().default('Welcome {user} to {guild}!'),
      })
      .strict()
      .default({ enabled: false, message: 'Welcome {user} to {guild}!' }),

    goodbye: z
      .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: z.string().default('{user} has left {guild}.'),
      })
      .strict()
      .default({ enabled: false, message: '{user} has left {guild}.' }),

    booster: z
      .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: z.string().default('Thank you for boosting {guild}, {user}!'),
      })
      .strict()
      .default({ enabled: false, message: 'Thank you for boosting {guild}, {user}!' }),

    role_connections: z
      .preprocess(
        // A legacy flat array ({ if_has_role / then_add / then_remove }) is
        // transparently upgraded to the newer object form so old configs keep
        // booting. Each legacy entry becomes a single condition on its primary
        // then_add role.
        (val) => {
          if (Array.isArray(val)) {
            return {
              enabled: true,
              sync_interval_minutes: 5,
              connections: val.map(normalizeRoleConnection),
            };
          }
          return val;
        },
        z
          .object({
            enabled: boolean.default(true),
            sync_interval_minutes: z.number().int().min(1).default(5),
            connections: z
              .array(z.preprocess(normalizeRoleConnection, roleConnectionSchema))
              .default([]),
          })
          .strict(),
      ),

    channel_locking: z
      .object({
        channels: snowflakeArray.default([]),
        exclude_roles: snowflakeArray.default([]),
        deny_permissions: z.array(z.string()).default(['SendMessages', 'AddReactions']),
      })
      .strict()
      .default({ channels: [], exclude_roles: [], deny_permissions: ['SendMessages', 'AddReactions'] }),

    anti_raid: z
      .object({
        enabled: boolean.default(false),
        join_rate_threshold: z.number().int().min(2).default(5),
        window_seconds: z.number().int().min(1).default(30),
        action: z.enum(['lock_joins', 'timeout_joiners', 'quarantine_joiners', 'force_verify', 'log_only']).default('quarantine_joiners'),
        quarantine_role_id: snowflake.optional(),
        alert_channel_id: snowflake.optional(),
        account_age_days: z.number().int().min(0).default(7),
        cooldown_seconds: z.number().int().min(60).default(3600),
      })
      .strict()
      .default({}),

    sticky_messages: z
      .object({
        enabled: boolean.default(false),
        re_post_after_messages: z.number().int().min(1).default(5),
      })
      .strict()
      .default({}),

    slowmode_scheduler: z
      .object({
        enabled: boolean.default(false),
        threshold_messages_per_minute: z.number().int().min(1).default(30),
        slowmode_seconds: z.number().int().min(1).default(10),
        revert_after_minutes: z.number().int().min(1).default(15),
      })
      .strict()
      .default({}),

    sticky_roles: z
      .object({
        enabled: boolean.default(false),
      })
      .strict()
      .default({}),

    invite_tracking: z
      .object({
        enabled: boolean.default(false),
      })
      .strict()
      .default({}),

    tickets: z
      .object({
        enabled: boolean.default(false),
        category_id: snowflake.optional(),
        support_roles: snowflakeArray,
        transcript_channel_id: snowflake.optional(),
      })
      .strict()
      .default({}),

    modmail: z
      .object({
        enabled: boolean.default(false),
        category_id: snowflake.optional(),
        support_roles: snowflakeArray,
        transcript_channel_id: snowflake.optional(),
      })
      .strict()
      .default({}),

    verification_gate: z
      .object({
        enabled: boolean.default(false),
        panel_channel_id: snowflake.optional(),
        verified_role_id: snowflake.optional(),
        unverified_role_id: snowflake.optional(),
        unverified_on_join: boolean.default(true),
        log_channel_id: snowflake.optional(),
        captcha: z
          .object({
            enabled: boolean.default(true),
            types: z.array(z.enum(['math', 'text', 'button'])).default(['math', 'text', 'button']),
            math_max: z.number().int().min(2).default(20),
            text_words: z.array(z.string()).default(['verify', 'gate', 'access', 'welcome', 'enter', 'server', 'safe']),
            button_count: z.number().int().min(2).max(5).default(4),
          })
          .default({}),
        timeout_kick_seconds: z.number().int().min(0).default(0),
      })
      .strict()
      .default({}),

    quarantine: z
      .object({
        enabled: boolean.default(true),
        restricted_role_id: snowflake.optional(),
      })
      .strict()
      .default({}),

    blacklist: z
      .object({
        enabled: boolean.default(true),
        action: z.enum(['ban', 'kick', 'flag']).default('flag'),
        silently_flag: boolean.default(false),
      })
      .strict()
      .default({}),

    alt_detection: z
      .object({
        enabled: boolean.default(false),
        max_account_age_days: z.number().int().min(0).default(7),
      })
      .strict()
      .default({}),

    trust_levels: z
      .object({
        enabled: boolean.default(false),
        levels: z
          .array(
            z
              .object({
                level: z.number().int().min(1),
                after_days: z.number().int().min(1),
                require_clean_history: boolean.default(true),
                roles: snowflakeArray,
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({}),

    fuzzy: z
      .object({
        enabled: boolean.default(true),
        max_distance: z.number().int().min(1).max(5).default(2),
        cooldown_seconds: z.number().int().min(0).default(15),
      })
      .strict()
      .default({}),

    music: z
      .object({
        enabled: boolean.default(true),
        default_volume: z.number().int().min(0).max(200).default(100),
        max_volume: z.number().int().min(100).max(500).default(200),
        twenty_four_seven: boolean.default(false),
        autoplay: boolean.default(false),
        max_queue_size: z.number().int().min(1).max(2000).default(500),
        text_channel_id: snowflake.optional(),
        panel_refresh_seconds: z.number().int().min(0).max(60).default(10),
      })
      .strict()
      .default({}),

    staff_permission_groups: z
      .object({
        groups: z
          .array(
            z
              .object({
                name: z.string().min(1),
                roles: snowflakeArray,
                permissions: z.array(z.string()).default([]),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({ groups: [] }),

    community: z
      .object({
        starboard: z
          .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
            threshold: z.number().int().min(1).default(3),
          })
          .strict()
          .default({}),
        suggestions: z
          .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
          })
          .strict()
          .default({}),
        giveaways: z
          .object({
            enabled: boolean.default(false),
          })
          .strict()
          .default({}),
        levels: z
          .object({
            enabled: boolean.default(false),
            message_xp: z.number().min(0).default(15),
            xp_cooldown_seconds: z.number().int().min(0).default(60),
            level_up_roles: z
              .array(
                z
                  .object({
                    level: z.number().int().min(1),
                    role_id: snowflake,
                  })
                  .strict(),
              )
              .default([]),
          })
          .strict()
          .default({}),
        status_rotation: z
          .object({
            enabled: boolean.default(false),
            interval_seconds: z.number().int().min(10).default(300),
            statuses: z.array(z.string().min(1)).default([]),
          })
          .strict()
          .default({}),
        birthdays: z
          .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
            timezone: z.string().default('UTC'),
          })
          .strict()
          .default({}),
      })
      .strict()
      .default({}),

    dashboard: z
      .object({
        enabled: boolean.default(true),
        port: z.number().int().min(1).max(65535).default(4693),
        owner_user_id: snowflake.optional(),
        live_log_retention_hours: z.number().int().min(1).default(24),
        timestamp_defaults: z
          .object({
            timezone: z.string().default('UTC'),
          })
          .strict()
          .default({ timezone: 'UTC' }),
      })
      .strict()
      .default({}),

    reply_ping_protection: z
      .object({
        enabled: boolean.default(false),
        native_rule_id: z.string().regex(/^\d{15,20}$/, 'Expected a Discord AutoMod rule ID (snowflake)').optional(),
        protected_users: snowflakeArray,
        protected_roles: snowflakeArray,
        exempt_users: snowflakeArray,
        exempt_roles: snowflakeArray,
        exempt_channels: snowflakeArray,
        notice_channel_id: snowflake.optional(),
        log_channel_id: snowflake.optional(),
        notice_title: z.string().min(1).default('Reply Mention Blocked'),
        notice_description: z.string().optional(),
        notice_accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #FEE75C').default('#FEE75C'),
        notice_delete_after_seconds: z.number().int().min(0).default(0),
        escalation: z
          .object({
            enabled: boolean.default(true),
            window_seconds: z.number().int().min(1).default(3600),
            levels: z
              .array(
                z
                  .object({
                    level: z.number().int().min(1),
                    violation_count: z.number().int().min(1),
                    action_type: z.enum(['warn', 'mute', 'timeout', 'kick', 'ban']),
                    action_duration: z.string().optional(),
                  })
                  .strict(),
              )
              .default([]),
          })
          .strict()
          .default({}),
      })
      .strict()
      .default({}),

    error_reporting: z
      .object({
        enabled: boolean.default(true),
        channel_id: snowflake.optional(),
        verbosity: z.enum(['minimal', 'standard', 'verbose']).default('standard'),
        webhook_url: z.string().url().or(z.literal('')).optional(),
      })
      .strict()
      .default({}),

    rate_limit_reporting: z
      .object({
        enabled: boolean.default(true),
        channel_id: snowflake.optional(),
        webhook_url: z.string().url().or(z.literal('')).optional(),
      })
      .strict()
      .default({}),

    economy: z
      .object({
        enabled: boolean.default(false),
        currency: z
          .object({
            name_singular: z.string().min(1).default('coin'),
            name_plural: z.string().min(1).default('coins'),
            symbol: z.string().min(1).default('$'),
            symbol_placement: z.enum(['before', 'after']).default('before'),
            thousands_separator: z.string().default(','),
            starting_wallet: z.number().int().min(0).default(100),
            starting_bank: z.number().int().min(0).default(0),
            max_wallet: z.number().int().min(0).default(10_000_000),
            max_bank: z.number().int().min(0).default(100_000_000),
          })
          .strict()
          .default({}),
        banking: z
          .object({
            enabled: boolean.default(true),
            deposit_limit: z.number().int().min(0).default(1_000_000),
            withdraw_limit: z.number().int().min(0).default(1_000_000),
            interest_enabled: boolean.default(false),
            interest_rate_bps: z.number().int().min(0).max(10000).default(0),
            interest_interval_hours: z.number().int().min(1).default(24),
            max_interest_amount: z.number().int().min(0).default(10_000),
          })
          .strict()
          .default({}),
        transfers: z
          .object({
            enabled: boolean.default(true),
            min_amount: z.number().int().min(1).default(1),
            max_amount: z.number().int().min(1).default(1_000_000),
            fee_percentage_bps: z.number().int().min(0).max(10000).default(0),
            fee_min: z.number().int().min(0).default(0),
            fee_max: z.number().int().min(0).default(10_000),
            cooldown_seconds: z.number().int().min(0).default(10),
            require_confirmation_above: z.number().int().min(0).default(10_000),
          })
          .strict()
          .default({}),
        daily: z
          .object({
            enabled: boolean.default(true),
            min_reward: z.number().int().min(0).default(100),
            max_reward: z.number().int().min(0).default(500),
            streak_bonus_per_day_bps: z.number().int().min(0).max(10000).default(500),
            streak_bonus_max_bps: z.number().int().min(0).max(50000).default(10000),
            grace_tokens: z.number().int().min(0).max(7).default(1),
            timezone: z.string().default('UTC'),
          })
          .strict()
          .default({}),
        weekly: z
          .object({
            enabled: boolean.default(true),
            min_reward: z.number().int().min(0).default(1000),
            max_reward: z.number().int().min(0).default(5000),
            streak_bonus_per_week_bps: z.number().int().min(0).max(10000).default(1000),
            grace_tokens: z.number().int().min(0).max(4).default(1),
            timezone: z.string().default('UTC'),
          })
          .strict()
          .default({}),
        work: z
          .object({
            enabled: boolean.default(true),
            default_cooldown_seconds: z.number().int().min(0).default(300),
            xp_per_work: z.number().int().min(0).default(10),
          })
          .strict()
          .default({}),
        shops: z
          .object({
            enabled: boolean.default(true),
            max_shops: z.number().int().min(1).default(50),
            max_items_per_shop: z.number().int().min(1).default(100),
            restock_interval_minutes: z.number().int().min(1).default(60),
            purchase_public: boolean.default(false),
          })
          .strict()
          .default({}),
        trading: z
          .object({
            enabled: boolean.default(true),
            max_active_trades: z.number().int().min(1).default(5),
            trade_expiry_minutes: z.number().int().min(1).default(30),
            require_confirmation: boolean.default(true),
          })
          .strict()
          .default({}),
        marketplace: z
          .object({
            enabled: boolean.default(true),
            max_listings_per_user: z.number().int().min(1).default(20),
            listing_fee_bps: z.number().int().min(0).max(10000).default(500),
            sale_tax_bps: z.number().int().min(0).max(10000).default(500),
            min_price: z.number().int().min(1).default(1),
            max_price: z.number().int().min(1).default(10_000_000),
            listing_duration_hours: z.number().int().min(1).default(168),
          })
          .strict()
          .default({}),
        stealing: z
          .object({
            enabled: boolean.default(false),
            cooldown_seconds: z.number().int().min(60).default(3600),
            daily_attempt_limit: z.number().int().min(1).default(5),
            daily_stolen_cap: z.number().int().min(0).default(5000),
            min_amount: z.number().int().min(1).default(10),
            max_amount: z.number().int().min(1).default(500),
            max_percentage_bps: z.number().int().min(1).max(10000).default(2000),
            failure_fine: z.number().int().min(0).default(100),
            min_attacker_balance: z.number().int().min(0).default(100),
            min_victim_balance: z.number().int().min(0).default(50),
            victim_grace_minutes: z.number().int().min(0).default(60),
            allow_bank_steal: boolean.default(false),
            max_bank_percentage_bps: z.number().int().min(1).max(10000).default(500),
            steal_from_banks: boolean.default(false),
          })
          .strict()
          .default({}),
        quests: z
          .object({
            enabled: boolean.default(true),
            max_active_quests: z.number().int().min(1).default(5),
            daily_quest_count: z.number().int().min(1).default(3),
            weekly_quest_count: z.number().int().min(1).default(2),
            refresh_cooldown_seconds: z.number().int().min(0).default(300),
          })
          .strict()
          .default({}),
        achievements: z
          .object({
            enabled: boolean.default(true),
          })
          .strict()
          .default({}),
        collections: z
          .object({
            enabled: boolean.default(true),
          })
          .strict()
          .default({}),
        crafting: z
          .object({
            enabled: boolean.default(true),
            max_concurrent: z.number().int().min(1).default(5),
          })
          .strict()
          .default({}),
        leaderboards: z
          .object({
            enabled: boolean.default(true),
            refresh_interval_minutes: z.number().int().min(1).default(60),
            visible_categories: z.array(z.string()).default([]),
            placement_role_rewards: z
              .object({
                enabled: boolean.default(false),
                top_1_role_id: snowflake.optional(),
                top_3_role_id: snowflake.optional(),
                top_10_role_id: snowflake.optional(),
              })
              .strict()
              .default({}),
          })
          .strict()
          .default({}),
        level: z
          .object({
            xp_per_message: z.number().int().min(0).default(5),
            xp_per_command: z.number().int().min(0).default(10),
            xp_curve_multiplier: z.number().min(1).default(1.5),
            level_up_role_rewards: z
              .object({
                enabled: boolean.default(false),
                roles: z
                  .array(
                    z.object({
                      level: z.number().int().min(1),
                      role_id: snowflake,
                    }),
                  )
                  .default([]),
              })
              .strict()
              .default({}),
          })
          .strict()
          .default({}),
        role_rewards: z
          .object({
            enabled: boolean.default(true),
            max_role_rewards: z.number().int().min(1).default(50),
            dangerous_permission_bits: z.array(z.string()).default([
              'Administrator',
              'ManageGuild',
              'ManageRoles',
              'ManageChannels',
              'ManageMessages',
              'ManageWebhooks',
              'BanMembers',
              'KickMembers',
              'ManageNicknames',
            ]),
          })
          .strict()
          .default({}),
        stealing_config: z
          .object({
            protection_items: z
              .array(z.string())
              .default(['wallet_lock', 'alarm', 'shield']),
            tool_items: z
              .array(z.string())
              .default(['lockpick', 'disguise_kit']),
          })
          .strict()
          .default({}),
        anti_abuse: z
          .object({
            max_transfers_per_hour: z.number().int().min(1).default(20),
            max_transfers_per_day: z.number().int().min(1).default(100),
            circular_transfer_detection: boolean.default(true),
            mule_transfer_threshold: z.number().int().min(2).default(5),
            mule_window_minutes: z.number().int().min(1).default(60),
            suspicious_activity_freeze: boolean.default(false),
            suspicious_activity_threshold: z.number().int().min(1).default(100_000),
          })
          .strict()
          .default({}),
        activity_rewards: z
          .object({
            enabled: boolean.default(false),
            min_message_length: z.number().int().min(1).default(10),
            min_interval_seconds: z.number().int().min(10).default(60),
            max_per_hour: z.number().int().min(1).default(20),
            max_per_day: z.number().int().min(1).default(200),
            reward_min: z.number().int().min(0).default(1),
            reward_max: z.number().int().min(0).default(5),
            ignored_channels: snowflakeArray,
            ignored_roles: snowflakeArray,
            bot_messages_excluded: boolean.default(true),
            deleted_messages_excluded: boolean.default(true),
          })
          .strict()
          .default({}),
        minigames: z
          .object({
            enabled: boolean.default(true),
            trivia: z
              .object({
                enabled: boolean.default(true),
                reward_min: z.number().int().min(0).default(50),
                reward_max: z.number().int().min(0).default(200),
                cooldown_seconds: z.number().int().min(0).default(60),
                timeout_seconds: z.number().int().min(10).default(30),
              })
              .strict()
              .default({}),
            memory: z
              .object({
                enabled: boolean.default(true),
                reward_min: z.number().int().min(0).default(50),
                reward_max: z.number().int().min(0).default(150),
                cooldown_seconds: z.number().int().min(0).default(60),
                sequence_length: z.number().int().min(3).max(8).default(5),
              })
              .strict()
              .default({}),
            reaction: z
              .object({
                enabled: boolean.default(true),
                reward_min: z.number().int().min(0).default(30),
                reward_max: z.number().int().min(0).default(100),
                cooldown_seconds: z.number().int().min(0).default(30),
              })
              .strict()
              .default({}),
          })
          .strict()
          .default({}),
        notifications: z
          .object({
            enabled: boolean.default(true),
            max_inbox: z.number().int().min(1).default(50),
            expiry_days: z.number().int().min(1).default(30),
          })
          .strict()
          .default({}),
        logging: z
          .object({
            enabled: boolean.default(true),
            channel_id: snowflake.optional(),
            events: z
              .object({
                balance_changes: boolean.default(true),
                purchases: boolean.default(true),
                trades: boolean.default(true),
                marketplace: boolean.default(true),
                stealing: boolean.default(true),
                role_rewards: boolean.default(true),
                admin_actions: boolean.default(true),
                quest_achievements: boolean.default(true),
                item_usage: boolean.default(true),
                scheduled_jobs: boolean.default(false),
              })
              .strict()
              .default({}),
          })
          .strict()
          .default({}),
        guild_overrides: z
          .record(
            z.string(),
            z
              .object({
                enabled: boolean.optional(),
                currency_name_singular: z.string().optional(),
                currency_name_plural: z.string().optional(),
                currency_symbol: z.string().optional(),
                starting_wallet: z.number().int().min(0).optional(),
                max_wallet: z.number().int().min(0).optional(),
              })
              .strict(),
          )
          .default({}),
      })
      .strict()
      .default({}),

    ops: z
      .object({
        backups_enabled: boolean.default(true),
        backup_retention_count: z.number().int().min(1).default(7),
        usage_analytics: boolean.default(true),
        snipe_retention_seconds: z.number().int().min(0).default(600),
      })
      .strict()
      .default({}),
  })
  .strict();

export type BotConfig = z.infer<typeof configSchema>;
export type AutomodModuleConfig = z.infer<typeof configSchema.shape.automod.shape.modules.shape.spam>;
export type CommandConfig = z.infer<typeof commandSchema>;
export type LoggingEntryConfig = z.infer<typeof loggingEntrySchema>;
export type NsfwModerationConfig = z.infer<typeof configSchema.shape.nsfw_moderation>;
export type ReplyPingProtectionConfig = z.infer<typeof configSchema.shape.reply_ping_protection>;
export type EscalationActionConfig = z.infer<typeof escalationActionSchema>;
export type PunishmentDmTypeConfig = z.infer<typeof punishmentDmTypeSchema>;
export type EconomyConfig = z.infer<typeof configSchema.shape.economy>;

export const PUNISHMENT_TYPES = ['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute', 'case_closed'] as const;
export type PunishmentType = (typeof PUNISHMENT_TYPES)[number];

export const LOG_EVENT_NAMES = [
  'message_edit',
  'message_delete',
  'message_bulk_delete',
  'member_join',
  'member_leave',
  'member_ban',
  'member_unban',
  'member_kick',
  'member_mute',
  'member_unmute',
  'member_timeout',
  'member_warn',
  'member_unwarn',
  'role_add',
  'role_remove',
  'role_change',
  'role_update',
  'role_create',
  'role_delete',
  'nickname_change',
  'channel_create',
  'channel_update',
  'channel_delete',
  'voice_state_update',
  'invite_create',
  'invite_delete',
  'moderation_action',
  'automod_trigger',
  'command_usage',
  'error_event',
  'rate_limit_event',
  'report_created',
  'report_resolved',
  'case_edit',
  'appeal_created',
  'appeal_resolved',
  'archive_created',
  'integration_create',
  'integration_update',
  'integration_delete',
  'webhook_create',
  'webhook_update',
  'webhook_delete',
  'economy_balance_change',
  'economy_purchase',
  'economy_sale',
  'economy_trade',
  'economy_marketplace',
  'economy_steal',
  'economy_role_reward',
  'economy_admin_action',
  'economy_quest',
  'economy_achievement',
  'economy_item_use',
  'economy_daily',
  'economy_work',
  'economy_job',
  'economy_craft',
  'economy_gift',
  'economy_reversal',
  'economy_error',
] as const;
export type LogEventName = (typeof LOG_EVENT_NAMES)[number];

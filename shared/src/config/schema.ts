import { z } from 'zod';
import { actionChainSchema, durationSchema, messageFormatSchema, snowflakeSchema } from './actions';
import { DEFAULT_ACTION_CHAIN, DEFAULT_WARN_CHAIN } from './chainDefaults';
import { permissionNamesSchema } from './permissions';

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
  })
  .strict();

export const loggingEntrySchema = z
  .object({
    enabled: boolean.default(true),
    channel_id: snowflake.optional(),
    thread_id: snowflake.optional(),
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

    command_defaults: z
      .object({
        cooldown_seconds: z.number().int().min(0).default(3),
      })
      .strict()
      .default({ cooldown_seconds: 3 }),

    logging: z.record(z.string().min(1), loggingEntrySchema).default({}),

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

    automod: z
      .object({
        enabled: boolean.default(true),
        global_immune_roles: snowflakeArray,
        log_channel_id: snowflake.optional(),
        log_thread_id: snowflake.optional(),
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
                patterns: z.array(z.string().min(1)).optional(),
                flags: z.string().max(10).default('gi'),
                scope: z.enum(['message', 'username', 'nickname']).default('message'),
                enabled: boolean.default(true),
                immune_roles: snowflakeArray,
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
        types: z
          .record(
            z.enum(['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute']),
            punishmentDmTypeSchema,
          )
          .default({}),
      })
      .strict()
      .default({}),

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
      .array(
        z
          .object({
            enabled: boolean.default(true),
            if_has_role: snowflake,
            held_for_seconds: z.number().int().min(0).default(0),
            then_add: snowflakeArray,
            then_remove: snowflakeArray,
          })
          .strict(),
      )
      .default([]),

    channel_locking: z
      .object({
        presets: z
          .array(
            z
              .object({
                name: z.string().min(1),
                channels: snowflakeArray,
                categories: snowflakeArray,
                all_channels: boolean.default(false),
                exclude_roles: snowflakeArray,
                deny_permissions: z.array(z.string()).default(['SendMessages', 'AddReactions']),
                schedule: z
                  .array(
                    z
                      .object({
                        cron: z.string().min(1),
                        action: z.enum(['lock', 'unlock']),
                      })
                      .strict(),
                  )
                  .default([]),
              })
              .strict(),
          )
          .default([]),
      })
      .strict()
      .default({ presets: [] }),

    anti_raid: z
      .object({
        enabled: boolean.default(false),
        join_rate_threshold: z.number().int().min(2).default(10),
        window_seconds: z.number().int().min(1).default(60),
        action: z.enum(['lock_joins', 'timeout_joiners', 'verify_gate']).default('lock_joins'),
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
        button_channel_id: snowflake.optional(),
        verified_role_id: snowflake.optional(),
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
export type EscalationActionConfig = z.infer<typeof escalationActionSchema>;
export type PunishmentDmTypeConfig = z.infer<typeof punishmentDmTypeSchema>;

export const PUNISHMENT_TYPES = ['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute'] as const;
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
  'member_timeout',
  'role_add',
  'role_remove',
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
] as const;
export type LogEventName = (typeof LOG_EVENT_NAMES)[number];

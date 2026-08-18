"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOG_EVENT_NAMES = exports.PUNISHMENT_TYPES = exports.configSchema = exports.punishmentDmTypeSchema = exports.escalationActionSchema = exports.loggingEntrySchema = exports.commandSchema = void 0;
const zod_1 = require("zod");
const actions_1 = require("./actions");
const chainDefaults_1 = require("./chainDefaults");
const permissions_1 = require("./permissions");
const snowflake = zod_1.z.string().regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID');
const snowflakeArray = zod_1.z.array(snowflake).default([]);
const boolean = zod_1.z.boolean();
const automodModuleBase = {
    enabled: boolean.default(true),
    immune_roles: snowflakeArray,
    channel_ignore_list: snowflakeArray,
    action_chain: actions_1.actionChainSchema,
    log_channel_id: snowflake.optional(),
    log_thread_id: snowflake.optional(),
    suppress_repeat_response_seconds: zod_1.z.number().int().min(0).default(0),
    suppressed_response_mode: zod_1.z.enum(['silent', 'batched_summary']).default('silent'),
    shadow_mode: boolean.default(false),
};
exports.commandSchema = zod_1.z
    .object({
    enabled: boolean.default(true),
    slash: boolean.default(true),
    prefix: boolean.default(true),
    cooldown_seconds: zod_1.z.number().int().min(0).default(3),
    permissions: permissions_1.permissionNamesSchema,
    immune_roles: snowflakeArray,
    aliases: zod_1.z.array(zod_1.z.string().min(1)).default([]),
    permission_group: zod_1.z.string().optional(),
})
    .strict();
exports.loggingEntrySchema = zod_1.z
    .object({
    enabled: boolean.default(true),
    channel_id: snowflake.optional(),
    thread_id: snowflake.optional(),
})
    .strict();
exports.escalationActionSchema = zod_1.z
    .object({
    type: zod_1.z.enum(['mute', 'timeout', 'kick', 'ban']),
    duration: zod_1.z.string().optional(),
})
    .strict();
exports.punishmentDmTypeSchema = zod_1.z
    .object({
    enabled: boolean.default(true),
    format: actions_1.messageFormatSchema.default('components_v2'),
    content: zod_1.z.string().min(1),
})
    .strict();
exports.configSchema = zod_1.z
    .object({
    bot: zod_1.z
        .object({
        prefixes: zod_1.z.array(zod_1.z.string().min(1).max(8)).min(1),
        prefix_enabled: boolean.default(true),
        slash_enabled: boolean.default(true),
        per_guild_prefixes: zod_1.z
            .record(zod_1.z.string().regex(/^\d{15,20}$/), zod_1.z.array(zod_1.z.string().min(1).max(8)))
            .default({}),
        status: zod_1.z.enum(['online', 'idle', 'dnd', 'invisible']).default('online'),
        activity: zod_1.z
            .object({
            type: zod_1.z.enum(['Playing', 'Streaming', 'Listening', 'Watching', 'Competing']).default('Watching'),
            text: zod_1.z.string().default('the server'),
            url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
        })
            .default({ type: 'Watching', text: 'the server' }),
        owner_ids: zod_1.z.array(snowflake).min(1),
    })
        .strict(),
    commands: zod_1.z.record(zod_1.z.string().min(1), exports.commandSchema).default({}),
    command_defaults: zod_1.z
        .object({
        cooldown_seconds: zod_1.z.number().int().min(0).default(3),
    })
        .strict()
        .default({ cooldown_seconds: 3 }),
    logging: zod_1.z.record(zod_1.z.string().min(1), exports.loggingEntrySchema).default({}),
    warnings: zod_1.z
        .object({
        escalation_ladder: zod_1.z
            .array(zod_1.z
            .object({
            count: zod_1.z.number().int().min(1),
            action: zod_1.z.enum(['mute', 'kick', 'ban']),
            duration: zod_1.z.string().optional(),
        })
            .strict())
            .default([]),
        decay: zod_1.z
            .object({
            enabled: boolean.default(false),
            after_days: zod_1.z.number().int().min(1).default(30),
        })
            .strict()
            .default({ enabled: false, after_days: 30 }),
    })
        .strict()
        .default({ escalation_ladder: [], decay: { enabled: false, after_days: 30 } }),
    reports: zod_1.z
        .object({
        enabled: boolean.default(true),
        cooldown_seconds: zod_1.z.number().int().min(0).default(30),
        channel_id: snowflake.optional(),
        action_roles: snowflakeArray,
        archive: zod_1.z
            .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
        })
            .strict()
            .default({ enabled: false }),
        merge_window_seconds: zod_1.z.number().int().min(0).default(300),
        false_report_warning_enabled: boolean.default(false),
    })
        .strict()
        .default({}),
    automod: zod_1.z
        .object({
        enabled: boolean.default(true),
        global_immune_roles: snowflakeArray,
        log_channel_id: snowflake.optional(),
        log_thread_id: snowflake.optional(),
        modules: zod_1.z
            .object({
            spam: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(2).default(5), window_seconds: zod_1.z.number().int().min(1).default(5) })
                .strict(),
            cross_channel: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(2).default(5), window_seconds: zod_1.z.number().int().min(1).default(10) })
                .strict(),
            link_filter: zod_1.z
                .object({
                ...automodModuleBase,
                mode: zod_1.z.enum(['deny_all', 'allowlist', 'denylist']).default('deny_all'),
                allowlist: zod_1.z.array(zod_1.z.string()).default([]),
                denylist: zod_1.z.array(zod_1.z.string()).default([]),
            })
                .strict(),
            image_spam: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(2).default(5), window_seconds: zod_1.z.number().int().min(1).default(10) })
                .strict(),
            executable_files: zod_1.z
                .object({ ...automodModuleBase, blocked_extensions: zod_1.z.array(zod_1.z.string()).default(['.exe', '.bat', '.cmd', '.sh', '.jar', '.msi', '.scr', '.ps1', '.vbs', '.com', '.dll']) })
                .strict(),
            mass_images: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(2).default(5), window_seconds: zod_1.z.number().int().min(1).default(10) })
                .strict(),
            invites: zod_1.z
                .object({ ...automodModuleBase, guild_allowlist: snowflakeArray })
                .strict(),
            emoji_spam: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(5).default(10) })
                .strict(),
            line_spam: zod_1.z
                .object({
                ...automodModuleBase,
                per_message_lines: zod_1.z.number().int().min(5).default(20),
                multi_message_lines: zod_1.z.number().int().min(5).default(40),
                multi_message_window_seconds: zod_1.z.number().int().min(1).default(10),
            })
                .strict(),
            poll_spam: zod_1.z
                .object({ ...automodModuleBase, threshold: zod_1.z.number().int().min(2).default(3), window_seconds: zod_1.z.number().int().min(1).default(60) })
                .strict(),
        })
            .strict(),
        risk_scoring: zod_1.z
            .object({
            enabled: boolean.default(false),
            threshold: zod_1.z.number().min(0).default(50),
            join_age_weight: zod_1.z.number().min(0).default(1),
            automod_hit_weight: zod_1.z.number().min(0).default(2),
            cross_channel_weight: zod_1.z.number().min(0).default(1),
            decay_seconds: zod_1.z.number().int().min(1).default(3600),
        })
            .strict()
            .default({}),
        heuristics: zod_1.z
            .object({
            typing_speed: zod_1.z
                .object({
                ...automodModuleBase,
                min_characters_per_second: zod_1.z.number().min(1).default(15),
                window_seconds: zod_1.z.number().int().min(1).default(10),
            })
                .strict()
                .default(() => ({ enabled: false, action_chain: [...chainDefaults_1.DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent', shadow_mode: false, min_characters_per_second: 15, window_seconds: 10 })),
            mass_identical_joins: zod_1.z
                .object({
                ...automodModuleBase,
                threshold: zod_1.z.number().int().min(2).default(5),
                window_seconds: zod_1.z.number().int().min(1).default(120),
            })
                .strict()
                .default(() => ({ enabled: false, action_chain: [...chainDefaults_1.DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent', shadow_mode: false, threshold: 5, window_seconds: 120 })),
            new_account_velocity: zod_1.z
                .object({
                ...automodModuleBase,
                max_account_age_days: zod_1.z.number().min(0).default(7),
                threshold: zod_1.z.number().int().min(2).default(3),
                window_seconds: zod_1.z.number().int().min(1).default(600),
            })
                .strict()
                .default(() => ({ enabled: false, action_chain: [...chainDefaults_1.DEFAULT_WARN_CHAIN], immune_roles: [], channel_ignore_list: [], log_channel_id: undefined, log_thread_id: undefined, suppress_repeat_response_seconds: 0, suppressed_response_mode: 'silent', shadow_mode: false, max_account_age_days: 7, threshold: 3, window_seconds: 600 })),
        })
            .strict()
            .default({}),
    })
        .strict(),
    regex_engine: zod_1.z
        .object({
        enabled: boolean.default(true),
        rules: zod_1.z
            .array(zod_1.z
            .object({
            name: zod_1.z.string().min(1),
            pattern: zod_1.z.string().min(1),
            flags: zod_1.z.string().max(10).default('gi'),
            scope: zod_1.z.enum(['message', 'username', 'nickname']).default('message'),
            enabled: boolean.default(true),
            immune_roles: snowflakeArray,
            action_chain: actions_1.actionChainSchema,
        })
            .strict())
            .default([]),
    })
        .strict()
        .default({ enabled: true, rules: [] }),
    punishment_dms: zod_1.z
        .object({
        enabled: boolean.default(true),
        hide_moderator: boolean.default(false),
        order: zod_1.z.enum(['before', 'after']).default('after'),
        types: zod_1.z
            .record(zod_1.z.enum(['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute']), exports.punishmentDmTypeSchema)
            .default({}),
    })
        .strict()
        .default({}),
    escalation: zod_1.z
        .object({
        enabled: boolean.default(true),
        window_seconds: zod_1.z.number().int().min(1).default(3600),
        rules: zod_1.z
            .array(zod_1.z
            .object({
            rule: zod_1.z.string().min(1),
            count: zod_1.z.number().int().min(2),
            within_seconds: zod_1.z.number().int().min(1).default(3600),
            action: exports.escalationActionSchema,
        })
            .strict())
            .default([]),
        global: zod_1.z
            .array(zod_1.z
            .object({
            count: zod_1.z.number().int().min(2),
            within_seconds: zod_1.z.number().int().min(1).default(3600),
            action: exports.escalationActionSchema,
        })
            .strict())
            .default([]),
    })
        .strict()
        .default({}),
    join_roles: zod_1.z
        .object({
        roles: snowflakeArray,
        bot_roles: snowflakeArray,
    })
        .strict()
        .default({ roles: [], bot_roles: [] }),
    welcome: zod_1.z
        .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: zod_1.z.string().default('Welcome {user} to {guild}!'),
    })
        .strict()
        .default({ enabled: false, message: 'Welcome {user} to {guild}!' }),
    goodbye: zod_1.z
        .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: zod_1.z.string().default('{user} has left {guild}.'),
    })
        .strict()
        .default({ enabled: false, message: '{user} has left {guild}.' }),
    booster: zod_1.z
        .object({
        enabled: boolean.default(false),
        channel_id: snowflake.optional(),
        message: zod_1.z.string().default('Thank you for boosting {guild}, {user}!'),
    })
        .strict()
        .default({ enabled: false, message: 'Thank you for boosting {guild}, {user}!' }),
    role_connections: zod_1.z
        .array(zod_1.z
        .object({
        enabled: boolean.default(true),
        if_has_role: snowflake,
        held_for_seconds: zod_1.z.number().int().min(0).default(0),
        then_add: snowflakeArray,
        then_remove: snowflakeArray,
    })
        .strict())
        .default([]),
    channel_locking: zod_1.z
        .object({
        presets: zod_1.z
            .array(zod_1.z
            .object({
            name: zod_1.z.string().min(1),
            channels: snowflakeArray,
            categories: snowflakeArray,
            all_channels: boolean.default(false),
            exclude_roles: snowflakeArray,
            deny_permissions: zod_1.z.array(zod_1.z.string()).default(['SendMessages', 'AddReactions']),
            schedule: zod_1.z
                .array(zod_1.z
                .object({
                cron: zod_1.z.string().min(1),
                action: zod_1.z.enum(['lock', 'unlock']),
            })
                .strict())
                .default([]),
        })
            .strict())
            .default([]),
    })
        .strict()
        .default({ presets: [] }),
    anti_raid: zod_1.z
        .object({
        enabled: boolean.default(false),
        join_rate_threshold: zod_1.z.number().int().min(2).default(10),
        window_seconds: zod_1.z.number().int().min(1).default(60),
        action: zod_1.z.enum(['lock_joins', 'timeout_joiners', 'verify_gate']).default('lock_joins'),
    })
        .strict()
        .default({}),
    sticky_messages: zod_1.z
        .object({
        enabled: boolean.default(false),
        re_post_after_messages: zod_1.z.number().int().min(1).default(5),
    })
        .strict()
        .default({}),
    slowmode_scheduler: zod_1.z
        .object({
        enabled: boolean.default(false),
        threshold_messages_per_minute: zod_1.z.number().int().min(1).default(30),
        slowmode_seconds: zod_1.z.number().int().min(1).default(10),
        revert_after_minutes: zod_1.z.number().int().min(1).default(15),
    })
        .strict()
        .default({}),
    sticky_roles: zod_1.z
        .object({
        enabled: boolean.default(false),
    })
        .strict()
        .default({}),
    invite_tracking: zod_1.z
        .object({
        enabled: boolean.default(false),
    })
        .strict()
        .default({}),
    tickets: zod_1.z
        .object({
        enabled: boolean.default(false),
        category_id: snowflake.optional(),
        support_roles: snowflakeArray,
        transcript_channel_id: snowflake.optional(),
    })
        .strict()
        .default({}),
    modmail: zod_1.z
        .object({
        enabled: boolean.default(false),
        category_id: snowflake.optional(),
        support_roles: snowflakeArray,
        transcript_channel_id: snowflake.optional(),
    })
        .strict()
        .default({}),
    verification_gate: zod_1.z
        .object({
        enabled: boolean.default(false),
        button_channel_id: snowflake.optional(),
        verified_role_id: snowflake.optional(),
        timeout_kick_seconds: zod_1.z.number().int().min(0).default(0),
    })
        .strict()
        .default({}),
    quarantine: zod_1.z
        .object({
        enabled: boolean.default(true),
        restricted_role_id: snowflake.optional(),
    })
        .strict()
        .default({}),
    blacklist: zod_1.z
        .object({
        enabled: boolean.default(true),
        action: zod_1.z.enum(['ban', 'kick', 'flag']).default('flag'),
        silently_flag: boolean.default(false),
    })
        .strict()
        .default({}),
    alt_detection: zod_1.z
        .object({
        enabled: boolean.default(false),
        max_account_age_days: zod_1.z.number().int().min(0).default(7),
    })
        .strict()
        .default({}),
    trust_levels: zod_1.z
        .object({
        enabled: boolean.default(false),
        levels: zod_1.z
            .array(zod_1.z
            .object({
            level: zod_1.z.number().int().min(1),
            after_days: zod_1.z.number().int().min(1),
            require_clean_history: boolean.default(true),
            roles: snowflakeArray,
        })
            .strict())
            .default([]),
    })
        .strict()
        .default({}),
    fuzzy: zod_1.z
        .object({
        enabled: boolean.default(true),
        max_distance: zod_1.z.number().int().min(1).max(5).default(2),
        cooldown_seconds: zod_1.z.number().int().min(0).default(15),
    })
        .strict()
        .default({}),
    staff_permission_groups: zod_1.z
        .object({
        groups: zod_1.z
            .array(zod_1.z
            .object({
            name: zod_1.z.string().min(1),
            roles: snowflakeArray,
            permissions: zod_1.z.array(zod_1.z.string()).default([]),
        })
            .strict())
            .default([]),
    })
        .strict()
        .default({ groups: [] }),
    community: zod_1.z
        .object({
        starboard: zod_1.z
            .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
            threshold: zod_1.z.number().int().min(1).default(3),
        })
            .strict()
            .default({}),
        suggestions: zod_1.z
            .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
        })
            .strict()
            .default({}),
        giveaways: zod_1.z
            .object({
            enabled: boolean.default(false),
        })
            .strict()
            .default({}),
        levels: zod_1.z
            .object({
            enabled: boolean.default(false),
            message_xp: zod_1.z.number().min(0).default(15),
            xp_cooldown_seconds: zod_1.z.number().int().min(0).default(60),
            level_up_roles: zod_1.z
                .array(zod_1.z
                .object({
                level: zod_1.z.number().int().min(1),
                role_id: snowflake,
            })
                .strict())
                .default([]),
        })
            .strict()
            .default({}),
        status_rotation: zod_1.z
            .object({
            enabled: boolean.default(false),
            interval_seconds: zod_1.z.number().int().min(10).default(300),
            statuses: zod_1.z.array(zod_1.z.string().min(1)).default([]),
        })
            .strict()
            .default({}),
        birthdays: zod_1.z
            .object({
            enabled: boolean.default(false),
            channel_id: snowflake.optional(),
            timezone: zod_1.z.string().default('UTC'),
        })
            .strict()
            .default({}),
    })
        .strict()
        .default({}),
    dashboard: zod_1.z
        .object({
        enabled: boolean.default(true),
        port: zod_1.z.number().int().min(1).max(65535).default(4693),
        owner_user_id: snowflake.optional(),
        live_log_retention_hours: zod_1.z.number().int().min(1).default(24),
        timestamp_defaults: zod_1.z
            .object({
            timezone: zod_1.z.string().default('UTC'),
        })
            .strict()
            .default({ timezone: 'UTC' }),
    })
        .strict()
        .default({}),
    error_reporting: zod_1.z
        .object({
        enabled: boolean.default(true),
        channel_id: snowflake.optional(),
        verbosity: zod_1.z.enum(['minimal', 'standard', 'verbose']).default('standard'),
        webhook_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    })
        .strict()
        .default({}),
    rate_limit_reporting: zod_1.z
        .object({
        enabled: boolean.default(true),
        channel_id: snowflake.optional(),
        webhook_url: zod_1.z.string().url().or(zod_1.z.literal('')).optional(),
    })
        .strict()
        .default({}),
    ops: zod_1.z
        .object({
        backups_enabled: boolean.default(true),
        backup_retention_count: zod_1.z.number().int().min(1).default(7),
        usage_analytics: boolean.default(true),
        snipe_retention_seconds: zod_1.z.number().int().min(0).default(600),
    })
        .strict()
        .default({}),
})
    .strict();
exports.PUNISHMENT_TYPES = ['warn', 'mute', 'kick', 'ban', 'timeout', 'unban', 'unmute'];
exports.LOG_EVENT_NAMES = [
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
];
//# sourceMappingURL=schema.js.map
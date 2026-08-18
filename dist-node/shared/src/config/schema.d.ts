import { z } from 'zod';
export declare const commandSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    slash: z.ZodDefault<z.ZodBoolean>;
    prefix: z.ZodDefault<z.ZodBoolean>;
    cooldown_seconds: z.ZodDefault<z.ZodNumber>;
    permissions: z.ZodDefault<z.ZodArray<z.ZodEnum<["CreateInstantInvite", "KickMembers", "BanMembers", "Administrator", "ManageChannels", "ManageGuild", "AddReactions", "ViewAuditLog", "PrioritySpeaker", "Stream", "ViewChannel", "SendMessages", "SendTTSMessages", "ManageMessages", "EmbedLinks", "AttachFiles", "ReadMessageHistory", "MentionEveryone", "UseExternalEmojis", "ViewGuildInsights", "Connect", "Speak", "MuteMembers", "DeafenMembers", "MoveMembers", "UseVAD", "ChangeNickname", "ManageNicknames", "ManageRoles", "ManageWebhooks", "ManageGuildExpressions", "UseApplicationCommands", "RequestToSpeak", "ManageEvents", "ManageThreads", "CreatePublicThreads", "CreatePrivateThreads", "UseExternalStickers", "SendMessagesInThreads", "UseEmbeddedActivities", "ModerateMembers", "ViewCreatorMonetizationAnalytics", "UseSoundboard", "CreateGuildExpressions", "CreateEvents", "UseExternalSounds", "SendVoiceMessages", "SendPolls", "UseExternalApps", "SendMessagesInPolls"]>, "many">>;
    immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    permission_group: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    slash: boolean;
    prefix: boolean;
    cooldown_seconds: number;
    permissions: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[];
    immune_roles: string[];
    aliases: string[];
    permission_group?: string | undefined;
}, {
    enabled?: boolean | undefined;
    slash?: boolean | undefined;
    prefix?: boolean | undefined;
    cooldown_seconds?: number | undefined;
    permissions?: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[] | undefined;
    immune_roles?: string[] | undefined;
    aliases?: string[] | undefined;
    permission_group?: string | undefined;
}>;
export declare const loggingEntrySchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    channel_id: z.ZodOptional<z.ZodString>;
    thread_id: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    enabled: boolean;
    channel_id?: string | undefined;
    thread_id?: string | undefined;
}, {
    enabled?: boolean | undefined;
    channel_id?: string | undefined;
    thread_id?: string | undefined;
}>;
export declare const escalationActionSchema: z.ZodObject<{
    type: z.ZodEnum<["mute", "timeout", "kick", "ban"]>;
    duration: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    type: "mute" | "timeout" | "ban" | "kick";
    duration?: string | undefined;
}, {
    type: "mute" | "timeout" | "ban" | "kick";
    duration?: string | undefined;
}>;
export declare const punishmentDmTypeSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
    content: z.ZodString;
}, "strict", z.ZodTypeAny, {
    format: "plain" | "embed" | "components_v2";
    content: string;
    enabled: boolean;
}, {
    content: string;
    format?: "plain" | "embed" | "components_v2" | undefined;
    enabled?: boolean | undefined;
}>;
export declare const configSchema: z.ZodObject<{
    bot: z.ZodObject<{
        prefixes: z.ZodArray<z.ZodString, "many">;
        prefix_enabled: z.ZodDefault<z.ZodBoolean>;
        slash_enabled: z.ZodDefault<z.ZodBoolean>;
        per_guild_prefixes: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>>;
        status: z.ZodDefault<z.ZodEnum<["online", "idle", "dnd", "invisible"]>>;
        activity: z.ZodDefault<z.ZodObject<{
            type: z.ZodDefault<z.ZodEnum<["Playing", "Streaming", "Listening", "Watching", "Competing"]>>;
            text: z.ZodDefault<z.ZodString>;
            url: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
        }, "strip", z.ZodTypeAny, {
            type: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing";
            text: string;
            url?: string | undefined;
        }, {
            type?: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing" | undefined;
            text?: string | undefined;
            url?: string | undefined;
        }>>;
        owner_ids: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        status: "online" | "idle" | "dnd" | "invisible";
        prefixes: string[];
        prefix_enabled: boolean;
        slash_enabled: boolean;
        per_guild_prefixes: Record<string, string[]>;
        activity: {
            type: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing";
            text: string;
            url?: string | undefined;
        };
        owner_ids: string[];
    }, {
        prefixes: string[];
        owner_ids: string[];
        status?: "online" | "idle" | "dnd" | "invisible" | undefined;
        prefix_enabled?: boolean | undefined;
        slash_enabled?: boolean | undefined;
        per_guild_prefixes?: Record<string, string[]> | undefined;
        activity?: {
            type?: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing" | undefined;
            text?: string | undefined;
            url?: string | undefined;
        } | undefined;
    }>;
    commands: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        slash: z.ZodDefault<z.ZodBoolean>;
        prefix: z.ZodDefault<z.ZodBoolean>;
        cooldown_seconds: z.ZodDefault<z.ZodNumber>;
        permissions: z.ZodDefault<z.ZodArray<z.ZodEnum<["CreateInstantInvite", "KickMembers", "BanMembers", "Administrator", "ManageChannels", "ManageGuild", "AddReactions", "ViewAuditLog", "PrioritySpeaker", "Stream", "ViewChannel", "SendMessages", "SendTTSMessages", "ManageMessages", "EmbedLinks", "AttachFiles", "ReadMessageHistory", "MentionEveryone", "UseExternalEmojis", "ViewGuildInsights", "Connect", "Speak", "MuteMembers", "DeafenMembers", "MoveMembers", "UseVAD", "ChangeNickname", "ManageNicknames", "ManageRoles", "ManageWebhooks", "ManageGuildExpressions", "UseApplicationCommands", "RequestToSpeak", "ManageEvents", "ManageThreads", "CreatePublicThreads", "CreatePrivateThreads", "UseExternalStickers", "SendMessagesInThreads", "UseEmbeddedActivities", "ModerateMembers", "ViewCreatorMonetizationAnalytics", "UseSoundboard", "CreateGuildExpressions", "CreateEvents", "UseExternalSounds", "SendVoiceMessages", "SendPolls", "UseExternalApps", "SendMessagesInPolls"]>, "many">>;
        immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        aliases: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        permission_group: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        slash: boolean;
        prefix: boolean;
        cooldown_seconds: number;
        permissions: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[];
        immune_roles: string[];
        aliases: string[];
        permission_group?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        slash?: boolean | undefined;
        prefix?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        permissions?: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[] | undefined;
        immune_roles?: string[] | undefined;
        aliases?: string[] | undefined;
        permission_group?: string | undefined;
    }>>>;
    command_defaults: z.ZodDefault<z.ZodObject<{
        cooldown_seconds: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        cooldown_seconds: number;
    }, {
        cooldown_seconds?: number | undefined;
    }>>;
    logging: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        thread_id: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        channel_id?: string | undefined;
        thread_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        thread_id?: string | undefined;
    }>>>;
    warnings: z.ZodDefault<z.ZodObject<{
        escalation_ladder: z.ZodDefault<z.ZodArray<z.ZodObject<{
            count: z.ZodNumber;
            action: z.ZodEnum<["mute", "kick", "ban"]>;
            duration: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }, {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }>, "many">>;
        decay: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            after_days: z.ZodDefault<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            after_days: number;
        }, {
            enabled?: boolean | undefined;
            after_days?: number | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        escalation_ladder: {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }[];
        decay: {
            enabled: boolean;
            after_days: number;
        };
    }, {
        escalation_ladder?: {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }[] | undefined;
        decay?: {
            enabled?: boolean | undefined;
            after_days?: number | undefined;
        } | undefined;
    }>>;
    reports: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        cooldown_seconds: z.ZodDefault<z.ZodNumber>;
        channel_id: z.ZodOptional<z.ZodString>;
        action_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        archive: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channel_id: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            channel_id?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        }>>;
        merge_window_seconds: z.ZodDefault<z.ZodNumber>;
        false_report_warning_enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        cooldown_seconds: number;
        action_roles: string[];
        archive: {
            enabled: boolean;
            channel_id?: string | undefined;
        };
        merge_window_seconds: number;
        false_report_warning_enabled: boolean;
        channel_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        channel_id?: string | undefined;
        action_roles?: string[] | undefined;
        archive?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        } | undefined;
        merge_window_seconds?: number | undefined;
        false_report_warning_enabled?: boolean | undefined;
    }>>;
    automod: z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        global_immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        log_channel_id: z.ZodOptional<z.ZodString>;
        log_thread_id: z.ZodOptional<z.ZodString>;
        modules: z.ZodObject<{
            spam: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
            cross_channel: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
            link_filter: z.ZodObject<{
                mode: z.ZodDefault<z.ZodEnum<["deny_all", "allowlist", "denylist"]>>;
                allowlist: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                denylist: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                allowlist: string[];
                denylist: string[];
                mode: "deny_all" | "allowlist" | "denylist";
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                allowlist?: string[] | undefined;
                denylist?: string[] | undefined;
                mode?: "deny_all" | "allowlist" | "denylist" | undefined;
            }>;
            image_spam: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
            executable_files: z.ZodObject<{
                blocked_extensions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                blocked_extensions: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                blocked_extensions?: string[] | undefined;
            }>;
            mass_images: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
            invites: z.ZodObject<{
                guild_allowlist: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                guild_allowlist: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                guild_allowlist?: string[] | undefined;
            }>;
            emoji_spam: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
            line_spam: z.ZodObject<{
                per_message_lines: z.ZodDefault<z.ZodNumber>;
                multi_message_lines: z.ZodDefault<z.ZodNumber>;
                multi_message_window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                per_message_lines: number;
                multi_message_lines: number;
                multi_message_window_seconds: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                per_message_lines?: number | undefined;
                multi_message_lines?: number | undefined;
                multi_message_window_seconds?: number | undefined;
            }>;
            poll_spam: z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            cross_channel: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            link_filter: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                allowlist: string[];
                denylist: string[];
                mode: "deny_all" | "allowlist" | "denylist";
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            image_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            executable_files: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                blocked_extensions: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_images: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            invites: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                guild_allowlist: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            emoji_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            line_spam: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                per_message_lines: number;
                multi_message_lines: number;
                multi_message_window_seconds: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            poll_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        }, {
            spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            cross_channel: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            link_filter: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                allowlist?: string[] | undefined;
                denylist?: string[] | undefined;
                mode?: "deny_all" | "allowlist" | "denylist" | undefined;
            };
            image_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            executable_files: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                blocked_extensions?: string[] | undefined;
            };
            mass_images: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            invites: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                guild_allowlist?: string[] | undefined;
            };
            emoji_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            line_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                per_message_lines?: number | undefined;
                multi_message_lines?: number | undefined;
                multi_message_window_seconds?: number | undefined;
            };
            poll_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
        }>;
        risk_scoring: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            threshold: z.ZodDefault<z.ZodNumber>;
            join_age_weight: z.ZodDefault<z.ZodNumber>;
            automod_hit_weight: z.ZodDefault<z.ZodNumber>;
            cross_channel_weight: z.ZodDefault<z.ZodNumber>;
            decay_seconds: z.ZodDefault<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            threshold: number;
            join_age_weight: number;
            automod_hit_weight: number;
            cross_channel_weight: number;
            decay_seconds: number;
        }, {
            enabled?: boolean | undefined;
            threshold?: number | undefined;
            join_age_weight?: number | undefined;
            automod_hit_weight?: number | undefined;
            cross_channel_weight?: number | undefined;
            decay_seconds?: number | undefined;
        }>>;
        heuristics: z.ZodDefault<z.ZodObject<{
            typing_speed: z.ZodDefault<z.ZodObject<{
                min_characters_per_second: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                min_characters_per_second: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                min_characters_per_second?: number | undefined;
            }>>;
            mass_identical_joins: z.ZodDefault<z.ZodObject<{
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            }>>;
            new_account_velocity: z.ZodDefault<z.ZodObject<{
                max_account_age_days: z.ZodDefault<z.ZodNumber>;
                threshold: z.ZodDefault<z.ZodNumber>;
                window_seconds: z.ZodDefault<z.ZodNumber>;
                enabled: z.ZodDefault<z.ZodBoolean>;
                immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                channel_ignore_list: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                    type: z.ZodLiteral<"delete_message">;
                }, "strict", z.ZodTypeAny, {
                    type: "delete_message";
                }, {
                    type: "delete_message";
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"send_channel_message">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                    delete_after_seconds: z.ZodDefault<z.ZodNumber>;
                }, "strict", z.ZodTypeAny, {
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                }, {
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"dm_user">;
                    format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                    content: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                }, {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"warn">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "warn";
                    reason?: string | undefined;
                }, {
                    type: "warn";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodEnum<["mute", "timeout", "ban"]>;
                    duration: z.ZodDefault<z.ZodString>;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                }, {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"kick">;
                    reason: z.ZodOptional<z.ZodString>;
                }, "strict", z.ZodTypeAny, {
                    type: "kick";
                    reason?: string | undefined;
                }, {
                    type: "kick";
                    reason?: string | undefined;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"add_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "add_role";
                    role_id: string;
                }, {
                    type: "add_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"remove_role">;
                    role_id: z.ZodString;
                }, "strict", z.ZodTypeAny, {
                    type: "remove_role";
                    role_id: string;
                }, {
                    type: "remove_role";
                    role_id: string;
                }>, z.ZodObject<{
                    type: z.ZodLiteral<"run_escalation_check">;
                }, "strict", z.ZodTypeAny, {
                    type: "run_escalation_check";
                }, {
                    type: "run_escalation_check";
                }>]>, "many">;
                log_channel_id: z.ZodOptional<z.ZodString>;
                log_thread_id: z.ZodOptional<z.ZodString>;
                suppress_repeat_response_seconds: z.ZodDefault<z.ZodNumber>;
                suppressed_response_mode: z.ZodDefault<z.ZodEnum<["silent", "batched_summary"]>>;
                shadow_mode: z.ZodDefault<z.ZodBoolean>;
            }, "strict", z.ZodTypeAny, {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                max_account_age_days: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            }, {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                max_account_age_days?: number | undefined;
            }>>;
        }, "strict", z.ZodTypeAny, {
            typing_speed: {
                enabled: boolean;
                immune_roles: string[];
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                min_characters_per_second: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_identical_joins: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            new_account_velocity: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                max_account_age_days: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        }, {
            typing_speed?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                min_characters_per_second?: number | undefined;
            } | undefined;
            mass_identical_joins?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            } | undefined;
            new_account_velocity?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                max_account_age_days?: number | undefined;
            } | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        global_immune_roles: string[];
        modules: {
            spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            cross_channel: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            link_filter: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                allowlist: string[];
                denylist: string[];
                mode: "deny_all" | "allowlist" | "denylist";
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            image_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            executable_files: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                blocked_extensions: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_images: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            invites: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                guild_allowlist: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            emoji_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            line_spam: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                per_message_lines: number;
                multi_message_lines: number;
                multi_message_window_seconds: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            poll_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        };
        risk_scoring: {
            enabled: boolean;
            threshold: number;
            join_age_weight: number;
            automod_hit_weight: number;
            cross_channel_weight: number;
            decay_seconds: number;
        };
        heuristics: {
            typing_speed: {
                enabled: boolean;
                immune_roles: string[];
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                min_characters_per_second: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_identical_joins: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            new_account_velocity: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                max_account_age_days: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        };
        log_channel_id?: string | undefined;
        log_thread_id?: string | undefined;
    }, {
        modules: {
            spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            cross_channel: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            link_filter: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                allowlist?: string[] | undefined;
                denylist?: string[] | undefined;
                mode?: "deny_all" | "allowlist" | "denylist" | undefined;
            };
            image_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            executable_files: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                blocked_extensions?: string[] | undefined;
            };
            mass_images: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            invites: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                guild_allowlist?: string[] | undefined;
            };
            emoji_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            line_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                per_message_lines?: number | undefined;
                multi_message_lines?: number | undefined;
                multi_message_window_seconds?: number | undefined;
            };
            poll_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
        };
        enabled?: boolean | undefined;
        global_immune_roles?: string[] | undefined;
        log_channel_id?: string | undefined;
        log_thread_id?: string | undefined;
        risk_scoring?: {
            enabled?: boolean | undefined;
            threshold?: number | undefined;
            join_age_weight?: number | undefined;
            automod_hit_weight?: number | undefined;
            cross_channel_weight?: number | undefined;
            decay_seconds?: number | undefined;
        } | undefined;
        heuristics?: {
            typing_speed?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                min_characters_per_second?: number | undefined;
            } | undefined;
            mass_identical_joins?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            } | undefined;
            new_account_velocity?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                max_account_age_days?: number | undefined;
            } | undefined;
        } | undefined;
    }>;
    regex_engine: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            pattern: z.ZodString;
            flags: z.ZodDefault<z.ZodString>;
            scope: z.ZodDefault<z.ZodEnum<["message", "username", "nickname"]>>;
            enabled: z.ZodDefault<z.ZodBoolean>;
            immune_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            action_chain: z.ZodArray<z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
                type: z.ZodLiteral<"delete_message">;
            }, "strict", z.ZodTypeAny, {
                type: "delete_message";
            }, {
                type: "delete_message";
            }>, z.ZodObject<{
                type: z.ZodLiteral<"send_channel_message">;
                format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                content: z.ZodString;
                delete_after_seconds: z.ZodDefault<z.ZodNumber>;
            }, "strict", z.ZodTypeAny, {
                type: "send_channel_message";
                format: "plain" | "embed" | "components_v2";
                content: string;
                delete_after_seconds: number;
            }, {
                type: "send_channel_message";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
                delete_after_seconds?: number | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"dm_user">;
                format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
                content: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                type: "dm_user";
                format: "plain" | "embed" | "components_v2";
                content: string;
            }, {
                type: "dm_user";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"warn">;
                reason: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "warn";
                reason?: string | undefined;
            }, {
                type: "warn";
                reason?: string | undefined;
            }>, z.ZodObject<{
                type: z.ZodEnum<["mute", "timeout", "ban"]>;
                duration: z.ZodDefault<z.ZodString>;
                reason: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "mute" | "timeout" | "ban";
                duration: string;
                reason?: string | undefined;
            }, {
                type: "mute" | "timeout" | "ban";
                duration?: string | undefined;
                reason?: string | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"kick">;
                reason: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "kick";
                reason?: string | undefined;
            }, {
                type: "kick";
                reason?: string | undefined;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"add_role">;
                role_id: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                type: "add_role";
                role_id: string;
            }, {
                type: "add_role";
                role_id: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"remove_role">;
                role_id: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                type: "remove_role";
                role_id: string;
            }, {
                type: "remove_role";
                role_id: string;
            }>, z.ZodObject<{
                type: z.ZodLiteral<"run_escalation_check">;
            }, "strict", z.ZodTypeAny, {
                type: "run_escalation_check";
            }, {
                type: "run_escalation_check";
            }>]>, "many">;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            immune_roles: string[];
            action_chain: ({
                type: "send_channel_message";
                format: "plain" | "embed" | "components_v2";
                content: string;
                delete_after_seconds: number;
            } | {
                type: "dm_user";
                format: "plain" | "embed" | "components_v2";
                content: string;
            } | {
                type: "mute" | "timeout" | "ban";
                duration: string;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            flags: string;
            scope: "message" | "username" | "nickname";
        }, {
            action_chain: ({
                type: "send_channel_message";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
                delete_after_seconds?: number | undefined;
            } | {
                type: "dm_user";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
            } | {
                type: "mute" | "timeout" | "ban";
                duration?: string | undefined;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            enabled?: boolean | undefined;
            immune_roles?: string[] | undefined;
            flags?: string | undefined;
            scope?: "message" | "username" | "nickname" | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        rules: {
            enabled: boolean;
            immune_roles: string[];
            action_chain: ({
                type: "send_channel_message";
                format: "plain" | "embed" | "components_v2";
                content: string;
                delete_after_seconds: number;
            } | {
                type: "dm_user";
                format: "plain" | "embed" | "components_v2";
                content: string;
            } | {
                type: "mute" | "timeout" | "ban";
                duration: string;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            flags: string;
            scope: "message" | "username" | "nickname";
        }[];
    }, {
        enabled?: boolean | undefined;
        rules?: {
            action_chain: ({
                type: "send_channel_message";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
                delete_after_seconds?: number | undefined;
            } | {
                type: "dm_user";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
            } | {
                type: "mute" | "timeout" | "ban";
                duration?: string | undefined;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            enabled?: boolean | undefined;
            immune_roles?: string[] | undefined;
            flags?: string | undefined;
            scope?: "message" | "username" | "nickname" | undefined;
        }[] | undefined;
    }>>;
    punishment_dms: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        hide_moderator: z.ZodDefault<z.ZodBoolean>;
        order: z.ZodDefault<z.ZodEnum<["before", "after"]>>;
        types: z.ZodDefault<z.ZodRecord<z.ZodEnum<["warn", "mute", "kick", "ban", "timeout", "unban", "unmute"]>, z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            format: z.ZodDefault<z.ZodEnum<["plain", "embed", "components_v2"]>>;
            content: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            format: "plain" | "embed" | "components_v2";
            content: string;
            enabled: boolean;
        }, {
            content: string;
            format?: "plain" | "embed" | "components_v2" | undefined;
            enabled?: boolean | undefined;
        }>>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        hide_moderator: boolean;
        order: "before" | "after";
        types: Partial<Record<"mute" | "timeout" | "ban" | "warn" | "kick" | "unban" | "unmute", {
            format: "plain" | "embed" | "components_v2";
            content: string;
            enabled: boolean;
        }>>;
    }, {
        enabled?: boolean | undefined;
        hide_moderator?: boolean | undefined;
        order?: "before" | "after" | undefined;
        types?: Partial<Record<"mute" | "timeout" | "ban" | "warn" | "kick" | "unban" | "unmute", {
            content: string;
            format?: "plain" | "embed" | "components_v2" | undefined;
            enabled?: boolean | undefined;
        }>> | undefined;
    }>>;
    escalation: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        window_seconds: z.ZodDefault<z.ZodNumber>;
        rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
            rule: z.ZodString;
            count: z.ZodNumber;
            within_seconds: z.ZodDefault<z.ZodNumber>;
            action: z.ZodObject<{
                type: z.ZodEnum<["mute", "timeout", "kick", "ban"]>;
                duration: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            }, {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds: number;
        }, {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds?: number | undefined;
        }>, "many">>;
        global: z.ZodDefault<z.ZodArray<z.ZodObject<{
            count: z.ZodNumber;
            within_seconds: z.ZodDefault<z.ZodNumber>;
            action: z.ZodObject<{
                type: z.ZodEnum<["mute", "timeout", "kick", "ban"]>;
                duration: z.ZodOptional<z.ZodString>;
            }, "strict", z.ZodTypeAny, {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            }, {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            }>;
        }, "strict", z.ZodTypeAny, {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds: number;
        }, {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds?: number | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        window_seconds: number;
        rules: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds: number;
        }[];
        global: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds: number;
        }[];
    }, {
        enabled?: boolean | undefined;
        window_seconds?: number | undefined;
        rules?: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds?: number | undefined;
        }[] | undefined;
        global?: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds?: number | undefined;
        }[] | undefined;
    }>>;
    join_roles: z.ZodDefault<z.ZodObject<{
        roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        bot_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        roles: string[];
        bot_roles: string[];
    }, {
        roles?: string[] | undefined;
        bot_roles?: string[] | undefined;
    }>>;
    welcome: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        message: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    }, {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    }>>;
    goodbye: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        message: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    }, {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    }>>;
    booster: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        message: z.ZodDefault<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    }, {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    }>>;
    role_connections: z.ZodDefault<z.ZodArray<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        if_has_role: z.ZodString;
        held_for_seconds: z.ZodDefault<z.ZodNumber>;
        then_add: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        then_remove: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        if_has_role: string;
        held_for_seconds: number;
        then_add: string[];
        then_remove: string[];
    }, {
        if_has_role: string;
        enabled?: boolean | undefined;
        held_for_seconds?: number | undefined;
        then_add?: string[] | undefined;
        then_remove?: string[] | undefined;
    }>, "many">>;
    channel_locking: z.ZodDefault<z.ZodObject<{
        presets: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            channels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            categories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            all_channels: z.ZodDefault<z.ZodBoolean>;
            exclude_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            deny_permissions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            schedule: z.ZodDefault<z.ZodArray<z.ZodObject<{
                cron: z.ZodString;
                action: z.ZodEnum<["lock", "unlock"]>;
            }, "strict", z.ZodTypeAny, {
                action: "lock" | "unlock";
                cron: string;
            }, {
                action: "lock" | "unlock";
                cron: string;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            name: string;
            channels: string[];
            categories: string[];
            all_channels: boolean;
            exclude_roles: string[];
            deny_permissions: string[];
            schedule: {
                action: "lock" | "unlock";
                cron: string;
            }[];
        }, {
            name: string;
            channels?: string[] | undefined;
            categories?: string[] | undefined;
            all_channels?: boolean | undefined;
            exclude_roles?: string[] | undefined;
            deny_permissions?: string[] | undefined;
            schedule?: {
                action: "lock" | "unlock";
                cron: string;
            }[] | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        presets: {
            name: string;
            channels: string[];
            categories: string[];
            all_channels: boolean;
            exclude_roles: string[];
            deny_permissions: string[];
            schedule: {
                action: "lock" | "unlock";
                cron: string;
            }[];
        }[];
    }, {
        presets?: {
            name: string;
            channels?: string[] | undefined;
            categories?: string[] | undefined;
            all_channels?: boolean | undefined;
            exclude_roles?: string[] | undefined;
            deny_permissions?: string[] | undefined;
            schedule?: {
                action: "lock" | "unlock";
                cron: string;
            }[] | undefined;
        }[] | undefined;
    }>>;
    anti_raid: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        join_rate_threshold: z.ZodDefault<z.ZodNumber>;
        window_seconds: z.ZodDefault<z.ZodNumber>;
        action: z.ZodDefault<z.ZodEnum<["lock_joins", "timeout_joiners", "verify_gate"]>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        action: "lock_joins" | "timeout_joiners" | "verify_gate";
        window_seconds: number;
        join_rate_threshold: number;
    }, {
        enabled?: boolean | undefined;
        action?: "lock_joins" | "timeout_joiners" | "verify_gate" | undefined;
        window_seconds?: number | undefined;
        join_rate_threshold?: number | undefined;
    }>>;
    sticky_messages: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        re_post_after_messages: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        re_post_after_messages: number;
    }, {
        enabled?: boolean | undefined;
        re_post_after_messages?: number | undefined;
    }>>;
    slowmode_scheduler: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        threshold_messages_per_minute: z.ZodDefault<z.ZodNumber>;
        slowmode_seconds: z.ZodDefault<z.ZodNumber>;
        revert_after_minutes: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        threshold_messages_per_minute: number;
        slowmode_seconds: number;
        revert_after_minutes: number;
    }, {
        enabled?: boolean | undefined;
        threshold_messages_per_minute?: number | undefined;
        slowmode_seconds?: number | undefined;
        revert_after_minutes?: number | undefined;
    }>>;
    sticky_roles: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>>;
    invite_tracking: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
    }, {
        enabled?: boolean | undefined;
    }>>;
    tickets: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        category_id: z.ZodOptional<z.ZodString>;
        support_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        transcript_channel_id: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        support_roles: string[];
        category_id?: string | undefined;
        transcript_channel_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        category_id?: string | undefined;
        support_roles?: string[] | undefined;
        transcript_channel_id?: string | undefined;
    }>>;
    modmail: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        category_id: z.ZodOptional<z.ZodString>;
        support_roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        transcript_channel_id: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        support_roles: string[];
        category_id?: string | undefined;
        transcript_channel_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        category_id?: string | undefined;
        support_roles?: string[] | undefined;
        transcript_channel_id?: string | undefined;
    }>>;
    verification_gate: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        button_channel_id: z.ZodOptional<z.ZodString>;
        verified_role_id: z.ZodOptional<z.ZodString>;
        timeout_kick_seconds: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        timeout_kick_seconds: number;
        button_channel_id?: string | undefined;
        verified_role_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        button_channel_id?: string | undefined;
        verified_role_id?: string | undefined;
        timeout_kick_seconds?: number | undefined;
    }>>;
    quarantine: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        restricted_role_id: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        restricted_role_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        restricted_role_id?: string | undefined;
    }>>;
    blacklist: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        action: z.ZodDefault<z.ZodEnum<["ban", "kick", "flag"]>>;
        silently_flag: z.ZodDefault<z.ZodBoolean>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        action: "ban" | "kick" | "flag";
        silently_flag: boolean;
    }, {
        enabled?: boolean | undefined;
        action?: "ban" | "kick" | "flag" | undefined;
        silently_flag?: boolean | undefined;
    }>>;
    alt_detection: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        max_account_age_days: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        max_account_age_days: number;
    }, {
        enabled?: boolean | undefined;
        max_account_age_days?: number | undefined;
    }>>;
    trust_levels: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        levels: z.ZodDefault<z.ZodArray<z.ZodObject<{
            level: z.ZodNumber;
            after_days: z.ZodNumber;
            require_clean_history: z.ZodDefault<z.ZodBoolean>;
            roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            after_days: number;
            roles: string[];
            level: number;
            require_clean_history: boolean;
        }, {
            after_days: number;
            level: number;
            roles?: string[] | undefined;
            require_clean_history?: boolean | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        levels: {
            after_days: number;
            roles: string[];
            level: number;
            require_clean_history: boolean;
        }[];
    }, {
        enabled?: boolean | undefined;
        levels?: {
            after_days: number;
            level: number;
            roles?: string[] | undefined;
            require_clean_history?: boolean | undefined;
        }[] | undefined;
    }>>;
    fuzzy: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        max_distance: z.ZodDefault<z.ZodNumber>;
        cooldown_seconds: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        cooldown_seconds: number;
        max_distance: number;
    }, {
        enabled?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        max_distance?: number | undefined;
    }>>;
    staff_permission_groups: z.ZodDefault<z.ZodObject<{
        groups: z.ZodDefault<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            roles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            permissions: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            permissions: string[];
            name: string;
            roles: string[];
        }, {
            name: string;
            permissions?: string[] | undefined;
            roles?: string[] | undefined;
        }>, "many">>;
    }, "strict", z.ZodTypeAny, {
        groups: {
            permissions: string[];
            name: string;
            roles: string[];
        }[];
    }, {
        groups?: {
            name: string;
            permissions?: string[] | undefined;
            roles?: string[] | undefined;
        }[] | undefined;
    }>>;
    community: z.ZodDefault<z.ZodObject<{
        starboard: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channel_id: z.ZodOptional<z.ZodString>;
            threshold: z.ZodDefault<z.ZodNumber>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            threshold: number;
            channel_id?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            threshold?: number | undefined;
        }>>;
        suggestions: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channel_id: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            channel_id?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        }>>;
        giveaways: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
        }, {
            enabled?: boolean | undefined;
        }>>;
        levels: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            message_xp: z.ZodDefault<z.ZodNumber>;
            xp_cooldown_seconds: z.ZodDefault<z.ZodNumber>;
            level_up_roles: z.ZodDefault<z.ZodArray<z.ZodObject<{
                level: z.ZodNumber;
                role_id: z.ZodString;
            }, "strict", z.ZodTypeAny, {
                role_id: string;
                level: number;
            }, {
                role_id: string;
                level: number;
            }>, "many">>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            message_xp: number;
            xp_cooldown_seconds: number;
            level_up_roles: {
                role_id: string;
                level: number;
            }[];
        }, {
            enabled?: boolean | undefined;
            message_xp?: number | undefined;
            xp_cooldown_seconds?: number | undefined;
            level_up_roles?: {
                role_id: string;
                level: number;
            }[] | undefined;
        }>>;
        status_rotation: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            interval_seconds: z.ZodDefault<z.ZodNumber>;
            statuses: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            interval_seconds: number;
            statuses: string[];
        }, {
            enabled?: boolean | undefined;
            interval_seconds?: number | undefined;
            statuses?: string[] | undefined;
        }>>;
        birthdays: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            channel_id: z.ZodOptional<z.ZodString>;
            timezone: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            enabled: boolean;
            timezone: string;
            channel_id?: string | undefined;
        }, {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            timezone?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        levels: {
            enabled: boolean;
            message_xp: number;
            xp_cooldown_seconds: number;
            level_up_roles: {
                role_id: string;
                level: number;
            }[];
        };
        starboard: {
            enabled: boolean;
            threshold: number;
            channel_id?: string | undefined;
        };
        suggestions: {
            enabled: boolean;
            channel_id?: string | undefined;
        };
        giveaways: {
            enabled: boolean;
        };
        status_rotation: {
            enabled: boolean;
            interval_seconds: number;
            statuses: string[];
        };
        birthdays: {
            enabled: boolean;
            timezone: string;
            channel_id?: string | undefined;
        };
    }, {
        levels?: {
            enabled?: boolean | undefined;
            message_xp?: number | undefined;
            xp_cooldown_seconds?: number | undefined;
            level_up_roles?: {
                role_id: string;
                level: number;
            }[] | undefined;
        } | undefined;
        starboard?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            threshold?: number | undefined;
        } | undefined;
        suggestions?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        } | undefined;
        giveaways?: {
            enabled?: boolean | undefined;
        } | undefined;
        status_rotation?: {
            enabled?: boolean | undefined;
            interval_seconds?: number | undefined;
            statuses?: string[] | undefined;
        } | undefined;
        birthdays?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    }>>;
    dashboard: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        port: z.ZodDefault<z.ZodNumber>;
        owner_user_id: z.ZodOptional<z.ZodString>;
        live_log_retention_hours: z.ZodDefault<z.ZodNumber>;
        timestamp_defaults: z.ZodDefault<z.ZodObject<{
            timezone: z.ZodDefault<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            timezone: string;
        }, {
            timezone?: string | undefined;
        }>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        port: number;
        live_log_retention_hours: number;
        timestamp_defaults: {
            timezone: string;
        };
        owner_user_id?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        port?: number | undefined;
        owner_user_id?: string | undefined;
        live_log_retention_hours?: number | undefined;
        timestamp_defaults?: {
            timezone?: string | undefined;
        } | undefined;
    }>>;
    error_reporting: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        verbosity: z.ZodDefault<z.ZodEnum<["minimal", "standard", "verbose"]>>;
        webhook_url: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        verbosity: "minimal" | "standard" | "verbose";
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        verbosity?: "minimal" | "standard" | "verbose" | undefined;
        webhook_url?: string | undefined;
    }>>;
    rate_limit_reporting: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        channel_id: z.ZodOptional<z.ZodString>;
        webhook_url: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>;
    }, "strict", z.ZodTypeAny, {
        enabled: boolean;
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    }, {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    }>>;
    ops: z.ZodDefault<z.ZodObject<{
        backups_enabled: z.ZodDefault<z.ZodBoolean>;
        backup_retention_count: z.ZodDefault<z.ZodNumber>;
        usage_analytics: z.ZodDefault<z.ZodBoolean>;
        snipe_retention_seconds: z.ZodDefault<z.ZodNumber>;
    }, "strict", z.ZodTypeAny, {
        backups_enabled: boolean;
        backup_retention_count: number;
        usage_analytics: boolean;
        snipe_retention_seconds: number;
    }, {
        backups_enabled?: boolean | undefined;
        backup_retention_count?: number | undefined;
        usage_analytics?: boolean | undefined;
        snipe_retention_seconds?: number | undefined;
    }>>;
}, "strict", z.ZodTypeAny, {
    bot: {
        status: "online" | "idle" | "dnd" | "invisible";
        prefixes: string[];
        prefix_enabled: boolean;
        slash_enabled: boolean;
        per_guild_prefixes: Record<string, string[]>;
        activity: {
            type: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing";
            text: string;
            url?: string | undefined;
        };
        owner_ids: string[];
    };
    commands: Record<string, {
        enabled: boolean;
        slash: boolean;
        prefix: boolean;
        cooldown_seconds: number;
        permissions: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[];
        immune_roles: string[];
        aliases: string[];
        permission_group?: string | undefined;
    }>;
    command_defaults: {
        cooldown_seconds: number;
    };
    logging: Record<string, {
        enabled: boolean;
        channel_id?: string | undefined;
        thread_id?: string | undefined;
    }>;
    warnings: {
        escalation_ladder: {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }[];
        decay: {
            enabled: boolean;
            after_days: number;
        };
    };
    reports: {
        enabled: boolean;
        cooldown_seconds: number;
        action_roles: string[];
        archive: {
            enabled: boolean;
            channel_id?: string | undefined;
        };
        merge_window_seconds: number;
        false_report_warning_enabled: boolean;
        channel_id?: string | undefined;
    };
    automod: {
        enabled: boolean;
        global_immune_roles: string[];
        modules: {
            spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            cross_channel: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            link_filter: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                allowlist: string[];
                denylist: string[];
                mode: "deny_all" | "allowlist" | "denylist";
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            image_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            executable_files: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                blocked_extensions: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_images: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            invites: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                guild_allowlist: string[];
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            emoji_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            line_spam: {
                enabled: boolean;
                immune_roles: string[];
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                per_message_lines: number;
                multi_message_lines: number;
                multi_message_window_seconds: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            poll_spam: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        };
        risk_scoring: {
            enabled: boolean;
            threshold: number;
            join_age_weight: number;
            automod_hit_weight: number;
            cross_channel_weight: number;
            decay_seconds: number;
        };
        heuristics: {
            typing_speed: {
                enabled: boolean;
                immune_roles: string[];
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                min_characters_per_second: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            mass_identical_joins: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
            new_account_velocity: {
                enabled: boolean;
                immune_roles: string[];
                threshold: number;
                window_seconds: number;
                channel_ignore_list: string[];
                action_chain: ({
                    type: "send_channel_message";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                    delete_after_seconds: number;
                } | {
                    type: "dm_user";
                    format: "plain" | "embed" | "components_v2";
                    content: string;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration: string;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                suppress_repeat_response_seconds: number;
                suppressed_response_mode: "silent" | "batched_summary";
                shadow_mode: boolean;
                max_account_age_days: number;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
            };
        };
        log_channel_id?: string | undefined;
        log_thread_id?: string | undefined;
    };
    regex_engine: {
        enabled: boolean;
        rules: {
            enabled: boolean;
            immune_roles: string[];
            action_chain: ({
                type: "send_channel_message";
                format: "plain" | "embed" | "components_v2";
                content: string;
                delete_after_seconds: number;
            } | {
                type: "dm_user";
                format: "plain" | "embed" | "components_v2";
                content: string;
            } | {
                type: "mute" | "timeout" | "ban";
                duration: string;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            flags: string;
            scope: "message" | "username" | "nickname";
        }[];
    };
    punishment_dms: {
        enabled: boolean;
        hide_moderator: boolean;
        order: "before" | "after";
        types: Partial<Record<"mute" | "timeout" | "ban" | "warn" | "kick" | "unban" | "unmute", {
            format: "plain" | "embed" | "components_v2";
            content: string;
            enabled: boolean;
        }>>;
    };
    escalation: {
        enabled: boolean;
        window_seconds: number;
        rules: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds: number;
        }[];
        global: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds: number;
        }[];
    };
    join_roles: {
        roles: string[];
        bot_roles: string[];
    };
    welcome: {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    };
    goodbye: {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    };
    booster: {
        message: string;
        enabled: boolean;
        channel_id?: string | undefined;
    };
    role_connections: {
        enabled: boolean;
        if_has_role: string;
        held_for_seconds: number;
        then_add: string[];
        then_remove: string[];
    }[];
    channel_locking: {
        presets: {
            name: string;
            channels: string[];
            categories: string[];
            all_channels: boolean;
            exclude_roles: string[];
            deny_permissions: string[];
            schedule: {
                action: "lock" | "unlock";
                cron: string;
            }[];
        }[];
    };
    anti_raid: {
        enabled: boolean;
        action: "lock_joins" | "timeout_joiners" | "verify_gate";
        window_seconds: number;
        join_rate_threshold: number;
    };
    sticky_messages: {
        enabled: boolean;
        re_post_after_messages: number;
    };
    slowmode_scheduler: {
        enabled: boolean;
        threshold_messages_per_minute: number;
        slowmode_seconds: number;
        revert_after_minutes: number;
    };
    sticky_roles: {
        enabled: boolean;
    };
    invite_tracking: {
        enabled: boolean;
    };
    tickets: {
        enabled: boolean;
        support_roles: string[];
        category_id?: string | undefined;
        transcript_channel_id?: string | undefined;
    };
    modmail: {
        enabled: boolean;
        support_roles: string[];
        category_id?: string | undefined;
        transcript_channel_id?: string | undefined;
    };
    verification_gate: {
        enabled: boolean;
        timeout_kick_seconds: number;
        button_channel_id?: string | undefined;
        verified_role_id?: string | undefined;
    };
    quarantine: {
        enabled: boolean;
        restricted_role_id?: string | undefined;
    };
    blacklist: {
        enabled: boolean;
        action: "ban" | "kick" | "flag";
        silently_flag: boolean;
    };
    alt_detection: {
        enabled: boolean;
        max_account_age_days: number;
    };
    trust_levels: {
        enabled: boolean;
        levels: {
            after_days: number;
            roles: string[];
            level: number;
            require_clean_history: boolean;
        }[];
    };
    fuzzy: {
        enabled: boolean;
        cooldown_seconds: number;
        max_distance: number;
    };
    staff_permission_groups: {
        groups: {
            permissions: string[];
            name: string;
            roles: string[];
        }[];
    };
    community: {
        levels: {
            enabled: boolean;
            message_xp: number;
            xp_cooldown_seconds: number;
            level_up_roles: {
                role_id: string;
                level: number;
            }[];
        };
        starboard: {
            enabled: boolean;
            threshold: number;
            channel_id?: string | undefined;
        };
        suggestions: {
            enabled: boolean;
            channel_id?: string | undefined;
        };
        giveaways: {
            enabled: boolean;
        };
        status_rotation: {
            enabled: boolean;
            interval_seconds: number;
            statuses: string[];
        };
        birthdays: {
            enabled: boolean;
            timezone: string;
            channel_id?: string | undefined;
        };
    };
    dashboard: {
        enabled: boolean;
        port: number;
        live_log_retention_hours: number;
        timestamp_defaults: {
            timezone: string;
        };
        owner_user_id?: string | undefined;
    };
    error_reporting: {
        enabled: boolean;
        verbosity: "minimal" | "standard" | "verbose";
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    };
    rate_limit_reporting: {
        enabled: boolean;
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    };
    ops: {
        backups_enabled: boolean;
        backup_retention_count: number;
        usage_analytics: boolean;
        snipe_retention_seconds: number;
    };
}, {
    bot: {
        prefixes: string[];
        owner_ids: string[];
        status?: "online" | "idle" | "dnd" | "invisible" | undefined;
        prefix_enabled?: boolean | undefined;
        slash_enabled?: boolean | undefined;
        per_guild_prefixes?: Record<string, string[]> | undefined;
        activity?: {
            type?: "Playing" | "Streaming" | "Listening" | "Watching" | "Competing" | undefined;
            text?: string | undefined;
            url?: string | undefined;
        } | undefined;
    };
    automod: {
        modules: {
            spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            cross_channel: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            link_filter: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                allowlist?: string[] | undefined;
                denylist?: string[] | undefined;
                mode?: "deny_all" | "allowlist" | "denylist" | undefined;
            };
            image_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            executable_files: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                blocked_extensions?: string[] | undefined;
            };
            mass_images: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            invites: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                guild_allowlist?: string[] | undefined;
            };
            emoji_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
            line_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                per_message_lines?: number | undefined;
                multi_message_lines?: number | undefined;
                multi_message_window_seconds?: number | undefined;
            };
            poll_spam: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            };
        };
        enabled?: boolean | undefined;
        global_immune_roles?: string[] | undefined;
        log_channel_id?: string | undefined;
        log_thread_id?: string | undefined;
        risk_scoring?: {
            enabled?: boolean | undefined;
            threshold?: number | undefined;
            join_age_weight?: number | undefined;
            automod_hit_weight?: number | undefined;
            cross_channel_weight?: number | undefined;
            decay_seconds?: number | undefined;
        } | undefined;
        heuristics?: {
            typing_speed?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                min_characters_per_second?: number | undefined;
            } | undefined;
            mass_identical_joins?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
            } | undefined;
            new_account_velocity?: {
                action_chain: ({
                    type: "send_channel_message";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                    delete_after_seconds?: number | undefined;
                } | {
                    type: "dm_user";
                    content: string;
                    format?: "plain" | "embed" | "components_v2" | undefined;
                } | {
                    type: "mute" | "timeout" | "ban";
                    duration?: string | undefined;
                    reason?: string | undefined;
                } | {
                    type: "delete_message";
                } | {
                    type: "warn";
                    reason?: string | undefined;
                } | {
                    type: "kick";
                    reason?: string | undefined;
                } | {
                    type: "add_role";
                    role_id: string;
                } | {
                    type: "remove_role";
                    role_id: string;
                } | {
                    type: "run_escalation_check";
                })[];
                enabled?: boolean | undefined;
                immune_roles?: string[] | undefined;
                log_channel_id?: string | undefined;
                log_thread_id?: string | undefined;
                threshold?: number | undefined;
                window_seconds?: number | undefined;
                channel_ignore_list?: string[] | undefined;
                suppress_repeat_response_seconds?: number | undefined;
                suppressed_response_mode?: "silent" | "batched_summary" | undefined;
                shadow_mode?: boolean | undefined;
                max_account_age_days?: number | undefined;
            } | undefined;
        } | undefined;
    };
    commands?: Record<string, {
        enabled?: boolean | undefined;
        slash?: boolean | undefined;
        prefix?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        permissions?: ("CreateInstantInvite" | "KickMembers" | "BanMembers" | "Administrator" | "ManageChannels" | "ManageGuild" | "AddReactions" | "ViewAuditLog" | "PrioritySpeaker" | "Stream" | "ViewChannel" | "SendMessages" | "SendTTSMessages" | "ManageMessages" | "EmbedLinks" | "AttachFiles" | "ReadMessageHistory" | "MentionEveryone" | "UseExternalEmojis" | "ViewGuildInsights" | "Connect" | "Speak" | "MuteMembers" | "DeafenMembers" | "MoveMembers" | "UseVAD" | "ChangeNickname" | "ManageNicknames" | "ManageRoles" | "ManageWebhooks" | "ManageGuildExpressions" | "UseApplicationCommands" | "RequestToSpeak" | "ManageEvents" | "ManageThreads" | "CreatePublicThreads" | "CreatePrivateThreads" | "UseExternalStickers" | "SendMessagesInThreads" | "UseEmbeddedActivities" | "ModerateMembers" | "ViewCreatorMonetizationAnalytics" | "UseSoundboard" | "CreateGuildExpressions" | "CreateEvents" | "UseExternalSounds" | "SendVoiceMessages" | "SendPolls" | "UseExternalApps" | "SendMessagesInPolls")[] | undefined;
        immune_roles?: string[] | undefined;
        aliases?: string[] | undefined;
        permission_group?: string | undefined;
    }> | undefined;
    command_defaults?: {
        cooldown_seconds?: number | undefined;
    } | undefined;
    logging?: Record<string, {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        thread_id?: string | undefined;
    }> | undefined;
    warnings?: {
        escalation_ladder?: {
            count: number;
            action: "mute" | "ban" | "kick";
            duration?: string | undefined;
        }[] | undefined;
        decay?: {
            enabled?: boolean | undefined;
            after_days?: number | undefined;
        } | undefined;
    } | undefined;
    reports?: {
        enabled?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        channel_id?: string | undefined;
        action_roles?: string[] | undefined;
        archive?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        } | undefined;
        merge_window_seconds?: number | undefined;
        false_report_warning_enabled?: boolean | undefined;
    } | undefined;
    regex_engine?: {
        enabled?: boolean | undefined;
        rules?: {
            action_chain: ({
                type: "send_channel_message";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
                delete_after_seconds?: number | undefined;
            } | {
                type: "dm_user";
                content: string;
                format?: "plain" | "embed" | "components_v2" | undefined;
            } | {
                type: "mute" | "timeout" | "ban";
                duration?: string | undefined;
                reason?: string | undefined;
            } | {
                type: "delete_message";
            } | {
                type: "warn";
                reason?: string | undefined;
            } | {
                type: "kick";
                reason?: string | undefined;
            } | {
                type: "add_role";
                role_id: string;
            } | {
                type: "remove_role";
                role_id: string;
            } | {
                type: "run_escalation_check";
            })[];
            name: string;
            pattern: string;
            enabled?: boolean | undefined;
            immune_roles?: string[] | undefined;
            flags?: string | undefined;
            scope?: "message" | "username" | "nickname" | undefined;
        }[] | undefined;
    } | undefined;
    punishment_dms?: {
        enabled?: boolean | undefined;
        hide_moderator?: boolean | undefined;
        order?: "before" | "after" | undefined;
        types?: Partial<Record<"mute" | "timeout" | "ban" | "warn" | "kick" | "unban" | "unmute", {
            content: string;
            format?: "plain" | "embed" | "components_v2" | undefined;
            enabled?: boolean | undefined;
        }>> | undefined;
    } | undefined;
    escalation?: {
        enabled?: boolean | undefined;
        window_seconds?: number | undefined;
        rules?: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            rule: string;
            within_seconds?: number | undefined;
        }[] | undefined;
        global?: {
            count: number;
            action: {
                type: "mute" | "timeout" | "ban" | "kick";
                duration?: string | undefined;
            };
            within_seconds?: number | undefined;
        }[] | undefined;
    } | undefined;
    join_roles?: {
        roles?: string[] | undefined;
        bot_roles?: string[] | undefined;
    } | undefined;
    welcome?: {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    } | undefined;
    goodbye?: {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    } | undefined;
    booster?: {
        message?: string | undefined;
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
    } | undefined;
    role_connections?: {
        if_has_role: string;
        enabled?: boolean | undefined;
        held_for_seconds?: number | undefined;
        then_add?: string[] | undefined;
        then_remove?: string[] | undefined;
    }[] | undefined;
    channel_locking?: {
        presets?: {
            name: string;
            channels?: string[] | undefined;
            categories?: string[] | undefined;
            all_channels?: boolean | undefined;
            exclude_roles?: string[] | undefined;
            deny_permissions?: string[] | undefined;
            schedule?: {
                action: "lock" | "unlock";
                cron: string;
            }[] | undefined;
        }[] | undefined;
    } | undefined;
    anti_raid?: {
        enabled?: boolean | undefined;
        action?: "lock_joins" | "timeout_joiners" | "verify_gate" | undefined;
        window_seconds?: number | undefined;
        join_rate_threshold?: number | undefined;
    } | undefined;
    sticky_messages?: {
        enabled?: boolean | undefined;
        re_post_after_messages?: number | undefined;
    } | undefined;
    slowmode_scheduler?: {
        enabled?: boolean | undefined;
        threshold_messages_per_minute?: number | undefined;
        slowmode_seconds?: number | undefined;
        revert_after_minutes?: number | undefined;
    } | undefined;
    sticky_roles?: {
        enabled?: boolean | undefined;
    } | undefined;
    invite_tracking?: {
        enabled?: boolean | undefined;
    } | undefined;
    tickets?: {
        enabled?: boolean | undefined;
        category_id?: string | undefined;
        support_roles?: string[] | undefined;
        transcript_channel_id?: string | undefined;
    } | undefined;
    modmail?: {
        enabled?: boolean | undefined;
        category_id?: string | undefined;
        support_roles?: string[] | undefined;
        transcript_channel_id?: string | undefined;
    } | undefined;
    verification_gate?: {
        enabled?: boolean | undefined;
        button_channel_id?: string | undefined;
        verified_role_id?: string | undefined;
        timeout_kick_seconds?: number | undefined;
    } | undefined;
    quarantine?: {
        enabled?: boolean | undefined;
        restricted_role_id?: string | undefined;
    } | undefined;
    blacklist?: {
        enabled?: boolean | undefined;
        action?: "ban" | "kick" | "flag" | undefined;
        silently_flag?: boolean | undefined;
    } | undefined;
    alt_detection?: {
        enabled?: boolean | undefined;
        max_account_age_days?: number | undefined;
    } | undefined;
    trust_levels?: {
        enabled?: boolean | undefined;
        levels?: {
            after_days: number;
            level: number;
            roles?: string[] | undefined;
            require_clean_history?: boolean | undefined;
        }[] | undefined;
    } | undefined;
    fuzzy?: {
        enabled?: boolean | undefined;
        cooldown_seconds?: number | undefined;
        max_distance?: number | undefined;
    } | undefined;
    staff_permission_groups?: {
        groups?: {
            name: string;
            permissions?: string[] | undefined;
            roles?: string[] | undefined;
        }[] | undefined;
    } | undefined;
    community?: {
        levels?: {
            enabled?: boolean | undefined;
            message_xp?: number | undefined;
            xp_cooldown_seconds?: number | undefined;
            level_up_roles?: {
                role_id: string;
                level: number;
            }[] | undefined;
        } | undefined;
        starboard?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            threshold?: number | undefined;
        } | undefined;
        suggestions?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
        } | undefined;
        giveaways?: {
            enabled?: boolean | undefined;
        } | undefined;
        status_rotation?: {
            enabled?: boolean | undefined;
            interval_seconds?: number | undefined;
            statuses?: string[] | undefined;
        } | undefined;
        birthdays?: {
            enabled?: boolean | undefined;
            channel_id?: string | undefined;
            timezone?: string | undefined;
        } | undefined;
    } | undefined;
    dashboard?: {
        enabled?: boolean | undefined;
        port?: number | undefined;
        owner_user_id?: string | undefined;
        live_log_retention_hours?: number | undefined;
        timestamp_defaults?: {
            timezone?: string | undefined;
        } | undefined;
    } | undefined;
    error_reporting?: {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        verbosity?: "minimal" | "standard" | "verbose" | undefined;
        webhook_url?: string | undefined;
    } | undefined;
    rate_limit_reporting?: {
        enabled?: boolean | undefined;
        channel_id?: string | undefined;
        webhook_url?: string | undefined;
    } | undefined;
    ops?: {
        backups_enabled?: boolean | undefined;
        backup_retention_count?: number | undefined;
        usage_analytics?: boolean | undefined;
        snipe_retention_seconds?: number | undefined;
    } | undefined;
}>;
export type BotConfig = z.infer<typeof configSchema>;
export type AutomodModuleConfig = z.infer<typeof configSchema.shape.automod.shape.modules.shape.spam>;
export type CommandConfig = z.infer<typeof commandSchema>;
export type LoggingEntryConfig = z.infer<typeof loggingEntrySchema>;
export type EscalationActionConfig = z.infer<typeof escalationActionSchema>;
export type PunishmentDmTypeConfig = z.infer<typeof punishmentDmTypeSchema>;
export declare const PUNISHMENT_TYPES: readonly ["warn", "mute", "kick", "ban", "timeout", "unban", "unmute"];
export type PunishmentType = (typeof PUNISHMENT_TYPES)[number];
export declare const LOG_EVENT_NAMES: readonly ["message_edit", "message_delete", "message_bulk_delete", "member_join", "member_leave", "member_ban", "member_unban", "member_kick", "member_timeout", "role_add", "role_remove", "nickname_change", "channel_create", "channel_update", "channel_delete", "voice_state_update", "invite_create", "invite_delete", "moderation_action", "automod_trigger", "command_usage", "error_event", "rate_limit_event", "report_created", "report_resolved", "case_edit", "appeal_created", "appeal_resolved"];
export type LogEventName = (typeof LOG_EVENT_NAMES)[number];

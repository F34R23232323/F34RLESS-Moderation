"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.snowflakeSchema = exports.durationSchema = exports.actionChainSchema = exports.actionChainStepSchema = exports.messageFormatSchema = void 0;
const zod_1 = require("zod");
exports.messageFormatSchema = zod_1.z.enum(['plain', 'embed', 'components_v2']);
const sendChannelMessageSchema = zod_1.z
    .object({
    type: zod_1.z.literal('send_channel_message'),
    format: exports.messageFormatSchema.default('components_v2'),
    content: zod_1.z.string().min(1),
    delete_after_seconds: zod_1.z.number().int().min(0).default(0),
})
    .strict();
const dmUserSchema = zod_1.z
    .object({
    type: zod_1.z.literal('dm_user'),
    format: exports.messageFormatSchema.default('components_v2'),
    content: zod_1.z.string().min(1),
})
    .strict();
const timedSchema = zod_1.z
    .object({
    type: zod_1.z.enum(['mute', 'timeout', 'ban']),
    duration: zod_1.z.string().default('perm'),
    reason: zod_1.z.string().optional(),
})
    .strict();
exports.actionChainStepSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z
        .object({
        type: zod_1.z.literal('delete_message'),
    })
        .strict(),
    sendChannelMessageSchema,
    dmUserSchema,
    zod_1.z
        .object({
        type: zod_1.z.literal('warn'),
        reason: zod_1.z.string().optional(),
    })
        .strict(),
    timedSchema,
    zod_1.z
        .object({
        type: zod_1.z.literal('kick'),
        reason: zod_1.z.string().optional(),
    })
        .strict(),
    zod_1.z
        .object({
        type: zod_1.z.literal('add_role'),
        role_id: zod_1.z.string().min(1),
    })
        .strict(),
    zod_1.z
        .object({
        type: zod_1.z.literal('remove_role'),
        role_id: zod_1.z.string().min(1),
    })
        .strict(),
    zod_1.z
        .object({
        type: zod_1.z.literal('run_escalation_check'),
    })
        .strict(),
]);
exports.actionChainSchema = zod_1.z.array(exports.actionChainStepSchema).min(1);
exports.durationSchema = zod_1.z
    .string()
    .regex(/^(\d+(\.\d+)?[smhdwy])+$|^perm$/i, 'Duration must match flexible forms like "10m", "2h30m", "14d", "1w", or "perm"');
exports.snowflakeSchema = zod_1.z
    .string()
    .regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID (15-20 digits)');
//# sourceMappingURL=actions.js.map
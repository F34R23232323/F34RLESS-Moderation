import { z } from 'zod';
import { durationSchema, snowflakeSchema } from './actions';
import { permissionNamesSchema } from './permissions';

const snowflake = snowflakeSchema;
const snowflakeArray = z.array(snowflake).default([]);

// ---------------------------------------------------------------------------
// Embed builder
// ---------------------------------------------------------------------------

export const embedFieldSchema = z
  .object({
    name: z.string().min(1).max(256),
    value: z.string().min(1).max(1024),
    inline: z.boolean().default(false),
  })
  .strict();

export const embedAuthorSchema = z
  .object({
    name: z.string().min(1).max(256),
    url: z.string().optional(),
    icon_url: z.string().optional(),
  })
  .strict();

export const embedFooterSchema = z
  .object({
    text: z.string().min(1).max(2048),
    icon_url: z.string().optional(),
  })
  .strict();

export const embedSpecSchema = z
  .object({
    title: z.string().max(256).optional(),
    description: z.string().max(4096).optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #ED4245').optional(),
    url: z.string().url().optional(),
    timestamp: z.boolean().default(false),
    image: z.string().optional(),
    thumbnail: z.string().optional(),
    author: embedAuthorSchema.optional(),
    fields: z.array(embedFieldSchema).max(25).optional(),
    footer: embedFooterSchema.optional(),
  })
  .strict();

export const embedListSchema = z.array(embedSpecSchema).max(10).default([]);
export type EmbedSpec = z.infer<typeof embedSpecSchema>;

// ---------------------------------------------------------------------------
// Components (buttons / selects) attached to send actions
// ---------------------------------------------------------------------------

export const buttonSpecSchema = z
  .object({
    type: z.literal('button'),
    id: z.string().min(1),
    label: z.string().min(1).max(80),
    style: z.enum(['primary', 'secondary', 'success', 'danger', 'link']).default('secondary'),
    url: z.string().url().optional(),
    custom_id: z.string().min(1).max(100).optional(),
    emoji: z.string().optional(),
    disabled: z.boolean().default(false),
  })
  .strict();

export const selectOptionSpecSchema = z
  .object({
    label: z.string().min(1).max(100),
    value: z.string().min(1).max(100),
    description: z.string().max(100).optional(),
    emoji: z.string().optional(),
  })
  .strict();

export const selectSpecSchema = z
  .object({
    type: z.literal('select'),
    id: z.string().min(1),
    placeholder: z.string().max(150).optional(),
    min_values: z.number().int().min(0).max(25).default(1),
    max_values: z.number().int().min(1).max(25).default(1),
    custom_id: z.string().min(1).max(100).optional(),
    options: z.array(selectOptionSpecSchema).min(1).max(25),
  })
  .strict();

export const componentRowSchema = z
  .object({
    components: z.array(z.discriminatedUnion('type', [buttonSpecSchema, selectSpecSchema])).min(1).max(5),
  })
  .strict();

export const componentsSchema = z.array(componentRowSchema).max(5).default([]);
export type ButtonSpec = z.infer<typeof buttonSpecSchema>;
export type SelectSpec = z.infer<typeof selectSpecSchema>;

// ---------------------------------------------------------------------------
// Message payload shared by send actions
// ---------------------------------------------------------------------------

const baseSendFields = {
  content: z.string().max(2000).optional(),
  embeds: embedListSchema.optional(),
  components: componentsSchema.optional(),
  files: z.array(z.string()).max(10).optional(),
} as const;

export const messagePayloadSchema = z
  .object({ ...baseSendFields })
  .strict();

export type MessagePayload = z.infer<typeof messagePayloadSchema>;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const actionTargetSchema = z
  .enum(['author', 'mentioned', 'first_arg', 'args'])
  .default('author');

export const deletePolicySchema = z.union([z.boolean(), z.number().int().min(0)]).default(false);

const targetFields = {
  target: actionTargetSchema,
  user_id: snowflake.optional(),
} as const;

const sendMessageActionSchema = z
  .object({
    type: z.literal('send_message'),
    ...baseSendFields,
    reply: z.boolean().default(false),
    mention: z.boolean().default(false),
    ephemeral: z.boolean().optional(),
    delete_after_seconds: z.number().int().min(0).default(0),
  })
  .strict();

const editMessageActionSchema = z
  .object({
    type: z.literal('edit_message'),
    ...baseSendFields,
  })
  .strict();

const sendChannelActionSchema = z
  .object({
    type: z.literal('send_channel'),
    channel_id: snowflake,
    ...baseSendFields,
    delete_after_seconds: z.number().int().min(0).default(0),
  })
  .strict();

const dmActionSchema = z
  .object({
    type: z.literal('dm'),
    ...baseSendFields,
  })
  .strict();

const deleteMessageActionSchema = z
  .object({
    type: z.literal('delete_message'),
    delete_after_seconds: z.number().int().min(0).default(0),
  })
  .strict();

const reactActionSchema = z
  .object({
    type: z.literal('react'),
    emojis: z.array(z.string().min(1)).min(1).max(20),
  })
  .strict();

const addRoleActionSchema = z
  .object({
    type: z.literal('add_role'),
    role_id: snowflake,
    ...targetFields,
  })
  .strict();

const removeRoleActionSchema = z
  .object({
    type: z.literal('remove_role'),
    role_id: snowflake,
    ...targetFields,
  })
  .strict();

const addRolesActionSchema = z
  .object({
    type: z.literal('add_roles'),
    role_ids: z.array(snowflake).min(1),
    ...targetFields,
  })
  .strict();

const removeRolesActionSchema = z
  .object({
    type: z.literal('remove_roles'),
    role_ids: z.array(snowflake).min(1),
    ...targetFields,
  })
  .strict();

const kickActionSchema = z
  .object({
    type: z.literal('kick'),
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const banActionSchema = z
  .object({
    type: z.literal('ban'),
    reason: z.string().optional(),
    duration: durationSchema.optional(),
    delete_message_days: z.number().int().min(0).max(7).default(0),
    ...targetFields,
  })
  .strict();

const unbanActionSchema = z
  .object({
    type: z.literal('unban'),
    user_id: snowflake,
    reason: z.string().optional(),
  })
  .strict();

const timeoutActionSchema = z
  .object({
    type: z.literal('timeout'),
    duration: durationSchema.default('1h'),
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const untimeoutActionSchema = z
  .object({
    type: z.literal('untimeout'),
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const createThreadActionSchema = z
  .object({
    type: z.literal('create_thread'),
    name: z.string().min(1).max(100),
    auto_archive_duration: z.number().int().min(0).default(1440),
    reason: z.string().optional(),
  })
  .strict();

const setNicknameActionSchema = z
  .object({
    type: z.literal('set_nickname'),
    nickname: z.string().min(1).max(32),
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const moveChannelActionSchema = z
  .object({
    type: z.literal('move_channel'),
    channel_id: snowflake,
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const disconnectActionSchema = z
  .object({
    type: z.literal('disconnect'),
    reason: z.string().optional(),
    ...targetFields,
  })
  .strict();

const createRoleActionSchema = z
  .object({
    type: z.literal('create_role'),
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #ED4245').optional(),
    hoist: z.boolean().default(false),
    mentionable: z.boolean().default(false),
    permissions: permissionNamesSchema,
    reason: z.string().optional(),
  })
  .strict();

const deleteRoleActionSchema = z
  .object({
    type: z.literal('delete_role'),
    role_id: snowflake,
    reason: z.string().optional(),
  })
  .strict();

const renameChannelActionSchema = z
  .object({
    type: z.literal('rename_channel'),
    channel_id: snowflake.optional(),
    name: z.string().min(1).max(100),
    reason: z.string().optional(),
  })
  .strict();

const waitActionSchema = z
  .object({
    type: z.literal('wait'),
    ms: z.number().int().min(0).max(300_000).default(1000),
  })
  .strict();

const randomPickActionSchema = z
  .object({
    type: z.literal('random_pick'),
    choices: z.array(messagePayloadSchema).min(1).max(10),
  })
  .strict();

const runCommandActionSchema = z
  .object({
    type: z.literal('run_command'),
    command: z.string().min(1),
    args: z.string().default(''),
  })
  .strict();

const stopActionSchema = z
  .object({
    type: z.literal('stop'),
  })
  .strict();

const logActionSchema = z
  .object({
    type: z.literal('log'),
    channel_id: snowflake.optional(),
    content: z.string().min(1).max(2000),
  })
  .strict();

const webhookActionSchema = z
  .object({
    type: z.literal('webhook'),
    url: z.string().url(),
    ...baseSendFields,
  })
  .strict();

const counterActionSchema = z
  .object({
    type: z.literal('counter'),
    name: z.string().min(1),
    increment_by: z.number().int().default(1),
    send_result: z.boolean().default(false),
    persist: z.boolean().default(false),
  })
  .strict();

export interface ConditionAction {
  type: 'if';
  condition: 'has_role' | 'not_has_role' | 'is_bot' | 'has_permission' | 'equals_arg';
  role_id?: string;
  permission?: string;
  arg_index?: number;
  equals?: string;
  then: CustomCommandAction[];
  else?: CustomCommandAction[];
}

export type CustomCommandAction =
  | z.infer<typeof sendMessageActionSchema>
  | z.infer<typeof editMessageActionSchema>
  | z.infer<typeof sendChannelActionSchema>
  | z.infer<typeof dmActionSchema>
  | z.infer<typeof deleteMessageActionSchema>
  | z.infer<typeof reactActionSchema>
  | z.infer<typeof addRoleActionSchema>
  | z.infer<typeof removeRoleActionSchema>
  | z.infer<typeof addRolesActionSchema>
  | z.infer<typeof removeRolesActionSchema>
  | z.infer<typeof kickActionSchema>
  | z.infer<typeof banActionSchema>
  | z.infer<typeof unbanActionSchema>
  | z.infer<typeof timeoutActionSchema>
  | z.infer<typeof untimeoutActionSchema>
  | z.infer<typeof createThreadActionSchema>
  | z.infer<typeof setNicknameActionSchema>
  | z.infer<typeof moveChannelActionSchema>
  | z.infer<typeof disconnectActionSchema>
  | z.infer<typeof createRoleActionSchema>
  | z.infer<typeof deleteRoleActionSchema>
  | z.infer<typeof renameChannelActionSchema>
  | z.infer<typeof waitActionSchema>
  | z.infer<typeof randomPickActionSchema>
  | z.infer<typeof runCommandActionSchema>
  | z.infer<typeof stopActionSchema>
  | z.infer<typeof logActionSchema>
  | z.infer<typeof webhookActionSchema>
  | z.infer<typeof counterActionSchema>
  | ConditionAction;

const conditionActionSchema = z
  .object({
    type: z.literal('if'),
    condition: z.enum(['has_role', 'not_has_role', 'is_bot', 'has_permission', 'equals_arg']),
    role_id: snowflake.optional(),
    permission: z.string().optional(),
    arg_index: z.number().int().min(0).optional(),
    equals: z.string().optional(),
    then: z.lazy(() => z.array(customActionSchema).min(1)),
    else: z.lazy(() => z.array(customActionSchema).min(1)).optional(),
  })
  .strict();

const customActionSchema = z.discriminatedUnion('type', [
  sendMessageActionSchema,
  editMessageActionSchema,
  sendChannelActionSchema,
  dmActionSchema,
  deleteMessageActionSchema,
  reactActionSchema,
  addRoleActionSchema,
  removeRoleActionSchema,
  addRolesActionSchema,
  removeRolesActionSchema,
  kickActionSchema,
  banActionSchema,
  unbanActionSchema,
  timeoutActionSchema,
  untimeoutActionSchema,
  createThreadActionSchema,
  setNicknameActionSchema,
  moveChannelActionSchema,
  disconnectActionSchema,
  createRoleActionSchema,
  deleteRoleActionSchema,
  renameChannelActionSchema,
  waitActionSchema,
  randomPickActionSchema,
  runCommandActionSchema,
  stopActionSchema,
  logActionSchema,
  webhookActionSchema,
  counterActionSchema,
  conditionActionSchema as never,
]) as z.ZodType<CustomCommandAction>;

export type CustomCommandActionUnion = z.infer<typeof customActionSchema>;

// ---------------------------------------------------------------------------
// Custom command definition
// ---------------------------------------------------------------------------

export const customCommandSchema = z
  .object({
    enabled: z.boolean().default(true),
    slash: z.boolean().default(true),
    prefix: z.boolean().default(true),
    description: z.string().max(100).default('Custom command'),
    aliases: z.array(z.string().min(1)).default([]),
    cooldown_seconds: z.number().int().min(0).default(3),
    permissions: permissionNamesSchema,
    allowed_roles: snowflakeArray,
    denied_roles: snowflakeArray,
    allowed_users: snowflakeArray,
    channel_ids: snowflakeArray,
    channel_mode: z.enum(['allow', 'deny']).default('allow'),
    ephemeral: z.boolean().default(false),
    delete_input: deletePolicySchema,
    delete_output: deletePolicySchema,
    suppress_reply: z.boolean().default(false),
    actions: z.array(customActionSchema).min(1),
  })
  .strict();

export type CustomCommandConfig = z.infer<typeof customCommandSchema>;

export const customCommandsSchema = z.record(z.string().min(1), customCommandSchema).default({});
import { z } from 'zod';

export const messageFormatSchema = z.enum(['plain', 'embed', 'components_v2']);
export type MessageFormat = z.infer<typeof messageFormatSchema>;

const sendChannelMessageSchema = z
  .object({
    type: z.literal('send_channel_message'),
    format: messageFormatSchema.default('components_v2'),
    content: z.string().min(1).optional(),
    delete_after_seconds: z.number().int().min(0).default(0),
    title: z.string().optional(),
    description: z.string().optional(),
    footer: z.string().optional(),
    accent_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex color like #ED4245').optional(),
    image_url: z.string().url().optional(),
    thumbnail_url: z.string().url().optional(),
    template_id: z.number().int().positive().optional(),
    template_name: z.string().min(1).optional(),
  })
  .strict();

const dmUserSchema = z
  .object({
    type: z.literal('dm_user'),
    format: messageFormatSchema.default('components_v2'),
    content: z.string().min(1),
  })
  .strict();

const timedSchema = z
  .object({
    type: z.enum(['mute', 'timeout', 'ban']),
    duration: z.string().default('perm'),
    reason: z.string().optional(),
  })
  .strict();

export const actionChainStepSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('delete_message'),
    })
    .strict(),
  sendChannelMessageSchema,
  dmUserSchema,
  z
    .object({
      type: z.literal('warn'),
      reason: z.string().optional(),
    })
    .strict(),
  timedSchema,
  z
    .object({
      type: z.literal('kick'),
      reason: z.string().optional(),
    })
    .strict(),
  z
    .object({
      type: z.literal('add_role'),
      role_id: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('remove_role'),
      role_id: z.string().min(1),
    })
    .strict(),
  z
    .object({
      type: z.literal('run_escalation_check'),
    })
    .strict(),
  z
    .object({
      type: z.literal('create_report'),
      reason: z.string().optional(),
    })
    .strict(),
]);

export const actionChainSchema = z.array(actionChainStepSchema).min(1);

export type ActionChainStep = z.infer<typeof actionChainStepSchema>;
export type ActionChain = z.infer<typeof actionChainSchema>;

export const durationSchema = z
  .string()
  .regex(
    /^(\d+(\.\d+)?[smhdwy])+$|^perm$/i,
    'Duration must match flexible forms like "10m", "2h30m", "14d", "1w", or "perm"',
  );

export const snowflakeSchema = z
  .string()
  .regex(/^\d{15,20}$/, 'Expected a Discord snowflake ID (15-20 digits)');
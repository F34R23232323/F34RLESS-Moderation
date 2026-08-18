import { configSchema, type BotConfig } from './schema';

export const DEFAULT_CONFIG_PARTIAL: Record<string, unknown> = {
  bot: {
    prefixes: ['!'],
    owner_ids: ['000000000000000000'],
  },
};

export function createDefaultConfig(): BotConfig {
  return configSchema.parse(DEFAULT_CONFIG_PARTIAL);
}

export const DEFAULT_ACTION_CHAIN = [
  { type: 'create_report', reason: 'Automod: {rule}' },
  { type: 'delete_message' },
  {
    type: 'send_channel_message',
    format: 'components_v2',
    content: '{user}, your message was removed in {channel}.',
    delete_after_seconds: 15,
  },
  { type: 'warn', reason: 'Automod: {rule}' },
  { type: 'run_escalation_check' },
] as const;
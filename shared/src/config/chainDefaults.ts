export const DEFAULT_ACTION_CHAIN = [
  { type: 'create_report', reason: 'Automod: {rule}' },
  { type: 'delete_message' },
  {
    type: 'send_channel_message',
    format: 'components_v2',
    content: 'Your message was removed in {channel}.',
    title: 'Message Removed',
    description:
      "Hey {user} - one of your messages was just removed because it didn't follow this server's rules.\n\n" +
      "That's all that happened - your account is fine and no punishment was applied. Please take a moment to review the rules before your next message.\n\n" +
      "If you think this was a mistake, just message any staff member and we'll happily take another look.",
    footer: 'Thanks for helping keep {guild} friendly and safe.',
    accent_color: '#ED4245',
    delete_after_seconds: 60,
  },
  { type: 'warn', reason: 'Automod: {rule}' },
  { type: 'run_escalation_check' },
] as const;

export const DEFAULT_WARN_CHAIN = [
  { type: 'create_report', reason: 'Automod: {rule}' },
  { type: 'warn', reason: 'Automod: {rule}' },
  { type: 'run_escalation_check' },
] as const;
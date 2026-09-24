import type { Guild } from 'discord.js';const DISPLAY_NAMES: Record<string, string> = {
  message_edit: 'Message Edited',
  message_delete: 'Message Deleted',
  message_bulk_delete: 'Messages Bulk Deleted',
  member_join: 'Member Joined',
  member_leave: 'Member Left',
  member_ban: 'Member Banned',
  member_unban: 'Member Unbanned',
  member_kick: 'Member Kicked',
  member_avatar_update: 'Avatar Updated',
  member_username_update: 'Username Updated',
  member_timeout: 'Member Timed Out',
  member_mute: 'Member Muted',
  member_unmute: 'Member Unmuted',
  member_warn: 'Member Warned',
  member_unwarn: 'Warning Removed',
  member_boost: 'Server Boosted',
  role_add: 'Role Added',
  role_remove: 'Role Removed',
  role_change: 'Roles Updated',
  role_update: 'Role Updated',
  role_create: 'Role Created',
  role_delete: 'Role Deleted',
  nickname_change: 'Nickname Changed',
  impersonation_detected: 'Impersonation Detected',
  channel_create: 'Channel Created',
  channel_update: 'Channel Updated',
  channel_delete: 'Channel Deleted',
  voice_state_update: 'Voice Update',
  invite_create: 'Invite Created',
  invite_delete: 'Invite Deleted',
  invite_use: 'Invite Used',
  moderation_action: 'Moderation Action',
  automod_trigger: 'Automod Trigger',
  command_usage: 'Command Usage',
  error_event: 'Error',
  rate_limit_event: 'Rate Limit',
  report_created: 'Report Created',
  report_resolved: 'Report Resolved',
  case_edit: 'Case Edited',
  case_voided: 'Case Voided',
  case_unvoided: 'Case Restored',
  case_linked: 'Cases Linked',
  case_closed: 'Case Closed',
  note_add: 'Note Added',
  note_edit: 'Note Edited',
  note_remove: 'Note Removed',
  appeal_created: 'Appeal Filed',
  appeal_resolved: 'Appeal Resolved',
  emoji_create: 'Emoji Added',
  emoji_delete: 'Emoji Removed',
  emoji_update: 'Emoji Updated',
  sticker_create: 'Sticker Added',
  sticker_delete: 'Sticker Removed',
  sticker_update: 'Sticker Updated',
  integration_create: 'Application Added',
  integration_update: 'Application Updated',
  integration_delete: 'Application Removed',
  webhook_create: 'Webhook Created',
  webhook_update: 'Webhook Updated',
  webhook_delete: 'Webhook Deleted',
  emergency_ping_triggered: 'Emergency Ping Triggered',
};

export function friendlyEventName(event: string): string {
  return DISPLAY_NAMES[event] ?? event
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const LABELS: Record<string, string> = {
  userId: 'User',
  authorId: 'Author',
  moderatorId: 'Moderator',
  targetId: 'Target',
  targetUser: 'Target User',
  actorId: 'Actor',
  channelId: 'Channel',
  parentId: 'Parent Channel',
  messageId: 'Message ID',
  roleId: 'Role',
  added: 'Roles Added',
  removed: 'Roles Removed',
  reason: 'Reason',
  blacklistReason: 'Reason',
  newReason: 'New Reason',
  content: 'Content',
  old: 'Before',
  new: 'After',
  oldChannel: 'From',
  newChannel: 'To',
  oldNickname: 'Old Nickname',
  newNickname: 'New Nickname',
  oldUsername: 'Old Username',
  newUsername: 'New Username',
  oldName: 'Old Name',
  newName: 'New Name',
  oldTopic: 'Old Topic',
  newTopic: 'New Topic',
  oldAvatar: 'Old Avatar',
  newAvatar: 'New Avatar',
  changes: 'Changes',
  durationMs: 'Duration',
  caseId: 'Case',
  caseCode: 'Case',
  caseIds: 'Cases',
  count: 'Count',
  amount: 'Amount',
  rule: 'Rule',
  module: 'Module',
  createdAt: 'Created',
  code: 'Invite',
  uses: 'Uses',
  maxUses: 'Max Uses',
  inviteChannel: 'Invite Channel',
  inviter: 'Inviter',
  inviterTag: 'Invited By',
  inviteCode: 'Invite Code',
  joinMethod: 'Join Method',
  type: 'Type',
  name: 'Name',
  title: 'Title',
  description: 'Description',
  appName: 'Application',
  integrationId: 'Application ID',
  integrationType: 'Application Type',
  webhookName: 'Webhook',
  webhookId: 'Webhook ID',
  accountAgeDays: 'Account Age',
  accountType: 'Account Type',
  attachments: 'Attachments',
  evidence: 'Evidence',
  action: 'Action',
  banned: 'Banned',
  failed: 'Failed',
  filters: 'Filters',
  criteria: 'Criteria',
  contains: 'Contains',
  bots: 'Bots',
  appealId: 'Appeal ID',
  avatarUrl: 'Avatar',
  animated: 'Animated',
  url: 'URL',
  id: 'ID',
  actionsTaken: 'Actions',
  actionsFailed: 'Failed Actions',
  responseSuppressed: 'Response',
  contentSnippet: 'Matched',
  oldValue: 'Old Value',
  newValue: 'New Value',
  level: 'Level',
  xp: 'XP',
  oldLevel: 'Old Level',
  newLevel: 'New Level',
  oldVerification: 'Old Verification',
  newVerification: 'New Verification',
  boostCount: 'Boost Count',
  boostTier: 'Boost Tier',
  oldTier: 'Old Tier',
  usesToday: 'Uses (24h)',
  threshold: 'Threshold',
  trigger: 'Trigger',
  usedName: 'Used Name',
  matchedName: 'Matched Name',
  matchedUserId: 'Matched User',
  resetNickname: 'Nickname Set To',
};

const USER_ID_KEYS = new Set(['userId', 'authorId', 'moderatorId', 'targetId', 'targetUser', 'inviter', 'actorId', 'matchedUserId']);
const CHANNEL_ID_KEYS = new Set(['channelId', 'parentId', 'inviteChannel']);
const ROLE_ID_KEYS = new Set(['roleId']);
/** Keys whose array values are role snowflakes — rendered as role mentions. */
const ROLE_ID_ARRAY_KEYS = new Set(['added', 'removed']);

const SNOWFLAKE_RE = /^\d{17,20}$/;

function truncate(s: string, max = 1500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (+${s.length - max} chars)`;
}

function mentionSnowflake(key: string, raw: string): string | null {
  if (!SNOWFLAKE_RE.test(raw)) return null;
  if (CHANNEL_ID_KEYS.has(key)) return `<#${raw}>`;
  if (ROLE_ID_KEYS.has(key)) return `<@&${raw}>`;
  if (USER_ID_KEYS.has(key)) return `<@${raw}>`;
  return null;
}

/** Flatten detail keys into labelled lines (no raw JSON dump). Mentions are
 *  rendered as clickable references; pings are disabled at send time. */
export function formatDetails(details: unknown, guild: Guild | null, depth = 0): string[] {
  if (!details || typeof details !== 'object' || Array.isArray(details) || depth > 3) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '') continue;
    const label = LABELS[key] ?? key;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const label = LABELS[key] ?? key;
      if (ROLE_ID_ARRAY_KEYS.has(key) && value.every((v) => SNOWFLAKE_RE.test(String(v)))) {
        lines.push(`**${label}:** ${value.map((v) => `<@&${v}>`).join(', ')}`);
        continue;
      }
      const joined = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
      lines.push(`**${label}:** ${truncate(joined)}`);
      continue;
    }

    if (typeof value === 'object') {
      const nested = formatDetails(value, guild, depth + 1);
      if (nested.length === 0) continue;
      lines.push(`**${label}**`);
      for (const n of nested) lines.push(`- ${n}`);
      continue;
    }

    if (typeof value === 'number' && key.endsWith('Ms')) {
      lines.push(`**${label}:** ${humanizeMs(value)}`);
      continue;
    }

    const raw = String(value);
    if (key.endsWith('At')) {
      const timestamp = Date.parse(raw);
      if (Number.isFinite(timestamp)) {
        const unix = Math.floor(timestamp / 1000);
        lines.push(`**${label}:** <t:${unix}:F> (<t:${unix}:R>)`);
        continue;
      }
    }
    const mention = mentionSnowflake(key, raw);
    lines.push(`**${label}:** ${truncate(mention ?? raw)}`);
  }
  return lines;
}

export function humanizeMs(ms: number): string {
  if (!ms || ms <= 0) return 'permanent';
  let seconds = Math.max(1, Math.ceil(ms / 1000));
  const d = Math.floor(seconds / 86400);
  seconds %= 86400;
  const h = Math.floor(seconds / 3600);
  seconds %= 3600;
  const m = Math.floor(seconds / 60);
  seconds %= 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.join(' ');
}

/** True if the event is "moderation_action" or otherwise needs a red accent. */
export function isDestructiveEvent(event: string): boolean {
  return ['moderation_action', 'member_ban', 'member_kick', 'member_mute', 'member_timeout', 'automod_trigger', 'error_event', 'rate_limit_event'].includes(event);
}

export const LOG_EVENT_ACCENTS: Record<string, number> = {
  member_join: 0x57f287,
  member_leave: 0xfee75c,
  invite_use: 0x5865f2,
  member_ban: 0xed4245,
  member_unban: 0x57f287,
  member_kick: 0xed4245,
  member_avatar_update: 0x00b0f4,
  member_username_update: 0x00b0f4,
  member_timeout: 0xed4245,
  member_mute: 0xed4245,
  member_unmute: 0x57f287,
  member_warn: 0xfee75c,
  member_unwarn: 0x57f287,
  role_add: 0x57f287,
  role_remove: 0xed4245,
  role_change: 0x5865f2,
  role_update: 0x5865f2,
  role_create: 0x57f287,
  role_delete: 0xed4245,
  moderation_action: 0xed4245,
  automod_trigger: 0xeb459e,
  error_event: 0xed4245,
  rate_limit_event: 0xfee75c,
  command_usage: 0x5865f2,
  report_created: 0x00b0f4,
  appeal_created: 0x00b0f4,
  case_edit: 0x5865f2,
  case_voided: 0xed4245,
  case_unvoided: 0x57f287,
  case_closed: 0x57f287,
  note_add: 0x57f287,
  note_edit: 0x5865f2,
  note_remove: 0xfee75c,
  member_boost: 0xf0b232,
  integration_create: 0x57f287,
  integration_update: 0x5865f2,
  integration_delete: 0xed4245,
  webhook_create: 0x57f287,
  webhook_update: 0x5865f2,
  webhook_delete: 0xed4245,
  emergency_ping_triggered: 0xed4245,
  impersonation_detected: 0xeb459e,
};

export function logAccent(event: string): number {
  return LOG_EVENT_ACCENTS[event] ?? 0x5865f2;
}

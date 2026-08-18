import type { Guild } from 'discord.js';


const DISPLAY_NAMES: Record<string, string> = {
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
  member_boost: 'Server Boosted',
  role_add: 'Role Added',
  role_remove: 'Role Removed',
  nickname_change: 'Nickname Changed',
  channel_create: 'Channel Created',
  channel_update: 'Channel Updated',
  channel_delete: 'Channel Deleted',
  voice_state_update: 'Voice Update',
  invite_create: 'Invite Created',
  invite_delete: 'Invite Deleted',
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
};

export function friendlyEventName(event: string): string {
  return DISPLAY_NAMES[event] ?? event
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function resolveChannelName(guild: Guild | null, id: string): string | null {
  return guild?.channels.cache.get(id)?.name ?? null;
}

export function resolveRoleName(guild: Guild | null, id: string): string | null {
  return guild?.roles.cache.get(id)?.name ?? null;
}

export function resolveUserName(guild: Guild | null, id: string): string | null {
  const member = guild?.members.cache.get(id);
  if (member) return member.nickname ?? member.user.username;
  const user = guild?.client.users.cache.get(id);
  return user?.username ?? null;
}

/** Remove mention syntax so log messages never ping anyone. */
export function stripMentions(text: string, guild: Guild | null): string {
  return text
    .replace(/<@!?(\d+)>/g, (_, id: string) => `@${resolveUserName(guild, id) ?? id}`)
    .replace(/<#(\d+)>/g, (_, id: string) => `#${resolveChannelName(guild, id) ?? id}`)
    .replace(/<@&(\d+)>/g, (_, id: string) => `@${resolveRoleName(guild, id) ?? id}`);
}

const LABELS: Record<string, string> = {
  userId: 'User',
  authorId: 'Author',
  moderatorId: 'Moderator',
  targetId: 'Target',
  channelId: 'Channel',
  messageId: 'Message ID',
  reason: 'Reason',
  content: 'Content',
  old: 'Before',
  new: 'After',
  roleId: 'Role',
  durationMs: 'Duration',
  caseId: 'Case',
  count: 'Count',
  rule: 'Rule',
  module: 'Module',
  createdAt: 'Created',
  code: 'Invite',
  uses: 'Uses',
  maxUses: 'Max Uses',
  inviteChannel: 'Invite Channel',
  inviter: 'Inviter',
  type: 'Type',
  name: 'Name',
  title: 'Title',
  description: 'Description',
  oldNickname: 'Old Nickname',
  newNickname: 'New Nickname',
  accountAgeDays: 'Account Age',
  attachments: 'Attachments',
  changes: 'Changes',
  oldChannel: 'From',
  newChannel: 'To',
};

const USER_ID_KEYS = new Set(['userId', 'authorId', 'moderatorId', 'targetId', 'inviter', 'actorId']);

const SNOWFLAKE_RE = /^\d{17,20}$/;

/** Flatten top-level detail keys into label/value lines (no raw JSON dump). */
export function formatDetails(details: unknown, guild: Guild | null): string[] {
  if (!details || typeof details !== 'object') return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    const label = LABELS[key] ?? key;
    let rendered: string;
    if (typeof value === 'object') {
      try {
        rendered = JSON.stringify(value);
      } catch {
        rendered = String(value);
      }
    } else {
      rendered = String(value);
    }
    const raw = typeof value === 'string' ? value : '';
    if (SNOWFLAKE_RE.test(raw)) {
      if (key === 'channelId') rendered = `<#${raw}>`;
      else if (key === 'roleId') rendered = `<@&${raw}>`;
      else if (USER_ID_KEYS.has(key)) rendered = `<@${raw}>`;
    }
    lines.push(`**${label}:** ${stripMentions(rendered, guild).slice(0, 800)}`);
  }
  return lines;
}

export function humanizeMs(ms: number): string {
  if (!ms || ms <= 0) return 'permanent';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  return parts.join(' ') || `${Math.round(ms / 1000)}s`;
}

/** True if the event is "moderation_action" or otherwise needs a red accent. */
export function isDestructiveEvent(event: string): boolean {
  return ['moderation_action', 'member_ban', 'member_kick', 'member_timeout', 'automod_trigger', 'error_event', 'rate_limit_event'].includes(event);
}

export const LOG_EVENT_ACCENTS: Record<string, number> = {
  member_join: 0x57f287,
  member_leave: 0xfee75c,
  member_ban: 0xed4245,
  member_unban: 0x57f287,
  member_kick: 0xed4245,
  member_avatar_update: 0x00b0f4,
  member_username_update: 0x00b0f4,
  member_timeout: 0xed4245,
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
  note_add: 0x57f287,
  note_edit: 0x5865f2,
  note_remove: 0xfee75c,
  member_boost: 0xf0b232,
};

export function logAccent(event: string): number {
  return LOG_EVENT_ACCENTS[event] ?? 0x5865f2;
}
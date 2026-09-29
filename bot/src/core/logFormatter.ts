import type { Guild } from 'discord.js';const DISPLAY_NAMES: Record<string, string> = {
  message_edit: 'Message edited',
  message_delete: 'Message deleted',
  message_bulk_delete: 'Messages bulk deleted',
  member_join: 'Member joined',
  member_leave: 'Member left',
  member_ban: 'Ban',
  member_unban: 'Unban',
  member_kick: 'Kick',
  member_avatar_update: 'Avatar updated',
  member_username_update: 'Username updated',
  member_timeout: 'Timeout',
  member_mute: 'Mute',
  member_unmute: 'Unmute',
  member_warn: 'Warn',
  member_unwarn: 'Unwarn',
  member_boost: 'Server boosted',
  role_add: 'User roles added',
  role_remove: 'User roles removed',
  role_change: 'User roles update',
  role_update: 'Role updated',
  role_create: 'Role created',
  role_delete: 'Role deleted',
  nickname_change: 'Nickname changed',
  impersonation_detected: 'Impersonation detected',
  channel_create: 'Channel created',
  channel_update: 'Channel updated',
  channel_delete: 'Channel deleted',
  voice_state_update: 'Voice update',
  invite_create: 'Invite created',
  invite_delete: 'Invite deleted',
  invite_use: 'Invite used',
  moderation_action: 'Moderation action',
  automod_trigger: 'Auto Moderation',
  command_usage: 'Command usage',
  error_event: 'Error',
  rate_limit_event: 'Rate limit',
  report_created: 'Report created',
  report_resolved: 'Report resolved',
  case_edit: 'Case edited',
  case_voided: 'Case voided',
  case_unvoided: 'Case restored',
  case_linked: 'Cases linked',
  case_closed: 'Case closed',
  note_add: 'Note added',
  note_edit: 'Note edited',
  note_remove: 'Note removed',
  appeal_created: 'Appeal filed',
  appeal_resolved: 'Appeal resolved',
  emoji_create: 'Emoji added',
  emoji_delete: 'Emoji removed',
  emoji_update: 'Emoji updated',
  sticker_create: 'Sticker added',
  sticker_delete: 'Sticker removed',
  sticker_update: 'Sticker updated',
  integration_create: 'Application added',
  integration_update: 'Application updated',
  integration_delete: 'Application removed',
  webhook_create: 'Webhook created',
  webhook_update: 'Webhook updated',
  webhook_delete: 'Webhook deleted',
  emergency_ping_triggered: 'Emergency ping triggered',
};

/** Sentence case ("Message deleted") — matches Sapphire's log titles. */
function sentenceCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export function friendlyEventName(event: string): string {
  if (DISPLAY_NAMES[event]) return DISPLAY_NAMES[event];
  const name = event
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
  return sentenceCase(name);
}


const LABELS: Record<string, string> = {
  userId: 'User',
  authorId: 'Message author',
  moderatorId: 'Moderator',
  targetId: 'Target',
  targetUser: 'Target User',
  actorId: 'Actor',
  channelId: 'Channel',
  parentId: 'Parent Channel',
  messageId: 'Message ID',
  roleId: 'Role',
  added: 'Added',
  removed: 'Removed',
  reason: 'Reason',
  blacklistReason: 'Reason',
  newReason: 'New Reason',
  content: 'Message',
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
  until: 'Expires',
  archiveLink: 'Archive',
  renewable: 'Auto-renews',
  remainingMs: 'Remaining',
  chunkMs: 'Chunk',
  clearedCount: 'Cleared',
  expectedCount: 'Expected',
  source: 'Source',
  error: 'Error',
  amount: 'Amount',
  rule: 'Rule',
  module: 'Module',
  createdAt: 'Message created',
  accountCreatedAt: 'Account Created',
  expiresAt: 'Expires',
  updatedAt: 'Updated',
  processedAt: 'Processed',
  joinedAt: 'Joined',
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
/** Non-*At keys that still hold a point in time. */
const TIMESTAMP_KEY_NAMES = new Set(['until', 'timestamp', 'time', 'joinedAt', 'processedAt', 'remindAt']);

const SNOWFLAKE_RE = /^\d{17,20}$/;
/** ISO-8601 timestamp produced by Date#toISOString (or MySQL DATETIME). */
const ISO_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
/** A Discord timestamp token already rendered as markup. */
const MARKUP_TS_RE = /^<t:\d+:/;

/** Render a unix-seconds value as a relative timestamp (Sapphire style: "14 days ago"). */
export function formatTimestamp(unixSeconds: number): string {
  return `<t:${unixSeconds}:R>`;
}

/** Parse a raw value into unix seconds when it is a recognisable timestamp
 *  (ISO string, unix seconds/milliseconds), otherwise null. */
export function parseTimestamp(value: string): number | null {
  if (MARKUP_TS_RE.test(value)) return null; // already rendered
  if (ISO_RE.test(value)) {
    const ms = Date.parse(value.replace(' ', 'T'));
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  }
  if (/^\d{10}$/.test(value)) return Number(value);
  if (/^\d{13}$/.test(value)) return Math.floor(Number(value) / 1000);
  return null;
}

function truncate(s: string, max = 1500): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (+${s.length - max} chars)`;
}

function mentionSnowflake(key: string, raw: string, guild?: Guild | null): string | null {
  if (!SNOWFLAKE_RE.test(raw)) return null;
  if (CHANNEL_ID_KEYS.has(key)) return channelMention(raw, guild);
  if (ROLE_ID_KEYS.has(key)) return `<@&${raw}>`;
  if (USER_ID_KEYS.has(key)) return userMention(raw, guild);
  return null;
}

/** Render a channel mention in Sapphire's style: "name ( <#id> )". */
export function channelMention(raw: string, guild?: Guild | null): string {
  const ch = guild?.channels.cache.get(raw);
  if (ch?.name) return `${ch.name} ( <#${raw}> )`;
  return `<#${raw}>`;
}

/** Render a user mention in Sapphire's style: "@username (<@id>)" which Discord
 *  renders as "@username ( @DisplayName )" with role icons, or "@username (<@id>)"
 *  if not cached / left server. */
export function userMention(raw: string, guild?: Guild | null): string {
  const member = guild?.members.cache.get(raw);
  const u = member?.user ?? guild?.client.users.cache.get(raw);
  if (u?.username) return `@${u.username} (<@${raw}>)`;
  return `<@${raw}>`;
}

/** One rendered detail: either a leaf value or a labelled group of children. */
type DetailEntry =
  | { label: string; value: string }
  | { label: string; children: DetailEntry[] };

/** Render every detail key into label/value entries (mentions, timestamps,
 *  durations already formatted). Shared by the line and field renderers. */
function renderDetails(details: unknown, guild: Guild | null = null, depth = 0): DetailEntry[] {
  if (!details || typeof details !== 'object' || Array.isArray(details) || depth > 3) return [];
  const out: DetailEntry[] = [];
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (value === null || value === undefined || value === '' || value === 0) continue;
    const label = LABELS[key] ?? key;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      if (ROLE_ID_ARRAY_KEYS.has(key) && value.every((v) => SNOWFLAKE_RE.test(String(v)))) {
        out.push({ label, value: value.map((v) => `<@&${v}>`).join(', ') });
        continue;
      }
      if (USER_ID_KEYS.has(key) && value.every((v) => SNOWFLAKE_RE.test(String(v)))) {
        out.push({ label, value: value.map((v) => userMention(String(v), guild)).join(', ') });
        continue;
      }
      const joined = value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
      out.push({ label, value: truncate(joined) });
      continue;
    }

    if (typeof value === 'object') {
      const children = renderDetails(value, guild, depth + 1);
      if (children.length === 0) continue;
      out.push({ label, children });
      continue;
    }

    if (typeof value === 'number' && key.endsWith('Ms')) {
      out.push({ label, value: humanizeMs(value) });
      continue;
    }

    const raw = String(value);
    // Already-formatted Discord timestamp — pass through untouched.
    if (MARKUP_TS_RE.test(raw)) {
      out.push({ label, value: raw });
      continue;
    }
    // ISO strings (e.g. `until`, `createdAt`) always render as timestamps.
    // Bare unix numbers only under clearly temporal keys, so 10-digit counts
    // are never mistaken for dates.
    const temporalKey = key.endsWith('At') || TIMESTAMP_KEY_NAMES.has(key);
    if (ISO_RE.test(raw)) {
      const ts = parseTimestamp(raw);
      if (ts !== null) {
        out.push({ label, value: formatTimestamp(ts) });
        continue;
      }
    } else if (temporalKey) {
      const ts = parseTimestamp(raw) ?? (key.endsWith('At') && Number.isFinite(Date.parse(raw))
        ? Math.floor(Date.parse(raw) / 1000)
        : null);
      if (ts !== null) {
        out.push({ label, value: formatTimestamp(ts) });
        continue;
      }
    }
    if (USER_ID_KEYS.has(key) && SNOWFLAKE_RE.test(raw)) {
      out.push({ label, value: userMention(raw, guild) });
      continue;
    }
    if (CHANNEL_ID_KEYS.has(key) && SNOWFLAKE_RE.test(raw)) {
      out.push({ label, value: channelMention(raw, guild) });
      continue;
    }
    const mention = mentionSnowflake(key, raw, guild);
    out.push({ label, value: truncate(mention ?? raw) });
  }
  return out;
}

function entryLines(entry: DetailEntry): string[] {
  if ('children' in entry) {
    return [`**${entry.label}**`, ...entry.children.flatMap((c) => entryLines(c).map((l) => `- ${l}`))];
  }
  return [`**${entry.label}:** ${entry.value}`];
}

/** Flatten detail keys into labelled lines (no raw JSON dump). Mentions are
 *  rendered as clickable references; pings are disabled at send time. */
export function formatDetails(details: unknown, guild: Guild | null, depth = 0): string[] {
  return renderDetails(details, guild, depth).flatMap(entryLines);
}

/** A structured field for embed rendering. */
export interface LogField {
  name: string;
  value: string;
  inline?: boolean;
}

const FIELD_VALUE_LIMIT = 1000;

/** Render details as embed fields (same values as formatDetails, but split
 *  into name/value pairs so Discord lays them out in columns). */
export function formatDetailFields(details: unknown, guild: Guild | null): LogField[] {
  return renderDetails(details, guild, 0).map((entry) => {
    if ('children' in entry) {
      const value = entry.children.flatMap(entryLines).join('\n');
      return { name: entry.label, value: value.length > FIELD_VALUE_LIMIT ? `${value.slice(0, FIELD_VALUE_LIMIT)}…` : value };
    }
    return { name: entry.label, value: entry.value.length > FIELD_VALUE_LIMIT ? `${entry.value.slice(0, FIELD_VALUE_LIMIT)}…` : entry.value };
  });
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
  message_delete: 0xed4245,
  message_bulk_delete: 0xed4245,
  message_edit: 0xfee75c,
  channel_create: 0x57f287,
  channel_delete: 0xed4245,
  channel_update: 0xfee75c,
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
  role_change: 0xfee75c,
  role_update: 0xfee75c,
  role_create: 0x57f287,
  role_delete: 0xed4245,
  moderation_action: 0xed4245,
  automod_trigger: 0xed4245,
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
  webhook_update: 0xfee75c,
  webhook_delete: 0xed4245,
  emergency_ping_triggered: 0xed4245,
  impersonation_detected: 0xeb459e,
};

export function logAccent(event: string): number {
  return LOG_EVENT_ACCENTS[event] ?? 0x5865f2;
}


import { EmbedBuilder } from 'discord.js';
import type { Guild } from 'discord.js';
import {
  formatDetailFields,
  logAccent,
  type LogField,
} from './logFormatter';

/** The raw (unrendered) shape of one log event. */
export interface LogEmbedSource {
  /** Display title, e.g. "Member Banned" or "Automod: spam — Repeat Offender". */
  header: string;
  event: string;
  guildId: string;
  channelId?: string | null;
  actorId?: string | null;
  targetId?: string | null;
  /** Human summary sentence — used only when there are no detail lines. */
  message?: string;
  details?: unknown;
  mediaUrls?: string[];
}

export interface LogEmbedContext {
  guildName: string;
  guildIconUrl?: string | null;
  /** Avatar shown top-right — only set for events where the target is a real user. */
  thumbnailUrl?: string | null;
  /** Row id in the `logs` table, shown in the footer for correlation. */
  logId?: number | null;
  /** When the event happened (ms epoch) — drives the embed timestamp. */
  timestamp: number;
  /** Acting user's username — rendered in the footer with their avatar. */
  actorName?: string | null;
  actorAvatarUrl?: string | null;
}

/** Detail fields whose values may repeat an identity already shown at the
 *  top level (e.g. message_delete carries authorId as well as targetId). */
const IDENTITY_LABELS = new Set([
  'Target',
  'Actor',
  'Author',
  'Message author',
  'User',
  'Channel',
  'Moderator',
]);

/** Labels rendered as separate inline embed fields (Before/After diffs). */
const INLINE_FIELD_LABELS = new Set(['Before', 'After']);

const MAX_FIELDS = 25;
const FIELD_VALUE_MAX = 1024;
const FIELD_NAME_MAX = 256;
const DESCRIPTION_MAX = 3800;

const SNOWFLAKE_RE = /\b\d{17,20}\b/g;

/** Wrap every line of a value in a blockquote (the Sapphire-style bar). */
function quoteBlock(text: string): string {
  return text.split('\n').map((l) => `> ${l}`).join('\n');
}

/**
 * Build the canonical log embed for one event in Sapphire's style:
 *
 * - Title: event name (e.g. "Message deleted")
 * - Description: every detail line as a blockquoted paragraph. The special
 *   "Message" label is rendered inline (bold label + content on next lines)
 *   rather than as an embed field, keeping everything in the description
 *   like Sapphire does.
 * - Before/After diffs stay as inline embed fields (two-column layout).
 * - Thumbnail: target user's avatar (only for user-targeted events).
 * - Footer: "@actorName" with actor avatar, plus embed timestamp.
 */
export function buildLogEmbed(source: LogEmbedSource, ctx: LogEmbedContext, guild: Guild | null = null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(source.header.slice(0, FIELD_NAME_MAX))
    .setColor(logAccent(source.event));

  // ── Collect structured details ─────────────────────────────────────────────
  const descLines: string[] = [];   // go into the quoted description
  const inlineFields: LogField[] = []; // Before/After
  const shownIds = new Set<string>();
  const remember = (...ids: string[]): void => { for (const id of ids) shownIds.add(id); };

  const details = source.details as Record<string, unknown> | null | undefined;
  const jumpUrl =
    details && typeof details.messageId === 'string' && source.channelId
      ? `https://discord.com/channels/${source.guildId}/${source.channelId}/${details.messageId}`
      : null;

  for (const f of formatDetailFields(source.details, guild)) {
    let value = f.value.length > FIELD_VALUE_MAX ? `${f.value.slice(0, FIELD_VALUE_MAX)}…` : f.value;
    if (f.name === 'Message ID' && jumpUrl) value = `[${value}](${jumpUrl})`;

    // Skip redundant case code if it is already present in the title (e.g. "Kick bKcYCsf")
    if (f.name === 'Case' && source.header.includes(f.value)) {
      continue;
    }

    // Track snowflakes shown via identity labels so we don't duplicate them.
    if (IDENTITY_LABELS.has(f.name)) {
      const ids = [...value.matchAll(SNOWFLAKE_RE)].map((m) => m[0]);
      if (ids.length > 0) remember(...ids);
    }

    if (INLINE_FIELD_LABELS.has(f.name)) {
      // Before / After → still inline fields for the two-column diff look.
      inlineFields.push({ name: f.name, value: quoteBlock(value), inline: true });
      continue;
    }

    if (f.name === 'Message') {
      // Message content: bold label on its own line, then raw content (no quote).
      // Matches Sapphire's style where the message body sits below a bold "Message" header.
      descLines.push(`**Message**\n${value}`);
      continue;
    }

    // Everything else: bold label line "**Label:** value".
    descLines.push(`**${f.name}:** ${value}`);
  }

  // ── Identity lines (prepended, skipped when details already show the id) ────
  const identity: string[] = [];
  if (source.targetId && !shownIds.has(source.targetId)) {
    const targetUser = guild?.members.cache.get(source.targetId)?.user ?? guild?.client.users.cache.get(source.targetId);
    identity.push(`**User:** ${targetUser ? `@${targetUser.username} (<@${source.targetId}>)` : `<@${source.targetId}>`}`);
    remember(source.targetId);
  }
  if (
    source.actorId &&
    source.actorId !== source.targetId &&
    !ctx.actorName &&
    !shownIds.has(source.actorId)
  ) {
    const actorUser = guild?.members.cache.get(source.actorId)?.user ?? guild?.client.users.cache.get(source.actorId);
    identity.push(`**Actor:** ${actorUser ? `@${actorUser.username} (<@${source.actorId}>)` : `<@${source.actorId}>`}`);
    remember(source.actorId);
  }
  if (source.channelId && !shownIds.has(source.channelId)) {
    const ch = guild?.channels.cache.get(source.channelId);
    identity.push(`**Channel:** ${ch ? `${ch.name} ( <#${ch.id}> )` : `<#${source.channelId}>`}`);
    remember(source.channelId);
  }

  // ── Build description ──────────────────────────────────────────────────────
  // Identity lines are always blockquoted; descLines contain their own
  // formatting (e.g. the Message block is not quoted).
  const quotedIdentity = identity.map((l) => `> ${l}`).join('\n');
  const quotedDetails = descLines
    .map((l) => (l.startsWith('**Message**') ? `\n${l}` : `> ${l}`))
    .join('\n');

  let description = [quotedIdentity, quotedDetails].filter(Boolean).join('\n');
  if (!description && source.message) description = source.message.slice(0, DESCRIPTION_MAX);
  if (description.length > DESCRIPTION_MAX) description = description.slice(0, DESCRIPTION_MAX);
  if (description) embed.setDescription(description);

  // ── Extra media links ─────────────────────────────────────────────────────
  const extraMedia: LogField[] = [];
  if (source.mediaUrls && source.mediaUrls.length > 1) {
    const links = source.mediaUrls.slice(1, 11).map((u) => `[image](${u})`).join(' ');
    extraMedia.push({ name: 'Media', value: links, inline: false });
  }

  // ── Enforce Discord's 25-field budget ────────────────────────────────────
  const allFields = [...inlineFields, ...extraMedia];
  let kept = allFields;
  let overflow = 0;
  if (allFields.length > MAX_FIELDS) {
    overflow = allFields.length - (MAX_FIELDS - 1);
    kept = allFields.slice(0, MAX_FIELDS - 1);
  }
  if (kept.length > 0) {
    embed.addFields(kept.map((f) => ({
      name: f.name.slice(0, FIELD_NAME_MAX) || 'Detail',
      value: (f.value || '—').slice(0, FIELD_VALUE_MAX),
      inline: f.inline ?? false,
    })));
  }
  if (overflow > 0) {
    embed.addFields({ name: 'More', value: `…and ${overflow} more detail(s) — see the case record.`, inline: false });
  }

  // Thumbnail: only when there's a real target user avatar to show.
  if (ctx.thumbnailUrl) embed.setThumbnail(ctx.thumbnailUrl);
  if (source.mediaUrls && source.mediaUrls.length > 0) embed.setImage(source.mediaUrls[0]);

  // Footer: acting user (Sapphire style). When no actor is present, leave
  // footer text empty so Discord renders only the localized event timestamp.
  if (ctx.actorName) {
    embed.setFooter({
      text: `@${ctx.actorName}`,
      iconURL: ctx.actorAvatarUrl ?? undefined,
    });
  }
  // Native Discord timestamp — localized per viewer, always the *event* time.
  embed.setTimestamp(ctx.timestamp);
  return embed;
}


/** Split items into message-sized packs under Discord's 10-embed / ~6000-char
 *  per-message limits. Order is preserved so entries and their files stay
 *  together. */
export function packByBudget<T>(items: T[], sizeOf: (item: T) => number): T[][] {
  const packs: T[][] = [];
  let current: T[] = [];
  let chars = 0;
  for (const item of items) {
    const size = sizeOf(item);
    if (current.length >= 10 || (current.length > 0 && chars + size > 5800)) {
      packs.push(current);
      current = [];
      chars = 0;
    }
    current.push(item);
    chars += size;
  }
  if (current.length > 0) packs.push(current);
  return packs;
}

import type { Message } from 'discord.js';

export type CaseEvidenceItem =
  | { type: 'message'; messageId: string; channelId: string; content?: string | null; attachmentUrls?: string[] }
  | { type: 'archive'; url: string; code?: string | null; messages?: number | null }
  | { type: 'link'; url: string; label?: string | null }
  | { url: string };

export interface ReplyContext {
  targetId: string;
  evidence: CaseEvidenceItem[];
}

/**
 * If the given message is a reply, resolve the replied-to message and return
 * its author + message evidence so moderation commands can action the user
 * they are replying to (e.g. `!ban` while replying to the offending message).
 */
export async function resolveReplyContext(message: Message): Promise<ReplyContext | null> {
  const ref = message.reference?.messageId;
  if (!ref) return null;
  if (!('messages' in message.channel)) return null;
  const replied = await message.channel.messages.fetch(ref).catch(() => null);
  if (!replied) return null;

  const item: CaseEvidenceItem = {
    type: 'message',
    messageId: replied.id,
    channelId: replied.channelId,
    content: replied.content ? replied.content.slice(0, 2000) : null,
    attachmentUrls: [...replied.attachments.values()].map((a) => a.url),
  };

  return { targetId: replied.author.id, evidence: [item] };
}

/**
 * Render case evidence into display lines. Message evidence becomes a content
 * snippet + jump link, archives and plain URLs become clickable links.
 * Returns a newline-joined string (or null when there is nothing to show).
 */
export function formatEvidenceLines(evidence: unknown, guildId?: string | null): string | null {
  if (!Array.isArray(evidence) || evidence.length === 0) return null;
  const lines: string[] = [];

  for (const raw of evidence) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;

    if (item.type === 'message') {
      const content = item.content ? String(item.content).slice(0, 500) : null;
      const hasLink = Boolean(guildId && item.channelId && item.messageId);
      const link = hasLink ? `https://discord.com/channels/${guildId}/${item.channelId}/${item.messageId}` : null;
      const attachments = Array.isArray(item.attachmentUrls) && item.attachmentUrls.length > 0 ? item.attachmentUrls : null;

      if (content) lines.push(`Message: ${content.replace(/\n/g, ' ')}`);
      if (link) lines.push(`[Jump to message](${link})`);
      if (attachments) lines.push(`Attachments: ${attachments.join(' ')}`);
      continue;
    }

    if (item.type === 'archive' && item.url) {
      const meta = [
        item.code ? `code ${item.code}` : null,
        item.messages ? `${item.messages} messages` : null,
      ].filter(Boolean).join(', ');
      lines.push(`Archive${meta ? ` (${meta})` : ''}: ${item.url}`);
      continue;
    }

    if (item.url) {
      const label = item.label ? String(item.label) : 'Evidence';
      lines.push(`${label}: ${item.url}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : null;
}
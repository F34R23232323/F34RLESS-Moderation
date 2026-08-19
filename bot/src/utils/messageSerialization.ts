import type { Message } from 'discord.js';

export interface StoredEmbed {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  color?: number | null;
  timestamp?: string | null;
  author?: { name?: string | null; url?: string | null; icon_url?: string | null } | null;
  footer?: { text?: string | null; icon_url?: string | null } | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: { url?: string | null; width?: number | null; height?: number | null; media_id?: number | null } | null;
  image?: { url?: string | null; width?: number | null; height?: number | null; media_id?: number | null } | null;
  video?: { url?: string | null } | null;
  provider?: { name?: string | null; url?: string | null } | null;
}

export interface StoredAttachment {
  id: string;
  name: string | null;
  url: string;
  proxyUrl: string | null;
  size: number;
  width: number | null;
  height: number | null;
  contentType: string | null;
}

export interface StoredSticker {
  id: string;
  name: string | null;
  format: string | null;
  url: string;
}

export interface SerializedMessage {
  messageId: string;
  channelId: string;
  authorId: string;
  authorUsername: string;
  authorNickname: string | null;
  authorAvatar: string;
  authorIsBot: boolean;
  content: string;
  embeds: StoredEmbed[];
  components: unknown[];
  stickers: StoredSticker[];
  referencedMessage: {
    messageId: string | null;
    channelId: string | null;
    guildId: string | null;
    authorId: string | null;
    content: string;
  } | null;
  attachments: StoredAttachment[];
  createdAt: number;
}

export async function serializeMessageRecord(message: Message, opts: { skipReference?: boolean } = {}): Promise<SerializedMessage> {
  const referencedMessage = opts.skipReference
    ? {
        messageId: message.reference?.messageId ?? null,
        channelId: message.reference?.channelId ?? null,
        guildId: message.reference?.guildId ?? null,
        authorId: null,
        content: '',
      }
    : await serializeReference(message);
  return {
    messageId: message.id,
    channelId: message.channelId,
    authorId: message.author.id,
    authorUsername: message.author.username,
    authorNickname: message.member && 'displayName' in message.member ? String(message.member.displayName).slice(0, 128) : null,
    authorAvatar: message.author.displayAvatarURL({ size: 128, extension: 'png' }),
    authorIsBot: message.author.bot,
    content: message.content,
    embeds: message.embeds.map(serializeEmbed),
    components: message.components.map((row) => {
      const json = (row as unknown as { toJSON?: () => unknown }).toJSON?.();
      return json ?? (row as unknown as Record<string, unknown>).data ?? row;
    }),
    stickers: message.stickers.map((s) => ({
      id: s.id,
      name: s.name,
      format: String(s.format),
      url: s.url,
    })),
    referencedMessage,
    attachments: message.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      proxyUrl: a.proxyURL,
      size: a.size,
      width: a.width ?? null,
      height: a.height ?? null,
      contentType: a.contentType,
    })),
    createdAt: message.createdTimestamp,
  };
}

export function serializeEmbed(embed: {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  color?: number | null;
  timestamp?: string | number | Date | null;
  author?: { name?: string | null; url?: string | null; iconURL?: string | null } | null;
  footer?: { text?: string | null; iconURL?: string | null } | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: { url?: string | null; width?: number | null; height?: number | null } | null;
  image?: { url?: string | null; width?: number | null; height?: number | null } | null;
  video?: { url?: string | null } | null;
  provider?: { name?: string | null; url?: string | null } | null;
}): StoredEmbed {
  return {
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: embed.url ?? null,
    color: embed.color ?? null,
    timestamp: embed.timestamp ? new Date(embed.timestamp).toISOString() : null,
    author: embed.author
      ? { name: embed.author.name ?? null, url: embed.author.url ?? null, icon_url: embed.author.iconURL ?? null }
      : null,
    footer: embed.footer ? { text: embed.footer.text ?? null, icon_url: embed.footer.iconURL ?? null } : null,
    fields: embed.fields?.map((f) => ({ name: f.name, value: f.value, inline: f.inline })) ?? [],
    thumbnail: embed.thumbnail ? { url: embed.thumbnail.url ?? null, width: embed.thumbnail.width ?? null, height: embed.thumbnail.height ?? null } : null,
    image: embed.image ? { url: embed.image.url ?? null, width: embed.image.width ?? null, height: embed.image.height ?? null } : null,
    video: embed.video ? { url: embed.video.url ?? null } : null,
    provider: embed.provider ? { name: embed.provider.name ?? null, url: embed.provider.url ?? null } : null,
  };
}

async function serializeReference(message: Message): Promise<SerializedMessage['referencedMessage']> {
  const reference = message.reference;
  const refId = reference?.messageId;
  if (!refId || !reference) return null;
  let authorId: string | null = null;
  let snippet = '';
  try {
    const refMsg = await message.channel.messages.fetch(refId).catch(() => null);
    if (refMsg) {
      authorId = refMsg.author.id;
      snippet = refMsg.content.slice(0, 200);
    }
  } catch {
    // ignore
  }
  return {
    messageId: refId,
    channelId: reference.channelId ?? null,
    guildId: reference.guildId ?? null,
    authorId,
    content: snippet,
  };
}

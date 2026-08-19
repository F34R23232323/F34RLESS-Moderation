import type { Channel, Message, TextBasedChannel } from 'discord.js';
import type { App } from '../core/context';

interface PinnedInfo {
  content: string;
  authorId: string;
  authorName: string;
}

// Track known pinned messages per channel so we can tell what was pinned vs
// unpinned (the channelPinsUpdate event itself carries no message info).
const pinnedCache = new Map<string, Map<string, PinnedInfo>>();

function authorTag(message: Message): string {
  const u = message.author;
  const tag = u.discriminator && u.discriminator !== '0' ? u.tag : u.username;
  return `${tag} (@${u.username})`;
}

export async function handleChannelPinsUpdate(app: App, channel: Channel, _time: Date): Promise<void> {
  const guildId = (channel as { guildId?: string }).guildId;
  if (!guildId) return;
  if (!('messages' in channel)) return;
  const textChannel = channel as TextBasedChannel;

  let pinned: Message[];
  try {
    pinned = [...(await textChannel.messages.fetchPinned()).values()];
  } catch (err) {
    app.logger.warn(`Failed to fetch pinned messages in ${channel.id}:`, err);
    return;
  }

  const now = new Map<string, PinnedInfo>();
  for (const m of pinned) {
    now.set(m.id, {
      content: m.content || (m.attachments.size > 0 ? '(attachment)' : '(no text)'),
      authorId: m.author.id,
      authorName: authorTag(m),
    });
  }

  const prev = pinnedCache.get(channel.id);
  const channelName = 'name' in channel && channel.name ? String(channel.name) : channel.id;

  if (prev) {
    for (const [id, info] of now) {
      if (!prev.has(id)) {
        await logPinned(app, guildId, channel, channelName, 'Message pinned', info, id);
      }
    }
    for (const [id, info] of prev) {
      if (!now.has(id)) {
        await logPinned(app, guildId, channel, channelName, 'Pinned message removed', info, id);
      }
    }
  }

  pinnedCache.set(channel.id, now);
}

async function logPinned(
  app: App,
  guildId: string,
  channel: Channel,
  channelName: string,
  header: string,
  info: PinnedInfo,
  messageId: string,
): Promise<void> {
  await app.logManager.log({
    event: 'channel_pins_update',
    guildId,
    channelId: channel.id,
    targetId: info.authorId,
    message: [
      header,
      `Channel: ${channelName} (${channel.id})`,
      `Message: ${info.content.slice(0, 900)}`,
      `Message ID: ${messageId}`,
      `Message author: ${info.authorName}`,
    ].join('\n'),
    details: { channelId: channel.id, messageId, authorId: info.authorId, content: info.content.slice(0, 900), pinned: header === 'Message pinned' },
  });
}

export default { name: 'channelPinsUpdate', run: handleChannelPinsUpdate };

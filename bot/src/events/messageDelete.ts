import { AuditLogEvent, type Message, type PartialMessage } from 'discord.js';
import type { App } from '../core/context';
import { captureDeleted } from '../utils/snipe';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleMessageDelete(app: App, message: Message | PartialMessage): Promise<void> {
  try {
    captureDeleted(message);
    app.messageCache.delete(message.id);
    const content = message.content || '';
    const mediaUrls =
      message.guildId && 'author' in message
        ? app.messageLogs.getImageAttachmentUrls(message.id)
        : [...message.attachments.values()].filter((a) => a.contentType?.startsWith('image/')).map((a) => a.url);
    if (message.guildId) {
      await app.messageLogs.onMessageDelete(message);
    }
    const guild = message.guild ?? (message.guildId ? app.client.guilds.cache.get(message.guildId) ?? null : null);
    const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.MessageDelete, { targetId: message.id }) : null;
    await app.logManager.log({
      event: 'message_delete',
      guildId: message.guildId ?? '0',
      channelId: message.channelId,
      actorId,
      targetId: message.author?.id ?? null,
      message: `Message deleted in <#${message.channelId}>${actorId ? ` by <@${actorId}>` : ''}`,
      details: {
        channelId: message.channelId,
        messageId: message.id,
        authorId: message.author?.id,
        createdAt: message.createdAt ? Math.floor(message.createdAt.getTime() / 1000) : undefined,
        content: content.slice(0, 1500),
        attachments: message.attachments?.size ?? 0,
      },
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    });
  } catch (err) {
    app.logger.error('messageDelete handler threw:', err);
  }
}

export default { name: 'messageDelete', run: handleMessageDelete };
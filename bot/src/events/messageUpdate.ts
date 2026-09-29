import type { Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';
import { captureEdited } from '../utils/snipe';

export async function handleMessageUpdate(app: App, oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage): Promise<void> {
  try {
    captureEdited(oldMessage, newMessage);
    const author = newMessage.author;
    if (!author) return;

    const cached = app.messageCache.get(newMessage.id);
    const oldContent = cached?.content ?? (oldMessage.content ?? null);

    let newContent = newMessage.content ?? null;
    if (newMessage.partial && newContent === null) {
      const fetched = await newMessage.fetch().catch(() => null);
      if (fetched) newContent = fetched.content ?? null;
    }
    if (newContent === null) return;

    if (oldContent !== null && oldContent === newContent) return;

    if (newMessage.guildId) {
      await app.messageLogs.onMessageEdit(oldMessage, newMessage);
    }

    const mediaUrls = [
      ...[...newMessage.attachments.values()].filter((a) => a.contentType?.startsWith('image/')).map((a) => a.url),
      ...newMessage.embeds.flatMap((e) => (e.image?.url ? [e.image.url] : [])),
    ];

    await app.logManager.log({
      event: 'message_edit',
      guildId: newMessage.guildId ?? '0',
      channelId: newMessage.channelId,
      targetId: author.id,
      message: `Message edited in <#${newMessage.channelId}> by <@${author.id}>`,
      details: {
        channelId: newMessage.channelId,
        messageId: newMessage.id,
        authorId: author.id,
        createdAt: newMessage.createdAt ? Math.floor(newMessage.createdAt.getTime() / 1000) : undefined,
        old: oldContent?.slice(0, 1000) ?? '(previous content not cached)',
        new: newContent.slice(0, 1000),
      },
      mediaUrls: mediaUrls.length ? mediaUrls : undefined,
    });

    app.messageCache.set(newMessage.id, {
      content: newContent,
      authorId: author.id,
      channelId: newMessage.channelId,
      guildId: newMessage.guildId,
      attachmentCount: newMessage.attachments?.size ?? 0,
      createdAt: cached?.createdAt ?? Date.now(),
    });
  } catch (err) {
    app.logger.error('messageUpdate handler threw:', err);
  }
}

export default { name: 'messageUpdate', run: handleMessageUpdate };

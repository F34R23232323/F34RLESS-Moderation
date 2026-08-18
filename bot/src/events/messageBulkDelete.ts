import type { Collection, Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';

export async function handleMessageBulkDelete(app: App, messages: Collection<string, Message | PartialMessage>, channel: { guildId: string | null; id: string }): Promise<void> {
  try {
    const lines: string[] = [];
    for (const [, msg] of messages) {
      const author = msg.author
        ? `${msg.author.username} (${msg.author.id}${msg.author.bot ? ', bot' : ''})`
        : 'unknown';
      const content = msg.content || (msg.partial ? '(uncached)' : '(no text)');
      lines.push(`${author}: ${content}`);
    }

    let files: { name: string; data: Buffer }[] = [];
    if (lines.length > 0) {
      const text = lines.join('\n');
      files = [{ name: `bulk-delete-${Date.now()}.txt`, data: Buffer.from(text.slice(0, 1900000), 'utf8') }];
    }

    await app.logManager.log({
      event: 'message_bulk_delete',
      guildId: channel.guildId ?? '0',
      channelId: channel.id,
      message: `Bulk deleted ${messages.size} messages in <#${channel.id}>`,
      details: { count: messages.size, channelId: channel.id },
      files,
    });
  } catch (err) {
    app.logger.error('messageBulkDelete handler threw:', err);
  }
}

export default { name: 'messageDeleteBulk', run: handleMessageBulkDelete };
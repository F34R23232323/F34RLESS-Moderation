import type { Collection, Message, PartialMessage } from 'discord.js';
import type { App } from '../core/context';

export async function handleMessageBulkDelete(app: App, messages: Collection<string, Message | PartialMessage>, channel: { guildId: string | null; id: string; name?: string }): Promise<void> {
  try {
    const lines: string[] = [];
    const ids: string[] = [];
    const users = new Map<string, number>();

    const sorted = [...messages.values()].sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
    for (const msg of sorted) {
      const author = msg.author
        ? msg.author
        : null;
      const tag = author ? `${author.username}#${author.discriminator === '0' ? author.id : author.discriminator}` : 'unknown';
      const idStr = author ? author.id : 'unknown';
      if (author) users.set(`${tag} (${idStr})`, (users.get(`${tag} (${idStr})`) ?? 0) + 1);

      const time = msg.createdAt ? msg.createdAt.toISOString() : 'unknown';
      let content = msg.content || (msg.partial ? '(uncached)' : '(no text)');
      if (msg.attachments?.size) {
        const urls = [...msg.attachments.values()].map((a) => a.url).join(', ');
        content += ` [attachments: ${urls}]`;
      }
      if (msg.embeds?.length) content += ` [embeds: ${msg.embeds.length}]`;

      lines.push(`[${time}] ${tag} (${idStr}): ${content}`);
      if (msg.id) ids.push(msg.id);
    }

    if (channel.guildId) {
      await app.messageLogs.markBulkDeleted(ids);
    }

    const userSummary = [...users.entries()].sort((a, b) => b[1] - a[1]).map(([u, c]) => `${u}: ${c}`).join('\n');

    let files: { name: string; data: Buffer }[] = [];
    if (lines.length > 0) {
      const header =
        `Bulk delete transcript\n` +
        `Channel: ${channel.name ?? channel.id} (${channel.id})\n` +
        `Count: ${messages.size}\n` +
        `Generated: ${new Date().toISOString()}\n\n` +
        `=== Users (message counts) ===\n${userSummary || 'unknown'}\n\n` +
        `=== Messages ===\n`;
      const text = header + lines.join('\n');
      files = [{ name: `bulk-delete-${Date.now()}.txt`, data: Buffer.from(text.slice(0, 1900000), 'utf8') }];
    }

    await app.logManager.log({
      event: 'message_bulk_delete',
      guildId: channel.guildId ?? '0',
      channelId: channel.id,
      message: `Bulk deleted ${messages.size} messages in <#${channel.id}>${files.length ? ' (transcript attached)' : ''}`,
      details: { count: messages.size, channelId: channel.id, users: users.size },
      files,
    });
  } catch (err) {
    app.logger.error('messageBulkDelete handler threw:', err);
  }
}

export default { name: 'messageDeleteBulk', run: handleMessageBulkDelete };

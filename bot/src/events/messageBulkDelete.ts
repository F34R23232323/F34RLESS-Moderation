import { AuditLogEvent, type Collection, type Message, type PartialMessage } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';
import type { StoredEmbed } from '../utils/messageSerialization';

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

    // Create an archive with a public link so staff can review the deleted content
    let archiveLink: string | null = null;
    if (channel.guildId && sorted.length > 0) {
      try {
        const archiveRecords = sorted.map((msg) => ({
          record: {
            messageId: msg.id ?? '0',
            channelId: channel.id,
            authorId: msg.author?.id ?? '0',
            authorUsername: msg.author?.username ?? 'unknown',
            authorNickname: null as string | null,
            authorAvatar: msg.author?.displayAvatarURL?.({ extension: 'png' }) ?? '',
            authorIsBot: msg.author?.bot ?? false,
            content: msg.content || '',
            embeds: (msg.embeds ?? []) as unknown as StoredEmbed[],
            components: [],
            stickers: [],
            referencedMessage: null,
            attachments: [...(msg.attachments?.values() ?? [])].map((a) => ({
              id: a.id, name: a.name, url: a.url, proxyUrl: a.proxyURL, size: a.size,
              width: a.width ?? null, height: a.height ?? null, contentType: a.contentType ?? null,
            })),
            createdAt: msg.createdTimestamp ?? 0,
          },
          status: 'deleted' as const,
        }));
        const archive = await app.archives.archiveBatch({
          guildId: channel.guildId,
          channelId: channel.id,
          records: archiveRecords,
          kind: 'deleted_message',
          title: `Bulk deleted ${messages.size} messages`,
        });
        archiveLink = archive?.link ?? null;
      } catch {
        // archive is best-effort
      }
    }

    const guild = channel.guildId ? app.client.guilds.cache.get(channel.guildId) ?? null : null;
    const actorId = guild ? await resolveAuditActor(app, guild, AuditLogEvent.MessageBulkDelete, { targetId: channel.id }) : null;

    await app.logManager.log({
      event: 'message_bulk_delete',
      guildId: channel.guildId ?? '0',
      channelId: channel.id,
      actorId,
      message: `Bulk deleted ${messages.size} messages in <#${channel.id}>${archiveLink ? ` (archive: ${archiveLink})` : files.length ? ' (transcript attached)' : ''}`,
      details: { count: messages.size, channelId: channel.id, users: users.size, ...(archiveLink ? { archiveLink } : {}) },
      files,
    });
  } catch (err) {
    app.logger.error('messageBulkDelete handler threw:', err);
  }
}

export default { name: 'messageDeleteBulk', run: handleMessageBulkDelete };

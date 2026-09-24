import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import * as crypto from 'crypto';

interface ImageInfo {
  format: string;
  mime: string;
  width?: number;
  height?: number;
  bytes: number;
  md5: string;
  sha1: string;
  sha256: string;
}

function detectFormat(buf: Buffer): { format: string; mime: string } {
  if (buf.length < 12) return { format: 'unknown', mime: 'application/octet-stream' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { format: 'PNG', mime: 'image/png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { format: 'JPEG', mime: 'image/jpeg' };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { format: 'GIF', mime: 'image/gif' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') return { format: 'WebP', mime: 'image/webp' };
  if (buf.slice(0, 2).toString('ascii') === 'BM') return { format: 'BMP', mime: 'image/bmp' };
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x01 && buf[3] === 0x00) return { format: 'ICO', mime: 'image/x-icon' };
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'AVIF') return { format: 'AVIF', mime: 'image/avif' };
  if (buf.slice(4, 12).toString('ascii') === 'ftypheic' || buf.slice(4, 12).toString('ascii') === 'ftypheix' || buf.slice(4, 12).toString('ascii') === 'ftypmif1')
    return { format: 'HEIC', mime: 'image/heic' };
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return { format: 'GIF', mime: 'image/gif' };
  if (buf.slice(0, 5).toString('ascii') === '<?xml' || buf.slice(0, 4).toString('ascii') === '<svg') return { format: 'SVG', mime: 'image/svg+xml' };
  return { format: 'unknown', mime: 'application/octet-stream' };
}

function readUint16BE(buf: Buffer, o: number): number {
  return buf.readUInt16BE(o);
}
function readUint32BE(buf: Buffer, o: number): number {
  return buf.readUInt32BE(o);
}
function readUint16LE(buf: Buffer, o: number): number {
  return buf.readUInt16LE(o);
}
function readUint32LE(buf: Buffer, o: number): number {
  return buf.readUInt32LE(o);
}

function detectDimensions(format: string, buf: Buffer): { width?: number; height?: number } {
  try {
    switch (format) {
      case 'PNG': {
        if (buf.length < 24) return {};
        return { width: readUint32BE(buf, 16), height: readUint32BE(buf, 20) };
      }
      case 'GIF': {
        if (buf.length < 10) return {};
        return { width: readUint16LE(buf, 6), height: readUint16LE(buf, 8) };
      }
      case 'BMP': {
        if (buf.length < 26) return {};
        return { width: readUint32LE(buf, 18), height: Math.abs(readUint32LE(buf, 22)) };
      }
      case 'ICO': {
        if (buf.length < 26) return {};
        const w = buf.readUInt8(6) === 0 ? 256 : buf.readUInt8(6);
        const h = buf.readUInt8(7) === 0 ? 256 : buf.readUInt8(7);
        return { width: w, height: h };
      }
      case 'WebP': {
        const chunk = buf.slice(12, 16).toString('ascii');
        if (chunk === 'VP8X' && buf.length >= 30) {
          const w = (buf.readUInt8(24) | (buf.readUInt8(25) << 8) | (buf.readUInt8(26) << 16)) + 1;
          const h = (buf.readUInt8(27) | (buf.readUInt8(28) << 8) | (buf.readUInt8(29) << 16)) + 1;
          return { width: w, height: h };
        }
        if ((chunk === 'VP8 ' || chunk === 'VP8L') && buf.length >= 30) {
          if (chunk === 'VP8L') {
            const b0 = buf.readUInt8(21);
            const b1 = buf.readUInt8(22);
            const b2 = buf.readUInt8(23);
            const b3 = buf.readUInt8(24);
            const bits = (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
            const w = (bits & 0x3fff) + 1;
            const h = ((bits >> 14) & 0x3fff) + 1;
            return { width: w, height: h };
          }
          const w = readUint16LE(buf, 26) & 0x3fff;
          const h = readUint16LE(buf, 28) & 0x3fff;
          return { width: w, height: h };
        }
        return {};
      }
      case 'JPEG': {
        let offset = 2;
        while (offset < buf.length) {
          if (buf[offset] !== 0xff) {
            offset++;
            continue;
          }
          const marker = buf[offset + 1];
          if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
            const height = readUint16BE(buf, offset + 5);
            const width = readUint16BE(buf, offset + 7);
            return { width, height };
          }
          const len = readUint16BE(buf, offset + 2);
          offset += 2 + len;
        }
        return {};
      }
      default:
        return {};
    }
  } catch {
    return {};
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function analyze(source: { url: string; name?: string } | { buffer: Buffer; name?: string }): Promise<ImageInfo> {
  let buf: Buffer;
  let name: string | undefined;
  if ('buffer' in source) {
    buf = source.buffer;
    name = source.name;
  } else {
    const res = await fetch(source.url);
    if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
    name = source.name ?? source.url.split('/').pop()?.split('?')[0] ?? 'image';
  }
  const { format, mime } = detectFormat(buf);
  const dims = detectDimensions(format, buf);
  return {
    format,
    mime,
    ...dims,
    bytes: buf.length,
    md5: crypto.createHash('md5').update(buf).digest('hex'),
    sha1: crypto.createHash('sha1').update(buf).digest('hex'),
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    ...(name ? { name } : {}),
  } as ImageInfo & { name?: string };
}

function render(info: ImageInfo & { name?: string }): string {
  const lines = [
    `# Image Info`,
    info.name ? `**File:** \`${info.name}\`` : '',
    `**Format:** ${info.format}`,
    `**MIME:** \`${info.mime}\``,
    info.width && info.height ? `**Dimensions:** ${info.width} × ${info.height} px` : '**Dimensions:** unknown',
    `**Size:** ${formatBytes(info.bytes)} (\`${info.bytes}\` bytes)`,
    `**MD5:** \`${info.md5}\``,
    `**SHA1:** \`${info.sha1}\``,
    `**SHA256:** \`${info.sha256}\``,
  ].filter(Boolean);
  return lines.join('\n');
}

const data = new SlashCommandBuilder()
  .setName('imageinfo')
  .setDescription('Get format, dimensions, size and hashes of an image')
  .addAttachmentOption((o) => o.setName('image').setDescription('Image attachment').setRequired(false))
  .addStringOption((o) => o.setName('url').setDescription('Image URL').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply({ ephemeral: true });
  const attachment = interaction.options.getAttachment('image');
  const url = interaction.options.getString('url');
  try {
    if (attachment) {
      const info = await analyze({ url: attachment.url, name: attachment.name });
      await v2Reply(interaction, render(info));
    } else if (url) {
      const info = await analyze({ url });
      await v2Reply(interaction, render(info));
    } else {
      await v2Reply(interaction, '❌ Provide an image attachment or URL.', { ephemeral: true });
    }
  } catch (err) {
    await v2Reply(interaction, `❌ ${err instanceof Error ? err.message : 'Failed to analyze image.'}`, { ephemeral: true });
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const attachment = message.attachments.first();
  const url = args[0];
  try {
    if (attachment) {
      const info = await analyze({ url: attachment.url, name: attachment.name });
      await v2MessageReply(message, { content: render(info) });
    } else if (url) {
      const info = await analyze({ url });
      await v2MessageReply(message, { content: render(info) });
    } else {
      await v2MessageReply(message, { content: 'Usage: `!imageinfo <image attachment or URL>`' });
    }
  } catch (err) {
    await v2MessageReply(message, { content: `❌ ${err instanceof Error ? err.message : 'Failed to analyze image.'}` });
  }
}

const command: BotCommand = {
  name: 'imageinfo',
  category: 'utility',
  description: 'Get format, dimensions, size and hashes of an image',
  usage: '!imageinfo <image attachment or URL>',
  data,
  permissions: [],
  aliases: ['ii', 'img'],
  execute,
  prefixExecute,
};

export default command;

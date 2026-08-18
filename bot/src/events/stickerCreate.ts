import { StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';

export async function handleStickerCreate(app: App, sticker: Sticker): Promise<void> {
  await app.logManager.log({
    event: 'sticker_create',
    guildId: sticker.guildId ?? '0',
    message: `Sticker added: ${sticker.name}`,
    details: { name: sticker.name, id: sticker.id, description: sticker.description, format: sticker.format },
    mediaUrls: sticker.format === StickerFormatType.Lottie ? undefined : [sticker.url],
  });
}

export default { name: 'stickerCreate', run: handleStickerCreate };

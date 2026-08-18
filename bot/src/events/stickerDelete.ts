import { StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';

export async function handleStickerDelete(app: App, sticker: Sticker): Promise<void> {
  await app.logManager.log({
    event: 'sticker_delete',
    guildId: sticker.guildId ?? '0',
    message: `Sticker removed: ${sticker.name}`,
    details: { name: sticker.name, id: sticker.id },
    mediaUrls: sticker.format === StickerFormatType.Lottie ? undefined : [sticker.url],
  });
}

export default { name: 'stickerDelete', run: handleStickerDelete };

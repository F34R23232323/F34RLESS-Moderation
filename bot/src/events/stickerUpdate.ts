import { StickerFormatType, type Sticker } from 'discord.js';
import type { App } from '../core/context';

export async function handleStickerUpdate(app: App, oldSticker: Sticker, newSticker: Sticker): Promise<void> {
  if (oldSticker.name === newSticker.name && oldSticker.description === newSticker.description) return;
  const changes: string[] = [];
  if (oldSticker.name !== newSticker.name) changes.push(`Name: ${oldSticker.name} -> ${newSticker.name}`);
  if (oldSticker.description !== newSticker.description) changes.push('Description changed');
  await app.logManager.log({
    event: 'sticker_update',
    guildId: newSticker.guildId ?? '0',
    message: `Sticker updated: ${newSticker.name}`,
    details: { name: newSticker.name, id: newSticker.id, changes },
    mediaUrls: newSticker.format === StickerFormatType.Lottie ? undefined : [newSticker.url],
  });
}

export default { name: 'stickerUpdate', run: handleStickerUpdate };

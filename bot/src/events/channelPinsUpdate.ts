import type { Channel } from 'discord.js';
import type { App } from '../core/context';

export async function handleChannelPinsUpdate(app: App, channel: Channel, _time: Date): Promise<void> {
  const guildId = (channel as { guildId?: string }).guildId;
  if (!guildId) return;
  await app.logManager.log({
    event: 'channel_pins_update',
    guildId,
    channelId: channel.id,
    message: `Pins updated in <#${channel.id}>`,
    details: { channelId: channel.id },
  });
}

export default { name: 'channelPinsUpdate', run: handleChannelPinsUpdate };
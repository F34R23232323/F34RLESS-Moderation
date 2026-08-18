import type { GuildChannel } from 'discord.js';
import type { App } from '../core/context';

export async function handleChannelCreate(app: App, channel: GuildChannel): Promise<void> {
  await app.logManager.log({
    event: 'channel_create',
    guildId: channel.guild.id,
    channelId: channel.id,
    message: `Channel #${channel.name} created`,
    details: { type: channel.type, id: channel.id },
  });
}

export default { name: 'channelCreate', run: handleChannelCreate };
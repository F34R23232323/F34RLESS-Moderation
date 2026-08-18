import type { GuildChannel } from 'discord.js';
import type { App } from '../core/context';

export async function handleChannelDelete(app: App, channel: GuildChannel): Promise<void> {
  await app.logManager.log({
    event: 'channel_delete',
    guildId: channel.guild.id,
    channelId: channel.id,
    message: `Channel #${channel.name} deleted`,
    details: { type: channel.type, id: channel.id },
  });
}

export default { name: 'channelDelete', run: handleChannelDelete };
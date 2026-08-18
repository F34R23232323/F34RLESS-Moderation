import type { App } from '../core/context';

export async function handleReady(app: App): Promise<void> {
  const guilds = app.client.guilds.cache;
  for (const guild of guilds.values()) {
    app.logger.info(`Ready in guild: ${guild.name} (${guild.id})`);
  }
  await app.messages.syncChannels();
  await app.messages.syncRoles();
}

export default { name: 'ready', once: true, run: handleReady };
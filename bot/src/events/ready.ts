import type { App } from '../core/context';

export async function handleReady(app: App): Promise<void> {
  await app.emojiManager.synchronize();
  const guilds = app.client.guilds.cache;
  for (const guild of guilds.values()) {
    app.logger.info(`Ready in guild: ${guild.name} (${guild.id})`);
    if (app.config.invite_tracking.enabled) {
      await app.inviteTracker.syncGuild(guild).catch(() => undefined);
    }
  }
  await app.messages.syncChannels();
  await app.messages.syncRoles();
  await app.stickyMessages.syncConfigured();
}

export default { name: 'ready', once: true, run: handleReady };

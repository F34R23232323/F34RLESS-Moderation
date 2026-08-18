import type { App } from './context';

export function installGlobalHandlers(app: App): void {
  process.on('uncaughtException', (err) => {
    console.error('uncaughtException:', err);
    void app.logManager.reportError('uncaughtException', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('unhandledRejection:', reason);
    void app.logManager.reportError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
  });

  const shutdown = async (signal: string) => {
    app.logger.info(`Received ${signal} — draining`);
    try {
      app.client.destroy();
    } catch {
      /* ignore */
    }
    try {
      await app.db.end();
    } catch {
      /* ignore */
    }
    app.logger.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
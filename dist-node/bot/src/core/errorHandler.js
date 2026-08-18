"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installGlobalHandlers = installGlobalHandlers;
function installGlobalHandlers(app) {
    process.on('uncaughtException', (err) => {
        console.error('uncaughtException:', err);
        void app.logManager.reportError('uncaughtException', err);
    });
    process.on('unhandledRejection', (reason) => {
        console.error('unhandledRejection:', reason);
        void app.logManager.reportError('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
    });
    const shutdown = async (signal) => {
        app.logger.info(`Received ${signal} — draining`);
        try {
            app.client.destroy();
        }
        catch {
            /* ignore */
        }
        try {
            await app.db.end();
        }
        catch {
            /* ignore */
        }
        app.logger.info('Shutdown complete');
        process.exit(0);
    };
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
}
//# sourceMappingURL=errorHandler.js.map
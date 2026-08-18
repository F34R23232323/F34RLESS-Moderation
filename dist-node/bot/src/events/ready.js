"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReady = handleReady;
async function handleReady(app) {
    const guilds = app.client.guilds.cache;
    for (const guild of guilds.values()) {
        app.logger.info(`Ready in guild: ${guild.name} (${guild.id})`);
    }
}
exports.default = { name: 'ready', once: true, run: handleReady };
//# sourceMappingURL=ready.js.map
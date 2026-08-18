"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.announceBirthdays = announceBirthdays;
const v2_1 = require("../utils/v2");
async function announceBirthdays(app) {
    const cfg = app.config.community.birthdays;
    if (!cfg.enabled || !cfg.channel_id)
        return;
    const [rows] = await app.db.query('SELECT user_id, month, day FROM birthdays WHERE month = ? AND day = ?', [new Date().getUTCMonth() + 1, new Date().getUTCDate()]);
    const channel = app.client.channels.cache.get(cfg.channel_id);
    if (!channel || !('send' in channel))
        return;
    for (const row of rows) {
        await (0, v2_1.v2Send)(channel, `Happy birthday to <@${row.user_id}>!`, { accentColor: '#FEE75C' }).catch(() => undefined);
    }
}
//# sourceMappingURL=birthdays.js.map
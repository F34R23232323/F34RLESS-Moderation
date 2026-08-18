"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.draw = draw;
async function draw(app, giveawayId, reroll = false) {
    const [rows] = await app.db.query('SELECT * FROM giveaways WHERE id = ?', [giveawayId]);
    const giveaway = rows[0];
    if (!giveaway)
        return;
    const guild = app.client.guilds.cache.get(giveaway.guild_id);
    if (!guild)
        return;
    const channel = guild.channels.cache.get(giveaway.channel_id);
    if (!channel || !('messages' in channel))
        return;
    const message = await channel.messages.fetch(giveaway.message_id).catch(() => null);
    if (!message)
        return;
    const reactions = message.reactions.cache;
    let entered = new Set();
    for (const reaction of reactions.values()) {
        const users = await reaction.users.fetch().catch(() => []);
        for (const u of users.values())
            if (!u.bot)
                entered.add(u.id);
    }
    if (entered.size === 0 && reroll)
        entered = new Set();
    const pool = [...entered];
    const winners = [];
    for (let i = 0; i < giveaway.winners && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        winners.push(pool.splice(idx, 1)[0]);
    }
    await message.edit({
        content: `**Giveaway ended: ${giveaway.prize}**\nWinners: ${winners.length > 0 ? winners.map((w) => `<@${w}>`).join(', ') : 'no entries'}`,
        components: [],
    });
    if (winners.length > 0) {
        await channel.send({ content: `Congratulations ${winners.map((w) => `<@${w}>`).join(', ')}! You won: **${giveaway.prize}**` });
    }
    await app.db.execute('UPDATE giveaways SET ended = 1, rerolled = ? WHERE id = ?', [giveaway.ended || reroll ? 1 : 0, giveawayId]);
}
//# sourceMappingURL=giveaways.js.map
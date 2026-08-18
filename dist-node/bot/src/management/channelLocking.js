"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockingService = void 0;
class LockingService {
    app;
    constructor(app) {
        this.app = app;
    }
    async lock(presetName) {
        const preset = this.app.config.channel_locking.presets.find((p) => p.name === presetName);
        if (!preset)
            throw new Error(`No lock preset named "${presetName}"`);
        const guild = this.app.client.guilds.cache.first();
        if (!guild)
            throw new Error('No guild available');
        let channels = [];
        if (preset.all_channels) {
            channels = guild.channels.cache
                .filter((c) => 'permissionOverwrites' in c)
                .map((c) => c);
        }
        else {
            for (const id of preset.channels) {
                const ch = guild.channels.cache.get(id);
                if (ch && 'permissionOverwrites' in ch)
                    channels.push(ch);
            }
            for (const catId of preset.categories) {
                const cat = guild.channels.cache.get(catId);
                if (!cat)
                    continue;
                for (const child of guild.channels.cache.filter((c) => c.parentId === catId).values()) {
                    if ('permissionOverwrites' in child)
                        channels.push(child);
                }
            }
        }
        let locked = 0;
        let failed = 0;
        for (const channel of channels) {
            try {
                await this.snapshot(channel, presetName);
                const overwrites = [{ id: guild.id, deny: preset.deny_permissions }];
                for (const roleId of preset.exclude_roles) {
                    const role = guild.roles.cache.get(roleId);
                    if (role)
                        overwrites.push({ id: role.id, allow: preset.deny_permissions });
                }
                await channel.permissionOverwrites.set(overwrites, `Lockdown preset: ${presetName}`);
                locked++;
            }
            catch {
                failed++;
            }
        }
        return { locked, failed };
    }
    async unlock(presetName) {
        const [rows] = await this.app.db.query('SELECT id, channel_id, overwrites FROM lockdown_snapshots WHERE preset_name = ? AND active = 1', [presetName]);
        let unlocked = 0;
        let failed = 0;
        for (const row of rows) {
            try {
                const channel = this.app.client.channels.cache.get(row.channel_id);
                if (channel && 'permissionOverwrites' in channel) {
                    const snapshot = JSON.parse(row.overwrites);
                    const resolvables = snapshot.map((o) => ({
                        id: o.id,
                        type: o.type,
                        allow: BigInt(o.allow),
                        deny: BigInt(o.deny),
                    }));
                    await channel.permissionOverwrites.set(resolvables, `Unlock preset: ${presetName}`);
                }
                await this.app.db.execute('UPDATE lockdown_snapshots SET active = 0, unlocked_at = NOW() WHERE id = ?', [row.id]);
                unlocked++;
            }
            catch {
                failed++;
            }
        }
        return { unlocked, failed };
    }
    async snapshot(channel, presetName) {
        const overwrites = [...channel.permissionOverwrites.cache.values()].map((o) => ({
            id: o.id,
            type: o.type,
            allow: String(o.allow.bitfield),
            deny: String(o.deny.bitfield),
        }));
        await this.app.db.execute(`INSERT INTO lockdown_snapshots (guild_id, preset_name, channel_id, overwrites)
       VALUES (?, ?, ?, ?)`, [channel.guildId, presetName, channel.id, JSON.stringify(overwrites)]);
    }
}
exports.LockingService = LockingService;
//# sourceMappingURL=channelLocking.js.map
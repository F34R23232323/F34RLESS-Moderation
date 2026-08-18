"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runJoinChecks = runJoinChecks;
const v2_1 = require("../utils/v2");
async function runJoinChecks(app, member) {
    const guild = member.guild;
    await runBlacklist(app, member);
    await runAltDetection(app, member);
    await runVerificationGate(app, member);
    await runAntiRaid(app, member);
    await runStickyRoles(app, member);
}
async function runBlacklist(app, member) {
    const cfg = app.config.blacklist;
    if (!cfg.enabled)
        return;
    const [rows] = await app.db.query('SELECT reason FROM blacklist WHERE guild_id = ? AND user_id = ?', [member.guild.id, member.id]);
    if (rows.length === 0)
        return;
    const reason = rows[0].reason ?? 'blacklisted';
    if (cfg.action === 'ban') {
        await member.ban({ reason: `Blacklisted: ${reason}` }).catch(() => undefined);
    }
    else if (cfg.action === 'kick') {
        await member.kick(`Blacklisted: ${reason}`).catch(() => undefined);
    }
    else {
        if (!cfg.silently_flag) {
            const ch = member.guild.channels.cache.get(app.config.logging.member_join?.channel_id ?? '');
            if (ch && 'send' in ch) {
                await (0, v2_1.v2Send)(ch, `Blacklisted user <@${member.id}> joined (${reason})`, { accentColor: '#ED4245' }).catch(() => undefined);
            }
        }
        await app.logManager.log({
            event: 'member_join',
            guildId: member.guild.id,
            targetId: member.id,
            message: `Blacklisted user joined: <@${member.id}>`,
            details: { blacklistReason: reason, action: 'flag' },
        });
    }
}
async function runAltDetection(app, member) {
    const cfg = app.config.alt_detection;
    if (!cfg.enabled)
        return;
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
    if (accountAgeDays > cfg.max_account_age_days)
        return;
    await app.logManager.log({
        event: 'member_join',
        guildId: member.guild.id,
        targetId: member.id,
        message: `Suspected alt account joined: <@${member.id}> (${Math.round(accountAgeDays)} days old)`,
        details: { accountAgeDays: Math.round(accountAgeDays) },
    });
}
async function runVerificationGate(app, member) {
    const cfg = app.config.verification_gate;
    if (!cfg.enabled)
        return;
    await app.db.execute(`INSERT INTO gates (guild_id, user_id, state, expires_at) VALUES (?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE state = 'pending', expires_at = VALUES(expires_at)`, [member.guild.id, member.id, cfg.timeout_kick_seconds > 0 ? new Date(Date.now() + cfg.timeout_kick_seconds * 1000) : null]);
    if (cfg.verified_role_id) {
        const role = member.guild.roles.cache.get(cfg.verified_role_id);
        if (role && role.position < (member.guild.members.me?.roles.highest.position ?? 0)) {
            // gate keeps them out by removing send permission handled via a base role;
            // we instead just flag for now — staff can rely on the button flow.
        }
    }
    if (cfg.button_channel_id) {
        const channel = member.guild.channels.cache.get(cfg.button_channel_id);
        if (channel && 'send' in channel) {
            const { v2Send } = await Promise.resolve().then(() => __importStar(require('../utils/v2')));
            await v2Send(channel, `Welcome <@${member.id}>! Click below to verify and gain access.`, {
                buttons: [{ customId: `verify:${member.id}`, label: 'Verify', style: 3 }],
            }).catch(() => undefined);
        }
    }
}
async function runAntiRaid(app, member) {
    const cfg = app.config.anti_raid;
    if (!cfg.enabled)
        return;
    const manager = app.automod;
    const moduleName = 'new_account_velocity';
    const modCfg = manager.getModuleConfig(moduleName);
    if (modCfg && modCfg.enabled)
        return; // new_account_velocity already handles velocity
    // Fallback: track raw join rate per guild
    const now = Date.now();
    const joinLog = app.joinRate.get(member.guild.id) ?? [];
    joinLog.push(now);
    app.joinRate.set(member.guild.id, joinLog.filter((t) => now - t <= cfg.window_seconds * 1000));
    if (app.joinRate.get(member.guild.id).length >= cfg.join_rate_threshold) {
        await app.antiRaid.trigger(member.guild.id);
    }
}
async function runStickyRoles(app, member) {
    const cfg = app.config.sticky_roles;
    if (!cfg.enabled)
        return;
    const [rows] = await app.db.query('SELECT roles FROM sticky_roles WHERE guild_id = ? AND user_id = ?', [member.guild.id, member.id]);
    if (rows.length === 0)
        return;
    const roles = JSON.parse(rows[0].roles);
    for (const roleId of roles) {
        const role = member.guild.roles.cache.get(roleId);
        if (role && role.position < (member.guild.members.me?.roles.highest.position ?? 0)) {
            await member.roles.add(roleId, 'Sticky role').catch(() => undefined);
        }
    }
}
//# sourceMappingURL=joinChecks.js.map
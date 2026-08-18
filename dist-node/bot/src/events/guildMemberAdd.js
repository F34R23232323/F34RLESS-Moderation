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
exports.handleGuildMemberAdd = handleGuildMemberAdd;
const v2_1 = require("../utils/v2");
async function handleGuildMemberAdd(app, member) {
    try {
        const guild = member.guild;
        const isBot = member.user.bot;
        if (isBot) {
            for (const roleId of app.config.join_roles.bot_roles) {
                await member.roles.add(roleId, 'Bot join role').catch(() => undefined);
            }
        }
        else {
            for (const roleId of app.config.join_roles.roles) {
                await member.roles.add(roleId, 'Join role').catch(() => undefined);
            }
        }
        await app.automod.handleJoin(member);
        const security = await Promise.resolve().then(() => __importStar(require('../security/joinChecks')));
        await security.runJoinChecks(app, member);
        const cfg = app.config.welcome;
        if (cfg.enabled && cfg.channel_id) {
            const channel = guild.channels.cache.get(cfg.channel_id);
            if (channel && 'send' in channel) {
                const text = cfg.message
                    .replaceAll('{user}', `<@${member.id}>`)
                    .replaceAll('{guild}', guild.name)
                    .replaceAll('{member_count}', String(guild.memberCount))
                    .replaceAll('{mention}', `<@${member.id}>`);
                await (0, v2_1.v2Send)(channel, text, { accentColor: '#57F287' }).catch(() => undefined);
            }
        }
        await app.logManager.log({
            event: 'member_join',
            guildId: guild.id,
            targetId: member.id,
            message: `<@${member.id}> joined (account created ${member.user.createdAt.toISOString()})`,
            details: { accountAgeDays: Math.round((Date.now() - member.user.createdTimestamp) / 86400000) },
        });
    }
    catch (err) {
        app.logger.error('guildMemberAdd handler threw:', err);
    }
}
exports.default = { name: 'guildMemberAdd', run: handleGuildMemberAdd };
//# sourceMappingURL=guildMemberAdd.js.map
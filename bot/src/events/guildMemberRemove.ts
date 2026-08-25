import type { GuildMember } from 'discord.js';
import { AuditLogEvent } from 'discord.js';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleGuildMemberRemove(app: App, member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;

    if (app.config.sticky_roles.enabled && !member.user.bot) {
      const roles = member.roles.cache
        .filter((r) => r.id !== guild.id && !r.managed)
        .map((r) => r.id);
      await app.db.execute(
        `INSERT INTO sticky_roles (guild_id, user_id, roles) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE roles = VALUES(roles)`,
        [guild.id, member.id, JSON.stringify(roles)],
      );
    }

    const cfg = app.config.goodbye;
    if (cfg.enabled && cfg.channel_id) {
      const channel = guild.channels.cache.get(cfg.channel_id);
      if (channel && 'send' in channel) {
        const text = cfg.message
          .replaceAll('{mention}', `<@${member.id}>`)
          .replaceAll('{user}', member.user.username)
          .replaceAll('{guild}', guild.name)
          .replaceAll('{member_count}', String(guild.memberCount));
        await v2Send(channel as never, text, { accentColor: '#ED4245' }).catch(() => undefined);
      }
    }

    const isBot = member.user.bot;
    const actorId = await resolveAuditActor(app, member.guild, AuditLogEvent.MemberKick, { targetId: member.id, windowMs: 6000, limit: 10 });
    if (actorId) {
      await app.logManager.log({
        event: 'member_kick',
        guildId: guild.id,
        actorId,
        targetId: member.id,
        message: `<@${member.id}> was kicked by <@${actorId}>`,
        details: { accountType: isBot ? 'bot' : 'user' },
      });
    } else {
      await app.logManager.log({
        event: 'member_leave',
        guildId: guild.id,
        targetId: member.id,
        message: `<@${member.id}> left${isBot ? ' (bot)' : ''}`,
        details: { accountType: isBot ? 'bot' : 'user' },
      });
    }
  } catch (err) {
    app.logger.error('guildMemberRemove handler threw:', err);
  }
}
export default { name: 'guildMemberRemove', run: handleGuildMemberRemove };
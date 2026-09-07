import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

export async function handleGuildMemberAdd(app: App, member: GuildMember): Promise<void> {
  try {
    const guild = member.guild;
    const isBot = member.user.bot;

    await app.messageLogs.upsertUser(guild.id, member.user, member);

    if (isBot) {
      await app.antiNuke.observe({ guild, type: 'bot_add', targetType: 'bot', targetId: member.id,
        after: { username: member.user.username } });
      for (const roleId of app.config.join_roles.bot_roles) {
        await member.roles.add(roleId, 'Bot join role').catch(() => undefined);
      }
    } else {
      for (const roleId of app.config.join_roles.roles) {
        await member.roles.add(roleId, 'Join role').catch(() => undefined);
      }
    }

    await app.automod.handleJoin(member);

    // Apply any role connection the new member already qualifies for.
    await app.roleConnections.syncMember(member);

    const security = await import('../security/joinChecks');
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
        await v2Send(channel as never, text, { accentColor: '#57F287' }).catch(() => undefined);
      }
    }

    await app.logManager.log({
      event: 'member_join',
      guildId: guild.id,
      targetId: member.id,
      message: `<@${member.id}> joined (account created ${member.user.createdAt.toISOString()})`,
      details: { accountAgeDays: Math.round((Date.now() - member.user.createdTimestamp) / 86400000) },
    });
  } catch (err) {
    app.logger.error('guildMemberAdd handler threw:', err);
  }
}
export default { name: 'guildMemberAdd', run: handleGuildMemberAdd };

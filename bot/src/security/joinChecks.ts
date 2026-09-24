import type { RowDataPacket } from 'mysql2/promise';
import { parseJson } from '../../../shared/src/index';
import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
import { v2Send } from '../utils/v2';

export async function runJoinChecks(app: App, member: GuildMember): Promise<void> {
  if (member.id === member.guild.ownerId) return;
  if (await app.whitelist.isWhitelisted(member.guild.id, member.id, 'all')) return;

  await runBlacklist(app, member);
  await runAltDetection(app, member);
  await runVerificationGate(app, member);
  await runAntiRaid(app, member);
  await runStickyRoles(app, member);
}

async function runBlacklist(app: App, member: GuildMember): Promise<void> {
  const cfg = app.config.blacklist;
  if (!cfg.enabled) return;
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT reason FROM blacklist WHERE guild_id = ? AND user_id = ?',
    [member.guild.id, member.id],
  );
  if (rows.length === 0) return;
  const reason = rows[0].reason ?? 'blacklisted';

  if (cfg.action === 'ban') {
    await member.ban({ reason: `Blacklisted: ${reason}` }).catch(() => undefined);
  } else if (cfg.action === 'kick') {
    await member.kick(`Blacklisted: ${reason}`).catch(() => undefined);
  } else {
    if (!cfg.silently_flag) {
      const ch = member.guild.channels.cache.get(app.config.logging.member_join?.channel_id ?? '');
      if (ch && 'send' in ch) {
        await v2Send(ch as never, `Blacklisted user <@${member.id}> joined (${reason})`, { accentColor: '#ED4245' }).catch(() => undefined);
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

async function runAltDetection(app: App, member: GuildMember): Promise<void> {
  const cfg = app.config.alt_detection;
  if (!cfg.enabled) return;
  const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
  if (accountAgeDays > cfg.max_account_age_days) return;
  await app.logManager.log({
    event: 'member_join',
    guildId: member.guild.id,
    targetId: member.id,
    message: `Suspected alt account joined: <@${member.id}> (${Math.round(accountAgeDays)} days old)`,
    details: { accountAgeDays: Math.round(accountAgeDays) },
  });
}

async function runVerificationGate(app: App, member: GuildMember): Promise<void> {
  const cfg = app.config.verification_gate;
  if (!cfg.enabled) return;

  if (cfg.verified_role_id) {
    const role = member.guild.roles.cache.get(cfg.verified_role_id);
    if (role && role.position < (member.guild.members.me?.roles.highest.position ?? 0)) {
      await member.roles.remove(cfg.verified_role_id, 'Re-verification required').catch(() => undefined);
    }
  }

  if (cfg.unverified_on_join && cfg.unverified_role_id) {
    const role = member.guild.roles.cache.get(cfg.unverified_role_id);
    if (role && role.position < (member.guild.members.me?.roles.highest.position ?? 0)) {
      await member.roles.add(cfg.unverified_role_id, 'Unverified — pending gate').catch(() => undefined);
    }
  }

  await app.db.execute(
    `INSERT INTO gates (guild_id, user_id, state, expires_at) VALUES (?, ?, 'pending', ?)
     ON DUPLICATE KEY UPDATE state = 'pending', expires_at = VALUES(expires_at)`,
    [member.guild.id, member.id, cfg.timeout_kick_seconds > 0 ? new Date(Date.now() + cfg.timeout_kick_seconds * 1000) : null],
  );
}

async function runAntiRaid(app: App, member: GuildMember): Promise<void> {
  const cfg = app.config.anti_raid;
  if (!cfg.enabled) return;
  const manager = app.automod;
  const moduleName = 'new_account_velocity';
  const modCfg = manager.getModuleConfig(moduleName);
  if (modCfg && modCfg.enabled) return;

  if (cfg.account_age_days > 0) {
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / 86400000;
    if (accountAgeDays > cfg.account_age_days) return;
  }

  const now = Date.now();
  const joinLog = app.joinRate.get(member.guild.id) ?? [];
  joinLog.push(now);
  app.joinRate.set(member.guild.id, joinLog.filter((t) => now - t <= cfg.window_seconds * 1000));
  if (app.joinRate.get(member.guild.id)!.length >= cfg.join_rate_threshold) {
    await app.antiRaid.trigger(member.guild.id);
  }
}

async function runStickyRoles(app: App, member: GuildMember): Promise<void> {
  const cfg = app.config.sticky_roles;
  if (!cfg.enabled) return;
  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT roles FROM sticky_roles WHERE guild_id = ? AND user_id = ?',
    [member.guild.id, member.id],
  );
  if (rows.length === 0) return;
  const roles = parseJson(rows[0].roles, []) as string[];
  for (const roleId of roles) {
    const role = member.guild.roles.cache.get(roleId);
    if (role && role.position < (member.guild.members.me?.roles.highest.position ?? 0)) {
      await member.roles.add(roleId, 'Sticky role').catch(() => undefined);
    }
  }
}
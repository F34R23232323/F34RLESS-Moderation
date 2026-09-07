import { AuditLogEvent, type Guild } from 'discord.js';
import type { App } from '../core/context';
import { resolveAuditActor } from '../utils/auditLog';

export async function handleGuildUpdate(app: App, oldGuild: Guild, newGuild: Guild): Promise<void> {
  const changes: string[] = [];
  if (oldGuild.name !== newGuild.name) changes.push(`Name: ${oldGuild.name} -> ${newGuild.name}`);
  if (oldGuild.icon !== newGuild.icon) changes.push('Icon changed');
  if (oldGuild.banner !== newGuild.banner) changes.push('Banner changed');
  if (oldGuild.verificationLevel !== newGuild.verificationLevel) changes.push(`Verification: ${oldGuild.verificationLevel} -> ${newGuild.verificationLevel}`);
  if (oldGuild.premiumTier !== newGuild.premiumTier) changes.push(`Boost tier: ${oldGuild.premiumTier} -> ${newGuild.premiumTier}`);
  if (changes.length === 0) return;
  await app.antiNuke.observe({ guild: newGuild, type: 'guild_update', targetType: 'guild', targetId: newGuild.id,
    before: { name: oldGuild.name, icon: oldGuild.icon, banner: oldGuild.banner, verificationLevel: oldGuild.verificationLevel },
    after: { name: newGuild.name, icon: newGuild.icon, banner: newGuild.banner, verificationLevel: newGuild.verificationLevel } });
  const actorId = await resolveAuditActor(app, newGuild, AuditLogEvent.GuildUpdate, { targetId: newGuild.id });
  await app.logManager.log({
    event: 'guild_update',
    guildId: newGuild.id,
    actorId,
    message: `Server settings updated: ${newGuild.name}`,
    details: { changes },
  });
}

export default { name: 'guildUpdate', run: handleGuildUpdate };

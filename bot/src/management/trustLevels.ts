import type { App } from '../core/context';

export async function checkAll(app: App): Promise<void> {
  const cfg = app.config.trust_levels;
  if (!cfg.enabled) return;

  for (const guild of app.client.guilds.cache.values()) {
    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;
    for (const member of members.values()) {
      if (member.user.bot || !member.joinedTimestamp) continue;
      const joinedDays = (Date.now() - member.joinedTimestamp) / 86400000;
      const level = cfg.levels
        .filter((l) => joinedDays >= l.after_days)
        .sort((a, b) => b.level - a.level)[0];
      if (!level) continue;

      if (level.require_clean_history) {
        const cases = await app.caseService.listCasesForUser(guild.id, member.id, 1);
        if (cases.length > 0) continue;
      }
      for (const roleId of level.roles) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId, `Trust level ${level.level}`).catch(() => undefined);
        }
      }
    }
  }
}
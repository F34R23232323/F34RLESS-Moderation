import type { AutomodModule, ModuleContext } from '../manager';
import type { InviteResolver } from '../inviteResolver';

export function createInvitesModule(resolver: InviteResolver): AutomodModule {
  return {
    name: 'invites',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.invites;
      if (!ctx.channel) return null;
      const codes = resolver.extractCodes(ctx.content);
      if (codes.length === 0) return null;

      for (const code of codes) {
        const resolved = await resolver.resolve(code);
        if (!resolved) continue;
        if (resolved.guildId === ctx.channel.guild.id) continue;
        if (cfg.guild_allowlist.includes(resolved.guildId)) continue;
        return {
          module: 'invites',
          rule: 'invites',
          reason: `discord invite to "${resolved.guildName}" (${resolved.guildId})`,
          content: ctx.content,
        };
      }
      return null;
    },
  };
}
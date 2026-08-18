import type { AutomodModule, ModuleContext } from '../manager';

const cache = new Map<string, RegExp>();

function compile(pattern: string, flags: string): RegExp {
  const key = `${pattern}:${flags}`;
  let re = cache.get(key);
  if (!re) {
    re = new RegExp(pattern, flags);
    cache.set(key, re);
  }
  return re;
}

export function createRegexEngineModule(): AutomodModule {
  return {
    name: 'regex_engine',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.regex_engine;
      if (!cfg.enabled) return null;

      const member = ctx.member;
      const nickname = member.nickname ?? member.user.username;
      const username = member.user.username;

      for (const rule of cfg.rules) {
        if (!rule.enabled) continue;
        if (rule.immune_roles.length > 0 && member.roles.cache.some((r) => rule.immune_roles.includes(r.id))) continue;
        let haystack = '';
        switch (rule.scope) {
          case 'message':
            haystack = ctx.content;
            break;
          case 'nickname':
            haystack = nickname;
            break;
          case 'username':
            haystack = username;
            break;
        }
        if (!haystack) continue;

        const patterns = rule.patterns && rule.patterns.length > 0 ? rule.patterns : rule.pattern ? [rule.pattern] : [];
        for (const p of patterns) {
          const re = compile(p, rule.flags);
          if (re.test(haystack)) {
            return {
              module: 'regex_engine',
              rule: rule.name,
              reason: `matched regex rule "${rule.name}" on ${rule.scope}`,
              content: haystack,
              action_chain: rule.action_chain,
              suppress_repeat_response_seconds: 30,
              suppressed_response_mode: 'silent',
            };
          }
        }
      }
      return null;
    },
  };
}
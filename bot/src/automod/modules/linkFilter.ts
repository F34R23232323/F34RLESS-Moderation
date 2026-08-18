import type { AutomodModule, ModuleContext } from '../manager';

const URL_RE = /https?:\/\/[^\s]+/gi;

export function createLinkFilterModule(): AutomodModule {
  return {
    name: 'link_filter',
    async check(ctx: ModuleContext) {
      const cfg = ctx.app.config.automod.modules.link_filter;
      if (!ctx.content) return null;
      const urls = ctx.content.match(URL_RE);
      if (!urls) return null;

      const hostname = (url: string): string => {
        try {
          const u = new URL(url);
          return u.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
          return url.toLowerCase();
        }
      };

      const allowlist = cfg.allowlist.map((h) => h.toLowerCase().replace(/^www\./, ''));
      const denylist = cfg.denylist.map((h) => h.toLowerCase().replace(/^www\./, ''));

      for (const url of urls) {
        const host = hostname(url);
        if (cfg.mode === 'deny_all') {
          return { module: 'link_filter', rule: 'link_filter', reason: `link posted: ${host}`, content: ctx.content };
        }
        if (cfg.mode === 'denylist' && denylist.includes(host)) {
          return { module: 'link_filter', rule: 'link_filter', reason: `denylisted host: ${host}`, content: ctx.content };
        }
        if (cfg.mode === 'allowlist' && !allowlist.includes(host)) {
          return { module: 'link_filter', rule: 'link_filter', reason: `non-allowlisted host: ${host}`, content: ctx.content };
        }
      }
      return null;
    },
  };
}
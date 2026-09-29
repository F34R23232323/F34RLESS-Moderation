import type { AutomodModule, ModuleContext } from '../manager';
import type { BlocklistCategory, BlocklistModuleName, BlocklistStore } from '../blocklistStore';
import { extractHosts } from '../blocklistStore';

function createLinkBlocklistModule(store: BlocklistStore, category: BlocklistCategory, moduleName: BlocklistModuleName): AutomodModule {
  return {
    name: moduleName,
    async check(ctx: ModuleContext) {
      if (!ctx.content) return null;
      for (const host of extractHosts(ctx.content)) {
        const source = store.match(category, host);
        if (source) {
          return {
            module: moduleName,
            rule: moduleName,
            reason: `blocked ${category} link: ${host} (blocklist: ${source})`,
            content: ctx.content,
          };
        }
      }
      return null;
    },
  };
}

export function createNsfwLinkBlocklistModule(store: BlocklistStore): AutomodModule {
  return createLinkBlocklistModule(store, 'nsfw', 'nsfw_link_blocklist');
}

export function createMaliciousLinkBlocklistModule(store: BlocklistStore): AutomodModule {
  return createLinkBlocklistModule(store, 'malicious', 'malicious_link_blocklist');
}

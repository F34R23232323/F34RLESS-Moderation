import type { App } from '../../core/context';
import type { AutomodManager } from '../manager';
import { MessageTracker } from '../tracker';
import { InviteResolver } from '../inviteResolver';
import { createSpamModule } from './spam';
import { createCrossChannelModule } from './crossChannel';
import { createLinkFilterModule } from './linkFilter';
import { createNsfwLinkBlocklistModule, createMaliciousLinkBlocklistModule } from './linkBlocklists';
import { createImageSpamModule } from './imageSpam';
import { createExecutableFilesModule } from './executableFiles';
import { createMassImagesModule } from './massImages';
import { createInvitesModule } from './invites';
import { createEmojiSpamModule } from './emojiSpam';
import { createLineSpamModule } from './lineSpam';
import { createPollSpamModule } from './pollSpam';
import { createDuplicateSpamModule } from './duplicateSpam';
import { createMassPingModule } from './massPing';
import { createRegexEngineModule } from './regexEngine';
import { createTypingSpeedModule } from '../heuristics/typingSpeed';
import { createMassIdenticalJoinsModule } from '../heuristics/massIdenticalJoins';
import { createNewAccountVelocityModule } from '../heuristics/newAccountVelocity';
import { createSpamRejoinsModule } from '../heuristics/spamRejoins';
import { createScamImagesModule } from './scamImages';
import type { ScamHashStore } from '../scamHashStore';

export function registerAutomodModules(app: App, manager: AutomodManager, scamHashStore: ScamHashStore): void {
  const tracker = new MessageTracker();
  const invites = new InviteResolver(app.client);

  const modules = [
    createSpamModule(tracker),
    createCrossChannelModule(),
    createLinkFilterModule(),
    createNsfwLinkBlocklistModule(app.blocklistStore),
    createMaliciousLinkBlocklistModule(app.blocklistStore),
    createImageSpamModule(),
    createExecutableFilesModule(),
    createMassImagesModule(),
    createInvitesModule(invites),
    createEmojiSpamModule(),
    createLineSpamModule(),
    createPollSpamModule(),
    createDuplicateSpamModule(),
    createMassPingModule(),
    createRegexEngineModule(),
    createTypingSpeedModule(),
    createScamImagesModule(scamHashStore),
  ];

  for (const m of modules) {
    manager.registerModule(m);
    if (m.name === 'regex_engine') {
      app.ruleVersioning.saveVersion(app.config.bot.owner_ids[0] ?? '0', 'regex_engine', 'engine', app.config.regex_engine).catch(() => undefined);
    }
  }

  manager.registerJoinModule(createMassIdenticalJoinsModule());
  manager.registerJoinModule(createNewAccountVelocityModule());
  manager.registerJoinModule(createSpamRejoinsModule());
}
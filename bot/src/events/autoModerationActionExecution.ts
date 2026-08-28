import type { AutoModerationActionExecution } from 'discord.js';
import type { App } from '../core/context';
import { handleNativeAutomod } from '../automod/nativeResponder';

export async function handleAutoModerationActionExecution(
  app: App,
  execution: AutoModerationActionExecution,
): Promise<void> {
  await handleNativeAutomod(app, execution);
}

export default { name: 'autoModerationActionExecution', run: handleAutoModerationActionExecution };

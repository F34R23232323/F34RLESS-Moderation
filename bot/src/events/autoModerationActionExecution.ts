import type { AutoModerationActionExecution } from 'discord.js';
import type { App } from '../core/context';
import { handleNativeAutomod } from '../automod/nativeResponder';

export async function handleAutoModerationActionExecution(
  app: App,
  execution: AutoModerationActionExecution,
): Promise<void> {
  app.logger.info(
    `[autoModerationActionExecution] FIRED — ruleId=${execution.ruleId} actionType=${execution.action.type} userId=${execution.userId} channelId=${execution.channelId ?? 'null'} messageId=${execution.messageId ?? 'null'} content="${execution.content?.slice(0, 80) ?? ''}"`,
  );
  await Promise.all([
    handleNativeAutomod(app, execution),
    app.replyPingProtection.handleExecution(execution),
  ]);
}

export default { name: 'autoModerationActionExecution', run: handleAutoModerationActionExecution };

import { AuditLogEvent } from 'discord.js';
import type { Guild, GuildAuditLogsEntry, Integration, Webhook } from 'discord.js';
import type { App } from '../core/context';

const INTEGRATION_ACTIONS = new Set<AuditLogEvent>([
  AuditLogEvent.IntegrationCreate,
  AuditLogEvent.IntegrationUpdate,
  AuditLogEvent.IntegrationDelete,
]);

const WEBHOOK_ACTIONS = new Set<AuditLogEvent>([
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.WebhookUpdate,
  AuditLogEvent.WebhookDelete,
]);

export async function handleGuildAuditLogEntryCreate(app: App, entry: GuildAuditLogsEntry, guild: Guild): Promise<void> {
  try {
    const action = entry.action;
    const isIntegration = INTEGRATION_ACTIONS.has(action);
    const isWebhook = WEBHOOK_ACTIONS.has(action);
    if (!isIntegration && !isWebhook) return;

    let logs;
    try {
      logs = await guild.fetchAuditLogs({ limit: 1 });
    } catch (err) {
      app.logger.debug(`audit lookup failed: ${(err as Error).message}`);
    }

    let appName: string | null = null;
    let integrationType: string | null = null;
    let webhookName: string | null = null;
    let webhookChannelId: string | null = null;
    const full = logs?.entries.first();
    if (full && full.id === entry.id) {
      if (isIntegration) {
        const integrations = (logs as unknown as { integrations: Map<string, Integration> }).integrations;
        const integration = integrations.get(entry.targetId ?? '');
        appName = integration?.name ?? null;
        integrationType = integration?.type ?? null;
      } else {
        const webhooks = (logs as unknown as { webhooks: Map<string, Webhook> }).webhooks;
        const webhook = webhooks.get(entry.targetId ?? '');
        webhookName = webhook?.name ?? null;
        webhookChannelId = webhook?.channelId ?? null;
      }
    }

    if (isIntegration) {
      const event =
        action === AuditLogEvent.IntegrationCreate
          ? 'integration_create'
          : action === AuditLogEvent.IntegrationUpdate
            ? 'integration_update'
            : 'integration_delete';

      const actionText =
        action === AuditLogEvent.IntegrationCreate
          ? 'was added to the server'
          : action === AuditLogEvent.IntegrationUpdate
            ? 'was updated in the server'
            : 'was removed from the server';

      await app.logManager.log({
        event,
        guildId: guild.id,
        actorId: entry.executorId,
        targetId: entry.targetId,
        message: `${appName ? `**${appName}**` : 'An application'} ${actionText}${entry.executorId ? ` by <@${entry.executorId}>` : ''}`,
        details: {
          appName,
          integrationId: entry.targetId,
          integrationType,
          reason: entry.reason,
        },
      });
      return;
    }

    const event =
      action === AuditLogEvent.WebhookCreate
        ? 'webhook_create'
        : action === AuditLogEvent.WebhookUpdate
          ? 'webhook_update'
          : 'webhook_delete';

    const actionText =
      action === AuditLogEvent.WebhookCreate
        ? 'was created'
        : action === AuditLogEvent.WebhookUpdate
          ? 'was updated'
          : 'was deleted';

    await app.logManager.log({
      event,
      guildId: guild.id,
      channelId: webhookChannelId,
      actorId: entry.executorId,
      targetId: entry.targetId,
      message: `${webhookName ? `**${webhookName}**` : 'A webhook'} ${actionText}${webhookChannelId ? ` in <#${webhookChannelId}>` : ''}${entry.executorId ? ` by <@${entry.executorId}>` : ''}`,
      details: {
        webhookName,
        webhookId: entry.targetId,
        channelId: webhookChannelId,
        reason: entry.reason,
      },
    });
  } catch (err) {
    app.logger.error('guildAuditLogEntryCreate handler threw:', err);
  }
}

export default { name: 'guildAuditLogEntryCreate', run: handleGuildAuditLogEntryCreate };
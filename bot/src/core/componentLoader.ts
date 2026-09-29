import * as path from 'path';
import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { App } from './context';
import { importFiles } from '../utils/fs';

export type ComponentType = 'button' | 'select' | 'modal';

export interface ComponentHandler {
  type: ComponentType;
  id: string;
  run: (app: App, interaction: any) => Promise<void>;
}

export class ComponentRegistry {
  private readonly handlers = new Map<string, ComponentHandler>();

  public register(handler: ComponentHandler): void {
    this.handlers.set(`${handler.type}:${handler.id}`, handler);
  }

  public resolve(type: ComponentType, customId: string): ComponentHandler | undefined {
    const exact = this.handlers.get(`${type}:${customId}`);
    if (exact) return exact;
    for (const [key, handler] of this.handlers) {
      if (!key.startsWith(`${type}:`)) continue;
      const id = key.slice(type.length + 1);
      if (customId.startsWith(id)) return handler;
    }
    return undefined;
  }
}

export async function loadComponents(app: App): Promise<void> {
  const dir = path.join(__dirname, '../components');
  const handlers = await importFiles<ComponentHandler | ComponentHandler[]>(dir);
  let count = 0;
  for (const raw of handlers) {
    const list = Array.isArray(raw) ? raw : [raw];
    for (const h of list) {
      if (!h || !h.id || typeof h.run !== 'function') continue;
      app.components.register(h);
      count++;
    }
  }
  app.logger.info(`Registered ${count} component handlers`);
}

export async function dispatchComponent(
  app: App,
  type: ComponentType,
  interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction,
): Promise<void> {
  try {
    const handler = app.components.resolve(type, interaction.customId);
    if (!handler) {
      // If this component is handled by an active message collector (pagination, confirmations, etc.),
      // do not intercept it — let the collector process the interaction.
      if (
        interaction.customId.startsWith('paginate:') ||
        interaction.customId.includes('_prev') ||
        interaction.customId.includes('_next') ||
        interaction.customId.startsWith('pconfirm:') ||
        interaction.customId.startsWith('pcancel:') ||
        interaction.customId.startsWith('v2_')
      ) {
        return;
      }

      // Stale component (expired confirmation, old message) — tell the user
      // instead of letting Discord show a bare "interaction failed".
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: 'This action has expired or is no longer available.',
          ephemeral: true,
        }).catch(() => undefined);
      }
      return;
    }

    await handler.run(app, interaction);
  } catch (err) {
    app.logger.error(`Component ${type} ${interaction.customId} threw:`, err);
    await app.logManager.reportError(`Component ${type} ${interaction.customId}`, err);
    const message = 'Something went wrong while processing this action. The outcome has been logged.';
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({ content: message, ephemeral: true });
      } else {
        await interaction.followUp({ content: message, ephemeral: true });
      }
    } catch {
      // user dismissed the interaction token — nothing left to reply to
    }
  }
}
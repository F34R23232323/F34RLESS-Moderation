import * as path from 'path';
import type { App } from './context';
import { importFiles } from '../utils/fs';

export interface BotEvent {
  name: string;
  once?: boolean;
  run: (...args: unknown[]) => Promise<void> | void;
}

export async function loadEvents(app: App): Promise<void> {
  const dir = path.join(__dirname, '../events');
  const events = await importFiles<BotEvent>(dir);
  let count = 0;
  for (const ev of events) {
    if (!ev || !ev.name || typeof ev.run !== 'function') continue;
    try {
      if (ev.once) {
        app.client.once(ev.name, (...args: unknown[]) =>
          void runEvent(app, ev.name, ev.run, args),
        );
      } else {
        app.client.on(ev.name, (...args: unknown[]) => void runEvent(app, ev.name, ev.run, args));
      }
      count++;
    } catch (err) {
      app.logger.error(`Failed to register event ${ev.name}:`, err);
    }
  }
  app.logger.info(`Registered ${count} event handlers`);
}

async function runEvent(app: App, name: string, run: BotEvent['run'], args: unknown[]): Promise<void> {
  try {
    // Every handler is authored as (app, ...eventArgs); the App is always the
    // first argument regardless of which discord.js event fired.
    await run(app, ...args);
  } catch (err) {
    app.logger.error(`Event ${name} threw:`, err);
    await app.logManager.reportError(`Event ${name} threw`, err);
  }
}
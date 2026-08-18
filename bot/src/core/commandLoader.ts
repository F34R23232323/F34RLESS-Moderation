import * as path from 'path';
import type { App } from './context';
import type { BotCommand } from '../types/command';
import { importFiles } from '../utils/fs';

export interface LoadResult {
  commands: Map<string, BotCommand>;
  aliases: Map<string, string>;
}

export async function loadCommands(app: App): Promise<ContextLoadResult> {
  const dir = path.join(__dirname, '../commands');
  const commands = new Map<string, BotCommand>();
  const aliases = new Map<string, string>();
  const messageCommands = new Map<string, BotCommand>();
  const userCommands = new Map<string, BotCommand>();

  const loaded = await importFiles<BotCommand | BotCommand[]>(dir);
  for (const raw of loaded) {
    const list = Array.isArray(raw) ? raw : [raw];
    for (const cmd of list) {
      if (!cmd || !cmd.name) continue;
      const cfg = app.config.commands[cmd.name];
      const enabled = cfg?.enabled ?? true;
      if (!enabled) {
        app.logger.info(`Command ${cmd.name} disabled by config — skipping`);
        continue;
      }
      commands.set(cmd.name, cmd);
      if (cmd.asMessageContext && cmd.contextExecute) messageCommands.set(cmd.name, cmd);
      if (cmd.asUserContext && cmd.contextExecute) userCommands.set(cmd.name, cmd);
      for (const alias of cmd.aliases ?? []) {
        aliases.set(alias.toLowerCase(), cmd.name);
      }
      for (const alias of cfg?.aliases ?? []) {
        aliases.set(alias.toLowerCase(), cmd.name);
      }
    }
  }

  app.logger.info(`Loaded ${commands.size} commands, ${aliases.size} aliases`);
  return { commands, aliases, messageCommands, userCommands };
}

export interface ContextLoadResult {
  commands: Map<string, BotCommand>;
  aliases: Map<string, string>;
  messageCommands: Map<string, BotCommand>;
  userCommands: Map<string, BotCommand>;
}
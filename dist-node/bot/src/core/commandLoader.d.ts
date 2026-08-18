import type { App } from './context';
import type { BotCommand } from '../types/command';
export interface LoadResult {
    commands: Map<string, BotCommand>;
    aliases: Map<string, string>;
}
export declare function loadCommands(app: App): Promise<ContextLoadResult>;
export interface ContextLoadResult {
    commands: Map<string, BotCommand>;
    aliases: Map<string, string>;
    messageCommands: Map<string, BotCommand>;
    userCommands: Map<string, BotCommand>;
}

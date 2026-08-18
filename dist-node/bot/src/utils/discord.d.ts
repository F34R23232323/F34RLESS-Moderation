import type { ChatInputCommandInteraction, Guild, User } from 'discord.js';
import type { App } from '../core/context';
export declare function resolveUserOption(interaction: ChatInputCommandInteraction, app: App, optionName?: string): Promise<User | null>;
export declare function resolveMemberOption(interaction: ChatInputCommandInteraction, guild: Guild, app: App, optionName?: string): Promise<{
    member: any;
    user: User | null;
} | null>;
export declare function getOptionString(interaction: ChatInputCommandInteraction, name: string): string | undefined;
export declare function getOptionInt(interaction: ChatInputCommandInteraction, name: string): number | undefined;
export declare function getOptionBoolean(interaction: ChatInputCommandInteraction, name: string): boolean | undefined;

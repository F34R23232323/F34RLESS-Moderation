import type { GuildMember } from 'discord.js';
import type { App } from '../core/context';
export declare function runJoinChecks(app: App, member: GuildMember): Promise<void>;

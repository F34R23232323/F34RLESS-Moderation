import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
export declare function closePoll(app: App, pollId: string): Promise<void>;
declare const command: BotCommand;
export default command;

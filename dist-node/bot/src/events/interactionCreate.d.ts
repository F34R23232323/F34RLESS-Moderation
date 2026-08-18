import type { Interaction } from 'discord.js';
import type { App } from '../core/context';
export declare function handleInteractionCreate(app: App, interaction: Interaction): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleInteractionCreate;
};
export default _default;

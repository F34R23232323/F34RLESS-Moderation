import type { ButtonInteraction } from 'discord.js';
import type { App } from '../core/context';
declare const _default: {
    type: string;
    id: string;
    run(app: App, interaction: ButtonInteraction): Promise<void>;
}[];
export default _default;

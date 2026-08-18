import type { VoiceState } from 'discord.js';
import type { App } from '../core/context';
export declare function handleVoiceStateUpdate(app: App, oldState: VoiceState, newState: VoiceState): Promise<void>;
declare const _default: {
    name: string;
    run: typeof handleVoiceStateUpdate;
};
export default _default;

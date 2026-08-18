import type { App } from './context';
export interface BotEvent {
    name: string;
    once?: boolean;
    run: (...args: unknown[]) => Promise<void> | void;
}
export declare function loadEvents(app: App): Promise<void>;

import type { App } from '../core/context';
export declare function handleReady(app: App): Promise<void>;
declare const _default: {
    name: string;
    once: boolean;
    run: typeof handleReady;
};
export default _default;

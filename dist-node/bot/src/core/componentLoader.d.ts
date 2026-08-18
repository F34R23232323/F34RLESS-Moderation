import type { ButtonInteraction, ModalSubmitInteraction, StringSelectMenuInteraction } from 'discord.js';
import type { App } from './context';
export type ComponentType = 'button' | 'select' | 'modal';
export interface ComponentHandler {
    type: ComponentType;
    id: string;
    run: (app: App, interaction: any) => Promise<void>;
}
export declare class ComponentRegistry {
    private readonly handlers;
    register(handler: ComponentHandler): void;
    resolve(type: ComponentType, customId: string): ComponentHandler | undefined;
}
export declare function loadComponents(app: App): Promise<void>;
export declare function dispatchComponent(app: App, type: ComponentType, interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction): Promise<void>;

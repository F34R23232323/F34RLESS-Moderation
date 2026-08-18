import { ButtonStyle } from 'discord.js';
export interface V2MessageOptions {
    imageUrl?: string;
    buttons?: Array<{
        customId: string;
        label: string;
        style?: ButtonStyle;
        disabled?: boolean;
    }>;
    accentColor?: string;
}
export declare function buildV2Content(content: string, opts?: V2MessageOptions): {
    components: unknown[];
    flags: number;
};
export declare function v2Send(channel: any, content: string, opts?: V2MessageOptions): any;
export declare function v2Reply(interaction: any, content: string, opts?: V2MessageOptions & {
    ephemeral?: boolean;
}): Promise<void>;

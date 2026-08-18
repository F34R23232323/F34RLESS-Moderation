import type { Client } from 'discord.js';
export interface ResolvedInvite {
    code: string;
    guildId: string;
    guildName: string;
    inviterId?: string | null;
    channelName?: string;
    uses?: number;
}
export declare class InviteResolver {
    private readonly client;
    constructor(client: Client);
    extractCodes(content: string): string[];
    resolve(code: string): Promise<ResolvedInvite | null>;
}

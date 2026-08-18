import type { TextChannel, GuildMember, Message } from 'discord.js';
import type { App } from '../core/context';
import { ActionChainExecutor } from './chainExecutor';
import { ResponseThrottle } from './responseThrottle';
export interface ModuleContext {
    app: App;
    member: GuildMember;
    message?: Message | null;
    channel?: TextChannel | null;
    content: string;
}
export interface AutomodHit {
    module: string;
    rule: string;
    reason: string;
    content: string;
}
export interface AutomodModule {
    name: string;
    check: (ctx: ModuleContext) => Promise<AutomodHit | null>;
}
export declare class AutomodManager {
    private readonly app;
    readonly executor: ActionChainExecutor;
    readonly throttle: ResponseThrottle;
    private modules;
    private readonly joinModules;
    constructor(app: App);
    registerModule(module: AutomodModule): void;
    registerJoinModule(module: AutomodModule): void;
    handleMessage(message: Message): Promise<void>;
    getModuleConfig(moduleName: string): (typeof this.app.config.automod.modules)[keyof typeof this.app.config.automod.modules] | null;
    handleJoin(member: GuildMember): Promise<void>;
    handleNickname(member: GuildMember, nickname: string): Promise<void>;
    private handleHit;
    private maybePostSummary;
}

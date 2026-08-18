import type { App } from '../core/context';
export interface RuleVersionInfo {
    id: number;
    version: number;
    config: unknown;
    createdAt: Date;
}
export declare class RuleVersioning {
    private readonly app;
    constructor(app: App);
    saveVersion(guildId: string, module: string, name: string, config: unknown, createdBy?: string | null): Promise<number>;
    listVersions(guildId: string, module: string, name: string): Promise<RuleVersionInfo[]>;
    rollback(guildId: string, module: string, name: string, targetVersion: number): Promise<unknown>;
}

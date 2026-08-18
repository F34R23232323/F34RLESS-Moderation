import { type BotConfig } from './schema';
export interface EnvVars {
    DISCORD_TOKEN: string;
    OWNER_USER_ID?: string;
    DASHBOARD_SESSION_SECRET: string;
    MYSQL_HOST: string;
    MYSQL_PORT: string;
    MYSQL_DATABASE: string;
    MYSQL_USER: string;
    MYSQL_PASSWORD: string;
    DATABASE_URL?: string;
    CONFIG_PATH?: string;
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    DASHBOARD_BASE_URL?: string;
    REGISTER_GUILD_ID?: string;
}
export declare function loadEnv(): EnvVars;
export declare function buildDatabaseUrl(env: EnvVars): string;
export interface LoadedConfig {
    config: BotConfig;
    env: EnvVars;
    configPath: string;
}
export declare function loadConfig(options?: {
    configPath?: string;
}): LoadedConfig;
export declare function formatConfigError(err: unknown): string;

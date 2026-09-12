import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as YAML from 'yaml';
import { configSchema, type BotConfig } from './schema';
import { runCrossFieldChecks } from './crossField';
import { ConfigValidationError, type ConfigIssue } from './errors';

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
  /** Production guild ID — guild-scoped commands (moderation/admin) are registered here */
  GUILD_ID?: string;
  /** Optional Spotify API credentials — improve Spotify URL resolution reliability */
  SPOTIFY_CLIENT_ID?: string;
  SPOTIFY_CLIENT_SECRET?: string;
  /** Single API key used by external bots to authenticate against the HTTP API. */
  API_KEYS?: string;
  /** OneUptime API key with ReadProjectStatusPage permission. */
  ONEUPTIME_API_KEY?: string;
  /** Base URL for the OneUptime installation (defaults to https://status.f34r.rip). */
  ONEUPTIME_BASE_URL?: string;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function loadEnv(): EnvVars {
  dotenv.config();
  return {
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    OWNER_USER_ID: process.env.OWNER_USER_ID,
    DASHBOARD_SESSION_SECRET: requireEnv('DASHBOARD_SESSION_SECRET'),
    MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
    MYSQL_PORT: process.env.MYSQL_PORT || '3390',
    MYSQL_DATABASE: requireEnv('MYSQL_DATABASE'),
    MYSQL_USER: requireEnv('MYSQL_USER'),
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || '',
    DATABASE_URL: process.env.DATABASE_URL,
    CONFIG_PATH: process.env.CONFIG_PATH,
    CLIENT_ID: requireEnv('CLIENT_ID'),
    CLIENT_SECRET: requireEnv('CLIENT_SECRET'),
    DASHBOARD_BASE_URL: process.env.DASHBOARD_BASE_URL || 'http://localhost:4693',
    REGISTER_GUILD_ID: process.env.REGISTER_GUILD_ID,
    GUILD_ID: process.env.GUILD_ID,
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
    API_KEYS: process.env.API_KEYS,
    ONEUPTIME_API_KEY: process.env.ONEUPTIME_API_KEY,
    ONEUPTIME_BASE_URL: process.env.ONEUPTIME_BASE_URL,
  };
}

export function buildDatabaseUrl(env: EnvVars): string {
  if (env.DATABASE_URL && env.DATABASE_URL.trim().length > 0) return env.DATABASE_URL;
  return `mysql://${encodeURIComponent(env.MYSQL_USER)}:${encodeURIComponent(env.MYSQL_PASSWORD)}@${env.MYSQL_HOST}:${env.MYSQL_PORT}/${env.MYSQL_DATABASE}`;
}

export interface LoadedConfig {
  config: BotConfig;
  env: EnvVars;
  configPath: string;
}

export function loadConfig(options?: { configPath?: string }): LoadedConfig {
  const env = loadEnv();
  const configPath = path.resolve(options?.configPath || env.CONFIG_PATH || process.cwd() + '/config.yml');

  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Config file not found at ${configPath}. Copy config.yml from the repository root or set CONFIG_PATH.`,
    );
  }

  if (fs.statSync(configPath).isDirectory()) {
    throw new Error(
      `Expected a config FILE at ${configPath} but found a directory. ` +
        `This usually means config.yml does not exist on the host and Docker created an empty directory at the mount point. ` +
        `Create config.yml first (e.g. \`npm run gen-config\`), then \`docker compose down && docker compose up -d\` to replace the directory mount.`,
    );
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = YAML.parse(raw);
  } catch (e) {
    throw new Error(`Failed to parse ${configPath}: ${(e as Error).message}`);
  }

  const result = configSchema.safeParse(parsed ?? {});
  const issues: ConfigIssue[] = [];
  if (!result.success) {
    for (const issue of result.error.issues) {
      issues.push({
        path: issue.path.join('.') || '(root)',
        expected: 'expected ' + String((issue as unknown as { expected?: unknown }).expected ?? issue.message),
        found: 'received ' + JSON.stringify((issue as unknown as { received?: unknown }).received),
      });
    }
  }

  const config: BotConfig = result.success ? result.data : (null as unknown as BotConfig);
  if (result.success) {
    issues.push(...runCrossFieldChecks(config));
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return { config, env, configPath };
}

export function formatConfigError(err: unknown): string {
  if (err instanceof ConfigValidationError) return err.formatHumanReadable();
  return (err as Error).message;
}

import { createDbPool, loadConfig, buildDatabaseUrl, formatConfigError } from '../../../shared/src/index';
import type { Pool } from 'mysql2/promise';
import type { BotConfig } from '../../../shared/src/index';
import { GuildAccessService } from './appeals/guildAccess';

export interface DashboardContext {
  db: Pool;
  ownerUserId: string;
  sessionSecret: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  port: number;
  discordToken: string;
  config: BotConfig;
  guildAccess: GuildAccessService;
}

export function loadDashboardContext(): DashboardContext {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(formatConfigError(err));
    process.exit(1);
  }
  const { env } = config;
  const ownerUserId = env.OWNER_USER_ID || config.config.dashboard.owner_user_id || '';
  if (!ownerUserId) {
    console.error('Dashboard owner_user_id is not configured (set OWNER_USER_ID in .env or config.yml).');
    process.exit(1);
  }

  const db = createDbPool(buildDatabaseUrl(env));
  return {
    db,
    ownerUserId,
    sessionSecret: env.DASHBOARD_SESSION_SECRET,
    clientId: env.CLIENT_ID,
    clientSecret: env.CLIENT_SECRET,
    baseUrl: env.DASHBOARD_BASE_URL || 'http://localhost:4693',
    port: config.config.dashboard.port,
    discordToken: env.DISCORD_TOKEN,
    config: config.config,
    guildAccess: new GuildAccessService(env.DISCORD_TOKEN),
  };
}
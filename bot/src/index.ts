import { REST, Routes, SlashCommandBuilder, ActivityType } from 'discord.js';
import { createDbPool, loadConfig, formatConfigError, buildDatabaseUrl, waitForDb, runMigrations, migrations } from '../../shared/src/index';
import { BotClient } from './client/BotClient';
import { Logger } from './core/logger';
import { LogManager } from './core/logManager';
import { CooldownManager } from './core/cooldown';
import { ComponentRegistry } from './core/componentLoader';
import { loadCommands } from './core/commandLoader';
import { CustomCommandRunner } from './core/customCommandRunner';
import { loadEvents } from './core/eventLoader';
import { loadComponents } from './core/componentLoader';
import { installGlobalHandlers } from './core/errorHandler';
import { installRateLimitReporter } from './core/rateLimitReporter';
import { CaseService } from './moderation/caseService';
import { PunishmentManager } from './moderation/punishmentManager';
import { PunishmentDmManager } from './moderation/punishmentDm';
import { WarningEscalation } from './moderation/warningEscalation';
import { PunishmentEscalation } from './moderation/punishmentEscalation';
import { ModerationCommandGuard } from './moderation/hierarchyGuard';
import { AutomodManager } from './automod/manager';
import { RiskScoring } from './automod/riskScoring';
import { RuleVersioning } from './automod/ruleVersioning';
import { registerAutomodModules } from './automod/modules';
import { SchedulerService } from './scheduler/service';
import { Metrics } from './metrics/metrics';
import { ReportingService } from './reporting/reportingService';
import { LockingService } from './management/channelLocking';
import { SlowmodeScheduler } from './management/slowmodeScheduler';
import { AntiRaidService } from './security/antiRaid';
import { SavedMessageService } from './services/savedMessageService';
import { DashboardLogService } from './services/dashboardLogService';
import { ArchiveService } from './services/archiveService';
import { MessageLogService } from './services/messageLogService';
import { RoleConnectionsService } from './services/roleConnections';
import { MessageContentCache } from './utils/messageCache';
import type { App } from './core/context';
import { MusicService } from './music/MusicService';

async function main(): Promise<void> {
  const logger = new Logger('boot');
  let loaded;
  try {
    loaded = loadConfig();
  } catch (err) {
    console.error(formatConfigError(err));
    process.exit(1);
  }
  const { config, env, configPath } = loaded;
  logger.info(`Config loaded from ${configPath}`);

  if (!env.DISCORD_TOKEN || env.DISCORD_TOKEN.trim().length === 0) {
    logger.error('DISCORD_TOKEN is required to start the bot. Set it in .env and restart.');
    process.exit(1);
  }

  const databaseUrl = buildDatabaseUrl(env);
  const db = createDbPool(databaseUrl);

  try {
    await waitForDb(db, 90_000);
  } catch (err) {
    logger.error('Could not connect to database', err);
    process.exit(1);
  }
  logger.info('Database connected');

  try {
    const applied = await runMigrations(db, migrations);
    if (applied.length > 0) logger.info(`Applied migrations: ${applied.join(', ')}`);
  } catch (err) {
    logger.error('Migration failed', err);
    process.exit(1);
  }

  const logManager = new LogManager(db);
  const cooldowns = new CooldownManager();
  const components = new ComponentRegistry();
  const customCommands = new CustomCommandRunner();
  const app: App = {
    config,
    env,
    db,
    configPath,
    client: null as unknown as BotClient,
    logger,
    logManager,
    cooldowns,
    components,
    customCommands,
    commands: new Map(),
    aliases: new Map(),
    customCommandAliases: new Map(),
    messageCommands: new Map(),
    userCommands: new Map(),
    caseService: null as unknown as CaseService,
    punishmentManager: null as unknown as PunishmentManager,
    punishmentDm: null as unknown as PunishmentDmManager,
    warningEscalation: null as unknown as WarningEscalation,
    punishmentEscalation: null as unknown as PunishmentEscalation,
    modGuard: null as unknown as ModerationCommandGuard,
    automod: null as unknown as AutomodManager,
    riskScoring: null as unknown as RiskScoring,
    ruleVersioning: null as unknown as RuleVersioning,
    scheduler: null as unknown as SchedulerService,
    metrics: null as unknown as Metrics,
    reporting: null as unknown as ReportingService,
    lockingService: null as unknown as LockingService,
    slowmodeScheduler: null as unknown as SlowmodeScheduler,
    antiRaid: null as unknown as AntiRaidService,
    joinRate: new Map<string, number[]>(),
    messages: null as unknown as SavedMessageService,
    messageCache: new MessageContentCache(),
    dashboardLogs: null as unknown as DashboardLogService,
    archives: null as unknown as ArchiveService,
    messageLogs: null as unknown as MessageLogService,
    roleConnections: null as unknown as RoleConnectionsService,
    music: null as unknown as MusicService,
    polls: new Map(),
    customCache: new Map(),
    startedAt: Date.now(),
  };

  for (const [name, cc] of Object.entries(app.config.custom_commands)) {
    if (!cc.enabled) continue;
    for (const alias of cc.aliases) {
      app.customCommandAliases.set(alias.toLowerCase(), name);
    }
  }

  const client = new BotClient(app);
  app.client = client;
  logManager.app = app;

  app.caseService = new CaseService(db);
  app.punishmentDm = new PunishmentDmManager(app);
  app.punishmentManager = new PunishmentManager(app);
  app.warningEscalation = new WarningEscalation(app);
  app.punishmentEscalation = new PunishmentEscalation(app);
  app.modGuard = new ModerationCommandGuard(app);
  app.automod = new AutomodManager(app);
  app.riskScoring = new RiskScoring(app);
  app.ruleVersioning = new RuleVersioning(app);
  app.reporting = new ReportingService(app);
  app.lockingService = new LockingService(app);
  app.slowmodeScheduler = new SlowmodeScheduler(app);
  app.antiRaid = new AntiRaidService(app);
  app.messages = new SavedMessageService(app);
  app.dashboardLogs = new DashboardLogService(app);
  app.archives = new ArchiveService(app);
  app.messageLogs = new MessageLogService(app);
  app.roleConnections = new RoleConnectionsService(app);
  app.music = new MusicService(app);
  app.metrics = new Metrics(app);
  app.scheduler = new SchedulerService(app);

  registerAutomodModules(app, app.automod);
  installGlobalHandlers(app);
  installRateLimitReporter(app);

  const { commands, aliases, messageCommands, userCommands } = await loadCommands(app);
  app.commands = commands;
  app.aliases = aliases;
  app.messageCommands = messageCommands;
  app.userCommands = userCommands;

  await loadEvents(app);
  await loadComponents(app);

  await registerSlashCommands(app);

  client.once('ready', async () => {
    app.logger.info(`Logged in as ${client.user?.tag}`);
    app.scheduler.start();
    void app.music.restoreAll().then(() => app.logger.info('Music 24/7 sessions restored'));
    const activityType: Record<string, ActivityType> = {
      Playing: ActivityType.Playing,
      Streaming: ActivityType.Streaming,
      Listening: ActivityType.Listening,
      Watching: ActivityType.Watching,
      Competing: ActivityType.Competing,
    };
    const type = activityType[config.bot.activity.type] ?? ActivityType.Playing;
    const url = type === ActivityType.Streaming ? config.bot.activity.url || 'https://twitch.tv/' : undefined;
    app.client.user?.setPresence({
      status: config.bot.status,
      activities: [{ name: config.bot.activity.text, type, url }],
    });
  });

  await client.login(env.DISCORD_TOKEN);
  app.logger.info('Bot started');
}

async function registerSlashCommands(app: App): Promise<void> {
  const { env, config } = app;
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

  // Categories that should be registered as guild-local commands (staff-only, no
  // need for global discovery) — this lets us use both the 100-guild and 100-global
  // slots for a combined ceiling of 200 application commands.
  const GUILD_CATEGORIES = new Set(['moderation', 'admin']);

  const guildBodies: object[] = [];
  const globalBodies: object[] = [];

  for (const cmd of app.commands.values()) {
    if (config.commands[cmd.name]?.slash === false) continue;
    const body = cmd.data.toJSON();
    if (GUILD_CATEGORIES.has(cmd.category)) {
      guildBodies.push(body);
    } else {
      globalBodies.push(body);
    }
  }

  // Custom slash commands go global (user-facing by default)
  for (const [name, cc] of Object.entries(config.custom_commands)) {
    if (!cc.enabled || !cc.slash) continue;
    if (app.commands.has(name) || app.messageCommands.has(name) || app.userCommands.has(name)) continue;
    const builder = new SlashCommandBuilder()
      .setName(name.slice(0, 32))
      .setDescription((cc.description || 'Custom command').slice(0, 100))
      .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(false))
      .addStringOption((o) => o.setName('args').setDescription('Arguments').setRequired(false));
    globalBodies.push(builder.toJSON());
  }

  // Context menu commands are guild-only (they are staff tools)
  for (const cmd of app.messageCommands.values()) {
    if (config.commands[cmd.name]?.slash === false) continue;
    guildBodies.push({ name: cmd.name, type: 3 } as never);
  }
  for (const cmd of app.userCommands.values()) {
    if (config.commands[cmd.name]?.slash === false) continue;
    guildBodies.push({ name: cmd.name, type: 2 } as never);
  }

  // When REGISTER_GUILD_ID is set (development), dump everything to that guild
  // so changes are instant. In production, split across guild + global.
  const devGuildId = env.REGISTER_GUILD_ID;

  try {
    if (devGuildId) {
      const all = [...guildBodies, ...globalBodies];
      await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, devGuildId), { body: all });
      app.logger.info(`Registered ${all.length} commands to dev guild ${devGuildId}`);
    } else {
      const guildId = env.GUILD_ID;
      if (guildBodies.length > 0 && guildId) {
        await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, guildId), { body: guildBodies });
        app.logger.info(`Registered ${guildBodies.length} guild commands (moderation/admin) to guild ${guildId}`);
      }
      if (globalBodies.length > 0) {
        await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: globalBodies });
        app.logger.info(`Registered ${globalBodies.length} global commands (community/utility/info)`);
      }
    }
  } catch (err) {
    app.logger.error('Failed to register slash commands:', err);
  }
}

main().catch((err) => {
  console.error('Fatal boot error:', err);
  process.exit(1);
});
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const index_1 = require("../../shared/src/index");
const BotClient_1 = require("./client/BotClient");
const logger_1 = require("./core/logger");
const logManager_1 = require("./core/logManager");
const cooldown_1 = require("./core/cooldown");
const componentLoader_1 = require("./core/componentLoader");
const commandLoader_1 = require("./core/commandLoader");
const eventLoader_1 = require("./core/eventLoader");
const componentLoader_2 = require("./core/componentLoader");
const errorHandler_1 = require("./core/errorHandler");
const rateLimitReporter_1 = require("./core/rateLimitReporter");
const caseService_1 = require("./moderation/caseService");
const punishmentManager_1 = require("./moderation/punishmentManager");
const punishmentDm_1 = require("./moderation/punishmentDm");
const warningEscalation_1 = require("./moderation/warningEscalation");
const punishmentEscalation_1 = require("./moderation/punishmentEscalation");
const hierarchyGuard_1 = require("./moderation/hierarchyGuard");
const manager_1 = require("./automod/manager");
const riskScoring_1 = require("./automod/riskScoring");
const ruleVersioning_1 = require("./automod/ruleVersioning");
const modules_1 = require("./automod/modules");
const service_1 = require("./scheduler/service");
const metrics_1 = require("./metrics/metrics");
const reportingService_1 = require("./reporting/reportingService");
const channelLocking_1 = require("./management/channelLocking");
const slowmodeScheduler_1 = require("./management/slowmodeScheduler");
const antiRaid_1 = require("./security/antiRaid");
async function main() {
    const logger = new logger_1.Logger('boot');
    let loaded;
    try {
        loaded = (0, index_1.loadConfig)();
    }
    catch (err) {
        console.error((0, index_1.formatConfigError)(err));
        process.exit(1);
    }
    const { config, env, configPath } = loaded;
    logger.info(`Config loaded from ${configPath}`);
    const databaseUrl = (0, index_1.buildDatabaseUrl)(env);
    const db = (0, index_1.createDbPool)(databaseUrl);
    try {
        await (0, index_1.waitForDb)(db, 90_000);
    }
    catch (err) {
        logger.error('Could not connect to database', err);
        process.exit(1);
    }
    logger.info('Database connected');
    try {
        const applied = await (0, index_1.runMigrations)(db, index_1.migrations);
        if (applied.length > 0)
            logger.info(`Applied migrations: ${applied.join(', ')}`);
    }
    catch (err) {
        logger.error('Migration failed', err);
        process.exit(1);
    }
    const logManager = new logManager_1.LogManager(db);
    const cooldowns = new cooldown_1.CooldownManager();
    const components = new componentLoader_1.ComponentRegistry();
    const app = {
        config,
        env,
        db,
        configPath,
        client: null,
        logger,
        logManager,
        cooldowns,
        components,
        commands: new Map(),
        aliases: new Map(),
        messageCommands: new Map(),
        userCommands: new Map(),
        caseService: null,
        punishmentManager: null,
        punishmentDm: null,
        warningEscalation: null,
        punishmentEscalation: null,
        modGuard: null,
        automod: null,
        riskScoring: null,
        ruleVersioning: null,
        scheduler: null,
        metrics: null,
        reporting: null,
        lockingService: null,
        slowmodeScheduler: null,
        antiRaid: null,
        joinRate: new Map(),
        polls: new Map(),
        customCache: new Map(),
        startedAt: Date.now(),
    };
    const client = new BotClient_1.BotClient(app);
    app.client = client;
    logManager.app = app;
    app.caseService = new caseService_1.CaseService(db);
    app.punishmentDm = new punishmentDm_1.PunishmentDmManager(app);
    app.punishmentManager = new punishmentManager_1.PunishmentManager(app);
    app.warningEscalation = new warningEscalation_1.WarningEscalation(app);
    app.punishmentEscalation = new punishmentEscalation_1.PunishmentEscalation(app);
    app.modGuard = new hierarchyGuard_1.ModerationCommandGuard(app);
    app.automod = new manager_1.AutomodManager(app);
    app.riskScoring = new riskScoring_1.RiskScoring(app);
    app.ruleVersioning = new ruleVersioning_1.RuleVersioning(app);
    app.reporting = new reportingService_1.ReportingService(app);
    app.lockingService = new channelLocking_1.LockingService(app);
    app.slowmodeScheduler = new slowmodeScheduler_1.SlowmodeScheduler(app);
    app.antiRaid = new antiRaid_1.AntiRaidService(app);
    app.metrics = new metrics_1.Metrics(app);
    app.scheduler = new service_1.SchedulerService(app);
    (0, modules_1.registerAutomodModules)(app, app.automod);
    (0, errorHandler_1.installGlobalHandlers)(app);
    (0, rateLimitReporter_1.installRateLimitReporter)(app);
    const { commands, aliases, messageCommands, userCommands } = await (0, commandLoader_1.loadCommands)(app);
    app.commands = commands;
    app.aliases = aliases;
    app.messageCommands = messageCommands;
    app.userCommands = userCommands;
    await (0, eventLoader_1.loadEvents)(app);
    await (0, componentLoader_2.loadComponents)(app);
    await registerSlashCommands(app);
    client.once('ready', async () => {
        app.logger.info(`Logged in as ${client.user?.tag}`);
        app.scheduler.start();
        app.client.user?.setPresence({
            status: config.bot.status,
            activities: [
                {
                    name: config.bot.activity.text,
                    type: config.bot.activity.type,
                    url: config.bot.activity.url || undefined,
                },
            ],
        });
    });
    await client.login(env.DISCORD_TOKEN);
    app.logger.info('Bot started');
}
async function registerSlashCommands(app) {
    const { env, config, client } = app;
    const rest = new discord_js_1.REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
    const bodies = [...app.commands.values()]
        .filter((c) => config.commands[c.name]?.slash ?? true)
        .map((c) => c.data.toJSON());
    for (const cmd of app.messageCommands.values()) {
        if (config.commands[cmd.name]?.slash === false)
            continue;
        bodies.push({ name: cmd.name, type: 3 });
    }
    for (const cmd of app.userCommands.values()) {
        if (config.commands[cmd.name]?.slash === false)
            continue;
        bodies.push({ name: cmd.name, type: 2 });
    }
    if (bodies.length === 0)
        return;
    const targetGuildId = env.REGISTER_GUILD_ID;
    const route = targetGuildId
        ? discord_js_1.Routes.applicationGuildCommands(env.CLIENT_ID, targetGuildId)
        : discord_js_1.Routes.applicationCommands(env.CLIENT_ID);
    try {
        await rest.put(route, { body: bodies });
        app.logger.info(`Registered ${bodies.length} commands ${targetGuildId ? `to guild ${targetGuildId}` : 'globally'}`);
    }
    catch (err) {
        app.logger.error('Failed to register slash commands:', err);
    }
}
main().catch((err) => {
    console.error('Fatal boot error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
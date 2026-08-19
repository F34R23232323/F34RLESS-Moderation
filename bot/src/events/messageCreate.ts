import { parseJson } from '../../../shared/src/index';
import type { Message } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import { buildRichV2, v2Reply } from '../utils/v2';
import { suggestClosest } from '../../../shared/src/index';
import { v2MessageReply } from '../utils/v2';

export async function handleMessageCreate(app: App, message: Message): Promise<void> {
  try {
    if (message.content && message.inGuild()) {
      app.messageCache.set(message.id, {
        content: message.content,
        authorId: message.author.id,
        channelId: message.channelId,
        guildId: message.guildId,
        attachmentCount: message.attachments.size,
        createdAt: Date.now(),
      });
    }
    if (message.author.bot) return;
    if (!message.inGuild()) {
      const { handleMessageCreateDM } = await import('../security/modmail');
      await handleMessageCreateDM(app, message);
      return;
    }
    app.metrics.incMessages();
    app.slowmodeScheduler.onMessage(message.channelId);

    await app.messageLogs.capture(message);

    await app.automod.handleMessage(message);

    if (message.inGuild()) {
      await handleAfk(app, message);
      if (app.config.community.levels.enabled) await handleXp(app, message);
    }

    if (message.content) await handlePrefix(app, message);
  } catch (err) {
    app.logger.error('messageCreate handler threw:', err);
  }
}

async function handleAfk(app: App, message: Message): Promise<void> {
  const mentionsUser = message.mentions.users.first();
  if (mentionsUser && mentionsUser.id !== message.author.id) {
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT reason, since FROM afk WHERE user_id = ? AND guild_id = ? AND cleared = 0',
      [mentionsUser.id, message.guildId],
    );
    if (rows.length > 0) {
      const sinceMs = Date.now() - new Date(rows[0].since).getTime();
      await app.db
        .execute(
          'INSERT INTO afk_mentions (guild_id, user_id, mentioner_id, channel_id, message_id) VALUES (?, ?, ?, ?, ?)',
          [message.guildId, mentionsUser.id, message.author.id, message.channelId, message.id],
        )
        .catch(() => undefined);
      const rich = buildRichV2({
        accentColor: 0x5865f2,
        header: 'AFK',
        text: `<@${mentionsUser.id}> is AFK (${Math.round(sinceMs / 60000)}m ago): ${rows[0].reason ?? 'no reason'}`,
        footer: 'Removed automatically when they return',
      });
      await message.reply({ ...rich, allowedMentions: { parse: [], repliedUser: false } } as never).catch(() => undefined);
    }
  }

  if (isAfkCommandMessage(app, message)) return;

  const [myRows] = await app.db.query<RowDataPacket[]>(
    'SELECT autoremove FROM afk WHERE user_id = ? AND guild_id = ? AND cleared = 0 LIMIT 1',
    [message.author.id, message.guildId],
  );
  const myRow = myRows[0];
  if (!myRow) return;
  if (myRow.autoremove === 0) return;

  const [mentions] = await app.db.query<RowDataPacket[]>(
    'SELECT channel_id, message_id, created_at FROM afk_mentions WHERE guild_id = ? AND user_id = ? AND cleared = 0 ORDER BY created_at ASC LIMIT 10',
    [message.guildId, message.author.id],
  );
  await app.db.execute('UPDATE afk SET cleared = 1 WHERE user_id = ? AND guild_id = ? AND cleared = 0', [
    message.author.id,
    message.guildId,
  ]);
  await app.db.execute('DELETE FROM afk_mentions WHERE guild_id = ? AND user_id = ?', [message.guildId, message.author.id]).catch(() => undefined);

  const lines: string[] = ['Your AFK status has been removed.'];
  if (mentions.length > 0) {
    lines.push('', `**You were mentioned ${mentions.length} time${mentions.length === 1 ? '' : 's'} while AFK:**`);
    for (const m of mentions) {
      const when = new Date(m.created_at).getTime() / 1000;
      lines.push(`<t:${Math.floor(when)}:t> https://discord.com/channels/${message.guildId}/${m.channel_id}/${m.message_id}`);
    }
  }
  const rich = buildRichV2({
    accentColor: 0x57f287,
    header: 'AFK Removed',
    text: lines.join('\n'),
  });
  await message.reply({ ...rich, allowedMentions: { parse: [], repliedUser: false } } as never).catch(() => undefined);
}

function isAfkCommandMessage(app: App, message: Message): boolean {
  if (!app.config.bot.prefix_enabled || !message.content) return false;
  const prefixes = app.config.bot.per_guild_prefixes[message.guildId ?? ''] ?? app.config.bot.prefixes;
  const prefix = prefixes.find((p) => message.content.startsWith(p));
  if (!prefix) return false;
  const body = message.content.slice(prefix.length).trim();
  if (!body) return false;
  const [cmdName] = body.split(/\s+/);
  const resolved = resolveCommand(app, cmdName.toLowerCase());
  return resolved === 'afk';
}

async function handleXp(app: App, message: Message): Promise<void> {
  const cfg = app.config.community.levels;
  const cooldownKey = `xp:${message.author.id}`;
  if (!app.cooldowns.tryConsume('xp', message.author.id, message.guildId ?? '', cfg.xp_cooldown_seconds)) return;

  await app.db.execute(
    `INSERT INTO levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE xp = xp + ?`,
    [message.guildId, message.author.id, cfg.message_xp, cfg.message_xp],
  );

  const [rows] = await app.db.query<RowDataPacket[]>(
    'SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?',
    [message.guildId, message.author.id],
  );
  const row = rows[0];
  if (!row) return;
  const newLevel = Math.floor(row.xp / 100);
  if (newLevel > row.level) {
    await app.db.execute('UPDATE levels SET level = ? WHERE guild_id = ? AND user_id = ?', [newLevel, message.guildId, message.author.id]);
    const role = cfg.level_up_roles.find((r) => r.level === newLevel);
    if (role) {
      const member = await message.guild?.members.fetch(message.author.id).catch(() => null);
      if (member) await member.roles.add(role.role_id, `Level ${newLevel}`).catch(() => undefined);
    }
  }
}

async function handlePrefix(app: App, message: Message): Promise<void> {
  if (!app.config.bot.prefix_enabled) return;
  const prefixes = app.config.bot.per_guild_prefixes[message.guildId ?? ''] ?? app.config.bot.prefixes;
  const prefix = prefixes.find((p) => message.content.startsWith(p));
  if (!prefix) return;

  const body = message.content.slice(prefix.length).trim();
  if (!body) return;
  const [cmdName, ...args] = body.split(/\s+/);
  const lowerName = cmdName.toLowerCase();

  if (message.guildId) {
    const configCustom = app.config.custom_commands[lowerName] ?? app.config.custom_commands[cmdName];
    const configAlias = app.customCommandAliases?.get(lowerName);
    const resolvedCustom = configCustom ? lowerName : configAlias ?? undefined;
    if (resolvedCustom && app.config.custom_commands[resolvedCustom]?.enabled) {
      await app.customCommands.runPrefix(app, message, resolvedCustom, args);
      return;
    }
  }

  const builtin = resolveCommand(app, cmdName.toLowerCase());
  if (builtin) {
    await runCommand(app, message, builtin, args);
    return;
  }

  if (message.guildId) {
    const custom = await resolveCustomCommand(app, message.guildId, cmdName.toLowerCase());
    if (custom) {
      if (app.cooldowns.tryConsume('cmd', message.author.id, `custom:${custom.commandName}`, 3)) {
        await (message.channel as any).send({ content: custom.response.content }).catch(() => undefined);
      }
      return;
    }
  }

  await handleUnknown(app, message, cmdName);
}

async function resolveCustomCommand(
  app: App,
  guildId: string,
  name: string,
): Promise<{ commandName: string; response: { content: string } } | null> {
  const cache = app.customCache.get(guildId);
  if (!cache || Date.now() - cache.loadedAt > 30_000) {
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT name, aliases, response FROM custom_commands WHERE guild_id = ? AND enabled = 1',
      [guildId],
    );
    const commands = new Map<string, { response: { content: string }; aliases: string[] }>();
    for (const row of rows) {
      let aliases: string[] = [];
      if (row.aliases) {
        try {
          aliases = parseJson(row.aliases, []);
        } catch {
          aliases = [];
        }
      }
      commands.set(String(row.name), { response: parseJson(row.response, { content: '' }), aliases });
    }
    app.customCache.set(guildId, { loadedAt: Date.now(), commands });
    return resolveCustomCommand(app, guildId, name);
  }
  const direct = cache.commands.get(name);
  if (direct) return { commandName: name, response: direct.response };
  for (const [cmdName, cmd] of cache.commands) {
    if (cmd.aliases.includes(name)) return { commandName: cmdName, response: cmd.response };
  }
  return null;
}

async function runCommand(app: App, message: Message, commandName: string, args: string[]): Promise<void> {
  const cmd = app.commands.get(commandName);
  if (!cmd) return;
  const cfg = app.config.commands[cmd.name];
  if (cfg && cfg.prefix === false) return;

  const member = message.member;
  if (!member) return;
  const guard = app.modGuard.hasRequiredPermissions(member, cmd);
  if (!guard.ok) {
    await v2MessageReply(message, { content: `You cannot use that command: ${guard.reason}` }).catch(() => undefined);
    return;
  }
  if (cmd.ownerOnly && !app.modGuard.isOwner(message.author.id)) return;

  const cooldown = cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds;
  if (!app.cooldowns.tryConsume('cmd', message.author.id, cmd.name, cooldown)) {
    const remaining = app.cooldowns.remainingSeconds('cmd', message.author.id, cmd.name);
    await v2MessageReply(message, { content: `Slow down! Try again in ${remaining}s.` }).catch(() => undefined);
    return;
  }

  const start = Date.now();
  try {
    if (cmd.prefixExecute) {
      await cmd.prefixExecute(message, args, app);
    } else {
      await v2MessageReply(message, { content: 'This command is slash-only.' }).catch(() => undefined);
    }
    app.metrics.incCommand(true);
  } catch (err) {
    app.metrics.incCommand(false);
    app.logger.error(`Prefix command ${cmd.name} failed:`, err);
    await app.logManager.reportError(`Prefix command ${cmd.name}`, err);
  } finally {
    await app.logManager.logCommandUsage({
      guildId: message.guildId,
      command: cmd.name,
      userId: message.author.id,
      surface: 'prefix',
      success: true,
      durationMs: Date.now() - start,
    });
  }
}

function resolveCommand(app: App, name: string): string | undefined {
  if (app.commands.has(name)) return name;
  return app.aliases.get(name);
}

async function handleUnknown(app: App, message: Message, cmdName: string): Promise<void> {
  const cfg = app.config.fuzzy;
  if (!cfg.enabled) return;
  const key = `fuzzy:${message.author.id}`;
  if (!app.cooldowns.tryConsume('fuzzy', message.author.id, 'suggest', cfg.cooldown_seconds)) return;

  const candidates = [...app.commands.keys(), ...app.aliases.keys()];
  const suggestion = suggestClosest(cmdName, candidates, cfg.max_distance);
  if (suggestion) {
    const resolved = resolveCommand(app, suggestion.candidate);
    const realName = resolved ?? suggestion.candidate;
    await v2MessageReply(message, { content: `Did you mean \`${prefixChar(app, message)}${realName}\`?` }).catch(() => undefined);
  }
}

function prefixChar(app: App, message: Message): string {
  return app.config.bot.per_guild_prefixes[message.guildId ?? '']?.[0] ?? app.config.bot.prefixes[0];
}

export default { name: 'messageCreate', run: handleMessageCreate };
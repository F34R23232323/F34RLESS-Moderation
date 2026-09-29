import {
  SlashCommandBuilder,
  ApplicationCommandOptionType,
  ContainerBuilder,
  SeparatorBuilder,
  TextDisplayBuilder,
  MessageFlags,
} from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply, v2MessageReply, hexToInt } from '../../utils/v2';
import { emojiPrefix } from '../../emoji';
import { slashPathForCommand } from '../../core/slashCommandGroups';
import { paginateV2, chunkItems } from '../../utils/paginate';

const MAX_USAGE_LINES = 10;
const COMMANDS_PER_PAGE = 15;
const ACCENT = '5865f2';
const ACCENT_INT = 0x5865f2;

function prefixOf(app: App, trigger?: ListTrigger): string {
  if (trigger && 'content' in trigger && trigger.content) {
    for (const p of app.config.bot.prefixes) {
      if (trigger.content.startsWith(p)) return p;
    }
  }
  return app.config.bot.prefixes[0] ?? '!';
}


function deriveUsage(app: App, cmd: BotCommand): string[] {
  const prefix = prefixOf(app);
  const opts: any[] = Array.isArray(cmd.data?.options) ? cmd.data.options : [];
  const token = (o: any): string => (o?.required ? `<${o.name}>` : `[${o.name}]`);
  const subOptions = (o: any): any[] => (Array.isArray(o?.options) ? o.options : []);

  const hasSubcommands = opts.some((o) => o?.type === ApplicationCommandOptionType.Subcommand || o?.type === ApplicationCommandOptionType.SubcommandGroup);
  if (!hasSubcommands) {
    return [[prefix + cmd.name, ...opts.map(token)].join(' ')];
  }

  const lines: string[] = [];
  for (const opt of opts) {
    if (opt?.type === ApplicationCommandOptionType.Subcommand) {
      lines.push([prefix + cmd.name, opt.name, ...subOptions(opt).map(token)].join(' '));
    } else if (opt?.type === ApplicationCommandOptionType.SubcommandGroup) {
      for (const sub of subOptions(opt)) {
        lines.push([prefix + cmd.name, opt.name, sub.name, ...subOptions(sub).map(token)].join(' '));
      }
    }
  }
  if (lines.length === 0) lines.push(prefix + cmd.name);
  return lines;
}

function usageLines(app: App, cmd: BotCommand): string[] {
  if (cmd.usage) return Array.isArray(cmd.usage) ? cmd.usage : [cmd.usage];
  return deriveUsage(app, cmd);
}

function commandDetails(app: App, cmd: BotCommand): string {
  const cfg = app.config.commands[cmd.name];
  const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
  const prefix = prefixOf(app);
  const usage = usageLines(app, cmd);
  const shownUsage = usage.length > MAX_USAGE_LINES ? usage.slice(0, MAX_USAGE_LINES) : usage;
  const truncated = usage.length - shownUsage.length;

  const configPerms = cfg?.permissions ?? [];
  const effectivePerms = (configPerms.length ? configPerms : cmd.permissions ?? []) as string[];
  const overridden = configPerms.length > 0 && (cmd.permissions ?? []).length > 0;

  const lines: string[] = [];
  lines.push(`**${cmd.name}** — ${cmd.description}`);
  if (cmd.details) lines.push(cmd.details);
  lines.push('');

  if (shownUsage.length === 1) {
    lines.push(`Usage: \`${shownUsage[0]}\``);
  } else {
    lines.push('Usage:');
    for (const u of shownUsage) lines.push(`\`${u}\``);
    if (truncated > 0) lines.push(`…and ${truncated} more`);
  }

  lines.push(`Category: ${cmd.category}`);
  lines.push(`Permissions: ${effectivePerms.length > 0 ? effectivePerms.join(', ') + (overridden ? ' (config override)' : '') : 'none (everyone)'}`);
  if (cfg?.allowed_roles?.length) lines.push(`Allowed roles: ${cfg.allowed_roles.map((r) => `<@&${r}>`).join(', ')}`);
  if (cfg?.permission_group) lines.push(`Staff group: ${cfg.permission_group}`);
  const access = [cmd.ownerOnly ? 'bot owner only' : null, cmd.guildOnly ? 'server only' : null].filter(Boolean);
  if (access.length > 0) lines.push(`Access: ${access.join(', ')}`);
  lines.push(`Aliases: ${aliases.length > 0 ? aliases.map((a) => `\`${a}\``).join(', ') : 'none'}`);

  const slashEnabled = cfg?.slash ?? true;
  const prefixEnabled = (cfg?.prefix ?? true) && typeof cmd.prefixExecute === 'function';
  lines.push(`Slash: \`${slashPathForCommand(cmd.name)}\` — ${slashEnabled ? 'enabled' : 'disabled'}`);
  lines.push(`Prefix: \`${prefix}${cmd.name}\` — ${prefixEnabled ? 'enabled' : 'disabled'}`);
  lines.push(`Cooldown: ${cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds}s`);
  return lines.join('\n');
}

/**
 * Build the Sapphire-style overview as a Components V2 payload.
 *
 * Layout (matches image 5):
 *   ContainerBuilder (blurple accent)
 *     TextDisplayBuilder — "**Overview**"
 *     SeparatorBuilder
 *     TextDisplayBuilder — blockquoted help shortcuts
 *     SeparatorBuilder
 *     TextDisplayBuilder — blockquoted config/permissions shortcuts
 */
function buildOverviewPayload(app: App, trigger?: ListTrigger): { components: unknown[]; flags: number } {
  const p = prefixOf(app, trigger);
  const container = new ContainerBuilder().setAccentColor(ACCENT_INT as never);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('**Overview**'),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `> \`${p}help <command>\` - Shows information about a command`,
        `> \`${p}help list\` - Lists all commands`,
        `> \`${p}help <category>\` - Shows commands in a category`,
      ].join('\n'),
    ),
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      [
        `> \`${p}settings\` - Configures the bot`,
        `> \`${p}permissions\` - Configures permissions`,
      ].join('\n'),
    ),
  );

  return { components: [container] as unknown[], flags: MessageFlags.IsComponentsV2 };
}

async function sendOverview(
  trigger: ChatInputCommandInteraction | Message,
  app: App,
  ephemeral = false,
): Promise<void> {
  const payload = buildOverviewPayload(app, trigger);
  const noPing = { parse: [] as string[] };

  if ('user' in trigger) {
    const intr = trigger as ChatInputCommandInteraction;
    const flags = ephemeral
      ? MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      : MessageFlags.IsComponentsV2;
    const body: any = { components: payload.components, flags, allowedMentions: noPing };
    if (intr.replied || intr.deferred) {
      await intr.editReply(body);
    } else {
      await intr.reply(body);
    }
  } else {
    await (trigger as Message).reply({
      components: payload.components as any,
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: noPing,
    } as any);
  }
}

function enabledCommands(app: App, category?: string | null): BotCommand[] {
  const out: BotCommand[] = [];
  for (const cmd of app.commands.values()) {
    if (category && cmd.category !== category) continue;
    const enabled = app.config.commands[cmd.name]?.enabled ?? true;
    if (!enabled) continue;
    out.push(cmd);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Paginated command list — one blockquoted code line per command. */
function commandPages(app: App, category?: string | null, prefix?: string): string[] {
  const p = prefix ?? prefixOf(app);
  const items = enabledCommands(app, category).map((cmd) => `> \`${p}${cmd.name}\``);
  return chunkItems(items, COMMANDS_PER_PAGE).map((chunk) => chunk.join('\n'));
}

function categoriesOf(app: App): string[] {
  return [...new Set([...app.commands.values()].map((c) => c.category))].sort();
}

type ListTrigger = ChatInputCommandInteraction | Message;

function triggerAuthorId(trigger: ListTrigger): string {
  return 'user' in trigger ? trigger.user.id : trigger.author.id;
}

async function sendList(trigger: ListTrigger, app: App, category?: string | null): Promise<void> {
  const p = prefixOf(app, trigger);
  const pages = commandPages(app, category, p);
  // Title shown in the first text block of the container (Sapphire blue diamond emoji + bold title + usage hint).
  const title = `🔷 **Available${category ? ` ${category}` : ''} commands**\n> Use \`${p}help <command>\` to get more information`;

  if (pages.length === 0) {
    const empty = `No enabled commands${category ? ` in \`${category}\`` : ''}. Categories: ${categoriesOf(app).map((c) => `\`${c}\``).join(', ')}`;
    if ('user' in trigger) await v2Reply(trigger, empty, { ephemeral: true });
    else await v2MessageReply(trigger, { content: empty });
    return;
  }

  await paginateV2({
    trigger,
    authorId: triggerAuthorId(trigger),
    title,
    pages,
    accentColor: ACCENT,
  });
}


const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show an overview, list commands, or view details for one command')
  .addStringOption((o) => o.setName('category').setDescription('Filter by category').setRequired(false))
  .addStringOption((o) => o.setName('command').setDescription('Show details for one command').setRequired(false))
  .addBooleanOption((o) => o.setName('list').setDescription('List all commands').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const category = interaction.options.getString('category');
  const commandName = interaction.options.getString('command');
  const listAll = interaction.options.getBoolean('list');

  if (commandName) {
    const key = commandName.toLowerCase();
    const cmd = app.commands.get(key) ?? app.commands.get(app.aliases.get(key) ?? '');
    if (!cmd) {
      await v2Reply(interaction, `Unknown command: ${commandName}`, { ephemeral: true });
      return;
    }
    await v2Reply(interaction, commandDetails(app, cmd), { ephemeral: true });
    return;
  }

  if (listAll || category) {
    await sendList(interaction, app, category);
    return;
  }

  await sendOverview(interaction, app, true);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const prefix = prefixOf(app);
  const arg = args[0];

  // Bare `!commands` (the alias) shows the list; bare `!help` shows the overview.
  if (!arg) {
    const invoked = (message.content ?? '').trim().split(/\s+/)[0]?.slice(prefix.length).toLowerCase();
    if (invoked === 'commands') {
      await sendList(message, app);
      return;
    }
    await sendOverview(message, app, false);
    return;
  }

  if (arg === 'list') {
    await sendList(message, app, args[1]);
    return;
  }

  const key = arg.toLowerCase();
  const cmd = app.commands.get(key) ?? app.commands.get(app.aliases.get(key) ?? '');
  if (cmd) {
    await v2MessageReply(message, { content: commandDetails(app, cmd) });
    return;
  }

  if (categoriesOf(app).includes(key)) {
    await sendList(message, app, key);
    return;
  }

  await v2MessageReply(message, {
    content: `Unknown command: ${arg}\nUse \`${prefix}help list\` to see every command.`,
  });
}

const command: BotCommand = {
  name: 'help',
  category: 'info',
  description: 'Show an overview, list commands, or view details for one command',
  usage: ['!help', '!help <command>', '!help list [category]'],
  details: 'Pass a command name or alias for its usage and permissions, `list` (optionally followed by a category) to browse commands, or nothing for the overview.',
  data,
  aliases: ['h', 'commands'],
  execute,
  prefixExecute,
};

export default command;

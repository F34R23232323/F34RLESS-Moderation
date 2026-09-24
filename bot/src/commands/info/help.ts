import { SlashCommandBuilder, ApplicationCommandOptionType } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { emojiPrefix } from '../../emoji';
import { slashPathForCommand } from '../../core/slashCommandGroups';

const MAX_USAGE_LINES = 10;

function prefixOf(app: App): string {
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

function commandList(app: App, category?: string | null): string {
  const byCategory = new Map<string, string[]>();
  for (const cmd of app.commands.values()) {
    const cat = category && cmd.category !== category ? null : cmd.category;
    if (cat === null) continue;
    const cfg = app.config.commands[cmd.name];
    const enabled = cfg?.enabled ?? true;
    if (!enabled) continue;
    const list = byCategory.get(cat) ?? [];
    const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
    list.push(`\`${slashPathForCommand(cmd.name)}\`${aliases.length > 0 ? ` (${aliases.map((a) => `\`${a}\``).join(', ')})` : ''}`);
    byCategory.set(cat, list);
  }

  const lines = [`**${emojiPrefix('vyxia_info')}Commands**`, ''];
  for (const [cat, list] of byCategory) {
    lines.push(`__${cat}__`);
    lines.push(list.join('  '));
    lines.push('');
  }
  lines.push(`Use \`${prefixOf(app)}help <command>\` or \`/help command:<name>\` for details on a specific command.`);
  return lines.join('\n');
}

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('List available commands with aliases and status')
  .addStringOption((o) => o.setName('category').setDescription('Filter by category').setRequired(false))
  .addStringOption((o) => o.setName('command').setDescription('Show details for one command').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const category = interaction.options.getString('category');
  const commandName = interaction.options.getString('command');

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

  await v2Reply(interaction, commandList(app, category), { ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const commandName = args[0];
  if (!commandName) {
    await v2MessageReply(message, { content: commandList(app, null) });
    return;
  }
  const key = commandName.toLowerCase();
  const cmd = app.commands.get(key) ?? app.commands.get(app.aliases.get(key) ?? '');
  if (!cmd) {
    await v2MessageReply(message, { content: `Unknown command: ${commandName}` });
    return;
  }
  await v2MessageReply(message, { content: commandDetails(app, cmd) });
}

const command: BotCommand = {
  name: 'help',
  category: 'info',
  description: 'List available commands with aliases and status',
  usage: ['!help', '!help <command>'],
  details: 'Pass a command name or alias to see its usage, category, required permissions, and other details.',
  data,
  aliases: ['h', 'commands'],
  execute,
  prefixExecute,
};

export default command;

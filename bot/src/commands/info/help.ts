import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import { emojiPrefix } from '../../emoji';
import { slashPathForCommand } from '../../core/slashCommandGroups';

function commandDetails(app: App, cmd: BotCommand): string {
  const cfg = app.config.commands[cmd.name];
  const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
  return [
    `**${cmd.name}** — ${cmd.description}`,
    `Category: ${cmd.category}`,
    `Slash path: \`${slashPathForCommand(cmd.name)}\``,
    `Slash: ${cfg?.slash ?? true ? 'enabled' : 'disabled'} | Prefix: ${cfg?.prefix ?? true ? 'enabled' : 'disabled'}`,
    `Cooldown: ${cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds}s`,
    aliases.length > 0 ? `Aliases: ${aliases.map((a) => `\`${a}\``).join(', ')}` : 'Aliases: none',
  ].join('\n');
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
  lines.push(`Use \`/help command:<name>\` for details on a specific command.`);
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
    const cmd = app.commands.get(commandName);
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
  const cmd = app.commands.get(commandName) ?? app.commands.get(app.aliases.get(commandName.toLowerCase()) ?? '');
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
  data,
  aliases: ['h', 'commands'],
  execute,
  prefixExecute,
};

export default command;

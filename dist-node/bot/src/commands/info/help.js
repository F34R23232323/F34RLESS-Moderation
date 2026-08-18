"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const v2_1 = require("../../utils/v2");
const data = new discord_js_1.SlashCommandBuilder()
    .setName('help')
    .setDescription('List available commands with aliases and status')
    .addStringOption((o) => o.setName('category').setDescription('Filter by category').setRequired(false))
    .addStringOption((o) => o.setName('command').setDescription('Show details for one command').setRequired(false));
async function execute(interaction, app) {
    const category = interaction.options.getString('category');
    const commandName = interaction.options.getString('command');
    if (commandName) {
        const cmd = app.commands.get(commandName);
        if (!cmd) {
            await (0, v2_1.v2Reply)(interaction, `Unknown command: ${commandName}`, { ephemeral: true });
            return;
        }
        const cfg = app.config.commands[cmd.name];
        const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
        const lines = [
            `**${cmd.name}** — ${cmd.description}`,
            `Category: ${cmd.category}`,
            `Slash: ${cfg?.slash ?? true ? 'enabled' : 'disabled'} | Prefix: ${cfg?.prefix ?? true ? 'enabled' : 'disabled'}`,
            `Cooldown: ${cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds}s`,
            aliases.length > 0 ? `Aliases: ${aliases.map((a) => `\`${a}\``).join(', ')}` : 'Aliases: none',
        ];
        await (0, v2_1.v2Reply)(interaction, lines.join('\n'), { ephemeral: true });
        return;
    }
    const byCategory = new Map();
    for (const cmd of app.commands.values()) {
        const cat = category && cmd.category !== category ? null : cmd.category;
        if (cat === null)
            continue;
        const cfg = app.config.commands[cmd.name];
        const enabled = cfg?.enabled ?? true;
        if (!enabled)
            continue;
        const list = byCategory.get(cat) ?? [];
        const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
        list.push(`\`${cmd.name}\`${aliases.length > 0 ? ` (${aliases.map((a) => `\`${a}\``).join(', ')})` : ''}`);
        byCategory.set(cat, list);
    }
    const lines = ['**Commands**', ''];
    for (const [cat, list] of byCategory) {
        lines.push(`__${cat}__`);
        lines.push(list.join('  '));
        lines.push('');
    }
    lines.push(`Use \`/help command:<name>\` for details on a specific command.`);
    await (0, v2_1.v2Reply)(interaction, lines.join('\n'), { ephemeral: true });
}
async function prefixExecute(message, args, app) {
    const commandName = args[0];
    if (!commandName) {
        await message.reply({ content: 'Run `/help` for the command list.' });
        return;
    }
    const cmd = app.commands.get(commandName) ?? app.commands.get(app.aliases.get(commandName.toLowerCase()) ?? '');
    if (!cmd) {
        await message.reply({ content: `Unknown command: ${commandName}` });
        return;
    }
    const cfg = app.config.commands[cmd.name];
    const aliases = [...(cmd.aliases ?? []), ...(cfg?.aliases ?? [])];
    await message.reply({
        content: [
            `**${cmd.name}** — ${cmd.description}`,
            `Category: ${cmd.category}`,
            `Cooldown: ${cfg?.cooldown_seconds ?? app.config.command_defaults.cooldown_seconds}s`,
            aliases.length > 0 ? `Aliases: ${aliases.map((a) => `\`${a}\``).join(', ')}` : 'Aliases: none',
        ].join('\n'),
    });
}
const command = {
    name: 'help',
    category: 'info',
    description: 'List available commands with aliases and status',
    data,
    aliases: ['h', 'commands'],
    execute,
    prefixExecute,
};
exports.default = command;
//# sourceMappingURL=help.js.map
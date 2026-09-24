import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('prefix')
  .setDescription('View or set the guild prefix (owner only)')
  .addStringOption((o) => o.setName('prefix').setDescription('New prefix').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  if (!app.modGuard.isOwner(interaction.user.id)) {
    await v2Reply(interaction, 'Owner only.', { ephemeral: true });
    return;
  }
  const newPrefix = interaction.options.getString('prefix');
  if (newPrefix) {
    await app.db.execute(
      `INSERT INTO custom_config (guild_id, key_name, value) VALUES (?, 'prefix', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [guild.id, JSON.stringify({ prefixes: [newPrefix] })],
    );
    await v2Reply(interaction, `Prefix set to \`${newPrefix}\`.`);
    return;
  }
  const override = app.config.bot.per_guild_prefixes[guild.id] ?? null;
  await v2Reply(interaction, `Prefixes: ${(override ?? app.config.bot.prefixes).map((p) => `\`${p}\``).join(', ')}`);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  if (!app.modGuard.isOwner(message.author.id)) {
    await v2MessageReply(message, { content: 'Owner only.' });
    return;
  }
  const newPrefix = args[0];
  if (newPrefix) {
    await app.db.execute(
      `INSERT INTO custom_config (guild_id, key_name, value) VALUES (?, 'prefix', ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [guild.id, JSON.stringify({ prefixes: [newPrefix] })],
    );
    await v2MessageReply(message, { content: `Prefix set to \`${newPrefix}\`.` });
    return;
  }
  const override = app.config.bot.per_guild_prefixes[guild.id] ?? null;
  await v2MessageReply(message, { content: `Prefixes: ${(override ?? app.config.bot.prefixes).map((p) => `\`${p}\``).join(', ')}` });
}

const command: BotCommand = {
  name: 'prefix',
  category: 'admin',
  description: 'View or set the guild prefix (owner only)',
  data,
  permissions: ['ManageGuild'],
  aliases: [],
  execute,
  prefixExecute,
};

export default command;
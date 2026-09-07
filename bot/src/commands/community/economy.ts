import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('economyenable')
  .setDescription('Enable the economy system for this server');

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  // This command should be prefix-only, not slash
  await v2Reply(interaction, 'This command is only available as a prefix command.');
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!message.guild) return;
  const member = message.member;
  if (!member?.permissions.has('Administrator')) {
    await v2MessageReply(message, { content: 'You need Administrator permission to enable economy.' });
    return;
  }

  const action = args[0]?.toLowerCase();
  if (action === 'enable') {
    // Check if already seeded
    const existing = await app.economy.items.getShops(message.guild.id);
    if (existing.length === 0) {
      await app.economy.seedDefaults(message.guild.id);
    }
    // Update config
    await app.db.execute(
      `INSERT INTO economy_config (guild_id, enabled, settings)
       VALUES (?, 1, '{}')
       ON DUPLICATE KEY UPDATE enabled = 1`,
      [message.guild.id],
    );
    await v2MessageReply(message, { content: '**Economy enabled!** Default shops, items, jobs, and quests have been seeded. Use `economy disable` to turn it off.' });
  } else if (action === 'disable') {
    await app.db.execute(
      'UPDATE economy_config SET enabled = 0 WHERE guild_id = ?',
      [message.guild.id],
    );
    await v2MessageReply(message, { content: '**Economy disabled.** User data is preserved.' });
  } else if (action === 'status') {
    const [rows] = await app.db.query('SELECT enabled FROM economy_config WHERE guild_id = ?', [message.guild.id]);
    const enabled = (rows as any[])[0]?.enabled ?? false;
    await v2MessageReply(message, { content: `Economy is **${enabled ? 'enabled' : 'disabled'}** in this server.` });
  } else {
    await v2MessageReply(message, { content: 'Usage: `economy enable|disable|status`' });
  }
}

const command: BotCommand = {
  name: 'economy',
  category: 'community',
  description: 'Manage economy settings',
  data,
  aliases: ['economyenable'],
  execute,
  prefixExecute,
};

export default command;

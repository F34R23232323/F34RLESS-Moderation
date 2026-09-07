import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';

const data = new SlashCommandBuilder()
  .setName('economyprofile')
  .setDescription('View economy profile')
  .addUserOption((o) => o.setName('user').setDescription('View another user\'s profile').setRequired(false));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }
  const target = interaction.options.getUser('user') ?? interaction.user;
  const profile = await app.economy.getProfile(interaction.guildId!, target.id);
  const total = profile.wallet + profile.bank;
  const effects = await app.economy.items.getActiveEffects(interaction.guildId!, target.id);
  const lines = [
    `**${target.username}'s Economy Profile**`,
    `**Balance:** ${app.economy.formatCurrency(total)} (Wallet: ${app.economy.formatCurrency(profile.wallet)}, Bank: ${app.economy.formatCurrency(profile.bank)})`,
    `**Level:** ${profile.level} (${profile.xp} XP)`,
    `**Prestige:** ${profile.prestige}`,
    `**Job:** ${profile.job_id ?? 'Unemployed'} (Level ${profile.job_level})`,
    `**Daily Streak:** ${profile.daily_streak} days`,
    `**Weekly Streak:** ${profile.weekly_streak} weeks`,
    `**Total Earned:** ${app.economy.formatCurrency(profile.total_earned)}`,
    `**Total Spent:** ${app.economy.formatCurrency(profile.total_spent)}`,
    effects.length > 0 ? `**Active Effects:** ${effects.length}` : '',
  ].filter(Boolean).join('\n');
  await v2Reply(interaction, lines);
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const targetId = args[0]?.replace(/[<@!>]/g, '') || message.author.id;
  const target = await app.client.users.fetch(targetId).catch(() => null);
  if (!target) { await v2MessageReply(message, { content: 'User not found.' }); return; }
  const profile = await app.economy.getProfile(message.guildId!, target.id);
  const total = profile.wallet + profile.bank;
  const lines = [
    `**${target.username}'s Economy Profile**`,
    `**Balance:** ${app.economy.formatCurrency(total)} (Wallet: ${app.economy.formatCurrency(profile.wallet)}, Bank: ${app.economy.formatCurrency(profile.bank)})`,
    `**Level:** ${profile.level} (${profile.xp} XP) | **Prestige:** ${profile.prestige}`,
    `**Job:** ${profile.job_id ?? 'Unemployed'} (Level ${profile.job_level})`,
    `**Streaks:** Daily ${profile.daily_streak} | Weekly ${profile.weekly_streak}`,
    `**Lifetime:** Earned ${app.economy.formatCurrency(profile.total_earned)} | Spent ${app.economy.formatCurrency(profile.total_spent)}`,
  ].join('\n');
  await v2MessageReply(message, { content: lines });
}

const command: BotCommand = {
  name: 'economyprofile',
  category: 'community',
  description: 'View economy profile',
  data,
  aliases: ['eprofile', 'econprofile'],
  execute,
  prefixExecute,
};

export default command;

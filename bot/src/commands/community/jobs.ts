import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('jobs')
  .setDescription('View available jobs')
  .addSubcommand((sub) => sub.setName('list').setDescription('List all jobs'))
  .addSubcommand((sub) => sub.setName('info').setDescription('View job details')
    .addStringOption((o) => o.setName('job').setDescription('Job slug').setRequired(true).setAutocomplete(true)))
  .addSubcommand((sub) => sub.setName('apply').setDescription('Apply for a job')
    .addStringOption((o) => o.setName('job').setDescription('Job slug').setRequired(true).setAutocomplete(true)))
  .addSubcommand((sub) => sub.setName('resign').setDescription('Resign from your current job'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('View your job stats'));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'list') {
    const jobs = await app.economy.rewards.getJobs(guildId);
    if (jobs.length === 0) { await v2Reply(interaction, 'No jobs available.'); return; }
    const profile = await app.economy.getProfile(guildId, userId);
    const lines = jobs.map((j) => {
      const locked = j.required_level > profile.level;
      return `${j.emoji ?? ''} **${j.name}** (${j.job_slug})${locked ? ` 🔒 Lv.${j.required_level}` : ''}\n  Payout: ${app.economy.formatCurrency(j.min_payout)}-${app.economy.formatCurrency(j.max_payout)} | XP: ${j.xp_reward} | Cooldown: ${j.cooldown_seconds}s`;
    });
    await v2Reply(interaction, `**Available Jobs**\n\n${lines.join('\n\n')}`);
  } else if (sub === 'info') {
    const slug = interaction.options.getString('job', true);
    const job = await app.economy.rewards.getJob(guildId, slug);
    if (!job) { await v2Reply(interaction, `Job "${slug}" not found.`); return; }
    await v2Reply(interaction, [
      `**${job.emoji ?? ''} ${job.name}**`,
      job.description ?? '',
      `Payout: ${app.economy.formatCurrency(job.min_payout)}-${app.economy.formatCurrency(job.max_payout)}`,
      `XP: ${job.xp_reward} | Cooldown: ${job.cooldown_seconds}s`,
      `Required Level: ${job.required_level}`,
      job.max_employees ? `Max employees: ${job.max_employees}` : '',
    ].filter(Boolean).join('\n'));
  } else if (sub === 'apply') {
    const slug = interaction.options.getString('job', true);
    const job = await app.economy.rewards.getJob(guildId, slug);
    if (!job) { await v2Reply(interaction, `Job "${slug}" not found.`); return; }
    const profile = await app.economy.getProfile(guildId, userId);
    if (job.required_level > profile.level) { await v2Reply(interaction, `Requires level ${job.required_level}.`); return; }
    await app.db.execute('UPDATE economy_profiles SET job_id = ?, job_level = 1 WHERE guild_id = ? AND user_id = ?', [slug, guildId, userId]);
    await v2Reply(interaction, `You are now employed as a **${job.name}**! Use \`/work\` to earn.`);
  } else if (sub === 'resign') {
    await app.db.execute('UPDATE economy_profiles SET job_id = NULL WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    await v2Reply(interaction, 'You resigned from your job.');
  } else if (sub === 'stats') {
    const profile = await app.economy.getProfile(guildId, userId);
    const job = profile.job_id ? await app.economy.rewards.getJob(guildId, profile.job_id) : null;
    await v2Reply(interaction, [
      `**Job Stats**`,
      `Job: ${job ? `${job.emoji ?? ''} ${job.name}` : 'Unemployed'}`,
      `Job Level: ${profile.job_level}`,
      `Job XP: ${profile.job_xp}`,
      `Total Earned: ${app.economy.formatCurrency(profile.total_earned)}`,
      profile.last_work_at ? `Last Work: <t:${Math.floor(new Date(profile.last_work_at).getTime() / 1000)}:R>` : '',
    ].filter(Boolean).join('\n'));
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const sub = args[0]?.toLowerCase() ?? 'list';
  if (sub === 'list' || sub === 'ls') {
    const jobs = await app.economy.rewards.getJobs(message.guildId!);
    if (jobs.length === 0) { await v2MessageReply(message, { content: 'No jobs available.' }); return; }
    const lines = jobs.map((j) => `${j.emoji ?? ''} **${j.name}** (${j.job_slug}) — ${app.economy.formatCurrency(j.min_payout)}-${app.economy.formatCurrency(j.max_payout)}`);
    await v2MessageReply(message, { content: `**Jobs**\n${lines.join('\n')}` });
  } else if (sub === 'apply' && args[1]) {
    const job = await app.economy.rewards.getJob(message.guildId!, args[1]);
    if (!job) { await v2MessageReply(message, { content: 'Job not found.' }); return; }
    const profile = await app.economy.getProfile(message.guildId!, message.author.id);
    if (job.required_level > profile.level) { await v2MessageReply(message, { content: `Requires level ${job.required_level}.` }); return; }
    await app.db.execute('UPDATE economy_profiles SET job_id = ?, job_level = 1 WHERE guild_id = ? AND user_id = ?', [args[1], message.guildId!, message.author.id]);
    await v2MessageReply(message, { content: `Employed as **${job.name}**!` });
  } else if (sub === 'resign') {
    await app.db.execute('UPDATE economy_profiles SET job_id = NULL WHERE guild_id = ? AND user_id = ?', [message.guildId!, message.author.id]);
    await v2MessageReply(message, { content: 'Resigned.' });
  } else {
    await v2MessageReply(message, { content: 'Usage: `jobs list`, `jobs apply <slug>`, `jobs resign`, `jobs stats`' });
  }
}

const command: BotCommand = {
  name: 'jobs',
  category: 'community',
  description: 'View and manage jobs',
  data,
  aliases: ['job'],
  execute,
  prefixExecute,
};

export default command;

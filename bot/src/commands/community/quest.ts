import { SlashCommandBuilder } from 'discord.js';
import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2Reply } from '../../utils/v2';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

const data = new SlashCommandBuilder()
  .setName('quest')
  .setDescription('View and manage quests')
  .addSubcommand((sub) => sub.setName('list').setDescription('List available quests'))
  .addSubcommand((sub) => sub.setName('progress').setDescription('View your quest progress'))
  .addSubcommand((sub) => sub.setName('claim').setDescription('Claim a completed quest reward')
    .addStringOption((o) => o.setName('quest').setDescription('Quest slug to claim').setRequired(true).setAutocomplete(true)));

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.deferReply();
  if (!app.economy.isEnabled(interaction.guildId!)) { await v2Reply(interaction, 'Economy is not enabled.'); return; }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;

  if (sub === 'list') {
    const [quests] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_templates WHERE guild_id = ? AND enabled = 1 ORDER BY quest_type, name',
      [guildId],
    );
    if (quests.length === 0) { await v2Reply(interaction, 'No quests available.'); return; }
    const lines = quests.map((q: any) => `${q.emoji ?? ''} **${q.name}** (${q.quest_type}) — ${q.description ?? 'No description'}\nReward: ${app.economy.formatCurrency(q.reward_currency)} + ${q.reward_xp} XP`);
    await v2Reply(interaction, `**Available Quests**\n\n${lines.join('\n\n')}`);
  } else if (sub === 'progress') {
    const [progress] = await app.db.query<RowDataPacket[]>(
      `SELECT eqp.*, eqt.name, eqt.description, eqt.quest_type, eqt.reward_currency, eqt.reward_xp
       FROM economy_quest_progress eqp
       JOIN economy_quest_templates eqt ON eqp.quest_id = eqt.id
       WHERE eqp.guild_id = ? AND eqp.user_id = ? AND eqp.claimed = 0
       ORDER BY eqp.created_at DESC LIMIT 10`,
      [guildId, userId],
    );
    if (progress.length === 0) { await v2Reply(interaction, 'No active quests. Use `/quest list` to see available quests.'); return; }
    const lines = progress.map((p: any) => {
      const status = p.completed ? '**COMPLETED** (use `/quest claim quest:' + p.quest_slug + '`)' : 'In progress';
      return `${p.name} (${p.quest_type}) — ${status}\nProgress: ${JSON.stringify(p.progress)}`;
    });
    await v2Reply(interaction, `**Your Quest Progress**\n\n${lines.join('\n\n')}`);
  } else if (sub === 'claim') {
    const questSlug = interaction.options.getString('quest', true);
    const [questRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_templates WHERE guild_id = ? AND quest_slug = ? AND enabled = 1',
      [guildId, questSlug],
    );
    if (questRows.length === 0) { await v2Reply(interaction, `Quest "${questSlug}" not found.`); return; }
    const quest = questRows[0] as any;

    const [progRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_progress WHERE guild_id = ? AND user_id = ? AND quest_id = ? AND completed = 1 AND claimed = 0',
      [guildId, userId, quest.id],
    );
    if (progRows.length === 0) { await v2Reply(interaction, 'Quest not completed or already claimed.'); return; }
    const prog = progRows[0] as any;

    // Atomic claim — prevents double-claim via race condition
    const [claimResult] = await app.db.execute(
      'UPDATE economy_quest_progress SET claimed = 1, claimed_at = NOW() WHERE id = ? AND completed = 1 AND claimed = 0',
      [prog.id],
    );
    if ((claimResult as any).affectedRows === 0) {
      await v2Reply(interaction, 'Quest already claimed or no longer claimable.');
      return;
    }

    // Award rewards only after successful claim lock
    await app.economy.ledger.credit(guildId, userId, userId, quest.reward_currency, 'quest_reward', {
      reason: `Quest reward: ${quest.name}`,
      refType: 'quest', refId: String(quest.id),
    });
    await app.db.execute('UPDATE economy_profiles SET xp = xp + ? WHERE guild_id = ? AND user_id = ?', [quest.reward_xp, guildId, userId]);

    await v2Reply(interaction, `**Quest Complete!** ${quest.name}\nReward: ${app.economy.formatCurrency(quest.reward_currency)} + ${quest.reward_xp} XP`);
  }
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!app.economy.isEnabled(message.guildId!)) { await v2MessageReply(message, { content: 'Economy is not enabled.' }); return; }
  const sub = args[0]?.toLowerCase() ?? 'list';
  const guildId = message.guildId!;
  const userId = message.author.id;

  if (sub === 'list' || sub === 'ls') {
    const [quests] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_templates WHERE guild_id = ? AND enabled = 1 ORDER BY quest_type, name',
      [guildId],
    );
    if (quests.length === 0) { await v2MessageReply(message, { content: 'No quests available.' }); return; }
    const lines = quests.map((q: any) => `${q.emoji ?? ''} **${q.name}** (${q.quest_type}) — ${q.description ?? ''}\nReward: ${app.economy.formatCurrency(q.reward_currency)} + ${q.reward_xp} XP`);
    await v2MessageReply(message, { content: `**Available Quests**\n${lines.join('\n\n')}` });
  } else if (sub === 'progress' || sub === 'prog') {
    const [progress] = await app.db.query<RowDataPacket[]>(
      `SELECT eqp.*, eqt.name, eqt.quest_type, eqt.reward_currency
       FROM economy_quest_progress eqp
       JOIN economy_quest_templates eqt ON eqp.quest_id = eqt.id
       WHERE eqp.guild_id = ? AND eqp.user_id = ? AND eqp.claimed = 0`,
      [guildId, userId],
    );
    if (progress.length === 0) { await v2MessageReply(message, { content: 'No active quests.' }); return; }
    const lines = progress.map((p: any) => `${p.name} — ${p.completed ? 'Claimable' : 'In progress'}`);
    await v2MessageReply(message, { content: `**Your Quests**\n${lines.join('\n')}` });
  } else if (sub === 'claim') {
    const questSlug = args[1];
    if (!questSlug) { await v2MessageReply(message, { content: 'Usage: `quest claim <slug>`' }); return; }
    const [questRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_templates WHERE guild_id = ? AND quest_slug = ? AND enabled = 1',
      [guildId, questSlug],
    );
    if (questRows.length === 0) { await v2MessageReply(message, { content: `Quest "${questSlug}" not found.` }); return; }
    const quest = questRows[0] as any;
    const [progRows] = await app.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_quest_progress WHERE guild_id = ? AND user_id = ? AND quest_id = ? AND completed = 1 AND claimed = 0',
      [guildId, userId, quest.id],
    );
    if (progRows.length === 0) { await v2MessageReply(message, { content: 'Quest not completed or already claimed.' }); return; }
    const prog = progRows[0] as any;
    const [claimResult] = await app.db.execute('UPDATE economy_quest_progress SET claimed = 1, claimed_at = NOW() WHERE id = ? AND completed = 1 AND claimed = 0', [prog.id]);
    if ((claimResult as any).affectedRows === 0) { await v2MessageReply(message, { content: 'Quest already claimed.' }); return; }
    await app.economy.ledger.credit(guildId, userId, userId, quest.reward_currency, 'quest_reward', { reason: `Quest: ${quest.name}`, refType: 'quest', refId: String(quest.id) });
    await app.db.execute('UPDATE economy_profiles SET xp = xp + ? WHERE guild_id = ? AND user_id = ?', [quest.reward_xp, guildId, userId]);
    await v2MessageReply(message, { content: `**Quest Complete!** ${quest.name}\nReward: ${app.economy.formatCurrency(quest.reward_currency)} + ${quest.reward_xp} XP` });
  } else {
    await v2MessageReply(message, { content: 'Usage: `quest list|progress|claim <slug>`' });
  }
}

const command: BotCommand = {
  name: 'quest',
  category: 'community',
  description: 'View and manage quests',
  data,
  aliases: ['quests'],
  execute,
  prefixExecute,
};

export default command;

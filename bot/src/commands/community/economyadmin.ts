import type { ChatInputCommandInteraction, Message } from 'discord.js';
import type { App } from '../../core/context';
import type { BotCommand } from '../../types/command';
import { v2MessageReply } from '../../utils/v2';
import type { RowDataPacket } from 'mysql2/promise';

// This command has no slash version — prefix-only
const data = {
  name: 'economyadmin',
  description: 'Economy administration commands (prefix-only)',
  toJSON: () => ({ name: 'economyadmin', description: 'Economy admin', options: [] }),
};

async function execute(interaction: ChatInputCommandInteraction, app: App): Promise<void> {
  await interaction.reply({ content: 'This command is prefix-only.', ephemeral: true });
}

async function prefixExecute(message: Message, args: string[], app: App): Promise<void> {
  if (!message.guild) return;
  const member = message.member;
  if (!member?.permissions.has('Administrator')) {
    await v2MessageReply(message, { content: 'Administrator permission required.' });
    return;
  }

  const sub = args[0]?.toLowerCase();
  const guildId = message.guild.id;

  switch (sub) {
    case 'grant': {
      // economyadmin grant <user> <amount> [reason]
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      const amount = parseInt(args[2] ?? '0');
      const reason = args.slice(3).join(' ') || 'Admin grant';
      if (!targetId || !amount || amount <= 0) {
        await v2MessageReply(message, { content: 'Usage: `economyadmin grant <user> <amount> [reason]`' });
        return;
      }
      const idempKey = `admin_grant:${guildId}:${targetId}:${amount}:${Date.now()}`;
      await app.economy.ledger.credit(guildId, message.author.id, targetId, amount, 'admin_grant', {
        reason, idempotencyKey: idempKey,
      });
      await app.db.execute(
        'INSERT INTO economy_admin_adjustments (guild_id, admin_id, target_user_id, adjustment_type, amount, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, message.author.id, targetId, 'grant', amount, reason],
      );
      await v2MessageReply(message, { content: `Granted **${app.economy.formatCurrency(amount)}** to <@${targetId}>. Reason: ${reason}` });
      break;
    }

    case 'remove': {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      const amount = parseInt(args[2] ?? '0');
      const reason = args.slice(3).join(' ') || 'Admin removal';
      if (!targetId || !amount || amount <= 0) {
        await v2MessageReply(message, { content: 'Usage: `economyadmin remove <user> <amount> [reason]`' });
        return;
      }
      const { success } = await app.economy.ledger.debit(guildId, message.author.id, targetId, amount, 'admin_remove', { reason });
      if (!success) { await v2MessageReply(message, { content: 'Insufficient balance.' }); return; }
      await app.db.execute(
        'INSERT INTO economy_admin_adjustments (guild_id, admin_id, target_user_id, adjustment_type, amount, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, message.author.id, targetId, 'remove', amount, reason],
      );
      await v2MessageReply(message, { content: `Removed **${app.economy.formatCurrency(amount)}** from <@${targetId}>.` });
      break;
    }

    case 'set': {
      // economyadmin set <user> <wallet|bank> <amount>
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      const field = args[2]?.toLowerCase();
      const amount = parseInt(args[3] ?? '0');
      if (!targetId || !field || !['wallet', 'bank'].includes(field)) {
        await v2MessageReply(message, { content: 'Usage: `economyadmin set <user> <wallet|bank> <amount>`' });
        return;
      }
      if (isNaN(amount) || amount < 0) {
        await v2MessageReply(message, { content: 'Amount must be a non-negative integer.' });
        return;
      }
      // Directly set the balance — no double-modify through ledger
      await app.db.execute(`UPDATE economy_profiles SET ${field} = ? WHERE guild_id = ? AND user_id = ?`, [amount, guildId, targetId]);
      await app.db.execute(
        'INSERT INTO economy_admin_adjustments (guild_id, admin_id, target_user_id, adjustment_type, amount, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [guildId, message.author.id, targetId, `set_${field}`, amount, `Set ${field} to ${amount}`],
      );
      await v2MessageReply(message, { content: `Set <@${targetId}>'s ${field} to **${app.economy.formatCurrency(amount)}**.` });
      break;
    }

    case 'ban': {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      const reason = args.slice(2).join(' ') || 'Admin ban';
      if (!targetId) { await v2MessageReply(message, { content: 'Usage: `economyadmin ban <user> [reason]`' }); return; }
      await app.db.execute(
        `INSERT INTO economy_bans (guild_id, user_id, reason, banned_by) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by)`,
        [guildId, targetId, reason, message.author.id],
      );
      await app.db.execute('UPDATE economy_profiles SET status = ? WHERE guild_id = ? AND user_id = ?', ['banned', guildId, targetId]);
      await v2MessageReply(message, { content: `<@${targetId}> economy-banned. Reason: ${reason}` });
      break;
    }

    case 'unban': {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId) { await v2MessageReply(message, { content: 'Usage: `economyadmin unban <user>`' }); return; }
      await app.db.execute('DELETE FROM economy_bans WHERE guild_id = ? AND user_id = ?', [guildId, targetId]);
      await app.db.execute('UPDATE economy_profiles SET status = ? WHERE guild_id = ? AND user_id = ?', ['active', guildId, targetId]);
      await v2MessageReply(message, { content: `<@${targetId}> economy-unbanned.` });
      break;
    }

    case 'reset': {
      const targetId = args[1]?.replace(/[<@!>]/g, '');
      if (!targetId) { await v2MessageReply(message, { content: 'Usage: `economyadmin reset <user>`' }); return; }
      const reason = `Reset by ${message.author.username}`;
      await app.db.execute('DELETE FROM economy_profiles WHERE guild_id = ? AND user_id = ?', [guildId, targetId]);
      await app.db.execute('DELETE FROM economy_inventories WHERE guild_id = ? AND user_id = ?', [guildId, targetId]);
      await app.db.execute('DELETE FROM economy_cooldowns WHERE guild_id = ? AND user_id = ?', [guildId, targetId]);
      await app.db.execute('DELETE FROM economy_item_effects WHERE guild_id = ? AND user_id = ?', [guildId, targetId]);
      await app.db.execute(
        'INSERT INTO economy_admin_adjustments (guild_id, admin_id, target_user_id, adjustment_type, reason) VALUES (?, ?, ?, ?, ?)',
        [guildId, message.author.id, targetId, 'full_reset', reason],
      );
      await v2MessageReply(message, { content: `<@${targetId}>'s economy data has been reset.` });
      break;
    }

    case 'ledger': {
      // economyadmin ledger [user] [type]
      const userId = args[1]?.replace(/[<@!>]/g, '');
      const txType = args[2];
      let sql = 'SELECT * FROM economy_ledger WHERE guild_id = ?';
      const params: unknown[] = [guildId];
      if (userId) { sql += ' AND (target_id = ? OR actor_id = ?)'; params.push(userId, userId); }
      if (txType) { sql += ' AND tx_type = ?'; params.push(txType); }
      sql += ' ORDER BY created_at DESC LIMIT 10';
      const [rows] = await app.db.query<RowDataPacket[]>(sql, params);
      if (rows.length === 0) { await v2MessageReply(message, { content: 'No entries found.' }); return; }
      const lines = rows.map((r: any) => `\`${r.tx_id.slice(0, 8)}\` ${r.tx_type} ${r.direction} ${app.economy.formatCurrency(r.amount)} — <@${r.target_id}> — ${new Date(r.created_at).toLocaleDateString()}`);
      await v2MessageReply(message, { content: `**Recent Ledger Entries**\n${lines.join('\n')}` });
      break;
    }

    case 'info': {
      const targetId = args[1]?.replace(/[<@!>]/g, '') || message.author.id;
      const profile = await app.economy.getProfile(guildId, targetId);
      const total = profile.wallet + profile.bank;
      const [banRows] = await app.db.query<RowDataPacket[]>(
        'SELECT * FROM economy_bans WHERE guild_id = ? AND user_id = ?',
        [guildId, targetId],
      );
      const banned = banRows.length > 0;
      await v2MessageReply(message, {
        content: [
          `**Economy Info for <@${targetId}>**`,
          `Wallet: ${app.economy.formatCurrency(profile.wallet)} | Bank: ${app.economy.formatCurrency(profile.bank)} | Total: ${app.economy.formatCurrency(total)}`,
          `Level: ${profile.level} (${profile.xp} XP) | Prestige: ${profile.prestige}`,
          `Job: ${profile.job_id ?? 'None'} (Lv.${profile.job_level}) | Status: ${profile.status}`,
          `Streaks: Daily ${profile.daily_streak} | Weekly ${profile.weekly_streak}`,
          `Earned: ${app.economy.formatCurrency(profile.total_earned)} | Spent: ${app.economy.formatCurrency(profile.total_spent)}`,
          banned ? `**ECONOMY BANNED**` : '',
        ].filter(Boolean).join('\n'),
      });
      break;
    }

    default:
      await v2MessageReply(message, {
        content: [
          '**Economy Admin Commands**',
          '`economyadmin grant <user> <amount> [reason]` — Add funds',
          '`economyadmin remove <user> <amount> [reason]` — Remove funds',
          '`economyadmin set <user> <wallet|bank> <amount>` — Set balance',
          '`economyadmin ban <user> [reason]` — Economy ban',
          '`economyadmin unban <user>` — Economy unban',
          '`economyadmin reset <user>` — Reset economy data',
          '`economyadmin info [user]` — View economy details',
          '`economyadmin ledger [user] [type]` — View recent transactions',
        ].join('\n'),
      });
  }
}

const command: BotCommand = {
  name: 'economyadmin',
  category: 'community',
  description: 'Economy administration (prefix-only)',
  data: data as any,
  aliases: ['ecoadmin', 'ea'],
  guildOnly: true,
  ownerOnly: false,
  execute,
  prefixExecute,
};

export default command;

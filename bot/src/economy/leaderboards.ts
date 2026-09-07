import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  value: number;
}

export class LeaderboardService {
  private static readonly VALID_CATEGORIES = new Set([
    'wallet', 'bank', 'net_worth', 'total_earned', 'total_spent',
    'level', 'daily_streak', 'weekly_streak', 'prestige',
  ]);

  private static readonly VALUE_EXPRS: Record<string, string> = {
    wallet: 'wallet',
    bank: 'bank',
    net_worth: 'wallet + bank',
    total_earned: 'total_earned',
    total_spent: 'total_spent',
    level: 'level * 10000 + xp',
    daily_streak: 'daily_streak',
    weekly_streak: 'weekly_streak',
    prestige: 'prestige * 10000 + level',
  };

  private static readonly ORDER_BY: Record<string, string> = {
    wallet: 'wallet DESC',
    bank: 'bank DESC',
    net_worth: '(wallet + bank) DESC',
    total_earned: 'total_earned DESC',
    total_spent: 'total_spent DESC',
    level: 'level DESC, xp DESC',
    daily_streak: 'daily_streak DESC',
    weekly_streak: 'weekly_streak DESC',
    prestige: 'prestige DESC, level DESC',
  };

  private validateCategory(category: string): string {
    return LeaderboardService.VALID_CATEGORIES.has(category) ? category : 'net_worth';
  }

  constructor(private readonly app: App) {}

  private get db(): Pool { return this.app.db; }

  async getLeaderboard(
    guildId: string,
    category: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<LeaderboardEntry[]> {
    const limit = Math.min(opts.limit ?? 10, 50);
    const offset = opts.offset ?? 0;
    const safeCategory = this.validateCategory(category);
    const valueExpr = LeaderboardService.VALUE_EXPRS[safeCategory];
    const orderBy = LeaderboardService.ORDER_BY[safeCategory];

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT user_id, (${valueExpr}) as value
       FROM economy_profiles
       WHERE guild_id = ? AND opted_out = 0 AND status = 'active'
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`,
      [guildId, limit, offset],
    );

    return rows.map((r: any, i) => ({
      rank: offset + i + 1,
      user_id: r.user_id,
      value: Number(r.value),
    }));
  }

  async getUserRank(
    guildId: string,
    userId: string,
    category: string,
  ): Promise<{ rank: number; value: number } | null> {
    const safeCategory = this.validateCategory(category);
    const valueExpr = LeaderboardService.VALUE_EXPRS[safeCategory];

    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT rank_num, value FROM (
        SELECT user_id,
          (${valueExpr}) as value,
          RANK() OVER (ORDER BY (${valueExpr}) DESC) as rank_num
        FROM economy_profiles
        WHERE guild_id = ? AND opted_out = 0 AND status = 'active'
      ) ranked
      WHERE user_id = ?`,
      [guildId, userId],
    );

    if (rows.length === 0) return null;
    return { rank: (rows[0] as any).rank_num, value: Number((rows[0] as any).value) };
  }

  /** Get the top N users for a category. */
  async getTop(guildId: string, category: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    return this.getLeaderboard(guildId, category, { limit: Math.min(limit, 50) });
  }
}

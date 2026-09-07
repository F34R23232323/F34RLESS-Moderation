import type { App } from '../core/context';
import { LedgerEngine } from './ledger';
import { ItemShopService } from './items';
import { RewardsService } from './rewards';
import { TradingService } from './trading';
import { MarketplaceService } from './marketplace';
import { StealingService } from './stealing';
import { LeaderboardService } from './leaderboards';
import type { EconomyProfile } from './types';

export class EconomyService {
  public readonly ledger: LedgerEngine;
  public readonly items: ItemShopService;
  public readonly rewards: RewardsService;
  public readonly trading: TradingService;
  public readonly marketplace: MarketplaceService;
  public readonly stealing: StealingService;
  public readonly leaderboards: LeaderboardService;

  constructor(private readonly app: App) {
    this.ledger = new LedgerEngine(app);
    this.items = new ItemShopService(app, this.ledger);
    this.rewards = new RewardsService(app, this.ledger);
    this.trading = new TradingService(app, this.ledger, this.items);
    this.marketplace = new MarketplaceService(app, this.ledger, this.items);
    this.stealing = new StealingService(app, this.ledger);
    this.leaderboards = new LeaderboardService(app);
  }

  /** Check if economy is enabled for a guild. */
  isEnabled(guildId: string): boolean {
    if (!this.app.config.economy.enabled) return false;
    // Per-guild override check could be added via economy_config table
    return true;
  }

  /** Get or create a user profile. */
  async getProfile(guildId: string, userId: string): Promise<EconomyProfile> {
    return this.ledger.getProfile(guildId, userId);
  }

  /** Format a currency amount for display. */
  formatCurrency(amount: number): string {
    const ec = this.app.config.economy.currency;
    const formatted = amount.toLocaleString('en-US');
    return ec.symbol_placement === 'before' ? `${ec.symbol}${formatted}` : `${formatted}${ec.symbol}`;
  }

  /** Parse a human-friendly amount string (1k, 2.5m, all, half, 50%). */
  parseAmount(input: string, available: number): number | null {
    const s = input.trim().toLowerCase();
    if (s === 'all') return available;
    if (s === 'half') return Math.floor(available / 2);
    if (s.endsWith('%')) {
      const pct = parseFloat(s.slice(0, -1));
      if (isNaN(pct) || pct < 0 || pct > 100) return null;
      return Math.floor((available * pct) / 100);
    }

    const multipliers: Record<string, number> = { k: 1_000, m: 1_000_000, b: 1_000_000_000 };
    const match = /^([\d,.]+)\s*([kmb]?)$/i.exec(s);
    if (!match) return null;

    const num = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(num) || num < 0) return null;
    const mult = multipliers[match[2].toLowerCase()] ?? 1;
    return Math.floor(num * mult);
  }

  /** Seed default shops and items for a guild that just enabled economy. */
  async seedDefaults(guildId: string): Promise<void> {
    const existing = await this.items.getShops(guildId);
    if (existing.length > 0) return; // Already seeded

    // ── General Store ─────────────────────────────────────────────────────
    const generalStore = await this.items.createShop(guildId, {
      slug: 'general-store', name: 'General Store',
      description: 'Affordable everyday items for your adventures.',
      emoji: '\uD83C\uDFEA',
    });

    const consumables = [
      { slug: 'health_potion', name: 'Health Potion', emoji: '\u2764\uFE0F', type: 'consumable' as const, buy: 50, sell: 25, desc: 'Restores a bit of health. Consumable.' },
      { slug: 'energy_drink', name: 'Energy Drink', emoji: '\u26A1', type: 'consumable' as const, buy: 75, sell: 30, desc: 'Boosts energy. Consumable.' },
      { slug: 'lucky_charm', name: 'Lucky Charm', emoji: '\uD83C\uDF40', type: 'consumable' as const, buy: 100, sell: 50, desc: 'A small charm that brings luck. Consumable.' },
      { slug: 'treasure_map', name: 'Treasure Map', emoji: '\uD83D\uDDFA\uFE0F', type: 'consumable' as const, buy: 200, sell: 100, desc: 'Reveals a hidden treasure location. Consumable.' },
      { slug: 'mystery_box', name: 'Mystery Box', emoji: '\uD83C\uDF81', type: 'consumable' as const, buy: 150, sell: 75, desc: 'Contains a random reward. Consumable.' },
    ];

    for (const c of consumables) {
      const item = await this.items.createItem(guildId, {
        item_slug: c.slug, name: c.name, emoji: c.emoji, category_slug: 'consumables',
        rarity: 'common', item_type: c.type, buy_price: c.buy, sell_price: c.sell,
        description: c.desc, stock: 100,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [generalStore.id, item.id],
      );
    }

    // ── Tools ─────────────────────────────────────────────────────────────
    const tools = [
      { slug: 'fishing_rod', name: 'Fishing Rod', emoji: '\uD83C\uDFA3', buy: 300, sell: 150, desc: 'Required for fishing activities.' },
      { slug: 'pickaxe', name: 'Pickaxe', emoji: '\u26CF\uFE0F', buy: 300, sell: 150, desc: 'Required for mining activities.' },
      { slug: 'lockpick', name: 'Lockpick', emoji: '\uD83D\uDD11', buy: 500, sell: 250, desc: 'Slightly improves steal success chance.' },
      { slug: 'wallet_lock', name: 'Wallet Lock', emoji: '\uD83D\uDD12', buy: 750, sell: 375, desc: 'Protects your wallet from theft.' },
      { slug: 'shield', name: 'Shield', emoji: '\uD83D\uDEE1\uFE0F', buy: 1000, sell: 500, desc: 'Provides temporary theft protection.' },
    ];

    for (const t of tools) {
      const item = await this.items.createItem(guildId, {
        item_slug: t.slug, name: t.name, emoji: t.emoji, category_slug: 'tools',
        rarity: 'uncommon', item_type: 'tool', buy_price: t.buy, sell_price: t.sell,
        description: t.desc, stock: 50,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [generalStore.id, item.id],
      );
    }

    // ── Boost Shop ────────────────────────────────────────────────────────
    const boostShop = await this.items.createShop(guildId, {
      slug: 'boost-shop', name: 'Boost Shop',
      description: 'Temporary earning boosts and cooldown reductions.',
      emoji: '\uD83D\uDE80',
    });

    const boosts = [
      { slug: 'xp_booster_1h', name: 'XP Booster (1h)', emoji: '\u2B50', buy: 500, sell: 0, desc: '2x XP for 1 hour.', type: 'permanent' as const },
      { slug: 'coin_booster_1h', name: 'Coin Booster (1h)', emoji: '\uD83D\uDCB0', buy: 500, sell: 0, desc: '2x coin earnings for 1 hour.', type: 'permanent' as const },
      { slug: 'cooldown_reducer', name: 'Cooldown Reducer', emoji: '\u23F1\uFE0F', buy: 300, sell: 0, desc: 'Reduces work cooldown by 50%. Consumable.', type: 'consumable' as const },
      { slug: 'streak_shield', name: 'Streak Shield', emoji: '\uD83D\uDEE1\uFE0F', buy: 400, sell: 0, desc: 'Protects your daily streak for 1 missed day.', type: 'consumable' as const },
      { slug: 'double_daily', name: 'Double Daily', emoji: '\uD83D\uDD04', buy: 600, sell: 0, desc: 'Doubles your next daily reward. Consumable.', type: 'consumable' as const },
    ];

    for (const b of boosts) {
      const item = await this.items.createItem(guildId, {
        item_slug: b.slug, name: b.name, emoji: b.emoji, category_slug: 'boosts',
        rarity: 'rare', item_type: b.type, buy_price: b.buy, sell_price: b.sell,
        description: b.desc, stock: 25,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [boostShop.id, item.id],
      );
    }

    // ── Profile & Cosmetics ───────────────────────────────────────────────
    const cosmeticShop = await this.items.createShop(guildId, {
      slug: 'cosmetics', name: 'Profile & Cosmetics',
      description: 'Titles, badges, and profile themes.',
      emoji: '\uD83C\uDFA8',
    });

    const cosmetics = [
      { slug: 'title_veteran', name: 'Title: Veteran', emoji: '\uD83C\uDFC6', buy: 2000, sell: 0, desc: 'A cosmetic title for your profile.' },
      { slug: 'title_legend', name: 'Title: Legend', emoji: '\u2B50', buy: 5000, sell: 0, desc: 'A legendary title for your profile.' },
      { slug: 'badge_fire', name: 'Badge: Fire', emoji: '\uD83D\uDD25', buy: 1000, sell: 0, desc: 'A fiery badge for your profile.' },
      { slug: 'badge_diamond', name: 'Badge: Diamond', emoji: '\uD83D\uDC8E', buy: 3000, sell: 0, desc: 'A sparkling badge.' },
      { slug: 'profile_frame_gold', name: 'Gold Profile Frame', emoji: '\uD83D\uDCE6', buy: 4000, sell: 0, desc: 'A golden frame around your profile card.' },
    ];

    for (const c of cosmetics) {
      const item = await this.items.createItem(guildId, {
        item_slug: c.slug, name: c.name, emoji: c.emoji, category_slug: 'cosmetics',
        rarity: 'epic', item_type: 'cosmetic', buy_price: c.buy, sell_price: c.sell,
        description: c.desc, tradable: 0, sellable: 0, giftable: 0,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [cosmeticShop.id, item.id],
      );
    }

    // ── Default Jobs ──────────────────────────────────────────────────────
    const jobs = [
      { slug: 'miner', name: 'Miner', emoji: '\u26CF\uFE0F', desc: 'Dig deep for coins!', minPay: 75, maxPay: 250, xp: 15, cd: 300 },
      { slug: 'fisher', name: 'Fisher', emoji: '\uD83C\uDFA3', desc: 'Cast your line and reel in profit.', minPay: 50, maxPay: 200, xp: 10, cd: 300 },
      { slug: 'farmer', name: 'Farmer', emoji: '\uD83C\uDF3E', desc: 'Plant and harvest for coin.', minPay: 60, maxPay: 180, xp: 12, cd: 300 },
      { slug: 'merchant', name: 'Merchant', emoji: '\uD83D\uDCBC', desc: 'Buy low, sell high.', minPay: 100, maxPay: 350, xp: 20, cd: 600, reqLevel: 5 },
      { slug: 'adventurer', name: 'Adventurer', emoji: '\u2694\uFE0F', desc: 'Brave dungeons for treasure.', minPay: 150, maxPay: 500, xp: 30, cd: 900, reqLevel: 10 },
    ];

    for (const j of jobs) {
      await this.dbExecute(
        `INSERT INTO economy_jobs (guild_id, job_slug, name, description, emoji, min_payout, max_payout, xp_reward, cooldown_seconds, required_level, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [guildId, j.slug, j.name, j.desc, j.emoji, j.minPay, j.maxPay, j.xp, j.cd, j.reqLevel ?? 0],
      );
    }

    // ── Default Quests ────────────────────────────────────────────────────
    const quests = [
      { slug: 'daily_digger', name: 'Daily Digger', desc: 'Use the work command 3 times.', type: 'daily', req: '{"type":"work_count","value":3}', reward: 200, xp: 50 },
      { slug: 'shopper', name: 'Shopper', desc: 'Buy 2 items from any shop.', type: 'daily', req: '{"type":"purchase_count","value":2}', reward: 150, xp: 30 },
      { slug: 'collector', name: 'Collector', desc: 'Own 5 different items.', type: 'weekly', req: '{"type":"unique_items","value":5}', reward: 500, xp: 100 },
    ];

    for (const q of quests) {
      await this.dbExecute(
        `INSERT INTO economy_quest_templates (guild_id, quest_slug, name, description, quest_type, requirements, reward_currency, reward_xp, enabled, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'system_default')`,
        [guildId, q.slug, q.name, q.desc, q.type, q.req, q.reward, q.xp],
      );
    }

    // ── Default Achievements ──────────────────────────────────────────────
    const achievements = [
      { slug: 'first_steps', name: 'First Steps', desc: 'Earn your first coins.', reqType: 'total_earned', reqVal: 1, pts: 10 },
      { slug: 'penny_pincher', name: 'Penny Pincher', desc: 'Save 10,000 coins in your wallet.', reqType: 'wallet', reqVal: 10000, pts: 50 },
      { slug: 'high_roller', name: 'High Roller', desc: 'Accumulate 100,000 total earned.', reqType: 'total_earned', reqVal: 100000, pts: 100 },
      { slug: 'daily_devotee', name: 'Daily Devotee', desc: 'Reach a 7-day daily streak.', reqType: 'daily_streak', reqVal: 7, pts: 75 },
      { slug: 'level_10', name: 'Rising Star', desc: 'Reach economy level 10.', reqType: 'level', reqVal: 10, pts: 150 },
      { slug: 'workaholic', name: 'Workaholic', desc: 'Earn 10,000 from working.', reqType: 'total_earned', reqVal: 10000, pts: 30 },
      { slug: 'shopaholic', name: 'Shopaholic', desc: 'Buy 20 items.', reqType: 'total_spent', reqVal: 10000, pts: 40 },
      { slug: 'millionaire', name: 'Millionaire', desc: 'Earn 1,000,000 total coins.', reqType: 'total_earned', reqVal: 1000000, pts: 500, hidden: true },
    ];

    for (const a of achievements) {
      await this.dbExecute(
        `INSERT INTO economy_achievements (guild_id, achievement_slug, name, description, requirement_type, requirement_value, points, hidden, enabled, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'system_default')`,
        [guildId, a.slug, a.name, a.desc, a.reqType, a.reqVal, a.pts, (a as any).hidden ? 1 : 0],
      );
    }

    // ── Crafting Supplies Shop ────────────────────────────────────────────
    const craftingShop = await this.items.createShop(guildId, {
      slug: 'crafting-supplies', name: 'Crafting Supplies',
      description: 'Materials for crafting recipes.',
      emoji: '\uD83E\uDDF1',
    });

    const materials = [
      { slug: 'iron_ore', name: 'Iron Ore', emoji: '\u26CF\uFE0F', buy: 50, sell: 25, desc: 'Raw iron ore. Used in crafting.' },
      { slug: 'gold_ore', name: 'Gold Ore', emoji: '\uD83D\uDC8E', buy: 150, sell: 75, desc: 'Precious gold ore.' },
      { slug: 'wood', name: 'Wood', emoji: '\uD83E\uDEB5', buy: 30, sell: 15, desc: 'Basic building material.' },
      { slug: 'leather', name: 'Leather', emoji: '\uD83E\uDDF6', buy: 60, sell: 30, desc: 'Tanned animal hide.' },
      { slug: 'cloth', name: 'Cloth', emoji: '\uD83E\uDDF5', buy: 40, sell: 20, desc: 'Woven fabric.' },
      { slug: 'gemstone', name: 'Gemstone', emoji: '\uD83D\uDC8E', buy: 300, sell: 150, desc: 'A rare gemstone.' },
      { slug: 'essence', name: 'Essence', emoji: '\u2728', buy: 200, sell: 100, desc: 'Magical essence for enchanting.' },
      { slug: 'dragon_scale', name: 'Dragon Scale', emoji: '\uD83D\uDC09', buy: 500, sell: 250, desc: 'A scale from a mighty dragon.' },
      { slug: 'moonstone', name: 'Moonstone', emoji: '\uD83C\uDF19', buy: 250, sell: 125, desc: 'A stone that glows under moonlight.' },
      { slug: 'shadow_dust', name: 'Shadow Dust', emoji: '\uD83C\uDF11', buy: 175, sell: 80, desc: 'Dust gathered from the shadows.' },
    ];

    for (const m of materials) {
      const item = await this.items.createItem(guildId, {
        item_slug: m.slug, name: m.name, emoji: m.emoji, category_slug: 'crafting',
        rarity: 'common', item_type: 'material', buy_price: m.buy, sell_price: m.sell,
        description: m.desc, stock: 200,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [craftingShop.id, item.id],
      );
    }

    // ── Collectables Shop ────────────────────────────────────────────────
    const collectShop = await this.items.createShop(guildId, {
      slug: 'collectables', name: 'Collectables Shop',
      description: 'Rare collectible items for your collection.',
      emoji: '\uD83C\uDFC6',
    });

    const collectables = [
      { slug: 'rare_card_01', name: 'Mystic Card', emoji: '\uD83C\uDCCF', buy: 1500, sell: 750, desc: 'A rare mystic trading card.', rarity: 'rare' as const },
      { slug: 'rare_card_02', name: 'Dragon Card', emoji: '\uD83C\uDCCF', buy: 2000, sell: 1000, desc: 'A legendary dragon card.', rarity: 'epic' as const },
      { slug: 'rare_card_03', name: 'Phoenix Card', emoji: '\uD83C\uDCCF', buy: 2500, sell: 1250, desc: 'A phoenix rising card.', rarity: 'epic' as const },
      { slug: 'crystal_shard', name: 'Crystal Shard', emoji: '\uD83D\uDC8E', buy: 800, sell: 400, desc: 'A fragment of pure crystal.', rarity: 'rare' as const },
      { slug: 'ancient_coin', name: 'Ancient Coin', emoji: '\uD83E\uDE99', buy: 1000, sell: 500, desc: 'An ancient coin from a forgotten empire.', rarity: 'rare' as const },
      { slug: 'fossil', name: 'Fossil', emoji: '\uD83E\uDDB4', buy: 600, sell: 300, desc: 'A prehistoric fossil.', rarity: 'uncommon' as const },
      { slug: 'star_fragment', name: 'Star Fragment', emoji: '\u2B50', buy: 3000, sell: 1500, desc: 'A fragment fallen from the stars.', rarity: 'legendary' as const },
    ];

    for (const c of collectables) {
      const item = await this.items.createItem(guildId, {
        item_slug: c.slug, name: c.name, emoji: c.emoji, category_slug: 'collectables',
        rarity: c.rarity, item_type: 'collectable', buy_price: c.buy, sell_price: c.sell,
        description: c.desc, max_stack: 10, stock: 10,
      });
      await this.dbExecute(
        'INSERT INTO economy_shop_listings (shop_id, item_id, sort_order) VALUES (?, ?, 0)',
        [collectShop.id, item.id],
      );
    }

    // ── Crafting Recipes ─────────────────────────────────────────────────
    const recipes = [
      { slug: 'iron_sword', name: 'Iron Sword', emoji: '\u2694\uFE0F', ingredients: [{ item: 'iron_ore', qty: 3 }, { item: 'wood', qty: 1 }], result: 'iron_sword', resultQty: 1, desc: 'A sturdy iron sword.' },
      { slug: 'golden_ring', name: 'Golden Ring', emoji: '\uD83D\uDC8D', ingredients: [{ item: 'gold_ore', qty: 2 }], result: 'golden_ring', resultQty: 1, desc: 'A beautiful golden ring.' },
      { slug: 'leather_armor', name: 'Leather Armor', emoji: '\uD83E\uDDE5', ingredients: [{ item: 'leather', qty: 3 }, { item: 'cloth', qty: 2 }], result: 'leather_armor', resultQty: 1, desc: 'Basic leather protection.' },
      { slug: 'magic_wand', name: 'Magic Wand', emoji: '\uD83E\uDE84', ingredients: [{ item: 'wood', qty: 2 }, { item: 'essence', qty: 1 }, { item: 'moonstone', qty: 1 }], result: 'magic_wand', resultQty: 1, desc: 'A wand imbued with magical power.' },
      { slug: 'dragon_blade', name: 'Dragon Blade', emoji: '\uD83D\uDD25', ingredients: [{ item: 'dragon_scale', qty: 2 }, { item: 'iron_ore', qty: 5 }, { item: 'essence', qty: 2 }], result: 'dragon_blade', resultQty: 1, desc: 'A legendary blade forged from dragon scales.', level: 10 },
    ];

    // Create result items first
    for (const r of recipes) {
      await this.items.createItem(guildId, {
        item_slug: r.result, name: r.name, emoji: r.emoji, category_slug: 'crafted',
        rarity: 'rare', item_type: 'permanent', buy_price: 0, sell_price: 0,
        description: r.desc, tradable: 1, sellable: 1, stock: null,
      });
    }

    for (const r of recipes) {
      await this.dbExecute(
        `INSERT INTO economy_crafting_recipes (guild_id, recipe_slug, name, description, emoji, ingredients, result_item_slug, result_quantity, required_level, enabled, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'system_default')`,
        [guildId, r.slug, r.name, r.desc, r.emoji, JSON.stringify(r.ingredients), r.result, r.resultQty, r.level ?? 0],
      );
    }

    this.app.logger.info(`Seeded default economy shops, items, jobs, quests, achievements, and recipes for guild ${guildId}`);
  }

  private async dbExecute(sql: string, params: unknown[]): Promise<void> {
    await this.app.db.execute(sql, params as any);
  }
}

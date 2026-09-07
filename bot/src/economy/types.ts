import type { Pool, RowDataPacket } from 'mysql2/promise';

// ── Economy Profile ──────────────────────────────────────────────────────
export interface EconomyProfile {
  id: number;
  guild_id: string;
  user_id: string;
  wallet: number;
  bank: number;
  total_earned: number;
  total_spent: number;
  level: number;
  xp: number;
  prestige: number;
  job_id: string | null;
  job_level: number;
  job_xp: number;
  daily_streak: number;
  weekly_streak: number;
  last_daily_at: string | null;
  last_weekly_at: string | null;
  last_work_at: string | null;
  status: string;
  opted_out: number;
  privacy_level: string;
  created_at: string;
  updated_at: string;
}

// ── Ledger Transaction ───────────────────────────────────────────────────
export interface LedgerEntry {
  id: number;
  tx_id: string;
  guild_id: string;
  actor_id: string;
  target_id: string | null;
  tx_type: string;
  amount: number;
  direction: 'credit' | 'debit';
  balance_after: number;
  ref_type: string | null;
  ref_id: string | null;
  idempotency_key: string | null;
  reason: string | null;
  metadata: unknown;
  source: string;
  created_at: string;
}

// ── Item ─────────────────────────────────────────────────────────────────
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'consumable' | 'permanent' | 'equippable' | 'cosmetic' | 'material' | 'collectable' | 'quest' | 'role_reward' | 'tool';

export interface EconomyItem {
  id: number;
  guild_id: string;
  item_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  category_slug: string | null;
  rarity: ItemRarity;
  item_type: ItemType;
  buy_price: number;
  sell_price: number;
  max_stack: number;
  ownership_limit: number | null;
  allow_duplicate: number;
  tradable: number;
  sellable: number;
  giftable: number;
  stock: number | null;
  restock_amount: number | null;
  restock_interval_seconds: number | null;
  last_restock_at: string | null;
  per_user_purchase_limit: number | null;
  per_user_purchase_window_seconds: number | null;
  required_level: number;
  required_role_id: string | null;
  required_item_slug: string | null;
  effect_type: string | null;
  effect_metadata: unknown;
  hidden: number;
  enabled: number;
  source: string;
  tags: unknown;
}

// ── Shop ─────────────────────────────────────────────────────────────────
export interface EconomyShop {
  id: number;
  guild_id: string;
  shop_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  sort_order: number;
  enabled: number;
  hidden: number;
  source: string;
}

// ── Shop Listing ─────────────────────────────────────────────────────────
export interface ShopListing {
  id: number;
  shop_id: number;
  item_id: number;
  override_price: number | null;
  sort_order: number;
  enabled: number;
}

// ── Inventory ────────────────────────────────────────────────────────────
export interface InventoryEntry {
  id: number;
  guild_id: string;
  user_id: string;
  item_id: number;
  quantity: number;
  equipped: number;
  equipped_slot: string | null;
  acquired_at: string;
  source: string;
}

// ── Job ──────────────────────────────────────────────────────────────────
export interface EconomyJob {
  id: number;
  guild_id: string;
  job_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  min_payout: number;
  max_payout: number;
  xp_reward: number;
  cooldown_seconds: number;
  required_level: number;
  required_role_id: string | null;
  max_employees: number | null;
  enabled: number;
}

// ── Quest Template ───────────────────────────────────────────────────────
export interface QuestTemplate {
  id: number;
  guild_id: string;
  quest_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  quest_type: string;
  requirements: unknown;
  reward_currency: number;
  reward_xp: number;
  reward_items: unknown;
  required_level: number;
  enabled: number;
  source: string;
}

// ── Quest Progress ───────────────────────────────────────────────────────
export interface QuestProgress {
  id: number;
  guild_id: string;
  user_id: string;
  quest_id: number;
  progress: unknown;
  completed: number;
  claimed: number;
  started_at: string;
  completed_at: string | null;
  claimed_at: string | null;
  reset_at: string | null;
}

// ── Achievement ──────────────────────────────────────────────────────────
export interface Achievement {
  id: number;
  guild_id: string;
  achievement_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  category: string | null;
  points: number;
  requirement_type: string;
  requirement_value: number;
  reward_currency: number;
  reward_items: unknown;
  reward_role_id: string | null;
  hidden: number;
  enabled: number;
}

// ── Achievement Unlock ───────────────────────────────────────────────────
export interface AchievementUnlock {
  id: number;
  guild_id: string;
  user_id: string;
  achievement_id: number;
  unlocked_at: string;
}

// ── Trade ────────────────────────────────────────────────────────────────
export type TradeStatus = 'draft' | 'reviewing' | 'locked' | 'completed' | 'cancelled' | 'expired' | 'failed';

export interface EconomyTrade {
  id: number;
  guild_id: string;
  initiator_id: string;
  recipient_id: string;
  status: TradeStatus;
  initiator_currency: number;
  recipient_currency: number;
  initiator_items: unknown;
  recipient_items: unknown;
  version: number;
  confirmed_by: unknown;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// ── Marketplace Listing ──────────────────────────────────────────────────
export type MarketListingStatus = 'active' | 'sold' | 'cancelled' | 'expired' | 'removed';

export interface MarketListing {
  id: number;
  guild_id: string;
  seller_id: string;
  item_id: number;
  quantity: number;
  price_per_unit: number;
  status: MarketListingStatus;
  buyer_id: string | null;
  listing_fee: number;
  tax_amount: number;
  escrow_inventory_id: number | null;
  expires_at: string;
}

// ── Role Reward ──────────────────────────────────────────────────────────
export type RoleRewardType = 'purchase' | 'temporary' | 'renewable' | 'achievement' | 'level' | 'prestige' | 'event' | 'job_level';

export interface RoleReward {
  id: number;
  guild_id: string;
  reward_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  discord_role_id: string;
  reward_type: RoleRewardType;
  price: number;
  duration_seconds: number | null;
  renewal_price: number | null;
  stock_limit: number | null;
  stock_remaining: number | null;
  required_level: number | null;
  required_achievement_slug: string | null;
  required_job_slug: string | null;
  required_prestige: number | null;
  mutually_exclusive_group: string | null;
  priority: number;
  refund_policy: string;
  removable: number;
  hidden: number;
  enabled: number;
}

// ── Cooldown ─────────────────────────────────────────────────────────────
export interface EconomyCooldown {
  id: number;
  guild_id: string;
  user_id: string;
  bucket: string;
  expires_at: string;
}

// ── Steal Log ────────────────────────────────────────────────────────────
export type StealOutcome = 'success' | 'failure' | 'blocked' | 'immune' | 'cancelled';

export interface StealLogEntry {
  id: number;
  guild_id: string;
  attacker_id: string;
  victim_id: string;
  outcome: StealOutcome;
  amount_stolen: number;
  fine_amount: number;
  protection_used: string | null;
  idempotency_key: string | null;
}

// ── Notification ─────────────────────────────────────────────────────────
export interface EconomyNotification {
  id: number;
  guild_id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string | null;
  ref_type: string | null;
  ref_id: string | null;
  is_read: number;
  created_at: string;
}

// ── Crafting Recipe ──────────────────────────────────────────────────────
export interface CraftingRecipe {
  id: number;
  guild_id: string;
  recipe_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  ingredients: unknown;
  result_item_slug: string;
  result_quantity: number;
  craft_time_seconds: number;
  required_level: number;
  enabled: number;
  source: string;
}

// ── Collection ───────────────────────────────────────────────────────────
export interface Collection {
  id: number;
  guild_id: string;
  collection_slug: string;
  name: string;
  description: string | null;
  emoji: string | null;
  required_items: unknown;
  reward_currency: number;
  reward_title: string | null;
  reward_badge: string | null;
  reward_role_id: string | null;
  enabled: number;
}

// ── Payment Request ──────────────────────────────────────────────────────
export type PaymentRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export interface PaymentRequest {
  id: number;
  guild_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  status: PaymentRequestStatus;
  reason: string | null;
  idempotency_key: string | null;
  expires_at: string;
}

// ── Item Effect Types ────────────────────────────────────────────────────
export const ITEM_EFFECT_TYPES = [
  'fixed_reward',
  'cooldown_reduction',
  'cosmetic_badge',
  'earning_multiplier',
  'quest_progress',
  'collectable_unlock',
  'role_grant',
  'xp_boost',
  'theft_protection',
  'streak_protection',
] as const;
export type ItemEffectType = (typeof ITEM_EFFECT_TYPES)[number];

// ── Economy Stats ────────────────────────────────────────────────────────
export interface EconomyStats {
  total_supply: number;
  wallet_total: number;
  bank_total: number;
  active_users: number;
  transactions_count: number;
  items_circulating: number;
  marketplace_volume: number;
}

// ── Active Effect ────────────────────────────────────────────────────────
export interface ActiveEffect {
  id: number;
  guild_id: string;
  user_id: string;
  item_id: number;
  effect_type: string;
  effect_data: unknown;
  expires_at: string | null;
}

// ── Reversal ─────────────────────────────────────────────────────────────
export interface ReversalRecord {
  id: number;
  guild_id: string;
  original_tx_id: string;
  reversal_tx_id: string;
  admin_id: string;
  confirming_admin_id: string | null;
  reason: string;
  status: string;
  confirmation_token: string | null;
  token_expires_at: string | null;
  plan_hash: string | null;
  compensation: unknown;
  conflicts: unknown;
  created_at: string;
  completed_at: string | null;
}

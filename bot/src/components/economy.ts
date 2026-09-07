import type { ComponentHandler } from '../core/componentLoader';
import type { App } from '../core/context';
import { v2Reply } from '../utils/v2';

// ── Shop Navigation ─────────────────────────────────────────────────────

const shopSelect: ComponentHandler = {
  type: 'select',
  id: 'eco:shop:',
  run: async (app: App, interaction: any) => {
    // customId format: "eco:shop:<shopSlug>"
    const parts = interaction.customId.split(':');
    const shopSlug = parts[2];
    if (!shopSlug) return;
    const guildId = interaction.guildId;
    if (!app.economy.isEnabled(guildId)) return;

    const shop = await app.economy.items.getShop(guildId, shopSlug);
    if (!shop) { await v2Reply(interaction, 'Shop not found.', { ephemeral: true }); return; }

    const listings = await app.economy.items.getShopItems(shop.id);
    if (listings.length === 0) {
      await v2Reply(interaction, `${shop.emoji ?? ''} **${shop.name}** is empty.`, { ephemeral: true });
      return;
    }

    const lines = listings.map((l: any) =>
      `${l.emoji ?? ''} **${l.name}** — ${app.economy.formatCurrency(l.override_price ?? l.buy_price)}${l.stock !== null ? ` (${l.stock} left)` : ''}`,
    );
    await v2Reply(interaction, `**${shop.emoji ?? ''} ${shop.name}**\n${shop.description ?? ''}\n\n${lines.join('\n')}\n\nUse \`/buy item:<name>\` to purchase.`);
  },
};

// ── Buy Confirmation ────────────────────────────────────────────────────

const buyConfirm: ComponentHandler = {
  type: 'button',
  id: 'eco:buy:confirm:',
  run: async (app: App, interaction: any) => {
    const parts = interaction.customId.split(':');
    const itemSlug = parts[3];
    const qty = parseInt(parts[4] ?? '1', 10);
    if (!itemSlug || !app.economy.isEnabled(interaction.guildId)) return;

    const idempKey = `buy:${interaction.guildId}:${interaction.user.id}:${itemSlug}:${qty}:${Date.now()}`;
    const result = await app.economy.items.purchaseItem(interaction.guildId!, interaction.user.id, itemSlug, qty, idempKey);
    if (!result.success) {
      await v2Reply(interaction, result.error ?? 'Purchase failed.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, `Purchased **${qty}x ${result.item!.name}** for **${app.economy.formatCurrency(result.totalCost!)}**.`);
  },
};

const buyCancel: ComponentHandler = {
  type: 'button',
  id: 'eco:buy:cancel:',
  run: async (_app: App, interaction: any) => {
    await v2Reply(interaction, 'Purchase cancelled.', { ephemeral: true });
  },
};

// ── Trade Confirm/Cancel ────────────────────────────────────────────────

const tradeConfirm: ComponentHandler = {
  type: 'button',
  id: 'eco:trade:confirm:',
  run: async (app: App, interaction: any) => {
    const tradeId = parseInt(interaction.customId.split(':')[3], 10);
    if (!tradeId || !app.economy.isEnabled(interaction.guildId)) return;

    const result = await app.economy.trading.confirmTrade(interaction.guildId!, tradeId, interaction.user.id);
    if (!result.success) {
      await v2Reply(interaction, result.error ?? 'Trade confirmation failed.', { ephemeral: true });
      return;
    }
    if (result.completed) {
      await v2Reply(interaction, '**Trade completed successfully!** Both parties have exchanged their items and currency.');
    } else {
      await v2Reply(interaction, 'Trade confirmed. Waiting for the other party to confirm.');
    }
  },
};

const tradeCancel: ComponentHandler = {
  type: 'button',
  id: 'eco:trade:cancel:',
  run: async (app: App, interaction: any) => {
    const tradeId = parseInt(interaction.customId.split(':')[3], 10);
    if (!tradeId || !app.economy.isEnabled(interaction.guildId)) return;

    const result = await app.economy.trading.cancelTrade(interaction.guildId!, tradeId, interaction.user.id);
    if (!result.success) {
      await v2Reply(interaction, result.error ?? 'Failed to cancel trade.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, 'Trade cancelled.');
  },
};

// ── Marketplace Confirm/Cancel ──────────────────────────────────────────

const marketBuyConfirm: ComponentHandler = {
  type: 'button',
  id: 'eco:market:buy:',
  run: async (app: App, interaction: any) => {
    const listingId = parseInt(interaction.customId.split(':')[3], 10);
    if (!listingId || !app.economy.isEnabled(interaction.guildId)) return;

    const result = await app.economy.marketplace.purchaseListing(interaction.guildId!, interaction.user.id, listingId);
    if (!result.success) {
      await v2Reply(interaction, result.error ?? 'Purchase failed.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, `Marketplace purchase complete! Paid **${app.economy.formatCurrency(result.totalCost!)}**.`);
  },
};

const marketCancel: ComponentHandler = {
  type: 'button',
  id: 'eco:market:cancel:',
  run: async (app: App, interaction: any) => {
    const listingId = parseInt(interaction.customId.split(':')[3], 10);
    if (!listingId || !app.economy.isEnabled(interaction.guildId)) return;

    const result = await app.economy.marketplace.cancelListing(interaction.guildId!, interaction.user.id, listingId);
    if (!result.success) {
      await v2Reply(interaction, result.error ?? 'Failed to cancel listing.', { ephemeral: true });
      return;
    }
    await v2Reply(interaction, 'Listing cancelled. Items returned to your inventory.');
  },
};

// ── Leaderboard Navigation ──────────────────────────────────────────────

const leaderboardNav: ComponentHandler = {
  type: 'button',
  id: 'eco:lb:page:',
  run: async (app: App, interaction: any) => {
    const parts = interaction.customId.split(':');
    const action = parts[3];
    const category = parts[4] ?? 'net_worth';
    const page = parseInt(parts[5] ?? '0', 10);
    if (!app.economy.isEnabled(interaction.guildId)) return;

    const newPage = action === 'next' ? page + 1 : Math.max(0, page - 1);
    const entries = await app.economy.leaderboards.getLeaderboard(interaction.guildId!, category, { limit: 15, offset: newPage * 15 });
    if (entries.length === 0) {
      await v2Reply(interaction, 'No more entries.', { ephemeral: true });
      return;
    }
    const lines = entries.map((e: any) => `\`${e.rank}.\` <@${e.user_id}> — ${app.economy.formatCurrency(e.value)}`);
    await v2Reply(interaction, `**Economy Leaderboard — ${category.replace('_', ' ')}** (Page ${newPage + 1})\n${lines.join('\n')}`);
  },
};

export const economyComponents: ComponentHandler[] = [
  shopSelect,
  buyConfirm,
  buyCancel,
  tradeConfirm,
  tradeCancel,
  marketBuyConfirm,
  marketCancel,
  leaderboardNav,
];

export default economyComponents;

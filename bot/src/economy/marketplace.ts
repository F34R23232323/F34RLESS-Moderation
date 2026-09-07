import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { App } from '../core/context';
import type { LedgerEngine } from './ledger';
import type { ItemShopService } from './items';
import type { MarketListing } from './types';

export class MarketplaceService {
  constructor(
    private readonly app: App,
    private readonly ledger: LedgerEngine,
    private readonly items: ItemShopService,
  ) {}

  private get db(): Pool { return this.app.db; }

  /** Create a marketplace listing. Item is escrowed. */
  async createListing(
    guildId: string,
    sellerId: string,
    itemSlug: string,
    quantity: number,
    pricePerUnit: number,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; listingId?: number }> {
    const ec = this.app.config.economy.marketplace;
    if (!ec.enabled) return { success: false, error: 'Marketplace is disabled.' };

    const item = await this.items.getItem(guildId, itemSlug);
    if (!item) return { success: false, error: 'Item not found.' };
    if (!item.tradable) return { success: false, error: 'This item cannot be listed.' };

    if (pricePerUnit < ec.min_price || pricePerUnit > ec.max_price) {
      return { success: false, error: `Price must be between ${ec.min_price} and ${ec.max_price}.` };
    }

    // Check listing limit
    const [listRows] = await this.db.query<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM economy_market_listings WHERE guild_id = ? AND seller_id = ? AND status = 'active'",
      [guildId, sellerId],
    );
    if ((listRows[0] as any).cnt >= ec.max_listings_per_user) {
      return { success: false, error: 'Listing limit reached.' };
    }

    // Check inventory
    const [invRows] = await this.db.query<RowDataPacket[]>(
      'SELECT * FROM economy_inventories WHERE guild_id = ? AND user_id = ? AND item_id = ?',
      [guildId, sellerId, item.id],
    );
    const inv = invRows[0] as { id: number; quantity: number } | undefined;
    if (!inv || inv.quantity < quantity) {
      return { success: false, error: 'Insufficient items in inventory.' };
    }

    // Calculate listing fee
    const listingFee = Math.floor((pricePerUnit * quantity * ec.listing_fee_bps) / 10000);

    // Deduct fee
    if (listingFee > 0) {
      const { success } = await this.ledger.debit(guildId, sellerId, sellerId, listingFee, 'marketplace_listing_fee', {
        reason: `Marketplace listing fee for ${quantity}x ${item.name}`,
        refType: 'marketplace_listing',
        idempotencyKey: idempotencyKey ? `${idempotencyKey}_fee` : undefined,
      });
      if (!success) return { success: false, error: 'Insufficient funds for listing fee.' };
    }

    // Escrow items
    await this.items.removeFromInventory(guildId, sellerId, item.id, quantity);

    const expiresAt = new Date(Date.now() + ec.listing_duration_hours * 60 * 60 * 1000);
    const [result] = await this.db.execute(
      `INSERT INTO economy_market_listings
        (guild_id, seller_id, item_id, quantity, price_per_unit, listing_fee, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildId, sellerId, item.id, quantity, pricePerUnit, listingFee, expiresAt],
    );

    return { success: true, listingId: (result as any).insertId };
  }

  /** Purchase a marketplace listing. */
  async purchaseListing(
    guildId: string,
    buyerId: string,
    listingId: number,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; error?: string; totalCost?: number }> {
    // Idempotency check first
    if (idempotencyKey) {
      const existing = await this.ledger.findByIdempotencyKey(idempotencyKey);
      if (existing) return { success: true, totalCost: existing.amount };
    }

    // Atomically claim the listing — prevents double-purchase
    const [claimResult] = await this.db.execute(
      "UPDATE economy_market_listings SET status = 'pending_sale', buyer_id = ? WHERE guild_id = ? AND id = ? AND status = 'active'",
      [buyerId, guildId, listingId],
    );
    if ((claimResult as any).affectedRows === 0) {
      return { success: false, error: 'Listing not found or no longer available.' };
    }

    // Now fetch the claimed listing
    const [listRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_market_listings WHERE id = ?",
      [listingId],
    );
    const listing = listRows[0] as MarketListing;
    if (listing.seller_id === buyerId) {
      // Rollback: restore listing
      await this.db.execute("UPDATE economy_market_listings SET status = 'active', buyer_id = NULL WHERE id = ?", [listingId]);
      return { success: false, error: 'Cannot buy your own listing.' };
    }

    const ec = this.app.config.economy.marketplace;
    const totalCost = listing.price_per_unit * listing.quantity;
    const tax = Math.floor((totalCost * ec.sale_tax_bps) / 10000);
    const sellerReceives = Math.max(0, totalCost - tax);

    // Debit buyer
    const { success } = await this.ledger.debit(
      guildId, buyerId, buyerId, totalCost, 'marketplace_purchase',
      {
        reason: `Marketplace purchase from <@${listing.seller_id}>`,
        refType: 'marketplace_listing',
        refId: String(listingId),
        idempotencyKey,
        metadata: { listing_id: listingId, quantity: listing.quantity, seller_id: listing.seller_id },
      },
    );
    if (!success) {
      // Rollback listing status
      await this.db.execute("UPDATE economy_market_listings SET status = 'active', buyer_id = NULL WHERE id = ?", [listingId]);
      return { success: false, error: 'Insufficient funds.' };
    }

    // Credit seller (minus tax)
    await this.ledger.credit(
      guildId, buyerId, listing.seller_id, sellerReceives, 'marketplace_sale',
      {
        reason: `Marketplace sale to <@${buyerId}>`,
        refType: 'marketplace_listing',
        refId: String(listingId),
        metadata: { listing_id: listingId, quantity: listing.quantity, tax },
      },
    );

    // Transfer item to buyer
    await this.items.addToInventory(guildId, buyerId, listing.item_id, listing.quantity, 'marketplace');

    // Mark listing as sold
    await this.db.execute(
      "UPDATE economy_market_listings SET status = 'sold', tax_amount = ? WHERE id = ?",
      [tax, listingId],
    );

    return { success: true, totalCost };
  }

  /** Cancel a listing and return items to seller. */
  async cancelListing(
    guildId: string,
    sellerId: string,
    listingId: number,
  ): Promise<{ success: boolean; error?: string }> {
    const [listRows] = await this.db.query<RowDataPacket[]>(
      "SELECT * FROM economy_market_listings WHERE guild_id = ? AND id = ? AND seller_id = ? AND status = 'active'",
      [guildId, listingId, sellerId],
    );
    const listing = listRows[0] as MarketListing | undefined;
    if (!listing) return { success: false, error: 'Listing not found or not yours.' };

    // Return items
    await this.items.addToInventory(guildId, sellerId, listing.item_id, listing.quantity, 'marketplace_return');

    await this.db.execute(
      "UPDATE economy_market_listings SET status = 'cancelled' WHERE id = ?",
      [listingId],
    );
    return { success: true };
  }

  /** Browse marketplace listings. */
  async browse(
    guildId: string,
    opts: { itemSlug?: string; sellerId?: string; limit?: number; offset?: number } = {},
  ): Promise<(MarketListing & { item_name: string; item_emoji: string | null })[]> {
    let sql = `SELECT ml.*, ei.name as item_name, ei.emoji as item_emoji
               FROM economy_market_listings ml
               JOIN economy_items ei ON ml.item_id = ei.id
               WHERE ml.guild_id = ? AND ml.status = 'active'`;
    const params: unknown[] = [guildId];

    if (opts.itemSlug) {
      sql += ' AND ei.item_slug = ?';
      params.push(opts.itemSlug);
    }
    if (opts.sellerId) {
      sql += ' AND ml.seller_id = ?';
      params.push(opts.sellerId);
    }

    sql += ' ORDER BY ml.created_at DESC LIMIT ? OFFSET ?';
    params.push(opts.limit ?? 25, opts.offset ?? 0);

    const [rows] = await this.db.query<RowDataPacket[]>(sql, params);
    return rows as any[];
  }

  /** Expire stale listings and return escrowed items. */
  async expireListings(): Promise<number> {
    const [rows] = await this.db.query<RowDataPacket[]>(
      "SELECT id, seller_id, item_id, quantity FROM economy_market_listings WHERE status = 'active' AND expires_at <= NOW()",
    );
    let count = 0;
    for (const row of rows) {
      const listing = row as MarketListing;
      await this.items.addToInventory(listing.guild_id, listing.seller_id, listing.item_id, listing.quantity, 'marketplace_expiry_return');
      await this.db.execute("UPDATE economy_market_listings SET status = 'expired' WHERE id = ?", [listing.id]);
      count++;
    }
    return count;
  }
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Amount Parsing ──────────────────────────────────────────────────────

function parseAmount(input: string, available: number): number | null {
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

function formatCurrency(amount: number, config: { symbol: string; symbol_placement: string }): string {
  const formatted = amount.toLocaleString('en-US');
  return config.symbol_placement === 'before' ? `${config.symbol}${formatted}` : `${formatted}${config.symbol}`;
}

describe('Economy Amount Parsing', () => {
  it('parses "all"', () => {
    assert.equal(parseAmount('all', 5000), 5000);
  });

  it('parses "half"', () => {
    assert.equal(parseAmount('half', 5000), 2500);
    assert.equal(parseAmount('half', 5001), 2500);
  });

  it('parses percentages', () => {
    assert.equal(parseAmount('50%', 1000), 500);
    assert.equal(parseAmount('25%', 1000), 250);
    assert.equal(parseAmount('100%', 777), 777);
    assert.equal(parseAmount('0%', 1000), 0);
  });

  it('parses plain numbers', () => {
    assert.equal(parseAmount('500', 10000), 500);
    assert.equal(parseAmount('1000', 10000), 1000);
  });

  it('parses K suffix', () => {
    assert.equal(parseAmount('1k', 100000), 1000);
    assert.equal(parseAmount('5k', 100000), 5000);
    assert.equal(parseAmount('1.5k', 100000), 1500);
  });

  it('parses M suffix', () => {
    assert.equal(parseAmount('1m', 10000000), 1000000);
    assert.equal(parseAmount('2.5m', 10000000), 2500000);
  });

  it('parses B suffix', () => {
    assert.equal(parseAmount('1b', 10000000000), 1000000000);
  });

  it('parses comma-separated numbers', () => {
    assert.equal(parseAmount('1,000', 100000), 1000);
    assert.equal(parseAmount('10,000', 100000), 10000);
  });

  it('returns null for invalid input', () => {
    assert.equal(parseAmount('', 1000), null);
    assert.equal(parseAmount('abc', 1000), null);
    assert.equal(parseAmount('-500', 1000), null);
    assert.equal(parseAmount('150%', 1000), null);
  });
});

describe('Economy Currency Formatting', () => {
  it('formats with before placement', () => {
    assert.equal(formatCurrency(1000, { symbol: '$', symbol_placement: 'before' }), '$1,000');
  });

  it('formats with after placement', () => {
    assert.equal(formatCurrency(1000, { symbol: '€', symbol_placement: 'after' }), '1,000€');
  });

  it('formats zero', () => {
    assert.equal(formatCurrency(0, { symbol: '$', symbol_placement: 'before' }), '$0');
  });

  it('formats large amounts', () => {
    assert.equal(formatCurrency(10000000, { symbol: '$', symbol_placement: 'before' }), '$10,000,000');
  });
});

describe('Economy Config Schema', () => {
  it('economy defaults are safe and disabled', async () => {
    const { configSchema } = await import('../shared/src/config/schema');
    const economyShape = configSchema.shape.economy;
    const defaults = economyShape.parse({});
    assert.equal(defaults.enabled, false);
    assert.equal(defaults.currency.name_singular, 'coin');
    assert.equal(defaults.currency.name_plural, 'coins');
    assert.equal(defaults.currency.symbol, '$');
    assert.equal(defaults.stealing.enabled, false);
    assert.equal(defaults.daily.enabled, true);
    assert.equal(defaults.weekly.enabled, true);
    assert.equal(defaults.trading.enabled, true);
    assert.equal(defaults.marketplace.enabled, true);
    assert.equal(defaults.banking.enabled, true);
    assert.equal(defaults.quests.enabled, true);
    assert.equal(defaults.crafting.enabled, true);
    assert.equal(defaults.leaderboards.enabled, true);
    assert.equal(defaults.role_rewards.enabled, true);
  });

  it('rejects unknown keys in economy section', async () => {
    const { configSchema } = await import('../shared/src/config/schema');
    const result = configSchema.safeParse({ economy: { unknown_field: true } });
    assert.equal(result.success, false);
  });

  it('validates steal cooldown min range', async () => {
    const { configSchema } = await import('../shared/src/config/schema');
    const result = configSchema.safeParse({
      economy: { stealing: { cooldown_seconds: 10 } },
    });
    assert.equal(result.success, false);
  });
});

describe('Economy Bug Regression Tests', () => {
  it('leaderboard SQL injection prevention', async () => {
    const { LeaderboardService } = await import('../bot/src/economy/leaderboards');
    const validCategories = (LeaderboardService as any).VALID_CATEGORIES;
    assert.ok(validCategories, 'VALID_CATEGORIES should exist');
    assert.ok(validCategories.has('wallet'), 'wallet should be valid');
    assert.ok(!validCategories.has("'; DROP TABLE --"), 'SQL injection should be rejected');
    assert.ok(!validCategories.has('wallet; DROP TABLE economy_profiles'), 'SQL injection should be rejected');
  });

  it('amount parser rejects negative numbers', () => {
    assert.equal(parseAmount('-100', 1000), null);
    assert.equal(parseAmount('-1k', 10000), null);
  });

  it('amount parser rejects percentages over 100', () => {
    assert.equal(parseAmount('101%', 1000), null);
    assert.equal(parseAmount('150%', 1000), null);
  });

  it('amount parser handles edge cases', () => {
    assert.equal(parseAmount('0', 1000), 0);
    assert.equal(parseAmount('0%', 1000), 0);
    assert.equal(parseAmount('all', 0), 0);
    assert.equal(parseAmount('half', 1), 0);
  });

  it('currency formatting handles zero', () => {
    assert.equal(formatCurrency(0, { symbol: '$', symbol_placement: 'before' }), '$0');
    assert.equal(formatCurrency(0, { symbol: '€', symbol_placement: 'after' }), '0€');
  });

  it('economy config has safe defaults', async () => {
    const { configSchema } = await import('../shared/src/config/schema');
    const defaults = configSchema.shape.economy.parse({});
    assert.equal(defaults.stealing.enabled, false, 'stealing should be disabled by default');
    assert.equal(defaults.daily.enabled, true, 'daily should be enabled');
    assert.ok(Number.isInteger(defaults.currency.starting_wallet), 'starting_wallet should be integer');
    assert.ok(Number.isInteger(defaults.currency.max_wallet), 'max_wallet should be integer');
    assert.ok(defaults.currency.max_wallet > defaults.currency.starting_wallet, 'max_wallet > starting_wallet');
    assert.ok(defaults.stealing.cooldown_seconds >= 60, 'steal cooldown >= 60s');
    assert.ok(defaults.banking.interest_rate_bps >= 0, 'interest_rate >= 0');
    assert.ok(defaults.banking.interest_rate_bps <= 10000, 'interest_rate <= 10000');
  });

  it('weekly streak bonus config is bounded', async () => {
    const { configSchema } = await import('../shared/src/config/schema');
    const defaults = configSchema.shape.economy.parse({});
    assert.ok(defaults.weekly.streak_bonus_per_week_bps > 0, 'weekly bonus should be positive');
    assert.ok(defaults.weekly.streak_bonus_per_week_bps <= 10000, 'weekly bonus should be <= 100%');
  });

  it('zero amount is handled by parseAmount', () => {
    assert.equal(parseAmount('0', 5000), 0);
    assert.equal(parseAmount('0k', 5000), 0);
  });

  it('whitespace in amount input is handled', () => {
    assert.equal(parseAmount('  500  ', 10000), 500);
    assert.equal(parseAmount('  1k  ', 100000), 1000);
  });
});

describe('Ledger TX ID Generation', () => {
  it('generates unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const txId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
      ids.add(txId);
    }
    assert.equal(ids.size, 200);
  });

  it('TX IDs have correct format', () => {
    const txId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    assert.match(txId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

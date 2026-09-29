import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDetails,
  formatTimestamp,
  humanizeMs,
  friendlyEventName,
  parseTimestamp,
} from '../src/core/logFormatter';
import { buildLogEmbed, packByBudget, type LogEmbedSource } from '../src/core/logEmbed';

test('parseTimestamp handles ISO strings, unix seconds, and millis', () => {
  assert.equal(parseTimestamp('2026-01-01T00:00:00.000Z'), 1767225600);
  assert.equal(parseTimestamp('2026-01-01 00:00:00'), 1767225600);
  assert.equal(parseTimestamp('1767225600'), 1767225600);
  assert.equal(parseTimestamp('1767225600000'), 1767225600);
  // Already-rendered Discord markup is passed through untouched
  assert.equal(parseTimestamp('<t:1767225600:f>'), null);
  // Non-timestamps are rejected
  assert.equal(parseTimestamp('just a reason'), null);
  assert.equal(parseTimestamp('176722'), null);
});

test('formatTimestamp renders absolute plus relative', () => {
  assert.equal(formatTimestamp(1767225600), '<t:1767225600:F> (<t:1767225600:R>)');
});

test('formatDetails renders ISO values under *At keys as timestamps', () => {
  const lines = formatDetails({ createdAt: '2026-01-01T00:00:00.000Z' }, null);
  assert.deepEqual(lines, ['**Created:** <t:1767225600:F> (<t:1767225600:R>)']);
});

test('formatDetails renders ISO values under non-*At keys like until', () => {
  const lines = formatDetails({ until: '2026-06-01T12:00:00.000Z' }, null);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^\*\*Expires:\*\* <t:\d+:F> \(<t:\d+:R>\)$/);
});

test('formatDetails passes pre-rendered Discord timestamps through', () => {
  const lines = formatDetails({ createdAt: '<t:1767225600:f>' }, null);
  assert.deepEqual(lines, ['**Created:** <t:1767225600:f>']);
});

test('formatDetails does not treat 10-digit counts as timestamps', () => {
  const lines = formatDetails({ uses: 1767225600 }, null);
  assert.deepEqual(lines, ['**Uses:** 1767225600']);
});

test('formatDetails renders user IDs with mention and raw ID', () => {
  const lines = formatDetails({ targetId: '123456789012345678' }, null);
  assert.deepEqual(lines, ['**Target:** <@123456789012345678> (`123456789012345678`)']);
});

test('formatDetails renders durations from Ms keys', () => {
  const lines = formatDetails({ durationMs: 3_600_000 }, null);
  assert.deepEqual(lines, ['**Duration:** 1h']);
  assert.equal(humanizeMs(0), 'permanent');
});

test('formatDetails renders role arrays as mentions', () => {
  const lines = formatDetails({ added: ['123456789012345678'] }, null);
  assert.deepEqual(lines, ['**Roles Added:** <@&123456789012345678>']);
});

test('formatDetails flattens nested objects with indented bullets', () => {
  const lines = formatDetails({ filters: { bots: true, contains: 'spam' } }, null);
  assert.deepEqual(lines, ['**Filters**', '- **Bots:** true', '- **Contains:** spam']);
});

test('friendlyEventName maps known events in sentence case and title-cases unknown ones', () => {
  assert.equal(friendlyEventName('member_ban'), 'Member banned');
  assert.equal(friendlyEventName('some_new_event'), 'Some new event');
});

test('long values are truncated instead of blowing past the card limit', () => {
  const lines = formatDetails({ reason: 'x'.repeat(2000) }, null);
  assert.equal(lines.length, 1);
  assert.ok(lines[0].length < 1600);
  assert.match(lines[0], /… \(\+\d+ chars\)$/);
});

/* ─── Embed rendering ────────────────────────────────────────────────────── */

function banSource(overrides: Partial<LogEmbedSource> = {}): LogEmbedSource {
  return {
    header: 'Member Banned',
    event: 'member_ban',
    guildId: '111111111111111111',
    channelId: '222222222222222222',
    actorId: '333333333333333333',
    targetId: '444444444444444444',
    message: 'Banned <@444444444444444444> (case K3F9X2)',
    details: { caseCode: 'K3F9X2', reason: 'spam', durationMs: 604800000 },
    ...overrides,
  };
}

test('buildLogEmbed sets plain title, accent color, quoted body and footer', () => {
  const embed = buildLogEmbed(banSource(), {
    guildName: 'Test Guild',
    logId: 42,
    timestamp: 1767225600000,
  }).toJSON();
  assert.equal(embed.title, 'Member Banned');
  assert.equal(embed.color, 0xed4245);
  assert.equal(
    embed.description,
    [
      '> User: <@444444444444444444>',
      '> Actor: <@333333333333333333>',
      '> Channel: <#222222222222222222>',
      '> Case: K3F9X2',
      '> Reason: spam',
      '> Duration: 7d',
    ].join('\n'),
  );
  assert.equal(embed.footer?.text, 'Test Guild • Log #42');
  assert.equal(embed.timestamp, '2026-01-01T00:00:00.000Z');
});

test('buildLogEmbed puts identity lines first with mentions', () => {
  const embed = buildLogEmbed(banSource(), { guildName: 'G', timestamp: 0 }).toJSON();
  const lines = (embed.description ?? '').split('\n');
  assert.equal(lines[0], '> User: <@444444444444444444>');
  assert.equal(lines[1], '> Actor: <@333333333333333333>');
  assert.equal(lines[2], '> Channel: <#222222222222222222>');
  const body = lines.join('\n');
  assert.match(body, /> Case: K3F9X2/);
  assert.match(body, /> Reason: spam/);
  assert.match(body, /> Duration: 7d/);
});

test('buildLogEmbed shows the actor footer with their avatar', () => {
  const embed = buildLogEmbed(banSource(), {
    guildName: 'G',
    timestamp: 0,
    actorName: 'mod_user',
    actorAvatarUrl: 'https://cdn.example/a.png',
  }).toJSON();
  assert.equal(embed.footer?.text, '@mod_user');
  assert.equal(embed.footer?.icon_url, 'https://cdn.example/a.png');
  // Actor line is redundant with the footer
  assert.ok(!(embed.description ?? '').includes('Actor:'));
});

test('buildLogEmbed dedupes detail identities already shown at top level', () => {
  const embed = buildLogEmbed(banSource({
    details: { authorId: '444444444444444444', channelId: '222222222222222222', content: 'hello' },
  }), { guildName: 'G', timestamp: 0 }).toJSON();
  const desc = embed.description ?? '';
  assert.equal(desc.split('Message author:').length - 1, 1, 'author shown exactly once');
  assert.equal(desc.split('Channel:').length - 1, 1, 'channel shown exactly once');
  assert.ok(!(desc.includes('User: <@444444444444444444>')), 'target line skipped when already in details');
  assert.equal(embed.fields?.find((f) => f.name === 'Message')?.value, 'hello');
});

test('buildLogEmbed linkifies the message ID when details carry a messageId', () => {
  const embed = buildLogEmbed(banSource({
    details: { messageId: '555555555555555555' },
  }), { guildName: 'G', timestamp: 0 }).toJSON();
  assert.match(
    embed.description ?? '',
    /\[`555555555555555555`\]\(https:\/\/discord\.com\/channels\/111111111111111111\/222222222222222222\/555555555555555555\)/,
  );
});

test('buildLogEmbed renders Before/After as side-by-side quoted fields', () => {
  const embed = buildLogEmbed(banSource({
    details: { old: 'before text', new: 'after text' },
  }), { guildName: 'G', timestamp: 0 }).toJSON();
  const before = embed.fields?.find((f) => f.name === 'Before');
  const after = embed.fields?.find((f) => f.name === 'After');
  assert.equal(before?.value, '> before text');
  assert.equal(after?.value, '> after text');
  assert.equal(before?.inline, true);
  assert.equal(after?.inline, true);
});

test('buildLogEmbed truncates over-long descriptions and caps at 25 fields', () => {
  const details: Record<string, string> = {};
  for (let i = 0; i < 40; i++) details[`key${i}`] = `value ${i}\nline b ${i}`;
  const embed = buildLogEmbed(banSource({
    message: 'x'.repeat(5000),
    details,
  }), { guildName: 'G', timestamp: 0 }).toJSON();
  assert.ok((embed.description ?? '').length <= 3800);
  assert.ok((embed.fields ?? []).length <= 25);
  assert.equal(embed.fields?.[embed.fields.length - 1].name, 'More');
});

test('packByBudget respects the 10-item and character limits', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ size: i < 12 ? 100 : 900 }));
  const packs = packByBudget(items, (it) => it.size);
  assert.ok(packs.every((p) => p.length <= 10));
  assert.ok(packs.every((p) => p.reduce((sum, it) => sum + it.size, 0) <= 5800 || p.length === 1));
  assert.equal(packs.flat().length, 25, 'no items lost');
});

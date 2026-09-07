import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { Client } from 'discord.js';
import { REST } from 'discord.js';
import { Logger } from '../src/core/logger';
import { EmojiManager } from '../src/emoji/EmojiManager';
import { clearEmojiCatalogForTests, emoji, emojiPrefix, replaceEmojiCatalog } from '../src/emoji/catalog';
import { normalizeDiscordPayload, normalizeEmojiMarkup } from '../src/emoji/normalize';
import { installEmojiOutboundNormalizer } from '../src/emoji/outbound';

test('lookup formats static and animated application emojis and degrades cleanly', () => {
  clearEmojiCatalogForTests();
  assert.equal(emoji('loading'), '');
  assert.equal(emojiPrefix('loading'), '');
  replaceEmojiCatalog([
    { id: '111111111111111111', name: 'success', animated: false },
    { id: '222222222222222222', name: 'loading', animated: true },
  ]);
  assert.equal(emoji('SUCCESS'), '<:success:111111111111111111>');
  assert.equal(emoji('loading'), '<a:loading:222222222222222222>');
  assert.equal(emoji('unknown'), '');
  assert.equal(emojiPrefix('unknown'), '');
});

test('normalization rewrites stale IDs using live animation state throughout payloads', () => {
  replaceEmojiCatalog([
    { id: '333333333333333333', name: 'success', animated: false },
    { id: '444444444444444444', name: 'loading', animated: true },
  ]);
  assert.equal(normalizeEmojiMarkup('<a:success:999999999999999999> <:loading:888888888888888888>'),
    '<:success:333333333333333333> <a:loading:444444444444444444>');
  const payload = normalizeDiscordPayload({
    content: '<:success:999999999999999999> Done',
    embeds: [{ title: '<:loading:999999999999999999> Loading', description: '<:success:999999999999999999> Body',
      fields: [{ name: '<:success:999999999999999999> State', value: '<:loading:999999999999999999> Wait' }],
      author: { name: '<:success:999999999999999999> Author' }, footer: { text: '<:success:999999999999999999> Footer' } }],
    components: [{ components: [{ type: 2, custom_id: '<:success:999999999999999999>', label: 'Continue',
      emoji: { id: '999999999999999999', name: 'loading', animated: false } }] }],
    url: 'https://example.test/<:success:999999999999999999>',
  });
  assert.equal(payload.content, '<:success:333333333333333333> Done');
  assert.equal(payload.embeds[0].footer.text, '<:success:333333333333333333> Footer');
  assert.deepEqual(payload.components[0].components[0].emoji,
    { id: '444444444444444444', name: 'loading', animated: true });
  assert.equal(payload.components[0].components[0].custom_id, '<:success:999999999999999999>');
  assert.equal(payload.url, 'https://example.test/<:success:999999999999999999>');
  assert.equal(normalizeEmojiMarkup('<:unknown:999999999999999999>'), '<:unknown:999999999999999999>');
});

test('outbound REST normalization installs only once', () => {
  installEmojiOutboundNormalizer();
  const first = REST.prototype.post;
  installEmojiOutboundNormalizer();
  assert.equal(REST.prototype.post, first);
});

test('startup synchronization is idempotent and handles duplicate local names deterministically', async () => {
  const root = join(process.cwd(), '.tmp-emoji-system-test');
  const directory = join(root, 'emojis');
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(join(directory, 'loading.gif'), Buffer.from('gif')),
    writeFile(join(directory, 'success.png'), Buffer.from('png')),
    writeFile(join(directory, 'success.gif'), Buffer.from('duplicate')),
    writeFile(join(directory, 'ignored.txt'), Buffer.from('ignored')),
  ]);
  const remote = new Map<string, { id: string; name: string; animated: boolean }>();
  let uploads = 0;
  const fakeClient = { application: { emojis: {
    fetch: async () => new Map([...remote.values()].map((item) => [item.id, item])),
    create: async ({ name, attachment }: { name: string; attachment: string }) => {
      uploads += 1;
      const created = { id: String(500000000000000000n + BigInt(uploads)), name, animated: attachment.endsWith('.gif') };
      remote.set(name.toLowerCase(), created);
      return created;
    },
  } } } as unknown as Client;

  try {
    const first = await new EmojiManager(fakeClient, new Logger('emoji-test'), root).synchronize();
    assert.equal(first.discovered, 3);
    assert.equal(first.uploaded, 2);
    assert.equal(first.alreadyPresent, 0);
    assert.equal(first.failed, 1);
    assert.match(first.failures[0].reason, /Duplicate local emoji name/);
    assert.match(emoji('loading'), /^<a:loading:/);
    assert.match(emoji('success'), /^<a:success:/);
    const second = await new EmojiManager(fakeClient, new Logger('emoji-test'), root).synchronize();
    assert.equal(second.uploaded, 0);
    assert.equal(second.alreadyPresent, 2);
    assert.equal(uploads, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

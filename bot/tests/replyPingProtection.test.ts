import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeContent, extractMentionedUserIds, hasProtectedMention } from '../src/services/replyPingProtection/sanitizer';
import { buildNotice } from '../src/services/replyPingProtection/noticeBuilder';
import { isReplyMessage } from '../src/services/replyPingProtection/exemptionEvaluator';
import type { GuildReplyPingConfig } from '../src/services/replyPingProtection/types';
import { DEFAULT_NOTICE_TITLE, DEFAULT_NOTICE_COLOR } from '../src/services/replyPingProtection/types';

// ---------------------------------------------------------------------------
// sanitizeContent
// ---------------------------------------------------------------------------

describe('sanitizeContent', () => {
  test('replaces user mentions with @mention', () => {
    assert.equal(sanitizeContent('Hello <@123456789012345678>'), 'Hello @mention');
  });

  test('replaces nicked user mentions with @mention', () => {
    assert.equal(sanitizeContent('Hello <@!123456789012345678>'), 'Hello @mention');
  });

  test('replaces role mentions with @mention', () => {
    assert.equal(sanitizeContent('Ping <@&987654321098765432>'), 'Ping @mention');
  });

  test('replaces channel mentions with @mention', () => {
    assert.equal(sanitizeContent('Check <#111222333444555666>'), 'Check @mention');
  });

  test('replaces custom emoji with :emoji:', () => {
    assert.equal(sanitizeContent('Cool <:smile:123456>'), 'Cool :emoji:');
  });

  test('replaces animated emoji with :emoji:', () => {
    assert.equal(sanitizeContent('Party <a:dance:654321>'), 'Party :emoji:');
  });

  test('removes zero-width characters', () => {
    const content = 'Hello\u200BWorld\u200C!';
    assert.equal(sanitizeContent(content), 'HelloWorld!');
  });

  test('replaces code blocks with [code block]', () => {
    assert.equal(sanitizeContent('```console.log("hi")```'), '[code block]');
  });

  test('replaces inline code with [inline code]', () => {
    assert.equal(sanitizeContent('Use `npm install`'), 'Use [inline code]');
  });

  test('replaces spoilers with [spoiler]', () => {
    assert.equal(sanitizeContent('||secret||'), '[spoiler]');
  });

  test('truncates long content to 500 chars', () => {
    const long = 'a'.repeat(600);
    const result = sanitizeContent(long);
    assert.ok(result.length <= 500);
    assert.ok(result.endsWith('...'));
  });

  test('trims whitespace', () => {
    assert.equal(sanitizeContent('  hello  '), 'hello');
  });

  test('handles empty string', () => {
    assert.equal(sanitizeContent(''), '');
  });

  test('handles complex mixed content', () => {
    const input = '<@123> said `hello` in <#456>';
    assert.equal(sanitizeContent(input), '@mention said [inline code] in @mention');
  });
});

// ---------------------------------------------------------------------------
// extractMentionedUserIds
// ---------------------------------------------------------------------------

describe('extractMentionedUserIds', () => {
  test('extracts a single user ID', () => {
    assert.deepEqual(extractMentionedUserIds('Hello <@123456>'), ['123456']);
  });

  test('extracts multiple user IDs', () => {
    const result = extractMentionedUserIds('<@111> and <@222> and <@333>');
    assert.deepEqual(result, ['111', '222', '333']);
  });

  test('deduplicates repeated mentions', () => {
    const result = extractMentionedUserIds('<@111> <@111> <@111>');
    assert.deepEqual(result, ['111']);
  });

  test('handles nicked mentions', () => {
    assert.deepEqual(extractMentionedUserIds('<@!123456>'), ['123456']);
  });

  test('ignores role and channel mentions', () => {
    const result = extractMentionedUserIds('<@&999> and <#888> and <@777>');
    assert.deepEqual(result, ['777']);
  });

  test('returns empty array for no mentions', () => {
    assert.deepEqual(extractMentionedUserIds('no mentions here'), []);
  });

  test('handles empty string', () => {
    assert.deepEqual(extractMentionedUserIds(''), []);
  });
});

// ---------------------------------------------------------------------------
// hasProtectedMention
// ---------------------------------------------------------------------------

describe('hasProtectedMention', () => {
  test('detects protected user mention', () => {
    const result = hasProtectedMention('Hello <@111>', ['111'], []);
    assert.deepEqual(result, { blocked: true, blockedUserId: '111' });
  });

  test('detects protected role mention', () => {
    const result = hasProtectedMention('Ping <@&222>', [], ['222']);
    assert.deepEqual(result, { blocked: true, blockedRoleId: '222' });
  });

  test('returns not blocked for unprotected mentions', () => {
    const result = hasProtectedMention('Hello <@999>', ['111', '222'], ['333']);
    assert.deepEqual(result, { blocked: false });
  });

  test('returns not blocked for no mentions', () => {
    const result = hasProtectedMention('No mentions', ['111'], ['222']);
    assert.deepEqual(result, { blocked: false });
  });

  test('handles nicked user mention', () => {
    const result = hasProtectedMention('<@!111>', ['111'], []);
    assert.deepEqual(result, { blocked: true, blockedUserId: '111' });
  });

  test('detects first match when multiple protected entities', () => {
    const result = hasProtectedMention('<@222> <@&333>', ['111', '222'], ['333', '444']);
    assert.equal(result.blocked, true);
    assert.equal(result.blockedUserId, '222');
  });

  test('handles empty content', () => {
    const result = hasProtectedMention('', ['111'], ['222']);
    assert.deepEqual(result, { blocked: false });
  });

  test('handles empty protection lists', () => {
    const result = hasProtectedMention('Hello <@111>', [], []);
    assert.deepEqual(result, { blocked: false });
  });
});

// ---------------------------------------------------------------------------
// buildNotice
// ---------------------------------------------------------------------------

describe('buildNotice', () => {
  const baseConfig: GuildReplyPingConfig = {
    guild_id: '123456789',
    enabled: true,
    native_rule_id: null,
    notice_channel_id: null,
    log_channel_id: null,
    notice_title: DEFAULT_NOTICE_TITLE,
    notice_description: null,
    notice_accent_color: DEFAULT_NOTICE_COLOR,
    notice_delete_after_seconds: 0,
    escalation_enabled: true,
  };

  test('returns Components V2 flags', () => {
    const result = buildNotice(baseConfig, 'test content', 'User#1234', '111', '<#222>');
    assert.equal(result.flags, 1 << 15);
  });

  test('returns a single container component', () => {
    const result = buildNotice(baseConfig, 'test', 'User', '111', '<#222>');
    assert.equal(result.components.length, 1);
  });

  test('sanitizes original content in the notice', () => {
    const result = buildNotice(baseConfig, '<@999> pinged!', 'User#1234', '111', '<#222>');
    const container = result.components[0] as any;
    const serialized = JSON.stringify(container);
    assert.ok(!serialized.includes('999'), 'should not contain the raw mention ID');
    assert.ok(serialized.includes('@mention'), 'should contain sanitized mention');
  });

  test('includes violator tag', () => {
    const result = buildNotice(baseConfig, 'hello', 'EvilUser#0001', '555', '<#222>');
    const container = result.components[0] as any;
    const serialized = JSON.stringify(container);
    assert.ok(serialized.includes('EvilUser#0001'));
  });

  test('includes channel mention', () => {
    const result = buildNotice(baseConfig, 'hello', 'User', '111', '<#777>');
    const container = result.components[0] as any;
    const serialized = JSON.stringify(container);
    assert.ok(serialized.includes('<#777>'));
  });

  test('uses custom title from config', () => {
    const customConfig = { ...baseConfig, notice_title: 'Custom Title' };
    const result = buildNotice(customConfig, 'hello', 'User', '111', '<#222>');
    const container = result.components[0] as any;
    const serialized = JSON.stringify(container);
    assert.ok(serialized.includes('Custom Title'));
  });

  test('uses custom description from config', () => {
    const customConfig = { ...baseConfig, notice_description: 'Custom description text' };
    const result = buildNotice(customConfig, 'hello', 'User', '111', '<#222>');
    const container = result.components[0] as any;
    const serialized = JSON.stringify(container);
    assert.ok(serialized.includes('Custom description text'));
  });
});

// ---------------------------------------------------------------------------
// isReplyMessage
// ---------------------------------------------------------------------------

describe('isReplyMessage', () => {
  test('returns true for valid message reference with message_id', () => {
    assert.equal(isReplyMessage({ message_id: '123', channel_id: '456' }), true);
  });

  test('returns false for null', () => {
    assert.equal(isReplyMessage(null), false);
  });

  test('returns false for empty object', () => {
    assert.equal(isReplyMessage({}), false);
  });

  test('returns false when message_id is null', () => {
    assert.equal(isReplyMessage({ message_id: null, channel_id: '456' }), false);
  });

  test('returns false when message_id is undefined', () => {
    assert.equal(isReplyMessage({ message_id: undefined, channel_id: '456' }), false);
  });

  test('returns true when only message_id is present', () => {
    assert.equal(isReplyMessage({ message_id: '999' }), true);
  });
});

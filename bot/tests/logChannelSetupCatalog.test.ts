import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOG_EVENT_NAMES } from '../../shared/src/index';
import { ALL_LOG_EVENTS, LOG_GROUPS, LOG_LAYOUTS } from '../src/services/logChannelSetupService';

test('logging setup routes every canonical event exactly once', () => {
  assert.deepEqual([...new Set(ALL_LOG_EVENTS)].sort(), [...LOG_EVENT_NAMES].sort());
  assert.equal(ALL_LOG_EVENTS.length, LOG_EVENT_NAMES.length);
});

test('logging groups have names, descriptions, and at least one event', () => {
  assert.ok(LOG_GROUPS.length >= 8);
  for (const group of LOG_GROUPS) {
    assert.ok(group.key.length > 0);
    assert.ok(group.label.length > 0);
    assert.ok(group.description.length > 0);
    assert.ok(group.events.length > 0);
  }
});

test('logging setup exposes multiple text, forum, and hybrid layouts', () => {
  assert.deepEqual(LOG_LAYOUTS, [
    'single', 'split', 'compact_categories', 'categories',
    'forum', 'event_forum', 'forums', 'hybrid',
  ]);
});

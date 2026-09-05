import assert from 'node:assert/strict';
import test from 'node:test';
import { humanizeDuration } from '../../shared/src/utils/duration';
import { NotificationDmGuard } from '../src/moderation/notificationDmGuard';

test('humanizeDuration uses compact day, hour, minute, and second units', () => {
  assert.equal(humanizeDuration(1_000), '1s');
  assert.equal(humanizeDuration(61_000), '1m 1s');
  assert.equal(humanizeDuration(3_661_000), '1h 1m 1s');
  assert.equal(humanizeDuration(90_061_000), '1d 1h 1m 1s');
});

test('notification guard suppresses duplicates but permits severity upgrades', () => {
  const guard = new NotificationDmGuard();
  assert.equal(guard.allow('user', 'automod:spam', 0, 15), true);
  assert.equal(guard.allow('user', 'automod:repeat', 0, 15), false);
  assert.equal(guard.allow('user', 'punishment:ban', 4, 15), true);
  assert.equal(guard.allow('user', 'punishment:ban', 4, 15), false);
});

test('failed notification reservations can be released for retry', () => {
  const guard = new NotificationDmGuard();
  assert.equal(guard.allow('user', 'punishment:mute', 2, 15), true);
  guard.release('user', 'punishment:mute');
  assert.equal(guard.allow('user', 'punishment:mute', 2, 15), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { findImpersonationMatch, findScanCollisions, laterArrival, normalizeName } from '../src/security/impersonation';

const opts = { matchMemberNames: true, matchServerName: true };

test('normalizeName trims, lowercases and applies NFKC normalization', () => {
  assert.equal(normalizeName('  Phantóm  '), 'phantóm');
  assert.equal(normalizeName('Ｆｅａｒ'), 'fear');
});

test('normalizeName strips zero-width characters and emoji variation selectors', () => {
  assert.equal(normalizeName('Angel\u200B\u200D\u{1F430}\uFE0F.exe'), 'angel\u{1F430}.exe');
  assert.equal(normalizeName('Angel \u{1F430}.exe'), 'angel \u{1F430}.exe');
  assert.equal(normalizeName('A\u200C\u200Dngel'), 'angel');
});

test('normalizeName collapses repeated whitespace', () => {
  assert.equal(normalizeName('Angel   🐰.exe'), 'angel 🐰.exe');
  assert.equal(normalizeName('Angel \t 🐰.exe'), 'angel 🐰.exe');
});

test('detects a match despite invisible characters and variation selectors', () => {
  const match = findImpersonationMatch(
    ['Angel​ 🐰️.exe'],
    [{ id: '9', names: ['Angel 🐰.exe'] }],
    'Some Server',
    opts,
  );
  assert.ok(match);
  assert.equal(match.matchedUserId, '9');
});

test('detects an exact nickname match against another member', () => {
  const match = findImpersonationMatch(
    ['Phantom'],
    [{ id: '111', names: ['phantom', 'other_name'] }],
    'Some Server',
    opts,
  );
  assert.ok(match);
  assert.equal(match.kind, 'member');
  assert.equal(match.matchedUserId, '111');
  assert.equal(match.matchedName, 'phantom');
  assert.equal(match.subjectName, 'Phantom');
});

test('ignores casing and surrounding whitespace differences', () => {
  const match = findImpersonationMatch(
    ['  MODERATOR  '],
    [{ id: '222', names: ['Moderator'] }],
    'Some Server',
    opts,
  );
  assert.ok(match);
  assert.equal(match.matchedUserId, '222');
});

test('matches a username against another member nickname', () => {
  const match = findImpersonationMatch(
    [null, null, 'coolguy'],
    [{ id: '333', names: ['coolguy'] }],
    'Some Server',
    opts,
  );
  assert.ok(match);
  assert.equal(match.subjectName, 'coolguy');
});

test('returns null when no names collide', () => {
  const match = findImpersonationMatch(
    ['alice'],
    [{ id: '444', names: ['bob'] }],
    'Some Server',
    opts,
  );
  assert.equal(match, null);
});

test('names that normalize to nothing never produce a match', () => {
  assert.equal(findImpersonationMatch(['​ ​​'], [{ id: '1', names: ['alice'] }], 'Some Server', opts), null);
  assert.equal(findImpersonationMatch(['alice'], [{ id: '1', names: ['​'] }], 'Some Server', opts), null);
  assert.equal(findImpersonationMatch(['​'], [{ id: '1', names: ['​​'] }], 'Some Server', opts), null);
});

test('returns null when the subject has no usable names', () => {
  const match = findImpersonationMatch(
    [null, undefined, '   '],
    [{ id: '555', names: [''] }],
    'Some Server',
    opts,
  );
  assert.equal(match, null);
});

test('detects a match against the server name', () => {
  const match = findImpersonationMatch(
    ['Fearless HQ'],
    [{ id: '666', names: ['someone_else'] }],
    'fearless hq',
    opts,
  );
  assert.ok(match);
  assert.equal(match.kind, 'server_name');
  assert.equal(match.matchedUserId, null);
});

test('respects match_server_name and match_member_names options', () => {
  assert.equal(
    findImpersonationMatch(['Fearless HQ'], [{ id: '777', names: ['x'] }], 'Fearless HQ', { ...opts, matchServerName: false }),
    null,
  );
  assert.equal(
    findImpersonationMatch(['alice'], [{ id: '888', names: ['alice'] }], 'Some Server', { ...opts, matchMemberNames: false }),
    null,
  );
});

test('empty server name never matches when member matching is off', () => {
  const match = findImpersonationMatch(
    ['alice'],
    [],
    '   ',
    { matchMemberNames: false, matchServerName: true },
  );
  assert.equal(match, null);
});

test('scan flags the later joiner as the offender of a shared name', () => {
  const collisions = findScanCollisions([
    { id: '1', joinedAt: 1000, names: ['Phantom', 'phantom#x'] },
    { id: '2', joinedAt: 2000, names: ['  PHANTOM  '] },
    { id: '3', joinedAt: 3000, names: ['someone_else'] },
  ]);
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0].offenderIds, ['2']);
  assert.equal(collisions[0].counterpartId, '1');
});

test('scan flags every member after the first holder of a name', () => {
  const collisions = findScanCollisions([
    { id: 'a', joinedAt: 100, names: ['shared'] },
    { id: 'b', joinedAt: 200, names: ['Shared'] },
    { id: 'c', joinedAt: 300, names: ['SHARED'] },
  ]);
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0].offenderIds.sort(), ['b', 'c']);
  assert.equal(collisions[0].counterpartId, 'a');
});

test('scan finds no collisions for unique names', () => {
  const collisions = findScanCollisions([
    { id: '1', joinedAt: 1000, names: ['alice'] },
    { id: '2', joinedAt: 2000, names: ['bob'] },
    { id: '3', joinedAt: 3000, names: [null, undefined, '   '] },
  ]);
  assert.equal(collisions.length, 0);
});

test('scan ignores duplicate name entries for the same member', () => {
  const collisions = findScanCollisions([
    { id: '1', joinedAt: 1000, names: ['same', 'same'] },
  ]);
  assert.equal(collisions.length, 0);
});

test('laterArrival returns whoever arrived at the name most recently', () => {
  assert.equal(laterArrival({ id: 'a', arrivalMs: 2000 }, { id: 'b', arrivalMs: 1000 }), 'a');
  assert.equal(laterArrival({ id: 'a', arrivalMs: 1000 }, { id: 'b', arrivalMs: 2000 }), 'b');
});

test('laterArrival returns null when arrival times tie', () => {
  assert.equal(laterArrival({ id: 'a', arrivalMs: 1000 }, { id: 'b', arrivalMs: 1000 }), null);
});

test('laterArrival prefers a rename timestamp over an older join timestamp', () => {
  // Member b joined first but renamed onto the name after a joined.
  const aJoined = { id: 'a', arrivalMs: 5000 };
  const bRenamed = { id: 'b', arrivalMs: 9000 };
  assert.equal(laterArrival(aJoined, bRenamed), 'b');
  assert.equal(laterArrival(bRenamed, aJoined), 'b');
});

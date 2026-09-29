import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractHosts,
  matchDomain,
  normalizeDomain,
  parseBlocklistLine,
} from '../src/automod/blocklistStore';

test('parseBlocklistLine handles hosts-file format', () => {
  assert.equal(parseBlocklistLine('0.0.0.0 evil.example.com'), 'evil.example.com');
  assert.equal(parseBlocklistLine('127.0.0.1\tbad.example.org # inline comment'), 'bad.example.org');
  assert.equal(parseBlocklistLine('0.0.0.0'), null);
});

test('parseBlocklistLine handles full URL lists', () => {
  assert.equal(parseBlocklistLine('http://malware.example.com/payload.exe'), 'malware.example.com');
  assert.equal(parseBlocklistLine('https://Phish.Example.com/step1?u=a'), 'phish.example.com');
});

test('parseBlocklistLine handles bare domain lists', () => {
  assert.equal(parseBlocklistLine('example.com'), 'example.com');
  assert.equal(parseBlocklistLine('WWW.Example.com'), 'example.com');
  assert.equal(parseBlocklistLine('sub.domain.example.co.uk'), 'sub.domain.example.co.uk');
  assert.equal(parseBlocklistLine('example.com/path?q=1'), 'example.com');
});

test('parseBlocklistLine skips comments, IPs, and junk', () => {
  assert.equal(parseBlocklistLine('# comment'), null);
  assert.equal(parseBlocklistLine('! another comment'), null);
  assert.equal(parseBlocklistLine('// comment'), null);
  assert.equal(parseBlocklistLine(''), null);
  assert.equal(parseBlocklistLine('   '), null);
  assert.equal(parseBlocklistLine('0.0.0.0 0.0.0.0'), null);
  assert.equal(parseBlocklistLine('random words with spaces'), null);
  assert.equal(parseBlocklistLine('0.0.0.0 localhost'), null);
  assert.equal(parseBlocklistLine('127.0.0.1 localhost.localdomain'), null);
  assert.equal(parseBlocklistLine('0.0.0.0 foo.local'), null);
});

test('normalizeDomain lowercases and strips www/trailing dot', () => {
  assert.equal(normalizeDomain('WWW.Example.COM.'), 'example.com');
  assert.equal(normalizeDomain('  evil.test  '), 'evil.test');
});

test('matchDomain walks parent domains', () => {
  const map = new Map<string, string>([
    ['evil.example.com', 'Evil List'],
    ['bad.org', 'Bad List'],
  ]);
  assert.equal(matchDomain(map, 'evil.example.com'), 'Evil List');
  assert.equal(matchDomain(map, 'sub.evil.example.com'), 'Evil List');
  assert.equal(matchDomain(map, 'WWW.Evil.Example.com'), 'Evil List');
  assert.equal(matchDomain(map, 'bad.org'), 'Bad List');
  assert.equal(matchDomain(map, 'notbad.org'), null);
  assert.equal(matchDomain(map, 'example.com'), null);
  assert.equal(matchDomain(map, 'org'), null);
});

test('extractHosts finds URLs and bare domains without duplicates', () => {
  const hosts = extractHosts('check https://www.Evil.com/x now, also evil.com and cool.test');
  assert.ok(hosts.includes('evil.com'));
  assert.ok(hosts.includes('cool.test'));
  assert.equal(hosts.filter((h) => h === 'evil.com').length, 1);
});

test('extractHosts handles angle-bracket wrapped links and ignores junk', () => {
  const hosts = extractHosts('<https://wrap.example.com/a> v1.2 not.a.domain');
  assert.ok(hosts.includes('wrap.example.com'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceUrl, evidenceImageExt, evidenceImageType } from '../src/utils/evidenceImages';
import { formatEvidenceLines } from '../src/utils/evidence';

test('evidenceImageType prefers the downloaded content type', () => {
  assert.equal(evidenceImageType('image/png', 'image/webp', 'a.png'), 'image/webp');
});

test('evidenceImageType falls back to the declared type, then the filename', () => {
  assert.equal(evidenceImageType('image/png', null, 'a.png'), 'image/png');
  assert.equal(evidenceImageType('application/octet-stream', null, 'photo.JPEG'), 'image/jpeg');
  assert.equal(evidenceImageType('text/plain', null, 'shot.webp'), 'image/webp');
  assert.equal(evidenceImageType('text/plain', null, 'notes.txt'), null);
  assert.equal(evidenceImageType(null, null, null), null);
});

test('evidenceImageExt maps content types and filenames to extensions', () => {
  assert.equal(evidenceImageExt('image/jpeg'), 'jpg');
  assert.equal(evidenceImageExt('image/png'), 'png');
  assert.equal(evidenceImageExt('text/plain', 'photo.jpeg'), 'jpg');
  assert.equal(evidenceImageExt('text/plain', 'unknown.bin'), 'png');
});

test('buildEvidenceUrl builds the custom public URL', () => {
  assert.equal(buildEvidenceUrl('https://dash.f34r.dev/', 'abc123', 'png'), 'https://dash.f34r.dev/api/evidence/abc123.png');
  assert.equal(buildEvidenceUrl('http://localhost:4693', 'abc123', 'jpg'), 'http://localhost:4693/api/evidence/abc123.jpg');
});

test('formatEvidenceLines renders stored image evidence', () => {
  const withName = formatEvidenceLines([{ type: 'image', url: 'https://x/api/evidence/abc.png', name: 'screenshot.png' }]);
  assert.equal(withName, 'Image (screenshot.png): https://x/api/evidence/abc.png');
  const withoutName = formatEvidenceLines([{ type: 'image', url: 'https://x/api/evidence/abc.jpg' }]);
  assert.equal(withoutName, 'Image: https://x/api/evidence/abc.jpg');
});

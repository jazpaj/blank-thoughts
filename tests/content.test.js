import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fingerprint, toPublicContent } from '../lib/content.js';

test('media URLs get a content fingerprint that changes when the file is replaced', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-pub-'));
  await fs.mkdir(path.join(dir, 'assets'));
  const file = path.join(dir, 'assets', 'bg.mp4');
  await fs.writeFile(file, 'night');
  const first = fingerprint('assets/bg.mp4', dir);
  await fs.writeFile(file, 'daytime');
  const second = fingerprint('assets/bg.mp4', dir);
  assert.match(first, /^assets\/bg\.mp4\?v=[0-9a-f]{8}$/);
  assert.notEqual(first, second);
  assert.equal(fingerprint('https://cdn.example.com/a.mp4', dir), 'https://cdn.example.com/a.mp4');
  assert.equal(fingerprint('assets/missing.mp4', dir), 'assets/missing.mp4');
  assert.equal(fingerprint(null, dir), null);
});

test('public content strips notes and normalises teaser lines', () => {
  const c = toPublicContent({
    _howTo: 'x', teaserLines: [{ text: 'A', _instagram: 'u' }, 'B'], teaserHoldMs: 1,
    revealImages: [{ src: 'nope.jpg', _note: 'n' }], video: null, success: {}, instagram: {},
  }, '/nonexistent');
  assert.deepEqual(c.teaserLines, ['A', 'B']);
  assert.deepEqual(c.revealImages, [{ src: 'nope.jpg' }]);
  assert.ok(!JSON.stringify(c).includes('"_'));
});

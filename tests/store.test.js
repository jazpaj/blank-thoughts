import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { SignupStore, toCsv } from '../lib/store.js';

async function freshStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bt-'));
  return new SignupStore(path.join(dir, 'signups.json')).load();
}

test('positions are sequential, even under concurrent signups', async () => {
  const store = await freshStore();
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) => store.add({ email: `p${i}@x.co`, phone: null })),
  );
  assert.deepEqual(results.map((r) => r.record.position).sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i + 1));
});

test('duplicates (email or phone) keep their original place', async () => {
  const store = await freshStore();
  await store.add({ email: 'a@x.co', phone: '+12125550123' });
  await store.add({ email: 'b@x.co', phone: null });
  const byEmail = await store.add({ email: 'b@x.co', phone: null });
  const byPhone = await store.add({ email: 'c@x.co', phone: '+12125550123' });
  assert.deepEqual([byEmail.duplicate, byEmail.record.position], [true, 2]);
  assert.deepEqual([byPhone.duplicate, byPhone.record.position], [true, 1]);
  assert.equal(store.count, 2);
});

test('signups survive a restart', async () => {
  const store = await freshStore();
  await store.add({ email: 'a@x.co', phone: null });
  const reopened = await new SignupStore(store.file).load();
  assert.equal(reopened.count, 1);
  assert.equal((await reopened.add({ email: 'b@x.co' })).record.position, 2);
});

test('CSV export neutralises spreadsheet formulas but keeps phone numbers', () => {
  const csv = toCsv([{ position: 1, name: '=cmd()', email: 'a@x.co', phone: '+12125550123', tracking: { utm_source: 'ig' } }]);
  const row = csv.trim().split('\n')[1];
  assert.match(row, /^1,,'=cmd\(\),a@x\.co,\+12125550123,/);
  assert.match(row, /,ig,/);
});

// Usage: npm run export [-- out.csv]   (prints to stdout when no file is given)
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SignupStore, toCsv } from '../lib/store.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = await new SignupStore(path.join(root, 'data', 'signups.json')).load();
const csv = toCsv(store.records);
const out = process.argv[2];

if (out) {
  await fsp.writeFile(out, csv);
  console.error(`Exported ${store.count} signup(s) to ${out}`);
} else {
  process.stdout.write(csv);
}

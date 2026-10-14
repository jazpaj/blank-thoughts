// Builds the static GitHub Pages site: public/ plus content.json (notes
// stripped, media URLs fingerprinted so replaced videos bust browser caches).
// Usage: node scripts/build-static.js [outDir=_site]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toPublicContent } from '../lib/content.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] ?? '_site');
const publicDir = path.join(root, 'public');

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(publicDir, out, { recursive: true, filter: (src) => !src.endsWith('.gitkeep') });
const site = JSON.parse(fs.readFileSync(path.join(root, 'content', 'site.json'), 'utf8'));
const content = toPublicContent(site, publicDir);
fs.writeFileSync(path.join(out, 'content.json'), JSON.stringify(content, null, 2));
console.log(`Built ${out}`);
console.log(`  video: ${content.video?.desktop?.mp4}  poster: ${content.video?.poster}`);

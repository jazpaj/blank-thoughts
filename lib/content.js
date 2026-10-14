import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const strip = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('_')));

// Fingerprint cache: path -> { key: "size:mtime", hash }
const hashes = new Map();

/**
 * Appends a content fingerprint (?v=1a2b3c4d) to a local media path, so a
 * replaced file (same name, e.g. bg.mp4) is never served from a stale browser
 * cache. Remote URLs and missing files are returned unchanged.
 */
export function fingerprint(url, publicDir) {
  if (!url || /^[a-z]+:\/\//i.test(url)) return url;
  const file = path.join(publicDir, url.replace(/^\//, '').split('?')[0]);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return url;
  }
  const key = `${stat.size}:${stat.mtimeMs}`;
  let entry = hashes.get(file);
  if (entry?.key !== key) {
    entry = { key, hash: crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 8) };
    hashes.set(file, entry);
  }
  return `${url.split('?')[0]}?v=${entry.hash}`;
}

/** The browser-safe subset of content/site.json (notes stripped, media fingerprinted). */
export function toPublicContent(c, publicDir) {
  const fp = (url) => fingerprint(url, publicDir);
  const videoSet = (set) => set && { mp4: fp(set.mp4), webm: fp(set.webm) };
  return {
    teaserLines: c.teaserLines.map((l) => (typeof l === 'string' ? l : l.text)).filter(Boolean),
    teaserHoldMs: c.teaserHoldMs,
    revealImages: c.revealImages.map((img) => ({ ...strip(img), src: fp(img.src) })),
    video: c.video && {
      poster: fp(c.video.poster),
      desktop: videoSet(c.video.desktop),
      mobile: videoSet(c.video.mobile),
    },
    success: c.success,
    instagram: c.instagram,
  };
}

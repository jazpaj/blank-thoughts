import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSignup } from './public/js/validate.js';
import { SignupStore, toCsv } from './lib/store.js';
import {
  klaviyoEnabled, syncToKlaviyo, turnstileEnabled, verifyTurnstile,
} from './lib/integrations.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const CONTENT_FILE = path.join(ROOT, 'content', 'site.json');
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

// Serverless hosts (Vercel) only allow writes to /tmp, which is NOT persistent:
// fine for a preview, not for real signups (see README "Hosting").
const DATA_DIR = process.env.DATA_DIR || (process.env.VERCEL ? '/tmp/blank-thoughts' : path.join(ROOT, 'data'));
export const store = await new SignupStore(path.join(DATA_DIR, 'signups.json')).load();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' https:",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const REVALIDATE = new Set(['.html', '.css', '.js', '.json', '.svg']);

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

// ---------- content (re-read when the file changes: no deploy needed for copy edits)

let contentCache = { mtimeMs: 0, data: null };
async function readContent() {
  const { mtimeMs } = await fsp.stat(CONTENT_FILE);
  if (mtimeMs !== contentCache.mtimeMs) {
    contentCache = { mtimeMs, data: JSON.parse(await fsp.readFile(CONTENT_FILE, 'utf8')) };
  }
  return contentCache.data;
}

function publicContent(c) {
  const strip = (obj) => Object.fromEntries(Object.entries(obj).filter(([k]) => !k.startsWith('_')));
  return {
    teaserLines: c.teaserLines.map((l) => (typeof l === 'string' ? l : l.text)).filter(Boolean),
    teaserHoldMs: c.teaserHoldMs,
    revealImages: c.revealImages.map(strip),
    video: c.video,
    success: c.success,
    instagram: c.instagram,
    turnstileSiteKey: turnstileEnabled() ? process.env.TURNSTILE_SITE_KEY : null,
  };
}

// ---------- helpers

function send(res, status, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    ...(isObj && { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }),
    ...headers,
  });
  res.end(isObj ? JSON.stringify(body) : body);
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (fwd) return String(fwd).split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? '';
}

async function readJson(req, limit = 8 * 1024) {
  // Serverless runtimes (Vercel) parse the body lazily via a getter that throws on bad JSON
  let parsed;
  try {
    parsed = req.body;
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
  if (parsed !== undefined) {
    const raw = Buffer.isBuffer(parsed) || typeof parsed === 'string' ? String(parsed) : JSON.stringify(parsed ?? {});
    if (raw.length > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    if (typeof parsed === 'object' && !Buffer.isBuffer(parsed)) return parsed ?? {};
    try {
      return JSON.parse(raw || '{}');
    } catch {
      throw Object.assign(new Error('Invalid JSON'), { status: 400 });
    }
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 });
  }
}

// Small fixed-window limiter: plenty for a single-page waitlist.
const hits = new Map();
const RATE = { windowMs: 10 * 60_000, max: 8 };
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.start > RATE.windowMs) {
    hits.set(ip, { start: now, count: 1 });
    return false;
  }
  return ++entry.count > RATE.max;
}
setInterval(() => {
  const cutoff = Date.now() - RATE.windowMs;
  for (const [ip, e] of hits) if (e.start < cutoff) hits.delete(ip);
}, RATE.windowMs).unref?.();

const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'referrer'];
function cleanTracking(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const k of TRACKING_KEYS) {
    const v = input[k];
    if (typeof v === 'string' && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return out;
}

// ---------- API

async function handleSignup(req, res) {
  const ip = clientIp(req);
  if (rateLimited(ip)) return send(res, 429, { error: 'Too many attempts. Please try again in a few minutes.' });

  const body = await readJson(req);

  // Honeypot: real people never see this field. Answer like a success, but
  // without a position, so bots learn nothing and no number is invented.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return send(res, 200, { ok: true, position: null });
  }

  if (turnstileEnabled() && !(await verifyTurnstile(body.turnstileToken, ip))) {
    return send(res, 400, { error: 'We couldn’t verify this request. Please refresh and try again.' });
  }

  const { ok, errors, values } = validateSignup(body);
  if (!ok) return send(res, 422, { error: 'Please check the highlighted fields.', fields: errors });

  const { record, duplicate } = await store.add({
    ...values,
    tracking: cleanTracking(body.tracking),
    klaviyo: klaviyoEnabled() ? 'pending' : 'disabled',
  });

  if (!duplicate && klaviyoEnabled()) {
    syncToKlaviyo(record)
      .then(() => store.update(record.position, { klaviyo: 'synced' }))
      .catch((err) => {
        console.error('[klaviyo]', err.message);
        store.update(record.position, { klaviyo: 'failed' });
      });
  }

  send(res, duplicate ? 200 : 201, {
    ok: true,
    duplicate,
    position: record.position,
    sms: Boolean(record.phone && record.smsConsent),
  });
}

function handleExport(req, res) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return send(res, 404, { error: 'Not found' });
  if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { error: 'Unauthorized' });
  send(res, 200, toCsv(store.records), {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="blank-thoughts-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  });
}

// ---------- static files (with Range support, which Safari needs for video)

async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');

  let stat;
  try {
    stat = await fsp.stat(file);
    if (stat.isDirectory()) return serveStatic(req, res, pathname.replace(/\/?$/, '/'));
  } catch {
    // Extensionless URLs for the legal pages: /privacy -> /privacy.html
    if (!path.extname(rel)) {
      try {
        await fsp.access(file + '.html');
        return serveStatic(req, res, pathname + '.html');
      } catch { /* fall through */ }
    }
    return send(res, 404, await fsp.readFile(path.join(PUBLIC, '404.html')).catch(() => 'Not found'), {
      'Content-Type': MIME['.html'],
    });
  }

  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${stat.size.toString(36)}-${Math.floor(stat.mtimeMs).toString(36)}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    // Code revalidates on every load so edits ship instantly; media is cached for a day.
    'Cache-Control': REVALIDATE.has(ext) ? 'no-cache' : 'public, max-age=86400',
    ETag: etag,
    'Last-Modified': stat.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
  };
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, headers);
    return res.end();
  }

  const range = req.headers.range && /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range) {
    let start = range[1] === '' ? stat.size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : stat.size - 1;
    end = Math.min(end, stat.size - 1);
    if (start > end || start < 0) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }

  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}

// ---------- router

export async function handler(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname === '/api/content' && req.method === 'GET') {
      return send(res, 200, publicContent(await readContent()));
    }
    if (pathname === '/api/signup') {
      if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
      return await handleSignup(req, res);
    }
    if (pathname === '/api/admin/signups.csv' && req.method === 'GET') return handleExport(req, res);
    if (pathname.startsWith('/api/')) return send(res, 404, { error: 'Not found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    return await serveStatic(req, res, pathname);
  } catch (err) {
    const status = err.status ?? 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'Something went quiet on our end.' : err.message });
  }
}

# Blank Thoughts — Coming Soon

The single-page "Coming Soon" site for **ourblankthoughts.com**: a wine-coloured card floating over a blurred New York night, with a waitlist form.

No dependencies. Plain HTML/CSS/JS, plus a small Node server that stores signups and hands out waitlist numbers.

```bash
npm start          # http://localhost:3000   (Node 22.9+)
npm run dev        # same, restarts when server files change
npm test           # validation + waitlist store tests
npm run export     # print all signups as CSV  (npm run export -- signups.csv to save a file)
```

Optional settings live in `.env` (copy `.env.example`). With nothing set, the site works fully and keeps signups in `data/signups.json`.

---

## Editing copy (no code change)

Everything a non-developer might want to change lives in **`content/site.json`**. The live site picks up edits on the next page load; no redeploy needed. Keys starting with `_` are notes and never reach the browser.

| What | Where in `site.json` |
|---|---|
| Rotating teaser lines | `teaserLines`: add/remove `{ "text": "…" }` entries |
| How long each line stays | `teaserHoldMs` |
| Success message, SMS / email line, "already saved" wording | `success` |
| Instagram handle + link | `instagram` |
| Hidden-reveal photos | `revealImages` (see below) |
| Background video | `video` (see below) |
| Welcome text / email wording (reference copy for Klaviyo) | `_welcomeMessages` |

Copy that is fixed in `public/index.html`: location line, "Coming Soon", form placeholders, SMS consent text, footer.

### Instagram tie-in
Every new teaser line or reveal image should also go up on @ourblankthoughts, so the page and the feed build the mystery together. Workflow:

1. Add the line to `teaserLines` (or the photo to `revealImages`).
2. Post the same line/image on Instagram.
3. Paste the post URL into that entry's `"_instagram"` note, so you can always see what has already been posted.

### Hidden reveal photos
Moving a cursor (or finger) over the card wipes away a faint wine layer to show a blurred, cropped close-up. Drop 1–2 photos in `public/assets/reveal/` and list them:

```json
"revealImages": [
  { "src": "/assets/reveal/stitch.jpg", "focus": "40% 60%", "zoom": "240%" }
]
```

`focus` = which part of the photo to crop to; `zoom` = how tight the crop is. One is picked at random per visit. Photos are shown blurred and wine-toned, so the product is never fully visible. While the list is empty, a placeholder fabric texture is shown.

### Background video
Add the licensed clips to `public/assets/video/` (or a CDN) and fill in:

```json
"video": {
  "poster":  "/assets/video/ny-poster.jpg",
  "desktop": { "mp4": "/assets/video/ny-1080.mp4", "webm": "/assets/video/ny-1080.webm" },
  "mobile":  { "mp4": "/assets/video/ny-720.mp4",  "webm": "/assets/video/ny-720.webm" }
}
```

**Currently configured:** `bg.mp4`, a night aerial over the Brooklyn Bridge toward Lower Manhattan (**2560×1440**, 15 s, H.264, no audio, 21.8 MB, fast-start), served untouched. `bg-poster.jpg` is its first frame at 1920×1080 (~0.7 MB) and shows instantly while the video loads. Phones get the same file: the macOS encoder's presets can't make a meaningfully lighter copy without visible softening. If mobile data matters, export a ~1080p, ~8–10 Mbps copy from the editing software and set it as `video.mobile.mp4` in `content/site.json`.

To swap the video, just replace `public/assets/video/bg.mp4` (and `bg-poster.jpg`) and push: media URLs are fingerprinted with a hash of the file (`bg.mp4?v=1ff08099`), so visitors' browsers can't keep showing the old clip.

The video is shown as-is, at full quality: never re-encoded, no zoom, no blur or colour overlay (removed at the client's request; this departs from the brief's "heavy blur + wine overlay"). The page only adds light film grain, parallax, and a soft dark fade at the bottom so the footer stays legible (`.scene__tint` in styles.css). Visitors with *reduce motion* switched on see only the poster. If no video is configured, an animated placeholder night scene (bokeh + taxi streaks) is drawn instead.

### Logo
The lockup keeps the official script **"Our"** (extracted from the Instagram logo image, `brand-source/logo-instagram-1080.jpg`, as a white-on-transparent layer in `public/assets/logo/logo-our.png`). At the client's request, **BLANK / THOUGHTS** is set in **Inter Medium** (live SVG text in `index.html`, styled by `.logo__caps`; a free match for the clean grotesque in the client's reference) instead of the original capitals, in the same positions on the same 735×219 artboard so the intro still lands the typed "Our" on the script. Note this now differs from the Instagram logo, which still uses its original capitals; update the brand files to match, or tell the developer to switch back. When a vector logo arrives, replace `logo-our.png` with its "Our" layer (same artboard).

---

## Signups

- **Waitlist number:** sequential, issued by the server, and shown as "You're #0042". Someone who signs up again (same email or phone) gets their original number back.
- **Backup copy:** every signup is written to `data/signups.json` before anything is sent to Klaviyo.
- **Export:** `npm run export -- waitlist.csv`, or download `GET /api/admin/signups.csv` with header `Authorization: Bearer <ADMIN_TOKEN>`. The CSV includes UTM source/medium/campaign/term/content, referral code (`?ref=`), and referrer.
- **Protection:** hidden honeypot field, duplicate blocking, per-IP rate limit (8 attempts / 10 min), and optional invisible Cloudflare Turnstile (`TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`). Behind a proxy/CDN set `TRUST_PROXY=1`.
- **Klaviyo:** set `KLAVIYO_PRIVATE_KEY` + `KLAVIYO_LIST_ID`. Each signup is upserted (name, waitlist number, UTM data) and subscribed to the list: email always, SMS only with consent. Sync status is recorded per signup (`klaviyo` column).
- **Welcome email + cryptic text** are sent by a Klaviyo flow triggered by "Added to list" (wording in `content/site.json > _welcomeMessages`).

### Form rules
Name and email are required; email is checked with an inline error. Phone is optional, US only, and auto-formats as `+1 (212) 555-0123`. When a number is typed, the SMS consent checkbox unfolds, unchecked, and becomes required. The same rules run in the browser and on the server (`public/js/validate.js`).

---

## Before launch

These are needed from the client or need sign-off. The site runs without them, but they're required for a real launch.

- [ ] **Background video licence**: confirm `bg.mp4` is cleared for commercial web use (optional: lighter mobile cut + WebM)
- [ ] **1–2 close-up teaser photos** for the hidden reveal
- [ ] **Vector logo SVG** for the script "Our" (current one is a high-res extraction from the Instagram image), and a decision on whether the Instagram logo moves to the Inter capitals too (or the licensed premium grotesque the reference used, if the client knows it)
- [ ] **Exact brand hex codes** (wine is currently `#7E0227`, sampled from the logo image; the brief's approximation was `#7D0029`)
- [ ] **Privacy Policy and SMS Terms text** (`public/privacy.html`, `public/sms-terms.html` are placeholders)
- [ ] **Legal review** of the SMS consent wording (TCPA)
- [ ] **Klaviyo access**: list ID, private key, welcome email + SMS flow, then one end-to-end test signup
- [ ] **Turnstile keys** (Cloudflare) to enable the invisible bot check
- [ ] **Approval** of fonts (Bodoni Moda + Pinyon Script), teaser lines, success copy and welcome-text wording

## Notes and assumptions

- **Fonts** load from Google Fonts: **Bodoni Moda**, the high-contrast didone of fashion mastheads, for all text and caps except the logo capitals, which use Inter (chosen at the client's request for a clothing-brand feel; replaces the brief's Barlow / Cormorant suggestions), and Pinyon Script for the "Coming Soon" accent. The logo itself is artwork, so its lettering is unchanged.
- **Tactile detail:** the card's bottom-right corner is folded back (the brief's "folded page corner" option; the earlier "NY" wax seal was removed at the client's request). The inset hairline stops at the fold and the flap carries its own; `js/frame.js` draws the line, and the fold size is the `--fold` CSS variable.
- **Success line:** "We'll text you before anyone else." is shown when the person gave a number and SMS consent; email-only signups see "We'll write to you before anyone else."
- **Intro** plays once per browser session; a click or keypress skips it. Reduced-motion users get no typing, no parallax and a still background.
- **Phone-tilt parallax** works on Android. iOS requires a permission prompt for motion data, which would break the mood, so iPhones get the static float.
- Code (HTML/CSS/JS) is served with `Cache-Control: no-cache` + ETag, so edits go live immediately; images/video are cached for a day.

## Hosting

- **Repo:** https://github.com/jazpaj/blank-thoughts (public, so GitHub Pages works on the free plan)
- **GitHub Pages preview:** https://jazpaj.github.io/blank-thoughts/, redeployed automatically on every push to `main` (`.github/workflows/pages.yml` runs `node scripts/build-static.js`, which publishes `public/` plus `content/site.json` as `content.json`). Pages is static-only: everything works except signups. The form validates, then says "This is a preview. Signups open at launch."
- **Vercel preview (form works):** https://blank-thoughts.vercel.app, deployed with `vercel deploy --prod` from this folder (Vercel project `blank-thoughts`, team *jpajarin's projects*). Static files are served from `public/` by Vercel's CDN; `/api/*` runs `app.js` as a serverless function (`api/index.js`, `vercel.json`).
- **The preview does not keep signups.** Serverless functions can only write to `/tmp`, which is wiped whenever an instance recycles, so waitlist numbers there restart from #0001 and records are lost. Use it to review the design and flow, not to collect real signups.
- **For launch,** either run `npm start` on a host with a persistent disk (Render, Railway, Fly.io, a VPS; set `DATA_DIR` if needed), or keep Vercel and move the store to a database (e.g. Vercel KV / Postgres) by swapping `lib/store.js`. Connecting Klaviyo also gives a durable copy of every signup.

## Structure

```
app.js                 request handler: static files, /api/content, /api/signup, CSV export
server.js              local/VM entry point (npm start)
api/index.js           Vercel entry point (same handler); config in vercel.json
lib/store.js           waitlist store (JSON file, atomic writes) + CSV export
lib/integrations.js    Klaviyo + Turnstile (inert until configured)
content/site.json      editable copy and media
public/index.html      the page
public/css/styles.css  design tokens, layout, animation
public/js/             intro, scene (video/placeholder + parallax), veil (hidden reveal),
                       teaser (rotating lines), form, validate (shared with server)
brand-source/          original logo image
data/                  signups.json (git-ignored)
```

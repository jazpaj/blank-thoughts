import { playIntro } from './intro.js';
import { initScene, initParallax } from './scene.js';
import { initVeil } from './veil.js';
import { startTeaser } from './teaser.js';
import { initForm } from './form.js';
import { initFrame } from './frame.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel) => document.querySelector(sel);

// Used only if /api/content can't be reached; the live copy is in content/site.json.
const FALLBACK = {
  teaserLines: [
    'Something is being written. You’ll want to read it first.',
    'Some thoughts are better worn.',
    'Made in New York. Meant for you.',
    'Not ready to say it yet.',
  ],
  teaserHoldMs: 3400,
  revealImages: [],
  video: null,
  success: {
    heading: 'Your thought has been saved.',
    lineSms: 'We’ll text you before anyone else.',
    lineEmail: 'We’ll write to you before anyone else.',
    duplicateHeading: 'Your thought was already saved.',
    instagramCta: 'Follow the thought',
  },
  instagram: { handle: 'ourblankthoughts', url: 'https://www.instagram.com/ourblankthoughts/' },
  turnstileSiteKey: null,
  signupsEnabled: true,
};

// no-cache: always revalidate, so copy and video changes show up on the next visit
const getJson = (url) => fetch(url, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject()));

// The server (local / Vercel) serves live copy and accepts signups. A static host
// (GitHub Pages) has no server: it ships content/site.json as content.json and
// the form explains that signups aren't open on the preview.
const content = getJson('api/content')
  .then((c) => ({ ...c, signupsEnabled: true }))
  .catch(() =>
    getJson('content.json').then((c) => ({
      ...c,
      teaserLines: (c.teaserLines ?? []).map((l) => (typeof l === 'string' ? l : l?.text)).filter(Boolean),
      revealImages: c.revealImages ?? [],
      signupsEnabled: false,
    })),
  )
  .then((c) => ({ ...FALLBACK, ...c, success: { ...FALLBACK.success, ...c.success } }))
  .catch(() => FALLBACK);

initFrame($('.card'));

// Background
const scene = initScene({ canvas: $('.scene__canvas'), video: $('.scene__video'), reduced });
content.then((c) => scene.useVideo(c.video));
initParallax({ sceneEl: $('[data-parallax="scene"]'), cardEl: $('[data-parallax="card"]'), reduced });

// Hidden reveal
content.then((c) =>
  initVeil({ card: $('.card'), canvas: $('.card__veil'), images: c.revealImages }),
);

// Form + success
let teaser = null;
const views = $('.views');
const signup = $('.view--signup');
const success = $('.view--success');

async function showSuccess({ position, duplicate, sms }) {
  const c = await content;
  teaser?.stop();

  success.querySelector('.success__title').textContent = duplicate ? c.success.duplicateHeading : c.success.heading;
  success.querySelector('.success__line').textContent = sms ? c.success.lineSms : c.success.lineEmail;
  success.querySelector('.success__cta').textContent = c.success.instagramCta;
  success.querySelector('.success__handle').textContent = `@${c.instagram.handle}`;
  success.querySelector('.success__ig').href = c.instagram.url;
  const place = success.querySelector('.success__place');
  if (Number.isInteger(position)) {
    success.querySelector('.success__num').textContent = `#${String(position).padStart(4, '0')}`;
  } else {
    place.hidden = true; // never show a number the server didn't issue
  }

  // Signup fades out, the card eases to its new height, the saved note fades in
  const from = views.offsetHeight;
  views.style.height = `${from}px`;
  views.classList.add('is-resizing');
  signup.classList.add('is-leaving');
  await new Promise((r) => setTimeout(r, reduced ? 0 : 560));

  signup.hidden = true;
  success.hidden = false;
  views.style.height = `${success.offsetHeight}px`;
  requestAnimationFrame(() => success.classList.add('is-entering'));
  success.focus({ preventScroll: true });

  setTimeout(() => {
    views.style.height = '';
    views.classList.remove('is-resizing');
  }, reduced ? 0 : 850);
}

initForm({ form: $('.form'), content, onSuccess: showSuccess });

// Entrance: the city, then the card with all of its text. The rotating teaser
// begins as the card arrives.
let teaserStarted = false;
const startTeaserOnce = () =>
  content.then((c) => {
    if (teaserStarted || signup.hidden) return;
    teaserStarted = true;
    teaser = startTeaser({
      textEl: $('.teaser__text'),
      caretEl: $('.caret--teaser'),
      srEl: $('.teaser__sr'),
      lines: c.teaserLines,
      holdMs: c.teaserHoldMs,
      reduced,
    });
  });
playIntro({ reduced, onRevealed: startTeaserOnce });

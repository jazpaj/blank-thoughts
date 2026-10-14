// Intro: the city fades in, then the card arrives with all of its text at once
// (logo, tagline, "Coming Soon", fields, button, credit) and the footer bar.
// Any key or click skips the wait.

const SEEN_KEY = 'bt:intro-seen';

function session(get, value) {
  try {
    return get ? sessionStorage.getItem(SEEN_KEY) : sessionStorage.setItem(SEEN_KEY, value);
  } catch {
    return null;
  }
}

export async function playIntro({ reduced, onRevealed = () => {} }) {
  const body = document.body;

  // Any key or click cuts the wait short
  let skip = () => {};
  const skipped = new Promise((resolve) => (skip = resolve));
  addEventListener('keydown', skip, { once: true });
  addEventListener('pointerdown', skip, { once: true });
  const wait = (ms) => Promise.race([new Promise((r) => setTimeout(r, ms)), skipped]);

  // Wait for the faces so nothing appears in a fallback font
  await Promise.race([
    Promise.all([
      document.fonts.load('500 1em "Cormorant Garamond"'),
      document.fonts.load('600 1em Montserrat'),
      document.fonts.load('300 1em Inter'),
      document.fonts.load('500 1em Inter'),
    ]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  body.classList.remove('is-loading');
  body.classList.add('scene-in');

  // Let the city come up first, except for reduced motion or a repeat visit this session
  if (!reduced && !session(true)) await wait(900);

  body.classList.add('is-revealed');
  onRevealed(); // the rotating teaser line starts with the card
  removeEventListener('keydown', skip);
  removeEventListener('pointerdown', skip);
  session(false, '1');
}

// Intro: the city fades in, then the card's words print out in place (logo,
// tagline, "Coming Soon", the teaser line) with no card behind them yet. Then
// the card arrives behind the words, bringing the fields and button with it.
// Any key or click finishes it at once.

const SEEN_KEY = 'bt:intro-seen';

function session(get, value) {
  try {
    return get ? sessionStorage.getItem(SEEN_KEY) : sessionStorage.setItem(SEEN_KEY, value);
  } catch {
    return null;
  }
}

/**
 * Blanks an element's text and returns a function that types it back in place.
 * The untyped remainder stays in the layout (invisible), so centred lines don't
 * re-centre on every letter. Works for HTML elements and SVG <text>.
 */
function prepareTyping(el) {
  const text = el.textContent;
  const ns = el instanceof SVGElement ? 'http://www.w3.org/2000/svg' : 'http://www.w3.org/1999/xhtml';
  const tag = el instanceof SVGElement ? 'tspan' : 'span';
  const shown = document.createElementNS(ns, tag);
  const ghost = document.createElementNS(ns, tag);
  ghost.setAttribute('class', 'type-ghost');
  ghost.textContent = text;
  el.replaceChildren(shown, ghost);

  return async (msPerChar, sleep) => {
    for (let i = 1; i <= text.length; i++) {
      shown.textContent = text.slice(0, i);
      ghost.textContent = text.slice(i);
      if (text[i - 1] !== ' ') await sleep(msPerChar);
    }
    el.textContent = text;
  };
}

export async function playIntro({ reduced, onPrinted = () => {} }) {
  const body = document.body;
  const $ = (sel) => document.querySelector(sel);

  // Any key or click finishes the sequence immediately
  let skipping = false;
  const pending = new Set();
  const skip = () => {
    skipping = true;
    pending.forEach((done) => done());
  };
  addEventListener('keydown', skip, { once: true });
  addEventListener('pointerdown', skip, { once: true });
  const sleep = (ms) => new Promise((resolve) => {
    if (skipping) return resolve();
    const done = () => {
      clearTimeout(id);
      pending.delete(done);
      resolve();
    };
    const id = setTimeout(done, ms);
    pending.add(done);
  });

  // Wait for the faces so nothing prints in a fallback font
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

  const finish = () => {
    removeEventListener('keydown', skip);
    removeEventListener('pointerdown', skip);
    session(false, '1');
  };

  if (reduced || session(true)) {
    // No theatre for reduced-motion users or a second visit in the same session
    body.classList.add('scene-in', 'is-revealed');
    onPrinted();
    finish();
    return;
  }

  // Blank every line that will print, then show the text without its card
  const [blank, thoughts] = [...document.querySelectorAll('.logo__caps text')].map(prepareTyping);
  const origin = prepareTyping($('.origin'));
  const status = prepareTyping($('.status'));
  body.classList.add('scene-in', 'is-printing');

  await sleep(700); // let the city come up first

  // Logo: the script "Our" writes on while BLANK / THOUGHTS type beside it
  body.classList.add('is-writing-our');
  await blank(70, sleep);
  await thoughts(70, sleep);
  await sleep(160);
  await origin(24, sleep);
  await sleep(180);
  await status(70, sleep);
  onPrinted(); // the teaser line starts typing under "Coming Soon"
  await sleep(1700); // let the first teaser line write itself

  // The card arrives behind the words, with the fields and button
  body.classList.remove('is-printing');
  body.classList.add('is-revealed');
  finish();
}

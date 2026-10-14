// Intro (0–2.5 s): black screen, a blinking cursor types "Our…" and pauses,
// as if the thought is left blank. The city fades in behind. Then the card
// rises, and the typed "Our" glides down to become the logo's "Our".

const SEEN_KEY = 'bt:intro-seen';

function session(get, value) {
  try {
    return get ? sessionStorage.getItem(SEEN_KEY) : sessionStorage.setItem(SEEN_KEY, value);
  } catch {
    return null;
  }
}

export async function playIntro({ reduced }) {
  const body = document.body;
  const intro = document.querySelector('.intro');
  const text = intro.querySelector('.intro__text');
  const word = intro.querySelector('.intro__word');
  const ellipsis = intro.querySelector('.intro__ellipsis');
  const caret = intro.querySelector('.caret--intro');
  const card = document.querySelector('.card');
  const logoOur = document.querySelector('.logo__our-target');

  // Any key or click skips ahead
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

  // Wait for the script face so nothing is typed in a fallback font
  await Promise.race([
    Promise.all([document.fonts.load('1em "Pinyon Script"'), document.fonts.load('500 1em "Cormorant Garamond"'), document.fonts.load('600 1em Montserrat'), document.fonts.load('300 1em Butler'), document.fonts.load('500 1em Inter')]),
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
    intro.classList.add('is-done');
    body.classList.add('scene-in', 'is-revealed');
    finish();
    return;
  }

  // Reserve the final width so typing doesn't re-centre on every letter
  word.textContent = 'Our';
  ellipsis.textContent = '…';
  text.style.width = `${text.getBoundingClientRect().width}px`;
  text.style.textAlign = 'left';
  word.textContent = '';
  ellipsis.textContent = '';

  await sleep(420);
  setTimeout(() => body.classList.add('scene-in'), skipping ? 0 : 500);
  await sleep(380);

  caret.classList.add('is-typing');
  for (const ch of 'Our') {
    word.textContent += ch;
    await sleep(150 + Math.random() * 60);
  }
  caret.classList.remove('is-typing');
  await sleep(420);
  ellipsis.textContent = '…';
  await sleep(skipping ? 0 : 1050); // the pause: a thought left blank
  body.classList.add('scene-in');

  // --- Card reveal + "Our" glides into the logo
  // Measure where the logo's "Our" will be once the card has settled.
  const prevTransition = card.style.transition;
  card.style.transition = 'none';
  card.style.transform = 'none';
  const to = logoOur.getBoundingClientRect();
  card.style.transform = '';
  card.offsetWidth; // commit before restoring the transition
  card.style.transition = prevTransition;
  const from = word.getBoundingClientRect();
  const probe = document.createElement('span'); // sits on the typed word's baseline
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  word.after(probe);
  const baseline = probe.getBoundingClientRect().top;
  probe.remove();

  body.classList.add('is-flying', 'is-revealed');
  intro.classList.add('is-leaving');

  if (from.width && to.width) {
    const s = to.width / from.width;
    const dx = to.left - from.left;
    const dy = to.bottom - (from.top + (baseline - from.top) * s);
    const flight = word.animate(
      [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }],
      { duration: skipping ? 1 : 1300, easing: 'cubic-bezier(.65, 0, .35, 1)', fill: 'forwards' },
    );
    await flight.finished.catch(() => {});
  }

  body.classList.remove('is-flying'); // logo "Our" fades up under the travelling one
  word.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
  await new Promise((r) => setTimeout(r, 520));
  intro.classList.add('is-done');
  finish();
}

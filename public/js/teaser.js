// Rotating cryptic lines, typed and erased like a thought.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function whileVisible(ms) {
  await sleep(ms);
  if (document.hidden) {
    await new Promise((r) => document.addEventListener('visibilitychange', r, { once: true }));
  }
}

export function startTeaser({ textEl, caretEl, srEl, lines, holdMs = 3400, reduced }) {
  let running = true;
  if (!lines?.length) return { stop() {} };
  srEl.textContent = lines[0];

  const type = async (line) => {
    caretEl.classList.add('is-typing');
    for (let i = 1; i <= line.length && running; i++) {
      textEl.textContent = line.slice(0, i);
      const ch = line[i - 1];
      await sleep(/[.,—]/.test(ch) ? 260 : 34 + Math.random() * 42);
    }
    caretEl.classList.remove('is-typing');
  };

  const erase = async () => {
    caretEl.classList.add('is-typing');
    let s = textEl.textContent;
    while (s.length && running) {
      s = s.slice(0, -1);
      textEl.textContent = s;
      await sleep(16);
    }
    caretEl.classList.remove('is-typing');
  };

  const fade = async (line) => {
    textEl.style.opacity = '0';
    await sleep(600);
    textEl.textContent = line;
    textEl.style.opacity = '1';
  };

  (async () => {
    if (reduced) caretEl.hidden = true;
    for (let i = 0; running; i = (i + 1) % lines.length) {
      if (reduced) await fade(lines[i]);
      else await type(lines[i]);
      if (lines.length === 1) return;
      await whileVisible(holdMs + (reduced ? 2000 : 0));
      if (!reduced && running) {
        await erase();
        await sleep(420);
      }
    }
  })();

  return {
    stop() {
      running = false;
    },
  };
}

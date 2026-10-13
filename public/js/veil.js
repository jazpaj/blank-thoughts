// Hidden "blank" reveal: moving a cursor (or finger) across the card wipes a
// faint wine layer away, showing a blurred close-up detail underneath. It
// slowly settles back, so the card always returns to blank.

const WINE = '#7E0227'; // must match --wine in styles.css
const PLACEHOLDER = { src: '/assets/reveal/placeholder-texture.svg', focus: '42% 55%', zoom: '150%' };

export function initVeil({ card, canvas, layer, images }) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const BRUSH = 66; // css px
  const HEAL_DELAY = 900; // ms the revealed patch lingers
  const HEAL_MS = 5200;   // then it settles back to blank over this long

  let last = null;
  let lastWipe = 0;
  let healStart = 0;
  let healPrev = 0;
  let raf = 0;
  let enabled = false;

  // Choose today's detail
  const pool = images?.length ? images : [PLACEHOLDER];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const img = new Image();
  img.onload = () => {
    layer.style.setProperty('--reveal-src', `url("${pick.src}")`);
    layer.style.setProperty('--reveal-focus', pick.focus ?? '50% 50%');
    layer.style.setProperty('--reveal-zoom', pick.zoom ?? '220%');
    enabled = true;
  };
  img.src = pick.src;

  function fill() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = WINE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function resize() {
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    fill();
  }

  function dab(x, y) {
    const r = BRUSH * dpr;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,.42)');
    g.addColorStop(0.5, 'rgba(0,0,0,.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function wipe(clientX, clientY) {
    if (!enabled) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    if (last) {
      // Interpolate so fast movements leave a continuous trail
      const dist = Math.hypot(x - last.x, y - last.y);
      const steps = Math.min(40, Math.ceil(dist / (14 * dpr)));
      for (let i = 1; i <= steps; i++) dab(last.x + ((x - last.x) * i) / steps, last.y + ((y - last.y) * i) / steps);
    } else {
      dab(x, y);
    }
    last = { x, y };
    lastWipe = performance.now();
    healStart = 0;
    if (!raf) raf = requestAnimationFrame(heal);
  }

  // Time-based so it settles at the same pace on throttled / low-fps devices
  function heal(now) {
    raf = requestAnimationFrame(heal);
    if (now - lastWipe < HEAL_DELAY) return;
    if (!healStart) healStart = healPrev = now;
    if (now - healStart >= HEAL_MS) {
      fill();
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    const dt = now - healPrev;
    healPrev = now;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1 - Math.pow(1 - 0.016, dt / 16.7);
    ctx.fillStyle = WINE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  new ResizeObserver(resize).observe(canvas);
  resize();

  card.addEventListener('pointermove', (e) => wipe(e.clientX, e.clientY), { passive: true });
  card.addEventListener('pointerleave', () => (last = null));
  card.addEventListener('pointerdown', () => (last = null));
  // Touch keeps reporting while the page scrolls, so a swipe still reveals
  card.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (t) wipe(t.clientX, t.clientY);
  }, { passive: true });
  card.addEventListener('touchend', () => (last = null));
}

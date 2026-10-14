// Hidden "blank" reveal: moving a cursor (or finger) across the card brings up
// a blurred, cropped close-up detail where it passes. It slowly fades again,
// so the card always returns to blank.
//
// A mask canvas records where the card has been wiped; the visible canvas draws
// the detail image only through that mask. (CSS on .card__veil adds the blur
// and wine-toned luminosity blend.)

const PLACEHOLDER = { src: 'assets/reveal/placeholder-texture.svg', focus: '42% 55%', zoom: '150%' };

export function initVeil({ card, canvas, images }) {
  const ctx = canvas.getContext('2d');
  const mask = document.createElement('canvas');
  const mctx = mask.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const BRUSH = 66; // css px
  const HEAL_DELAY = 900; // ms the revealed patch lingers
  const HEAL_MS = 5200;   // then it fades back to blank over this long

  let last = null;
  let lastWipe = 0;
  let healStart = 0;
  let healPrev = 0;
  let raf = 0;
  let img = null;

  // Choose today's detail
  const pool = images?.length ? images : [PLACEHOLDER];
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const source = new Image();
  source.onload = () => (img = source);
  source.src = pick.src;

  const pct = (v, fallback) => (Number.parseFloat(v) || fallback) / 100;

  // Same crop maths as CSS background-size/position: zoom is relative to the card width
  function drawDetail() {
    const cw = canvas.width;
    const ch = canvas.height;
    const ratio = (img.naturalHeight || img.height) / (img.naturalWidth || img.width) || 1;
    let w = cw * pct(pick.zoom, 220);
    let h = w * ratio;
    if (h < ch) {
      h = ch;
      w = h / ratio;
    }
    const [fx, fy] = String(pick.focus ?? '50% 50%').split(/\s+/);
    ctx.drawImage(img, (cw - w) * pct(fx, 50), (ch - h) * pct(fy ?? fx, 50), w, h);
  }

  function render() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawDetail();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mask, 0, 0);
  }

  function resize() {
    canvas.width = mask.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = mask.height = Math.round(canvas.clientHeight * dpr);
  }

  function dab(x, y) {
    const r = BRUSH * dpr;
    const g = mctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,.42)');
    g.addColorStop(0.5, 'rgba(0,0,0,.2)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    mctx.fillStyle = g;
    mctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function wipe(clientX, clientY) {
    if (!img) return;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    mctx.globalCompositeOperation = 'source-over';
    mctx.globalAlpha = 1;
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
    render(); // paint immediately, then let the frame loop handle the fade
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // Time-based so it fades at the same pace on throttled / low-fps devices
  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (now - lastWipe >= HEAL_DELAY) {
      if (!healStart) healStart = healPrev = now;
      if (now - healStart >= HEAL_MS) {
        mctx.clearRect(0, 0, mask.width, mask.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      const dt = now - healPrev;
      healPrev = now;
      mctx.globalCompositeOperation = 'destination-out';
      mctx.globalAlpha = 1 - Math.pow(1 - 0.016, dt / 16.7);
      mctx.fillRect(0, 0, mask.width, mask.height);
    }
    render();
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

// PLACEHOLDER BACKGROUND: an out-of-focus New York night, drawn live.
// It stands in until the licensed video is added to content/site.json
// (see README). Once a video is playing, this canvas is stopped.
//
// Rendered at reduced resolution and upscaled; the softness is the point.

const PALETTE = [
  { rgb: [255, 176, 88], w: 30 },   // sodium streetlight
  { rgb: [255, 232, 210], w: 22 },  // warm window / headlight
  { rgb: [255, 64, 72], w: 14 },    // tail light
  { rgb: [255, 112, 150], w: 8 },   // neon
  { rgb: [255, 200, 64], w: 12 },   // taxi
  { rgb: [160, 190, 255], w: 5 },   // cool LED
];
const TOTAL_W = PALETTE.reduce((s, p) => s + p.w, 0);
const pickColor = () => {
  let r = Math.random() * TOTAL_W;
  for (const p of PALETTE) if ((r -= p.w) <= 0) return p.rgb;
  return PALETTE[0].rgb;
};
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;
const rand = (a, b) => a + Math.random() * (b - a);

export function startNightCity(canvas, { still = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const base = document.createElement('canvas');
  const bctx = base.getContext('2d');
  const SCALE = 0.42;
  const FRAME_MS = 1000 / 30;

  let w = 0, h = 0, horizon = 0, unit = 1;
  let lights = [], streaks = [];
  let raf = 0, last = 0, t = 0, nextStreak = 0, running = false;

  function resize() {
    const cw = canvas.clientWidth || innerWidth;
    const ch = canvas.clientHeight || innerHeight;
    w = canvas.width = base.width = Math.max(240, Math.round(cw * SCALE));
    h = canvas.height = base.height = Math.max(200, Math.round(ch * SCALE));
    horizon = h * 0.72;
    unit = Math.max(w, h) / 520;
    paintBase();
    seedLights();
    if (!running) frame(performance.now(), true);
  }

  // Static layer: night sky, distant towers and their windows, wet asphalt.
  function paintBase() {
    const sky = bctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#050509');
    sky.addColorStop(0.45, '#120a14');
    sky.addColorStop(0.72, '#2a1018');
    sky.addColorStop(0.78, '#120609');
    sky.addColorStop(1, '#0a0507');
    bctx.fillStyle = sky;
    bctx.fillRect(0, 0, w, h);

    // City glow along the horizon
    const glow = bctx.createRadialGradient(w * 0.5, horizon, 0, w * 0.5, horizon, w * 0.7);
    glow.addColorStop(0, 'rgba(255,120,90,.22)');
    glow.addColorStop(1, 'rgba(255,120,90,0)');
    bctx.fillStyle = glow;
    bctx.fillRect(0, 0, w, h);

    // Towers, painted on a scratch layer and blurred once (static, so it costs nothing per frame)
    const towers = document.createElement('canvas');
    towers.width = w;
    towers.height = h;
    const tctx = towers.getContext('2d');
    let x = -rand(0, 20) * unit;
    while (x < w) {
      const bw = rand(18, 52) * unit;
      const bh = rand(0.18, 0.55) * h;
      const top = horizon - bh;
      tctx.fillStyle = `rgba(${rand(14, 24) | 0},${rand(8, 12) | 0},${rand(14, 22) | 0},.92)`;
      tctx.fillRect(x, top, bw, bh);
      // Windows
      const step = 4.5 * unit;
      for (let wy = top + step; wy < horizon - step; wy += step) {
        for (let wx = x + step * 0.6; wx < x + bw - step * 0.6; wx += step) {
          if (Math.random() < 0.34) {
            tctx.fillStyle = rgba(Math.random() < 0.8 ? [255, 210, 150] : [190, 210, 255], rand(0.15, 0.6));
            tctx.fillRect(wx, wy, 1.4 * unit, 1.8 * unit);
          }
        }
      }
      x += bw + rand(1, 8) * unit;
    }
    bctx.save();
    bctx.filter = `blur(${(2.2 * unit).toFixed(1)}px)`; // ignored where unsupported; CSS blur still applies
    bctx.drawImage(towers, 0, 0);
    bctx.restore();

    // Street sheen
    const street = bctx.createLinearGradient(0, horizon, 0, h);
    street.addColorStop(0, 'rgba(255,140,110,.10)');
    street.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.fillStyle = street;
    bctx.fillRect(0, horizon, w, h - horizon);
  }

  function seedLights() {
    const n = Math.round(Math.min(120, Math.max(46, (w * h) / 1500)));
    lights = Array.from({ length: n }, () => {
      const depth = Math.random() ** 1.6; // most are far away
      return {
        x: Math.random() * w,
        y: rand(0.16, 0.86) * h,
        r: (3 + depth * 30) * unit,
        c: pickColor(),
        a: rand(0.1, 0.42) * (1 - depth * 0.35),
        tw: Math.random() * Math.PI * 2,
        ts: rand(0.25, 1.1),
        vx: rand(-1, 1) * (0.6 + depth * 2.4) * unit,
      };
    });
  }

  function spawnStreak() {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const kind = Math.random();
    const color = kind < 0.45 ? [255, 196, 60] : kind < 0.8 ? [255, 60, 64] : [255, 236, 214];
    const len = rand(0.22, 0.5) * w;
    streaks.push({
      x: dir > 0 ? -len : w + len,
      y: horizon + rand(0.03, 0.17) * h,
      len,
      dir,
      v: rand(0.14, 0.3) * w,
      th: rand(1.6, 3.6) * unit,
      c: color,
    });
  }

  function disc(x, y, r, c, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a * 0.75));
    g.addColorStop(0.78, rgba(c, a * 0.55));
    g.addColorStop(0.93, rgba(c, a * 0.85)); // bokeh rim
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function frame(now, force = false) {
    if (running) raf = requestAnimationFrame(frame);
    if (!force && now - last < FRAME_MS) return;
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    t += dt;

    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(base, 0, 0);
    ctx.globalCompositeOperation = 'lighter';

    const sway = Math.sin(t * 0.07) * w * 0.012;

    for (const L of lights) {
      L.x += L.vx * dt;
      if (L.x < -L.r) L.x = w + L.r;
      if (L.x > w + L.r) L.x = -L.r;
      const a = L.a * (0.72 + 0.28 * Math.sin(t * L.ts + L.tw));
      const x = L.x + sway;
      disc(x, L.y, L.r, L.c, a);

      // Rain-wet street: long soft reflections under lights near the horizon
      if (L.y > h * 0.48 && L.y < horizon) {
        const ry = horizon + (horizon - L.y) * 0.55;
        ctx.save();
        ctx.translate(x, ry);
        ctx.scale(0.55, 2.6);
        disc(0, 0, L.r, L.c, a * 0.32);
        ctx.restore();
      }
    }

    // Taxi light streaks
    if (!still && t > nextStreak) {
      spawnStreak();
      nextStreak = t + rand(1.4, 4.2);
    }
    streaks = streaks.filter((s) => {
      s.x += s.v * s.dir * dt;
      const head = s.x, tail = s.x - s.len * s.dir;
      const g = ctx.createLinearGradient(tail, 0, head, 0);
      g.addColorStop(0, rgba(s.c, 0));
      g.addColorStop(0.85, rgba(s.c, 0.55));
      g.addColorStop(1, rgba(s.c, 0));
      ctx.fillStyle = g;
      const x0 = Math.min(head, tail);
      ctx.fillRect(x0, s.y - s.th / 2, s.len, s.th);
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x0, s.y - s.th * 2, s.len, s.th * 4); // glow
      ctx.globalAlpha = 0.18;
      ctx.fillRect(x0, s.y + s.th * 3, s.len, s.th * 6); // reflection
      ctx.globalAlpha = 1;
      return s.dir > 0 ? tail < w : tail > 0;
    });
  }

  function onVisibility() {
    if (document.hidden) pause();
    else play();
  }

  function play() {
    if (running || still) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }

  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);
  resize();
  if (still) {
    // A believable still: a couple of streaks frozen mid-pass
    spawnStreak(); spawnStreak();
    streaks.forEach((s) => (s.x = rand(0.3, 0.9) * w * (s.dir > 0 ? 1 : 0.7)));
    frame(performance.now(), true);
  } else {
    play();
  }
  document.addEventListener('visibilitychange', onVisibility);

  return {
    stop() {
      pause();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}

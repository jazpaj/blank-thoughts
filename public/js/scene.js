import { startNightCity } from './night-city.js';

/**
 * Background: licensed video when configured, otherwise the placeholder
 * night scene. Honors prefers-reduced-motion by showing a still.
 */
export function initScene({ canvas, video, reduced }) {
  const placeholder = startNightCity(canvas, { still: reduced });

  return {
    useVideo(config) {
      const isMobile = matchMedia('(max-width: 768px)').matches;
      const set = (isMobile && config?.mobile?.mp4 ? config.mobile : config?.desktop) ?? {};
      const poster = config?.poster;
      if (!set.mp4 && !poster) return; // nothing supplied yet: keep placeholder

      const showVideo = () => {
        video.classList.add('is-playing');
        placeholder.stop();
      };

      if (poster) {
        // The still poster frame appears first (and is all reduced-motion users get).
        const img = new Image();
        img.onload = () => {
          video.poster = poster;
          showVideo();
        };
        img.src = poster;
      }
      if (reduced || !set.mp4) {
        video.removeAttribute('autoplay');
        return;
      }

      for (const [type, src] of [['video/webm', set.webm], ['video/mp4', set.mp4]]) {
        if (!src) continue;
        const s = document.createElement('source');
        s.src = src;
        s.type = type;
        video.append(s);
      }
      video.muted = true; // required for autoplay on iOS
      video.preload = 'auto';
      video.addEventListener('playing', showVideo, { once: true });
      video.load();
      video.play().catch(() => { /* autoplay refused (e.g. Low Power Mode): poster/placeholder stays */ });
      // Browsers pause background video in hidden tabs; make sure it resumes on return
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && video.paused) video.play().catch(() => {});
      });
    },
  };
}

/**
 * Subtle parallax: the city drifts a few pixels against the cursor (or phone
 * tilt) and the card counter-moves, so it seems to float.
 */
export function initParallax({ sceneEl, cardEl, reduced }) {
  if (reduced) return;

  const target = { x: 0, y: 0 };
  const cur = { x: 0, y: 0 };
  let raf = 0;

  const tick = () => {
    cur.x += (target.x - cur.x) * 0.06;
    cur.y += (target.y - cur.y) * 0.06;
    sceneEl.style.transform = `translate3d(${(-cur.x * 16).toFixed(2)}px, ${(-cur.y * 12).toFixed(2)}px, 0)`;
    cardEl.style.transform =
      `perspective(1400px) translate3d(${(cur.x * 5).toFixed(2)}px, ${(cur.y * 4).toFixed(2)}px, 0) ` +
      `rotateY(${(cur.x * 1.4).toFixed(3)}deg) rotateX(${(-cur.y * 1.4).toFixed(3)}deg)`;
    raf = Math.abs(target.x - cur.x) + Math.abs(target.y - cur.y) > 0.0005 ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      target.x = (e.clientX / innerWidth - 0.5) * 2;
      target.y = (e.clientY / innerHeight - 0.5) * 2;
      kick();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => {
      target.x = target.y = 0;
      kick();
    });
  }

  // Phone tilt. iOS gates this behind a permission prompt, which would break
  // the mood, so we only listen where it's freely available (Android).
  if ('DeviceOrientationEvent' in window && typeof DeviceOrientationEvent.requestPermission !== 'function') {
    let baseBeta = null;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null || e.beta == null) return;
      baseBeta ??= e.beta;
      const clamp = (v) => Math.max(-1, Math.min(1, v));
      target.x = clamp(e.gamma / 20);
      target.y = clamp((e.beta - baseBeta) / 20);
      kick();
    }, { passive: true });
  }
}

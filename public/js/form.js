import {
  formatPhone, hasPhone, phoneDigits,
  validateName, validateEmail, validatePhone, validateConsent,
} from './validate.js';

const TRACKING_KEY = 'bt:tracking';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/** UTM + referral code, kept for the session so they survive a reload. */
function captureTracking() {
  let stored = {};
  try { stored = JSON.parse(sessionStorage.getItem(TRACKING_KEY)) ?? {}; } catch { /* private mode */ }

  const params = new URLSearchParams(location.search);
  const fresh = {};
  for (const k of UTM_KEYS) if (params.get(k)) fresh[k] = params.get(k);
  const ref = params.get('ref') ?? params.get('r');
  if (ref) fresh.ref = ref;
  if (document.referrer && !document.referrer.startsWith(location.origin)) fresh.referrer = document.referrer;

  const tracking = Object.keys(fresh).length ? { ...stored, ...fresh } : stored;
  try { sessionStorage.setItem(TRACKING_KEY, JSON.stringify(tracking)); } catch { /* ignore */ }

  // Tidy the address bar once captured, so shared links don't carry them
  if (UTM_KEYS.some((k) => params.has(k)) || params.has('ref')) {
    for (const k of [...UTM_KEYS, 'ref', 'r']) params.delete(k);
    const q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
  }
  return tracking;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = reject;
    document.head.append(s);
  });
}

/** Invisible Cloudflare Turnstile, only when a site key is configured. */
async function setupTurnstile(siteKey, container) {
  if (!siteKey) return null;
  try {
    await loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
  } catch {
    return null;
  }
  container.hidden = false;
  let resolveToken = null;
  const id = window.turnstile.render(container, {
    sitekey: siteKey,
    execution: 'execute',
    appearance: 'interaction-only',
    theme: 'dark',
    callback: (token) => resolveToken?.(token),
    'error-callback': () => resolveToken?.(null),
  });
  return () =>
    new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 15000);
      resolveToken = (t) => {
        clearTimeout(timer);
        resolve(t);
      };
      window.turnstile.reset(id);
      window.turnstile.execute(id);
    });
}

export function initForm({ form, onSuccess, content }) {
  const $ = (sel) => form.querySelector(sel);
  const name = $('#f-name');
  const email = $('#f-email');
  const phone = $('#f-phone');
  const sms = $('#f-sms');
  const company = $('#f-company');
  const consent = $('.consent');
  const consentInner = $('.consent__inner');
  const button = $('.button');
  const label = $('.button__label');
  const formError = $('.form__error');

  const tracking = captureTracking();
  let getTurnstileToken = null;
  content.then((c) => setupTurnstile(c.turnstileSiteKey, $('.turnstile')).then((fn) => (getTurnstileToken = fn)));

  const fields = [
    { input: name, error: $('#e-name'), check: () => validateName(name.value) },
    { input: email, error: $('#e-email'), check: () => validateEmail(email.value) },
    { input: phone, error: $('#e-phone'), check: () => validatePhone(phone.value) },
    { input: sms, error: $('#e-sms'), check: () => validateConsent(phone.value, sms.checked) },
  ];
  const touched = new WeakSet();

  const show = (f, msg) => {
    f.error.textContent = msg ?? '';
    if (msg) f.input.setAttribute('aria-invalid', 'true');
    else f.input.removeAttribute('aria-invalid');
  };
  const check = (f) => {
    const msg = f.check();
    show(f, msg);
    return !msg;
  };

  for (const f of fields) {
    f.input.addEventListener('blur', () => {
      // Don't scold on a field someone tabbed through without typing
      if (f.input.value || touched.has(f.input)) {
        touched.add(f.input);
        if (f.input !== sms) check(f);
      }
    });
    f.input.addEventListener(f.input === sms ? 'change' : 'input', () => {
      formError.textContent = '';
      if (touched.has(f.input) || f.input === sms) check(f);
    });
  }

  // --- Phone: +1 (212) 555-0123, formatted as typed, caret kept in place
  phone.addEventListener('input', () => {
    const raw = phone.value;
    const caret = phone.selectionStart ?? raw.length;
    const atEnd = caret >= raw.length;
    const digitsBefore = phoneDigits(raw.slice(0, caret)).length;
    const next = formatPhone(raw);
    phone.value = next;

    if (!atEnd && document.activeElement === phone) {
      let pos = next.indexOf('(') + 1;
      for (let seen = 0; pos < next.length && seen < digitsBefore; pos++) if (/\d/.test(next[pos])) seen++;
      phone.setSelectionRange(pos, pos);
    }
    setConsentOpen(hasPhone(next));
  });

  function setConsentOpen(open) {
    if (String(open) === consent.dataset.open) return;
    consent.dataset.open = String(open);
    consentInner.inert = !open;
    if (!open) {
      sms.checked = false;
      show(fields[3], null);
    }
  }

  // --- Submit
  let busy = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    formError.textContent = '';

    fields.forEach((f) => touched.add(f.input));
    const invalid = fields.filter((f) => !check(f));
    if (invalid.length) {
      invalid[0].input.focus();
      return;
    }

    if (!(await content).signupsEnabled) {
      formError.textContent = 'This is a preview. Signups open at launch.';
      return;
    }

    busy = true;
    button.setAttribute('aria-busy', 'true');
    label.textContent = 'Saving';

    try {
      const turnstileToken = getTurnstileToken ? await getTurnstileToken() : undefined;
      const res = await fetch('api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.value,
          email: email.value,
          phone: phone.value,
          smsConsent: sms.checked,
          company: company.value,
          tracking,
          turnstileToken,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        onSuccess({ ...data, sms: data.sms ?? false });
        return;
      }
      if (res.status === 422 && data.fields) {
        for (const f of fields) {
          const key = f.input.name;
          if (data.fields[key]) show(f, data.fields[key]);
        }
        fields.find((f) => data.fields[f.input.name])?.input.focus();
      } else {
        formError.textContent = data.error ?? 'Something went quiet on our end. Please try again.';
      }
    } catch {
      formError.textContent = 'We couldn’t reach the page just now. Check your connection and try again.';
    } finally {
      busy = false;
      button.removeAttribute('aria-busy');
      label.textContent = 'Enter Blank Thoughts';
    }
  });
}

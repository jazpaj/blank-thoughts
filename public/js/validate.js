// Shared by the browser form and the server so both apply identical rules.

export const LIMITS = { name: 80, email: 254 };

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
// NANP: area code and exchange can't start with 0 or 1.
const US_PHONE_RE = /^[2-9]\d{2}[2-9]\d{6}$/;

export const MESSAGES = {
  nameRequired: 'Your name, please.',
  emailRequired: 'We need an email to reach you.',
  emailInvalid: 'That email doesn’t look quite right.',
  phoneInvalid: 'Please enter a full US number.',
  consentRequired: 'Tick the box to receive texts, or leave the number blank.',
};

/** Ten national digits, ignoring a typed "+1" / leading 1 country code. */
export function phoneDigits(value) {
  let raw = String(value ?? '').trim().replace(/^\+\s*1/, '');
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('1')) d = d.slice(1);
  return d.slice(0, 10);
}

/** Progressive display format: +1 (212) 555-0123 */
export function formatPhone(value) {
  const d = phoneDigits(value);
  if (!d) return '';
  let out = '+1 (' + d.slice(0, 3);
  if (d.length > 3) out += ') ' + d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6);
  return out;
}

export function toE164(value) {
  const d = phoneDigits(value);
  return US_PHONE_RE.test(d) ? '+1' + d : null;
}

export function validateName(value) {
  const v = String(value ?? '').trim();
  return v ? null : MESSAGES.nameRequired;
}

export function validateEmail(value) {
  const v = String(value ?? '').trim();
  if (!v) return MESSAGES.emailRequired;
  if (v.length > LIMITS.email || !EMAIL_RE.test(v)) return MESSAGES.emailInvalid;
  return null;
}

export function hasPhone(value) {
  return phoneDigits(value).length > 0;
}

export function validatePhone(value) {
  if (!hasPhone(value)) return null;
  return toE164(value) ? null : MESSAGES.phoneInvalid;
}

export function validateConsent(phone, consent) {
  if (!hasPhone(phone)) return null;
  return consent === true ? null : MESSAGES.consentRequired;
}

/**
 * @returns {{ ok: boolean, errors: Record<string,string>, values: {name:string,email:string,phone:string|null,smsConsent:boolean} }}
 */
export function validateSignup(input = {}) {
  const errors = {};
  const checks = {
    name: validateName(input.name),
    email: validateEmail(input.email),
    phone: validatePhone(input.phone),
    smsConsent: validateConsent(input.phone, input.smsConsent),
  };
  for (const [k, msg] of Object.entries(checks)) if (msg) errors[k] = msg;

  const phone = hasPhone(input.phone) ? toE164(input.phone) : null;
  return {
    ok: Object.keys(errors).length === 0,
    errors,
    values: {
      name: String(input.name ?? '').trim().replace(/\s+/g, ' ').slice(0, LIMITS.name),
      email: String(input.email ?? '').trim().toLowerCase(),
      phone,
      smsConsent: Boolean(phone && input.smsConsent === true),
    },
  };
}

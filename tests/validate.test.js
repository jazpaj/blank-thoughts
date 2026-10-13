import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPhone, phoneDigits, toE164, validateSignup, MESSAGES } from '../public/js/validate.js';

test('phone formats progressively as typed', () => {
  assert.equal(formatPhone('2'), '+1 (2');
  assert.equal(formatPhone('212'), '+1 (212');
  assert.equal(formatPhone('2125'), '+1 (212) 5');
  assert.equal(formatPhone('2125550123'), '+1 (212) 555-0123');
  assert.equal(formatPhone(''), '');
});

test('country code is recognised however it is typed', () => {
  for (const v of ['+1 212 555 0123', '12125550123', '1-212-555-0123', '(212) 555-0123', '+1 (212) 555-0123']) {
    assert.equal(toE164(v), '+12125550123', v);
  }
  assert.equal(phoneDigits('+1 (212'), '212'); // re-formatting is stable
  assert.equal(formatPhone(formatPhone('2125550123')), '+1 (212) 555-0123');
});

test('invalid US numbers are rejected', () => {
  assert.equal(toE164('212555'), null);
  assert.equal(toE164('0125550123'), null); // area code can't start with 0/1
  assert.equal(toE164('2121550123'), null); // exchange can't start with 1
});

test('name and email are required, phone optional', () => {
  const r = validateSignup({ name: '  ', email: 'nope' });
  assert.equal(r.errors.name, MESSAGES.nameRequired);
  assert.equal(r.errors.email, MESSAGES.emailInvalid);
  assert.equal(validateSignup({ name: 'A', email: '' }).errors.email, MESSAGES.emailRequired);
  assert.ok(validateSignup({ name: 'A', email: 'a@b.co' }).ok);
});

test('SMS consent is required only when a phone number is entered', () => {
  assert.equal(
    validateSignup({ name: 'A', email: 'a@b.co', phone: '2125550123', smsConsent: false }).errors.smsConsent,
    MESSAGES.consentRequired,
  );
  const ok = validateSignup({ name: 'A', email: 'a@b.co', phone: '2125550123', smsConsent: true });
  assert.ok(ok.ok);
  assert.deepEqual([ok.values.phone, ok.values.smsConsent], ['+12125550123', true]);
  // Consent without a number is not recorded as SMS consent
  const noPhone = validateSignup({ name: 'A', email: 'a@b.co', smsConsent: true });
  assert.ok(noPhone.ok);
  assert.equal(noPhone.values.smsConsent, false);
});

test('values are normalised', () => {
  const { values } = validateSignup({ name: '  Ava   Rose ', email: ' AVA@Example.COM ' });
  assert.equal(values.name, 'Ava Rose');
  assert.equal(values.email, 'ava@example.com');
});

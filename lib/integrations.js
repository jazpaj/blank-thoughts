// Optional third-party integrations. Each one is inert until its env vars are
// set, so the site works locally without credentials. Neither has been run
// against a live account yet: see README "Before launch".

const KLAVIYO_API = 'https://a.klaviyo.com/api';
const KLAVIYO_REVISION = '2024-10-15';

export const klaviyoEnabled = () =>
  Boolean(process.env.KLAVIYO_PRIVATE_KEY && process.env.KLAVIYO_LIST_ID);

async function klaviyo(pathname, body) {
  const res = await fetch(KLAVIYO_API + pathname, {
    method: 'POST',
    headers: {
      Authorization: `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
      revision: KLAVIYO_REVISION,
      accept: 'application/vnd.api+json',
      'content-type': 'application/vnd.api+json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Klaviyo ${pathname} ${res.status}: ${await res.text()}`);
}

/**
 * Upserts the profile (name, waitlist number, UTM data) and subscribes it to
 * the waitlist list. The welcome email and the cryptic welcome text are sent
 * by a Klaviyo flow triggered by "Added to list" (copy in content/site.json).
 */
export async function syncToKlaviyo(record) {
  const { email, phone, smsConsent, name, position, tracking = {} } = record;

  await klaviyo('/profile-import', {
    data: {
      type: 'profile',
      attributes: {
        email,
        ...(phone && { phone_number: phone }),
        first_name: name,
        properties: { waitlist_number: position, signup_source: 'coming-soon', ...tracking },
      },
    },
  });

  const subscriptions = { email: { marketing: { consent: 'SUBSCRIBED' } } };
  if (phone && smsConsent) subscriptions.sms = { marketing: { consent: 'SUBSCRIBED' } };

  await klaviyo('/profile-subscription-bulk-create-jobs', {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: 'Coming Soon page',
        profiles: {
          data: [{
            type: 'profile',
            attributes: { email, ...(phone && smsConsent && { phone_number: phone }), subscriptions },
          }],
        },
      },
      relationships: { list: { data: { type: 'list', id: process.env.KLAVIYO_LIST_ID } } },
    },
  });
}

export const turnstileEnabled = () =>
  Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);

export async function verifyTurnstile(token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(8_000),
  });
  const data = await res.json().catch(() => ({}));
  return data.success === true;
}

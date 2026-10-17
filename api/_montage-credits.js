// Shotstack refuses (or fails) renders once the account runs out of credits —
// there's no auto top-up, rendering just pauses. Spot that case so creators
// get a friendly message instead of Shotstack's billing text, and send one
// unmistakable alert so someone tops up quickly.
//
// Underscore-prefixed so Vercel treats it as a helper module, not a route.
import { Sentry } from './_sentry.js';

// e.g. "Your render request could not be processed because it exceeds one or
// more plan limits. '1.13' credits required, you have '0.17' credits left."
export function isOutOfCredits(msg) {
  return /credits?\b.*\b(required|left|remaining|insufficient)|plan limits?|insufficient credit|out of credits/i.test(String(msg || ''));
}

export async function alertOutOfCredits(detail, renderId) {
  Sentry.captureMessage('Shotstack OUT OF CREDITS: montage renders are paused until credits are added (dashboard.shotstack.io)', {
    level: 'fatal',
    tags: { montage: 'out_of_credits' },
    fingerprint: ['shotstack-out-of-credits'],
    extra: { detail: String(detail || '').slice(0, 300), renderId: renderId || null },
  });
  await Sentry.flush(2000);
}

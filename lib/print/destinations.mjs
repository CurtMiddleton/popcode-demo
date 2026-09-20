/* Where Popcode will and won't ship, and why.
 *
 * Prodigi decides per-SKU *coverage* at quote time. This file decides
 * something different: which destinations Popcode is willing to SELL into at
 * all. Two reasons, and they are not the same kind of reason, so they are kept
 * apart and each carries its own message.
 *
 *   'sanctions' — US law. Not a business judgement and not negotiable here.
 *   'vat'       — a tax registration we have not made yet. Purely a business
 *                 decision, reversible the day the registration exists.
 *
 * THIS FILE IS THE AUTHORITY. public/countries.js mirrors the code list so the
 * dropdown doesn't offer something checkout will refuse, and
 * scripts/check-destinations.mjs fails if the two drift apart. A client that
 * skips the dropdown still hits this on the way to payment.
 */

/* ── Sanctions ──────────────────────────────────────────────────────────────
 * OFAC maintains comprehensive embargoes on Cuba, Iran, North Korea and Syria:
 * a US person may not export goods there without a licence. Russia and Belarus
 * are targeted rather than comprehensive, but the payment and carrier routes
 * are gone in practice, so they are treated the same way.
 *
 * Afghanistan is a judgement call, not a legal requirement. Ordinary consumer
 * goods are broadly permitted under general licences, but the Taliban is the
 * de facto government and an SDN. Expected order volume is zero and the
 * diligence burden is not, so it is off the list.
 *
 * NOT excluded, deliberately: Venezuela, Myanmar, Sudan, Somalia, Haiti, Libya,
 * Iraq, Nicaragua, Zimbabwe, Lebanon. Those are TARGETED programmes — they
 * restrict named individuals and entities, not retail shipping to ordinary
 * people. Excluding a whole country over a targeted programme turns away
 * legitimate customers for no compliance benefit. */
const SANCTIONED = ['CU', 'IR', 'KP', 'SY', 'RU', 'BY', 'AF'];

/* ── VAT registrations we don't have ────────────────────────────────────────
 * The UK and the EU are the only places where selling a single print creates a
 * tax registration obligation on day one. Everywhere else has a threshold
 * measured in tens of thousands (Australia A$75k, Canada C$30k, New Zealand
 * NZ$60k, Japan ¥10M, Switzerland CHF 100k, Norway NOK 50k), which is years of
 * runway at current volume.
 *
 * UK — zero threshold under BOTH fulfilment models, which is what makes this
 * the clearest case:
 *   · goods printed in the UK (Prodigi routes to its nearest lab) make Popcode
 *     a non-established taxable person, and HMRC applies NO registration
 *     threshold to an NETP — the £90k figure is for UK-established businesses;
 *   · goods shipped in from outside in a consignment of £135 or less and sold
 *     direct to a consumer (not via a marketplace) require the overseas seller
 *     to register and charge UK VAT at the point of sale.
 * Most of the catalogue is under £135, so there is no version of this where a
 * UK sale is free of a registration. Isle of Man is inside the UK VAT
 * territory and goes with it.
 *
 * EU — the €10,000 distance-selling threshold and the Union OSS are for
 * EU-ESTABLISHED sellers. A non-EU seller making a domestic supply inside a
 * member state (which is what local printing produces) registers there from the
 * first sale, and OSS does not cover domestic supplies. Spain's threshold for
 * non-residents is €0.
 *
 * TO RE-ENABLE: register (or appoint an agent), then delete the relevant codes
 * from this list and from public/countries.js. Nothing else in the checkout
 * needs to change — Stripe Tax already calculates VAT for these countries and
 * will start charging it as soon as the registration exists in the dashboard.
 *
 * Deliberately still offered: Gibraltar, Guernsey, Jersey, Åland, Faroe,
 * Greenland and the French overseas departments sit OUTSIDE the UK/EU VAT
 * territories despite their geography. */
const EU_27 = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
];
const VAT_BLOCKED = ['GB', 'IM', ...EU_27];

/* ── Occupied regions of Ukraine ────────────────────────────────────────────
 * Crimea has been comprehensively sanctioned since E.O. 13685; E.O. 14065
 * extended the same treatment to the so-called DNR and LNR. Ukraine has no
 * separate ISO code for any of them, so a country-level filter cannot see
 * them — an address in Sevastopol reads as 'UA' and sails through.
 *
 * OFAC's covered regions are the DNR/LNR AREAS, not the whole Donetsk and
 * Luhansk oblasts, and the boundary is a military line rather than a postal
 * one. So this over-blocks: it refuses both oblasts entirely. Under-blocking is
 * a sanctions problem; over-blocking costs us orders we could not have
 * delivered into a war zone anyway. That trade is deliberate.
 *
 * Kherson and Zaporizhzhia are NOT US-sanctioned and are NOT blocked.
 *
 * Ukrainian postal codes are five digits whose first two identify the region:
 *   83–87  Donetsk oblast      91–94  Luhansk oblast
 *   95–98  Crimea              99     Sevastopol */
const UA_BLOCKED_PREFIXES = [
  [83, 87, 'Donetsk oblast'],
  [91, 94, 'Luhansk oblast'],
  [95, 98, 'Crimea'],
  [99, 99, 'Sevastopol'],
];

const RESTRICTED = new Map();
for (const c of SANCTIONED) RESTRICTED.set(c, 'sanctions');
for (const c of VAT_BLOCKED) RESTRICTED.set(c, 'vat');

export const RESTRICTED_CODES = Object.freeze(Object.fromEntries(RESTRICTED));

/* Customer-facing copy. Never names a sanctions programme or a tax position —
 * the customer cannot act on either, and both invite an argument. It says we
 * don't ship there and points at a human. */
const MESSAGE = {
  sanctions: 'We’re not able to ship to this country.',
  vat: 'We can’t ship to this country yet — we’re working on it. Email info@popcodeapp.com and we’ll let you know when we can.',
  region: 'We’re not able to ship to this address.',
};

function code(v) { return String(v || '').trim().toUpperCase(); }

/* Returns null when the destination is fine, or { reason, message } when it
 * isn't. `postalCode` is optional — without it, country-level rules still
 * apply and only the Ukraine region check is skipped. */
export function destinationRestriction(countryCode, postalCode) {
  const cc = code(countryCode);
  if (!cc) return null;

  const reason = RESTRICTED.get(cc);
  if (reason) return { reason, message: MESSAGE[reason] };

  if (cc === 'UA') {
    // First two digits of the five-digit index. Anything that isn't a plain
    // 5-digit code is left alone rather than guessed at.
    const digits = String(postalCode || '').replace(/\D/g, '');
    if (digits.length === 5) {
      const region = Number(digits.slice(0, 2));
      for (const [lo, hi] of UA_BLOCKED_PREFIXES) {
        if (region >= lo && region <= hi) return { reason: 'region', message: MESSAGE.region };
      }
    }
  }

  return null;
}

/* Convenience for callers that only want a yes/no. */
export function isDestinationAllowed(countryCode, postalCode) {
  return destinationRestriction(countryCode, postalCode) === null;
}

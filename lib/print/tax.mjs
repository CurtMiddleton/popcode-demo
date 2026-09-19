/* Stripe Tax — turning a Prodigi-shaped recipient address into a calculated
   sales-tax amount, so the cart can show a real Tax row instead of deferring to
   Stripe's own checkout page.

   Two rules hold everywhere in here:

   1. TAX NEVER BREAKS A QUOTE. Every entry point returns null on any failure —
      a missing key, a malformed address, a Stripe outage, an unregistered
      jurisdiction. The caller shows no Tax row and says tax is calculated at
      checkout, which is true and is what the page said before any of this
      existed. A checkout that cannot price itself is a far worse failure than
      one that cannot itemise its tax.

   2. STRIPE IS THE ONLY SOURCE OF A TAX NUMBER. Nothing here estimates, applies
      a rate, or falls back to a percentage. Stripe charges tax only where
      there is an active registration, so an address outside those jurisdictions
      correctly calculates to zero — that is an answer, not a failure.

   The amounts passed in are what the customer is charged before tax: printing
   (goods, marked up) and shipping (carrier cost, passed through). Both are sent
   as tax_behavior 'exclusive' — tax is added on top, which is how US sales tax
   is presented and what the cart's Total reflects. */

// Prodigi's address shape is line1/townOrCity/stateOrCounty/postalOrZipCode/
// countryCode; Stripe wants line1/city/state/postal_code/country. Blank fields
// are dropped rather than sent empty — the same reason cleanRecipient exists.
export function toStripeAddress(a) {
  if (!a) return null;
  const out = {
    line1: str(a.line1),
    line2: str(a.line2),
    city: str(a.townOrCity),
    state: str(a.stateOrCounty),
    postal_code: str(a.postalOrZipCode),
    country: str(a.countryCode).toUpperCase(),
  };
  for (const k of Object.keys(out)) if (!out[k]) delete out[k];
  return out;
}

function str(v) { return typeof v === 'string' ? v.trim() : ''; }

/* Enough of an address for Stripe to place it in a jurisdiction. Country alone
   is not: US sales tax is state and often city level, so a country-only guess
   would be wrong far more often than right. Postal code plus country is the
   minimum Stripe can reliably resolve. */
export function canCalculateTax(address) {
  const a = toStripeAddress(address);
  return !!(a && a.country && (a.postal_code || a.state));
}

/* Returns { taxMinor, totalMinor } or null. Never throws. */
export async function calculateTaxMinor({
  stripe, currency, printingMinor, shippingMinor, address, taxCode,
}) {
  if (!stripe || !canCalculateTax(address)) return null;
  const printing = Math.max(0, Math.round(printingMinor || 0));
  const shipping = Math.max(0, Math.round(shippingMinor || 0));
  if (printing <= 0 && shipping <= 0) return null;

  try {
    const calc = await stripe.tax.calculations.create({
      currency: String(currency || 'USD').toLowerCase(),
      line_items: [{
        amount: printing,
        reference: 'popcode-printing',
        tax_behavior: 'exclusive',
        ...(taxCode ? { tax_code: taxCode } : {}),
      }],
      ...(shipping > 0
        ? { shipping_cost: { amount: shipping, tax_behavior: 'exclusive' } }
        : {}),
      customer_details: {
        address: toStripeAddress(address),
        address_source: 'shipping',
      },
      expand: [],
    });

    const taxMinor = Number(calc?.tax_amount_exclusive);
    if (!Number.isFinite(taxMinor) || taxMinor < 0) return null;
    return { taxMinor, totalMinor: printing + shipping + taxMinor };
  } catch (err) {
    /* Swallowed on purpose — see rule 1. The caller logs it if it wants to;
       what it must not do is fail the quote. */
    return { error: err };
  }
}

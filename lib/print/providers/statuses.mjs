/* Which quote failures mean "this cannot be fulfilled" rather than "something is
   wrong at our end".

   An unservable error is treated as deterministic: the caller stops retrying and
   tells the customer we can't ship that item to that address. So this set must
   contain only statuses that genuinely say something about the ROUTE — a
   malformed request, an unknown SKU, a rejected SKU/destination pairing.

   It must NOT contain 401/403, which are our own credentials, nor 429, which is
   a rate limit that clears. Both providers classified every 4xx as unservable
   until 2026-09-20, which meant a revoked or rotated API key would have shown
   every customer "we can't ship this to your country" — a total outage wearing
   the costume of a product limitation, with retries skipped and nothing raised
   because the condition read as expected behaviour.

   Shared rather than copied per provider: the two copies had already drifted in
   their reasoning, and this is exactly the kind of rule that gets fixed in one
   place and left wrong in the other. */
export const UNSERVABLE_STATUSES = new Set([400, 404, 409, 422]);

/* How long to wait before retrying a failed quote. Both quote loops
   (api/prodigi-quote.js, lib/print/cart.mjs quoteCart) used to retry at once,
   which turns a rate limit into three times the requests: Prodigi allows 30
   quotes per 30 s, and one burst of 23 on 2026-10-20 became a wall of 429s
   (POPCODE-WEB-K). A 429 waits for the provider's Retry-After when it sends
   one, else 1 s then 2 s; anything else (an empty quote, a 5xx blip) gets a
   short 250 ms then 500 ms. Capped at 5 s so a quote request stays well inside
   the function timeout. */
export function quoteRetryDelayMs(err, attempt) {
  if (err && err.prodigiStatus === 429) {
    return Math.min(err.retryAfterMs || 1000 * 2 ** attempt, 5000);
  }
  return 250 * 2 ** attempt;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

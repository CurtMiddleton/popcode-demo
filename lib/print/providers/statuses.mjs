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

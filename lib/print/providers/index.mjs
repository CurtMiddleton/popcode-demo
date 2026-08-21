// Fulfillment-provider registry. Maps a provider name (from catalog.providerFor()
// for quotes, or the print_orders.provider column for order submission) to its
// adapter. Each adapter implements quote() + submitOrder() (+ isConfigured()).
//
// Phase 1 ships only Prodigi; a Printify adapter (6×6 board book + merch) slots in
// here as a second entry with no route changes — see docs/board-book-printify-plan.md.

import * as prodigi from './prodigi.mjs';
import * as printify from './printify.mjs';

const REGISTRY = { prodigi, printify };

export function getProvider(providerName) {
  const p = REGISTRY[providerName];
  if (!p) throw new Error(`Unknown fulfillment provider: ${providerName}`);
  return p;
}

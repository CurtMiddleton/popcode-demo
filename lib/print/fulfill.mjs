// Submit the paid print orders for one Stripe Checkout session.
//
// A checkout can now produce SEVERAL print_orders rows — one per fulfillment
// provider — sharing an order_group_id. Both the success page
// (api/finalize-order.js) and the Stripe webhook (api/stripe-webhook.js) run this
// same routine, so a cart order can never be half-submitted by whichever fires
// first, and the logic can't drift between the two.
//
// Every row is claimed atomically before submission: the two callers race by
// design, and without the claim both could clear the idempotency check and place
// the vendor order twice (double print + double charge — merchantReference is NOT
// a vendor-side uniqueness guarantee). Only the caller that flips
// pending/paid -> submitting proceeds.

const ALREADY_HANDLED = new Set(['submitted', 'in_production', 'shipped', 'complete', 'prodigi_failed']);

// Is there nothing left to collect on this Stripe session?
//
// 'paid' is the ordinary case. 'no_payment_required' is what Stripe returns when
// the total comes to ZERO — which is exactly what a 100%-off promotion code (a
// comp or a test order) produces. Treating that as unpaid meant a comped order
// was never submitted to the printer, and the webhook actively marked it
// payment_failed. A genuinely failed payment is 'unpaid', which is still refused.
export function isSessionSettled(session) {
  return session && (session.payment_status === 'paid' || session.payment_status === 'no_payment_required');
}

const now = () => new Date().toISOString();

// Load every print_orders row belonging to a Stripe session. Falls back to the
// session's print_order_id metadata for a row whose stripe_session_id write
// didn't land.
export async function loadOrdersForSession(admin, sessionId, fallbackOrderId = null) {
  const { data: rows } = await admin.from('print_orders').select('*').eq('stripe_session_id', sessionId);
  if (rows && rows.length) return rows;
  if (fallbackOrderId) {
    const { data: one } = await admin.from('print_orders').select('*').eq('id', fallbackOrderId).maybeSingle();
    if (one) return [one];
  }
  return [];
}

// Submit one already-loaded order row. Returns a per-order summary; never throws
// for a vendor rejection (that's recorded as prodigi_failed and reported).
export async function fulfillOrder({ admin, order, amountTotalMinor = null, onError = null }) {
  if (order.prodigi_order_id || ALREADY_HANDLED.has(order.status)) {
    return { id: order.id, status: order.status, prodigi_order_id: order.prodigi_order_id, idempotent: true };
  }

  const claim = { status: 'submitting', updated_at: now() };
  // Only reconcile the charged amount against Stripe when this session bought a
  // single order — with several rows the session total covers all of them and
  // each row already carries its own share.
  if (amountTotalMinor != null) claim.total_charged_minor = amountTotalMinor;

  const { data: claimed } = await admin.from('print_orders')
    .update(claim)
    .eq('id', order.id)
    .is('prodigi_order_id', null)
    .in('status', ['pending', 'paid'])
    .select();
  if (!claimed || claimed.length === 0) {
    const { data: cur } = await admin.from('print_orders').select('status, prodigi_order_id').eq('id', order.id).maybeSingle();
    return { id: order.id, status: cur?.status, prodigi_order_id: cur?.prodigi_order_id, idempotent: true };
  }

  const { getProvider } = await import('./providers/index.mjs');
  const provider = getProvider(order.provider || 'prodigi');
  const result = await provider.submitOrder({ order: claimed[0] });

  if (!result.ok) {
    await admin.from('print_orders')
      .update({ status: 'prodigi_failed', prodigi_response: result.response, updated_at: now() })
      .eq('id', order.id);
    if (onError) onError(new Error(result.error || `Order submission failed for ${order.id}`), result);
    return { id: order.id, status: 'prodigi_failed', error: result.error };
  }

  await admin.from('print_orders')
    .update({ status: 'submitted', prodigi_order_id: result.providerOrderId, prodigi_response: result.response, updated_at: now() })
    .eq('id', order.id);
  return { id: order.id, status: 'submitted', prodigi_order_id: result.providerOrderId, ...(result.dryRun ? { dryRun: true } : {}) };
}

// Submit every order for a session. One failing vendor never blocks the others —
// each row's outcome is recorded independently.
export async function fulfillSession({ admin, orders, amountTotalMinor = null, onError = null }) {
  const results = [];
  for (const order of orders) {
    results.push(await fulfillOrder({
      admin,
      order,
      // Reconcile against Stripe only for a single-order session (see above).
      amountTotalMinor: orders.length === 1 ? amountTotalMinor : null,
      onError,
    }));
  }
  return results;
}

export { ALREADY_HANDLED };

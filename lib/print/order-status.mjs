// Prodigi's order object → our `print_orders` columns.
//
// Pure and network-free on purpose: every rule here is a judgement about what a
// customer should be told, and those are worth testing directly rather than
// through a live order.
//
// Prodigi's vocabulary (their docs, 2026-09-21):
//   status.stage    InProgress | Complete | Cancelled
//   status.details  downloadAssets, printReadyAssetsPrepared,
//                   allocateProductionLocation, inProduction, shipping
//                   — each NotStarted | InProgress | Complete
//   status.issues   [{ objectId, errorCode, description, authorisationDetails? }]
//   shipments       [{ status, carrier, dispatchDate, tracking, fulfillmentLocation, items }]

/* Our own vocabulary, unchanged — api/update-print-order.js already allows all
   of these and analytics.html's PAID_PLUS already counts them as revenue. */
export const TRACKED_STATUSES = new Set([
  'submitted', 'in_production', 'shipped', 'complete', 'cancelled',
]);

const done = (v) => String(v || '').toLowerCase() === 'complete';
const started = (v) => {
  const s = String(v || '').toLowerCase();
  return s === 'inprogress' || s === 'complete';
};

/* Prodigi's stage plus its detail breakdown → the one word we show.

   `stage` alone is too coarse: it stays "InProgress" from the moment an order
   is accepted until the last parcel leaves, which is the entire time a customer
   actually wants to know something. The details are what distinguish "we are
   printing it" from "it is on its way", so they decide, and stage only settles
   the two endpoints. */
export function mapProdigiStatus(order) {
  const stage = String(order?.status?.stage || '').toLowerCase();
  if (stage === 'cancelled') return 'cancelled';
  if (stage === 'complete') return 'complete';

  const d = order?.status?.details || {};
  const shipments = Array.isArray(order?.shipments) ? order.shipments : [];

  /* Any parcel actually dispatched outranks the details, because a shipment
     record is a physical fact and `details.shipping` is a process step. A
     partially shipped order reads as "shipped" — the per-parcel rows below are
     what tell the customer the rest is still coming. */
  if (shipments.some((s) => String(s?.status || '').toLowerCase() === 'shipped')) return 'shipped';
  if (done(d.shipping)) return 'shipped';
  if (started(d.inProduction)) return 'in_production';

  // Assets downloading, lab being allocated: real work, but nothing a customer
  // would call progress. Leave it where checkout put it.
  return 'submitted';
}

/* Parcels, one row each. Flat and already-formatted, so the order page renders
   it without knowing anything about Prodigi. */
export function normalizeShipments(order) {
  const list = Array.isArray(order?.shipments) ? order.shipments : [];
  return list.map((s, i) => ({
    id: s?.id || null,
    index: i,
    status: String(s?.status || 'Processing'),
    carrier: carrierName(s?.carrier),
    tracking_url: s?.tracking?.url || null,
    tracking_number: s?.tracking?.number || null,
    dispatched_at: s?.dispatchDate || null,
    lab: s?.fulfillmentLocation?.labCode || null,
    country: s?.fulfillmentLocation?.countryCode || null,
    item_ids: Array.isArray(s?.items)
      ? s.items.map((it) => it?.itemId).filter(Boolean)
      : [],
  }));
}

/* Same shape Prodigi uses for a quote's carrier, and the same rule: only
   `postcard` and `flyer`-style single words are plain, and a service that
   already repeats the carrier name should not say it twice. */
function carrierName(c) {
  if (!c) return null;
  if (typeof c === 'string') return c.trim() || null;
  const name = String(c.name ?? c.Name ?? '').trim();
  const service = String(c.service ?? c.Service ?? '').trim();
  if (!service) return name || null;
  if (!name || service.toLowerCase().startsWith(name.toLowerCase())) return service;
  return `${name} ${service}`;
}

/* The first tracking URL, for the existing `tracking_url` column and the admin
   panel that has always read it. A split order has more than one, so this is a
   convenience, never the whole picture — `shipments` is. */
export function primaryTrackingUrl(shipments) {
  const hit = (shipments || []).find((s) => s.tracking_url);
  return hit ? hit.tracking_url : null;
}

/* Issues worth a human looking at. Prodigi reports transient asset-download
   retries as issues too, so those are filtered out: a warning that resolves
   itself is noise in an admin queue and alarming on a customer's order page.

   RequiresPaymentAuthorisation is the one that genuinely stalls an order —
   Prodigi is waiting on us to pay, and nothing moves until someone does. */
export function summarizeIssues(order) {
  const issues = Array.isArray(order?.status?.issues) ? order.status.issues : [];
  return issues
    .filter((x) => !/notdownloaded/i.test(String(x?.errorCode || '')))
    .map((x) => ({
      code: x?.errorCode || null,
      object_id: x?.objectId || null,
      description: x?.description || null,
      authorisation_url: x?.authorisationDetails?.authorisationUrl || null,
    }));
}

/* Everything the callback and any future poll both need, in one place so the
   two can never disagree about what an order means. */
export function buildOrderPatch(order) {
  const shipments = normalizeShipments(order);
  const issues = summarizeIssues(order);
  return {
    status: mapProdigiStatus(order),
    shipments,
    tracking_url: primaryTrackingUrl(shipments),
    provider_status: {
      stage: order?.status?.stage || null,
      details: order?.status?.details || null,
      issues,
      fetched_at: new Date().toISOString(),
    },
    tracked_at: new Date().toISOString(),
  };
}

/* Prodigi order ids are `ord_` + alphanumerics. Anything else is never looked
   up — api/prodigi-callback.js is a public unsigned endpoint, so this is the
   only thing it takes from the body. */
const ORDER_ID = /^ord_[A-Za-z0-9]{1,40}$/;

/* The order id, from wherever the CloudEvent carries it. `subject` is the
   documented place; `data.order.id` is the same value one level in. Both are
   untrusted: this decides only WHICH order we go and ask Prodigi about, never
   what is stored. */
export function orderIdFromEvent(body) {
  for (const c of [body?.subject, body?.data?.order?.id, body?.data?.id, body?.orderId]) {
    const v = typeof c === 'string' ? c.trim() : '';
    if (ORDER_ID.test(v)) return v;
  }
  return null;
}

/* Order of the lifecycle, for the monotonic guard below. Anything not listed
   (pending, payment_failed, prodigi_failed, …) is off this ladder and is never
   overwritten by a callback — those are OUR states, not Prodigi's. */
const RANK = { submitted: 1, in_production: 2, shipped: 3, complete: 4 };

/* Never walk an order backwards. Callbacks can arrive late or out of order, and
   a stale "in production" landing after "shipped" would un-ship a parcel the
   customer can already track. */
export function shouldAdvance(current, next) {
  if (!next || next === current) return false;
  // Prodigi cancelling an order is authoritative at any point.
  if (next === 'cancelled') return true;
  if (current === 'cancelled') return false;
  const from = RANK[current];
  const to = RANK[next];
  /* `submitting`/`paid` are mid-checkout; a callback means Prodigi has the
     order, so joining the ladder is correct. Any other unranked state is one of
     ours and is left alone. */
  if (from === undefined) return current === 'submitting' || current === 'paid';
  return to !== undefined && to > from;
}

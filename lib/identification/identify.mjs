// identifyByHandle — the core of Phase 2, shared by the HTTP endpoint
// (api/identify.js) and the CLI test harness (scripts/test-identify.mjs).
//
// Flow:
//   1. handle -> creator_id (the privacy scope).
//   2. ReplicateClipProvider.identify(creator_id, frame): embed + scoped
//      pgvector cosine search, thresholded.
//   3. Build the scan-time payload: the matched collection's .mind URL (by
//      convention in the pop-targets bucket) + the collection's images.

import { ReplicateClipProvider } from './provider.mjs';

const BUCKET = 'pop-targets';

/**
 * @param {object} db Supabase client (service role).
 * @param {string} handle creator handle from the URL.
 * @param {{imageUrl?: string, embedding?: number[]}} frame URL/data-URI to embed, or a precomputed vector.
 * @param {{threshold?: number, supabaseUrl: string}} opts supabaseUrl is the project base URL (for the public .mind URL).
 * @returns {Promise<object>} matched/false payload (see brief §4).
 */
export async function identifyByHandle(db, handle, frame, { threshold, supabaseUrl } = {}) {
  if (!handle) throw new Error('identifyByHandle: handle is required.');
  if (!frame || (!frame.imageUrl && !frame.embedding)) {
    throw new Error('identifyByHandle: frame.imageUrl or frame.embedding is required.');
  }

  // 1. Resolve the creator (case-insensitive handle).
  const { data: creator, error: cErr } = await db
    .from('creators').select('id').ilike('handle', handle).maybeSingle();
  if (cErr) throw new Error('creator lookup failed: ' + cErr.message);
  if (!creator) return { matched: false, reason: 'unknown_handle' };

  // 2. Scoped search — get the top candidates so we can log the full picture.
  const provider = new ReplicateClipProvider(db, threshold != null ? { threshold } : {});
  const candidates = await provider.search(creator.id, frame, 3);
  const top = candidates[0];
  const runnerUp = candidates[1];
  const matched = !!(top && top.confidence >= provider.threshold);
  const reason = matched ? 'matched' : (top ? 'low_confidence' : 'no_candidates');

  // 3. Shadow/analytics log (Phase 4): one row per identify, with scores so the
  //    threshold can be tuned from real data. Best-effort — never block identify.
  let eventId = null;
  try {
    const { data: ev } = await db.from('identify_events').insert({
      creator_id: creator.id,
      handle,
      matched_by: 'new',
      reason,
      matched_image: matched ? top.imageId : null,
      collection_id: matched ? top.collectionId : null,
      matched_target_ref: top ? top.targetRef : null,
      confidence: top ? top.confidence : null,
      runner_up_confidence: runnerUp ? runnerUp.confidence : null,
      threshold: provider.threshold,
    }).select('id').single();
    eventId = ev?.id ?? null;
  } catch (e) { /* logging must not break identification */ }

  if (!matched) return { matched: false, reason, event_id: eventId };

  // 4. Build the payload. The collection's .mind lives by convention at
  //    pop-targets/{slug}/target.mind.
  const { data: col } = await db
    .from('collections').select('slug').eq('id', top.collectionId).single();
  const mindFileUrl = col?.slug
    ? `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${col.slug}/target.mind`
    : null;

  const { data: imgs } = await db
    .from('pop_images')
    .select('id, target_ref, video_url, audio_first')
    .eq('collection_id', top.collectionId);
  const images = (imgs || [])
    .map(i => ({ id: i.id, target_ref: i.target_ref, video_url: i.video_url, audio_first: i.audio_first }))
    .sort((a, b) => Number(a.target_ref) - Number(b.target_ref));

  return {
    matched: true,
    collectionId: top.collectionId,
    mind_file_url: mindFileUrl,
    confidence: top.confidence,
    target_ref: top.targetRef,
    images,
    event_id: eventId,
  };
}

// IdentificationProvider — the pluggable matcher interface from the build brief.
//
//   identify(creatorId, frame) -> { imageId, collectionId, confidence } | null
//
// Start with CLIP embedding + pgvector cosine search (ReplicateClipProvider
// below). A feature-descriptor matcher or a hosted recognition API can replace
// it later WITHOUT touching callers — same identify() contract.
//
// PRIVACY INVARIANT: every query is scoped `WHERE creator_id = $1`. Never a
// global search. Enforced here in code, not only by RLS.

import { embedImageFromUrl, toPgVector } from './embed.mjs';

export class ReplicateClipProvider {
  /**
   * @param {object} db Supabase client created with the SERVICE ROLE key —
   *        pop_images is RLS-locked with no anon/authenticated policy.
   * @param {{threshold?: number}} [opts] cosine-similarity cutoff (0..1).
   *        0.60 chosen from a real print-photo test (correct page scored ~0.69
   *        under bad lighting/angle; noise floor ~0.56). Phase 4 shadow data
   *        tunes the final value.
   */
  constructor(db, { threshold = 0.60 } = {}) {
    this.db = db;
    this.threshold = threshold;
  }

  /**
   * @param {string} creatorId  scope — required (the privacy wall).
   * @param {{imageUrl?: string, embedding?: number[]}} frame
   *        Either a URL for the server to embed, or a precomputed embedding
   *        (the future client-side optimization path).
   * @returns {Promise<{imageId: string, collectionId: string, confidence: number} | null>}
   */
  async identify(creatorId, frame) {
    const top = (await this.search(creatorId, frame, 1))[0];
    return (top && top.confidence >= this.threshold) ? top : null;
  }

  // Raw scoped search — returns the top-K candidates with scores, NO threshold
  // applied. The orchestrator uses this so it can log the full picture (top-1,
  // runner-up margin) to identify_events even when nothing clears the cutoff.
  async search(creatorId, frame, k = 3) {
    if (!creatorId) throw new Error('search: creatorId is required (privacy scope).');
    const vec = frame.embedding || await embedImageFromUrl(frame.imageUrl);
    const { data, error } = await this.db.rpc('identify_match', {
      p_creator_id: creatorId,
      p_embedding: toPgVector(vec),
      p_limit: k,
    });
    if (error) throw new Error('identify_match RPC failed: ' + error.message);
    return (data || []).map(r => ({
      imageId: r.image_id,
      collectionId: r.collection_id,
      targetRef: r.target_ref,
      videoUrl: r.video_url,
      confidence: r.confidence,
    }));
  }
}

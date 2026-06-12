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
    if (!creatorId) throw new Error('identify: creatorId is required (privacy scope).');
    const vec = frame.embedding || await embedImageFromUrl(frame.imageUrl);

    // Scoped pgvector cosine search via the identify_match RPC. The privacy
    // scope (creator_id) lives inside the function — it is never a global search.
    const { data, error } = await this.db.rpc('identify_match', {
      p_creator_id: creatorId,
      p_embedding: toPgVector(vec),
      p_limit: 1,
    });
    if (error) throw new Error('identify_match RPC failed: ' + error.message);

    const top = data && data[0];
    if (!top || top.confidence < this.threshold) return null;
    return {
      imageId: top.image_id,
      collectionId: top.collection_id,
      targetRef: top.target_ref,
      videoUrl: top.video_url,
      confidence: top.confidence,
    };
  }
}

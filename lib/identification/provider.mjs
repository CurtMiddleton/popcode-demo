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

import { embedImageFromUrl } from './embed.mjs';

export class ReplicateClipProvider {
  /**
   * @param {object} db Supabase client created with the SERVICE ROLE key —
   *        pop_images is RLS-locked with no anon/authenticated policy.
   * @param {{threshold?: number}} [opts] cosine-similarity cutoff (0..1). The
   *        final value comes from Phase 4 shadow data; this is a placeholder.
   */
  constructor(db, { threshold = 0.75 } = {}) {
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
    // eslint-disable-next-line no-unused-vars
    const vec = frame.embedding || await embedImageFromUrl(frame.imageUrl);

    // Phase 2 wires this to a scoped pgvector cosine search (RPC), e.g.:
    //   select id, collection_id, 1 - (embedding <=> $query) as confidence
    //   from pop_images
    //   where creator_id = $creatorId
    //   order by embedding <=> $query
    //   limit 1;
    // then return the row if confidence >= this.threshold, else null.
    throw new Error('ReplicateClipProvider.identify() is implemented in Phase 2.');
  }
}

// CLIP image embedding via Replicate.
//
// Shared by the Phase 1 seed/ingest pipeline (scripts/seed-identification.mjs)
// and the Phase 2 /api/identify endpoint, so the index vectors and the query
// vectors always come from the EXACT same model. Default model is CLIP
// ViT-B/32 (512-dim), matching pop_images.embedding -> vector(512).
//
// Swap the model with REPLICATE_CLIP_MODEL, but if its output dimension isn't
// 512 the schema's vector(512) won't accept it — change the column too.

const REPLICATE_API = 'https://api.replicate.com/v1';
const DEFAULT_MODEL = process.env.REPLICATE_CLIP_MODEL || 'krthr/clip-embeddings';

export const EMBEDDING_DIM = 512;

// Replicate models vary in output shape. Accept the common ones and fail loud
// if we can't find a numeric vector of the expected length.
function normalizeEmbedding(output) {
  let vec = null;
  if (Array.isArray(output) && typeof output[0] === 'number') {
    vec = output;
  } else if (output && Array.isArray(output.embedding)) {
    vec = output.embedding;
  } else if (Array.isArray(output) && output[0] && Array.isArray(output[0].embedding)) {
    vec = output[0].embedding;
  }
  if (!vec) {
    throw new Error('Could not find an embedding array in Replicate output: ' +
      JSON.stringify(output).slice(0, 200));
  }
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding length ${vec.length} != expected ${EMBEDDING_DIM}. ` +
      `Check REPLICATE_CLIP_MODEL output dimension matches vector(${EMBEDDING_DIM}).`);
  }
  return vec.map(Number);
}

/**
 * Compute a CLIP embedding for an image given its (publicly fetchable) URL.
 * Replicate fetches the URL server-side, so it must be reachable without auth.
 *
 * @param {string} imageUrl
 * @param {{token?: string, model?: string}} [opts]
 * @returns {Promise<number[]>} 512 floats
 */
export async function embedImageFromUrl(imageUrl, {
  token = process.env.REPLICATE_API_TOKEN,
  model = DEFAULT_MODEL,
} = {}) {
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set.');
  if (!imageUrl) throw new Error('embedImageFromUrl: imageUrl is required.');

  // Official-model endpoint + `Prefer: wait` blocks until the prediction
  // resolves (up to ~60s) so we usually skip manual polling.
  const res = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ input: { image: imageUrl } }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Replicate error ${res.status}: ${body.detail || JSON.stringify(body).slice(0, 200)}`);
  }

  // Fallback polling in case the prediction wasn't terminal after Prefer: wait.
  let prediction = body;
  let guard = 0;
  while (prediction.status &&
         !['succeeded', 'failed', 'canceled'].includes(prediction.status)) {
    if (guard++ > 90) throw new Error('Replicate prediction timed out.');
    await new Promise(r => setTimeout(r, 1000));
    const pr = await fetch(prediction.urls.get, { headers: { Authorization: `Bearer ${token}` } });
    prediction = await pr.json();
  }
  if (prediction.status === 'failed' || prediction.status === 'canceled') {
    throw new Error(`Replicate prediction ${prediction.status}: ${prediction.error || ''}`);
  }

  return normalizeEmbedding(prediction.output);
}

// pgvector's text input form: "[0.1,0.2,...]". supabase-js passes this string
// straight to PostgREST, which casts it to vector on insert.
export function toPgVector(vec) {
  return '[' + vec.join(',') + ']';
}

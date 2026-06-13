// CLIP image embedding via Replicate.
//
// Shared by the Phase 1 seed/ingest pipeline (scripts/seed-identification.mjs)
// and the Phase 2 /api/identify endpoint, so the index vectors and the query
// vectors always come from the EXACT same model. Default model is
// krthr/clip-embeddings (CLIP ViT-L/14-class, 768-dim), matching
// pop_images.embedding -> vector(768).
//
// Swap the model with REPLICATE_CLIP_MODEL, but if its output dimension isn't
// 768 the schema's vector(768) won't accept it — change EMBEDDING_DIM and the
// pop_images.embedding column to match.

const REPLICATE_API = 'https://api.replicate.com/v1';
const DEFAULT_MODEL = process.env.REPLICATE_CLIP_MODEL || 'krthr/clip-embeddings';

export const EMBEDDING_DIM = 768;

// Resolve a community model's latest version id once, then reuse it. The
// /v1/models/{owner}/{name}/predictions shortcut only works for Replicate
// "official" models; community models must POST to /v1/predictions with an
// explicit version id, which we look up here (override with REPLICATE_CLIP_VERSION).
const _versionCache = new Map();
async function resolveVersion(model, token) {
  if (process.env.REPLICATE_CLIP_VERSION) return process.env.REPLICATE_CLIP_VERSION;
  if (_versionCache.has(model)) return _versionCache.get(model);
  const res = await fetch(`${REPLICATE_API}/models/${model}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const b = await res.text().catch(() => '');
    throw new Error(`Replicate: could not load model "${model}" (${res.status}). ` +
      `Check the model name (REPLICATE_CLIP_MODEL) exists and is public. ${b.slice(0, 150)}`);
  }
  const j = await res.json();
  if (!j.latest_version?.id) throw new Error(`Replicate model "${model}" has no latest_version.`);
  _versionCache.set(model, j.latest_version.id);
  return j.latest_version.id;
}

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

// POST with automatic 429 backoff. Replicate throttles hard (6 req/min) while
// an account has < $5 credit, and sets Retry-After; honor it and retry rather
// than failing the whole run.
async function postWithRetry(url, opts, { maxRetries = 10 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, opts);
    if (res.status !== 429 || attempt >= maxRetries) return res;
    const ra = parseInt(res.headers.get('retry-after') || '', 10);
    let waitMs = Number.isFinite(ra) ? ra * 1000 : 0;
    if (!waitMs) {
      const body = await res.clone().text().catch(() => '');
      const m = body.match(/resets in ~?(\d+)\s*s/i);
      waitMs = m ? (parseInt(m[1], 10) + 1) * 1000 : Math.min(2000 * 2 ** attempt, 30000);
    }
    process.stderr.write(`  (throttled; waiting ${Math.round(waitMs / 1000)}s)… `);
    await new Promise(r => setTimeout(r, waitMs + 500));
  }
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

  // Create a prediction against the model's version. `Prefer: wait` blocks
  // until it resolves (up to ~60s) so we usually skip manual polling.
  const version = await resolveVersion(model, token);
  const res = await postWithRetry(`${REPLICATE_API}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    },
    body: JSON.stringify({ version, input: { image: imageUrl } }),
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

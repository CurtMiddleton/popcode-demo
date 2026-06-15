// CLIP image embedding via transformers.js (Xenova/clip-vit-base-patch32).
//
// ON-DEVICE BY DESIGN. The SAME model + quantization runs in two places:
//   * here (Node) — for the seed/ingest pipeline (scripts/seed-identification.mjs)
//   * the browser — for the live scan query (public/lib/clip-embed.js)
// Index vectors and query vectors MUST come from the exact same model AND dtype
// or cosine scores drift, so CLIP_MODEL_ID / CLIP_DTYPE below are the single
// source of truth — keep them in lockstep with public/lib/clip-embed.js.
//
// Output: a 512-dim L2-normalized image embedding -> pop_images.embedding
// vector(512).
//
// WHY THIS REPLACED REPLICATE: the previous backend (krthr/clip-embeddings,
// 768-dim, via Replicate) was a serverless hosted model that cold-started
// (~5-15s) on the first scan after idling — fatal for single-image experiences,
// which are always a first scan. Computing the embedding on the user's device
// removes the server round-trip entirely: no cold-start, no per-call cost, no
// rate limit, and the photo never leaves the phone. See README-identification.md.

export const EMBEDDING_DIM = 512;
export const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';
// 8-bit quantized weights: ~4x smaller (mobile-friendly first load) AND identical
// numerically on Node and in the browser, so seeded vs queried vectors compare.
export const CLIP_DTYPE = 'q8';

// transformers.js is dynamically imported the first time we actually embed.
//
// The specifier is deliberately NON-LITERAL (a process.env fallback) so Vercel's
// static file tracer (@vercel/nft) CAN'T follow it. transformers.js drags in
// onnxruntime-node's native binaries + sharp (>250MB), which would blow the
// serverless function size limit if bundled. The deployed /api/identify never
// embeds server-side — the browser sends a precomputed vector — so the function
// doesn't need this package at all. Node still resolves it at runtime for the
// local seed/test scripts (and the rare server-side fallback, where installed).
function loadTransformers() {
  const pkg = process.env.CLIP_PKG || '@huggingface/transformers';
  return import(pkg);
}

let _clip = null;
async function getClip() {
  if (!_clip) {
    _clip = (async () => {
      const { AutoProcessor, CLIPVisionModelWithProjection } = await loadTransformers();
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained(CLIP_MODEL_ID),
        CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { dtype: CLIP_DTYPE }),
      ]);
      return { processor, model };
    })();
  }
  return _clip;
}

function l2normalize(vec) {
  let n = 0;
  for (const x of vec) n += x * x;
  n = Math.sqrt(n) || 1;
  return vec.map(x => x / n);
}

/**
 * Compute a 512-dim CLIP image embedding for an image. In Node, transformers.js
 * RawImage.read() accepts an http(s) URL, a data-URI, or a local file path.
 *
 * @param {string} imageUrl
 * @returns {Promise<number[]>} 512 L2-normalized floats
 */
export async function embedImageFromUrl(imageUrl) {
  if (!imageUrl) throw new Error('embedImageFromUrl: imageUrl is required.');
  const { RawImage } = await loadTransformers();
  const { processor, model } = await getClip();
  const image = await RawImage.read(imageUrl);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return l2normalize(Array.from(image_embeds.data));
}

// pgvector's text input form: "[0.1,0.2,...]". supabase-js passes this string
// straight to PostgREST, which casts it to vector on insert.
export function toPgVector(vec) {
  return '[' + vec.join(',') + ']';
}

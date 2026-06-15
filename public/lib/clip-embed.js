// Browser-side CLIP image embedding (transformers.js, Xenova/clip-vit-base-patch32).
//
// This is the live-scan half of the on-device identification swap. The user's
// phone computes the query embedding here, then scan.html POSTs the 512-float
// VECTOR (not the image) to /api/identify. No server round-trip to embed =
// no Replicate cold-start, no per-call cost, no rate limit.
//
// MUST stay numerically identical to lib/identification/embed.mjs (the Node
// seed path): SAME model id, SAME q8 dtype, SAME L2-normalized 512-dim
// image_embeds. The index (seeded in Node) and the query (computed here) have
// to be comparable or cosine similarity is meaningless.
//
// The library + model weights load from the jsDelivr / Hugging Face CDNs on
// first use (~tens of MB, cached by the browser thereafter). Vendoring them into
// public/vendor — to match the AR libraries' self-hosted policy — is a
// documented follow-up; the weights are large so it's a deliberate separate step.

const CLIP_MODEL_ID = 'Xenova/clip-vit-base-patch32';
const CLIP_DTYPE = 'q8';
// Pinned to the same major/minor the Node side declares (@huggingface/transformers
// in package.json). Bump both together.
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

let _mod = null;
async function loadModule() {
  if (!_mod) _mod = await import(TRANSFORMERS_URL);
  return _mod;
}

let _clip = null;
/**
 * Kick off the model download + init. Call this as soon as the user starts the
 * scan flow so the weights are fetched while they aim the camera, making the
 * first real embed instant. Safe to call repeatedly (memoized).
 * @returns {Promise<{processor: any, model: any}>}
 */
export function warmupClip() {
  if (!_clip) {
    _clip = (async () => {
      const { AutoProcessor, CLIPVisionModelWithProjection, env } = await loadModule();
      if (env) env.allowLocalModels = false; // weights come from the HF CDN, not a local path
      const [processor, model] = await Promise.all([
        AutoProcessor.from_pretrained(CLIP_MODEL_ID),
        CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL_ID, { dtype: CLIP_DTYPE }),
      ]);
      return { processor, model };
    })();
  }
  return _clip;
}

function l2normalize(arr) {
  let n = 0;
  for (const x of arr) n += x * x;
  n = Math.sqrt(n) || 1;
  return arr.map(x => x / n);
}

/**
 * Embed an image given a data-URI / object-URL / http(s) URL string.
 * scan.html passes the captured frame's JPEG data-URL.
 * @param {string} url
 * @returns {Promise<number[]>} 512 L2-normalized floats
 */
export async function embedDataUrl(url) {
  const { RawImage } = await loadModule();
  const { processor, model } = await warmupClip();
  const image = await RawImage.read(url);
  const inputs = await processor(image);
  const { image_embeds } = await model(inputs);
  return l2normalize(Array.from(image_embeds.data));
}

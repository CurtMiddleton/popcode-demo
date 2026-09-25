// Build a Shotstack "edit" payload from a simple montage description.
//
// Popcode's montage maker collects an ordered list of photos and short video
// clips, a per-photo duration, a transition style, an optional soundtrack, and
// an output aspect. This turns that into the JSON timeline Shotstack renders
// into an MP4.
//
// Kept as a standalone .mjs (mirrors lib/print/catalog.mjs) so it can be unit
// tested and reused. api/create-montage.js dynamic-import()s it (a static
// import of a local .mjs from a Vercel CJS function throws ERR_REQUIRE_ESM).

// Ken Burns motion — gentle slow zooms only, alternating in/out. The slide/pan
// effects and faster zooms read as "frenetic" on short clips, so we keep it to a
// slow, calm zoom (the classic Ken Burns look).
const KEN_BURNS = ['zoomInSlow', 'zoomOutSlow'];

// Output sizes. Portrait is the default — memory videos are watched on phones,
// and the scan/view player is full-bleed portrait. 720p (rather than 1080p) is
// plenty for phone playback and is ~half the pixels, so Shotstack renders finish
// faster and the resulting MP4 is smaller to pull back into the page.
export const MONTAGE_SIZES = {
  portrait: { width: 720, height: 1280 },
  landscape: { width: 1280, height: 720 },
  square: { width: 720, height: 720 },
};

// Overlap between consecutive photos, in seconds — this is what makes the
// crossfade read as a crossfade (the incoming clip fades in on top of the
// outgoing one) rather than a fade-through-black.
const CROSSFADE = 0.5;

// Video clips play their own length, but only up to this many seconds — a
// montage is a quick memory reel, not a place for a whole home video. Longer
// clips use their opening seconds. The builder enforces the same cap.
export const MAX_CLIP_SECONDS = 10;
const MIN_CLIP_SECONDS = 1;

// A creator-chosen framing: how much to trim off each side of the source, as
// fractions of its width/height (Shotstack's asset `crop`). The builder sends a
// rect at the output's aspect ratio, so 'crop' fit then fills the frame with
// exactly that region. Anything malformed is dropped (centre crop, as before).
function normaliseCrop(c) {
  if (!c || typeof c !== 'object') return null;
  const out = {};
  for (const k of ['top', 'bottom', 'left', 'right']) {
    const v = Number(c[k]);
    if (!Number.isFinite(v) || v < 0 || v >= 1) return null;
    out[k] = +v.toFixed(4);
  }
  if (out.left + out.right >= 0.98 || out.top + out.bottom >= 0.98) return null;
  if (!out.top && !out.bottom && !out.left && !out.right) return null;
  return out;
}

// Normalise one montage item. Accepts the legacy photo shape `{ url }` as well
// as `{ type: 'image'|'video', url, seconds, crop }`.
function normaliseItem(it) {
  const type = it && it.type === 'video' ? 'video' : 'image';
  return { type, url: it.url, seconds: Number(it.seconds), crop: normaliseCrop(it.crop) };
}

export function buildShotstackEdit({
  items = null,              // [{ type: 'image'|'video', url, seconds? }]
  images = [],               // legacy: photos only, [{ url }]
  perImageSeconds = 3,
  transition = 'kenburns',   // 'kenburns' | 'fade'
  musicUrl = null,
  aspect = 'portrait',
  fps = 25,
} = {}) {
  const photoDur = Math.max(1.5, Number(perImageSeconds) || 3);
  const size = MONTAGE_SIZES[aspect] || MONTAGE_SIZES.portrait;
  const list = (Array.isArray(items) ? items : images).map(normaliseItem);

  let cursor = 0;
  let photoIndex = 0;
  const clips = list.map((it) => {
    const length = it.type === 'video'
      ? Math.min(MAX_CLIP_SECONDS, Math.max(MIN_CLIP_SECONDS, it.seconds || MAX_CLIP_SECONDS))
      : photoDur;
    const clip = {
      asset: it.type === 'video'
        // trim: 0 plays from the start; length cuts it off at the cap. Clip
        // sound is kept only when there's no soundtrack — under music, the
        // clips' own audio would fight it (Apple Memories does the same).
        ? { type: 'video', src: it.url, trim: 0, volume: musicUrl ? 0 : 1 }
        : { type: 'image', src: it.url },
      start: +cursor.toFixed(3),
      length: +length.toFixed(3),
      // 'crop' fills the frame while preserving aspect ratio (cropping overflow);
      // 'cover' would stretch/distort. See Shotstack fit docs.
      fit: 'crop',
      // Fade the incoming clip in (crossfade over the previous, thanks to the
      // overlap) and the last clip out at the very end.
      transition: { in: 'fade', out: 'fade' },
    };
    // Ken Burns is for stills only — a clip already moves. Alternation counts
    // photos, so in/out still alternates across a clip in between.
    if (it.crop) clip.asset.crop = it.crop;
    if (it.type === 'image' && transition === 'kenburns') {
      clip.effect = KEN_BURNS[photoIndex % KEN_BURNS.length];
    }
    if (it.type === 'image') photoIndex++;
    cursor += length - CROSSFADE;
    return clip;
  });

  const timeline = { background: '#000000', tracks: [{ clips }] };
  if (musicUrl) {
    // Shotstack auto-trims the soundtrack to the timeline length.
    timeline.soundtrack = { src: musicUrl, effect: 'fadeInFadeOut' };
  }

  const totalLength = clips.length > 0
    ? +(cursor + CROSSFADE).toFixed(3)
    : photoDur;

  return {
    edit: { timeline, output: { format: 'mp4', fps, size } },
    totalLength,
  };
}

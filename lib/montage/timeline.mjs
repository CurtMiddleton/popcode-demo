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

// A photo can set its own time on screen, overriding perImageSeconds.
export const MIN_PHOTO_SECONDS = 1.5;
export const MAX_PHOTO_SECONDS = 10;

// The last photo rests this much longer, so the montage settles on it before
// the closing fade instead of fading out almost as soon as it arrives.
export const END_HOLD_SECONDS = 1.5;

// A creator-chosen framing for a video clip: where to move it (and how much
// to enlarge it) so the chosen part fills the frame. `x`/`y` are Shotstack
// clip offsets — fractions of the viewport's width/height, +y is up — and
// `scale` multiplies the 'crop' fit. (Photos are framed in the browser and
// arrive already cut to the frame. Shotstack's asset `crop` is NOT used: it
// trims the placed picture and leaves black where it cut.)
function normaliseFrame(f) {
  if (!f || typeof f !== 'object') return null;
  const x = Number(f.x), y = Number(f.y), scale = f.scale === undefined ? 1 : Number(f.scale);
  if (![x, y, scale].every(Number.isFinite)) return null;
  if (Math.abs(x) > 10 || Math.abs(y) > 10 || scale < 1 || scale > 4) return null;
  if (!x && !y && scale === 1) return null;
  return { x: +x.toFixed(4), y: +y.toFixed(4), scale: +scale.toFixed(4) };
}

// Normalise one montage item. Accepts the legacy photo shape `{ url }` as well
// as `{ type: 'image'|'video', url, seconds, frame, caption }`. `caption` is a
// transparent PNG the size of the output, with the item's text drawn on it by
// the builder (so the text uses the site's own fonts, exactly as previewed).
function normaliseItem(it) {
  const type = it && it.type === 'video' ? 'video' : 'image';
  const caption = typeof it.caption === 'string' && /^https:\/\//.test(it.caption) ? it.caption : null;
  // `fit: 'whole'` (video clips only — photos arrive already composed) shows
  // the whole clip over a blurred copy of itself instead of cropping it.
  const whole = type === 'video' && it.fit === 'whole';
  return { type, url: it.url, seconds: Number(it.seconds), frame: type === 'video' && !whole ? normaliseFrame(it.frame) : null, caption, whole };
}

// Text arrives this long after its photo or clip starts, so it fades in once
// the picture has settled rather than crossfading in with it.
const CAPTION_DELAY = 0.4;

export function buildShotstackEdit({
  items = null,              // [{ type: 'image'|'video', url, seconds?, frame?, caption? }]
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
  const captions = [];
  const backdrops = [];
  const clips = list.map((it, idx) => {
    const isLast = idx === list.length - 1;
    const length = it.type === 'video'
      ? Math.min(MAX_CLIP_SECONDS, Math.max(MIN_CLIP_SECONDS, it.seconds || MAX_CLIP_SECONDS))
      : (Number.isFinite(it.seconds) && it.seconds > 0
          ? Math.min(MAX_PHOTO_SECONDS, Math.max(MIN_PHOTO_SECONDS, it.seconds))
          : photoDur) + (isLast ? END_HOLD_SECONDS : 0);
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
    if (it.frame) {
      clip.offset = { x: it.frame.x, y: it.frame.y };
      if (it.frame.scale !== 1) clip.scale = it.frame.scale;
    }
    if (it.type === 'image' && transition === 'kenburns') {
      clip.effect = KEN_BURNS[photoIndex % KEN_BURNS.length];
    }
    if (it.type === 'image') photoIndex++;
    if (it.whole) {
      // The whole clip, letterboxed, over a blurred full-frame copy of itself.
      clip.fit = 'contain';
      backdrops.push({
        asset: { type: 'video', src: it.url, trim: 0, volume: 0 },
        start: clip.start, length: clip.length, fit: 'crop', filter: 'blur',
        transition: { in: 'fade', out: 'fade' },
      });
    }
    if (it.caption) {
      captions.push({
        asset: { type: 'image', src: it.caption },
        start: +(cursor + CAPTION_DELAY).toFixed(3),
        length: +Math.max(1, length - CAPTION_DELAY).toFixed(3),
        fit: 'contain',
        transition: { in: 'fade', out: 'fade' },
      });
    }
    cursor += length - CROSSFADE;
    return clip;
  });

  // The first track is drawn on top, so text sits over the pictures and is
  // untouched by Ken Burns.
  // Blurred backdrops for whole-frame clips go underneath everything.
  const tracks = [captions.length && { clips: captions }, { clips }, backdrops.length && { clips: backdrops }].filter(Boolean);
  const timeline = { background: '#000000', tracks };
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

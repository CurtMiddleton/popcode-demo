// Build a Shotstack "edit" payload from a simple montage description.
//
// Popcode's montage maker collects an ordered list of photo URLs, a per-photo
// duration, a transition style, an optional soundtrack, and an output aspect.
// This turns that into the JSON timeline Shotstack renders into an MP4.
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

export function buildShotstackEdit({
  images = [],
  perImageSeconds = 3,
  transition = 'kenburns',   // 'kenburns' | 'fade'
  musicUrl = null,
  aspect = 'portrait',
  fps = 25,
} = {}) {
  const dur = Math.max(1.5, Number(perImageSeconds) || 3);
  const size = MONTAGE_SIZES[aspect] || MONTAGE_SIZES.portrait;
  const step = dur - CROSSFADE;

  const clips = images.map((img, i) => {
    const start = +(i * step).toFixed(3);
    const clip = {
      asset: { type: 'image', src: img.url },
      start,
      length: +dur.toFixed(3),
      // 'crop' fills the frame while preserving aspect ratio (cropping overflow);
      // 'cover' would stretch/distort. See Shotstack fit docs.
      fit: 'crop',
      // Fade the incoming clip in (crossfade over the previous, thanks to the
      // overlap) and the last clip out at the very end.
      transition: { in: 'fade', out: 'fade' },
    };
    if (transition === 'kenburns') clip.effect = KEN_BURNS[i % KEN_BURNS.length];
    return clip;
  });

  const timeline = { background: '#000000', tracks: [{ clips }] };
  if (musicUrl) {
    // Shotstack auto-trims the soundtrack to the timeline length.
    timeline.soundtrack = { src: musicUrl, effect: 'fadeInFadeOut' };
  }

  const totalLength = images.length > 0
    ? +(((images.length - 1) * step) + dur).toFixed(3)
    : dur;

  return {
    edit: { timeline, output: { format: 'mp4', fps, size } },
    totalLength,
  };
}

#!/usr/bin/env python3
"""
Ornament mockup generator.

Composites customer artwork onto the blank round ceramic ornament photo so the
art covers the whole disc, keeps the ceramic's own shading and gloss, punches
the hanging hole back out, and leaves the gold string on top.

    python3 ornament_mockup.py art.png out.png [--blank Back__Round.jpg] [--side front|back]

Notes
-----
* Artwork with an alpha channel is flattened onto white first. Compositing RGBA
  straight onto the mockup is what produces dark halos around the edges.
* Art is scaled to COVER the disc (short side fills the diameter) and centre
  cropped, so no background shows at the edges.
* --side back mirrors the blank (lighting, gloss and string) so the two faces of
  a double-sided ornament don't read as the same photograph twice. The artwork
  itself is never mirrored. If Printify gives you a separate blank for the other
  face, pass it with --blank instead and leave --side alone; the disc is refitted
  automatically, but update HOLE below for that photo.
"""

import argparse
import numpy as np
from PIL import Image
from scipy import ndimage as nd

# Fallback hanging-hole geometry (centre x, y, radius), only used if the hole
# can't be auto-detected. Auto-detection (detect_hole) runs first for any blank.
HOLE = (1023.0, 406.0, 46.0)


def disc_geometry(blank_rgb):
    """Fit the ornament disc in case a different blank is used."""
    lum = blank_rgb.mean(2)
    sat = blank_rgb.max(2) - blank_rgb.min(2)
    m = nd.binary_fill_holes(nd.binary_opening((lum < 250.5) & (sat < 40), np.ones((5, 5))))
    lab, n = nd.label(m)
    sizes = nd.sum(m, lab, range(1, n + 1))
    d = lab == (sizes.argmax() + 1)
    ys, xs = np.where(d)
    cx = (xs.min() + xs.max()) / 2.0
    cy = (ys.min() + ys.max()) / 2.0
    r = ((xs.max() - xs.min()) + (ys.max() - ys.min())) / 4.0
    return cx, cy, r


def detect_hole(blank_rgb, cx, cy, r):
    """Locate the hanging hole automatically, so no per-blank constant is needed.

    The hole sits in the upper third of the disc where the gold string threads
    through. It reads as a small, compact, low-saturation blob that stands out
    from the flat ceramic face — either brighter (the background showing through)
    or darker (a shadowed grommet). Returns (hx, hy, hr) or None.
    """
    H, W, _ = blank_rgb.shape
    lum = blank_rgb.mean(2)
    sat = blank_rgb.max(2) - blank_rgb.min(2)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

    # Flat-face reference tone, sampled from the lower-centre (never the hole).
    face = (np.hypot(xx - cx, yy - cy) < 0.70 * r) & (yy > cy)
    if not face.any():
        return None
    tone = float(np.median(lum[face]))

    # The hole always sits in a tight band at the top of the disc, on the vertical
    # axis. Restricting to that band is what keeps stray specks from winning.
    top = cy - r
    band = (np.abs(xx - cx) < 0.20 * r) & (yy > top + 0.02 * r) & (yy < top + 0.42 * r)
    # It reads as brighter (background through the hole) or darker (a grommet),
    # and never as saturated gold (that's the string, which sits on top).
    cand = band & (np.abs(lum - tone) > 6) & (sat < 45)
    cand = nd.binary_closing(cand, np.ones((9, 9)))
    cand = nd.binary_fill_holes(cand)
    cand = nd.binary_opening(cand, np.ones((3, 3)))

    lab, n = nd.label(cand)
    if n == 0:
        return None
    # The hole is the largest compact blob in the band.
    best = None
    for i in range(1, n + 1):
        ys, xs = np.where(lab == i)
        area = xs.size
        if area < (0.03 * r) ** 2 * np.pi:           # ignore tiny specks
            continue
        bw, bh = np.ptp(xs) + 1, np.ptp(ys) + 1
        roundish = min(bw, bh) / max(bw, bh)
        score = area * (0.5 + roundish)
        if best is None or score > best[0]:
            best = (score, xs.mean(), ys.mean(), float(np.sqrt(area / np.pi)))
    if best is None:
        return None
    _, hx, hy, hr = best
    return hx, hy, float(np.clip(hr, 0.02 * r, 0.09 * r))


def load_art_cover(path, size):
    """Open artwork, flatten any transparency onto white, cover-crop to square."""
    art = Image.open(path)
    if art.mode in ("RGBA", "LA") or "transparency" in art.info:
        art = art.convert("RGBA")
        bg = Image.new("RGBA", art.size, (255, 255, 255, 255))
        art = Image.alpha_composite(bg, art)
    art = art.convert("RGB")
    w, h = art.size
    s = max(size / w, size / h)                       # COVER, not fit
    art = art.resize((max(size, int(round(w * s))), max(size, int(round(h * s)))), Image.LANCZOS)
    w, h = art.size
    left, top = (w - size) // 2, (h - size) // 2
    return art.crop((left, top, left + size, top + size))


def build(art_path, blank_path, out_path, gloss=0.10, side="front"):
    blank_img = Image.open(blank_path).convert("RGB")
    mirrored = side == "back"
    if mirrored:
        blank_img = blank_img.transpose(Image.FLIP_LEFT_RIGHT)
    blank = np.asarray(blank_img).astype(np.float32)
    H, W, _ = blank.shape
    lum = blank.mean(2)
    sat = blank.max(2) - blank.min(2)

    cx, cy, r = disc_geometry(blank)
    # The hole is auto-detected on the (already mirrored) blank, so it lands on
    # the correct side with no per-blank constant. HOLE is only a fallback.
    hole = detect_hole(blank, cx, cy, r)
    if hole is not None:
        hx, hy, hr = hole
    else:
        hx, hy, hr = HOLE
        if mirrored:
            hx = W - hx

    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.hypot(xx - cx, yy - cy)

    # Artwork, covering the full diameter
    side = int(round(2 * r)) + 2
    art = np.asarray(load_art_cover(art_path, side)).astype(np.float32)
    canvas = np.full_like(blank, 255.0)
    x0, y0 = int(round(cx - side / 2)), int(round(cy - side / 2))
    sx0, sy0 = max(0, x0), max(0, y0)
    sx1, sy1 = min(W, x0 + side), min(H, y0 + side)
    canvas[sy0:sy1, sx0:sx1] = art[sy0 - y0:sy1 - y0, sx0 - x0:sx1 - x0]

    # Ceramic shading: the blank's own luminance, normalised to the flat white
    ref = np.percentile(lum[dist < r * 0.9], 60)
    shade = np.clip(lum / ref, 0.0, 1.35)
    shaded = canvas * np.clip(shade, 0, 1)[..., None]
    # Glaze: whatever the blank has above the flat tone comes back as a highlight
    spec = np.clip(shade - 1.0, 0, None)[..., None]
    shaded = shaded + (255.0 - shaded) * spec * 0.9
    # A little extra gloss from the upper left, the way the sample reads
    sheen = np.clip(1.0 - np.hypot(xx - (cx - r * 0.45), yy - (cy - r * 0.5)) / (r * 1.15), 0, 1) ** 2
    shaded = shaded + (255.0 - shaded) * (sheen * gloss)[..., None]

    # Masks: disc, hole, gold string
    alpha = np.clip(r - dist + 0.5, 0, 1)
    hole = np.clip(hr - np.hypot(xx - hx, yy - hy) + 0.5, 0, 1)
    alpha = alpha * (1 - hole)
    string = np.clip((sat - 25) / 25.0, 0, 1)                  # gold thread stays on top

    out = blank * (1 - alpha[..., None]) + shaded * alpha[..., None]
    out = out * (1 - string[..., None]) + blank * string[..., None]
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(out_path)
    return out_path


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("art")
    p.add_argument("out")
    p.add_argument("--blank", default="Back__Round.jpg")
    p.add_argument("--gloss", type=float, default=0.10)
    p.add_argument("--side", choices=["front", "back"], default="front")
    a = p.parse_args()
    print(build(a.art, a.blank, a.out, a.gloss, a.side))

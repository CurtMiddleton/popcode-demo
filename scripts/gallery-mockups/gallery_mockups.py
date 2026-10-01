#!/usr/bin/env python3
"""
Product-page gallery stills: our sample photos placed on suppliers' blank product
photos. The board book has its own script (scripts/boardbook-mockup/).

    python3 gallery_mockups.py --src DIR --photos DIR --out ../../public/assets/gallery

--src holds the blanks:
    ornament-tree.png   Printify 1747 catalogue image 6a8ee5baf919fe749f00f8b3
                        (on a tree, orange "YOUR DESIGN" placeholder)
    ornament-hand.png   Printify 1747 catalogue image 6a8ee5bbec316dbbf4023d03
                        (held by its string, blank white disc)
    (from https://images.printify.com/api/catalog/{id})
The framed room scenes are read from public/assets/mockups/scenes/framed-*.png
(Prodigi renders with a magenta art placeholder).

--photos holds Unsplash samples from public/unsplash-samples.js:
    family.jpg dog.jpg hiker.jpg alpine.jpg couple.jpg friends.jpg

Writes {out}/ornament/{tree,hand}.jpg and {out}/framed/{wall,bench,books,plant}.jpg.
"""

import argparse
import os
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import ConvexHull
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
SCENES = os.path.join(HERE, '..', '..', 'public', 'assets', 'mockups', 'scenes')


def load(p):
    return np.asarray(Image.open(p).convert('RGB')).astype(np.float64)


def largest(m):
    lab, n = nd.label(m)
    if not n:
        raise SystemExit('mask not found')
    return lab == (int(np.argmax(nd.sum(m, lab, range(1, n + 1)))) + 1)


def cover_fit(img, w, h, focus=(0.5, 0.5)):
    s = max(w / img.width, h / img.height)
    im = img.resize((max(w, round(img.width * s)), max(h, round(img.height * s))), Image.LANCZOS)
    x = int(min(max(focus[0] * im.width - w / 2, 0), im.width - w))
    y = int(min(max(focus[1] * im.height - h / 2, 0), im.height - h))
    return np.asarray(im.crop((x, y, x + w, y + h))).astype(np.float64)


def place(a, mask, photo, shade, focus=(0.5, 0.5)):
    """Photo cover-fit into the mask's box, multiplied by `shade`, soft edges."""
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = a.copy()
    art = cover_fit(photo, x1 - x0, y1 - y0, focus) * shade[y0:y1, x0:x1, None]
    al = nd.gaussian_filter(mask.astype(float), 0.9)[y0:y1, x0:x1, None]
    out[y0:y1, x0:x1] = out[y0:y1, x0:x1] * (1 - al) + art.clip(0, 255) * al
    return out


def save(arr, path, size=1200):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    if im.width > size:
        im = im.resize((size, round(im.height * size / im.width)), Image.LANCZOS)
    im.save(path, quality=84, optimize=True, progressive=True)
    print('wrote', path, os.path.getsize(path) // 1024, 'KB')


def ornament_tree(src, photo, out):
    a = load(os.path.join(src, 'ornament-tree.png'))
    # Opening drops orange fairy lights touching the disc.
    orange = largest(nd.binary_opening((a[..., 0] - a[..., 2] > 70) & (a[..., 0] > 150), iterations=6))
    # The placeholder's lettering and pattern are too big to close away, so the
    # disc is fitted as a circle from the orange's extent, minus the hanging hole.
    # disc = the convex hull of the orange (the ornament is tilted, so a fitted
    # circle or ellipse leaves flat spots).
    ys, xs = np.nonzero(orange)
    pts = np.c_[xs, ys]
    hull = pts[ConvexHull(pts).vertices]
    hm = Image.new('L', (a.shape[1], a.shape[0]), 0)
    ImageDraw.Draw(hm).polygon([tuple(p) for p in hull], fill=255)
    disc = np.asarray(hm) > 0
    cy, ry = (ys.min() + ys.max()) / 2, (ys.max() - ys.min()) / 2
    yy = np.mgrid[0:a.shape[0], 0:a.shape[1]][0]
    lum, sat = a.mean(2), a.max(2) - a.min(2)
    # Near the top, anything that is neither orange nor the white pattern is the
    # hanging hole or the string in front of it: keep the blank's pixels there.
    glyph = (lum > 190) & (sat < 60)
    keep = disc & (yy < cy - ry * 0.55) & ~nd.binary_dilation(orange | glyph, iterations=1)
    if keep.any():
        disc &= ~nd.binary_dilation(largest(keep), iterations=2)
    # The placeholder's light falloff: orange-only luminance, blurred (normalised
    # so the white glyphs don't pull it up).
    w = nd.gaussian_filter(orange.astype(float), 40) + 1e-6
    base = nd.gaussian_filter(np.where(orange, lum, 0), 40) / w
    shade = (base / np.percentile(base[orange], 90)).clip(0.6, 1.05)
    res = place(a, disc, photo, shade, (0.5, 0.45))
    save(res, os.path.join(out, 'ornament', 'tree.jpg'))


def ornament_hand(src, photo, out):
    a = load(os.path.join(src, 'ornament-hand.png'))
    lum, sat = a.mean(2), a.max(2) - a.min(2)
    disc = largest((lum > 215) & (sat < 16))
    disc = nd.binary_closing(disc, iterations=3)
    shade = (lum / np.percentile(lum[disc], 85)).clip(0.6, 1.05)
    res = place(a, disc, photo, shade, (0.5, 0.45))
    save(res, os.path.join(out, 'ornament', 'hand.jpg'))


def framed_scene(name, photo, out, focus=(0.5, 0.45)):
    im = Image.open(os.path.join(SCENES, 'framed-%s.png' % name)).convert('RGB')
    a = np.asarray(im).astype(np.float64)
    mag = (a[..., 0] > 180) & (a[..., 1] < 90) & (a[..., 2] > 180)
    m = largest(mag)
    res = place(a, m, photo, np.ones(a.shape[:2]), focus)
    save(res, os.path.join(out, 'framed', name + '.jpg'))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--photos', required=True)
    ap.add_argument('--out', required=True)
    o = ap.parse_args()
    ph = lambda n: Image.open(os.path.join(o.photos, n + '.jpg')).convert('RGB')
    ornament_tree(o.src, ph('dog'), o.out)
    ornament_hand(o.src, ph('couple'), o.out)
    framed_scene('wall', ph('alpine'), o.out)
    framed_scene('bench', ph('family'), o.out, (0.5, 0.3))
    framed_scene('books', ph('hiker'), o.out)
    framed_scene('plant', ph('friends'), o.out)

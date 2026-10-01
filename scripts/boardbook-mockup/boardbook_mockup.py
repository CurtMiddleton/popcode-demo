#!/usr/bin/env python3
"""
Board book gallery images for the Shop.

Composites our sample photos onto Printify's blank board book product photos
(blueprint 2727, District Photo) and writes the static gallery images that sit
under the live mockup on the board book page and Shop:

    standing.jpg  the book standing, pages fanned, our photo + title on the cover
    spread.jpg    the book open flat, a photo on each page

    python3 boardbook_mockup.py --blanks DIR --photos DIR --font CooperBT-Light.ttf \
        --out ../../public/assets/gallery/boardbook

Blanks (2048×2048, from https://printify.com/app/products/2727 — the catalogue
images at https://images.printify.com/api/catalog/{id}):
    690c7c98fd307981420018b3  standing, blank white
    6936c04cb3c8f46e7d0d1602  open spread, "YOUR DESIGN" placeholder pattern
The other catalogue images carry Printify's sample artwork; don't use them.

Photos are the Unsplash baby samples from public/unsplash-samples.js (BABY).

How it works
* Standing: the cover is found as the largest bright, unsaturated region; its
  four edges are fitted as lines (rounded corners excluded) and the photo is
  warped onto that quad. The blank's own brightness is multiplied back in, so
  the cover keeps its shading and rounded corners.
  the photo's left edge, as a wrapped cover would.
* Spread: the orange placeholder is the mask (holes from the pattern filled),
  and each half gets one photo, with a soft shadow down the centre fold.
* Printify's olive backdrop is turned into the Shop's neutral #f2f2f2, keeping
  its shadows, so the gallery matches the live mockup's stage.
"""

import argparse
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as nd

STANDING = '690c7c98fd307981420018b3'
SPREAD = '6936c04cb3c8f46e7d0d1602'
STAGE = 242.0  # #f2f2f2


def load(path):
    return np.asarray(Image.open(path).convert('RGB')).astype(np.float64)


def largest(mask):
    lab, n = nd.label(mask)
    sizes = nd.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def cover_fit(img, w, h, focus=(0.5, 0.5)):
    """Scale to cover w×h and crop around `focus` (fractions)."""
    s = max(w / img.width, h / img.height)
    im = img.resize((max(w, round(img.width * s)), max(h, round(img.height * s))), Image.LANCZOS)
    x = int(min(max(focus[0] * im.width - w / 2, 0), im.width - w))
    y = int(min(max(focus[1] * im.height - h / 2, 0), im.height - h))
    return im.crop((x, y, x + w, y + h))


def neutral_backdrop(a, book):
    """Grey the backdrop to the stage colour, keeping its shading."""
    lum = a.mean(2)
    base = np.median(lum[~book])
    g = np.clip(lum / base * STAGE, 0, 255)
    out = a.copy()
    soft = nd.gaussian_filter(book.astype(float), 1.2)[..., None]
    return out * soft + g[..., None] * (1 - soft)


def homography(src, dst):
    A = []
    for (x, y), (u, v) in zip(src, dst):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y, -u], [0, 0, 0, x, y, 1, -v * x, -v * y, -v]]
    _, _, vt = np.linalg.svd(np.array(A))
    return vt[-1].reshape(3, 3)


def warp(img, quad, size):
    """Warp `img` so its corners land on quad (TL, TR, BR, BL) in a size×size canvas."""
    w, h = img.size
    H = homography(quad, [(0, 0), (w, 0), (w, h), (0, h)])  # output → source
    coeffs = (H / H[2, 2]).flatten()[:8]
    return np.asarray(img.transform((size, size), Image.PERSPECTIVE, coeffs, Image.BICUBIC)).astype(np.float64)


def fit_cover_quad(c):
    tops, bots = [], []
    for x in range(760, 1360, 10):
        d = np.diff(np.r_[0, c[:, x].astype(int), 0])
        st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
        i = int(np.argmax(en - st))
        tops.append((x, st[i])); bots.append((x, en[i]))
    lefts, rights = [], []
    for y in range(800, 1300, 10):
        xs = np.nonzero(c[y])[0]
        lefts.append((y, xs.min())); rights.append((y, xs.max()))
    t = np.polyfit(*zip(*tops), 1); b = np.polyfit(*zip(*bots), 1)
    l = np.polyfit(*zip(*lefts), 1); r = np.polyfit(*zip(*rights), 1)

    def meet(hz, vt):  # y = a x + b  meets  x = c y + d
        y = (hz[0] * vt[1] + hz[1]) / (1 - hz[0] * vt[0])
        return (vt[0] * y + vt[1], y)
    return [meet(t, l), meet(t, r), meet(b, r), meet(b, l)], t


def title_on(img, font_path, title):
    """The live mockup's cover: bottom gradient + serif title at 8% in."""
    img = img.convert('RGBA')
    W, H = img.size
    grad = Image.new('L', (1, 256))
    for y in range(256):
        grad.putpixel((0, y), int(0.55 * 255 * y / 255))
    g = grad.resize((W, int(H * 0.52)))
    shade = Image.new('RGBA', (W, int(H * 0.52)), (0, 0, 0, 0))
    shade.putalpha(g)
    img.alpha_composite(shade, (0, H - shade.height))
    font = ImageFont.truetype(font_path, int(W * 0.075))
    glow = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    x, y = int(W * 0.08), int(H * 0.92 - W * 0.075 * 1.1)
    d.text((x, y), title, font=font, fill=(0, 0, 0, 115))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(W * 0.012)))
    ImageDraw.Draw(img).text((x, y), title, font=font, fill=(255, 255, 255, 255))
    return img.convert('RGB')


def standing(blanks, photo, font, title, out):
    a = load(os.path.join(blanks, STANDING + '.png'))
    lum, sat = a.mean(2), a.max(2) - a.min(2)
    c = largest((lum > 225) & (sat < 14))
    quad, top = fit_cover_quad(c)
    yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
    face = c & (yy > top[0] * xx + top[1] - 2)        # the cover, not the page edges above it
    face = nd.binary_fill_holes(face)
    face = nd.binary_opening(face, iterations=2)

    art = title_on(cover_fit(photo, 1600, 1600, (0.5, 0.45)), font, title)
    warped = warp(art, quad, a.shape[0])
    shade = (lum / np.percentile(lum[face], 92)).clip(0, 1.05)[..., None]
    alpha = nd.gaussian_filter(face.astype(float), 0.8)[..., None]
    res = a * (1 - alpha) + warped * shade * alpha

    # The spine strip stays the blank's white: stretching the photo's edge
    # across it read as streaks.
    book = largest(~((np.abs(a[..., 0] - a[..., 2] - 17) < 9) & (sat > 8) & (sat < 30) & (lum < 215)))
    res = neutral_backdrop(res, book)
    save(res, out, book)


def spread(blanks, left, right, out):
    a = load(os.path.join(blanks, SPREAD + '.png'))
    orange = (a[..., 0] - a[..., 2] > 60)
    m = nd.binary_fill_holes(nd.binary_closing(largest(orange), iterations=6))
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    W, H = x1 - x0, y1 - y0
    half = W // 2
    pg = Image.new('RGB', (W, H))
    pg.paste(cover_fit(left, half, H, (0.55, 0.45)), (0, 0))
    pg.paste(cover_fit(right, W - half, H, (0.5, 0.5)), (half, 0))
    p = np.asarray(pg).astype(np.float64)
    # Centre fold: a soft dark valley with a faint highlight either side.
    x = np.arange(W) - half
    fold = 1 - 0.20 * np.exp(-(x / (W * 0.012)) ** 2) + 0.04 * np.exp(-((np.abs(x) - W * 0.03) / (W * 0.01)) ** 2)
    p *= fold[None, :, None]
    canvas = a.copy()
    alpha = nd.gaussian_filter(m.astype(float), 0.9)[y0:y1, x0:x1, None]
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - alpha) + p.clip(0, 255) * alpha
    book = nd.binary_dilation(m, iterations=3)
    save(neutral_backdrop(canvas, book), out, book)


def save(arr, out, book):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    # A square around the book with a margin (the blanks have a lot of empty
    # backdrop), then 1200px.
    ys, xs = np.nonzero(book)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    half = min(max(xs.max() - xs.min(), ys.max() - ys.min()) * 0.66, im.width / 2)
    cx = min(max(cx, half), im.width - half); cy = min(max(cy, half), im.height - half)
    im = im.crop((int(cx - half), int(cy - half), int(cx + half), int(cy + half))).resize((1200, 1200), Image.LANCZOS)
    im.save(out, quality=84, optimize=True, progressive=True)
    print('wrote', out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--blanks', required=True, help='folder with the two Printify blanks as {id}.png')
    ap.add_argument('--photos', required=True, help='folder with cover.jpg, left.jpg, right.jpg')
    ap.add_argument('--font', required=True, help='CooperBT-Light.ttf')
    ap.add_argument('--title', default='Baby’s First Book')
    ap.add_argument('--out', required=True)
    o = ap.parse_args()
    os.makedirs(o.out, exist_ok=True)
    ph = lambda n: Image.open(os.path.join(o.photos, n)).convert('RGB')
    standing(o.blanks, ph('cover.jpg'), o.font, o.title, os.path.join(o.out, 'standing.jpg'))
    spread(o.blanks, ph('left.jpg'), ph('right.jpg'), os.path.join(o.out, 'spread.jpg'))

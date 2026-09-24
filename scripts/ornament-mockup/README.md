# Ornament mockup generator

Composites customer artwork onto the blank round ceramic ornament photo for
**listing / marketing images** (front and back). It covers the whole disc with
the art, keeps the ceramic's own shading + gloss, punches the hanging hole back
out, and leaves the gold string on top.

This is an offline tool for producing product-listing images. It is **not** what
renders the live preview in the shop — that is the client-side cutout template
at `public/assets/mockups/ornament.png` + `public/product-preview.js`
(`MOCKUPS.ornament`), which approximates this same look in-browser for whatever
photo the customer picks.

## Usage

```bash
pip install numpy scipy pillow
python3 ornament_mockup.py art.png out-front.png --side front
python3 ornament_mockup.py back-art.png out-back.png --side back
```

- `--side back` mirrors the **ceramic only** (gloss, edge shading and string
  lean flip; the artwork is never mirrored) so the two faces of a double-sided
  ornament don't read as the same photo with different art dropped in.
- `--blank <file>` uses a different blank photo. The disc is refit automatically.
- `--gloss <f>` (default 0.10) tunes the extra upper-left sheen.

## The blank

The default blank is `Back__Round.jpg` (Printify's 2048×2048 product photo),
kept next to the script. The geometry constants at the top of the script are for
that photo:

```python
DISC = (1021.5, 1023.5, 790.0)   # centre x, centre y, radius
HOLE = (1023.0, 406.0, 46.0)     # NOT auto-detected — set per blank
```

If Printify hands you a real front blank, pass it with `--blank` (the disc
refits automatically) but **update `HOLE`** for that photo's hole position — the
hole is the one thing not auto-detected.

## Notes

- Artwork with alpha is flattened onto white first; compositing RGBA straight
  onto the mockup is what produces dark halos at the edges.
- Art is scaled to **cover** the disc (short side fills the diameter) and
  centre-cropped, so no background shows at the edges.
- The ornament product itself: Printify blueprint **1747** (Ceramic Ornament,
  round), print provider **80** (M.i.A Merchandise, USA), variant **118761**.
  It's double-sided — photo front, `popcode.app/{slug}` on the back.

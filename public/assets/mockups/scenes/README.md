# Photoreal scene backdrops (Shop "View" switcher — Path B)

These are real Prodigi mockup renders used as backdrops on the Shop details screen
(`public/order.html`). At runtime the customer's badged photo is composited into the
frame region of each backdrop.

## How a backdrop is made (operator, one-time per product+scene)
1. Go to Prodigi's Mockup Generator: https://mockups.prodigi.com/ (sign in).
2. Pick the product + a representative **portrait** size, **straight-on** framing.
3. Upload the **solid magenta `#FF00FF` placeholder** as the artwork (see
   `_placeholder-4x5.png` / `_placeholder-1x1.png` in this folder — upload one that
   matches the size's aspect). Magenta = a single known colour so the art region can
   be auto-detected.
4. Choose **front-facing / straight-on** scenes only (no angled/perspective shots — a
   flat photo composited into an angled frame looks wrong).
5. Download each scene as a high-res **PNG**.
6. Name it `PRODUCT-SCENE.png`, e.g. `framed-wall.png`, `framed-shelf.png`,
   `print-desk.png`. Drop it in this folder and push.

## Wiring (done in code once files land)
For each file, the magenta rectangle is measured (fractions of the image) and added to
`SCENE_BACKDROPS` in `public/order.html`:

```js
SCENE_BACKDROPS = {
  framed: {
    wall:  { file: 'framed-wall.png',  rect: { x: 0.30, y: 0.18, w: 0.40, h: 0.50 } },
    shelf: { file: 'framed-shelf.png', rect: { ... } },
  },
};
```

When an entry exists it replaces the drawn scene for that product+scene; otherwise the
drawn fallback scene is used, so partial coverage is fine.

## Caveats
- **Straight-on only** — perspective scenes distort a flat composite.
- **Fixed aspect** — a backdrop is one frame shape; the photoreal scenes show that shape
  regardless of the size the customer picks. The **Studio** view stays aspect-true.
- If glass glare tints the magenta and auto-detection struggles, the rect can be measured
  by hand from the PNG instead.

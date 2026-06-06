# Vendored A-Frame 1.4.2

Self-hosted copy of A-Frame so the AR scene in `view.html` doesn't load its
rendering framework from a third-party CDN at runtime. Same dependency-ownership
logic as the MindAR vendoring (see `public/vendor/mindar/1.2.2/PROVENANCE.md`),
just lower priority because A-Frame is a larger, more stable project.

## What's here

| File | Purpose |
|------|---------|
| `aframe.min.js` | The A-Frame runtime + ECS that hosts the MindAR `mindar-image` scene. Loaded only by `view.html` (create.html / edit.html stub `window.AFRAME` instead). |

## Exact pin

- **Package:** `aframe`
- **Version:** `1.4.2`
- **Upstream repo:** https://github.com/aframevr/aframe
- **Upstream commit (npm `gitHead`):** `8692d8a5f1d45a37630c0310445d21f5fa84439a`
- **npm tarball integrity:** `sha512-/sWCOB3ZNe5dWvMknIIMi5dwfU3rIyCiV+QkfYTDK36rNGivmUrmcdkregLmZk0OGHu9WAXoeUP3n0a23n6D0A==`
- **`aframe.min.js` sha256:** `86cb0642dc14a4f554a436d4ef8377b8f4cd8090b1542b88b706767e8195eb11`

Extracted from the npm tarball; tarball sha512 matches npm's published integrity
exactly (verified at vendor time). This was previously loaded from
`https://aframe.io/releases/1.4.2/aframe.min.js`, which is built from the same
1.4.2 tag.

## A note on external URLs (NOT a problem for Popcode)

Unlike the MindAR bundle, `aframe.min.js` references a handful of remote URLs —
but they all belong to **optional features Popcode never triggers**, so the scan
flow makes no external A-Frame requests:

- `dpdb.webvr.rocks/dpdb.json` — VR/cardboard device-distortion database. VR is
  disabled in Popcode (`vr-mode-ui: enabled: false`, no cardboard UI).
- `unpkg.com/aframe-inspector` — the visual inspector, lazy-loaded only on the
  `ctrl+alt+i` keyboard shortcut. Never hit by viewers.
- `www.gstatic.com/draco/...` — Draco decoder for compressed glTF models.
  Popcode renders no 3D models.
- `fonts.googleapis.com/css` — MSDF text-component fonts. Not used.

If a future feature ever uses VR, the inspector, glTF/Draco models, or A-Frame
text fonts, those specific assets would still come from their CDNs and would
need separate vendoring.

## Re-fetch / verify this exact build

```bash
curl -fsSL https://registry.npmjs.org/aframe/-/aframe-1.4.2.tgz -o aframe-1.4.2.tgz
python3 -c "import hashlib,base64; print('sha512-'+base64.b64encode(hashlib.sha512(open('aframe-1.4.2.tgz','rb').read()).digest()).decode())"
# -> sha512-/sWCOB3ZNe5dWvMknIIMi5dwfU3rIyCiV+QkfYTDK36rNGivmUrmcdkregLmZk0OGHu9WAXoeUP3n0a23n6D0A==
tar -xzf aframe-1.4.2.tgz
cp package/dist/aframe.min.js public/vendor/aframe/1.4.2/
sha256sum public/vendor/aframe/1.4.2/aframe.min.js
# -> 86cb0642dc14a4f554a436d4ef8377b8f4cd8090b1542b88b706767e8195eb11
```

## Upgrade / rollback

Same model as MindAR: each version gets its own `public/vendor/aframe/<version>/`
directory (never overwrite a pinned dir), copy the verified `aframe.min.js` in,
write a PROVENANCE.md, then update the `<script src>` in `view.html`. Roll back
by pointing the tag at the previous version dir. **Test on real iOS hardware**
before merging an A-Frame bump — it underpins the whole AR render path.

## License

A-Frame is **MIT licensed** (Copyright © A-Frame authors) — see `LICENSE` in
this directory. Same terms as MindAR: free to use/modify/distribute/sell, just
keep the notice bundled (satisfied by the `LICENSE` file here), and the grant is
irrevocable for 1.4.2.

## Consumer

- `public/view.html` — `<script src="/vendor/aframe/1.4.2/aframe.min.js">`

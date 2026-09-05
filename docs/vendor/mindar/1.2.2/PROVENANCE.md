# Vendored MindAR 1.2.2

This directory contains a **pinned, self-hosted copy** of MindAR so that the
Popcode scan flow never depends on a third-party CDN or an upstream change we
don't control. MindAR is the image-recognition library that detects a printed
photo in the camera feed; it is the core mechanism of the whole product and is
maintained by a single individual (Hiukim Yuen). Owning the bytes that ship to
users is cheap insurance against an iOS/Chrome regression or an upstream change
stranding production.

## What's here

| File | Purpose |
|------|---------|
| `mindar-image-aframe.prod.js` | The only build Popcode loads. Bundles `MINDAR.IMAGE` (compiler + runtime) **and** registers the A-Frame `mindar-image` / `mindar-image-target` components. Used by `view.html` (AR scene) and by `create.html` / `edit.html` (compiler only). |

## Exact pin

- **Package:** `mind-ar`
- **Version:** `1.2.2` (published to npm 2023-06-04; upstream is now at 1.2.5)
- **Upstream repo:** https://github.com/hiukim/mind-ar-js
- **Upstream commit (npm `gitHead`):** `1ad668d0ba2c0cb9f57a208eede73ea43abf4972`
- **npm tarball integrity:** `sha512-bp3FOKpGesQ9DdSAYVHy6upaY4rjsMCKkKVRANpoTvNBMb/MWMUVglH2QJzDp0YmdE45tiLFR/Eoh3ZGkoK7FA==`
- **npm tarball shasum:** `cae598e7769d17cca2c67d8db41d61fdfefc178a`
- **`mindar-image-aframe.prod.js` sha256:** `db00b657ae209b279f48fabaa988e8ab13be66bd80e82c9af95e6aff7a803032`

The file is byte-identical to what the CDNs (`cdn.jsdelivr.net`, `unpkg.com`)
served — those CDNs are just mirrors of the npm registry. It was extracted
directly from the npm tarball, whose integrity hash matches npm's published
`sha512` exactly (verified at vendor time).

## Self-contained — no runtime fetches

The prod bundle inlines its Web Workers as `data:application/javascript;base64`
URIs, so it makes **no external network requests at runtime**. The only `http(s)`
strings inside it are license/docstring comments (Apache, MIT, arxiv, tfjs
issue links). There is no separate `.wasm`, no `importScripts()` of a remote
URL. Vendoring this one file is therefore complete.

## How to re-fetch / verify this exact build

```bash
# Download the authoritative npm tarball (CDNs are blocked from the sandbox;
# the npm registry is the source of truth anyway).
curl -fsSL https://registry.npmjs.org/mind-ar/-/mind-ar-1.2.2.tgz -o mind-ar-1.2.2.tgz

# Verify the tarball integrity against npm's published sha512:
python3 -c "import hashlib,base64; print('sha512-'+base64.b64encode(hashlib.sha512(open('mind-ar-1.2.2.tgz','rb').read()).digest()).decode())"
# -> sha512-bp3FOKpGesQ9DdSAYVHy6upaY4rjsMCKkKVRANpoTvNBMb/MWMUVglH2QJzDp0YmdE45tiLFR/Eoh3ZGkoK7FA==

tar -xzf mind-ar-1.2.2.tgz
cp package/dist/mindar-image-aframe.prod.js public/vendor/mindar/1.2.2/
sha256sum public/vendor/mindar/1.2.2/mindar-image-aframe.prod.js
# -> db00b657ae209b279f48fabaa988e8ab13be66bd80e82c9af95e6aff7a803032
```

## How to build a *patched* version (the fork path)

The whole point of forking is to be able to fix MindAR ourselves the same day
an iOS/Chrome regression hits, instead of waiting on a single upstream
maintainer. To produce a modified `mindar-image-aframe.prod.js`:

```bash
# 1. Fork hiukim/mind-ar-js on GitHub to curtmid/mind-ar-js (the fork repo does
#    not exist yet as of 2026-06 — see CLAUDE.md). Pin it to the 1.2.2 source:
git clone https://github.com/curtmid/mind-ar-js.git
cd mind-ar-js
git checkout 1ad668d0ba2c0cb9f57a208eede73ea43abf4972   # the 1.2.2 commit
git switch -c popcode-1.2.2-patches

# 2. Make your patch in src/ (e.g. the image-system stop()/start() lifecycle).
# 3. Build:
npm install
npm run build            # emits dist/mindar-image-aframe.prod.js (rollup; see package.json)

# 4. Copy the rebuilt artifact into a NEW version dir so the pin stays honest:
mkdir -p public/vendor/mindar/1.2.2-popcode.1
cp dist/mindar-image-aframe.prod.js public/vendor/mindar/1.2.2-popcode.1/
# 5. Record the new sha256 + the fork commit it was built from in that dir's
#    PROVENANCE.md, then point the <script> tags at the new path.
```

## Upgrade procedure (e.g. to 1.2.5)

1. Create `public/vendor/mindar/<new-version>/` — **never overwrite an existing
   pinned dir**; each version gets its own directory.
2. Fetch + verify the new tarball (same steps as above with the new version).
3. Copy `mindar-image-aframe.prod.js` in, write a PROVENANCE.md with the new
   hashes/commit.
4. Update the three `<script src="/vendor/mindar/.../mindar-image-aframe.prod.js">`
   tags in `view.html`, `create.html`, `edit.html`.
5. **Test on real iOS hardware** (including an older iPhone XR / iOS 16 if
   available) before merging — the scan/camera flow's worst bugs are iOS-Safari
   specific. See CLAUDE.md "Debugging iOS issues".

## Rollback procedure

Because each version lives in its own directory and old dirs are never deleted,
rollback is just: point the three `<script>` tags back at the previous version
path and redeploy. No re-fetch needed.

## License

MindAR is **MIT licensed** (Copyright (c) 2020 hiukim) — see `LICENSE` in this
directory. MIT lets us use/modify/distribute/sell freely; the only obligation is
to keep that notice bundled with the code (satisfied by the `LICENSE` file here).
The grant is irrevocable for 1.2.2, so this version stays MIT permanently. The
bundle also includes Apache-2.0 dependencies (TensorFlow.js et al.); their
notices ship inside the prod build itself.

## Consumers (keep in sync when the path changes)

- `public/view.html` — `<script src="/vendor/mindar/1.2.2/mindar-image-aframe.prod.js">`
- `public/create.html` — same (compiler only; stubs `window.AFRAME` first)
- `public/edit.html` — same (compiler only; stubs `window.AFRAME` first)

# Vendored MindAR 1.2.2-popcode.1 (patched: stop()/start() lifecycle fix)

This is our **own patched build** of MindAR 1.2.2 — the first time we've used
the fork to actually fix something rather than just mirror upstream. It is
identical to stock 1.2.2 except for one targeted fix to the A-Frame system's
`start()` method.

The pristine, unmodified 1.2.2 build still lives next door at
`public/vendor/mindar/1.2.2/` as the audited baseline. This directory is the
patched variant; `view.html` loads it, `create.html` / `edit.html` stay on the
pristine build (they only use the compiler, which is unchanged).

## The fix

**Problem:** MindAR 1.2.2's `stop()` then `start()` cycle leaves recognition
unable to re-fire `targetFound`. `mindar-image-target`'s `updateWorldMatrix`
only emits `targetFound` on a *not-visible → visible* transition:

```js
if (!this.el.object3D.visible && worldMatrix !== null) this.el.emit("targetFound");
this.el.object3D.visible = worldMatrix !== null;
```

Popcode calls `stop()` the instant a photo is found (to free the camera before
playing the video — the iOS-16 media-session fix), so the anchor's
`object3D.visible` is left `true`. `stop()` tears down the camera/video/
controller but never resets that flag. On the next `start()` the same photo is
re-detected, but `!visible` is now `false`, so **`targetFound` never re-emits**
and the scan looks dead. This is why `view.html` historically had to rebuild the
whole A-Frame scene (fresh entities start invisible) instead of a clean
`stop()`/`start()`.

**Patch** (`stop-start-fix.patch` in this dir): reset every anchor's visibility
at the top of `start()` so the transition can happen again. ~4 lines, no
computer-vision code touched. Full diff is in `stop-start-fix.patch`.

## Pin / provenance

- **Base:** stock `mind-ar@1.2.2`, upstream commit `1ad668d0ba2c0cb9f57a208eede73ea43abf4972`.
- **Patch:** `stop-start-fix.patch` (applies to `src/image-target/aframe.js`).
- **Built with:** the upstream `npm run build` (vite 4 prod config) on Node 22.
- **`mindar-image-aframe.prod.js` sha256:** `2470e4fb0a0cc8c6f672c4058df70d21c991805d7d4e92a6c60b5b800ac0fea3`
- **Size:** 1,734,013 bytes (stock 1.2.2 is 1,733,822 — delta is exactly the patch).

## How this build was produced (reproducible)

```bash
# 1. Get the exact 1.2.2 source:
curl -fsSL https://codeload.github.com/hiukim/mind-ar-js/tar.gz/1ad668d0ba2c0cb9f57a208eede73ea43abf4972 -o mind-ar-src.tgz
mkdir src && tar -xzf mind-ar-src.tgz -C src --strip-components=1 && cd src

# 2. Apply the patch:
patch -p1 < /path/to/stop-start-fix.patch    # touches src/image-target/aframe.js

# 3. Build the browser bundle (canvas is a node-only dep; skip its native build):
npm install --ignore-scripts
npm run build                                 # vite -> dist/mindar-image-aframe.prod.js

# 4. Vendor it:
cp dist/mindar-image-aframe.prod.js public/vendor/mindar/1.2.2-popcode.1/
sha256sum public/vendor/mindar/1.2.2-popcode.1/mindar-image-aframe.prod.js
# -> 2470e4fb0a0cc8c6f672c4058df70d21c991805d7d4e92a6c60b5b800ac0fea3
```

> Note: `npm install` without `--ignore-scripts` fails in CI/sandboxes because
> the `canvas` dependency needs Cairo system libs to compile. `canvas` is only
> used by the Node-side *offline* compiler, never by the browser bundle, so
> `--ignore-scripts` is safe for building `mindar-image-aframe.prod.js`.

## Rollout status — TESTING, not yet the default

⚠️ **Not yet verified on real iOS hardware.** The clean `stop()`/`start()`
rescan path in `view.html` is **gated behind a `?rescan=clean` query param**;
the proven scene-rebuild workaround remains the default. To test: open a scanned
project with `?rescan=clean`, scan a photo, play+close its video, then scan
again — recognition should restart **without** the home-screen bounce or scene
rebuild. Verify on a modern iPhone and (if available) an iPhone XR / iOS 16.

Once confirmed on hardware, flip the default in `view.html` and delete the
scene-rebuild workaround (`buildScene` rebuild branch in `handleStartTap`). Do
**not** remove the iOS-16 `mindar.stop()`-before-playback calls — those are a
separate, still-needed media-session fix.

## Upstream contribution

The patch is generic and worth offering upstream (`hiukim/mind-ar-js`) once
hardware-verified — it fixes `stop()`/`start()` for everyone, not just Popcode.

## Consumer

- `public/view.html` — `<script src="/vendor/mindar/1.2.2-popcode.1/mindar-image-aframe.prod.js">`

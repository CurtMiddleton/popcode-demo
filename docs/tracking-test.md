# Mural tracking test

Answers one question before any money is spent on a wall-sticker product line:
**can MindAR find and hold a large, mostly-white mural from across a room, and
which parts of the artwork are doing the work?**

Everything to date is a 5×7-to-A4 print held at arm's length. A mural is a
different regime in two ways, and both are measured here:

- **Distance.** A mural is viewed from 1–3 m, not 30 cm.
- **Empty space.** The sample artwork is over half flat white. Featureless area
  contributes nothing to tracking, so the honest unit is not "the mural" but each
  ink cluster within it — the boat, the rock, the wave band.

## Pages

| | |
|---|---|
| `public/track-build.html` | Desktop. Slices artwork into candidate regions, scores each, emits the `.mind`, a manifest and an A2 print sheet. |
| `public/track-test.html` | Phone. The AR instrument — distance, hold, tracking noise, time-to-detect. |

Both are `noindex` and neither is linked from the app.

## Running it

**1 · Build** — open `/track-build.html` on a desktop and drop the artwork in.
It proposes regions by clustering non-white ink, always including the whole
artwork as `T0` (the control). Compile, and it downloads:

- `track-test-target.mind` — all regions in one multi-target file
- `track-test-target.json` — the manifest the phone needs
- `track-test-A2.png` — the print sheet

Two ways to get those onto the phone. **AirDrop the `.mind` and `.json` and load
them with the "Load .mind + .json from Files" button** — the scan page only needs
deploying once (for HTTPS), and after that every artwork change is a drag, not a
deploy. Or commit both into `public/`, where the page picks them up by default.

**Compile resolution is a control, not a detail.** `create.html` caps compile
input at 640 px on the longest side. On a 594 mm print that is ~0.93 mm per
pixel, so 640 px may be the binding constraint rather than the artwork. Build at
640 first because that is what production does; if regions score badly, rebuild
at 1024 and see whether the numbers move. If they do, the fix is a per-product
compile cap, not different artwork.

**2 · Print** — A2 landscape, matte, **100% scale, no "fit to page"**. The sheet
carries a 100 mm ruler; check it before trusting any distance the phone reports,
because every reading scales with it. Matte matters: gloss glare is one of the
two things that reliably breaks tracking, and the Prodigi stock is matte.

**3 · Scan** — open `/track-test.html` on a phone. iOS needs HTTPS, so use the
Vercel preview, not a local server. Tap through, aim at the sheet, then **walk
backwards slowly** and watch where it lets go. Tap Results and Copy.

## Reading it

| Reading | What it means |
|---|---|
| **Detect pts** (builder) | Keypoints available to *find* the region. Under ~150 it will be slow or fail to lock. |
| **Track pts** (builder) | Keypoints available to *hold* it once found. |
| **Distance** | Live, in cm. Derived from the pose, so it depends on the print being at 100%. |
| **Hold 5s** | Fraction of the last ~5 s the target stayed locked. Below ~90% it will feel unreliable. |
| **Noise mm** | Second difference of anchor position, RMS. Smooth hand drift cancels out, so this is tracking jitter rather than the operator. Under ~1.5 mm is solid. |
| **Peak cm** | Furthest it stayed locked. The headline number. |
| **Detect ms** | Tap to first lock. |

### The calibration check, which comes first

A green wireframe rectangle is drawn on each target at exactly one scene unit
wide. MindAR's `setupMarker` scales the anchor by the target width, so that
rectangle should sit **exactly** on the printed region's edges.

If it does, the unit convention holds and the distances are real. If it is
visibly larger or smaller, every distance on screen is wrong by that factor and
nothing else on the readout should be believed until it is explained.

## Caveats

- **Noise includes the operator.** The second difference removes constant-velocity
  drift, not a deliberate wobble. Compare regions in one sitting, not across days.
- **One phone is one data point.** A recent iPhone and something older disagree
  about low-light autofocus, which is most of what tracking at distance depends on.
- **Room light is a variable and is not recorded.** Note it by hand.
- `track-test` and `track-build` must be reached **with the `.html` extension** —
  a bare `/track-test` is a single lowercase path segment and gets caught by
  `vercel.json`'s slug rewrite, landing on the viewer's "Experience not found".

## What was and wasn't verified before handover

Verified headless, driving the real pages: region proposal, the manifest round
trip, the file picker, scene construction, target and wireframe creation,
`maxTrack`, the results sheet, and — via the Hold metric reading `0%` rather than
`—` — that the tick sampling actually runs.

**Not verified: anything requiring a camera or a GPU.** This sandbox has no
camera, and its software renderer breaks MindAR's GL startup, so tracking itself,
the distance figures and the wireframe alignment are all unexercised. The first
real run is the first time those execute.

The compiler could not be run here either: MindAR inlines its workers as `data:`
URIs and this environment will not instantiate them, so `compileImageTargets`
never starts — the progress callback fires zero times. It compiles fine in a real
browser, which is where the builder is meant to run. That is why no `.mind` ships
pre-baked.

**Check the wireframe alignment first, before reading any number.** If it doesn't
sit on the printed region's edges, stop and work out why — every distance depends
on it.

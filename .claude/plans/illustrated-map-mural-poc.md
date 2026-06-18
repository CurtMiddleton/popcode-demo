# Illustrated-Map Mural — Proof-of-Concept Plan

**Goal:** De-risk the "scan a region of a map mural → get factoids/history/family-trip content" idea
*before* committing to any decal artwork. Use the existing per-creator identification system
(Phases 0–6, `popcode.app/{handle}`) to prove two things on 5 test regions:

1. **Identification separation** — CLIP can tell the 5 regions apart and reject non-map images, with a clean confidence margin (same bar Max & Addie cleared).
2. **Tracking quality** — MindAR locks onto and holds an *illustrated* region steadily on a real phone.

The variable under test is **the artwork**, not the software. MindAR matches *texture/feature points*, not borders, so this PoC is really asking: *"Is per-region illustration distinct and feature-rich enough?"*

---

## Why this is the right de-risking move

- It reuses the exact tooling that validated Max & Addie (`scripts/seed-identification.mjs`, `scripts/test-identify.mjs`, `lib/identification/*`, `public/scan.html`, `/api/identify`).
- It costs ~pennies in Replicate embeddings and a few hours of art + setup.
- A bad result is cheap and informative; a good result greenlights the decal art direction with confidence.

---

## Scope

**5 states, chosen for a deliberate range of difficulty:**

| State | Why chosen |
|---|---|
| Arizona | Distinct landscape motifs (canyon, cactus, desert palette) — should be an *easy* win |
| Georgia | Coast + peach + green palette — easy, very different from AZ |
| Texas | Iconic silhouette + bold motifs — easy |
| **Colorado** | Near-rectangle, risk of low distinctiveness — a *stress test* |
| **Wyoming** | Also near-rectangle; pairing CO+WY directly probes the "similar shapes" failure mode |

Including the two rectangular states on purpose: if CLIP separates **richly-illustrated** Colorado from Wyoming cleanly, that's the strongest possible evidence the concept holds, because shape gives it no help — only the artwork does.

---

## Art direction for the test targets (this IS the experiment)

Each test "state" image should be designed the way the real decals would be:

- **Fill the whole region with distinct illustration** — landmarks, flora/fauna, a little scene, color palette unique to that state. No flat fills.
- **High internal contrast and detail** — lots of edges/corners for MindAR feature points.
- **Avoid shared motifs across regions** — don't reuse the same background texture or icon style everywhere, or you erode inter-region distinctiveness.
- **Include the state name as text** inside the art (helps both CLIP and humans; text is feature-rich).
- Target aspect/size roughly what a child would frame when standing close to that region of a wall.

Source options for the 5 test images: hand-illustrated, stock illustration, or AI-generated illustrations. For the PoC, generated illustrations are fine — we're testing trackability, not final art.

---

## Setup steps

> All on the **`identification` Supabase branch** if it's still alive (zero prod risk). If the branch was deleted (per housekeeping notes), either recreate it or use a fresh test creator in prod gated behind `creators.new_identification_enabled=false` so nothing goes live. **Do not touch existing prod data.**

1. **Build the 5 illustrated state images** per the art direction above.
2. **Create a normal Popcode project** in `create.html` with the 5 images as photo pages. For content, attach either real placeholder videos or short factoid clips/audio — enough to confirm playback end-to-end. Note the resulting **slug**.
3. **Seed it under a test handle** (e.g. `usamap`):
   ```bash
   node scripts/seed-identification.mjs --slug <slug> --handle usamap
   ```
   (Reads the source project read-only; writes index rows + copies the `.mind` to `pop-targets`. Points at whichever Supabase env your `IDENTIFY_*` vars are set to — keep them on the branch.)
4. **Confirm the index:** 5 `pop_images` rows under the new creator, one collection, `.mind` in `pop-targets/{slug}/target.mind`.

---

## Test 1 — Identification separation (no phone needed)

Use the no-deploy CLI against the seeded index:

```bash
node scripts/test-identify.mjs --handle usamap --image <url-of-a-test-photo>
```

Run it with, at minimum:

- **A clean digital copy** of each of the 5 states → expect ~1.0 self-match.
- **A phone photo of a *printed* copy** of each state (bad light, an angle, a shadow) → this is the realistic case. Expect the correct state on top.
- **The CO vs WY pair specifically** — verify Colorado's photo tops out on Colorado, not Wyoming, and vice-versa, with margin.
- **An unrelated image** (a non-map photo) → expect rejection (all candidates below threshold).

**Pass bar (from the Max/Addie data):**
- Real print-and-capture matches land **≥ ~0.62**.
- Noise / wrong-region / unrelated stays **≤ ~0.595**.
- Each correct region wins by a visible margin over its runner-up (watch the CO↔WY margin most closely).
- Threshold **0.60** still sits cleanly in the gap.

If the rectangular pair confuses CLIP, that's the key finding — see "Levers" below.

---

## Test 2 — Tracking quality (preview deploy + real phone)

1. Deploy the branch to a **Vercel preview**, with Preview-scope `IDENTIFY_*` env pointed at the branch + `REPLICATE_API_TOKEN`. Temporarily disable Deployment Protection for phone access (**re-enable after**).
2. On a phone, open `<preview>/scan.html?handle=usamap`.
3. For each printed state: point, let it identify, confirm the video/audio **locks onto the illustration and holds steady** (no jitter/drift), and that **other pages of the set then track on-device** without another server call.

**What we're really checking:** does an *illustrated region* give MindAR enough features to track smoothly — especially the small/sparse or rectangular ones? Watch for jitter, slow lock, or drift on the weakest target.

Also note the **first-scan cold-start latency** (known open issue — Replicate cold boot ~5–15s). For a single-image/greeting-card-style decal this is *always* paid, so record it; it feeds the queued "switch embedding backend" decision (Cloudflare Workers AI / on-device CLIP).

---

## Decision gate

- **Clean separation + smooth tracking on all 5 (incl. CO/WY):** concept is validated. Write art-direction guidelines and scale up. Tackle cold-start (embedding backend) before any real launch, since a child's first scan always pays it.
- **CO/WY (or any pair) confuse CLIP:** the levers are (a) denser/more-distinct per-region art, (b) better capture UX (closer/steadier fill-frame raises real-match scores), or (c) swap in a stronger matcher via the pluggable `IdentificationProvider`. Re-test before scaling.
- **Tracking jittery on sparse regions:** push art density up and/or set a minimum on-mural region size + a "stand this close" affordance.

---

## Specific risks this PoC is designed to surface

- **Similar geometry, different art** (CO vs WY) — the make-or-break test for the whole concept.
- **Sparse illustration → poor tracking** on small regions.
- **Scan ergonomics** — region must fill enough of the frame; a giant wall means scanning a *portion*.
- **Scale** — 50 states / ~195 countries far exceeds a single `.mind`; the identification system is the answer (server identify → load just that region's small `.mind`), and this PoC exercises that path at small scale.
- **Cold-start latency** on first scan — measure it; it drives the embedding-backend decision.

---

## Out of scope for the PoC

- Final decal artwork and print production.
- World-map / country version (run the USA PoC first; same method).
- Pretty `/{handle}` routing, per-account branding, audio-project polish — all deferred until the concept is proven.

---

## Findings — PARKED (2026-06-18), and why

**Decision: shelved.** Not a failure of effort — we hit a real architectural boundary. Capturing it so a future session doesn't re-run the same exploration.

**What we tried:** generated 5 procedural "state tiles" (AZ/GA/TX/CO/WY, committed at `public/assets/map-poc/`) and a 48-medallion contact sheet to gauge whether enough distinct, trackable targets could be made. They worked *technically* but looked **tacky** — and for wall art that someone chooses to hang in their home, "tacky" is fatal. Beauty is non-negotiable for this use case.

**The fundamental tension (the real blocker):** feature-based AR (MindAR) recognizes **texture / feature density** — busy, high-contrast, detailed surfaces. Beautiful decorative maps are the *opposite by design*: flat color, negative space, clean lines, restraint. "Beautiful enough to hang" and "textured enough to track" pull in opposite directions on the same surface. Popcode's photo→video lane works *because* a photo is naturally feature-rich; a tasteful map is naturally feature-poor.

**Distinctness was NOT the bottleneck.** Procedural generation makes effectively unlimited distinct targets (50 states, 179–195 countries — trivial to generate). The hard parts are (a) physical trackability of a *small region* even at wall scale — its share of the wall stays tiny regardless of mural size — and (b) margin-at-scale for CLIP identification (the 2-book data already showed only a ~0.025 gap between match and noise; 179 candidates in one library would tighten it further).

**"Recognize borders" is a different engine.** MindAR tracks feature points, not shapes/outlines. Recognizing "this is the outline of Italy" is contour/shape classification, and *tracking* (locking media onto the region) is separate again. Not a setting to flip — a different CV bet.

**The one revival path if we ever come back to it:** don't track the tiny region — **track the whole map as one target, compute its pose, and derive each region's location by geometry** (crosshair position + known full-map pose → which region). Lets the map stay minimal/beautiful because recognition rides on the *aggregate* composition (coastlines, labels, layout), not per-region texture. **Honest catch:** at wall scale the viewer is close to one corner, so only a fraction is in frame and full-image trackers struggle with partial views — would need tiling into a few large overlapping sub-targets (which softens but doesn't fully escape the texture requirement). Bigger build than off-the-shelf MindAR.

**Bottom line:** maps want shape-based recognition + whole-surface tracking — a deliberate future bet, not a bolt-on to the current stack. Revisit only if/when that engine exists.

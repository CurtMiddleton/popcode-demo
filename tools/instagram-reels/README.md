# Instagram Reels: "Make · anything · play."

The three pinned Reels on @popcodeapp (posted 2026-09-29) are recordings of the
real home-page hero (`public/index.html`), one scene per Reel, with the big word
and the phone placed from `settings-final.json`.

## Re-record

Needs Playwright (`playwright-core`) with a Chromium and a full ffmpeg
(`pip install imageio-ffmpeg`). The site videos are H.264 MP4, which headless
Chromium can't decode, so convert them to WebM first:

    for f in public/video/*.mp4; do ffmpeg -i $f -c:v libvpx-vp9 -b:v 2M -an $S/webm/$(basename ${f%.mp4}).webm; done

Serve `public/` on :8765 (`python3 -m http.server 8765` from `public/`), then per
tile (`$S` is a working folder holding `webm/`):

    CFG='<one tile object from settings-final.json>' node record-tile.js $S "Make" albums 7500 t1
    ffmpeg -f concat -safe 0 -i $S/t1.txt -vf "scale=1080:1920,fps=30,format=yuv420p" \
      -c:v libx264 -crf 18 -movflags +faststart make.mp4

Durations: albums 7500, anything 8600, calendars 7500 ms (plus the fade out).
Each Reel starts and ends on the same frame (word + empty stage + Popcode start
screen) so it loops.

## Layout rules (432 × 768 CSS frame, recorded at 2.5×)

- Profile grid shows y 96–672 (3:4); the feed/post view shows y 114–654 (4:5).
  Keep the word and popcode.app inside 114–654.
- "play." is flush right (`"align": "right"`), the other two flush left, 24px margins.

## Tweaker

`tweaker-template.html` is the drag-and-slider page (published as a private
Artifact: https://claude.ai/artifact/EJvJqKbtkpQjGMeCxxgtQs). The placeholders
(`__COOPER__`, `__ART_*__`, `__PH_*__`) take data URIs: the CooperBT font from
`public/assets/fonts.css`, the scene webps from `public/assets/mockups/scenes/`,
and a still from each scene video. Its "Copy settings" JSON is what `CFG` takes.
It doesn't yet have the right-align switch or `urlTop`; add those by hand.

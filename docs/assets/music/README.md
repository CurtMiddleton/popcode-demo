# Montage music tracks

The montage maker offers a small curated library of background tracks. The track
list lives in `public/montage-music.js`; the actual audio files go **here**, in
`public/assets/music/`, named to match each entry's `src`.

## Required files (v1)

| File | Track name | Mood |
|---|---|---|
| `uplifting.mp3` | Uplifting | Bright & hopeful |
| `sentimental.mp3` | Sentimental | Warm & reflective |
| `cinematic.mp3` | Cinematic | Epic & sweeping |
| `playful.mp3` | Playful | Light & fun |
| `calm.mp3` | Calm | Gentle & mellow |

Until a file is present, that track still appears in the picker but the render
will fail to fetch it — so drop the files in before enabling real renders.

## Added 2026-10-16 — from Pixabay

All under the [Pixabay Content License](https://pixabay.com/service/license-summary/)
(commercial use, no credit needed; no standalone redistribution). Each was checked
on its Pixabay page to be **not** "Content ID Registered" (so users posting their
montage to YouTube don't get claims) and **not** "AI generated".

| File | Picker name | Track | Source |
|---|---|---|---|
| `nostalgic.mp3` | Nostalgic | WELC0MEИ0 – 190223 Nostalgic Piano / Twilight Sky | https://pixabay.com/music/solo-piano-190223-nostalgic-piano-twilight-sky-emotional-155489/ |
| `golden-hour.mp3` | Golden Hour | Musinova – By The Lake | https://pixabay.com/music/acoustic-group-by-the-lake-solo-acoustic-guitar-folk-276490/ |
| `bossa-nova.mp3` | Bossa Nova | Musicalmix2020 – Bossa Nova Summer | https://pixabay.com/music/bossa-nova-bossa-nova-summer-instrumental-brazil-7969/ |
| `vintage.mp3` | Vintage | alex-morgan – Cocktail Jazz | https://pixabay.com/music/modern-jazz-cocktail-jazz-556233/ |
| `after-dark.mp3` | After Dark | alex-morgan – Jazz Rainy Lounge Music | https://pixabay.com/music/modern-jazz-jazz-rainy-lounge-music-556235/ |
| `elegant.mp3` | Elegant | aidanpinsent – The Venture | https://pixabay.com/music/classical-string-quartet-the-venture-255612/ |
| `reflective.mp3` | Reflective | Luis_Humanoide – Nostalgic Violins | https://pixabay.com/music/modern-classical-nostalgic-violins-209948/ |

The original five (uplifting, sentimental, cinematic, playful, calm) were added by
hand on 2026-07-14 (commit `f3f306a`); their source wasn't recorded.

**Before adding more:** most popular Pixabay tracks are Content ID registered —
check each page (the badge sits under the player). Search with
`?content_type=authentic` to drop AI-generated tracks.

## Licensing — IMPORTANT

Only use tracks you have the right to redistribute on shared AR links. Popcode
links are public, so the safest choices are:

- **CC0 / public domain** (e.g. Pixabay Music, Free Music Archive CC0)
- **Uppbeat** (free tier, requires attribution — check terms for redistribution)
- **Epidemic Sound / Artlist** (paid, license permits web use)

Keep each file small — ~30–90s, 128 kbps MP3 is plenty (the track auto-fades and
auto-trims to the montage length). Loop-friendly tracks work best since a montage
can run shorter or longer than the clip.

## Adding a new track

1. Drop `mytrack.mp3` in this folder.
2. Add `{ id: 'mytrack', name: 'My Track', mood: '…', src: '/assets/music/mytrack.mp3' }`
   to `public/montage-music.js`.

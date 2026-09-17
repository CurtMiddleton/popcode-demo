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

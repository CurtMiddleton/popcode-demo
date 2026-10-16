// Curated background-music library for the montage maker.
//
// v1 uses a small set of royalty-free / CC0 tracks that WE host, so shared AR
// links carry no copyright risk (unlike letting users upload their own songs).
//
// Each `src` is an absolute path served from public/. The actual .mp3 files must
// be dropped into public/assets/music/ — see public/assets/music/README.md.
// Shotstack fetches the track by its public URL (popcode.app + src) at render
// time, so a track only works once its file is deployed.
//
// To add a track: add an entry here + drop the matching .mp3 in assets/music/,
// and record where it came from (`source`, `license`) — the first five predate
// that and their source wasn't recorded.
window.MONTAGE_MUSIC = [
  { id: 'none',       name: 'No music',   mood: '',           src: null },
  { id: 'uplifting',  name: 'Uplifting',  mood: 'Bright & hopeful', src: '/assets/music/uplifting.mp3' },
  { id: 'sentimental',name: 'Sentimental',mood: 'Warm & reflective', src: '/assets/music/sentimental.mp3' },
  { id: 'cinematic',  name: 'Cinematic',  mood: 'Epic & sweeping',  src: '/assets/music/cinematic.mp3' },
  { id: 'playful',    name: 'Playful',    mood: 'Light & fun',      src: '/assets/music/playful.mp3' },
  { id: 'calm',       name: 'Calm',       mood: 'Gentle & mellow',  src: '/assets/music/calm.mp3' },
  // Added 2026-10-16 from Pixabay (Pixabay Content License: commercial use, no
  // credit needed). Each was checked to be NOT registered with YouTube Content
  // ID and NOT marked AI-generated on its Pixabay page.
  { id: 'nostalgic',  name: 'Nostalgic',  mood: 'Wistful piano',    src: '/assets/music/nostalgic.mp3',
    credit: 'WELC0MEИ0 – 190223 Nostalgic Piano / Twilight Sky', source: 'https://pixabay.com/music/solo-piano-190223-nostalgic-piano-twilight-sky-emotional-155489/', license: 'Pixabay' },
  { id: 'golden-hour',name: 'Golden Hour',mood: 'Warm acoustic', src: '/assets/music/golden-hour.mp3',
    credit: 'Musinova – By The Lake', source: 'https://pixabay.com/music/acoustic-group-by-the-lake-solo-acoustic-guitar-folk-276490/', license: 'Pixabay' },
  { id: 'bossa-nova', name: 'Bossa Nova', mood: 'Breezy & sunny',   src: '/assets/music/bossa-nova.mp3',
    credit: 'Musicalmix2020 – Bossa Nova Summer', source: 'https://pixabay.com/music/bossa-nova-bossa-nova-summer-instrumental-brazil-7969/', license: 'Pixabay' },
  { id: 'vintage',    name: 'Vintage',    mood: 'Cocktail jazz',    src: '/assets/music/vintage.mp3',
    credit: 'alex-morgan – Cocktail Jazz', source: 'https://pixabay.com/music/modern-jazz-cocktail-jazz-556233/', license: 'Pixabay' },
  { id: 'after-dark', name: 'After Dark', mood: 'Late-night jazz',  src: '/assets/music/after-dark.mp3',
    credit: 'alex-morgan – Jazz Rainy Lounge Music', source: 'https://pixabay.com/music/modern-jazz-jazz-rainy-lounge-music-556235/', license: 'Pixabay' },
  { id: 'elegant',    name: 'Elegant',    mood: 'String quartet',   src: '/assets/music/elegant.mp3',
    credit: 'aidanpinsent – The Venture', source: 'https://pixabay.com/music/classical-string-quartet-the-venture-255612/', license: 'Pixabay' },
  { id: 'reflective', name: 'Reflective', mood: 'Tender violins',   src: '/assets/music/reflective.mp3',
    credit: 'Luis_Humanoide – Nostalgic Violins', source: 'https://pixabay.com/music/modern-classical-nostalgic-violins-209948/', license: 'Pixabay' },
];

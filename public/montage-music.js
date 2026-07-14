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
// To add a track: add an entry here + drop the matching .mp3 in assets/music/.
window.MONTAGE_MUSIC = [
  { id: 'none',       name: 'No music',   mood: '',           src: null },
  { id: 'uplifting',  name: 'Uplifting',  mood: 'Bright & hopeful', src: '/assets/music/uplifting.mp3' },
  { id: 'sentimental',name: 'Sentimental',mood: 'Warm & reflective', src: '/assets/music/sentimental.mp3' },
  { id: 'cinematic',  name: 'Cinematic',  mood: 'Epic & sweeping',  src: '/assets/music/cinematic.mp3' },
  { id: 'playful',    name: 'Playful',    mood: 'Light & fun',      src: '/assets/music/playful.mp3' },
  { id: 'calm',       name: 'Calm',       mood: 'Gentle & mellow',  src: '/assets/music/calm.mp3' },
];

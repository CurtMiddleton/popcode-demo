// Curated Unsplash sample photos for shop previews (random per page load).
// Hotlinked from images.unsplash.com — the account has Unsplash Pro, and the
// CDN serves Access-Control-Allow-Origin: * so canvas compositing works
// (loaders must still set img.crossOrigin = 'anonymous').
//
// Every ID below was verified to return 200. Consumers should keep a local
// fallback (e.g. /assets/sample-leopard.jpg) for offline/blocked cases.
//
// unsplashSample(w)      → one random URL sized to width w (default 1600)
// unsplashSamples(n, w)  → n distinct random URLs
(function () {
  const IDS = [
    'photo-1506905925346-21bda4d32df4', // mountain peak at dusk
    'photo-1501785888041-af3ef285b470', // lake + mountains
    'photo-1441974231531-c6227db76b6e', // sunlit forest road
    'photo-1470071459604-3b5ec3a7fe05', // foggy hills
    'photo-1507525428034-b723cf961d3e', // beach
    'photo-1500530855697-b586d89ba3ee', // misty mountains
    'photo-1469474968028-56623f02e42e', // sunray mountain valley
    'photo-1502082553048-f009c37129b9', // green leaves
    'photo-1504674900247-0877df9cc836', // dinner spread
    'photo-1517841905240-472988babdf9', // portrait
    'photo-1529626455594-4ff0802cfb7e', // portrait
    'photo-1518791841217-8f162f1e1131', // cat
    'photo-1583511655857-d19b40a7a54e', // puppy
    'photo-1548199973-03cce0bbc87b',    // dogs running
    'photo-1511895426328-dc8714191300', // family
    'photo-1476514525535-07fb3b4ae5f1', // canoe on lake
    'photo-1519681393784-d120267933ba', // starry mountain night
    'photo-1499363536502-87642509e31b', // travel
    'photo-1519098901909-b1553a1190af', // coastal cliffs
  ];
  const url = (id, w) => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=' + (w || 1600) + '&q=80';
  window.unsplashSample = function (w) {
    return url(IDS[Math.floor(Math.random() * IDS.length)], w);
  };
  window.unsplashSamples = function (n, w) {
    const pool = IDS.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    // If more are asked for than we have, repeat from the shuffled pool.
    const out = [];
    for (let i = 0; i < n; i++) out.push(url(pool[i % pool.length], w));
    return out;
  };
})();

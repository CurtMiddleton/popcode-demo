// POST /api/identify-warm — boot the Replicate embedding model ahead of time so
// the FIRST (or a single-image) scan isn't slowed by a cold start. scan.html
// fires this fire-and-forget on page load; the model boots while the user is
// granting the camera and aiming, so the first real /api/identify hits a warm
// model. No DB, no logging — just an embed to spin up the container.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1x1 transparent PNG — just enough of an image to make the model run/boot.
  const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  try {
    const { embedImageFromUrl } = await import('../lib/identification/embed.mjs');
    await embedImageFromUrl(TINY_PNG).catch(() => {}); // result discarded; boot is the point
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(200).json({ ok: false }); // never surface warm-up failures
  }
}

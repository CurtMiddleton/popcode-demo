// Word timings for an audio page's transcript, so the viewer's "Follow along"
// lights each word as it is spoken. Used by create.html and edit.html when
// they save; the server side is api/align-transcript.js (ElevenLabs forced
// alignment). Never throws: any failure (no API key yet, network, a mismatch)
// resolves to null, the page saves without timings, and the viewer falls back
// to timing by word length.
window.alignTranscript = async function (db, audioUrl, transcript) {
  if (!audioUrl || !transcript || !String(transcript).trim()) return null;
  try {
    const session = (await db.auth.getSession()).data.session;
    if (!session) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 55000);
    const resp = await fetch('/api/align-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ audio_url: audioUrl, transcript }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));
    if (!resp.ok) return null;
    const { timing } = await resp.json();
    return Array.isArray(timing) && timing.length ? timing : null;
  } catch (e) {
    return null;
  }
};

// Insert collection_items rows; if the transcript_timing column isn't there
// yet (2026-10-11-transcript-timing.sql not run), insert again without it.
window.insertItemsWithTiming = async function (db, rows) {
  let { error } = await db.from('collection_items').insert(rows);
  if (error && /transcript_timing/.test(error.message || '')) {
    ({ error } = await db.from('collection_items').insert(rows.map(r => { const c = { ...r }; delete c.transcript_timing; return c; })));
  }
  return { error };
};

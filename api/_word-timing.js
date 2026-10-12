// Turns an ElevenLabs forced-alignment result into one [start, end] pair per
// word of the transcript, where a word is a run of non-whitespace characters.
// view.html splits the transcript the same way (text.split(/(\s+)/)), so the
// pairs line up with its word spans by index.

export function transcriptWords(text) {
  const out = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(text))) out.push({ text: m[0], offset: m.index });
  return out;
}

const round = t => Math.round(Number(t) * 100) / 100;

export function wordTimings(text, alignment) {
  const words = transcriptWords(text);
  if (!words.length || !alignment) return null;
  const chars = Array.isArray(alignment.characters) ? alignment.characters : [];

  // Preferred: one alignment entry per character of the text we sent.
  if (chars.length === text.length) {
    return words.map(w => [round(chars[w.offset].start), round(chars[w.offset + w.text.length - 1].end)]);
  }

  // Otherwise match ElevenLabs' own words (minus whitespace entries) in order.
  const aw = (Array.isArray(alignment.words) ? alignment.words : []).filter(x => x && /\S/.test(x.text || ''));
  if (aw.length === words.length) return aw.map(x => [round(x.start), round(x.end)]);

  // Or rebuild the words from the characters, ignoring whitespace entries.
  const rebuilt = [];
  let cur = null;
  for (const c of chars) {
    if (!c || !/\S/.test(c.text || '')) { cur = null; continue; }
    if (!cur) { cur = [c.start, c.end]; rebuilt.push(cur); } else cur[1] = c.end;
  }
  if (rebuilt.length === words.length) return rebuilt.map(([s, e]) => [round(s), round(e)]);
  return null;
}

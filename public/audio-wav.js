// Normalize recorded audio to a mono 22.05 kHz 16-bit WAV.
//
// Why: desktop Chrome/Firefox MediaRecorder records `audio/webm;codecs=opus`,
// which iOS Safari CANNOT decode or play at all — so a Popcode recorded on a
// computer plays fine on desktop but is silent on every iPhone/iPad. WAV (PCM)
// is the one format every platform plays. iOS's own recordings are already
// `audio/mp4` (AAC) and play everywhere, so callers should only convert
// webm/ogg blobs and leave mp4/m4a as-is.
(function () {
  function encodeWav(audioBuffer) {
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.getChannelData(0); // mono
    const n = samples.length;
    const buffer = new ArrayBuffer(44 + n * 2);
    const view = new DataView(buffer);
    const w = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); view.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    w(36, 'data'); view.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  // Returns a Promise<Blob> (audio/wav). Throws if the browser can't decode the
  // input — callers should catch and fall back to the original blob.
  window.audioToWav = async function (blob) {
    const AC = window.AudioContext || window.webkitAudioContext;
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || !OAC) throw new Error('Web Audio unavailable');
    const arrayBuf = await blob.arrayBuffer();
    const ctx = new AC();
    let decoded;
    try {
      decoded = await new Promise((res, rej) => {
        // Callback form for older Safari; modern browsers also resolve the promise.
        const p = ctx.decodeAudioData(arrayBuf, res, rej);
        if (p && p.then) p.then(res, rej);
      });
    } finally { try { ctx.close(); } catch (e) {} }
    const targetRate = 22050;
    const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const off = new OAC(1, length, targetRate);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return encodeWav(rendered);
  };

  // Convenience: only convert formats iOS can't play (webm/ogg). Returns
  // { blob, ext } — the original if conversion isn't needed or fails.
  window.normalizeAudio = async function (blob, ext) {
    const t = (blob && blob.type || '') + ' ' + (ext || '');
    if (!/webm|ogg/i.test(t) || !window.audioToWav) return { blob, ext: ext || 'webm' };
    try { return { blob: await window.audioToWav(blob), ext: 'wav' }; }
    catch (e) { return { blob, ext: ext || 'webm' }; }
  };
})();

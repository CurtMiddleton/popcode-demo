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

  // An audio file the creator chose instead of recording (an MP3 from a
  // voiceover tool, a curator's recording). Checked, normalized like a
  // recording, and named so the save code picks the right extension and
  // content type. Resolves to a File; rejects with a message to show.
  const AUDIO_TYPES = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', webm: 'audio/webm', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg' };
  const TYPE_EXTS = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/webm': 'webm', 'audio/ogg': 'ogg' };
  window.MAX_AUDIO_UPLOAD_MB = 25;
  window.AUDIO_UPLOAD_ACCEPT = 'audio/*,.mp3,.m4a,.aac,.wav';
  window.prepareAudioUpload = async function (file) {
    const nameExt = ((file.name || '').split('.').pop() || '').toLowerCase();
    const ext = AUDIO_TYPES[nameExt] ? nameExt : TYPE_EXTS[(file.type || '').split(';')[0]];
    if (!ext) throw new Error("That file isn't audio we can play. Choose an MP3, M4A or WAV.");
    if (file.size > window.MAX_AUDIO_UPLOAD_MB * 1024 * 1024) {
      throw new Error(`That file is ${(file.size / 1048576).toFixed(0)} MB. Audio can be up to ${window.MAX_AUDIO_UPLOAD_MB} MB.`);
    }
    if (file.size === 0) throw new Error('That file is empty.');
    const typed = new File([file], `upload.${ext}`, { type: AUDIO_TYPES[ext] });
    const norm = await window.normalizeAudio(typed, ext);
    return norm.blob === typed ? typed : new File([norm.blob], `upload.${norm.ext}`, { type: norm.blob.type || AUDIO_TYPES[norm.ext] });
  };
})();

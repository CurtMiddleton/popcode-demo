// create-popcode.js — the Popcode creation pipeline as a reusable function.
//
// Factored from public/create.html (the proven, iOS-hardened flow). Used by the
// product-first wizard (shop.html). create.html still has its own inline copy;
// migrating it onto this module is a planned low-risk follow-up.
//
// Requires the MindAR compiler (vendored /vendor/mindar/1.2.2/...) and a Supabase
// client to be available. Photos are resized to ≤640px before compilation to
// avoid iOS memory crashes (same as create.html).
//
//   const { slug, collectionId } = await createPopcodeProject({
//     db,                 // supabase client
//     userId,             // collections.user_id
//     name,               // project name (nullable)
//     slug,               // optional; auto-generated if omitted
//     pairs: [{ photo: File, video: File|null, audio: File|null, mediaType: 'video'|'audio' }],
//     onProgress,         // optional (label, pct) => void
//   });
(function (global) {
  function randomSlug() { return Math.random().toString(36).substring(2, 10); }

  // Load a File into an <img>, resizing to ≤640px (the compile dim) to keep
  // MindAR off the iOS memory cliff. Returns an HTMLImageElement.
  async function loadResizedImage(file) {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error(`Could not load photo "${file.name}". Make sure it is a valid image file.`));
    });
    const MAX = 640;
    if (img.naturalWidth <= MAX && img.naturalHeight <= MAX) return img;
    const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight);
    const rc = document.createElement('canvas');
    rc.width = Math.round(img.naturalWidth * scale);
    rc.height = Math.round(img.naturalHeight * scale);
    rc.getContext('2d').drawImage(img, 0, 0, rc.width, rc.height);
    const resized = new Image();
    await new Promise((resolve, reject) => {
      resized.onload = resolve;
      resized.onerror = () => reject(new Error(`Could not process photo "${file.name}". Try a different image.`));
      resized.src = rc.toDataURL('image/jpeg', 0.92);
    });
    return resized;
  }

  // Let the browser repaint before the CPU-heavy compile (MindAR saturates the
  // main thread; without a yield the progress label never paints).
  function yieldToPaint() {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }

  async function createPopcodeProject(o) {
    const db = o.db;
    const userId = o.userId;
    const pairs = (o.pairs || []).filter((p) => p && p.photo && (p.mediaType === 'audio' ? p.audio : p.video));
    const onProgress = o.onProgress || function () {};
    const slug = o.slug || randomSlug();
    if (!db) throw new Error('createPopcodeProject: missing db client');
    if (!userId) throw new Error('createPopcodeProject: missing userId');
    if (!pairs.length) throw new Error('Add at least one photo with a video or audio.');
    if (typeof MINDAR === 'undefined' || !MINDAR.IMAGE || !MINDAR.IMAGE.Compiler) {
      throw new Error('MindAR compiler not loaded yet. Please wait a moment and try again.');
    }

    // 1. Load + resize photos.
    onProgress('Loading photos…', 2);
    const images = [];
    for (const pair of pairs) images.push(await loadResizedImage(pair.photo));

    // 2. Compile the .mind image targets.
    onProgress('Compiling image targets… (this can take a minute)', 5);
    await yieldToPaint();
    let mindBlob;
    try {
      const compiler = new MINDAR.IMAGE.Compiler();
      await compiler.compileImageTargets(images, (progress) => {
        onProgress(`Compiling image targets… ${Math.round(progress)}%`, 5 + progress * 0.45);
      });
      mindBlob = new Blob([await compiler.exportData()]);
    } catch (err) {
      throw new Error('Image target compilation failed — ' + (err.message || 'Check that your photos are clear, flat images.'));
    }

    // 3. Upload the .mind.
    onProgress('Uploading image targets…', 55);
    let mindUrl;
    {
      const { error } = await db.storage.from('experiences')
        .upload(`${slug}/target.mind`, mindBlob, { contentType: 'application/octet-stream' });
      if (error) throw new Error('Uploading image targets failed — ' + (error.message || 'Check your connection.'));
      mindUrl = db.storage.from('experiences').getPublicUrl(`${slug}/target.mind`).data.publicUrl + `?v=${Date.now()}`;
    }

    // 4. Upload each pair's media + photo.
    const mediaItems = [];
    for (let i = 0; i < pairs.length; i++) {
      onProgress(`Uploading photo ${i + 1} of ${pairs.length}…`, 60 + (i / pairs.length) * 25);
      const pair = pairs[i];
      const item = { type: pair.mediaType, video_url: null, audio_url: null, photo_url: null };

      if (pair.mediaType === 'video') {
        if (!pair.video || pair.video.size === 0) throw new Error(`Video ${i + 1} is empty — please re-add it.`);
        const { error } = await db.storage.from('experiences')
          .upload(`${slug}/video_${i}.mp4`, pair.video, { contentType: pair.video.type || 'video/mp4' });
        if (error) throw new Error(`Video ${i + 1}: ${error.message}`);
        item.video_url = db.storage.from('experiences').getPublicUrl(`${slug}/video_${i}.mp4`).data.publicUrl;
      } else {
        if (!pair.audio || pair.audio.size === 0) throw new Error(`Audio ${i + 1} is empty — please re-record it.`);
        const ext = (pair.audio.name && pair.audio.name.split('.').pop()) || 'webm';
        const { error } = await db.storage.from('experiences')
          .upload(`${slug}/audio_${i}.${ext}`, pair.audio, { contentType: pair.audio.type || 'audio/webm' });
        if (error) throw new Error(`Audio ${i + 1}: ${error.message}`);
        item.audio_url = db.storage.from('experiences').getPublicUrl(`${slug}/audio_${i}.${ext}`).data.publicUrl;
      }

      const photoExt = pair.photo.name.split('.').pop() || 'jpg';
      const { error: pErr } = await db.storage.from('experiences')
        .upload(`${slug}/photo_${i}.${photoExt}`, pair.photo, { contentType: pair.photo.type || 'image/jpeg' });
      if (pErr) throw new Error(`Photo ${i + 1}: ${pErr.message}`);
      item.photo_url = db.storage.from('experiences').getPublicUrl(`${slug}/photo_${i}.${photoExt}`).data.publicUrl;

      mediaItems.push(item);
    }

    // 5. Insert the collection.
    onProgress('Saving project…', 90);
    const { data: collection, error: colErr } = await db.from('collections')
      .insert({ slug, name: o.name || null, mind_file_url: mindUrl, user_id: userId })
      .select().single();
    if (colErr) throw new Error('Saving project failed — ' + (colErr.message || 'Your files uploaded but the project record could not be saved.'));

    // 6. Insert the collection_items (one per photo → each its own scannable target).
    const items = mediaItems.map((m, i) => ({
      collection_id: collection.id, target_index: i,
      media_type: m.type, video_url: m.video_url, audio_url: m.audio_url, photo_url: m.photo_url,
    }));
    const { error: itemsErr } = await db.from('collection_items').insert(items);
    if (itemsErr) throw new Error('Saving photo items failed — ' + (itemsErr.message || 'The project was created but its items could not be saved.'));

    onProgress('Done!', 100);
    return {
      slug, collectionId: collection.id, collection,
      photos: mediaItems.map((m, i) => ({ target_index: i, photo_url: m.photo_url })),
    };
  }

  global.createPopcodeProject = createPopcodeProject;
})(window);

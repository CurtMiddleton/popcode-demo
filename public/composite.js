// Shared Popcode badge compositor — bakes the scan badge into a photo so the
// printed product stays scannable. Extracted from manage.html's compositeImage so
// order.html and manage.html can share one implementation.
//
// window.compositeBadgedImage(photoUrl, opts) -> Promise<dataURL 'image/png'>
//   opts.scale         badge size as a fraction of the photo's shorter side (default 0.06)
//   opts.previewCanvas optional <canvas> to draw a fitted thumbnail into
//
// window.dataUrlToBlob(dataUrl) -> Blob  (for uploading the composited PNG)
(function () {
  async function compositeBadgedImage(photoUrl, opts) {
    opts = opts || {};
    var scale = typeof opts.scale === 'number' ? opts.scale : 0.06;
    var previewCanvas = opts.previewCanvas || null;

    var img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise(function (resolve, reject) {
      img.onload = resolve; img.onerror = reject;
      img.src = photoUrl;
    });

    var iconImg = new Image();
    await new Promise(function (resolve, reject) {
      iconImg.onload = resolve; iconImg.onerror = reject;
      iconImg.src = '/assets/popcode_icon.svg';
    });

    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Badge in the lower-right corner; size + padding scale off the shorter side so
    // the corner margin reads consistently at any aspect ratio.
    var badgeSize = Math.round(Math.min(c.width, c.height) * scale);
    var pad = Math.round(Math.min(c.width, c.height) * 0.025);
    ctx.drawImage(iconImg, c.width - badgeSize - pad, c.height - badgeSize - pad, badgeSize, badgeSize);

    if (previewCanvas) {
      var pc = previewCanvas.getContext('2d');
      var s = Math.min(previewCanvas.width / c.width, previewCanvas.height / c.height);
      var pw = Math.round(c.width * s);
      var ph = Math.round(c.height * s);
      pc.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      pc.drawImage(c, (previewCanvas.width - pw) / 2, (previewCanvas.height - ph) / 2, pw, ph);
    }

    return c.toDataURL('image/png');
  }

  function dataUrlToBlob(dataUrl) {
    var parts = dataUrl.split(',');
    var mime = (parts[0].match(/:(.*?);/) || [null, 'image/png'])[1];
    var bin = atob(parts[1]);
    var len = bin.length;
    var arr = new Uint8Array(len);
    for (var i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  window.compositeBadgedImage = compositeBadgedImage;
  window.dataUrlToBlob = dataUrlToBlob;
})();

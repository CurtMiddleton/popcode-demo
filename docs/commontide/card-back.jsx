// Common Tide card back (address side), 9 x 6 in, built in InDesign.
// Mirrors public/demo/commontide/card-back.html. Measurements are in inches
// from the top-left corner, same as the CSS.
//
// Run: InDesign > Window > Utilities > Scripts, right-click "User" >
// Reveal in Finder, drop this file in, then double-click it in the panel.
//
// Fonts: The Seasons (Adobe Fonts) and Inter. Activate both first; anything
// missing shows up pink and InDesign lists it under Type > Find/Replace Font.
//
// Images are left as empty frames. Select one and File > Place:
//   "Marisol photo" and "Walt photo": the EXACT square stills you upload to
//   popcode.app/commontide as targets 1 and 2. The circle crop and sage ring
//   must print the same as the uploaded target, or the scan won't match.
//   "Logo": logo-forest.png. "Popcode icon": popcode_symbol_color.svg.
//
// USPS: the bottom 5/8 in of the right 4-3/4 in is the barcode clear zone.
// Nothing here prints there; keep it that way.

#target indesign

(function () {
  var W = 9, H = 6;

  var doc = app.documents.add({
    documentPreferences: {
      pageWidth: W + "in", pageHeight: H + "in", facingPages: false, pagesPerDocument: 1,
      documentBleedTopOffset: 0, documentBleedBottomOffset: 0,
      documentBleedInsideOrLeftOffset: 0, documentBleedOutsideOrRightOffset: 0
    }
  });
  doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
  doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;
  doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
  doc.zeroPoint = [0, 0];
  var page = doc.pages[0];
  page.marginPreferences.properties = { top: 0, left: 0, bottom: 0, right: 0 };

  // ── Swatches (RGB, matching the web artboard) ──────────────────────
  function swatch(name, r, g, b) {
    var c = doc.colors.itemByName(name);
    if (c.isValid) return c;
    return doc.colors.add({ name: name, model: ColorModel.PROCESS, space: ColorSpace.RGB, colorValue: [r, g, b] });
  }
  var C = {
    cream:   swatch("CT Cream",    247, 243, 237),
    ink:     swatch("CT Ink",       31,  42,  38),
    body:    swatch("CT Body",      59,  67,  63),
    muted:   swatch("CT Muted",    109, 116, 111),
    sage:    swatch("CT Sage",     164, 205, 135),
    forest:  swatch("CT Forest",    31, 107,  70),
    forestD: swatch("CT Forest Dark", 23, 84, 58),
    rule:    swatch("CT Rule",     217, 208, 192),
    tan:     swatch("CT Tan",      155, 122,  74),
    white:   doc.swatches.itemByName("Paper"),
    none:    doc.swatches.itemByName("None")
  };

  var SERIF = "The Seasons", SANS = "Inter";

  // ── Helpers ───────────────────────────────────────────────────────
  function rect(y1, x1, y2, x2, fill, opts) {
    var r = page.rectangles.add({ geometricBounds: [y1, x1, y2, x2] });
    r.fillColor = fill || C.none;
    r.strokeWeight = 0;
    if (opts) r.properties = opts;
    return r;
  }
  function oval(y1, x1, y2, x2, props) {
    var o = page.ovals.add({ geometricBounds: [y1, x1, y2, x2] });
    o.properties = props;
    return o;
  }
  function line(y1, x1, y2, x2, color, weightPt) {
    var l = page.graphicLines.add();
    l.paths[0].entirePath = [[x1, y1], [x2, y2]];
    l.strokeColor = color; l.strokeWeight = weightPt;
    return l;
  }
  // runs: [{ t, font, style, size, color, track, lead, caps, space }]
  // Put "\r" at the end of a run to start a new paragraph.
  function text(y1, x1, y2, x2, runs, frameOpts) {
    var tf = page.textFrames.add({ geometricBounds: [y1, x1, y2, x2] });
    tf.textFramePreferences.insetSpacing = [0, 0, 0, 0];
    tf.textFramePreferences.firstBaselineOffset = FirstBaseline.CAP_HEIGHT;
    if (frameOpts) tf.textFramePreferences.properties = frameOpts;
    var story = tf.parentStory;
    for (var i = 0; i < runs.length; i++) {
      var r = runs[i];
      var start = story.characters.length;
      story.insertionPoints[-1].contents = r.t;
      var rng = story.characters.itemByRange(start, story.characters.length - 1);
      try { rng.appliedFont = r.font + "\t" + (r.style || "Regular"); } catch (e) { rng.appliedFont = r.font; }
      rng.pointSize = r.size;
      rng.fillColor = r.color || C.ink;
      if (r.tint !== undefined) rng.fillTint = r.tint;
      rng.tracking = r.track || 0;
      rng.leading = r.lead || Leading.AUTO;
      rng.capitalization = r.caps ? Capitalization.ALL_CAPS : Capitalization.NORMAL;
      if (r.space !== undefined) rng.spaceAfter = r.space + "in";
    }
    return tf;
  }
  function placeholder(frame, label) {
    frame.label = label;
    frame.name = label;
  }

  // ── Background ────────────────────────────────────────────────────
  rect(0, 0, H, W, C.cream).locked = true;

  // Tan tab (echoes the front's Giving Tuesday label)
  rect(0, 0, 0.42, 3.44, C.tan);
  text(0.155, 0.36, 0.34, 3.4, [
    { t: "Two more stories on this card", font: SANS, style: "Semi Bold", size: 8.5, color: C.white, track: 200, caps: true }
  ]);

  // Return address, beside the tab
  placeholder(rect(0.13, 3.62, 0.257, 4.67, C.none, { strokeWeight: 0 }), "Logo");
  text(0.3, 3.62, 0.42, 5.3, [
    { t: "PO Box 214, Port Alder, WA 98368", font: SANS, size: 6, color: C.muted }
  ]);

  // ── Headline + how-to ─────────────────────────────────────────────
  text(0.64, 0.36, 0.98, 5.4, [
    { t: "Meet the people who were there.", font: SERIF, size: 21, color: C.ink, track: -10 }
  ]);
  placeholder(rect(1.0, 0.36, 1.2, 0.56), "Popcode icon");
  text(1.05, 0.64, 1.2, 5.3, [
    { t: "Go to ", font: SANS, size: 7.5, color: C.body },
    { t: "commontide.org/givingtuesday", font: SANS, style: "Semi Bold", size: 7.5, color: C.forestD },
    { t: ", then point your phone at a photo.", font: SANS, size: 7.5, color: C.body }
  ]);

  // ── Story circles (scan targets 1 and 2) ──────────────────────────
  // Disc 1.42 in; sage ring .03 in wide, .045 in outside the photo.
  function story(top, left, textW, name, role, body, photoLabel) {
    var d = 1.42, ringOff = 0.06;
    oval(top - ringOff, left - ringOff, top + d + ringOff, left + d + ringOff,
      { fillColor: C.none, strokeColor: C.sage, strokeWeight: 2.16, strokeAlignment: StrokeAlignment.CENTER_ALIGNMENT });
    var disc = oval(top, left, top + d, left + d, { fillColor: C.rule, strokeWeight: 0 });
    placeholder(disc, photoLabel);
    var tx = left + d + 0.18;
    text(top, tx, top + d, tx + textW, [
      { t: name + "\r", font: SERIF, size: 13, color: C.ink, space: 0.03 },
      { t: role + "\r", font: SANS, style: "Semi Bold", size: 5.8, color: C.forest, track: 140, caps: true, space: 0.04 },
      { t: body + "\r", font: SANS, size: 7, lead: 9.7, color: C.body, space: 0.05 },
      { t: "Scan to watch · 1 min", font: SANS, style: "Semi Bold", size: 5.8, color: C.forestD, track: 100, caps: true }
    ], { verticalJustification: VerticalJustification.CENTER_ALIGN });
  }
  story(1.30, 0.36, 3.35, "Marisol Reyes", "The ecologist",
    "For eleven springs, Marisol walked the Tillinghast marsh counting salmon, and mostly counting what wasn’t there. Three weeks after the dam came down, she found them holding in the current. In her video she takes you to the exact spot.",
    "Marisol photo");
  story(2.76, 1.31, 2.4, "Walt Pruitt", "Why I give",
    "Walt fished this coast for forty years and watched the runs thin out. When his grandson asked where the salmon went, he didn’t have a good answer, so he became a Tide Keeper. He’ll tell you why $20 a month felt like the least he could do.",
    "Walt photo");

  // ── Address panel ─────────────────────────────────────────────────
  line(0.72, 5.58, 4.1, 5.58, C.rule, 0.75);

  rect(0.36, 7.59, 1.04, 8.64, C.none, { strokeColor: C.ink, strokeWeight: 0.75 });
  text(0.42, 7.59, 1.0, 8.64, [
    { t: "Nonprofit Org\rU.S. Postage\rPaid\rPort Alder, WA\rPermit No. 42", font: SANS, style: "Semi Bold", size: 6, lead: 7.8, color: C.ink, track: 40, caps: true }
  ], { verticalJustification: VerticalJustification.CENTER_ALIGN }).paragraphs.everyItem().justification = Justification.CENTER_ALIGN;

  text(1.95, 5.95, 2.1, 8.6, [
    { t: "Address service requested", font: SANS, size: 6.5, color: C.muted, track: 80, caps: true }
  ]);
  text(2.2, 5.95, 2.8, 8.6, [
    { t: "Ruth Ellison\r1420 Harbor View Rd\rPort Alder, WA 98368", font: SANS, size: 9, lead: 12.6, color: C.ink }
  ]);

  // ── No phone? Give anyway. Stops .72 in above the bottom (USPS clear zone).
  var gy1 = H - 0.72 - 0.86, gy2 = H - 0.72, gx1 = 0.36, gx2 = W - 0.36;
  rect(gy1, gx1, gy2, gx2, C.forest);
  var leadW = 1.95;
  rect(gy1, gx1, gy2, gx1 + leadW, C.forestD);
  var pad = 0.16;
  text(gy1, gx1 + pad, gy2, gx1 + leadW - pad, [
    { t: "No phone handy?\rYou can still give.\r", font: SERIF, size: 12.5, lead: 13.2, color: C.white, space: 0.05 },
    { t: "Every gift through December 1 is matched, up to $25,000.", font: SANS, size: 6.5, lead: 8.8, color: C.white, tint: 82 }
  ], { verticalJustification: VerticalJustification.CENTER_ALIGN });

  var rest = (gx2 - gx1 - leadW), unit = rest / 3.2;
  var cols = [
    { w: unit,       k: "Online",   v: "commontide.org/give",               s: "Or give monthly and become a Tide Keeper." },
    { w: unit,       k: "By phone", v: "(360) 555-0142",                    s: "Weekdays, 9 to 5. A real person answers." },
    { w: unit * 1.2, k: "By mail",  v: "PO Box 214\rPort Alder, WA 98368", s: "Make checks payable to Common Tide." }
  ];
  var x = gx1 + leadW;
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    line(gy1, x, gy2, x, C.white, 0.75).strokeTint = 16;
    text(gy1, x + pad, gy2, x + c.w - pad, [
      { t: c.k + "\r", font: SANS, style: "Bold", size: 6, color: C.sage, track: 180, caps: true, space: 0.05 },
      { t: c.v + "\r", font: SANS, style: "Semi Bold", size: 8.5, lead: 10.6, color: C.white, space: 0.04 },
      { t: c.s, font: SANS, size: 6.2, lead: 8.4, color: C.white, tint: 78 }
    ], { verticalJustification: VerticalJustification.CENTER_ALIGN });
    x += c.w;
  }

  // ── Fine print + sage bar (bar stays left of the USPS clear zone) ─
  text(5.5, 0.36, 5.72, 4.16, [
    { t: "Common Tide is a 501(c)(3) nonprofit, and your gift is tax-deductible as allowed by law. Demo: Common Tide is a fictional organization created to show how Popcode works.", font: SANS, size: 5.5, lead: 7.4, color: C.muted }
  ]);
  rect(H - 0.14, 0, H, 4.2, C.sage);

  alert("Common Tide card back built.\n\nPlace images into the frames named Marisol photo, Walt photo, Logo and Popcode icon (Window > Layers shows them by name).");
})();

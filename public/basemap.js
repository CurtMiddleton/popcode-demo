/*
 * English-labelled base map for the analytics maps (Web traffic + Map tab).
 *
 *   PopcodeBasemap.add(leafletMap) → Promise
 *
 * OpenStreetMap's own raster tiles label every place in its local script
 * (Россия, 中国, مصر …), which made the web-traffic map hard to read, and OSM
 * has no English tile set. OpenFreeMap serves the same OSM data as vector
 * tiles — free, no key, commercial use allowed — and the data carries English
 * names. Its Positron style prints latin + local script side by side, so every
 * label layer is rewritten here to name:en, falling back to the Latin
 * spelling, then the local name, where a place has no English one. Rendered by MapLibre GL inside Leaflet
 * (maplibre-gl-leaflet), so the pins, popups and shading code stay Leaflet.
 *
 * If anything fails (old browser without WebGL, CDN down) it falls back to the
 * OSM raster tiles: local-language labels, but still a map.
 */
(function () {
  'use strict';

  var STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
  var MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';
  var MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
  var BRIDGE_JS = 'https://cdn.jsdelivr.net/npm/@maplibre/maplibre-gl-leaflet@0.1.4/leaflet-maplibre-gl.js';
  var ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  // English name, else the name spelled in Latin letters (Мякинино → Myakinino),
  // else whatever the place is called locally.
  // (Not name_en: in OpenMapTiles it silently falls back to the local name.)
  var ENGLISH = ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']];

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  var stylePromise = null;
  function englishStyle() {
    if (!stylePromise) {
      if (!document.querySelector('link[href="' + MAPLIBRE_CSS + '"]')) {
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.href = MAPLIBRE_CSS;
        document.head.appendChild(l);
      }
      var libs = (window.maplibregl ? Promise.resolve() : loadScript(MAPLIBRE_JS))
        .then(function () { return window.L && window.L.maplibreGL ? null : loadScript(BRIDGE_JS); });
      var style = fetch(STYLE_URL).then(function (r) {
        if (!r.ok) throw new Error('Map style: HTTP ' + r.status);
        return r.json();
      }).then(function (st) {
        (st.layers || []).forEach(function (ly) {
          var tf = ly.layout && ly.layout['text-field'];
          // Only labels built from a place name; road shields and house
          // numbers (ref, housenumber) are left alone.
          if (tf && /name/.test(JSON.stringify(tf))) ly.layout['text-field'] = ENGLISH;
        });
        return st;
      });
      stylePromise = Promise.all([libs, style]).then(function (r) { return r[1]; })
        .catch(function (e) { stylePromise = null; throw e; });
    }
    return stylePromise;
  }

  function webglOk() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }

  function rasterFallback(map) {
    return window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, className: 'basemap-raster',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
  }

  function add(map) {
    if (!webglOk()) return Promise.resolve(rasterFallback(map));
    return englishStyle().then(function (style) {
      // A fresh copy per map: MapLibre keeps a reference to the object.
      return window.L.maplibreGL({ style: JSON.parse(JSON.stringify(style)), attribution: ATTRIBUTION }).addTo(map);
    }).catch(function (e) {
      console.warn('English base map unavailable, using OSM tiles:', e);
      return rasterFallback(map);
    });
  }

  window.PopcodeBasemap = { add: add };
})();

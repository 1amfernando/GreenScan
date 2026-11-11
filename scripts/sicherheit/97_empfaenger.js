// Gruppe n2 — Datenschutz-Rest (v33.59). Wer bekommt was, und steht er in
// der Erklaerung? Drei Fragen:
//   1. Geht der Standort an einen fremden Dienst (Wetter, Ortsname) nur
//      gerundet (_gsOrtGrob, 2 Nachkommastellen, ~1 km)? Gelesen wird die
//      ADRESSE der Anfrage, die die echte Funktion stellt (gestelltes _gsFetch)
//      — und daneben: der Ort auf dem Geraet bleibt genau, der Ortsname
//      erscheint wie vorher, und ein zweiter Aufruf mit demselben Ort fragt
//      NICHT noch einmal (der Zwischenspeicher gilt weiter als frisch).
//   2. Spricht die Karte einen toten Dienst an (Stamen, seit 2023 abgeschaltet)?
//      Und ein gespeicherter Ebenen-Name, den es nicht mehr gibt, faellt auf
//      eine vorhandene Ebene zurueck statt eine leere Karte zu zeigen.
//   3. Nennt die Datenschutzerklaerung IN DER APP dieselben Empfaenger wie
//      privacy.html §4 — und jeder Host, den der Code anspricht, hat einen
//      Namen in BEIDEN Texten? Die Liste HOSTS unten ist die Pruefung: ein
//      neuer Host ohne Eintrag ist rot.
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');

// Genaue Koordinaten mit sechs Stellen — gerundet MUSS daraus 47.38 / 8.54 werden.
const GENAU = { lat: 47.376887, lon: 8.541694 };

// Werkzeug in der Seite: ein gestelltes _gsFetch, das jede Adresse mitschreibt
// und je Dienst eine plausible Antwort gibt.
async function fang(seite) {
  await seite.evaluate(() => {
    const W = window.__em = { urls: [] };
    const seedWetter = (() => { try { const c = JSON.parse(localStorage.getItem('gs_weather_cache') || 'null'); return c && c.data; } catch (e) { return null; } })();
    const heute = new Date().toISOString().slice(0, 10);
    const tage = [0, 1, 2, 3].map(i => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10));
    const wetter = seedWetter || {
      current_weather: { temperature: 12, weathercode: 1, windspeed: 5 },
      daily: { time: tage, weathercode: [1, 1, 1, 1], temperature_2m_max: [15, 15, 15, 15], temperature_2m_min: [5, 5, 5, 5], precipitation_sum: [0, 0, 0, 0] },
    };
    W.antwort = (u) => {
      if (/nominatim\.openstreetmap\.org\/reverse/.test(u)) return { address: { town: 'Testdorf', state: 'Testkanton', postcode: '8000' } };
      if (/geocoding-api\.open-meteo\.com/.test(u)) return { results: [{ latitude: 46.849123, longitude: 9.531987, name: 'Testort', country: 'Schweiz', country_code: 'CH', admin1: 'Graubünden' }] };
      if (/api\.open-meteo\.com\/v1\/forecast/.test(u)) {
        return Object.assign({}, wetter, {
          current: { temperature_2m: 12, weather_code: 1, wind_speed_10m: 5, relative_humidity_2m: 70, uv_index: 2, precipitation: 0, soil_temperature_6cm: 12 },
          hourly: { time: [heute + 'T00:00'], weather_code: [1], wind_speed_10m: [5], precipitation_probability: [0], temperature_2m: [12] },
          daily: Object.assign({}, wetter.daily || {}, { time: tage, weather_code: [1, 1, 1, 1], temperature_2m_max: [15, 15, 15, 15], temperature_2m_min: [5, 5, 5, 5], precipitation_sum: [0, 0, 0, 0], sunshine_duration: [0, 0, 0, 0], uv_index_max: [2, 2, 2, 2] }),
        });
      }
      return {};
    };
    window._gsFetch = async (url) => {
      const u = String(url); W.urls.push(u); (window.__emAlle = window.__emAlle || []).push(u);
      const j = W.antwort(u);
      return { ok: true, status: 200, json: async () => j, text: async () => JSON.stringify(j) };
    };
    // Die Koordinaten aus einer Adresse: jeder Parameter, der lat/lon heisst.
    W.koord = (u) => {
      const q = u.split('?')[1] || ''; const out = [];
      q.split('&').forEach(kv => { const [k, v] = kv.split('='); if (/^(lat|lon|lng|latitude|longitude)$/.test(k)) out.push({ k, v: decodeURIComponent(v || '') }); });
      return out;
    };
    // Mehr als zwei Nachkommastellen = genauer als ~1 km.
    W.zuGenau = (u) => W.koord(u).filter(x => /\.\d{3,}/.test(x.v));
  });
}

// Jeder Host, den index.html oder sw.js nennt: wer ist das, und warum?
//   name:  der Empfaenger, wie er in BEIDEN Erklaerungen steht
//   link:  nur eine Adresse, die die PERSON oeffnet (Navigation) — kein Empfaenger der App
//   eigen: unsere eigene Adresse
//   kommentar: steht nur in einem Kommentar (alte Fassung)
const HOSTS = {
  'green-scan.ch': { eigen: true },
  'vowbiueikwrauuceilhc.supabase.co': { name: 'Supabase' },
  'api.anthropic.com': { name: 'Anthropic' },
  'api.open-meteo.com': { name: 'Open-Meteo' },
  'geocoding-api.open-meteo.com': { name: 'Open-Meteo' },
  'nominatim.openstreetmap.org': { name: 'Nominatim' },
  'wmts.geo.admin.ch': { name: 'swisstopo' },
  'server.arcgisonline.com': { name: 'Esri' },
  '{s}.tile.opentopomap.org': { name: 'OpenTopoMap' },
  '{s}.tile.openstreetmap.org': { name: 'OpenStreetMap' },
  'en.wikipedia.org': { name: 'Wikipedia' },
  'de.wikipedia.org': { link: 'Suche auf Wikipedia (Knopf im Scan-Ergebnis)' },
  'www.openstreetmap.org': { link: 'Fundort auf der OSM-Karte ansehen (Knopf im Scan-Ergebnis)' },
  'console.anthropic.com': { link: 'Hinweis, wo man einen eigenen Schluessel holt' },
  'dashboard.stripe.com': { link: 'Verkaeufer-Dashboard (window.open auf Knopfdruck)' },
  'www.infoflora.ch': { link: 'Platzhalter in einem Eingabefeld' },
  'vapko.ch': { link: 'Verweis auf die Pilzkontrolle' },
  'www.edoeb.admin.ch': { link: 'Verweis auf die Aufsichtsbehoerde' },
  'unpkg.com': { kommentar: 'v25.36: Leaflet/Three liegen selbst gehostet unter assets/' },
  'fremd': { kommentar: 'sw.js: Beispiel im Kommentar zu swSafeUrl' },
};
// Empfaenger, die kein Host im Code sind, sondern die App selbst ausliefern bzw. ueber eine Navigation kommen.
const OHNE_HOST = {
  'Cloudflare': 'liefert die App aus (Cloudflare Pages)',
  'Netlify': 'liefert die App aus (zweiter Hoster, CLAUDE.md §2.1)',
  'Stripe': 'Zahlung ueber eine Weiterleitung auf checkout.stripe.com (frame-src/form-action), die Adresse kommt vom Server',
};

function hostsImCode() {
  const out = new Map();
  for (const f of ['index.html', 'sw.js']) {
    const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /https:\/\/([a-z0-9{}][a-z0-9{}.-]*[a-z0-9}])/gi; let m;
    while ((m = re.exec(txt))) { const h = m[1].toLowerCase(); if (!out.has(h)) out.set(h, f + ':' + txt.slice(0, m.index).split('\n').length); }
  }
  return out;
}
function privacyEmpfaenger() {
  const html = fs.readFileSync(path.join(ROOT, 'privacy.html'), 'utf8');
  const s4 = html.split(/<h2>4 · /)[1].split(/<h2>5 · /)[0];
  const namen = [];
  s4.replace(/<tr><td>([^<]+)<\/td>/g, (_, z) => { z.split(/·/).forEach(n => { n = n.replace(/\(.*?\)/g, '').trim(); if (n) namen.push(n); }); return _; });
  return { namen, text: s4.replace(/<[^>]+>/g, ' ') };
}

module.exports = [
  {
    name: 'Wetter · loadGardenWeather: an Open-Meteo nur ~1 km (47.38/8.54), der Zwischenspeicher behaelt den genauen Ort, und ein zweiter Aufruf mit demselben Ort fragt NICHT noch einmal',
    lauf: async (seite) => {
      await fang(seite);
      const r = await seite.evaluate(async (G) => {
        const W = window.__em;
        localStorage.setItem('gs_user_location', JSON.stringify({ lat: G.lat, lon: G.lon, lng: G.lon, name: 'Zürich', canton: 'ZH', country: 'CH' }));
        localStorage.removeItem('gs_weather_cache');
        try { userLocation = JSON.parse(localStorage.getItem('gs_user_location')); } catch (e) {}
        _gsWeatherLoaded = false; _gsWeatherData = null;
        await loadGardenWeather(true);
        const n1 = W.urls.filter(u => /api\.open-meteo\.com\/v1\/forecast/.test(u)).length;
        const cache = JSON.parse(localStorage.getItem('gs_weather_cache') || 'null');
        _gsWeatherLoaded = false;          // wie ein neuer Start: der Speicher muss tragen
        await loadGardenWeather(false);
        const n2 = W.urls.filter(u => /api\.open-meteo\.com\/v1\/forecast/.test(u)).length;
        const u = W.urls.find(x => /api\.open-meteo\.com\/v1\/forecast/.test(x)) || '';
        return { n1, n2, koord: W.koord(u), zuGenau: W.zuGenau(u), cache: cache && { lat: cache.lat, lon: cache.lon }, wLat: _gsWeatherLat };
      }, GENAU);
      if (r.n1 !== 1) return { ok: false, warum: 'erste Wetter-Anfrage fehlt: ' + JSON.stringify(r) };
      if (r.zuGenau.length) return { ok: false, warum: 'Open-Meteo bekommt den genauen Ort: ' + JSON.stringify(r.koord) };
      const lat = r.koord.find(x => x.k === 'latitude'), lon = r.koord.find(x => x.k === 'longitude');
      if (!lat || lat.v !== '47.38' || !lon || lon.v !== '8.54') return { ok: false, warum: 'gerundeter Ort falsch: ' + JSON.stringify(r.koord) };
      if (!r.cache || r.cache.lat !== r.wLat) return { ok: false, warum: 'Zwischenspeicher traegt eine andere Form als der Leser vergleicht: ' + JSON.stringify(r) };
      if (r.n2 !== 1) return { ok: false, warum: 'zweiter Aufruf mit demselben Ort fragte erneut (' + r.n2 + ' Anfragen) — der Zwischenspeicher gilt nie als frisch' };
      return { ok: true, info: 'latitude=47.38&longitude=8.54 · Speicher lat=' + r.cache.lat + ' · 2. Aufruf: 0 Anfragen' };
    },
  },
  {
    name: 'Wetter · gsAttachMushroomForecast (Pilz-Wachstum): an Open-Meteo nur ~1 km',
    lauf: async (seite) => {
      await fang(seite);
      const r = await seite.evaluate(async (G) => {
        const W = window.__em;
        localStorage.setItem('gs_user_location', JSON.stringify({ lat: G.lat, lng: G.lon, lon: G.lon, name: 'Zürich' }));
        const card = document.createElement('div'); document.body.appendChild(card);
        await gsAttachMushroomForecast(card, {});
        const u = W.urls.find(x => /api\.open-meteo\.com/.test(x)) || '';
        const txt = card.textContent; card.remove();
        return { u, koord: W.koord(u), zuGenau: W.zuGenau(u), txt: txt.slice(0, 80) };
      }, GENAU);
      if (!r.u) return { ok: false, warum: 'keine Anfrage gestellt — der Fall misst nichts' };
      if (r.zuGenau.length) return { ok: false, warum: 'genauer Ort an Open-Meteo: ' + JSON.stringify(r.koord) };
      if (!/latitude=47\.38&longitude=8\.54/.test(r.u)) return { ok: false, warum: 'Adresse unerwartet: ' + r.u };
      return { ok: true, info: 'latitude=47.38&longitude=8.54 · Karte: ' + r.txt.slice(0, 40) };
    },
  },
  {
    name: 'Ortsname · loadHomeWeather ueber GPS: Nominatim und Open-Meteo bekommen ~1 km, gespeichert wird der genaue Ort, der Ortsname erscheint wie vorher',
    lauf: async (seite) => {
      await fang(seite);
      const r = await seite.evaluate(async (G) => {
        const W = window.__em;
        ['gs_user_location', 'gs_home_weather_loc', 'gs_weather_loc_mode', 'gs_gardens'].forEach(k => localStorage.removeItem(k));
        try { userLocation = null; } catch (e) {}
        Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: G.lat, longitude: G.lon, accuracy: 10 } }), 10) } });
        if (!document.getElementById('home-weather-widget')) { const d = document.createElement('div'); d.id = 'home-weather-widget'; document.body.appendChild(d); }
        await loadHomeWeather();
        const nom = W.urls.find(x => /nominatim\.openstreetmap\.org\/reverse/.test(x)) || '';
        const fc = W.urls.find(x => /api\.open-meteo\.com\/v1\/forecast/.test(x)) || '';
        const loc = JSON.parse(localStorage.getItem('gs_user_location') || 'null');
        const w = document.getElementById('home-weather-widget');
        return { nom, fc, zu: W.zuGenau(nom).concat(W.zuGenau(fc)), loc, txt: w ? w.textContent : '' };
      }, GENAU);
      if (!r.nom || !r.fc) return { ok: false, warum: 'Anfragen fehlen — der Fall misst nichts: ' + JSON.stringify({ nom: r.nom, fc: r.fc }) };
      if (r.zu.length) return { ok: false, warum: 'genauer Ort an Dritte: ' + JSON.stringify(r.zu) + ' in ' + r.nom };
      if (!/lat=47\.38&lon=8\.54/.test(r.nom) || !/latitude=47\.38&longitude=8\.54/.test(r.fc)) return { ok: false, warum: 'Adressen unerwartet: ' + r.nom + ' | ' + r.fc };
      if (!r.loc || r.loc.lat !== G_LAT || r.loc.name !== 'Testdorf') return { ok: false, warum: 'gespeicherter Ort nicht der genaue bzw. Ortsname fehlt: ' + JSON.stringify(r.loc) };
      if (r.txt.indexOf('Testdorf') < 0) return { ok: false, warum: 'Ortsname erscheint nicht im Wetter-Widget: ' + r.txt.slice(0, 120) };
      return { ok: true, info: 'Nominatim lat=47.38&lon=8.54 · Open-Meteo 47.38/8.54 · gespeichert ' + r.loc.lat + ' · „Testdorf" im Widget' };
    },
  },
  {
    name: 'Ortsname · gsReverseGeocode (Standort-Erkennung in den Einstellungen): Nominatim bekommt ~1 km, zurueck kommt der genaue Ort mit Ortsname und Kanton',
    lauf: async (seite) => {
      await fang(seite);
      const r = await seite.evaluate(async (G) => {
        const W = window.__em;
        const loc = await new Promise(res => gsReverseGeocode(G.lat, G.lon, res));
        const u = W.urls.find(x => /nominatim/.test(x)) || '';
        return { u, zu: W.zuGenau(u), loc };
      }, GENAU);
      if (!r.u) return { ok: false, warum: 'keine Anfrage gestellt' };
      if (r.zu.length) return { ok: false, warum: 'genauer Ort an Nominatim: ' + r.u };
      if (r.loc.lat !== G_LAT || r.loc.lon !== G_LON || r.loc.name !== 'Testdorf' || r.loc.canton !== 'Testkanton') return { ok: false, warum: 'Rueckgabe veraendert: ' + JSON.stringify(r.loc) };
      return { ok: true, info: r.u.replace(/^.*\?/, '') + ' · zurueck ' + r.loc.lat + '/' + r.loc.lon + ' Testdorf, Testkanton' };
    },
  },
  {
    name: 'Wetter · fetchWeather (Planer, Ort per Name): die Vorhersage bekommt die Koordinaten des Ortes nur auf ~1 km',
    lauf: async (seite) => {
      await fang(seite);
      const r = await seite.evaluate(async () => {
        const W = window.__em;
        try { await fetchWeather('Testort ' + Date.now()); } catch (e) { return { fehler: String(e && e.message) }; }
        const u = W.urls.find(x => /api\.open-meteo\.com\/v1\/forecast/.test(x)) || '';
        return { u, zu: W.zuGenau(u) };
      });
      if (r.fehler) return { ok: false, warum: 'fetchWeather warf: ' + r.fehler };
      if (!r.u) return { ok: false, warum: 'keine Vorhersage angefragt' };
      if (r.zu.length) return { ok: false, warum: 'genauer Ort an Open-Meteo: ' + r.u };
      if (!/latitude=46\.85&longitude=9\.53/.test(r.u)) return { ok: false, warum: 'Adresse unerwartet: ' + r.u };
      return { ok: true, info: 'latitude=46.85&longitude=9.53' };
    },
  },
  {
    name: 'Ortssuche · kein Weg schickt einen Ort mit mehr als zwei Nachkommastellen an Open-Meteo oder Nominatim (alle Adressen dieser Datei, Gegenrichtung: ohne Anfragen ist der Fall rot)',
    lauf: async (seite) => {
      const r = await seite.evaluate(() => { const W = window.__em, A = window.__emAlle || []; return W ? { n: A.filter(u => /open-meteo|nominatim/.test(u)).length, zu: A.filter(u => W.zuGenau(u).length) } : null; });
      if (!r || !r.n) return { ok: false, warum: 'keine Anfrage gesehen — der Fall misst nichts' };
      if (r.zu.length) return { ok: false, warum: 'zu genau: ' + r.zu.join(' | ') };
      return { ok: true, info: r.n + ' Anfragen an Dritte, alle ≤ 2 Nachkommastellen' };
    },
  },
  {
    // Gegenpruefung: auch der SERVER schickt Orte an Open-Meteo (Frost-Push, Wetter-Warnung) —
    // daily-push-checker gab gps_lat/gps_lng ungerundet weiter. Statisch: jede Koordinate in einer
    // Open-Meteo-/Nominatim-Adresse einer Edge-Function stammt aus einer Rundung im selben Rumpf.
    name: 'Server · jede Edge-Function schickt an Open-Meteo/Nominatim nur einen gerundeten Ort (Math.round … oder das Raster gridKey)',
    lauf: async () => {
      const basis = path.join(ROOT, 'supabase', 'functions');
      const funde = [], gesehen = [];
      for (const d of fs.readdirSync(basis)) {
        const f = path.join(basis, d, 'index.ts');
        if (!fs.existsSync(f)) continue;
        const txt = fs.readFileSync(f, 'utf8');
        const re = /https:\/\/(?:api\.open-meteo\.com|nominatim\.openstreetmap\.org)[^`'"]*?(?:latitude|lat)=\$\{([A-Za-z_$][\w$.]*)\}[^`'"]*?(?:longitude|lon|lng)=\$\{([A-Za-z_$][\w$.]*)\}/g;
        let m;
        while ((m = re.exec(txt))) {
          const vorher = txt.slice(Math.max(0, m.index - 1500), m.index);
          const gerundet = (v) => new RegExp('\\b' + v.replace(/[.$]/g, '\\$&') + '\\b[^;\\n]*=\\s*(?:Math\\.round|[^;\\n]*gridKey|[^;\\n]*key\\.split)').test(vorher)
            || new RegExp('\\[[^\\]]*\\b' + v + '\\b[^\\]]*\\]\\s*=\\s*key\\.split').test(vorher);
          gesehen.push(d);
          if (!gerundet(m[1]) || !gerundet(m[2])) funde.push(d + ': ' + m[1] + '/' + m[2] + ' ungerundet');
        }
      }
      if (!gesehen.length) return { ok: false, warum: 'keine Adresse mit Koordinaten gefunden — der Fall misst nichts' };
      if (funde.length) return { ok: false, warum: funde.join(' · ') };
      return { ok: true, info: gesehen.length + ' Adressen (' + [...new Set(gesehen)].join(', ') + '), alle gerundet' };
    },
  },
  {
    name: 'Karte · keine Ebene zeigt auf Stamen (seit 2023 abgeschaltet), jeder Knopf der Ebenen-Wahl hat seine Ebene, und ein gespeichertes „hybrid" faellt auf „Satellit" zurueck — 0 Anfragen an fastly',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        if (typeof L === 'undefined') await new Promise(res => { const s = document.createElement('script'); s.src = 'assets/leaflet.js'; s.onload = res; s.onerror = res; document.head.appendChild(s); });
        if (typeof L === 'undefined') return { fehler: 'Leaflet nicht geladen' };
        const urls = [];
        Object.keys(GS_MAP_LAYERS).forEach(k => { const c = GS_MAP_LAYERS[k]; urls.push(c.url); if (c.overlay) urls.push(c.overlay.url); });
        const knoepfe = Array.from(document.querySelectorAll('.gs-map-lb')).map(b => (b.getAttribute('onclick') || '').replace(/^.*gsSetLayer\('([^']+)'.*$/, '$1'));
        localStorage.setItem('gs_map_layer', 'hybrid');
        try { gsStore.set('gs_map_layer', 'hybrid'); } catch (e) {}
        const div = document.getElementById('gs-map-div');
        const sc = document.getElementById('screen-map') || (div && div.closest('.screen'));
        if (sc) { sc.style.display = 'block'; }
        if (div) { div.style.width = '400px'; div.style.height = '400px'; }
        if (gsMap) { try { gsMap.remove(); } catch (e) {} gsMap = null; }
        gsCreateMap();
        // Gelesen SOFORT: ohne Netz scheitern die Kacheln, und der Fehler-Waechter wechselt nach fuenf Fehlern auf osm.
        const layer = gsMapCurrentLayer;
        await new Promise(r => setTimeout(r, 600));
        return { urls, knoepfe, ebenen: Object.keys(GS_MAP_LAYERS), layer, vorhanden: !!GS_MAP_LAYERS[layer], kacheln: document.querySelectorAll('#gs-map-div img.leaflet-tile').length };
      });
      if (r.fehler) return { ok: false, warum: r.fehler };
      const a = h.anfragen();
      const tot = r.urls.filter(u => /stamen|fastly/.test(u));
      if (tot.length) return { ok: false, warum: 'Ebene zeigt auf einen toten Dienst: ' + tot.join(', ') };
      const unbekannt = r.knoepfe.filter(k => !k || r.ebenen.indexOf(k) < 0);
      if (unbekannt.length) return { ok: false, warum: 'Knopf ohne Ebene: ' + JSON.stringify(r.knoepfe) };
      if (r.layer !== 'sat' || !r.vorhanden) return { ok: false, warum: 'gespeichertes „hybrid" landet auf ' + r.layer + ' (vorhanden: ' + r.vorhanden + ')' };
      if (a.some(u => /stamen|fastly/.test(u))) return { ok: false, warum: 'Kachel-Anfrage an Stamen: ' + a.filter(u => /stamen|fastly/.test(u))[0] };
      if (!a.some(u => /arcgisonline/.test(u))) return { ok: false, warum: 'die Satelliten-Ebene laedt keine Kachel — der Fall misst nichts (' + a.length + ' Anfragen)' };
      return { ok: true, info: r.knoepfe.length + ' Knoepfe, alle mit Ebene · „hybrid" → sat · ' + a.filter(u => /arcgisonline/.test(u)).length + ' Esri-Kacheln, 0 an fastly' };
    },
  },
  {
    name: 'Empfaenger · die Datenschutzerklaerung in der App nennt jeden Empfaenger aus privacy.html §4, und jeder Host im Code ist eingeordnet und steht mit seinem Namen in BEIDEN Texten',
    lauf: async (seite) => {
      const app = await seite.evaluate(() => { showLegalTab('datenschutz'); const el = document.getElementById('legal-content'); return el ? el.textContent : ''; });
      const pv = privacyEmpfaenger();
      if (pv.namen.length < 8) return { ok: false, warum: 'privacy.html §4 nicht gelesen: ' + JSON.stringify(pv.namen) };
      const kern = (n) => n.split(/\s+/)[0];
      const fehltApp = pv.namen.filter(n => app.indexOf(kern(n)) < 0);
      if (fehltApp.length) return { ok: false, warum: 'in privacy.html, aber nicht in der App: ' + fehltApp.join(', ') };
      const code = hostsImCode();
      const unbekannt = [...code.keys()].filter(hh => !HOSTS[hh]);
      if (unbekannt.length) return { ok: false, warum: 'Host im Code ohne Einordnung: ' + unbekannt.map(hh => hh + ' (' + code.get(hh) + ')').join(', ') };
      const namen = new Set(Object.values(HOSTS).filter(x => x.name).map(x => x.name));
      const nichtGenannt = [...namen].filter(n => app.indexOf(n) < 0 || pv.text.indexOf(n) < 0);
      if (nichtGenannt.length) return { ok: false, warum: 'Empfaenger angesprochen, aber nicht in beiden Texten: ' + nichtGenannt.join(', ') };
      // Gegenrichtung: jeder Empfaenger in privacy.html wird vom Code wirklich angesprochen.
      const ohneHost = pv.namen.map(kern).filter(n => !namen.has(n) && !OHNE_HOST[n]);
      if (ohneHost.length) return { ok: false, warum: 'in privacy.html genannt, vom Code nicht angesprochen: ' + ohneHost.join(', ') };
      // Kein Host steht in der Erklaerung, den die App nicht anspricht.
      const domains = (pv.text.match(/\b[a-z0-9-]+\.(?:com|org|net|ch|io)\b/gi) || []).filter(d => !/green-scan\.ch|greenscan\.ch/.test(d));
      const fremdeDom = domains.filter(d => ![...code.keys()].some(hh => hh.endsWith(d.toLowerCase())));
      if (fremdeDom.length) return { ok: false, warum: 'privacy.html nennt einen Host, den die App nicht anspricht: ' + fremdeDom.join(', ') };
      return { ok: true, info: pv.namen.length + ' Empfaenger in privacy.html · alle in der App · ' + code.size + ' Hosts im Code eingeordnet' };
    },
  },
];
const G_LAT = GENAU.lat, G_LON = GENAU.lon;

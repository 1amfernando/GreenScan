// 99_schluss_c.js — Funde der Schluss-Gegenpruefung, die die Hauptsitzung selbst behoben hat.
//
// Linse b, Fund 5: _gsFremdBild laesst data:image-Adressen durch, _gsVerifySpeciesImage holte
// sie aber mit fetch() — und connect-src in _headers erlaubt kein data:. Unter der CSP der
// Auslieferung scheiterte der fetch immer; der KI-Gegencheck eines Artenbilds war fuer genau
// diese Bilder dauerhaft „nicht pruefbar" (null). Der Fall misst deshalb nicht, OB der fetch
// gelingt (file:// hat keine CSP), sondern DASS es keinen gibt.
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

module.exports = [
  {
    name: 'Artenbild-Gegencheck · eine data:-Adresse wird gelesen, nicht geholt (connect-src erlaubt kein data:) — der eigene Speicher wird geholt, Fremdes gar nicht angesehen',
    lauf: async (seite) => {
      const r = await seite.evaluate(async (PNG) => {
        const echtFetch = window.fetch, echtKi = window.callVisionAI;
        const geholt = [], ki = [];
        window.fetch = async function (u) {
          geholt.push(String(u));
          return { ok: true, blob: async () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) };
        };
        window.callVisionAI = async function (b64, mt) { ki.push({ n: String(b64 || '').length, mt: mt }); return 'JA'; };
        const out = {};
        try {
          out.data = await _gsVerifySpeciesImage(PNG, 'Bärlauch', 'Allium ursinum');
          out.dataFetch = geholt.length; out.dataKi = ki.slice();
          // Gross geschriebener Typ: _gsFremdBild nimmt ihn an, der Leser muss es auch.
          geholt.length = 0; ki.length = 0;
          out.gross = await _gsVerifySpeciesImage(PNG.replace('data:image/png', 'data:IMAGE/PNG'), 'Bärlauch', '');
          out.grossFetch = geholt.length; out.grossMt = ki[0] && ki[0].mt;
          // Gegenrichtung 1: der eigene Speicher wird wirklich geholt.
          geholt.length = 0; ki.length = 0;
          const eigen = String(SB_URL_DEFAULT).replace(/\/+$/, '') + '/storage/v1/object/public/species-images/a/b.png';
          out.eigen = await _gsVerifySpeciesImage(eigen, 'Bärlauch', '');
          out.eigenFetch = geholt.slice(); out.eigenKi = ki.length;
          // Gegenrichtung 2: eine fremde Adresse — kein fetch, kein KI-Aufruf, „nicht pruefbar".
          geholt.length = 0; ki.length = 0;
          out.fremd = await _gsVerifySpeciesImage('https://boese.example/x.png', 'Bärlauch', '');
          out.fremdFetch = geholt.length; out.fremdKi = ki.length;
        } finally { window.fetch = echtFetch; window.callVisionAI = echtKi; }
        return out;
      }, PNG);
      if (r.data !== true) return { ok: false, warum: 'data:-Bild: Gegencheck liefert ' + JSON.stringify(r.data) + ' statt true' };
      if (r.dataFetch !== 0) return { ok: false, warum: 'data:-Bild wurde mit fetch geholt (' + r.dataFetch + '×) — unter der CSP scheitert das immer' };
      if (!r.dataKi.length || r.dataKi[0].mt !== 'image/png' || r.dataKi[0].n < 40) return { ok: false, warum: 'die KI bekam nicht das Bild aus der Adresse: ' + JSON.stringify(r.dataKi) };
      if (r.gross !== true || r.grossFetch !== 0 || r.grossMt !== 'image/png') return { ok: false, warum: 'gross geschriebener Typ: ' + JSON.stringify({ r: r.gross, fetch: r.grossFetch, mt: r.grossMt }) };
      if (r.eigen !== true || r.eigenFetch.length !== 1 || r.eigenKi !== 2) return { ok: false, warum: 'eigener Speicher: ' + JSON.stringify({ r: r.eigen, fetch: r.eigenFetch, ki: r.eigenKi }) };
      if (r.fremd !== null || r.fremdFetch !== 0 || r.fremdKi !== 0) return { ok: false, warum: 'fremde Adresse: ' + JSON.stringify({ r: r.fremd, fetch: r.fremdFetch, ki: r.fremdKi }) };
      return { ok: true, info: 'data: → gelesen (0 fetch, 2 KI-Fragen, image/png) · IMAGE/PNG ebenso · eigener Speicher: 1 fetch · fremd: nichts, „nicht pruefbar"' };
    },
  },
];

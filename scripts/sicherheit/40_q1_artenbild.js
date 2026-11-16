// Gruppe q1 (v33.59) — Community-Bilder einer Art kommen nur aus dem eigenen Speicher.
// Die Datenbank nimmt seit 20261110_sicherheit_funktionen.sql nur noch solche Adressen an
// (rls_check 10); dieser Fall prueft die App fuer Zeilen, die VORHER entstanden sind.
'use strict';
module.exports = [
  {
    name: 'q1 · gsLoadSpeciesImage + Admin-Vorschau: fremde Bildadresse wird nicht geladen, eigene schon',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const eigen = SB_URL_DEFAULT + '/storage/v1/object/public/species-images/11111111-1111-4111-8111-111111111111/1731_abc.jpg';
        const fremd = 'https://boese.example/steinpilz.jpg';
        const alt = window.sbFetch;
        let antwort = [];
        window.sbFetch = async function (p) { if (/fn_species_images/.test(p)) return { data: antwort, error: null }; return { data: null, error: { message: 'offline' } }; };
        const box = (id) => { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); return d; };
        const out = {};
        try {
          antwort = [{ url: fremd, is_primary: true }, { url: eigen, is_primary: false }];
          const a = box('q1-simg-a'); await gsLoadSpeciesImage('Q1A', null, 'q1-simg-a');
          out.gemischt = Array.from(a.querySelectorAll('img')).map(i => i.getAttribute('src'));
          antwort = [{ url: fremd, is_primary: true }];
          const b = box('q1-simg-b'); await gsLoadSpeciesImage('Q1B', null, 'q1-simg-b');
          out.nurFremd = Array.from(b.querySelectorAll('img')).map(i => i.getAttribute('src'));
          const adm = document.createElement('div');
          adm.innerHTML = _gsAdminSpeciesImageHtml([{ id: 'x1', species_id: 'S1', url: fremd }, { id: 'x2', species_id: 'S2', url: eigen }]);
          out.admin = Array.from(adm.querySelectorAll('img')).map(i => i.getAttribute('src'));
          out.adminHinweis = /fremde Adresse/.test(adm.textContent) && !!adm.querySelector('[title="Bild liegt nicht in unserem Speicher"]');
          a.remove(); b.remove();
        } finally { window.sbFetch = alt; }
        out.eigen = eigen; out.fremd = fremd;
        return out;
      });
      if (r.gemischt.length !== 1 || r.gemischt[0] !== r.eigen) return { ok: false, warum: 'gemischte Liste: ' + JSON.stringify(r.gemischt) };
      if (r.nurFremd.indexOf(r.fremd) >= 0) return { ok: false, warum: 'fremdes Bild geladen: ' + JSON.stringify(r.nurFremd) };
      if (r.admin.length !== 1 || r.admin[0] !== r.eigen || !r.adminHinweis) return { ok: false, warum: 'Admin-Vorschau: ' + JSON.stringify(r.admin) + ' Hinweis=' + r.adminHinweis };
      return { ok: true, info: 'eigenes Bild bleibt (auch neben einem fremden) · nur fremd → kein Bild, Rueckfall · Admin: fremd → Platzhalter „fremde Adresse", eigen → Bild' };
    },
  },
];

// Marktplatz (Schlusspruefung der Sicherheitspruefung 10.11.2026, c2#2): haelt marketplace-publish
// die Sperre, bevor sie als service_role schreibt?
//
// marketplace-publish legt Inserate an UND bearbeitet sie — mit dem Service-Schluessel. Die Sperre
// der Datenbank (fn_gs_sperre, 20261110_sicherheit_community_markt.sql) prueft ein UPDATE nur aus
// Nutzerhand (authenticated/anon); der Bearbeiten-Zweig der Function kam deshalb fuer ein gesperrtes
// Konto durch (Titel, Text, Preis, Fotos). Die Regel steht in _shared/markt_regeln.mjs (wird hier
// AUSGEFUEHRT), die index.ts ist der Rand: liest die Rolle, fragt die Regel, VOR jedem Schreiben.
'use strict';

module.exports = [
  {
    name: 'Markt · marktSperre: gesperrt → 403 mit festem Satz, Rolle nicht lesbar → 503 (kein Schreiben auf Verdacht), alle anderen Rollen und ein fehlendes Profil → frei',
    lauf: async (h) => {
      const M = await h.modul('_shared/markt_regeln.mjs');
      if (typeof M.marktSperre !== 'function') return { ok: false, warum: 'marktSperre fehlt' };
      const b = M.marktSperre({ data: { role: 'banned' }, error: null });
      if (!b || b.status !== 403 || !b.body || b.body.code !== 'banned' || !/gesperrt/i.test(b.body.error || '')) return { ok: false, warum: 'gesperrt: ' + JSON.stringify(b) };
      const f = M.marktSperre({ data: null, error: { message: 'connection reset' } });
      if (!f || f.status !== 503 || /connection reset/.test(JSON.stringify(f))) return { ok: false, warum: 'Lesefehler: ' + JSON.stringify(f) + ' (erwartet 503, ohne Rohmeldung)' };
      const frei = [{ data: { role: 'user' }, error: null }, { data: { role: 'admin' }, error: null }, { data: { role: 'expert' }, error: null },
        { data: { role: null }, error: null }, { data: null, error: null }, { data: { role: 'BANNED ' }, error: null }]
        .map(x => [x, M.marktSperre(x)]);
      const falsch = frei.filter(([x, r]) => (x.data && /banned/i.test(String(x.data.role))) ? !r : r);
      if (falsch.length) return { ok: false, warum: 'falsch entschieden: ' + falsch.map(([x, r]) => JSON.stringify(x.data) + ' → ' + JSON.stringify(r)).join(' · ') };
      return { ok: true, info: 'banned → 403 „' + b.body.error + '" · Lesefehler → 503 ohne Rohtext · user/admin/expert/null/kein Profil → frei · „BANNED " (Gross, Leerzeichen) → gesperrt' };
    },
  },
  {
    name: 'Markt · Rand: marketplace-publish liest profiles.role und fragt marktSperre NACH der Anmeldung und VOR jedem update/insert/Upload — und der Bearbeiten-Zweig prueft den Eigentuemer, bevor er als service_role schreibt',
    lauf: async (h) => {
      const src = h.ohneKommentare(h.lies('marketplace-publish/index.ts'));
      const f = [];
      if (!/from\s+["']\.\.\/_shared\/markt_regeln\.mjs["']/.test(src)) f.push('importiert _shared/markt_regeln.mjs nicht');
      const iUser = src.search(/auth\.getUser\(/);
      const iRolle = src.search(/from\(["']profiles["']\)\s*\.select\(["']role["']\)/);
      const iRegel = src.search(/marktSperre\(/);
      const schreib = ['.update(', '.insert(', '.upload(', 'uploadPhoto('].map(s => src.indexOf(s, src.indexOf('Deno.serve'))).filter(i => i >= 0);
      const iSchreib = Math.min.apply(null, schreib);
      if (iUser < 0 || iRolle < 0 || iRegel < 0) f.push('Anmeldung/Rolle/Regel nicht gefunden (' + [iUser, iRolle, iRegel].join(',') + ')');
      else if (!(iUser < iRolle && iRolle < iRegel && iRegel < iSchreib)) f.push('Reihenfolge falsch: getUser ' + iUser + ' · role ' + iRolle + ' · marktSperre ' + iRegel + ' · erstes Schreiben ' + iSchreib);
      // die Antwort der Regel wird zurueckgegeben, nicht verworfen
      if (!/if\s*\(\s*(\w+)\s*\)\s*return\s+new\s+Response\(\s*JSON\.stringify\(\s*\1\.body\s*\)\s*,\s*\{\s*status:\s*\1\.status/.test(src)) f.push('die Antwort von marktSperre wird nicht zurueckgegeben');
      // Eigentuemer im Bearbeiten-Zweig: die Zeile wird gelesen und user_id verglichen, bevor update laeuft
      const iEdit = src.indexOf('if (listingId)');
      const iOwner = src.search(/existing\.user_id\s*!==\s*userId/);
      const iUpd = src.indexOf('.update(', iEdit);
      if (iEdit < 0 || iOwner < iEdit || iOwner > iUpd) f.push('Bearbeiten-Zweig prueft den Eigentuemer nicht vor dem update');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'getUser → profiles.role → marktSperre → erst dann update/insert/Upload · Antwort der Regel geht zurueck · Bearbeiten: Eigentuemer vor dem update (bestand schon)' };
    },
  },
];

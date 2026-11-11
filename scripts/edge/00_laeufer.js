// Der Laeufer selbst: sieht er, was er sehen soll? (Ein Pruefstand, der nichts sieht, sieht auch keinen Fehler.)
'use strict';
module.exports = [
  {
    name: 'Laeufer · findet die Function-Verzeichnisse, liest Quelltext, entfernt Kommentare ohne Zeichenketten zu beschaedigen, importiert ein _shared-Modul',
    lauf: async (h) => {
      const fns = h.functions();
      if (fns.length < 30) return { ok: false, warum: 'nur ' + fns.length + ' Functions gefunden' };
      const probe = "const a = 'https://x/y'; // weg\n/* weg\nweg */ const b = \"/* bleibt */\"; const c = `// bleibt`;";
      const o = h.ohneKommentare(probe);
      if (/weg/.test(o) || !/https:\/\/x\/y/.test(o) || !/\/\* bleibt \*\//.test(o) || !/\/\/ bleibt/.test(o)) return { ok: false, warum: 'ohneKommentare falsch: ' + JSON.stringify(o) };
      const m = await h.modul('_shared/auth_vergleich.mjs');
      if (typeof m.constantTimeEquals !== 'function') return { ok: false, warum: '_shared/auth_vergleich.mjs exportiert constantTimeEquals nicht' };
      if (m.constantTimeEquals('a', 'a') !== true || m.constantTimeEquals('a', 'b') !== false) return { ok: false, warum: 'constantTimeEquals rechnet falsch' };
      return { ok: true, info: fns.length + ' Functions · Kommentare weg, Zeichenketten heil · Modul importiert und ausgefuehrt' };
    },
  },
];

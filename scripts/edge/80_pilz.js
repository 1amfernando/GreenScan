// Pilz-Scanner (mushroom-identify): welche Arten kennt das Modell? (v33.64, Brett 2026-11-11-2714)
//
// Gemessen am 19.11.2026 (live, nur lesend): mushroom_register hat 276 Arten — 12 toedlich, 69 giftig,
// 50 bedingt essbar, 19 nur jung essbar, 47 ungeniessbar, 79 Speisepilze. Die ausgelieferte Function
// (v5, Code von v33.59) lud `.order("slug").limit(200)`: 76 Arten fehlten im Prompt, 19 davon giftig
// (Satansröhrling, Tiger-Ritterling, Grünling, Käppchenmorchel …) — sie stehen alphabetisch hinten.
// Das Modell darf nur einen Slug aus der Liste nennen; eine giftige Art, die es nicht kennt, kann es
// nicht nennen, und die ähnlichste, die es kennt, ist oft der essbare Doppelgänger.
//
// Die Rechnung steht in _shared/pilz_wissen.mjs und wird hier AUSGEFUEHRT; der Rand (index.ts) wird
// am Quelltext ohne Kommentare geprueft.
'use strict';

// Ein Register in der Verteilung von live — und wie live stehen die giftigen alphabetisch HINTEN
// (live beginnen sie bei „pluteus_salicinus"). Nur so kann der Fall eine Kuerzung nach Slug von einer
// Kuerzung nach Gefahr unterscheiden.
function register() {
  const z = [];
  const dazu = (n, ed, vor) => { for (let i = 0; i < n; i++) z.push({ slug: vor + '_' + ed + '_' + String(i).padStart(3, '0'), edibility: ed }); };
  dazu(79, 'speisepilz', 'a');
  dazu(47, 'ungeniessbar', 'b');
  dazu(50, 'bedingt_essbar', 'c');
  dazu(19, 'speisepilz_jung', 'd');
  dazu(69, 'giftig', 'x');
  dazu(12, 'toedlich', 'y');
  return z;
}
const GEFAEHRLICH = (ed) => ed === 'toedlich' || ed === 'giftig';
const geordnet = (l) => l.every((x, i) => i === 0 || l[i - 1].slug < x.slug);

module.exports = [
  {
    name: 'Pilz-Wissen · alle Arten des Registers gehen ans Modell; muss gekuerzt werden, fallen zuerst die harmlosesten — nie eine giftige vor einer harmloseren',
    lauf: async (h) => {
      const M = await h.modul('_shared/pilz_wissen.mjs');
      if (typeof M.pilzWissenAuswahl !== 'function') return { ok: false, warum: 'pilzWissenAuswahl fehlt' };
      const reg = register();
      // Gegenprobe der Fixture: die alte Regel (nach Slug, erste 200) verliert hier giftige Arten.
      const alt = reg.slice().sort((a, b) => a.slug < b.slug ? -1 : 1).slice(0, 200);
      const altFehlt = reg.filter(x => GEFAEHRLICH(x.edibility) && !alt.some(y => y.slug === x.slug)).length;
      if (!altFehlt) return { ok: false, warum: 'Fixture taugt nicht: die alte Kuerzung verliert keine giftige Art' };

      const voll = M.pilzWissenAuswahl(reg);
      if (voll.liste.length !== 276 || voll.weggelassen.length || voll.gefaehrlich_weggelassen.length || voll.abgeschnitten) return { ok: false, warum: 'ganzes Register: ' + JSON.stringify({ n: voll.liste.length, weg: voll.weggelassen.length, gef: voll.gefaehrlich_weggelassen.length, ab: voll.abgeschnitten }) };
      if (!geordnet(voll.liste)) return { ok: false, warum: 'Liste nicht nach Slug geordnet' };
      if (M.PILZ_WISSEN_MAX < 276) return { ok: false, warum: 'PILZ_WISSEN_MAX ' + M.PILZ_WISSEN_MAX + ' kleiner als das Register von heute (276)' };

      const k200 = M.pilzWissenAuswahl(reg, { max: 200 });
      const weg200 = reg.filter(x => k200.weggelassen.indexOf(x.slug) >= 0);
      if (k200.liste.length !== 200 || weg200.length !== 76) return { ok: false, warum: 'max 200: ' + k200.liste.length + ' behalten, ' + weg200.length + ' weg' };
      if (weg200.some(x => x.edibility !== 'speisepilz')) return { ok: false, warum: 'max 200: weggelassen ' + JSON.stringify([...new Set(weg200.map(x => x.edibility))]) + ' — erwartet nur Speisepilze' };
      if (k200.gefaehrlich_weggelassen.length) return { ok: false, warum: 'max 200: giftige weggelassen' };
      if (!geordnet(k200.liste)) return { ok: false, warum: 'max 200: Liste nicht nach Slug geordnet' };

      // Zu kleine Grenze: auch Giftige fallen — und die Rechnung SAGT es (der Rand protokolliert es).
      const k50 = M.pilzWissenAuswahl(reg, { max: 50 });
      if (k50.liste.length !== 50 || k50.liste.some(x => !GEFAEHRLICH(x.edibility)) || k50.liste.filter(x => x.edibility === 'toedlich').length !== 12) return { ok: false, warum: 'max 50: nicht die gefaehrlichsten behalten' };
      if (k50.gefaehrlich_weggelassen.length !== 31) return { ok: false, warum: 'max 50: gefaehrlich_weggelassen ' + k50.gefaehrlich_weggelassen.length + ' statt 31' };

      // Ein unbekannter oder fremder Wert zaehlt wie „unbekannt": vor ungeniessbar und Speisepilz.
      const fremd = [{ slug: 'f_constructor', edibility: 'constructor' }, { slug: 'f_null', edibility: null }, { slug: 'f_neu', edibility: 'neu' }];
      const kf = M.pilzWissenAuswahl(reg.concat(fremd), { max: 81 + 50 + 19 + 3 });
      const fremdWeg = fremd.filter(x => kf.weggelassen.indexOf(x.slug) >= 0);
      if (fremdWeg.length) return { ok: false, warum: 'unbekannte Essbarkeit weggelassen: ' + fremdWeg.map(x => x.slug).join(', ') };
      if (M.pilzGefahrRang('constructor') !== M.PILZ_GEFAHR_RANG.unbekannt || M.pilzGefahrRang('__proto__') !== M.PILZ_GEFAHR_RANG.unbekannt) return { ok: false, warum: 'pilzGefahrRang liest die Prototypkette' };

      // Doppelte und kaputte Zeilen zaehlen nicht; eine volle Abfrage meldet „abgeschnitten".
      const kaputt = M.pilzWissenAuswahl([{ slug: 'a', edibility: 'giftig' }, { slug: 'a', edibility: 'speisepilz' }, null, { slug: '' }, { edibility: 'giftig' }]);
      if (kaputt.liste.length !== 1 || kaputt.liste[0].edibility !== 'giftig') return { ok: false, warum: 'Dubletten/kaputte Zeilen: ' + JSON.stringify(kaputt.liste) };
      if (!M.pilzWissenAuswahl(reg, { geholt: 276 }).abgeschnitten) return { ok: false, warum: 'volle Abfrage nicht als abgeschnitten gemeldet' };
      return { ok: true, info: '276 Arten → alle im Prompt, nach Slug · bei 200: nur 76 Speisepilze weg (die alte Kuerzung nach Slug verliert hier ' + altFehlt + ' giftige) · bei 50: die 12 toedlichen + 38 giftigen, 31 giftige als weggelassen gemeldet · unbekannte Essbarkeit bleibt · Prototypkette zu' };
    },
  },
  {
    name: 'Pilz-Wissen · Rand: mushroom-identify laedt das Register ohne eigene Zahl, liest den Fehler, gibt dem Modell genau die Auswahl und prueft den Slug gegen DIESELBE Liste',
    lauf: async (h) => {
      const src = h.ohneKommentare(h.lies('mushroom-identify/index.ts'));
      const fehler = [];
      const i = src.indexOf('from("mushroom_register")');
      const kette = i >= 0 ? src.slice(i, src.indexOf(';', i)) : '';
      if (!kette) fehler.push('keine Abfrage auf mushroom_register');
      if (/\.limit\(\s*\d+\s*\)/.test(kette)) fehler.push('feste Zahl in .limit(' + (kette.match(/\.limit\(\s*(\d+)/) || [])[1] + ')');
      if (!/\.limit\(\s*PILZ_ZEILEN_HOLEN\s*\)/.test(kette)) fehler.push('.limit(PILZ_ZEILEN_HOLEN) fehlt');
      if (!/\{\s*data\s*:\s*mushrooms\s*,\s*error\s*:\s*registerFehler\s*\}/.test(src)) fehler.push('Fehler der Register-Abfrage wird nicht gelesen');
      // Ohne Register: Abbruch VOR der Reservierung (dann geht kein Kontingent verloren, und es braucht
      // keine Freigabe neben der einen Regel kiFreigabeNoetig).
      const iFehl = src.indexOf('if (registerFehler'), iTor = src.search(/await\s+kiTor\s*\(\s*\{/);
      const bail = iFehl >= 0 ? src.slice(iFehl, src.indexOf('}', iFehl) + 1) : '';
      if (iFehl < 0 || !/return\s+fehler\(/.test(bail)) fehler.push('ohne Register: kein Abbruch');
      else if (iTor < 0 || iFehl > iTor || i > iTor) fehler.push('Register und Abbruch stehen NACH der Reservierung (kiTor) — ein Fehler kostet Kontingent');
      if (!/const\s+wahl\s*=\s*pilzWissenAuswahl\(\s*mushrooms\s*\)/.test(src)) fehler.push('pilzWissenAuswahl wird nicht auf die Zeilen angewandt');
      if (!/const\s+knownMushrooms\s*=\s*wahl\.liste\s*;/.test(src)) fehler.push('das Modell bekommt nicht wahl.liste');
      if (!/kiSlugAusListe\(\s*parsed\.matched_slug\s*,\s*knownMushrooms\s*\)/.test(src)) fehler.push('matched_slug nicht gegen die Liste des Prompts geprueft');
      if (!/gefaehrlich_weggelassen/.test(src.slice(src.indexOf('const wahl'), src.indexOf('const knownMushrooms')))) fehler.push('eine Kuerzung wird nicht protokolliert');
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: 'Register mit .limit(PILZ_ZEILEN_HOLEN) · Fehler gelesen → 503 VOR der Reservierung · knownMushrooms = wahl.liste · Slug gegen dieselbe Liste · Kuerzung protokolliert' };
    },
  },
  {
    name: 'Pilz-Kandidaten · pilzAlternativen: nur Slugs aus der Liste des Prompts, mit Name und Essbarkeit, ohne Dubletten, hoechstens drei — und der Rand gibt sie als alternative_arten zurueck (alternatives bleibt fuer aeltere App-Fassungen)',
    lauf: async (h) => {
      const M = await h.modul('_shared/pilz_wissen.mjs');
      if (typeof M.pilzAlternativen !== 'function') return { ok: false, warum: 'pilzAlternativen fehlt' };
      const liste = [
        { slug: 'amanita_phalloides', common_name_de: 'Grüner Knollenblätterpilz', scientific_name: 'Amanita phalloides', edibility: 'toedlich' },
        { slug: 'boletus_edulis', common_name_de: 'Steinpilz', scientific_name: 'Boletus edulis', edibility: 'speisepilz' },
        { slug: 'russula_emetica', common_name_de: 'Speitäubling', scientific_name: 'Russula emetica', edibility: 'giftig' },
        { slug: 'x_ohne_name', edibility: 'ungeniessbar' },
      ];
      const r = M.pilzAlternativen(['amanita_phalloides', 'erfunden', 'amanita_phalloides', 123, 'boletus_edulis', 'russula_emetica', 'x_ohne_name'], liste);
      const erw = [['amanita_phalloides', 'Grüner Knollenblätterpilz', 'toedlich'], ['boletus_edulis', 'Steinpilz', 'speisepilz'], ['russula_emetica', 'Speitäubling', 'giftig']];
      if (r.length !== 3 || erw.some((e, i) => !r[i] || r[i].slug !== e[0] || r[i].name !== e[1] || r[i].edibility !== e[2])) return { ok: false, warum: 'Ergebnis ' + JSON.stringify(r) };
      const ohne = M.pilzAlternativen(['x_ohne_name'], liste);
      if (ohne.length !== 1 || ohne[0].name !== null) return { ok: false, warum: 'Art ohne Namen: ' + JSON.stringify(ohne) };
      if (M.pilzAlternativen(null, liste).length || M.pilzAlternativen(['amanita_phalloides'], null).length) return { ok: false, warum: 'kaputte Eingabe ergibt Kandidaten' };
      const src = h.ohneKommentare(h.lies('mushroom-identify/index.ts'));
      if (!/const\s+altArten\s*=\s*pilzAlternativen\(\s*parsed\.alternative_slugs\s*,\s*knownMushrooms\s*\)/.test(src)) return { ok: false, warum: 'Rand: Kandidaten nicht ueber pilzAlternativen gegen die Liste des Prompts' };
      if (!/alternative_arten\s*:\s*altArten/.test(src) || !/alternatives\s*:\s*altArten\.map\(/.test(src)) return { ok: false, warum: 'Rand: alternative_arten oder alternatives fehlt in der Antwort' };
      return { ok: true, info: 'nur Slugs der Liste · Name + Essbarkeit · Dublette/erfunden/keine Zeichenkette fallen weg · hoechstens 3 · Rand: alternative_arten + alternatives' };
    },
  },
  {
    name: 'Eine Zahl fuer „sicher genug": PILZ_SICHER_AB (Server) = GS_PILZ_SICHER_AB (App) — der Rand rechnet vapko_required und den Prompt damit, nie mit einer eigenen Zahl',
    lauf: async (h) => {
      const fs = require('fs'), path = require('path');
      const M = await h.modul('_shared/pilz_wissen.mjs');
      if (!Number.isInteger(M.PILZ_SICHER_AB)) return { ok: false, warum: 'PILZ_SICHER_AB fehlt im Modul' };
      const app = fs.readFileSync(path.join(h.repo, 'index.html'), 'utf8');
      const a = app.match(/var\s+GS_PILZ_SICHER_AB\s*=\s*(\d+)\s*;/);
      if (!a) return { ok: false, warum: 'GS_PILZ_SICHER_AB fehlt in index.html' };
      if (Number(a[1]) !== M.PILZ_SICHER_AB) return { ok: false, warum: 'App ' + a[1] + ' gegen Server ' + M.PILZ_SICHER_AB };
      const src = h.ohneKommentare(h.lies('mushroom-identify/index.ts'));
      if (/conf\w*\s*<\s*\d+/.test(src)) return { ok: false, warum: 'Rand vergleicht die Trefferquote mit einer eigenen Zahl: ' + src.match(/conf\w*\s*<\s*\d+/)[0] };
      if (!/conf\s*<\s*PILZ_SICHER_AB/.test(src)) return { ok: false, warum: 'vapko_required rechnet nicht mit PILZ_SICHER_AB' };
      if (!/confidence\s*<\s*\$\{PILZ_SICHER_AB\}/.test(src)) return { ok: false, warum: 'der Prompt nennt dem Modell nicht PILZ_SICHER_AB' };
      return { ok: true, info: 'Server ' + M.PILZ_SICHER_AB + ' = App ' + a[1] + ' · vapko_required und Prompt aus der einen Zahl' };
    },
  },
];

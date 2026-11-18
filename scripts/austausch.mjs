#!/usr/bin/env node
// austausch.mjs — das Brett, an dem sich ALLE KI-Sitzungen und ihre Unteragenten austauschen.
//
//   node scripts/austausch.mjs                    # lesen (Vorgabe): jeder offene Eintrag einmal, dazu frische Branches
//   node scripts/austausch.mjs holen              # erst alle Branches holen (git fetch), dann lesen
//   node scripts/austausch.mjs zeige <id>         # ein Eintrag mit allem, was sich auf ihn bezieht
//   node scripts/austausch.mjs suche <wort>       # Volltext ueber ALLE Eintraege, auch geschlossene
//   node scripts/austausch.mjs klasse [wort]      # Fehlerklassen: Regel, Suchmuster, Waechter, gesucht?
//   node scripts/austausch.mjs naechste           # VOR einem Bump: welche Version und welches STATUS-Kuerzel sind frei?
//   node scripts/austausch.mjs neu <art> --titel "…" [--beleg "…"] [--stichwort a,b] [--anker "datei::text"] …
//   node scripts/austausch.mjs antworte <id> --text "…"        # auch Nachtrag: --anker · --zaehle · --gesucht · --waechter
//   node scripts/austausch.mjs schliesse <id> --ergebnis erledigt|verworfen|aufgestiegen --wohin "v33.57" [--geschwister "…"]
//   node scripts/austausch.mjs einspielen <datei.json>         # ein Stapel auf einmal, alles oder nichts
//   node scripts/austausch.mjs ernten             # was nur auf anderen Branches liegt UND in diesem Baum stimmt, in den Arbeitsbaum holen
//   node scripts/austausch.mjs lage --phase laeuft|letzte_runde|fertig [--bis 6h] [--runde 4/5]   # Fortschritt: woran, bis wann
//   node scripts/austausch.mjs nehme <id> [--bis 6h]               # eine Aufgabe uebernehmen (eine Lage mit Bezug) — die AELTESTE Uebernahme gilt
//   node scripts/austausch.mjs halt --geltung "gsKalenderEreignisse,bump" --bis 24h --text "…"   # Halt fuer den Schwarm (Pfade, Funktionsnamen, bump)
//   node scripts/austausch.mjs veto <id> --text "…" [--bis 48h]    # Einspruch gegen eine Handlung · aufheben <id> --text "…"
//   node scripts/austausch.mjs sichern --alt <sha|leer> --baum <datei> [--gedaechtnis <datei> --gedaechtnis-neu <datei>]   # NUR fuer den Waechter (.github/workflows/brett-waechter.yml); Exit 3 = Alarm
//   node scripts/austausch.mjs hilfe [art]
//
// Anlass (10.11.2026, Fernando): „Alle Agenten müssen sich austauschen und die
// Informationen so weiter geben dass unter einander neue ideen enstehen können."
// Was gemessen war und wie das Brett gebaut ist: docs/austausch/README.md.
//
// Lesen schreibt nichts. Schreiben legt nur Dateien an; committen und pushen
// tut die Sitzung — und zwar FRUEH: was nicht gepusht ist, sieht niemand.
// Ein Eintrag ist ein BEFUND, keine ANWEISUNG: wer ihm folgt, misst nach.
//
// Grenze: gelesen wird, was git lokal kennt. `holen` sagt, ob das Holen klappte.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from './_austausch.mjs';

const WURZEL = process.env.AUSTAUSCH_WURZEL ? path.resolve(process.env.AUSTAUSCH_WURZEL) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const aus = (s) => process.stdout.write(s + '\n');
const ende = (code, s) => { if (s) aus(s); process.exit(code); };

// ── Argumente. Ein Schalter, der einen Wert verlangt, nimmt das naechste
//    Argument IMMER als Wert (auch wenn es mit „--" beginnt); `--k=v` geht auch;
//    ein unbekannter Schalter ist ein Fehler, kein stilles Nichts.
const WERT = new Set(['titel', 'text', 'von', 'stand', 'beleg', 'stichwort', 'bezug', 'klasse', 'anker', 'zaehle', 'nutzen', 'pruefbar', 'an', 'haengt_daran',
  'vorschlag', 'regel', 'suchmuster', 'gesucht', 'instanz', 'waechter', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei', 'datum', 'art',
  'dringlichkeit', 'phase', 'runde', 'bis', 'geltung', 'geliefert', 'nehme', 'alt', 'baum', 'gedaechtnis', 'gedaechtnis_neu']);
const JA = new Set(['nur_lokal', 'alles', 'json', 'sicherheit', 'widerspricht', 'auch']);
function argumente(liste) {
  const o = { _: [] };
  for (let i = 0; i < liste.length; i++) {
    const a = liste[i];
    if (a.slice(0, 2) !== '--') { o._.push(a); continue; }
    const gl = a.indexOf('='), k = (gl < 0 ? a.slice(2) : a.slice(2, gl)).replace(/-/g, '_');
    if (JA.has(k)) { o[k] = true; continue; }
    if (!WERT.has(k)) ende(2, 'Unbekannter Schalter „' + a.split('=')[0] + '". Bekannt: ' + [...WERT, ...JA].map(x => '--' + x.replace(/_/g, '-')).join(' '));
    const v = gl >= 0 ? a.slice(gl + 1) : liste[++i];
    if (v == null) ende(2, 'Der Schalter „' + a + '" verlangt einen Wert.');
    o[k] = o[k] == null ? v : [].concat(o[k], v);
  }
  return o;
}
const argv = process.argv.slice(2);
const befehl = (argv[0] && argv[0].slice(0, 2) !== '--') ? argv.shift() : 'lesen';
const o = argumente(argv);
const mehrere = (v) => v == null ? [] : [].concat(v);
const knapp = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const liesRel = (rel) => { try { return fs.readFileSync(path.join(WURZEL, rel), 'utf8'); } catch (_) { return null; } };
const quelltext = () => { const a = liesRel('index.html'); return a == null ? null : a + '\n' + (liesRel('sw.js') || ''); };
const laufendeVersion = () => { const m = (liesRel('index.html') || '').match(/\bGS_VERSION\s*=\s*'(v\d+\.\d+)'/); return m ? m[1] : null; };
const brett = () => A.brettLesen(WURZEL, { alleRefs: !o.nur_lokal });

// Wer schreibt? Der lokale Branch (A.eigenerZweig) — ein abweichender Upstream wird genannt.
const zweig = A.eigenerZweig(WURZEL);
function ich() {
  if (o.von) return String(o.von);
  if (process.env.AUSTAUSCH_VON) return process.env.AUSTAUSCH_VON;
  const b = zweig.name;
  // „HEAD", „main" sind keine Sitzung: der Schreiber muss sich nennen (losgeloester HEAD, CI, fremde Werkzeuge).
  if (!b || b === 'main' || b === 'master') ende(2, 'Wer schreibt? Auf „' + (b || 'keinem Branch') + '" laesst sich das nicht ablesen — bitte --von "sitzung/<name>" (kein Personenname).');
  return 'sitzung/' + b;
}
// Lesen bricht nie ab: ohne erkennbaren Schreiber gibt es nur keine „eigenen" Eintraege.
function ichVon() {
  if (o.von) return String(o.von);
  if (process.env.AUSTAUSCH_VON) return process.env.AUSTAUSCH_VON;
  const b = zweig.name;
  return b && b !== 'main' && b !== 'master' ? 'sitzung/' + b : null;
}
// Alle Namen, die „ich" sind: der lokale Branch — und nach `git branch -m` auch der Name, unter dem der Branch
// auf origin liegt (der Upstream). Vorher spaltete sich die Identitaet: der eigene Halt sperrte den eigenen
// Bump, Antworten darauf verschwanden (Gegenpruefung 3). Mit --von / AUSTAUSCH_VON genau dieser eine.
function meineNamen() {
  if (o.von) return [String(o.von)];
  if (process.env.AUSTAUSCH_VON) return [process.env.AUSTAUSCH_VON];
  const n = [];
  if (zweig.name && zweig.name !== 'main' && zweig.name !== 'master') n.push('sitzung/' + zweig.name);
  if (zweig.upstream) n.push('sitzung/' + zweig.upstream);
  return n;
}
// Eine Lage oder ein Halt wirkt nur, wenn `von` zum Branch passt, auf dem sie liegen — eine andere Kennung
// waere fuer alle anderen sofort UNWIRKSAM (Gegenpruefung 2: `--von koordinator` schrieb still eine).
function vonFuerAbsicht(art) {
  // Auf main liegt nichts, was fuer andere wirkt — vorher verwiesen zwei Meldungen im Kreis („bitte --von" /
  // „ohne --von schreiben"), Gegenpruefung 3.
  if (zweig.name === 'main' || zweig.name === 'master') ende(2, ARTEN_WORT(art) + ' nur von einem EIGENEN Branch: auf ' + zweig.name + ' gilt „von" fuer niemanden (und auf main wird nie direkt gepusht) — git checkout -b claude/<thema>, dann schreiben und pushen.');
  const v = ich();
  if (zweig.upstream && v === 'sitzung/' + zweig.upstream) return v;   // ausdruecklich als der Name, unter dem gepusht wird
  if (zweig.name && v !== 'sitzung/' + zweig.name) ende(2, ARTEN_WORT(art) + ' von „' + v + '" auf dem Branch ' + zweig.name + ': fuer alle anderen waere ' + (art === 'lage' ? 'sie' : 'er') + ' UNWIRKSAM („von" passt nicht zum Branch). Ohne --von / AUSTAUSCH_VON schreiben.');
  if (!zweig.name) aus('(Losgeloester HEAD: ' + ARTEN_WORT(art) + ' traegt „' + v + '" — er wirkt erst, wenn er auf ' + v.replace(/^sitzung\//, 'origin/') + ' liegt.)');
  if (zweig.upstream) aus('(Achtung: dieser Branch heisst ' + zweig.name + ', sein Upstream origin/' + zweig.upstream + ' — landet der Eintrag dort, gilt ' + ARTEN_WORT(art) + ' von „' + v + '" fuer alle anderen NICHT. Entweder mit --von sitzung/' + zweig.upstream + ' schreiben (dann bleibt alles beim alten Namen), oder nach origin/' + zweig.name + ' pushen (git push -u origin HEAD:' + zweig.name + ') — dann erloeschen deine Lagen und Halts unter dem alten Namen fuer alle anderen; schreib sie neu.)');
  return v;
}
const ARTEN_WORT = (art) => (A.ARTEN[art] || { wort: art }).wort;
const schwarmVon = (b) => A.schwarm(b.eintraege, Date.now(), { wo: b.gitDa ? b.wo : null, ich: meineNamen() });
// „Meins" heisst: von mir geschrieben — und dort, wo ich schreibe (vonPasst). Ein Eintrag mit meinem Namen
// auf einem fremden Branch ist nicht meiner (Gegenpruefung 2: er schaltete DICH BETREFFEND ab).
const meinsVon = (b, ich0) => { const namen = ich0 ? meineNamen() : []; return (e) => namen.indexOf(e.von) >= 0 && A.vonPasst(e, b.gitDa ? b.wo : null, namen); };
// Eine id darf abgekuerzt werden: die vier Zeichen am Ende reichen, wenn sie eindeutig sind.
function finde(b, kennung) {
  kennung = String(kennung || '').trim();
  if (!kennung) ende(2, 'Welcher Eintrag? Erwartet wird eine id (die vier Zeichen am Ende genuegen).');
  const genau = b.eintraege.find(e => e.id === kennung);
  if (genau) return genau;
  const t = b.eintraege.filter(e => e.id.slice(-kennung.length) === kennung);
  if (t.length === 1) return t[0];
  ende(2, t.length ? '„' + kennung + '" ist nicht eindeutig: ' + t.map(e => e.id).join(', ') : 'Kein Eintrag „' + kennung + '". `node scripts/austausch.mjs suche <wort>` hilft suchen.');
}
function kopf(b, abl) {
  const offen = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen').length;
  aus('\n=== Austausch — das Brett   ' + b.eintraege.length + ' Eintraege · ' + offen + ' offen · gelesen: ' + b.quellen.join(', ')
    + (b.gitDa === false ? ' · git nicht verfuegbar: NUR der Arbeitsbaum' : (b.gitDa ? ' · ' + b.refs + ' Remote-Refs' : '')));
  if (b.gitDa && b.refs <= 1) aus('  !! Hoechstens EIN Remote-Ref sichtbar — Eintraege und Arbeit auf anderen Branches sind von hier aus NICHT zu sehen: node scripts/austausch.mjs holen');
  // main ist ungeschuetzt, und nach dem Merge laeuft kein Pruefstand: zwei gruene PRs
  // koennen einen roten Stand hinterlassen. Wer anfaengt, erfaehrt es hier zuerst.
  const lokal = A.brettLesen(WURZEL, { alleRefs: false });
  const rot = A.brettPruefen(lokal).length + A.ankerPruefen(lokal.eintraege, liesRel).verloren.length;
  if (rot) aus('  !! Auf DIESEM Stand ist das Brett schon rot (' + rot + ' Maengel) — geerbt, nicht von dir: node scripts/austausch_check.js zeigt sie');
  if (b.unlesbar.length) aus('  !! ' + b.unlesbar.length + ' unlesbare Datei(en): ' + b.unlesbar.slice(0, 4).map(u => u.datei + ' [' + u.quelle + '] ' + u.grund).join(' · '));
  if (b.abweichend.length) aus('  !! ' + b.abweichend.length + ' Eintrag/Eintraege sehen auf einem Branch anders aus (umgeschrieben?): ' + b.abweichend.slice(0, 4).map(x => x.id + ' — es gilt ' + x.gilt + ', abweichend ' + x.weichtAb).join(' · '));
  if (b.strittig.length) aus('  !! STRITTIG — ' + b.strittig.length + ' Eintrag/Eintraege in verschiedenen Fassungen, keine laesst sich zuordnen (weder hier, noch main, noch der Branch des Schreibers, noch die Sicherung) — NICHT gerechnet: ' + b.strittig.slice(0, 4).map(x => x.id + ' {' + x.quellen.join(', ') + '}').join(' · '));
}
const zeichen = { offen: ' ', beantwortet: '✓', geschlossen: '×', ersetzt: '×', notiz: '·' };

// ── Der Schwarm in der Ausgabe: zuerst, was DICH betrifft — nur wenn etwas zutrifft.
// Ein Name als ganzes Wort: „claude/b-22" steckt in „claude/b-2223", trifft aber nicht. Auch in seiner eigenen
// Schreibweise „sitzung/<branch>" und als „origin/<branch>" (Gegenpruefung 3: das / davor schloss beide aus).
const nameIn = (text, name) => new RegExp('(?:^|[^\\w/.-])(?:(?:sitzung|origin)/)?' + name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?![\\w/.-])').test(text);
// Ein Wert in einem GEDRUCKTEN Befehl: nur [A-Za-z0-9._/:@%+=,-] steht roh da (wie shlex.quote), alles andere in
// '…' (ein ' als '\''). Der Pfad ist beim Lesen schon geprueft (A.lieferPfadOk) — das hier ist die zweite Wand.
const shWort = (s) => { s = String(s); return /^[A-Za-z0-9._\/:@%+=,-]+$/.test(s) ? s : "'" + s.replace(/'/g, "'\\''") + "'"; };
const zeigeBefehl = (g) => 'git show ' + shWort(g.commit + ':' + g.pfad) + '   (nach einem Squash-Merge: git show ' + shWort('origin/main:' + g.pfad) + ')';
function dichBetreffend(b, abl, sw, aend) {
  const z = [], name = zweig.name, ich0 = ichVon(), meins = meinsVon(b, ich0);
  const hier = (e) => !e._quelle || e._quelle === 'Arbeitsbaum';
  const befehle = new Set();        // Zeilen mit einem kopierfertigen Befehl (nie gekuerzt)
  const schonGenannt = new Set();   // Halt- und Veto-ids, die oben schon eine eigene Zeile haben (AN DICH nennt sie nicht noch einmal)
  // Auf main ist niemand „du" — das ist kein losgeloester HEAD (Gegenpruefung 3: beides hiess gleich).
  if (!ich0 && (name === 'main' || name === 'master')) z.push('Du arbeitest auf ' + name + ' — hier ist nichts „deins", eigene Halts zaehlen als fremde. Lage und Halt schreibt man von einem eigenen Branch aus: git checkout -b claude/<thema>.');
  else if (!ich0) z.push('Wer du bist, ist nicht ablesbar (losgeloester HEAD) — eigene Halts zaehlen als fremde, eigene Eintraege als fremde. --von bzw. AUSTAUSCH_VON setzen.');
  const upstreamGesagt = !!(ich0 && zweig.upstream && !o.von && !process.env.AUSTAUSCH_VON);
  // Mit Befehl — nie gekuerzt (der wichtigste Teil steht am Ende: was beim Umzug erlischt).
  if (upstreamGesagt) { const zl = 'Dein Branch heisst hier ' + zweig.name + ', sein Upstream origin/' + zweig.upstream + ' — du schreibst als ' + ich0 + '; auf origin/' + zweig.upstream + ' gilt das fuer andere nicht. Entweder weiter als --von sitzung/' + zweig.upstream + ', oder nach origin/' + zweig.name + ' pushen (git push -u origin HEAD:' + zweig.name + ') — dann erloeschen deine Lagen und Halts unter sitzung/' + zweig.upstream + ' fuer die anderen; schreib sie neu.'; befehle.add(zl); z.push(zl); }
  for (const h of sw.halts) {
    if (h.veto || meins(h.e)) continue;
    const t = A.haltBeruehrt(h.e, aend);
    if (!t.length) continue;
    schonGenannt.add(h.e.id);
    const gesehen = h.antworten.some(meins);
    z.push('HALT ' + h.e.id + ' {' + h.e._quelle + '} von ' + h.e.von + ' bis ' + uhr(h.bis) + ': ' + knapp(h.e.titel, 70) + ' — beruehrt ' + t.slice(0, 4).join(', ') + (gesehen ? '   [du hast geantwortet]' : '   → lies ihn (zeige ' + h.e.id.slice(-4) + '), dann warten, aufheben mit Grund oder antworten'));
  }
  // Ein Veto gegen eine Lage oder einen Halt zaehlt nur, solange das Ziel noch wirkt.
  const wirktNoch = (t) => (t.art !== 'lage' && t.art !== 'halt') || sw.halts.some(h => h.e === t) || sw.lagen.some(l => l.e === t) || [...sw.uebernahme.values()].some(u => u.lage.e === t || u.auch.some(x => x.e === t));
  for (const [ziel, hs] of sw.vetos) {
    const t = abl.proId.get(ziel);
    if (!t || !meins(t) || !wirktNoch(t)) continue;
    for (const h of hs) if (!meins(h.e)) schonGenannt.add(h.e.id), z.push('VETO ' + h.e.id + ' {' + h.e._quelle + '} von ' + h.e.von + ' bis ' + uhr(h.bis) + ' gegen deinen Eintrag ' + ziel + ': ' + knapp(h.e.text, 90));
  }
  // Deine Lage, dein Halt — fuer die ANDEREN unwirksam (rueckdatiert, ueber dem Deckel, ungueltig …): vorher sah der
  // Schreiber „wirkt", und niemand sagte es ihm (Gegenpruefung 3). Nur, was wirklich deins ist (hier oder auf deinem Branch).
  { const namen = ich0 ? meineNamen() : [];
    for (const u of sw.unwirksam) {
      if (namen.indexOf(u.e.von) < 0) continue;
      const q = u.e._quellen || b.wo.get(u.e.id) || new Set();
      if (!q.has('Arbeitsbaum') && ![...q].some(x => namen.some(n => A.istAutorRef(x, n.replace(/^sitzung\//, ''))))) continue;
      z.push((u.e.art === 'halt' ? 'DEIN HALT ' : 'DEINE LAGE ') + u.e.id + (u.teil ? ' wirkt nur teilweise: ' : ' wirkt fuer die anderen NICHT: ') + u.grund);
    } }
  // Wer mithilft (nehme --auch: das Feld `mithelfen`, nicht der Titel), weiss, dass ein anderer zuerst war.
  for (const [ziel, u] of sw.uebernahme) if (u.auch.some(l => meins(l.e) && l.e.mithelfen !== true)) z.push('Deine Uebernahme von ' + ziel + ' gilt nicht: ' + u.lage.e.von + ' war zuerst (bis ' + uhr(u.lage.bis) + ')');
  // Dein Halt wurde aufgehoben — mit Grund, und du erfaehrst ihn hier (vorher verschwand er still).
  for (const a of sw.aufgehoben) if (meins(a.e) && !meins(a.durch) && Date.parse(a.e.bis) > Date.now()) z.push('AUFGEHOBEN dein Halt ' + a.e.id + ' durch ' + a.durch.id + ' {' + a.durch._quelle + '} von ' + a.durch.von + ': ' + knapp(a.durch.text, 120));
  // Antworten und Lieferungen auf DEINE offenen Eintraege — auch auf deinen Halt und deine Lage. Der Weg
  // „Agent sucht diese Datei, bitte hochladen" endet hier. Auf einen geschlossenen Eintrag: nicht mehr.
  const antw = [];
  for (const e of b.eintraege) {
    if (!meins(e) || ['frage', 'befund', 'idee', 'klasse', 'halt', 'lage'].indexOf(e.art) < 0) continue;
    const zs = abl.zustand.get(e.id).z;
    if (zs === 'geschlossen' || zs === 'ersetzt') continue;
    if ((e.art === 'halt' || e.art === 'lage') && Date.parse(e.bis) <= Date.now()) continue;
    for (const r of (abl.rueck.get(e.id) || [])) if (r.von.art === 'antwort' && !meins(r.von)) antw.push({ auf: e, x: r.von });
  }
  antw.sort((p, q) => A.ordnung(q.x).localeCompare(A.ordnung(p.x)));
  const wort = { frage: ' Frage ', halt: 'n Halt ', lage: ' Lage ' };
  for (const { auf, x } of antw.slice(0, o.alles ? 1e9 : 6)) {
    z.push('ANTWORT ' + x.id + ' {' + x._quelle + '} von ' + x.von + ' auf deine' + (wort[auf.art] || 'n Eintrag ') + auf.id + ': ' + knapp(x.text || x.titel, 90));
    for (const g of A.alsListe(x.geliefert)) { const zl = '  GELIEFERT ' + g.pfad + ' @ ' + String(g.commit).slice(0, 12) + '   → git fetch origin && ' + zeigeBefehl(g); befehle.add(zl); z.push(zl); }
  }
  if (antw.length > 6 && !o.alles) z.push('… +' + (antw.length - 6) + ' weitere Antworten auf deine Eintraege — `--alles`');
  // AN DICH: ausdruecklich (`an: sitzung/<branch>`, zuerst) oder dein Branch-Name als ganzes Wort im Titel/in den Stichworten.
  //   Ein Halt ist nie „offen" (er ist eine Absicht auf Zeit): ein WIRKSAMER Halt oder ein Veto mit `an: sitzung/<du>`
  //   gehoert dazu (Gegenpruefung 3: er stand nur allgemein unter HALT UND VETO) — ausser er hat oben schon seine Zeile.
  const offenFremd = b.eintraege.filter(e => !meins(e) && abl.zustand.get(e.id).z === 'offen');
  const haltAnDich = ich0 ? sw.halts.filter(h => h.e.an === ich0 && !meins(h.e) && !schonGenannt.has(h.e.id)).map(h => h.e) : [];
  const an = offenFremd.filter(e => ich0 && e.an === ich0).concat(haltAnDich).sort((x, y) => A.ordnung(y).localeCompare(A.ordnung(x)))
    .concat(offenFremd.filter(e => !(ich0 && e.an === ich0) && name && name.length >= 6 && nameIn(A.textVon({ t: e.titel, s: e.stichworte }), name)).sort((x, y) => A.ordnung(y).localeCompare(A.ordnung(x))));
  an.slice(0, o.alles ? 1e9 : 6).forEach(e => { const h = e.art === 'halt' && sw.halts.find(x => x.e === e); z.push('AN DICH ' + e.id + ' {' + e._quelle + '} von ' + e.von + ': ' + (h ? (h.veto ? 'VETO gegen ' + h.veto : 'HALT') + ' bis ' + uhr(h.bis) + ' — ' : '') + knapp(e.titel, 100)); });
  if (an.length > 6 && !o.alles) z.push('… +' + (an.length - 6) + ' weitere an dich — `--alles`');
  // Nur hier: kein ECHTER Branch traegt ihn (die Sicherung ist keiner — sie verdeckte sonst den Hinweis).
  const nurHier = b.eintraege.filter(e => hier(e) && ![...(b.wo.get(e.id) || new Set())].some(q => q !== 'Arbeitsbaum' && !A.istSicherungsRef(q)));
  if (b.gitDa && nurHier.length) z.push(nurHier.length + ' Eintrag/Eintraege liegen NUR in diesem Arbeitsbaum — nicht gepusht, mit dem Container weg: ' + nurHier.slice(0, 4).map(e => e.id).join(', '));
  if (name && b.gitDa) {
    // Ein Force-Push trifft den Branch, auf den `git push` geht: den gleichnamigen — einen Upstream unter anderem
    // Namen nur, wenn push.default upstream/tracking dorthin schickt und dieser Stand von ihm abstammt. Sonst geht
    // dorthin kein Push (push.default simple verweigert ihn, current/matching nehmen den eigenen Namen), und jede
    // neue fremde Datei dort hiess „Force-Push wuerde sie loeschen" (Gegenpruefung 3: Laerm bei jedem Lesen).
    const pushDef = (A.git(WURZEL, ['config', '--get', 'push.default']) || '').trim();
    const zumUpstream = !!zweig.upstream && (pushDef === 'upstream' || pushDef === 'tracking') && !!(A.git(WURZEL, ['merge-base', 'HEAD', 'refs/remotes/origin/' + zweig.upstream]) || '').trim();
    for (const n of zumUpstream ? [name, zweig.upstream] : [name]) {
      const fehlt = [...b.wo].filter(([id, q]) => q.has('origin/' + n) && !q.has('Arbeitsbaum') && !q.has('origin/main')).map(([id]) => id);
      if (fehlt.length) z.push('!! origin/' + n + ' traegt ' + fehlt.length + ' Eintrag/Eintraege, die hier fehlen — ein Force-Push wuerde sie loeschen: ' + fehlt.slice(0, 4).join(', '));
    }
    // EINE ruhige Zeile, wenn der Upstream ein fremder Branch ist und oben noch nichts dazu steht (--von gesetzt).
    if (zweig.upstream && !zumUpstream && !upstreamGesagt) z.push('Dein Upstream origin/' + zweig.upstream + ' ist ein anderer Branch als dieser — `git push` geht nicht dorthin; deine Arbeit: git push -u origin HEAD');
    // Ein Upstream ist eingerichtet, aber origin kennt ihn nicht (mehr): geloescht? Nach einem Merge ist das der
    // Normalfall (Gegenpruefung 3: der Rat „neu pushen" belebte einen gemergten Branch wieder) — gesagt wird es nur,
    // wenn HEAD NICHT in origin/main steht; nach einem Squash-Merge (was er geaendert hat, steht inhaltsgleich auf
    // main) nur als Frage.
    const up = zweig.upstreamName;
    if (up && up !== 'main' && up !== 'master' && A.git(WURZEL, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + up]) == null) {
      const M = 'refs/remotes/origin/main', mainDa = A.git(WURZEL, ['rev-parse', '--verify', '--quiet', M]) != null;
      const gemergt = mainDa && A.git(WURZEL, ['merge-base', '--is-ancestor', 'HEAD', M]) != null;
      const mb = mainDa && !gemergt ? (A.git(WURZEL, ['merge-base', 'HEAD', M]) || '').trim() : '';
      const namen = (args) => new Set((A.git(WURZEL, args) || '').split('\n').filter(Boolean));
      const anders = mb ? namen(['diff', '--name-only', '--no-renames', M, 'HEAD']) : null;
      const squash = !!mb && ![...namen(['diff', '--name-only', '--no-renames', mb, 'HEAD'])].some(n => anders.has(n));
      if (squash) z.push('Dein Branch ' + up + ' ist auf origin nicht mehr da — was er geaendert hat, steht inhaltsgleich auf main (squash-gemergt?). Dann ist nichts verloren; sonst neu pushen: git push -u origin HEAD:' + up);
      else if (!gemergt) z.push('!! Dein Branch ' + up + ' fehlt auf origin (geloescht?) — mit ihm deine gepushten Commits. Neu pushen: git push -u origin HEAD:' + up);
    }
  }
  if (aend.unsicher) z.push('Funktionsgrenzen in index.html ' + (aend.unsicher.ab ? 'ab Zeile ' + aend.unsicher.ab + ' ' : '') + 'nicht bestimmbar: ' + aend.unsicher.grund + ' — jeder Halt auf eine Funktion darin gilt als beruehrt („Grenzen unsicher")');
  if (aend.grund) z.push('Ob ein Halt deine Aenderung beruehrt, ist nicht rechenbar: ' + aend.grund);
  if (!z.length) return;
  aus('\nDICH BETREFFEND');
  // Ein gedruckter Befehl wird nie gekuerzt — abgeschnitten fehlte ihm bei einem 55-Zeichen-Pfad der Weg ueber origin/main.
  z.forEach(x => aus('  ' + (befehle.has(x) ? x : knapp(x, 260))));
}
function schwarmBloecke(b, abl, sw, inArbeit) {
  const offen = (e) => abl.zustand.get(e.id).z === 'offen';
  const kritisch = b.eintraege.filter(e => offen(e) && e.dringlichkeit === 'kritisch' && !A.eintragPruefen(e, e._datei).length).sort((x, y) => A.ordnung(y).localeCompare(A.ordnung(x)));
  const dringend = b.eintraege.filter(e => offen(e) && e.dringlichkeit === 'dringend');
  if (kritisch.length || dringend.length) {
    aus('\nKRITISCH (' + kritisch.length + ')' + (dringend.length ? ' · DRINGEND (' + dringend.length + ' — in den Listen unten zuerst, oder `--dringlichkeit dringend`)' : '') + ' — wer es aufnimmt: `nehme <id>`');
    for (const e of kritisch.slice(0, o.alles ? 1e9 : 6)) { const n = (abl.rueck.get(e.id) || []).filter(r => r.von.art === 'antwort').length; aus('    ' + e.id + '  ' + knapp(e.titel, 100) + '   [' + arbeitsMarke(e, sw, inArbeit) + (n ? ' · ' + n + ' Antwort(en)' : '') + ']' + (e._quelle !== 'Arbeitsbaum' ? '   {' + e._quelle + '}' : '')); }
    if (!o.alles && kritisch.length > 6) aus('    … +' + (kritisch.length - 6) + ' weitere — `--alles`');
  }
  if (sw.lagen.length) {
    aus('\nLAGE (' + sw.lagen.length + ') — woran andere gerade arbeiten und bis wann (Selbstauskunft, an ihrem Branch geprueft)');
    const ich0 = ichVon();
    for (const l of sw.lagen.slice(0, o.alles ? 1e9 : 8)) aus('    ' + l.e.von + (ich0 && l.e.von === ich0 ? ' (du)' : '') + '   ' + l.e.phase.replace('_', ' ') + (l.e.runde ? ' ' + l.e.runde : '') + ', bis ' + uhr(l.bis) + '   „' + knapp(l.e.titel, 80) + '"');
    if (!o.alles && sw.lagen.length > 8) aus('    … +' + (sw.lagen.length - 8) + ' weitere — `--alles`');
  }
  if (sw.halts.length) {
    aus('\nHALT UND VETO (' + sw.halts.length + ' wirksam) — eine Pflicht zur Kenntnisnahme, keine Sperre: lesen, dann warten, antworten oder mit Grund aufheben');
    for (const h of sw.halts.slice(0, o.alles ? 1e9 : 6)) aus('    ' + h.e.id + '  bis ' + uhr(h.bis) + '  ' + (h.veto ? 'VETO gegen ' + h.veto : 'Geltung: ' + (h.e.geltung || []).join(', ')) + ' — ' + knapp(h.e.titel, 80) + '   {' + h.e._quelle + '}' + (h.antworten.length ? '   [' + h.antworten.length + ' Antwort(en)]' : ''));
  }
  if (sw.unwirksam.length) aus('  (' + sw.unwirksam.length + ' Halt/Lage UNWIRKSAM — ungueltig, Zeit in der Zukunft oder „von" passt nicht zum Branch: ' + sw.unwirksam.slice(0, 3).map(u => u.e.id + ' ' + knapp(u.grund, 60)).join(' · ') + ')');
}
function arbeitsMarke(e, sw, inArbeit) {
  const u = sw.uebernahme.get(e.id), g = inArbeit.get(e.id), m = [];
  const mit = u ? new Set(u.auch.map(x => x.e.von)).size : 0;
  if (u) m.push('uebernommen: ' + u.lage.e.von + ' bis ' + uhr(u.lage.bis) + (mit ? ' (+' + mit + ')' : ''));
  if (g) m.push('in Arbeit auf ' + g.map(x => x.ref.replace(/^origin\//, '') + ' (' + x.wie + ')').join(', '));
  if (sw.vetos.has(e.id)) m.push('VETO bis ' + uhr(sw.vetos.get(e.id)[0].bis));
  return m.length ? m.join(' · ') : 'niemand dran';
}
function sicherungsZeile(b) {
  if (!b.gitDa) return;
  let nurSicherung = 0, einzeln = 0;
  const zurueck = A.zurueckgezogenVomSchreiber(WURZEL, b.eintraege);
  for (const [id, q] of b.wo) {
    if (zurueck.has(id)) continue;   // vom Schreiber auf seinem Branch zurueckgezogen — kein Verlust
    const echt = [...q].filter(x => !A.istSicherungsRef(x));
    const gesichert = [...q].some(A.istSicherungsRef);
    if (!echt.length && gesichert) nurSicherung++;
    else if (!gesichert && echt.length === 1 && echt[0] !== 'origin/main' && echt[0] !== 'Arbeitsbaum') einzeln++;
  }
  if (nurSicherung) aus('\n!! GERETTET: ' + nurSicherung + ' Eintrag/Eintraege liegen NUR noch in der Sicherung (' + A.SICHERUNG_ZWEIG + ') — ein Branch wurde geloescht oder zurueckgesetzt. `ernten` holt, was hier stimmt.');
  if (einzeln) aus('\nGEFAEHRDET: ' + einzeln + ' Eintrag/Eintraege liegen auf nur EINEM Branch und noch nicht in ' + A.SICHERUNG_ZWEIG + ' (der Waechter sichert stuendlich, sobald .github/workflows/brett-waechter.yml auf main liegt).');
}

function lesen() {
  const b = brett(), abl = A.ableiten(b.eintraege), src = quelltext();
  if (o.json) return aus(JSON.stringify(b.eintraege.map(e => Object.assign({}, e, { zustand: abl.zustand.get(e.id).z, quelle: e._quelle })), null, 1));
  kopf(b, abl);
  const jetzt = Date.now(), sw = schwarmVon(b);
  const gefiltert0 = !!(o.art || o.stichwort || o.an || o.dringlichkeit);
  const inArbeit = gefiltert0 || !b.gitDa ? new Map() : A.inArbeitAusGit(WURZEL, b.eintraege, jetzt, 14, b.wo);
  if (!gefiltert0) { dichBetreffend(b, abl, sw, A.eigeneAenderung(WURZEL)); schwarmBloecke(b, abl, sw, inArbeit); }
  let sicht = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen');
  if (o.art) sicht = sicht.filter(e => e.art === o.art);
  if (o.stichwort) { const w = String(o.stichwort).toLowerCase(); sicht = sicht.filter(e => A.alsListe(e.stichworte).some(s => String(s).toLowerCase() === w)); }
  if (o.an) sicht = sicht.filter(e => String(e.an || '').toLowerCase() === String(o.an).toLowerCase());
  if (o.dringlichkeit) sicht = sicht.filter(e => e.dringlichkeit === o.dringlichkeit);
  const gefiltert = gefiltert0, deckel = o.alles ? 1e9 : 12;
  if (!gefiltert) {
    // Was der Code ueber MEHRERE Eintraege hinweg sieht — nur wenn es etwas gibt.
    const an = A.anstoesse(b.eintraege, liesRel);
    let art = null;
    for (const x of an.slice(0, o.alles ? 1e9 : 10)) {
      if (x.art !== art) { art = x.art; aus('\n' + A.ANSTOSS_ARTEN[art].toUpperCase()); }
      aus('  ' + knapp(x.satz, 230));
    }
    if (!o.alles && an.length > 10) aus('  … +' + (an.length - 10) + ' weitere — `--alles`');
  }
  const block = (titel, art) => {
    const rang = (e) => e.dringlichkeit === 'kritisch' ? 0 : (e.dringlichkeit === 'dringend' ? 1 : 2);
    const l = sicht.filter(e => e.art === art).sort((x, y) => rang(x) - rang(y) || A.ordnung(y).localeCompare(A.ordnung(x)));
    if (!l.length) return;
    aus('\n' + titel + ' (' + l.length + ')');
    for (const e of l.slice(0, deckel)) {
      const m = A.marken(e, abl, src), am = arbeitsMarke(e, sw, inArbeit);
      if (e.dringlichkeit) m.unshift(e.dringlichkeit.toUpperCase());
      if (am !== 'niemand dran') m.push(am);
      aus('    ' + e.id + '  ' + knapp(e.titel, 104) + (m.length ? '   [' + m.join(' · ') + ']' : '') + (e._quelle !== 'Arbeitsbaum' ? '   {' + e._quelle + '}' : ''));
    }
    // Kein stiller Deckel: was nicht dasteht, wird gezaehlt.
    if (l.length > deckel) aus('    … +' + (l.length - deckel) + ' weitere — `--alles` zeigt sie');
  };
  block('FRAGEN', 'frage'); block('BEFUNDE', 'befund'); block('IDEEN', 'idee');
  const kl = sicht.filter(e => e.art === 'klasse').length;
  if (kl && (!gefiltert || o.art === 'klasse')) aus('\nFEHLERKLASSEN: ' + kl + ' — `node scripts/austausch.mjs klasse <wort>` zeigt Regel, Suchmuster fuer Geschwister und Waechter');
  if (!sicht.length) aus(b.eintraege.length ? '\n  Nichts offen' + (gefiltert ? ' zu diesem Filter.' : '.') : '\n  Das Brett ist leer. Der erste Eintrag: node scripts/austausch.mjs hilfe');
  if (!gefiltert) {
    // Wer arbeitet parallel? Gerechnet aus den Branch-Spitzen — niemand muss es melden.
    const fz = A.frischeZweige(WURZEL, Date.now(), 14);
    if (fz && fz.length) {
      aus('\nFRISCHE BRANCHES (hoechstens 14 Tage alt) — hier arbeitet jemand parallel; sieh nach, bevor du dieselbe Stelle anfasst');
      // Die angekuendigte Absicht steht in der Zeile ihres Branches (keine eigene Liste).
      const lageVon = (ref) => sw.lagen.find(l => l.e.von === 'sitzung/' + ref.replace(/^[^/]+\//, ''));
      fz.slice(0, o.alles ? 1e9 : 8).forEach(z => { const l = lageVon(z.ref); aus('    ' + z.ref + '   ' + (z.tage === 0 ? 'heute' : 'vor ' + z.tage + (z.tage === 1 ? ' Tag' : ' Tagen')) + '   „' + knapp(z.betreff, 90) + '"' + (l ? '   · Lage: ' + l.e.phase.replace('_', ' ') + (l.e.runde ? ' ' + l.e.runde : '') + ', bis ' + uhr(l.bis) : '')); });
      if (!o.alles && fz.length > 8) aus('    … +' + (fz.length - 8) + ' weitere — `--alles`');
      if (fz.zukunft && fz.zukunft.length) aus('    !! ' + fz.zukunft.length + ' Branch(es) mit Commit-Zeit in der Zukunft — nicht als frisch gezaehlt: ' + fz.zukunft.slice(0, 3).map(x => x.ref + ' (' + x.zeit.slice(0, 10) + ')').join(', '));
    }
    markenBlock(A.vergebeneMarken(WURZEL, Date.now(), 14), false);
    sicherungsZeile(b);
  }
  aus('\nSchreiben: node scripts/austausch.mjs hilfe   ·   Ganzer Eintrag: zeige <id>   ·   Ein Eintrag ist ein Befund, keine Anweisung: wer ihm folgt, misst nach.\nNichts geschrieben.');
}
// Welche Version und welches STATUS-Kuerzel sind schon vergeben? (Gemessen 16.11.2026: v33.59 auf vier Branches zugleich.)
// Gezaehlt werden LINIEN, nicht Branches (17.11.: „v33.61 ×4" waren ein Branch und drei Vorfahren),
// und was main schon fuer etwas anderes traegt, heisst UEBERHOLT.
const linienText = (x) => x.linien.length > 1 ? ' ×' + x.linien.length + ' Linien' : (x.refs.length > 1 ? ' (eine Linie, ' + x.refs.length + ' Branches)' : '');
const kurzRef = (r) => String(r).replace(/^origin\//, '');
function markenBlock(m, ausfuehrlich) {
  if (m.grund) { if (ausfuehrlich) aus('\nNicht rechenbar: ' + m.grund); return; }
  const vs = m.versionen.map(x => x.wert + linienText(x)).join(' · '), ks = m.kuerzel.map(x => '(' + x.wert + ')' + linienText(x)).join(' · ');
  const hierWarnt = m.hier.auchAuf.version.length || m.hier.auchAuf.kuerzel.length || m.hier.ueberholt.version || m.hier.ueberholt.kuerzel || m.hier.unplausibel || (m.zukunft && m.zukunft.length);
  if (!ausfuehrlich && !vs && !ks && !m.ueberholt.length && !hierWarnt) return;
  aus('\nVERGEBEN auf frischen Branches, noch nicht auf main (' + m.basis.version + ', (' + m.basis.kuerzel + ')): ' + (vs || 'keine Version') + '   ·   Kuerzel: ' + (ks || 'keines'));
  aus('  → naechste freie Version: ' + m.naechsteVersion + '   ·   naechstes freies STATUS-Kuerzel: (' + m.naechstesKuerzel + ')   (wer zuerst auf main kommt, behaelt seine; die anderen nummerieren um)');
  for (const x of m.versionen) if (x.linien.length > 1) aus('  !! ' + x.wert + ' ist auf ' + x.linien.length + ' Linien zugleich vergeben: ' + x.linien.map(l => l.refs.map(kurzRef).join(', ')).join('  |  '));
  for (const x of m.kuerzel) if (x.linien.length > 1) aus('  !! (' + x.wert + ') ist auf ' + x.linien.length + ' Linien zugleich vergeben: ' + x.linien.map(l => l.refs.map(kurzRef).join(', ')).join('  |  '));
  if (m.ueberholt.length) {
    const proRef = new Map();
    for (const u of m.ueberholt) { if (!proRef.has(u.ref)) proRef.set(u.ref, []); proRef.get(u.ref).push(u); }
    aus('  !! UEBERHOLT — main traegt diese Nummer schon fuer etwas anderes; vor dem Merge umnummerieren (' + proRef.size + ' Branch' + (proRef.size === 1 ? '' : 'es') + '):');
    for (const [ref, l] of [...proRef].slice(0, ausfuehrlich ? 1e9 : 6)) aus('     ' + kurzRef(ref) + '   ' + l.map(u => (u.art === 'kuerzel' ? '(' + u.wert + ')' : u.wert)).join(' + '));
    if (!ausfuehrlich && proRef.size > 6) aus('     … +' + (proRef.size - 6) + ' weitere — `naechste`');
  }
  if (m.hier.auchAuf.version.length) aus('  !! Dein Arbeitsbaum traegt ' + m.hier.version + ' — auch vergeben auf ' + m.hier.auchAuf.version.map(kurzRef).join(', ') + ' (andere Linie). Frei waere ' + m.naechsteVersion + '.');
  if (m.hier.auchAuf.kuerzel.length) aus('  !! Dein STATUS-Eintrag heisst (' + m.hier.kuerzel + ') — auch vergeben auf ' + m.hier.auchAuf.kuerzel.map(kurzRef).join(', ') + ' (andere Linie). Frei waere (' + m.naechstesKuerzel + ').');
  if (m.hier.ueberholt.version) aus('  !! Dein Arbeitsbaum traegt eine Version, die main schon fuer „' + knapp(m.hier.ueberholt.version, 70) + '" fuehrt. Frei waere ' + m.naechsteVersion + '.');
  if (m.hier.version) aus('  (Dein Arbeitsbaum traegt schon ' + m.hier.version + ' — sie ist in „naechste freie" eingerechnet.)');
  if (m.hier.kuerzel) aus('  (Dein juengster STATUS-Eintrag heisst schon (' + m.hier.kuerzel + ') — fuer einen WEITEREN Eintrag (' + m.naechstesKuerzel + ').)');
  if (m.unplausibel && m.unplausibel.length) aus('  !! Nicht gezaehlt — mehr als ' + A.SPRUNG_MAX + ' Versionen ueber main (Tippfehler?): ' + m.unplausibel.map(u => kurzRef(u.ref) + ' ' + u.wert).join(', '));
  if (m.hier.unplausibel) aus('  !! Dein Arbeitsbaum traegt ' + m.hier.unplausibel + ' — mehr als ' + A.SPRUNG_MAX + ' Versionen ueber main (Tippfehler?), nicht gezaehlt. Frei waere ' + m.naechsteVersion + '.');
  if (m.zukunft && m.zukunft.length) aus('  !! ' + m.zukunft.length + ' Branch(es) mit Commit-Zeit in der Zukunft — ihre Nummern sind MITGEZAEHLT: ' + m.zukunft.slice(0, 4).map(x => kurzRef(x.ref) + ' (' + x.zeit.slice(0, 10) + ')').join(', '));
  if (m.hier.ueberholt.kuerzel) aus('  !! Dein juengster STATUS-Eintrag nutzt ein Kuerzel, das auf main schon „' + knapp(m.hier.ueberholt.kuerzel, 70) + '" heisst. Frei waere (' + m.naechstesKuerzel + ').');
  if (ausfuehrlich) {
    for (const x of m.versionen.concat(m.kuerzel)) for (const l of x.linien) if (l.titel) aus('    ' + (x.wert[0] === 'v' ? x.wert : '(' + x.wert + ')') + '  ' + l.refs.map(kurzRef).join(', ') + '   „' + knapp(l.titel, 90) + '"');
    for (const u of m.ueberholt) aus('    ' + kurzRef(u.ref) + '  ' + (u.art === 'kuerzel' ? '(' + u.wert + ')' : u.wert) + ' = „' + knapp(u.titel, 60) + '"  — auf main: „' + knapp(u.mainTitel, 60) + '"');
  }
}
function naechste() {
  // Erst holen (wie `nehme`): wer nur `git fetch origin main` faehrt, saehe einen fremden Bump-Halt nicht.
  const geholt = o.nur_lokal ? null : holenStill();
  const m = A.vergebeneMarken(WURZEL, Date.now(), 14);
  // Vor einem Bump laeuft `naechste` ohnehin — hier wirkt ein Halt mit Geltung bump. Ein Veto dagegen steht dabei.
  const b = brett(), sw = schwarmVon(b), ich0 = ichVon(), meins = meinsVon(b, ich0);
  const bumpHalt = sw.halts.filter(h => !h.veto && (h.e.geltung || []).map(A.geltungNorm).indexOf('bump') >= 0 && !meins(h.e));
  const vetosGegen = (h) => (sw.vetos.get(h.e.id) || []);
  if (o.json) {
    aus(JSON.stringify(Object.assign({}, m, { holen: geholt, bumpHalt: bumpHalt.map(h => ({ id: h.e.id, von: h.e.von, quelle: h.e._quelle, bis: new Date(h.bis).toISOString(), text: h.e.text, vetos: vetosGegen(h).map(v => ({ id: v.e.id, von: v.e.von, text: v.e.text })) })) }), null, 1));
    // Dieselben Exit-Codes wie im Text: 1 bei einem Bump-Halt (geht vor), 2 bei „Nicht rechenbar" — sonst liefe
    // `naechste --json || stop` mit einer leeren Version weiter (Gegenpruefung 3: es endete mit 0).
    if (bumpHalt.length) process.exitCode = 1;
    else if (m.grund) process.exitCode = 2;
    return;
  }
  if (geholt === false) aus('\n(Holen hat nicht geklappt — gerechnet auf dem Stand, den git kennt.)');
  if (m.grund) ende(2, 'Nicht rechenbar: ' + m.grund + '\n(erst `node scripts/austausch.mjs holen`)');
  markenBlock(m, true);
  if (!ich0) aus('\n(Wer du bist, ist nicht ablesbar — losgeloester HEAD: auch ein EIGENER Bump-Halt zaehlt hier als fremder. --von setzen.)');
  if (bumpHalt.length) {
    bumpHalt.forEach(h => { aus('\n!! HALT fuer Bumps: ' + h.e.id + ' {' + h.e._quelle + '} bis ' + uhr(h.bis) + ' — ' + knapp(h.e.text, 160)); vetosGegen(h).forEach(v => aus('   VETO dagegen: ' + v.e.id + ' von ' + v.e.von + ' bis ' + uhr(v.bis) + ' — ' + knapp(v.e.text, 120))); });
    ende(1, '\nJetzt keine neue Version. Lies den Halt (zeige <id>); er endet ' + uhr(Math.min(...bumpHalt.map(h => h.bis))) + ' von selbst oder wird mit Grund aufgehoben' + (bumpHalt.some(h => vetosGegen(h).length) ? ' — gegen einen steht ein Veto: klaeren, nicht uebergehen' : '') + '.\nNichts geschrieben.');
  }
  aus('\nGerechnet aus main und den Branches, die git kennt (hoechstens 14 Tage alt' + (geholt ? ', eben geholt' : '') + ').\nNichts geschrieben.');
}

function ganz(e, abl, sw) {
  const z = abl.zustand.get(e.id);
  aus('\n' + String((A.ARTEN[e.art] || { wort: e.art + ' (unbekannte Art)' }).wort).toUpperCase() + '  ' + e.id + '   ' + z.z + (z.durch ? ' durch ' + z.durch.id : '') + '   {' + (e._quelle || 'Arbeitsbaum') + '}');
  aus('  ' + e.titel + '\n  von ' + e.von + ' · ' + e.datum + (e.zeit ? ' ' + e.zeit + ' UTC' : '') + (e.stand ? ' · Stand ' + e.stand : ''));
  const namen = { text: 'Text', beleg: 'Beleg', vorschlag: 'Vorschlag', nutzen: 'Nutzen', pruefbar: 'Pruefbar', an: 'An', haengt_daran: 'Haengt daran', regel: 'Regel', instanzen: 'Instanzen',
    suchmuster: 'Suchmuster (Geschwister)', gesucht: 'Gesucht', ohne_waechter: 'Ohne Waechter', ergebnis: 'Ergebnis', wohin: 'Wohin', geschwister: 'Geschwister', bewacht: 'Bewacht von', details_bei: 'Einzelheiten bei', stichworte: 'Stichworte',
    dringlichkeit: 'Dringlichkeit', phase: 'Phase', runde: 'Runde', bis: 'Frist bis (UTC)', geltung: 'Geltung' };
  for (const k of Object.keys(namen)) {
    const v = e[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) { aus('  ' + namen[k] + ':'); v.forEach(x => aus('    - ' + x)); } else aus('  ' + namen[k] + ': ' + String(v).split('\n').join('\n    '));
  }
  A.alsListe(e.waechter).forEach(w => aus('  Waechter: ' + w.datei + ' · „' + w.fall + '"'));
  A.alsListe(e.geliefert).forEach(g => aus('  Geliefert: ' + g.pfad + ' @ ' + g.commit + '   → ' + zeigeBefehl(g)));
  if (e.art === 'halt' || e.art === 'lage') aus('  Wirkt jetzt: ' + wirktJetzt(e, sw));
  if (e.sicherheit) aus('  Sicherheit: ja — Einzelheiten stehen bewusst nicht hier (public Repo)');
  const hier = !e._quelle || e._quelle === 'Arbeitsbaum';
  for (const x of A.ankerWirksam(e, abl.rueck)) { const t = A.messtext(x.datei, liesRel(x.datei)); aus('  Anker: ' + x.datei + ' :: ' + x.text + (hier ? (t == null ? '   ← DATEI FEHLT' : (t.indexOf(x.text) < 0 ? '   ← STEHT NICHT MEHR DA' : '')) : '')); }
  for (const x of A.zaehleWirksam(e, abl.rueck)) { const h = A.wieOft(A.messtext(x.datei, liesRel(x.datei)), x.text); aus('  Zaehlung: ' + x.datei + ' :: ' + x.text + '  → beim Eintrag ' + x.n + (hier ? ', heute ' + (h == null ? 'nicht lesbar' : h) + (h !== x.n ? '   ← BEWEGT' : '') : '')); }
  for (const bz of A.alsListe(e.bezug)) { const ziel = abl.proId.get(bz.id); aus('  → ' + bz.art + ' ' + bz.id + (ziel ? '  ' + knapp(ziel.titel, 90) : (bz.ref ? '  (liegt auf ' + bz.ref + ' — von hier aus nicht zu sehen: `holen`)' : '  (fehlt)')) + (ziel && bz.ref && ziel._quelle !== 'Arbeitsbaum' ? '   {' + ziel._quelle + '}' : '')); }
  for (const r of (abl.rueck.get(e.id) || [])) aus('  ← ' + r.art + ' von ' + r.von.id + '  ' + knapp(r.von.titel, 90) + '  [' + r.von.von + ']');
}
// Wirkt ein Halt oder eine Lage JETZT? Dieselbe Rechnung wie die Bloecke (schwarm), nicht nur die Frist:
// vorher sagte `zeige` „ja" fuer einen aufgehobenen Halt und eine Lage, die das Brett UNWIRKSAM nennt.
function wirktJetzt(e, sw) {
  const a = sw.aufgehoben.find(x => x.e === e); if (a) return 'nein — aufgehoben durch ' + a.durch.id + ' (' + a.durch.von + '): ' + knapp(a.durch.text, 120);
  // Ein Deckel trifft einzelne ZIELE, nicht die ganze Lage: nimmt sie zwei ihrer drei Ziele wirksam, sagt
  // `zeige` „teilweise" (vorher „nein" — Gegenpruefung 3).
  const u = sw.unwirksam.find(x => x.e === e); if (u && !u.teil) return 'nein — ' + u.grund;
  const h = sw.halts.find(x => x.e === e); if (h) return 'ja, bis ' + uhr(h.bis) + (sw.vetos.get(e.id) ? ' · ' + sw.vetos.get(e.id).length + ' Veto(s) dagegen' : '');
  if (e.art === 'lage') {
    const nimmt = [...sw.uebernahme].filter(([, x]) => x.lage.e === e).map(([z]) => z), auch = [...sw.uebernahme].filter(([, x]) => x.auch.some(l => l.e === e)).map(([z]) => z);
    const l = sw.lagen.find(x => x.e === e), w = A.wirksam(e, Date.now());
    const teil = u ? ' · fuer ' + u.ziele.join(', ') + ' NICHT (mehr als ' + A.LAGE_NIMMT_MAX + ' Uebernahmen zugleich)' : '';
    if (w.ok && (l || nimmt.length || auch.length)) return (u ? 'teilweise' : 'ja') + ', bis ' + uhr(w.bis) + (nimmt.length ? ' · uebernimmt ' + nimmt.join(', ') : '') + (auch.length ? ' · hilft mit an ' + auch.join(', ') + (e.mithelfen === true ? '' : ' (ein anderer war zuerst)') : '') + teil;
    if (u) return 'nein — ' + u.grund;
    if (w.ok) return 'nein — eine spaetere Lage desselben Schreibers ersetzt die Anzeige, oder „fertig" hat sie beendet';
    return 'nein — ' + w.grund;
  }
  const w = A.wirksam(e, Date.now()); return w.ok ? 'ja, bis ' + uhr(w.bis) : 'nein — ' + w.grund;
}
function zeige() { const b = brett(), abl = A.ableiten(b.eintraege), sw = schwarmVon(b); if (!o._.length) ende(2, 'Gebrauch: node scripts/austausch.mjs zeige <id>'); for (const k of o._) ganz(finde(b, k), abl, sw); aus('\nNichts geschrieben.'); }
function suche() {
  const w = o._.join(' ').toLowerCase(); if (!w) ende(2, 'Gebrauch: node scripts/austausch.mjs suche <wort>');
  const b = brett(), abl = A.ableiten(b.eintraege), t = b.eintraege.filter(e => A.textVon(e).toLowerCase().indexOf(w) >= 0);
  aus('\n„' + w + '": ' + t.length + ' von ' + b.eintraege.length + ' Eintraegen   (× geschlossen/ersetzt · ✓ beantwortet · · Antwort/Abschluss)');
  t.forEach(e => aus('  ' + zeichen[abl.zustand.get(e.id).z] + ' ' + e.id + '  (' + e.art + ')  ' + knapp(e.titel, 100)));
  aus('\nNichts geschrieben.');
}
function klasse() {
  const w = o._.join(' ').toLowerCase(), b = brett(), abl = A.ableiten(b.eintraege);
  const kl = b.eintraege.filter(e => e.art === 'klasse' && abl.zustand.get(e.id).z === 'offen' && (!w || A.textVon(e).toLowerCase().indexOf(w) >= 0));
  aus('\nFehlerklassen' + (w ? ' zu „' + w + '"' : '') + ': ' + kl.length);
  // Ohne Suchwort die kurze Liste; mit Suchwort (oder --alles) die ganze Karte.
  for (const e of kl) {
    const k = A.klasseWirksam(e, abl.rueck);
    if (!w && !o.alles) { aus('  ' + e.id + '  ' + knapp(e.titel, 84) + '   [' + k.instanzen.length + ' Instanzen' + (k.waechter.length ? '' : ' · ohne Waechter') + (k.gesucht.length ? '' : ' · nie gesucht') + ']'); continue; }
    aus('\n  ' + e.id + '  ' + e.titel + '\n    Regel:      ' + k.regel);
    if (e.text) aus('    Erkennen:   ' + knapp(e.text, 400));
    aus('    Instanzen:  ' + k.instanzen.length + (k.befunde.length ? ' + ' + k.befunde.length + ' auf dem Brett (' + k.befunde.map(x => x.id).join(', ') + ')' : '') + ' — ' + knapp(k.instanzen.join(' | '), o.alles ? 1e5 : 260));
    aus('    Geschwister suchen: ' + (k.suchmuster || '(noch kein Suchmuster — wer eines findet: antworte ' + e.id.slice(-4) + ' --suchmuster "…")'));
    aus('    Waechter:   ' + (k.waechter.length ? k.waechter.map(x => x.datei.replace(/^scripts\//, '') + ' „' + knapp(x.fall, 70) + '"').join(' · ') : 'KEINER — ' + k.ohne_waechter));
    aus('    Gesucht:    ' + (k.gesucht.length ? k.gesucht.join(' · ') : 'nie systematisch — „eine Fehlerklasse ist erst geschlossen, wenn man sie GESUCHT hat"'));
  }
  if (!kl.length && w) aus('  Nichts gefunden. Ist dein Fund die zweite Instanz eines NEUEN Musters? → node scripts/austausch.mjs hilfe klasse');
  aus('\nPasst dein Fund? Das Suchmuster fahren, BEVOR du nur den einen Fall behebst; dann `neu befund … --klasse <id>`.\nGesucht oder einen Waechter gebaut? `antworte <id> --gesucht "vXX.YY: N Stellen, M weitere" [--waechter "scripts/x_check.js::Fallkennung"]`\nNichts geschrieben.');
}

// --bis „3h", „90m", „2d" oder ein Zeitpunkt JJJJ-MM-TTTHH:MM:SSZ → UTC ohne Millisekunden.
function bisAus(w) {
  const t = String(w).trim(), m = t.match(/^(\d+(?:\.\d+)?)\s*(m|h|d)$/);
  if (m) return new Date(Date.now() + Number(m[1]) * { m: 6e4, h: 36e5, d: 864e5 }[m[2]]).toISOString().replace(/\.\d{3}Z$/, 'Z');
  if (A.BIS_FORM.test(t)) return t;
  ende(2, '--bis erwartet eine Dauer („3h", „90m", „2d") oder einen Zeitpunkt JJJJ-MM-TTTHH:MM:SSZ (UTC).');
}
const uhr = (ms) => new Date(ms).toISOString().slice(5, 16).replace('T', ' ') + ' UTC';
const paar = (w, feld) => { const i = String(w).indexOf('::'); if (i < 0) ende(2, '--' + feld + ' erwartet "datei::text"'); return [String(w).slice(0, i).trim(), String(w).slice(i + 2)]; };
function ausSchaltern(art) {
  const e = { art };
  for (const k of ['titel', 'text', 'stand', 'nutzen', 'pruefbar', 'an', 'haengt_daran', 'vorschlag', 'regel', 'suchmuster', 'gesucht', 'ohne_waechter', 'ergebnis', 'wohin', 'geschwister', 'bewacht', 'details_bei', 'datum', 'dringlichkeit', 'phase', 'runde']) {
    if (o[k] != null) e[k] = mehrere(o[k]).join('\n');
  }
  if (o.beleg) e.beleg = mehrere(o.beleg);
  const sw = mehrere(o.stichwort).join(',').split(',').map(s => s.trim()).filter(Boolean);
  if (sw.length) e.stichworte = sw;
  if (o.instanz) e.instanzen = mehrere(o.instanz);
  if (o.anker) e.anker = mehrere(o.anker).map(w => { const [datei, text] = paar(w, 'anker'); return { datei, text }; });
  // --zaehle "datei::text" zaehlt selbst (ohne Kommentarzeilen und Changelog); "datei::text::n" wird nachgerechnet.
  if (o.zaehle) e.zaehle = mehrere(o.zaehle).map(w => {
    let [datei, text] = paar(w, 'zaehle'), n = null;
    const m = text.match(/^(.*)::(\d+)$/s);
    if (m) { text = m[1]; n = Number(m[2]); } else { n = A.wieOft(A.messtext(datei, liesRel(datei)), text); if (n == null) n = -1; }
    return { datei, text, n };
  });
  if (o.waechter) e.waechter = mehrere(o.waechter).map(w => { const [datei, fall] = paar(w, 'waechter'); return { datei, fall: fall.trim() }; });
  if (o.sicherheit) e.sicherheit = true;
  const gl = mehrere(o.geltung).join(',').split(',').map(x => x.trim()).filter(Boolean);
  if (gl.length) e.geltung = gl;
  if (o.bis != null) e.bis = bisAus(o.bis);
  // --geliefert pfad[,pfad]: die Datei muss im letzten Commit liegen — geliefert ist, was jeder mit `git show` sehen kann.
  if (o.geliefert != null) {
    const kopf = (A.git(WURZEL, ['rev-parse', 'HEAD']) || '').trim();
    if (!/^[0-9a-f]{40}$/.test(kopf)) ende(2, '--geliefert braucht einen Commit (HEAD fehlt).');
    e.geliefert = mehrere(o.geliefert).join(',').split(',').map(x => x.trim()).filter(Boolean).map(pfad => {
      // Dieselbe Regel wie beim Lesen: der Pfad wird bei anderen als Befehl gedruckt.
      if (!A.lieferPfadOk(pfad)) ende(2, '--geliefert: „' + knapp(pfad, 80) + '" sieht nicht aus wie ein Repo-Pfad (Buchstaben, Ziffern, . _ - /: kein Shell-Zeichen, kein Leerraum, kein .., kein - am Anfang eines Teils) — er wird bei anderen als `git show` gedruckt.');
      if (A.git(WURZEL, ['cat-file', '-e', kopf + ':' + pfad]) == null) ende(2, '--geliefert: ' + pfad + ' liegt nicht im letzten Commit (' + kopf.slice(0, 8) + ') — erst committen, dann liefern.');
      return { pfad, commit: kopf };
    });
  }
  if (art === 'klasse' && e.waechter == null) e.waechter = [];
  return e;
}
function bezuege(b) {
  return mehrere(o.klasse).map(k => ({ art: 'gehoert_zu', id: finde(b, k).id })).concat(mehrere(o.bezug).map(x => {
    const i = String(x).indexOf(':'); if (i < 0) ende(2, '--bezug erwartet art:id (z.B. baut_auf:a3f9). Arten: ' + Object.keys(A.BEZUEGE).join(' · '));
    return { art: x.slice(0, i).trim(), id: finde(b, x.slice(i + 1)).id };
  }));
}
function schreiben(e, vonVorab) {
  if (!e.stand) { const v = laufendeVersion(); if (v) e.stand = v; }
  const absicht = e.art === 'lage' || e.art === 'halt', von = absicht ? (vonVorab || vonFuerAbsicht(e.art)) : ich();
  const r = A.einspielen(WURZEL, [e], { von, absichtVon: absicht ? [von] : null, datum: e.datum, alleRefs: !o.nur_lokal });
  if (!r.ok) { aus('\nNICHT geschrieben — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.forEach(f => aus('  !! ' + f.grund)); ende(1, '\nFelder und ein Beispiel: node scripts/austausch.mjs hilfe ' + e.art); }
  const g = r.geschrieben[0];
  aus('\nGeschrieben: ' + g.datei + '\n  ' + g.id + '  ' + g.titel);
  r.auswaerts.forEach(m => aus('Bezug ueber die Branch-Grenze: ' + m.id + ' liegt nur auf ' + m.quelle + ' — der Bezug nennt den Branch (ref); der Eintrag selbst bleibt dort und kommt mit dessen Merge oder mit `ernten`.  ' + knapp(m.titel, 70)));
  // Lesen ist ins Schreiben eingebaut: was wissen ANDERE an denselben Stichworten?
  const b2 = brett(), neuE = b2.eintraege.find(x => x.id === g.id);
  if (neuE) {
    const nb = A.nachbarn(neuE, b2.eintraege), offenN = nb.filter(x => !x.irrweg), irr = nb.filter(x => x.irrweg);
    if (offenN.length) { aus('\nNACHBARN — offene Eintraege anderer an denselben Stichworten. Gemeinsame Ursache? Dann `antworte <id>` oder ein Eintrag mit --bezug baut_auf:<id> auf beide:'); offenN.slice(0, 6).forEach(x => aus('  ' + x.eintrag.id + '  (' + x.eintrag.art + ', ' + x.gemeinsam.join(', ') + ')  ' + knapp(x.eintrag.titel, 100))); if (offenN.length > 6) aus('  … +' + (offenN.length - 6) + ' weitere'); }
    if (irr.length) { aus('\nIRRWEGE — dort schon versucht und mit Grund VERWORFEN. Lies den Grund, bevor du denselben Weg gehst:'); irr.slice(0, 4).forEach(x => aus('  ' + x.eintrag.id + '  ' + knapp(x.eintrag.titel, 90) + '\n      verworfen, weil: ' + knapp(x.grund, 160))); }
    if (neuE.art === 'befund' && !A.alsListe(neuE.bezug).some(x => x.art === 'gehoert_zu')) {
      const kv = A.klassenVorschlag(neuE, b2.eintraege), abl2 = A.ableiten(b2.eintraege);
      if (kv.length) { aus('\nFEHLERKLASSE? Diese koennten passen — nachschlagen, das Suchmuster fahren, dann `antworte ' + g.id.slice(-4) + ' --klasse <id>`:'); kv.forEach(x => aus('  ' + x.klasse.id + '  ' + knapp(x.klasse.titel, 90) + '\n      Suche: ' + (A.klasseWirksam(x.klasse, abl2.rueck).suchmuster || '(kein Suchmuster)'))); }
    }
    const vw = A.vorwissen(neuE, { 'STATUS.md': liesRel('STATUS.md'), 'CLAUDE.md': liesRel('CLAUDE.md') });
    if (vw.length) { aus('\nVORWISSEN — im Tagebuch steht dazu schon etwas (juengste Stelle; lies sie, bevor du neu misst):'); vw.slice(0, 5).forEach(x => aus('  ' + x.name + '  → ' + x.datei + ', ' + x.stellen + ' Stelle' + (x.stellen === 1 ? '' : 'n') + (x.abschnitt ? ' · „' + knapp(x.abschnitt, 90) + '"' : ''))); }
  }
  // Kritisch oder an Fernando: er liest STATUS §2 — sonst wird der Pruefstand (A5/A7) rot, und das erst in der CI.
  if (e.dringlichkeit === 'kritisch' || e.an === 'fernando') aus('\nKRITISCH bzw. an Fernando: diese Zeile gehoert in STATUS.md §2 (oder docs/FUER-FERNANDO.md), sonst wird austausch_check ' + (e.an === 'fernando' ? 'A5' : 'A7') + ' rot:\n  brett:' + g.id + ' — ' + knapp(g.titel, 120));
  aus('\nNoch NICHT sichtbar fuer andere. Erst nach:  git add ' + A.ORDNER + ' && git commit -m "Austausch: ' + g.art + ' ' + g.id + '" && git push -u origin HEAD');
}
function neu() {
  const art = o._[0];
  if (!art || !A.ARTEN[art]) ende(2, 'Gebrauch: node scripts/austausch.mjs neu <art> --titel "…" …   Arten: ' + Object.keys(A.ARTEN).join(' · ') + '\nFelder: node scripts/austausch.mjs hilfe <art>');
  const b = brett(), e = ausSchaltern(art), bz = bezuege(b);
  if (bz.length) e.bezug = bz;
  schreiben(e);
}
function antworte() {
  const b = brett(), ziel = finde(b, o._[0]), e = ausSchaltern('antwort');
  const art = o.widerspricht ? 'widerspricht' : (ziel.art === 'frage' ? 'beantwortet' : 'baut_auf');
  e.bezug = [{ art, id: ziel.id }].concat(bezuege(b));
  if (e.waechter && !e.waechter.length) delete e.waechter;
  // Eine Antwort, die nichts sagt, beantwortet nichts.
  if (!['text', 'beleg', 'anker', 'zaehle', 'gesucht', 'suchmuster', 'waechter', 'instanzen', 'geliefert'].some(k => e[k] != null && String(e[k]).length) && e.bezug.length < 2) ende(2, 'Eine Antwort braucht Inhalt: --text "…" (oder einen Nachtrag: --anker · --zaehle · --gesucht · --waechter · --klasse · --geliefert).');
  if (!e.titel) e.titel = (art === 'widerspricht' ? 'Widerspruch zu: ' : (art === 'beantwortet' ? 'Antwort auf: ' : 'Nachtrag zu: ')) + knapp(ziel.titel, 150);
  schreiben(e);
}
function schliesse() {
  const b = brett(), ziel = finde(b, o._[0]), e = ausSchaltern('abschluss');
  e.bezug = [{ art: 'schliesst', id: ziel.id }].concat(bezuege(b));
  if (!e.titel) e.titel = (e.ergebnis || 'Abschluss') + ': ' + knapp(ziel.titel, 150);
  schreiben(e);
}
function einspielen() {
  const datei = o._[0]; if (!datei) ende(2, 'Gebrauch: node scripts/austausch.mjs einspielen <datei.json>   (eine Liste von Eintraegen ohne id; Bezuege im Stapel als "@schluessel")');
  let roh; try { roh = JSON.parse(fs.readFileSync(path.resolve(datei), 'utf8')); } catch (x) { ende(2, 'Nicht lesbar: ' + datei + ' — ' + String(x.message).split('\n')[0]); }
  const v = laufendeVersion();
  if (Array.isArray(roh) && v) roh.forEach(e => { if (e && typeof e === 'object' && !e.stand) e.stand = v; });
  const braucht = Array.isArray(roh) && roh.some(e => e && typeof e === 'object' && !e.von);
  // Lage und Halt: dieselbe Pruefung wie beim Schreiben — vorher schrieb ein Stapel sie still mit fremdem `von`,
  // und gemergt beendete ein „fertig" im Namen eines anderen dessen Uebernahmen (Gegenpruefung 3).
  const absicht = Array.isArray(roh) && roh.some(e => e && typeof e === 'object' && (e.art === 'lage' || e.art === 'halt'));
  const r = A.einspielen(WURZEL, roh, { von: braucht ? ich() : undefined, sitzung: ichVon(), absichtVon: absicht ? [vonFuerAbsicht('lage')] : null, datum: o.datum, alleRefs: !o.nur_lokal });
  if (!r.ok) { aus('\nNICHTS geschrieben (alles oder nichts) — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.slice(0, 40).forEach(f => aus('  !! ' + f.wo + ': ' + f.grund)); if (r.fehler.length > 40) aus('  … +' + (r.fehler.length - 40) + ' weitere'); process.exit(1); }
  aus('\nGeschrieben: ' + r.geschrieben.length + ' Eintraege nach ' + A.ORDNER + '/');
  r.geschrieben.forEach(g => aus('  ' + g.id + '  (' + g.art + ')  ' + knapp(g.titel, 100)));
  r.auswaerts.forEach(m => aus('Bezug ueber die Branch-Grenze: ' + m.id + ' liegt nur auf ' + m.quelle + ' (der Bezug nennt den Branch)'));
  const krit = r.geschrieben.filter(g => { const x = Array.isArray(roh) ? roh[r.geschrieben.indexOf(g)] : null; return x && (x.dringlichkeit === 'kritisch' || x.an === 'fernando'); });
  if (krit.length) { aus('\nKRITISCH bzw. an Fernando — diese Zeilen gehoeren in STATUS.md §2 (sonst wird austausch_check A5/A7 rot):'); krit.forEach(g => aus('  brett:' + g.id + ' — ' + knapp(g.titel, 120))); }
  aus('\nNoch NICHT sichtbar fuer andere. Erst nach:  git add ' + A.ORDNER + ' && git commit && git push -u origin HEAD');
}
function erntenBefehl() {
  const r = A.ernten(WURZEL);
  if (r.gitDa === false) return aus('\ngit nicht verfuegbar — es gibt nichts zu ernten.\nNichts geschrieben.');
  aus('\nGeerntet: ' + r.geholt.length + ' Eintrag/Eintraege von anderen Branches (' + r.refs + ' Remote-Refs durchgesehen)');
  r.geholt.forEach(g => aus('  ' + g.id + '  {' + g.quelle + '}  ' + knapp(g.titel, 100)));
  if (r.uebergangen.length) { aus('Uebergangen (bleibt auf seinem Branch — ungueltig, oder es beschreibt dessen Baum): ' + r.uebergangen.length); r.uebergangen.forEach(u => aus('  ' + u.id + '  {' + u.quelle + '}  ' + u.grund)); }
  aus(r.geholt.length ? '\nJetzt im Arbeitsbaum. Mit dem naechsten Commit und PR kommen sie auf main an.' : '\nNichts geschrieben.');
}
function holen() {
  // OHNE --depth: ein flacher Abruf wuerde origin/main auf einen Commit kuerzen und
  // dem eigenen Branch die gemeinsame Geschichte nehmen (git merge braeche danach ab).
  // --prune: ein geloeschter Branch verschwindet auch hier — sonst zeigte `lesen` seine Eintraege
  // weiter als lebend, und der Verlust faele nie auf (die Sicherung `zz-sicherung` haelt sie fest).
  const r = A.git(WURZEL, ['fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*'], { frist: holFrist(HOL_FRIST_MS) });
  aus(r == null ? '\nHolen hat NICHT geklappt (kein Netz, kein origin, oder keine Antwort binnen ' + Math.round(holFrist(HOL_FRIST_MS) / 1000) + ' s?) — gezeigt wird der Stand, den git schon kennt.' : '\nAlle Branches geholt.');
  lesen();
}
// Frist fuer das Holen (Gegenpruefung 3: `naechste` und `nehme` warteten, solange der Remote hing — 20 s bei
// `ext::sh -c sleep 20`). Still (vor `naechste` und `nehme`) 20 s, `holen` 120 s; danach „Holen hat nicht geklappt"
// wie bei jedem Fehler. AUSTAUSCH_HOLEN_FRIST_MS setzt beide — fuer den Pruefstand (C19), der nicht warten soll.
const HOL_FRIST_MS = 120000, HOL_FRIST_STILL_MS = 20000;
const holFrist = (vorgabe) => { const n = Number(process.env.AUSTAUSCH_HOLEN_FRIST_MS); return n > 0 ? n : vorgabe; };

// ── Der Schwarm: Lage, Uebernahme, Halt, Veto, Aufheben, Sichern.
function holenStill() { return A.git(WURZEL, ['fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*'], { frist: holFrist(HOL_FRIST_STILL_MS) }) != null; }
// Darf diese Sitzung diese Ziele nehmen (bzw. dabei mithelfen)? EINE Rechnung mit dem Brett: die neue Lage wird
// probeweise dazugelegt und `schwarm` rechnet — vorher zaehlte `nehme` den Deckel anders als das Brett
// (Mithelf-Lagen nicht), sagte „Geschrieben", und die Uebernahme galt still nicht (Gegenpruefung 3).
function uebernahmePruefen(b, zielIds, ich0, auch) {
  const sw = schwarmVon(b), namen = meineNamen(), meins = (v) => namen.indexOf(v) >= 0;
  for (const id of zielIds) {
    const u = sw.uebernahme.get(id);
    if (auch && !u) return id + ' ist frei — niemand hat es genommen. Uebernehmen statt mithelfen: nehme ' + id.slice(-4) + ' (ohne --auch).';
    if (auch && meins(u.lage.e.von)) return id + ' hast du selbst genommen — mithelfen braucht es nicht.';
    if (!auch && u && !meins(u.lage.e.von)) return id + ' ist schon uebernommen: ' + u.lage.e.von + ' (seit ' + u.lage.e.datum + ' ' + u.lage.e.zeit + ' UTC, bis ' + uhr(u.lage.bis) + ').\nDie aelteste Uebernahme gilt. Mithelfen statt uebernehmen: --auch (deine Lage steht dann daneben).';
  }
  if (auch) return null;
  const t = A.heute(), probe = { id: t.datum + '-ffffffff', art: 'lage', datum: t.datum, zeit: t.zeit, von: ich0, titel: 'Probe', phase: 'laeuft', bis: bisAus(o.bis || '6h'), bezug: zielIds.map(z => ({ art: 'baut_auf', id: z })) };
  const wo = b.gitDa ? new Map(b.wo) : null;
  if (wo) wo.set(probe.id, new Set(['Arbeitsbaum']));
  const sw2 = A.schwarm(b.eintraege.concat([probe]), Date.now(), { wo, ich: namen });
  const zv = sw2.unwirksam.find(x => x.e === probe);
  if (zv) {
    const schon = [...sw.uebernahme].filter(([, u]) => meins(u.lage.e.von)).map(([z]) => z);
    return 'Du haeltst schon ' + schon.length + ' Uebernahme(n)' + (schon.length ? ' (' + schon.join(', ') + ')' : '') + ' — hoechstens ' + A.LAGE_NIMMT_MAX + ' zugleich; ' + zv.grund + '. Erst eine freigeben: lage --phase fertig --bezug baut_auf:<id>.';
  }
  for (const id of zielIds) { const u = sw2.uebernahme.get(id); if (!u || !meins(u.lage.e.von)) return id + ' ginge nicht an dich: ' + (u ? u.lage.e.von + ' war zuerst' : 'die Uebernahme rechnet nicht') + '.'; }
  return null;
}
function lageBefehl(ziele, vorab) {
  vorab = vorab || {};
  if (o.datum) ende(2, 'Datum und Zeit einer Lage setzt das Werkzeug.');
  const phase = o.phase || 'laeuft';
  const b = brett(), zielE = (ziele || []).map(k => finde(b, k));
  const e = ausSchaltern('lage');
  e.phase = phase; if (!e.bis) e.bis = bisAus('6h');
  const bz = zielE.map(z => ({ art: 'baut_auf', id: z.id })).concat(bezuege(b));
  if (bz.some(x => x.art !== 'baut_auf')) ende(2, 'Eine Lage traegt nur baut_auf:<id> (die Eintraege, die sie nimmt oder mit „fertig" freigibt).');
  if (bz.length) e.bezug = bz;
  const von = vorab.von || vonFuerAbsicht('lage');
  // `lage --bezug baut_auf:<id>` ist eine Uebernahme wie `nehme` — dieselbe Pruefung (vorher ging sie daran vorbei).
  if (bz.length && phase !== 'fertig' && !vorab.geprueft) { const f = uebernahmePruefen(b, bz.map(x => x.id), von, !!o.auch); if (f) ende(1, '\n' + f + '\nNichts geschrieben.'); }
  if (o.auch) { if (!bz.length || phase === 'fertig') ende(2, '--auch gehoert an eine Lage, die einen genommenen Eintrag mitbearbeitet: nehme <id> --auch.'); e.mithelfen = true; }
  if (!e.titel) e.titel = (zielE.length || bz.length ? (o.auch ? 'Mithelfen: ' : 'Nehme: ') + knapp((zielE[0] || b.eintraege.find(x => x.id === bz[0].id) || { titel: bz[0].id }).titel, 140) : 'Lage: ' + phase.replace('_', ' ') + (e.runde ? ' (Runde ' + e.runde + ')' : ''));
  schreiben(e, von);
}
function nehme() {
  if (!o._.length) ende(2, 'Gebrauch: node scripts/austausch.mjs nehme <id> [--bis 6h] [--text "…"] [--auch]   (schreibt eine Lage mit Bezug baut_auf)');
  // Vorher holen: wer gleichzeitig nimmt, soll es sehen. Die AELTESTE Uebernahme gilt.
  const geholt = holenStill();
  // `von` EINMAL rechnen (vorher zweimal — die Upstream-Warnung stand doppelt da).
  const b = brett(), von = vonFuerAbsicht('lage');
  const f = uebernahmePruefen(b, o._.map(k => finde(b, k).id), von, !!o.auch);
  if (f) ende(1, '\n' + f + '\nNichts geschrieben.');
  if (!geholt) aus('(Holen hat nicht geklappt — gerechnet auf dem Stand, den git kennt.)');
  lageBefehl(o._, { von, geprueft: true });
}
function haltBefehl(vetoZiel) {
  if (o.datum) ende(2, 'Datum und Zeit eines Halts setzt das Werkzeug.');
  const b = brett(), e = ausSchaltern('halt');
  if (!e.bis) e.bis = bisAus(vetoZiel ? '48h' : '24h');
  if (e.geltung) {
    for (const g0 of e.geltung) { const w = A.geltungFehler(g0); if (w) ende(2, 'geltung „' + g0 + '": ' + w); }
    const nie = A.geltungImBaum(WURZEL, e.geltung);
    if (nie.length) ende(2, nie[0]);
    e.geltung = e.geltung.map(A.geltungNorm);
  }
  if (vetoZiel) { const z = finde(b, vetoZiel); e.bezug = [{ art: 'widerspricht', id: z.id }].concat(bezuege(b)); if (!e.titel) e.titel = 'Veto gegen: ' + knapp(z.titel, 150); }
  else { const bz = bezuege(b); if (bz.length) e.bezug = bz; if (!e.titel) e.titel = 'Halt: ' + (e.geltung || []).join(', '); }
  schreiben(e);
}
function veto() { if (!o._[0]) ende(2, 'Gebrauch: node scripts/austausch.mjs veto <id> --text "Grund" [--bis 48h]'); haltBefehl(o._[0]); }
function aufheben() {
  const b = brett(), ziel = finde(b, o._[0]);
  if (ziel.art !== 'halt') ende(2, ziel.id + ' ist kein Halt (' + ziel.art + ') — aufgehoben wird nur ein Halt oder ein Veto.');
  const e = ausSchaltern('abschluss'); e.ergebnis = 'aufgehoben';
  e.bezug = [{ art: 'schliesst', id: ziel.id }];
  if (!e.titel) e.titel = 'Aufgehoben: ' + knapp(ziel.titel, 150);
  schreiben(e);
}
function sichern() {
  if (!o.baum || !o.alt) ende(2, 'Gebrauch: node scripts/austausch.mjs sichern --alt <sha|leer> --baum <datei> [--gedaechtnis <datei> --gedaechtnis-neu <datei>]   (das tut der Waechter, .github/workflows/brett-waechter.yml — nicht eine Sitzung)');
  const alt = String(o.alt) === 'leer' ? null : String(o.alt);
  if (alt && !/^[0-9a-f]{40}$/.test(alt)) ende(2, '--alt erwartet die volle Kennung des bisherigen Stands von ' + A.SICHERUNG_ZWEIG + ' oder „leer"');
  const r = A.sicherungSchreiben(WURZEL, { alt, stand: o.gedaechtnis ? path.resolve(String(o.gedaechtnis)) : null, standNeu: o.gedaechtnis_neu ? path.resolve(String(o.gedaechtnis_neu)) : null });
  if (r.grund) ende(2, 'Nicht gesichert: ' + r.grund);
  fs.writeFileSync(path.resolve(String(o.baum)), r.baum + '\n');
  // Im Bericht stehen ids und Quellen, nie Titel: der Bericht ist oeffentlich (Step-Summary, Log), und ein
  // Grabstein erreicht ihn nicht (Gegenpruefung 2: ein Personenname im Titel blieb dort stehen).
  const ids = (l) => [...new Set(l.map(x => x.id))];
  aus('## Brett-Waechter — Sicherung');
  for (const a of r.alarm) aus('- **ALARM:** ' + a);
  if (r.warnung) aus('- **Achtung:** ' + r.warnung);
  aus('- ' + r.refs + ' Remote-Refs gelesen · in diesem Lauf neu: ' + r.neu.length + (r.weitere.length ? ' · weitere Fassungen: ' + r.weitere.length : '') + ' · schon gesichert: ' + r.gleich + (r.unlesbar.length ? ' · unlesbar (nicht gesichert): ' + r.unlesbar.length : ''));
  if (o.gedaechtnis && !r.erstlauf) aus('- Gedaechtnis gelesen: nichts von dem, was zuletzt gesichert war, fehlte' + (r.fehlenInSicherung.length ? ' — AUSSER den oben genannten' : '') + '.');
  r.neu.slice(0, 40).forEach(x => aus('  - ' + x.id + ' {' + x.quelle + '}'));
  if (r.neu.length > 40) aus('  - … +' + (r.neu.length - 40) + ' weitere');
  if (r.weitere.length) aus('- **Weitere Fassung(en)** (umgeschrieben, oder auf zwei Branches verschieden — jede wird gesichert; unter eintraege/ liegt die, die fuer Leser gilt): ' + r.weitere.map(x => x.id + ' {' + x.quelle + '}').join(', '));
  if (r.doppelt.length) aus('- **Doppelt** (zwei Dateien derselben id auf einem Branch — die zweite ist gesichert, unter fassungen/): ' + r.doppelt.map(x => x.id + ' {' + x.quelle + '}').join(', '));
  if (r.strittig.length) aus('- **Strittig** (verschiedene Fassungen, keine zuzuordnen — fuer Leser nicht gerechnet, hier jede gesichert): ' + r.strittig.join(', '));
  // Unlesbare werden nie mit Dateinamen genannt: der Name traegt den Titel, und dieser Bericht ist oeffentlich (Gegenpruefung 3).
  const ul = (u) => (u.id || 'ohne id') + ' {' + u.quelle + '} Blob ' + String(u.blob).slice(0, 8);
  if (r.unlesbar.length) aus('- **Unlesbar** (keine gueltigen Eintraege, nicht gesichert — verschwinden sie mit ihrem Branch, wird es gemeldet): ' + r.unlesbar.slice(0, 20).map(ul).join(', '));
  if (r.unlesbarEntfernt.length) aus('- Unlesbare Datei(en) entfernt, ihr Branch besteht (vom Schreiber entfernt oder ersetzt): ' + r.unlesbarEntfernt.map(ul).join(', '));
  if (r.verworfen.length) aus('- **In der Sicherung verworfen** (kein gueltiger Eintrag unter einem Namen der Sicherung, oder ein Geheimnis — der neue Stand traegt sie nicht): ' + r.verworfen.slice(0, 20).map(v => (v.id || 'fremde Datei') + ' Blob ' + String(v.blob).slice(0, 8) + ' (' + v.grund + ')').join(', '));
  if (r.umgelegt.length) aus('- Umgelegt (einmal gesichert, also bleibt es): ' + r.umgelegt.map(x => (x.id || 'ohne id') + ' Blob ' + String(x.blob).slice(0, 8) + ' — ' + x.grund).join(', '));
  if (r.uebersprungen.length) aus('- **Nicht gesichert**: ' + r.uebersprungen.map(x => x.id + ' {' + x.quelle + '} ' + x.grund).join(' · '));
  if (r.entfernt.length) aus('- Entfernt (Grabstein): ' + r.entfernt.join(', '));
  if (r.vomSchreiber.length) aus('- Vom Schreiber zurueckgezogen (Grabstein auf seinem Branch; aus der Sicherung erst mit dem Grabstein auf main): ' + r.vomSchreiber.map(x => x.id + ' {' + x.quelle + '}').join(', '));
  if (r.abgebaut.length) aus('- Abgebaut (abgeloeste Fassung, Eintrag auf main, ' + A.SICHERUNG_ABBAU_TAGE + ' Tage auf keinem Branch): ' + ids(r.abgebaut).join(', '));
  if (r.zurueckgenommen.length) aus('- **Zurueckgenommen?** Auf dem Branch des Schreibers liegt jetzt eine AELTERE Fassung als die zuletzt gesicherte (Ruecknahme — oder ein Force-Push hat zurueckgesetzt); die neuere liegt nur noch hier, unter fassungen/: ' + ids(r.zurueckgenommen).join(', '));
  const still = !r.nurHier.length && !r.zurueckgenommen.length && !r.uebersprungenWeg.length && !r.unlesbarWeg.length;
  aus(r.nurHier.length ? '- **NUR NOCH IN DER SICHERUNG: ' + ids(r.nurHier).length + '** — ein Branch wurde geloescht oder zurueckgesetzt: ' + ids(r.nurHier).join(', ') + '. `node scripts/austausch.mjs ernten` holt in einen Arbeitsbaum, was dort stimmt.'
    : (still ? '- Nichts verloren: jede gesicherte Fassung liegt noch auf einem Branch (oder der Eintrag ihres Schreibers in neuerer Fassung auf main bzw. seinem Branch).' : '- Keine Fassung liegt nur noch hier — aber siehe oben.'));
  if (r.alarm.length) process.exitCode = 3;
}

const BEISPIELE = {
  befund: 'neu befund --titel "Die Kachel zaehlt drei Tage, die Zeile daneben nur heute" --beleg "nutzersicht_check E10 misst nur die Startkarte" --stichwort meine-pflanzen,faellig-kachel --anker "index.html::<woertliches Stueck der Stelle>" [--zaehle "index.html::<woertlicher Text>"] [--klasse <id>] [--vorschlag "…"]',
  idee: 'neu idee --titel "Die Wochenzeile auch in der Glocke" --nutzen "eine Rechnung, vier Anzeigen statt drei" --pruefbar "kalender_check R10b um die Glocke erweitern" --bezug baut_auf:a3f9',
  frage: 'neu frage --titel "Messen die vier Pruefstaende hinter dem Anmeldebildschirm?" --an alle --haengt-daran "ob vier Berichte etwas messen"   (--an fernando: dann die Frage auch in STATUS.md §2 nennen — brett:<id>)',
  klasse: 'einspielen <datei.json> — eine Klasse hat Listen; als JSON ist sie leichter zu schreiben. Felder: titel, regel, text, instanzen[], suchmuster, gesucht, waechter[{datei, fall}] oder ohne_waechter, stichworte[]',
  antwort: 'antworte a3f9 --text "Nachgemessen: …" --beleg "…"     (Frage → beantwortet; sonst baut_auf; --widerspricht; Nachtrag: --anker "datei::text" · --zaehle "datei::text" · --gesucht "…" · --waechter "datei::Fall" · --klasse <id>)',
  lage: 'lage --phase letzte_runde --runde 4/5 --bis 2h --titel "Kalender: Sieb fertig, nur noch die Gegenproben"     (nehme <id>: eine Lage mit Bezug — die Aufgabe ist uebernommen; --phase fertig beendet die eigene Lage)',
  halt: 'halt --geltung "gsKalenderEreignisse,bump" --bis 24h --text "main ist rot — bis zur Reparatur kein Bump"     (Geltung: Pfade, Funktionsnamen, bump — kein *, nie index.html oder STATUS.md als Ganzes. veto <id> --text "…" ist ein Halt gegen EINEN Eintrag. aufheben <id> --text "…")',
  abschluss: 'schliesse a3f9 --ergebnis erledigt --wohin "v33.57" --geschwister "gesucht: grep -c … → 4 Stellen, alle umgestellt"     (--geschwister nur beim BEFUND; „nicht gesucht, weil …" ist erlaubt, Schweigen nicht. Hat der Befund eine Zaehlung, muss sie sich bewegt haben. verworfen: --text mit dem Grund. aufgestiegen: --wohin "ROADMAP.md P2")',
};
function hilfe() {
  const art = o._[0];
  if (art && A.ARTEN[art]) {
    const a = A.ARTEN[art];
    return aus('\n' + a.wort + ' — ' + a.sinn + '\n  Pflicht: titel' + (a.pflicht.length ? ', ' + a.pflicht.join(', ') : '') + (a.brauchtBezug ? ', ein Bezug (' + a.brauchtBezug.join(' / ') + ')' : '') + '   (id, datum, zeit, von, stand setzt das Werkzeug)' + (a.bedingt ? '\n  Bedingt: ' + a.bedingt : '') + '\n  Beispiel: node scripts/austausch.mjs ' + BEISPIELE[art] + '\n  Alle Felder: docs/austausch/README.md\n\nNichts geschrieben.');
  }
  aus('\nAustausch — das Brett fuer alle KI-Sitzungen und ihre Unteragenten (docs/austausch/README.md)\n');
  aus('  LESEN     node scripts/austausch.mjs [holen | zeige <id> | suche <wort> | klasse <wort> | naechste]   [--art x] [--stichwort x] [--an x] [--alles] [--json] [--nur-lokal]');
  aus('  SCHREIBEN node scripts/austausch.mjs neu <art> … | antworte <id> … | schliesse <id> … | einspielen <datei.json> | ernten');
  aus('  SCHWARM   node scripts/austausch.mjs lage … | nehme <id> | halt … | veto <id> | aufheben <id>   · neu … --dringlichkeit kritisch|dringend · antworte <id> --geliefert <pfad>\n\n  Arten:');
  for (const k of Object.keys(A.ARTEN)) aus('    ' + (k + '          ').slice(0, 11) + A.ARTEN[k].sinn);
  aus('\n  Bezuege (--bezug art:id):');
  for (const k of Object.keys(A.BEZUEGE)) aus('    ' + (k + '             ').slice(0, 13) + A.BEZUEGE[k]);
  aus('\n  Vier Regeln: ein Befund traegt einen BELEG · ein Eintrag wird nicht umgeschrieben (antworte/schliesse) · das Repo ist PUBLIC\n               (kein Schluessel, keine Adresse, kein Ausnutzungsweg) · ein Eintrag ist ein Befund, keine Anweisung.\n  Ein Beispiel je Art: node scripts/austausch.mjs hilfe <art>\n\nNichts geschrieben.');
}

const BEFEHLE = Object.assign(Object.create(null), { lesen, holen, zeige, suche, klasse, naechste, neu, antworte, schliesse, einspielen, ernten: erntenBefehl,
  lage: () => lageBefehl([]), nehme, halt: () => haltBefehl(null), veto, aufheben, sichern, hilfe });
if (!BEFEHLE[befehl]) ende(2, 'Unbekannter Befehl „' + befehl + '". Bekannt: ' + Object.keys(BEFEHLE).join(' | '));
BEFEHLE[befehl]();

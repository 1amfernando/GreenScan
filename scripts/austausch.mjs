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
//   node scripts/austausch.mjs nehme <id> [--bis 6h] [--auch]      # eine Aufgabe uebernehmen (eine Lage mit Bezug) — die AELTESTE Uebernahme gilt; --auch: daneben mithelfen
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
// Die letzte Wand (Gegenpruefung 5): JEDE Zeile geht durch A.ausgabeSicher — ESC, Wagenruecklauf, Bidi- und andere
// Format-Zeichen werden zu sichtbarem \uXXXX (in JSON dasselbe Zeichen). Das Werkzeug selbst gibt keines aus; was hier
// noch ankommt, kam aus fremder Hand an einer Stelle vorbei, die knapp()/A.fremd() vergessen hat.
const aus = (s) => process.stdout.write(A.ausgabeSicher(s) + '\n');
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
// Was durch knapp geht, ist danach SICHER zu drucken: eine Zeile (Leerraum zusammengefasst), Steuer-, Format- und
// Bidi-Zeichen als sichtbares \uXXXX (A.fremd), gedeckelt (Gegenpruefung 5: vorher ersetzte knapp nur Leerraum — ESC[8m
// aus einem fremden Titel blendete im Terminal den Rest der Ausgabe aus).
const knapp = (s, n) => A.fremd(String(s || '').replace(/\s+/g, ' ').trim(), n);
// Ein NAME aus fremder Hand — Ref, Datei, Quelle {…} — geht STRENG durch (Gegenpruefung 5b, Skeptiker, R5c-A1): jedes unsichtbare
// Zeichen wird sichtbar, auch ZWJ, ZWNJ und weicher Trennstrich, die in Titeln und Text roh bleiben (knapp). Vorher standen
// claude/ab, claude/a<U+200D>b und claude/a<U+00AD>b in FRISCHE BRANCHES dreimal als „origin/claude/ab" da. Der Deckel ohne Angabe
// (300) liegt ueber origin/ + 255 Zeichen (AN_SITZUNG): wo vorher roh gedruckt wurde, kuerzt er keinen ehrlichen Namen.
const nameSicher = (s, n) => A.fremd(s, n || 300, { streng: true });
// Ein Halt, dessen Ankunft hier nicht rechenbar ist (Teilabruf, Verzeichnis nicht gelesen), WIRKT — die sichere Richtung (E5). Er sagt
// es dazu, mit Grund, in `zeige`, in der HALT-Zeile und im Block HALT UND VETO (Gegenpruefung 5, Skeptiker, R5b-fassungen-6: vorher
// stand nur „Wirkt jetzt: ja", und niemand erfuhr, dass die Zeitpruefung hier nicht lief).
const ankunftSatz = (h) => h && h.ankunftOffen ? '   [Ankunft nicht rechenbar (' + knapp(h.ankunftOffen, 160) + ') — er wirkt trotzdem: im Zweifel gilt ein Halt]' : '';
// Woran eine NICHT GERECHNETE Lage zu erkennen ist: der Grund, mit dem A.schwarm sie meldet.
const OFFEN_GRUND = /^Ankunft nicht rechenbar/;
const liesRel = (rel) => { try { return fs.readFileSync(path.join(WURZEL, rel), 'utf8'); } catch (_) { return null; } };
const quelltext = () => { const a = liesRel('index.html'); return a == null ? null : a + '\n' + (liesRel('sw.js') || ''); };
const laufendeVersion = () => { const m = (liesRel('index.html') || '').match(/\bGS_VERSION\s*=\s*'(v\d+\.\d+)'/); return m ? m[1] : null; };
// `ich`: fuer EIGENE Eintraege gilt die Fassung im Arbeitsbaum, fuer fremde die von main bzw. vom Branch ihres Schreibers.
// --nur-lokal heisst „kein Netz", nicht „nur der Arbeitsbaum" (Gegenpruefung 5, R5-lesen-5): gelesen werden ALLE Refs, die
// git lokal kennt — ohne Netz und ohne Nachladen. Vorher las der Befehl damit nur den Arbeitsbaum: `naechste --nur-lokal`
// endete trotz zwei fremder Bump-Halts mit 0, und `nehme … --nur-lokal` holte erst und schrieb dann eine zweite Uebernahme.
const brett = () => A.brettLesen(WURZEL, { alleRefs: true, ich: meineNamen() });

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
// Alle Namen, die „ich" sind: der lokale Branch (mitten im Rebase der umgebaute) — und nach einem `git branch -m` jeder
// fruehere Name, dessen Eigentum BELEGT ist (A.eigenerZweig: diesen Ref auf origin hat dieser Klon angelegt), auch
// nach dem Umzug nach origin/<neu> (A.eigeneNamen). Vorher spaltete sich die Identitaet nach einem Umbenennen
// (Gegenpruefung 3), danach zaehlte JEDER Upstream, auch der fremde aus `checkout -b x origin/<fremd>` (Gegenpruefung 4),
// und dann jeder, der nicht genau per `checkout -b x origin/x` kam (Gegenpruefung 5). Mit --von / AUSTAUSCH_VON genau
// dieser eine.
function meineNamen() {
  if (o.von) return [String(o.von)];
  if (process.env.AUSTAUSCH_VON) return [process.env.AUSTAUSCH_VON];
  return A.eigeneNamen(zweig);
}
// Eine Lage oder ein Halt wirkt nur, wenn `von` zum Branch passt, auf dem sie liegen — eine andere Kennung
// waere fuer alle anderen sofort UNWIRKSAM (Gegenpruefung 2: `--von koordinator` schrieb still eine).
// Was nach einem `git branch -m` gilt, sagt EIN Satz (Gegenpruefung 5): unter dem alten Namen wirkt fuer die anderen,
// was auf origin/<alt> liegt, bis zur Frist oder bis origin/<alt> geloescht ist — nach origin/<neu> zu pushen loescht
// dort nichts (vorher hiess es „dann erloeschen deine Lagen und Halts unter dem alten Namen", und keiner erlosch).
const altSatz = (alt) => 'Was unter sitzung/' + alt + ' auf origin/' + alt + ' liegt, wirkt fuer die anderen weiter, bis seine Frist endet oder origin/' + alt + ' geloescht ist (git push origin --delete ' + alt + ' — ein offener PR von ' + alt + ' schliesst sich damit); freigeben unter dem alten Namen: lage --phase fertig [--bezug baut_auf:<id>] --von sitzung/' + alt + ', dann git push origin HEAD:' + alt + '. Eine Verlaengerung unter dem neuen Namen setzt keine Uebernahme fort, sie beginnt neu.';
function vonFuerAbsicht(art) {
  // Auf main liegt nichts, was fuer andere wirkt — vorher verwiesen zwei Meldungen im Kreis („bitte --von" /
  // „ohne --von schreiben"), Gegenpruefung 3.
  if (zweig.name === 'main' || zweig.name === 'master') ende(2, ARTEN_WORT(art) + ' nur von einem EIGENEN Branch: auf ' + zweig.name + ' gilt „von" fuer niemanden (und auf main wird nie direkt gepusht) — git checkout -b claude/<thema>, dann schreiben und pushen.');
  const v = ich(), alte = zweig.alteNamen || [];
  // Ein belegter alter Name nach `git branch -m` (A.eigenerZweig: origin/<alt> hat dieser Klon angelegt) — nie ein fremder
  // Upstream (Gegenpruefung 4), und seit Gegenpruefung 5 auch nach dem Umzug nach origin/<neu> (vorher liess sich unter
  // dem alten Namen dann nichts mehr freigeben).
  const alt = alte.find(n => v === 'sitzung/' + n);
  if (alt) {
    if (alt === zweig.upstream) return v;   // die Pushes gehen nach origin/<alt>: alles bleibt beim alten Namen
    const ff = A.git(WURZEL, ['merge-base', '--is-ancestor', 'refs/remotes/origin/' + alt, 'HEAD']) != null;
    aus('(' + ARTEN_WORT(art) + ' von „' + v + '" — deinem alten Namen — wirkt fuer die anderen nur auf origin/' + alt + '; auf origin/' + (zweig.upstream || zweig.name) + ' waere ' + (art === 'lage' ? 'sie' : 'er') + ' UNWIRKSAM. '
      + (ff ? 'Dorthin pushen: git push origin HEAD:' + alt + ')' : 'origin/' + alt + ' steckt nicht in diesem Stand (umgeschrieben?) — dorthin geht nur ein Force-Push; lass die Frist auslaufen oder loesche origin/' + alt + '.)'));
    return v;
  }
  if (zweig.name && v !== 'sitzung/' + zweig.name) {
    const b0 = v.replace(/^sitzung\//, '');
    const warum = (zweig.umbenanntAus || []).indexOf(b0) >= 0
      ? ' — ' + b0 + ' war ein frueherer Name dieses Branches, aber dass origin/' + b0 + ' deiner ist, ist nicht belegt (nicht von diesem Klon angelegt: geholt, aus einem frischen Klon, oder schon geloescht)'
      : (zweig.upstream && v === 'sitzung/' + zweig.upstream ? ' — origin/' + zweig.upstream + ' ist nicht dieser Branch unter altem Namen (kein `git branch -m` belegt), sondern ein fremder' : '');
    ende(2, ARTEN_WORT(art) + ' von „' + v + '" auf dem Branch ' + zweig.name + ': fuer alle anderen waere ' + (art === 'lage' ? 'sie' : 'er') + ' UNWIRKSAM („von" passt nicht zum Branch)' + warum + '. Ohne --von / AUSTAUSCH_VON schreiben.');
  }
  if (!zweig.name) {
    // Losgeloester HEAD: wer als „sitzung/<b>" schreibt, muss auf <b> pushen koennen, ohne etwas zu ueberschreiben —
    // HEAD stammt von origin/<b> ab, oder <b> gibt es noch nicht. Vorher schrieb das Werkzeug Lage und „fertig" mit
    // JEDEM --von, und der Satz „wirkt erst, wenn er auf origin/<b> liegt" las sich wie eine Einladung (Gegenpruefung 4).
    // Mitten im Rebase eines losgeloesten HEAD hilft `git switch` nicht (git verweigert ihn dort) — erst den Rebase beenden.
    const zurueck = zweig.rebase ? 'erst den Rebase beenden (git rebase --continue oder --abort), dann auf deinem eigenen Branch schreiben' : 'auf deinem eigenen Branch schreiben (git switch <dein-branch>)';
    const b = v.replace(/^sitzung\//, ''), ref = 'refs/remotes/origin/' + b, M = 'refs/remotes/origin/main';
    const refDa = A.git(WURZEL, ['rev-parse', '--verify', '--quiet', ref]) != null;
    if (refDa && A.git(WURZEL, ['merge-base', '--is-ancestor', ref, 'HEAD']) == null)
      ende(2, ARTEN_WORT(art) + ' von „' + v + '" aus einem losgeloesten HEAD: dieser Stand stammt nicht von origin/' + b + ' ab — das ist nicht dein Branch. Bitte ' + zurueck + '.');
    // Steht origin/<b> schon ganz auf origin/main, stammt JEDER Stand von main von ihm ab — das belegt nichts (dieselbe Wache
    // wie in A.prKopf). Vorher schrieb ein losgeloester HEAD auf main Lage und „fertig" im Namen jedes gemergten Branches
    // (Gegenpruefung 5).
    if (refDa && A.git(WURZEL, ['rev-parse', '--verify', '--quiet', M]) != null && A.git(WURZEL, ['merge-base', '--is-ancestor', ref, M]) != null)
      ende(2, ARTEN_WORT(art) + ' von „' + v + '" aus einem losgeloesten HEAD: origin/' + b + ' steht schon ganz auf origin/main — jeder Stand von main stammt von ihm ab, das belegt nicht, dass er deiner ist. Bitte ' + zurueck + '.');
    aus('(Losgeloester HEAD: ' + ARTEN_WORT(art) + ' traegt „' + v + '" und wirkt fuer andere erst auf origin/' + b + ' — nur wenn das DEIN Branch ist: git push origin HEAD:' + b + ')');
  }
  if (zweig.upstream && zweig.umbenannt) aus('(Achtung: dieser Branch heisst ' + zweig.name + ', sein Upstream origin/' + zweig.upstream + ' (dein alter Name) — landet der Eintrag dort, gilt ' + ARTEN_WORT(art) + ' von „' + v + '" fuer alle anderen NICHT. Entweder mit --von sitzung/' + zweig.upstream + ' schreiben (dann bleibt alles beim alten Namen), oder nach origin/' + zweig.name + ' pushen (git push -u origin HEAD:' + zweig.name + '). ' + altSatz(zweig.upstream) + ')');
  else if (zweig.upstream) aus('(Dein Upstream origin/' + zweig.upstream + ' ist ein fremder Branch — dorthin gehoert ' + ARTEN_WORT(art) + ' nicht. Pushen: git push -u origin HEAD:' + zweig.name + ')');
  return v;
}
// Jeder andere Eintrag: liegt er spaeter auf einem Branch, dessen Name nicht in `von` steht, entscheidet sein `von`
// nichts — und kommt eine zweite Fassung mit anderem `von` dazu, ist er strittig (Gegenpruefung 4: nach `git branch -m`
// schrieb das Werkzeug ohne Warnung einen kritischen Befund, der gegen eine Faelschung verlor).
function vonHinweis(v) {
  if (!zweig.name || v !== 'sitzung/' + zweig.name || !zweig.upstream) return;
  aus('(Dieser Branch heisst ' + zweig.name + ', sein Upstream origin/' + zweig.upstream + ': pushe nach origin/' + zweig.name + ' (git push -u origin HEAD:' + zweig.name + ') — auf origin/' + zweig.upstream + ' passt „' + v + '" nicht zu seinem Branch, und gegen eine zweite Fassung mit anderem „von" waere der Eintrag strittig.)');
}
const ARTEN_WORT = (art) => (A.ARTEN[art] || { wort: art }).wort;
const schwarmVon = (b) => A.schwarm(b.eintraege, Date.now(), { wo: b.gitDa ? b.wo : null, ich: meineNamen() });
// „Meins" heisst: von mir geschrieben — und dort, wo ich schreibe (vonPasst). Ein Eintrag mit meinem Namen
// auf einem fremden Branch ist nicht meiner (Gegenpruefung 2: er schaltete DICH BETREFFEND ab).
const meinsVon = (b, ich0) => { const namen = ich0 ? meineNamen() : []; return (e) => namen.indexOf(e.von) >= 0 && A.vonPasst(e, b.gitDa ? b.wo : null, namen); };
// Eine id darf abgekuerzt werden: die vier Zeichen am Ende reichen, wenn sie eindeutig sind.
// Eine STRITTIGE id (keine Fassung gilt) kennt finde auch (Gegenpruefung 5: die id aus der STRITTIG-Zeile hiess „Kein
// Eintrag"): `zeige` zeigt dann jede Fassung mit ihrer Quelle (opts.strittig); jeder andere Befehl sagt, warum er sich
// nicht darauf beziehen kann — ein Bezug auf eine id, die fuer niemanden gilt, zeigte ins Leere.
function finde(b, kennung, opts) {
  kennung = String(kennung || '').trim();
  if (!kennung) ende(2, 'Welcher Eintrag? Erwartet wird eine id (die vier Zeichen am Ende genuegen).');
  const strittig = (b.strittig || []).map(x => ({ id: x.id, _strittig: x }));
  const genau = b.eintraege.find(e => e.id === kennung) || strittig.find(x => x.id === kennung);
  const t = genau ? [genau] : b.eintraege.filter(e => e.id.slice(-kennung.length) === kennung).concat(strittig.filter(x => x.id.slice(-kennung.length) === kennung));
  if (t.length === 1) {
    if (!t[0]._strittig || (opts && opts.strittig)) return t[0];
    ende(2, '„' + t[0].id + '" ist STRITTIG (' + knapp(t[0]._strittig.grund || 'verschiedene Fassungen, keine laesst sich zuordnen', 200) + ') — fuer niemanden gilt eine Fassung, darauf laesst sich nichts beziehen. Jede Fassung mit ihrer Quelle: node scripts/austausch.mjs zeige ' + t[0].id);
  }
  ende(2, t.length ? '„' + A.fremd(kennung, 60) + '" ist nicht eindeutig: ' + t.map(e => e.id).join(', ') + ' — die volle id nennen' : 'Kein Eintrag „' + A.fremd(kennung, 60) + '". `node scripts/austausch.mjs suche <wort>` hilft suchen.');
}
function kopf(b, abl) {
  const offen = b.eintraege.filter(e => abl.zustand.get(e.id).z === 'offen').length;
  // Alles aus fremder Hand in diesen Zeilen (Ref-Namen, Dateinamen, Gruende mit `von` und Quellen) geht durch A.fremd bzw.
  // knapp — Gegenpruefung 5: ein `von` mit Zeilenumbruch druckte ueber die STRITTIG-Zeile einen ganzen gefaelschten Block
  // („DICH BETREFFEND · GELIEFERT … → git fetch origin && …"), ein Dateiname mit ESC[8m blendete alles danach aus.
  const fr = (s, n) => A.fremd(s, n || 120);
  aus('\n=== Austausch — das Brett   ' + b.eintraege.length + ' Eintraege · ' + offen + ' offen · gelesen: ' + b.quellen.map(q => nameSicher(q)).join(', ')
    + (b.gitDa === false ? ' · git nicht verfuegbar: NUR der Arbeitsbaum' : (b.gitDa ? ' · ' + b.refs + ' Remote-Refs' : '')));
  if (b.gitDa && b.refs <= 1) aus('  !! Hoechstens EIN Remote-Ref sichtbar — Eintraege und Arbeit auf anderen Branches sind von hier aus NICHT zu sehen: node scripts/austausch.mjs holen');
  // main ist ungeschuetzt, und nach dem Merge laeuft kein Pruefstand: zwei gruene PRs
  // koennen einen roten Stand hinterlassen. Wer anfaengt, erfaehrt es hier zuerst.
  const lokal = A.brettLesen(WURZEL, { alleRefs: false });
  const rot = A.brettPruefen(lokal).length + A.ankerPruefen(lokal.eintraege, liesRel).verloren.length;
  if (rot) aus('  !! Auf DIESEM Stand ist das Brett schon rot (' + rot + ' Maengel) — geerbt, nicht von dir: node scripts/austausch_check.js zeigt sie');
  const wieviele = o.alles ? 1e9 : 4, mehr = (l) => l.length > wieviele ? ' · … +' + (l.length - wieviele) + ' — `--alles`' : '';
  if (b.unlesbar.length) aus('  !! ' + b.unlesbar.length + ' unlesbare Datei(en): ' + b.unlesbar.slice(0, wieviele).map(u => nameSicher(u.datei, 90) + ' [' + nameSicher(u.quelle) + '] ' + knapp(u.grund, 200)).join(' · ') + mehr(b.unlesbar));
  if (b.abweichend.length) aus('  !! ' + b.abweichend.length + ' Eintrag/Eintraege sehen auf einem Branch anders aus (umgeschrieben?): ' + b.abweichend.slice(0, wieviele).map(x => fr(x.id, 40) + ' — es gilt ' + nameSicher(x.gilt) + ', abweichend ' + nameSicher(x.weichtAb, 200)).join(' · ') + mehr(b.abweichend));
  // Mit dem Weg, beide Fassungen anzusehen (`zeige <id>` kennt eine strittige id, Gegenpruefung 5).
  if (b.strittig.length) aus('  !! STRITTIG — ' + b.strittig.length + ' Eintrag/Eintraege in verschiedenen Fassungen, keine laesst sich zuordnen (weder main, noch der Branch des Schreibers, noch die Sicherung) — NICHT gerechnet: ' + b.strittig.slice(0, wieviele).map(x => fr(x.id, 40) + ' {' + x.quellen.map(q => nameSicher(q)).join(', ') + '}' + (x.grund ? ' — ' + knapp(x.grund, 240) : '')).join(' · ') + mehr(b.strittig) + '   (jede Fassung mit ihrer Quelle: zeige <id>)');
  if ((b.neuAngelegt || []).length) aus('  !! ' + b.neuAngelegt.length + ' Eintrag/Eintraege: die Fassung auf einem NEU ANGELEGTEN Branch gilt nicht als Berichtigung des Schreibers — es gilt die gesicherte: ' + b.neuAngelegt.slice(0, 4).map(x => fr(x.id, 40) + ' (' + knapp(x.hinweis, 200) + ')').join(' · '));
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
  // Nur nach einem BELEGTEN Umbenennen ist der Upstream der eigene alte Name — sonst ist er ein fremder Branch, und der
  // Rat „weiter als --von sitzung/<upstream>" hiesse: schreib im Namen eines anderen (Gegenpruefung 4).
  const upstreamGesagt = !!(ich0 && zweig.upstream && zweig.umbenannt && !o.von && !process.env.AUSTAUSCH_VON);
  // Mit Befehl — nie gekuerzt (der wichtigste Teil steht am Ende: was beim Umzug erlischt).
  if (upstreamGesagt) { const zl = 'Dein Branch heisst hier ' + zweig.name + ', sein Upstream origin/' + zweig.upstream + ' (dein alter Name) — du schreibst als ' + ich0 + '; auf origin/' + zweig.upstream + ' gilt das fuer andere nicht. Entweder weiter als --von sitzung/' + zweig.upstream + ', oder nach origin/' + zweig.name + ' pushen (git push -u origin HEAD:' + zweig.name + '). ' + altSatz(zweig.upstream); befehle.add(zl); z.push(zl); }
  // Ein belegter alter Name, auf den nicht mehr gepusht wird (der Rat oben wurde befolgt): was dort liegt, wirkt weiter —
  // gesagt, solange dort noch etwas von dir wirkt (Gegenpruefung 5: der Rat versprach, es erloesche).
  if (ich0 && !o.von && !process.env.AUSTAUSCH_VON) for (const alt of (zweig.alteNamen || []).filter(n => n !== zweig.upstream)) {
    const n = 'sitzung/' + alt, wirkt = sw.halts.filter(h => h.e.von === n).length + sw.lagen.filter(l => l.e.von === n).length + [...sw.uebernahme.values()].filter(u => u.lage.e.von === n).length;
    if (!wirkt) continue;
    const zl = 'Dein alter Name ' + alt + ' (origin/' + alt + ', von dir angelegt) zaehlt weiter als deiner: dort wirkt noch Halt, Lage oder Uebernahme. ' + altSatz(alt);
    befehle.add(zl); z.push(zl);
  }
  for (const h of sw.halts) {
    if (h.veto || meins(h.e)) continue;
    const t = A.haltBeruehrt(h.e, aend);
    if (!t.length) continue;
    schonGenannt.add(h.e.id);
    const gesehen = h.antworten.some(meins);
    // Die wichtigste Zeile wird NIE gekuerzt (Gegenpruefung 5: bei einem langen Branch-Namen fiel bei 260 Zeichen genau das
    // weg, worauf es ankommt — „beruehrt …" und „→ lies ihn (zeige …)"). Gekuerzt wird vorher, was sich kuerzen laesst:
    // Titel und Quelle; `von` faellt weg, wenn es nur den Branch der Quelle wiederholt. Jeder Teil ist sicher gedruckt
    // (A.fremd/knapp), weil die Zeile nicht mehr durch das knapp am Ende geht. `zeige` mit der VOLLEN id: vier Zeichen
    // sind nur eindeutig, solange keine zweite id gleich endet.
    const q = String(h.e._quelle || 'Arbeitsbaum');
    const vonT = h.e.von === 'sitzung/' + q.replace(/^origin\//, '') ? '' : ' von ' + A.fremd(h.e.von, 60);
    const zl = 'HALT ' + h.e.id + ' {' + nameSicher(q, 60) + '}' + vonT + ' bis ' + uhr(h.bis) + ': ' + knapp(h.e.titel, 60) + ' — beruehrt ' + t.slice(0, 4).map(x => knapp(x, 80)).join(', ') + (t.length > 4 ? ' … +' + (t.length - 4) : '')
      + (gesehen ? '   [du hast geantwortet]' : '   → lies ihn (zeige ' + h.e.id + '), dann warten, aufheben mit Grund oder antworten') + ankunftSatz(h);
    befehle.add(zl); z.push(zl);
  }
  // Ein Veto gegen eine Lage oder einen Halt zaehlt nur, solange das Ziel noch wirkt.
  const wirktNoch = (t) => (t.art !== 'lage' && t.art !== 'halt') || sw.halts.some(h => h.e === t) || sw.lagen.some(l => l.e === t) || [...sw.uebernahme.values()].some(u => u.lage.e === t || u.auch.some(x => x.e === t));
  for (const [ziel, hs] of sw.vetos) {
    const t = abl.proId.get(ziel);
    if (!t || !meins(t) || !wirktNoch(t)) continue;
    for (const h of hs) if (!meins(h.e)) schonGenannt.add(h.e.id), z.push('VETO ' + h.e.id + ' {' + nameSicher(h.e._quelle) + '} von ' + h.e.von + ' bis ' + uhr(h.bis) + ' gegen deinen Eintrag ' + ziel + ': ' + knapp(h.e.text, 90));
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
  // Dein Eintrag, gepusht — und fuer die anderen gilt eine ANDERE Fassung (oder er ist fuer sie strittig). Vorher sah der
  // Schreiber „Wirkt jetzt: ja", waehrend alle anderen die alte gesicherte Fassung lasen (Gegenpruefung 4).
  // Der Rat haengt am GRUND (Gegenpruefung 5): vorher stand bei jedem Grund „`von` und Branch muessen zusammenpassen … schreib
  // ihn neu (neue id)" — auch wenn eine FREMDE Kopie mit anderem `von` den Eintrag strittig machte; die neue id haette der
  // Kopierer sofort wieder kopiert, und abgeschnitten war der Rat obendrein. Jetzt: liegt deine Fassung auf dem Branch,
  // den ihr `von` nennt, und tragen andere Fassungen ein anderes `von`, nennt die Zeile deren Quelle und sagt „nichts
  // umschreiben". Nur wenn dein `von` nicht zu dem Branch passt, auf dem deine Fassung liegt, der alte Rat. Nie gekuerzt.
  for (const [id, ga] of (b.giltAndere || new Map())) {
    const mv = b.gilt && b.gilt.get(id), meinVon = mv ? mv.e.von : null;
    const passt = !!mv && [...mv.quellen].some(q => A.istAutorRef(q, A.autorZweig(mv.e)));
    const kopien = ((b.fassungen && b.fassungen.get(id)) || []).filter(v => v.e.von !== meinVon);
    const kopieRefs = [...new Set(kopien.flatMap(v => [...v.quellen]).filter(q => q !== 'Arbeitsbaum'))];
    const kopieVons = [...new Set(kopien.map(v => v.e.von))];
    let zl = 'DEIN EINTRAG ' + id + ': du siehst deine Fassung, fuer die anderen gilt ';
    // Gegenpruefung 5b, Skeptiker (R5c-Le3, F4): fuer die anderen gilt (dieselbe oder die gesicherte) Fassung, aber sie WIRKT nicht —
    // der Branch wurde neu angelegt, und der Waechter kannte die id schon vorher (D6). Vorher schwieg diese Zeile, wenn es dieselbe
    // Fassung war, und `zeige` sagte nur „Wirkt jetzt: ja".
    // Nachpruefung 5d (identitaet): „ueber main" fuer eine LAGE nicht — ihr Anspruch (mit bis) war zu Hause nie bekannt, auf main misst
    // das Verzeichnis ihn erst ab dem naechsten Waechterlauf, und nach mehr als 6 h offenem PR heisst sie dort rueckdatiert (gemessen,
    // d6main.mjs). Ein Halt hat den Anspruch [id, von] — den kannte der Waechter zu Hause schon.
    if (ga.wirktNicht) zl = 'DEIN EINTRAG ' + id + ': du siehst deine Fassung wirksam, fuer die anderen wirkt ' + (mv && mv.e.art === 'lage' ? 'sie' : 'er') + ' NICHT' + (ga.quelle ? ' (es gilt die gesicherte {' + nameSicher(ga.quelle, 60) + '})' : '') + ' — ' + knapp(ga.grund, 240) + '. Wieder in Kraft: neu schreiben (neue id)' + (mv && mv.e.art === 'lage' ? '' : ' — oder ueber main (PR)');
    // Nachpruefung 5d (leser): die eigene Fassung wirkt nicht mehr (abgelaufen, fertig), fuer die anderen gilt die gesicherte — eine Zeile
    // nur, solange DIE noch wirkt, ohne Rat zum Neuschreiben.
    else if (ga.eigenWirktNicht) { if (!ga.andereWirkt) continue; zl += 'die gesicherte {' + nameSicher(ga.quelle, 60) + '}, und sie wirkt noch — ' + knapp(ga.grund, 240) + '. Deine Fassung wirkt nicht mehr; soll auch die gesicherte nicht mehr gelten: mit einem Grabstein auf main zurueckziehen'; }
    else if (passt && !ga.quelle && kopien.length) zl += 'keine — strittig: eine Kopie mit anderem `von` (' + kopieVons.slice(0, 3).map(v => A.fremd(v, 60)).join(', ') + ') liegt auf ' + (kopieRefs.length ? kopieRefs.slice(0, 3).map(q => nameSicher(q, 60)).join(', ') + (kopieRefs.length > 3 ? ' … +' + (kopieRefs.length - 3) : '') : 'einem Branch, den git hier kennt') + ', und keine Fassung liegt auf main oder in der Sicherung. Dein `von` passt zu deinem Branch — nichts umschreiben (eine neue id koennte gleich wieder kopiert werden). Auf main gilt deine Fassung (PR); die Kopie melden: neu befund … (beide Fassungen: zeige ' + id + ')';
    else if (passt && !ga.quelle) zl += 'keine — ' + knapp(ga.grund, 200) + ' — nichts umschreiben' + (/Teilabruf/.test(String(ga.grund)) ? '; holen und nachladen: node scripts/austausch.mjs holen' : '') + ' (zeige ' + id + ')';
    // Gegenpruefung 5, Skeptiker (R5b-fassungen-2, D2): der Grund kommt auch MIT Quelle — vorher stand bei einem NEU ANGELEGTEN
    // Branch nur „{origin/zz-sicherung} … nach einem Umzug … schreib ihn neu", und der Schreiber erfuhr nicht, warum seine
    // Berichtigung nicht zaehlt. Dort wirkt die gesicherte Fassung weiter; eine Berichtigung geht ueber main oder eine neue id.
    else if (ga.quelle && ga.neuAngelegt) zl += 'die gesicherte {' + nameSicher(ga.quelle, 60) + '} — ' + knapp(ga.grund, 240) + '. Deine Berichtigung auf ' + nameSicher(ga.neuAngelegt, 60) + ' zaehlt fuer die anderen nicht (der Branch verschwand und kam wieder — ob du ihn neu angelegt hast, sieht niemand). Berichtigen: ueber main (PR) — oder neu schreiben (neue id) und den alten mit einem Grabstein auf main zurueckziehen';
    else zl += (ga.quelle ? 'eine andere {' + nameSicher(ga.quelle, 60) + '}' + (ga.grund ? ' (' + knapp(ga.grund, 200) + ')' : '') : 'keine — strittig: ' + knapp(ga.grund, 200)) + ' — `von` und Branch muessen zusammenpassen; nach einem Umzug oder mit anderem `von` schreib ihn neu (neue id) und zieh den alten zurueck';
    befehle.add(zl); z.push(zl);
  }
  // Wer mithilft (nehme --auch: das Feld `mithelfen`, nicht der Titel), weiss, dass ein anderer zuerst war.
  for (const [ziel, u] of sw.uebernahme) if (u.auch.some(l => meins(l.e) && l.e.mithelfen !== true)) z.push('Deine Uebernahme von ' + ziel + ' gilt nicht: ' + u.lage.e.von + ' war zuerst (bis ' + uhr(u.lage.bis) + ')');
  // Dein Halt wurde aufgehoben — mit Grund, und du erfaehrst ihn hier (vorher verschwand er still).
  for (const a of sw.aufgehoben) if (meins(a.e) && !meins(a.durch) && Date.parse(a.e.bis) > Date.now()) z.push('AUFGEHOBEN dein Halt ' + a.e.id + ' durch ' + a.durch.id + ' {' + nameSicher(a.durch._quelle) + '} von ' + a.durch.von + ': ' + knapp(a.durch.text, 120));
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
    z.push('ANTWORT ' + x.id + ' {' + nameSicher(x._quelle) + '} von ' + x.von + ' auf deine' + (wort[auf.art] || 'n Eintrag ') + auf.id + ': ' + knapp(x.text || x.titel, 90));
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
  an.slice(0, o.alles ? 1e9 : 6).forEach(e => { const h = e.art === 'halt' && sw.halts.find(x => x.e === e); z.push('AN DICH ' + e.id + ' {' + nameSicher(e._quelle) + '} von ' + e.von + ': ' + (h ? (h.veto ? 'VETO gegen ' + h.veto : 'HALT') + ' bis ' + uhr(h.bis) + ' — ' : '') + knapp(e.titel, 100)); });
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
    //
    // Gegenpruefung 4 (R4-schwarm-4): „inhaltsgleich" hiess „jede Datei des Branches ist auf main genau so" — nach
    // einem Rebase- oder Squash-Merge aenderte die naechste Sitzung STATUS.md auf main, und aus der Frage wurde
    // „!! … fehlt … Neu pushen", der Rat, der einen gemergten Branch wiederbelebt. Jetzt nach dem Inhalt der
    // COMMITS: (1) jeder eigene Commit steht mit gleicher patch-id auf main (`git cherry`: Rebase-Merge), (2) der
    // Endstand wie bisher, (3) die ganze Aenderung seit der Abzweigung ist EIN Commit auf main (dieselben Hunks,
    // Zeilennummern egal: Squash-Merge) — (1) und (3) halten auch, wenn main die Dateien danach weiter aendert.
    // Sicher NICHT gemergt ist er nur, wenn eine Datei, die er aenderte, auf main seit der Abzweigung KEIN Commit
    // beruehrt hat — dann der Alarm mit Push-Befehl. Dazwischen (main hat dieselben Dateien selbst geaendert,
    // keine der drei Proben greift) ist es eine Frage: ohne „!!" und ohne Push-Befehl. Gelesen wird ohne
    // Nachladen (GIT_NO_LAZY_FETCH): im Teilabruf scheitert eine Probe lieber, als dass `lesen` Netz braucht.
    //
    // Gegenpruefung 5: (a) Geprueft und „Dein Branch" genannt wird nur der EIGENE Name — der Upstream heisst wie der lokale
    // Branch. Ein Upstream unter anderem Namen (ein fremder aus `checkout -b x origin/<fremd>`, oder ein alter eigener nach
    // `git branch -m`, dessen Eigentum mit dem geloeschten Ref samt Reflog nicht mehr belegbar ist) bekommt nie einen
    // Push-Befehl auf seinen Namen — der Rat legte einen geloeschten FREMDEN Branch mit eigener Arbeit wieder an, und die
    // Lagen darauf wirkten nicht (R5-schwarm-3, R5-werkzeug-3). Liegt die eigene Arbeit unter dem eigenen Namen auf origin,
    // ist nichts zu sagen. (b) Ein squash-gemergter PRAEFIX der eigenen Kette (danach lokal weitergearbeitet, etwa ein
    // `lage --phase fertig`) heisst nicht mehr „!! … deine gepushten Commits … Neu pushen" — gepusht ist nach dem Loeschen
    // nicht mehr belegbar, und der Rat belebte den gemergten Branch (R5-werkzeug-2): die Zeile nennt die Commits danach
    // und raet zu einem NEUEN Branch von origin/main. (c) Scheitert `git cherry` (Teilabruf: die Inhalte fehlen), ist das
    // „nicht pruefbar", nicht „keine Commits ohne Gegenstueck" — vorher hoerte ein nie gemergter Branch „Gemergt? Dann ist
    // nichts verloren" (R5-werkzeug-5). (d) Ein Binaerdiff ist erst gleich, wenn derselbe Zielinhalt entsteht: ohne die
    // index-Zeile blieb von zwei verschiedenen Bildern nur „Binary files … differ" (R5-werkzeug-6).
    const up = zweig.upstreamName, eigenerName = !!up && up === zweig.name;
    const unterEigenemNamen = () => !!zweig.name && A.git(WURZEL, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + zweig.name]) != null && A.git(WURZEL, ['merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/' + zweig.name]) != null;
    if (up && up !== 'main' && up !== 'master' && A.git(WURZEL, ['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/' + up]) == null && (eigenerName || !unterEigenemNamen())) {
      const M = 'refs/remotes/origin/main', mainDa = A.git(WURZEL, ['rev-parse', '--verify', '--quiet', M]) != null;
      const gemergt = mainDa && A.git(WURZEL, ['merge-base', '--is-ancestor', 'HEAD', M]) != null;
      const aufMain = () => {
        if (!mainDa) return { grund: 'origin/main ist hier nicht bekannt — node scripts/austausch.mjs holen' };
        const mb = (A.git(WURZEL, ['merge-base', 'HEAD', M]) || '').trim();
        if (!/^[0-9a-f]{40,64}$/.test(mb)) return { grund: 'keine gemeinsame Geschichte mit origin/main' };
        const namen = (args) => { const t = A.git(WURZEL, args); return t == null ? null : t.split('\0').filter(Boolean); };
        const meine = namen(['diff', '--name-only', '-z', '--no-renames', mb, 'HEAD']);
        if (!meine) return { grund: 'die eigenen Aenderungen liessen sich nicht lesen' };
        const ch = A.git(WURZEL, ['cherry', M, 'HEAD']), chz = ch == null ? null : ch.split('\n').filter(Boolean);
        if (chz && chz.length && chz.every(l => l[0] === '-')) return { wie: 'jeder seiner Commits steht inhaltsgleich auf main (per Rebase oder squash-gemergt?)' };
        const anders = namen(['diff', '--name-only', '-z', '--no-renames', M, 'HEAD']);
        if (anders && !meine.some(n => anders.indexOf(n) >= 0)) return { wie: 'was er geaendert hat, steht inhaltsgleich auf main (squash-gemergt?)' };
        if (meine.length && meine.length <= 200) {
          const opt = ['--no-color', '--no-ext-diff', '--no-textconv', '--no-renames', '--full-index'];
          // Je Datei: ein Textdiff ohne index-Zeile (main kann die Datei vorher anders gehabt haben), ein Binaerdiff MIT der
          // Kennung des Zielinhalts — sonst sind zwei verschiedene Binaeraenderungen gleich.
          const norm = (t) => t.split(/^(?=diff --git )/m).map(ab => {
            const bin = /^(Binary files |GIT binary patch)/m.test(ab);
            return ab.split('\n').map(l => { const ix = l.match(/^index [0-9a-f]+\.\.([0-9a-f]+)/); return ix ? (bin ? 'index ' + ix[1] : null) : (/^@@ /.test(l) ? '@@' : l); }).filter(l => l != null).join('\n');
          }).join('\n').trim();
          const mein = A.git(WURZEL, ['--literal-pathspecs', 'diff'].concat(opt, [mb, 'HEAD', '--'], meine));
          // Je Commit auf main auch seine Zeiten (Committer, Autor) — fuer die Praefix-Probe unten.
          const log = mein && mein.trim() ? A.git(WURZEL, ['--literal-pathspecs', 'log', '-p', '--format=%x00%ct %at%x01'].concat(opt, [mb + '..' + M, '--'], meine)) : null;
          if (log != null) {
            const aufM = new Map();   // norm(diff) → [{ ct, at }] der Commits auf main mit genau diesen Hunks
            for (const st of log.split('\0')) {
              const k = st.indexOf('\x01'), zeit = (k < 0 ? '' : st.slice(0, k)).trim().split(' ').map(Number), dn = norm(k < 0 ? st : st.slice(k + 1));
              if (!dn) continue;
              if (!aufM.has(dn)) aufM.set(dn, []);
              aufM.get(dn).push({ ct: zeit[0], at: zeit[1] });
            }
            if (aufM.has(norm(mein))) return { wie: 'seine ganze Aenderung steht als ein Commit auf main (squash-gemergt?)' };
            // Ein PRAEFIX der eigenen Kette als ein Commit auf main (der laengste zuerst): squash-gemergt, danach weitergearbeitet.
            // Gegenpruefung 5b, Skeptiker (R5b-identitaet-2): der Treffer muss NACH dem Praefix auf main entstanden sein — sonst ist
            // der Praefix eine KOPIE von main (ein `cherry-pick` von main als erster Commit eines nie gemergten Branches), und die
            // Zeile sagte „er ist gemergt", ohne „!!", obwohl die eigene Arbeit nirgends auf origin liegt. Ein Squash oder Rebase-Merge
            // entsteht nach dem Praefix (Committer-Zeit auf main ≥ der des Praefix); und schreibt die Sitzung ihren Praefix danach um
            // (rebase, amend: neue Committer-Zeit), bleibt seine Autor-Zeit die alte — vor dem Squash. Ein cherry-pick von main
            // traegt beide Male die Zeiten des ORIGINALS: Committer-Zeit davor, Autor-Zeit gleich. Die Probe „nie beruehrt" lief
            // vorher erst danach und kam in diesem Fall nie an; VOR die Praefix-Schleife gestellt, sagte sie nach jedem ehrlichen
            // Squash mit lokalem Weiterarbeiten wieder „!! … Neu pushen" (gemessen: C30 T13 rot — R5-werkzeug-2 kehrte zurueck).
            const kette = (A.git(WURZEL, ['log', '--first-parent', '--reverse', '--format=%H %ct %at', mb + '..HEAD']) || '').split('\n').filter(Boolean).map(z => { const [h, ct, at] = z.split(' '); return { h, ct: Number(ct), at: Number(at) }; });
            if (kette.length > 1 && kette.length <= 50) for (let i = kette.length - 2; i >= 0; i--) {
              const d = A.git(WURZEL, ['--literal-pathspecs', 'diff'].concat(opt, [mb, kette[i].h, '--'], meine));
              const treffer = d && d.trim() ? aufM.get(norm(d)) : null;
              if (treffer && treffer.some(x => x.ct >= kette[i].ct || x.at > kette[i].at)) {
                const neu = (A.git(WURZEL, ['log', '--first-parent', '--reverse', '--format=%s', kette[i].h + '..HEAD']) || '').split('\n').filter(Boolean);
                return { praefix: kette[i].h, neu };
              }
            }
          }
        }
        const beruehrt = namen(['log', '--no-renames', '--name-only', '-z', '--format=', mb + '..' + M]);
        if (beruehrt) { const fehlt = meine.filter(n => beruehrt.indexOf(n) < 0); if (fehlt.length) return { nein: fehlt }; }
        // Welche eigenen Commits haben KEIN Gegenstueck auf main (`git cherry`: „+")? Die Frage nennt sie — vorher hiess es bei
        // einem nie oder nur teilweise gemergten Branch „Gemergt? Dann ist nichts verloren" (Gegenpruefung 4, Skeptiker).
        const grund = 'main hat ' + (beruehrt ? meine.filter(n => beruehrt.indexOf(n) >= 0).slice(0, 3).map(n => knapp(n, 40)).join(', ') : 'dieselben Dateien') + ' seither selbst geaendert';
        const chv = A.git(WURZEL, ['cherry', '-v', M, 'HEAD']);
        // Scheitert cherry (Teilabruf: ohne Nachladen fehlen die Inhalte), heisst das „nicht pruefbar" — die eigenen Commits
        // nennt dann `git log` (braucht nur Commits, keine Inhalte).
        if (chv == null) return { grund, unpruefbar: true, ohne: (A.git(WURZEL, ['log', '--format=%s', M + '..HEAD']) || '').split('\n').filter(Boolean) };
        return { grund, ohne: chv.split('\n').filter(l => l[0] === '+').map(l => l.replace(/^\+ [0-9a-f]+ ?/, '')) };
      };
      let st = null;
      if (!gemergt) {
        const altNl = process.env.GIT_NO_LAZY_FETCH;
        process.env.GIT_NO_LAZY_FETCH = '1';
        try { st = aufMain(); } finally { if (altNl === undefined) delete process.env.GIT_NO_LAZY_FETCH; else process.env.GIT_NO_LAZY_FETCH = altNl; }
      }
      // Wer ist gemeint, und wohin ginge ein Push? Nur der EIGENE Name bekommt `HEAD:<name>`; sonst der lokale Branch.
      const wer = eigenerName ? 'Dein Branch ' + up : 'Dein Upstream ' + up + ' (' + ((zweig.umbenanntAus || []).indexOf(up) >= 0 ? 'ein frueherer Name dieses Branches' : 'ein anderer Branch als dieser') + ')';
      const pushZiel = eigenerName ? 'git push -u origin HEAD:' + up : 'git push -u origin HEAD';
      const liste = (xs) => xs.slice(0, 3).map(x => '„' + knapp(x, 60) + '"').join(', ') + (xs.length > 3 ? ' … +' + (xs.length - 3) : '');
      // Eine Zeile mit Befehl wird nie gekuerzt (die Dateinamen stehen davor).
      const mitBefehl = (zl) => { befehle.add(zl); z.push(zl); };
      if (st && st.wie) mitBefehl(wer + ' ist auf origin nicht mehr da — ' + st.wie + '. Dann ist nichts verloren; sonst neu pushen: ' + pushZiel);
      else if (st && st.praefix) mitBefehl(wer + ' ist auf origin nicht mehr da — seine Commits bis ' + st.praefix.slice(0, 12) + ' stehen als ein Commit auf main (squash-gemergt?); danach neu, nicht auf main: ' + st.neu.length + ' Commit(s) ' + liste(st.neu) + '. Nicht unter dem alten Namen pushen (er ist gemergt) — einen neuen Branch von origin/main nehmen: git switch -c <neuer-name> origin/main && git cherry-pick ' + st.praefix + '..' + (A.git(WURZEL, ['rev-parse', 'HEAD']) || '').trim());
      else if (st && st.nein) mitBefehl('!! ' + wer + ' fehlt auf origin (geloescht?) — und deine Aenderungen stehen nicht auf main (dort seit der Abzweigung nie beruehrt: ' + st.nein.slice(0, 3).map(n => knapp(n, 60)).join(', ') + (st.nein.length > 3 ? ' … +' + (st.nein.length - 3) : '') + '). Neu pushen: ' + pushZiel);
      // Die Frage hat keinen Befehl, wird aber auch nicht gekuerzt: abgeschnitten verloere sie ihre Antwort.
      // Ohne Push-Befehl (wie die Frage darunter): ein squash-gemergter Branch, dessen Hunks main inzwischen anders hat,
      // landet auch hier — ein Befehl zum Neu-Pushen belebte ihn wieder (R4-schwarm-4).
      else if (st && st.unpruefbar) mitBefehl(wer + ' ist auf origin nicht mehr da — ob seine Aenderungen auf main stehen, ist hier NICHT pruefbar (' + st.grund + '; `git cherry` braucht die Inhalte, und die fehlen hier — Teilabruf?): ' + st.ohne.length + ' Commit(s) seit der Abzweigung, die main nicht enthaelt' + (st.ohne.length ? ': ' + liste(st.ohne) : '') + '. Erst mit den vollen Inhalten vergleichen (git fetch --refetch origin oder ein voller Klon), dann entscheiden.');
      else if (st && st.ohne && st.ohne.length) mitBefehl(wer + ' ist auf origin nicht mehr da — ob seine Aenderungen auf main stehen, laesst sich nicht sicher sagen (' + st.grund + '): ' + st.ohne.length + ' Commit(s) ohne Gegenstueck auf main: ' + liste(st.ohne) + '. Liegen sie dort anders (squash-gemergt mit Aenderungen)? Sonst erst mit origin/main vergleichen, dann neu pushen.');
      else if (st) mitBefehl(wer + ' ist auf origin nicht mehr da — ob seine Aenderungen auf main stehen, laesst sich nicht sicher sagen (' + st.grund + '). Gemergt? Dann ist nichts verloren; sonst erst mit origin/main vergleichen.');
    }
  }
  // Nicht gelesene Eintragsdateien (Teilabruf: Blob oder Baum nicht im lokalen Objektspeicher) — ein Halt, eine Lage oder
  // eine Uebernahme darin fehlt OBEN, ohne dass etwas fehlt aussieht (Gegenpruefung 4, R4-lesen-0: im Klon mit
  // --filter=blob:none hiess es „Das Brett ist leer"). Mit dem Befehl, der sie wirklich holt: `holen` laedt sie nach.
  // Ist das Nachladen in DIESEM Lauf eben gescheitert, hilft „holen" nicht noch einmal (Gegenpruefung 5, R5-werkzeug-4: `holen`
  // sagte erst „liessen sich NICHT nachladen" und dann „Holen und nachladen: … holen") — dann der Grund und der andere Weg.
  // Und fehlt die Grabstein-Liste von main (R5-lesen-4), steht es dabei: was dort zurueckgezogen ist, wirkt hier noch.
  { const fe = b.fehlend || [];
    if (fe.length) {
      const q = [...new Set(fe.map(x => String(x.quelle || '?')))], gs = fe.some(x => x.grabsteine), ln = letztesNachladen;
      const weg = ln && ln.teilabruf && !ln.ok ? 'Nachladen hat eben nicht geklappt (' + (NACHLADE_GRUND[ln.grund] || 'Abruf gescheitert oder Frist abgelaufen') + '). Mit Netz noch einmal: node scripts/austausch.mjs holen — scheitert es wieder: ' + OHNE_FILTER + ' (das ganze Repo)'
        : 'Holen und nachladen: node scripts/austausch.mjs holen';
      // Die Refs durch knapp() (Gegenpruefung 5b, R5b-lesen-3): die Zeile traegt einen Befehl und wird deshalb nie gekuerzt — ein
      // Branch-Name aus fremder Hand darf sie nicht beliebig verlaengern.
      const zl = '!! ' + fe.length + ' Eintragsdatei(en) NICHT gelesen (Teilabruf: nicht im lokalen Objektspeicher, auf ' + q.slice(0, 3).map(x => knapp(x, 60)).join(', ') + (q.length > 3 ? ' … +' + (q.length - 3) : '') + ')' + (gs ? ', darunter die Grabstein-Liste von main (was dort zurueckgezogen ist, steht hier noch da)' : '') + ' — ein Halt, eine Lage oder eine Uebernahme darin fehlt hier. ' + weg;
      befehle.add(zl); z.push(zl);
    } }
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
    for (const e of kritisch.slice(0, o.alles ? 1e9 : 6)) { const n = (abl.rueck.get(e.id) || []).filter(r => r.von.art === 'antwort').length; aus('    ' + e.id + '  ' + knapp(e.titel, 100) + '   [' + arbeitsMarke(e, sw, inArbeit) + (n ? ' · ' + n + ' Antwort(en)' : '') + ']' + (e._quelle !== 'Arbeitsbaum' ? '   {' + nameSicher(e._quelle) + '}' : '')); }
    if (!o.alles && kritisch.length > 6) aus('    … +' + (kritisch.length - 6) + ' weitere — `--alles`');
  }
  if (sw.lagen.length) {
    aus('\nLAGE (' + sw.lagen.length + ') — woran andere gerade arbeiten und bis wann (Selbstauskunft, an ihrem Branch geprueft)');
    // „(du)" fuer jeden eigenen Namen — auch den belegten alten nach `git branch -m` (Gegenpruefung 5: dort stand die eigene
    // Lage ohne Kennzeichen, waehrend der Deckel sie mitzaehlte).
    const ich0 = ichVon(), namen0 = ich0 ? meineNamen() : [];
    for (const l of sw.lagen.slice(0, o.alles ? 1e9 : 8)) aus('    ' + l.e.von + (namen0.indexOf(l.e.von) >= 0 ? ' (du)' : '') + '   ' + l.e.phase.replace('_', ' ') + (l.e.runde ? ' ' + l.e.runde : '') + ', bis ' + uhr(l.bis) + '   „' + knapp(l.e.titel, 80) + '"');
    if (!o.alles && sw.lagen.length > 8) aus('    … +' + (sw.lagen.length - 8) + ' weitere — `--alles`');
  }
  if (sw.halts.length) {
    aus('\nHALT UND VETO (' + sw.halts.length + ' wirksam) — eine Pflicht zur Kenntnisnahme, keine Sperre: lesen, dann warten, antworten oder mit Grund aufheben');
    // Die Geltung kommt aus fremder Hand (Gegenpruefung 5, Skeptiker, R5b-ausgabe-0: ein Pfad mit Zeilenumbruch schrieb hier einen
    // gefaelschten DICH-BETREFFEND-Block) — jeder Teil durch knapp, die Quelle durch A.fremd, auch wenn das Lesen sie schon prueft.
    for (const h of sw.halts.slice(0, o.alles ? 1e9 : 6)) aus('    ' + h.e.id + '  bis ' + uhr(h.bis) + '  ' + (h.veto ? 'VETO gegen ' + h.veto : 'Geltung: ' + (h.e.geltung || []).map(x => knapp(x, 80)).join(', ')) + ' — ' + knapp(h.e.titel, 80) + '   {' + nameSicher(h.e._quelle, 80) + '}' + (h.antworten.length ? '   [' + h.antworten.length + ' Antwort(en)]' : '') + ankunftSatz(h));
  }
  // Eine Lage, deren Ankunft hier nicht rechenbar ist, ist nicht „ungueltig" — sie wird nicht GERECHNET (E5): sie nimmt nichts, und
  // ihre Ziele sind fuer `nehme` „nicht entscheidbar". Vorher stand sie unter der Ueberschrift „ungueltig, Zeit in der Zukunft oder
  // „von" passt nicht zum Branch" (Gegenpruefung 5, Skeptiker, R5b-fassungen-6).
  const offenL = sw.unwirksam.filter(u => OFFEN_GRUND.test(String(u.grund))), ungueltig = sw.unwirksam.filter(u => offenL.indexOf(u) < 0);
  if (ungueltig.length) aus('  (' + ungueltig.length + ' Halt/Lage UNWIRKSAM — ungueltig, rueck- oder vordatiert, Zeit in der Zukunft oder „von" passt nicht zum Branch: ' + ungueltig.slice(0, 3).map(u => u.e.id + ' ' + knapp(u.grund, 60)).join(' · ') + ')');
  if (offenL.length) aus('  (' + offenL.length + ' Lage(n) NICHT GERECHNET — Ankunft hier nicht rechenbar: sie nehmen nichts, ihre Ziele sind fuer `nehme` „nicht entscheidbar": ' + offenL.slice(0, 3).map(u => u.e.id + ' (' + knapp(u.e._ankunftOffen || u.grund, 100) + ')').join(' · ') + ')');
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
    const g = b.gilt && b.gilt.get(id);
    if (g && zurueck.blobs && zurueck.blobs.has(g.blob)) continue;   // … auch je Fassung (Grabstein mit blob)
    // Eine abgelaufene Lage oder ein abgelaufener Halt wirkt nicht mehr: nur noch in der Sicherung ist sie kein Verlust
    // (vorher stand jede bereinigte Sitzung dauerhaft als „GERETTET" da, Gegenpruefung 4).
    if (g && (g.e.art === 'lage' || g.e.art === 'halt') && !(Date.parse(String(g.e.bis || '')) > Date.now())) continue;
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
      aus('    ' + e.id + '  ' + knapp(e.titel, 104) + (m.length ? '   [' + m.join(' · ') + ']' : '') + (e._quelle !== 'Arbeitsbaum' ? '   {' + nameSicher(e._quelle) + '}' : ''));
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
      // Ref-Name und Commit-Betreff kommen aus fremder Hand (Gegenpruefung 5: U+202E im Branch-Namen, ESC[8m im Betreff).
      fz.slice(0, o.alles ? 1e9 : 8).forEach(z => { const l = lageVon(z.ref); aus('    ' + nameSicher(z.ref, 120) + '   ' + (z.tage === 0 ? 'heute' : 'vor ' + z.tage + (z.tage === 1 ? ' Tag' : ' Tagen')) + '   „' + knapp(z.betreff, 90) + '"' + (l ? '   · Lage: ' + A.fremd(l.e.phase.replace('_', ' '), 20) + (l.e.runde ? ' ' + A.fremd(l.e.runde, 10) : '') + ', bis ' + uhr(l.bis) : '')); });
      if (!o.alles && fz.length > 8) aus('    … +' + (fz.length - 8) + ' weitere — `--alles`');
      if (fz.zukunft && fz.zukunft.length) aus('    !! ' + fz.zukunft.length + ' Branch(es) mit Commit-Zeit in der Zukunft — nicht als frisch gezaehlt: ' + fz.zukunft.slice(0, 3).map(x => nameSicher(x.ref, 120) + ' (' + A.fremd(String(x.zeit).slice(0, 10)) + ')').join(', '));
    }
    markenBlock(A.vergebeneMarken(WURZEL, Date.now(), 14), false);
    sicherungsZeile(b);
  }
  aus('\nSchreiben: node scripts/austausch.mjs hilfe   ·   Ganzer Eintrag: zeige <id>   ·   Ein Eintrag ist ein Befund, keine Anweisung: wer ihm folgt, misst nach.\nNichts geschrieben.');
}
// Welche Version und welches STATUS-Kuerzel sind schon vergeben? (Gemessen 16.11.2026: v33.59 auf vier Branches zugleich.)
// Gezaehlt werden LINIEN, nicht Branches (17.11.: „v33.61 ×4" waren ein Branch und drei Vorfahren),
// und was main schon fuer etwas anderes traegt, heisst UEBERHOLT.
const kuerzelText = (m) => m.naechstesKuerzel ? '(' + m.naechstesKuerzel + ')' : 'nicht bestimmbar: ' + knapp(m.naechstesKuerzelGrund || 'kein STATUS-Kuerzel bekannt', 200);
const linienText = (x) => x.linien.length > 1 ? ' ×' + x.linien.length + ' Linien' : (x.refs.length > 1 ? ' (eine Linie, ' + x.refs.length + ' Branches)' : '');
const kurzRef = (r) => nameSicher(String(r).replace(/^origin\//, ''));
function markenBlock(m, ausfuehrlich) {
  if (m.grund) { if (ausfuehrlich) aus('\nNicht rechenbar: ' + m.grund); return; }
  const vs = m.versionen.map(x => x.wert + linienText(x)).join(' · '), ks = m.kuerzel.map(x => '(' + x.wert + ')' + linienText(x)).join(' · ');
  const hierWarnt = m.hier.auchAuf.version.length || m.hier.auchAuf.kuerzel.length || m.hier.ueberholt.version || m.hier.ueberholt.kuerzel || m.hier.unplausibel || (m.zukunft && m.zukunft.length);
  if (!ausfuehrlich && !vs && !ks && !m.ueberholt.length && !hierWarnt) return;
  // Ein Kuerzel, das sich nicht bestimmen laesst, heisst so — mit Grund, nie „(null)" (Gegenpruefung 5, Skeptiker).
  aus('\nVERGEBEN auf frischen Branches, noch nicht auf main (' + m.basis.version + (m.basis.kuerzel ? ', (' + m.basis.kuerzel + ')' : ', kein STATUS-Kuerzel') + '): ' + (vs || 'keine Version') + '   ·   Kuerzel: ' + (ks || 'keines'));
  aus('  → naechste freie Version: ' + m.naechsteVersion + '   ·   naechstes freies STATUS-Kuerzel: ' + kuerzelText(m) + '   (wer zuerst auf main kommt, behaelt seine; die anderen nummerieren um)');
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
  if (m.hier.auchAuf.kuerzel.length) aus('  !! Dein STATUS-Eintrag heisst (' + m.hier.kuerzel + ') — auch vergeben auf ' + m.hier.auchAuf.kuerzel.map(kurzRef).join(', ') + ' (andere Linie). Frei waere ' + kuerzelText(m) + '.');
  if (m.hier.ueberholt.version) aus('  !! Dein Arbeitsbaum traegt eine Version, die main schon fuer „' + knapp(m.hier.ueberholt.version, 70) + '" fuehrt. Frei waere ' + m.naechsteVersion + '.');
  if (m.hier.version) aus('  (Dein Arbeitsbaum traegt schon ' + m.hier.version + ' — sie ist in „naechste freie" eingerechnet.)');
  if (m.hier.kuerzel) aus('  (Dein juengster STATUS-Eintrag heisst schon (' + m.hier.kuerzel + ') — fuer einen WEITEREN Eintrag ' + kuerzelText(m) + '.)');
  if (m.unplausibel && m.unplausibel.length) aus('  !! Nicht gezaehlt — mehr als ' + A.SPRUNG_MAX + ' Versionen ueber main (Tippfehler?): ' + m.unplausibel.map(u => kurzRef(u.ref) + ' ' + u.wert).join(', '));
  if (m.hier.unplausibel) aus('  !! Dein Arbeitsbaum traegt ' + m.hier.unplausibel + ' — mehr als ' + A.SPRUNG_MAX + ' Versionen ueber main (Tippfehler?), nicht gezaehlt. Frei waere ' + m.naechsteVersion + '.');
  if (m.zukunft && m.zukunft.length) aus('  !! ' + m.zukunft.length + ' Branch(es) mit Commit-Zeit in der Zukunft — ihre Nummern sind MITGEZAEHLT: ' + m.zukunft.slice(0, 4).map(x => kurzRef(x.ref) + ' (' + x.zeit.slice(0, 10) + ')').join(', '));
  if (m.hier.ueberholt.kuerzel) aus('  !! Dein juengster STATUS-Eintrag nutzt ein Kuerzel, das auf main schon „' + knapp(m.hier.ueberholt.kuerzel, 70) + '" heisst. Frei waere ' + kuerzelText(m) + '.');
  if (ausfuehrlich) {
    for (const x of m.versionen.concat(m.kuerzel)) for (const l of x.linien) if (l.titel) aus('    ' + (x.wert[0] === 'v' ? x.wert : '(' + x.wert + ')') + '  ' + l.refs.map(kurzRef).join(', ') + '   „' + knapp(l.titel, 90) + '"');
    for (const u of m.ueberholt) aus('    ' + kurzRef(u.ref) + '  ' + (u.art === 'kuerzel' ? '(' + u.wert + ')' : u.wert) + ' = „' + knapp(u.titel, 60) + '"  — auf main: „' + knapp(u.mainTitel, 60) + '"');
  }
}
function naechste() {
  // Erst holen (wie `nehme`): wer nur `git fetch origin main` faehrt, saehe einen fremden Bump-Halt nicht. Mit --nur-lokal
  // nicht (null): dann geht keine Anfrage hinaus, gelesen werden die Branches, die git lokal kennt.
  // Im Teilabruf fehlen danach sw.js, STATUS.md und index.html der frischen Branches (oder ihre Baeume): vorher hiess
  // es „Nicht rechenbar … (erst holen)", und `holen` aenderte daran nichts — ein Kreis (Gegenpruefung 4, R4-lesen-0).
  // Jetzt laedt `naechste` sie GEZIELT nach (erst die Baeume, dann die Dateien — hoechstens zwei Runden). Nicht mit
  // --nur-lokal: dort geht keine Anfrage hinaus. Innerhalb DERSELBEN Gesamtfrist wie das Holen (Gegenpruefung 5, R5-lesen-8:
  // vorher je Runde 120 s — gemessen 140 s statt der genannten 20 s gegen einen Remote, der nach dem ersten Abruf hing).
  // Gegenpruefung 5c (Skeptiker R5c-L1): die Nummern sind der Kern von `naechste` — sie kommen nach den Spitzen und VOR den
  // aelteren Fassungen (holenStill → vorAelteren). Vorher danach: gemessen mit 20 ehrlich berichtigten Halts und 0,8 s je Abruf
  // kamen die aelteren Fassungen gerade noch, fuer die Nummern blieb nichts — Exit 2 bei jedem Lauf.
  let m = null, nachMarken = null;
  const markenLaden = () => {
    m = A.vergebeneMarken(WURZEL, Date.now(), 14);
    for (let runde = 0; m.grund && m.nachladbar && m.nachladbar.length && runde < 2; runde++) {
      const no = { frist: holFrist(HOL_FRIST_STILL_MS), bis: stillBis };
      nachMarken = { versucht: m.nachladbar.length, ok: A.objekteNachladen(WURZEL, m.nachladbar, no) };
      if (!nachMarken.ok) { nachMarken.grund = no.ende === 'frist' ? 'frist' : 'fehler'; break; }
      m = A.vergebeneMarken(WURZEL, Date.now(), 14);
    }
  };
  const geholt = holenStill({ vorAelteren: markenLaden });
  // Kein Teilabruf auf origin (dann lief vorAelteren nicht) oder nicht geholt: die Nummern hier — nachgeladen nur nach dem Holen.
  if (!m) { if (geholt) markenLaden(); else m = A.vergebeneMarken(WURZEL, Date.now(), 14); }
  // Vor einem Bump laeuft `naechste` ohnehin — hier wirkt ein Halt mit Geltung bump. Ein Veto dagegen steht dabei.
  const b = brett(), sw = schwarmVon(b), ich0 = ichVon(), meins = meinsVon(b, ich0);
  const istBump = (e) => (e.geltung || []).map(A.geltungNorm).indexOf('bump') >= 0;
  const bumpHalt = sw.halts.filter(h => !h.veto && istBump(h.e) && !meins(h.e));
  const vetosGegen = (h) => (sw.vetos.get(h.e.id) || []);
  // NICHT RECHENBAR ist auch, was einen fremden Bump-Halt VERSTECKEN koennte (Gegenpruefung 5) — vorher endete `naechste`
  // dann mit 0: (a) ungelesene Eintragsdateien, die ein Halt sein koennen (Teilabruf, R5-werkzeug-4 — gemessen: Nachladen
  // gescheitert, `naechste --json` Exit 0, bumpHalt []); (b) ein STRITTIGER Halt, von dem eine fremde Fassung den Bump
  // betrifft oder eine Fassung nicht gelesen ist (R5-fassungen-0: eine Kopie mit anderem `von` legte einen Bump-Halt lahm).
  const ung = A.haltUngewiss(WURZEL, b, process.env);
  // (c) ein strittiger Halt NUR in der Sicherung (Skeptiker R5b-waechter-4, D7): Geltung nicht lesbar — vorher fiel er still weg.
  const strittigBump = ung.strittig.filter(s => s.ungelesen || s.nurSicherung || s.halts.some(e => !meins(e) && istBump(e)));
  const offen = [];
  if (ung.fehlend.length) { const q = [...new Set(ung.fehlend.map(x => String(x.quelle || '?')))]; offen.push(ung.fehlend.length + ' Eintragsdatei(en) bzw. Baeume nicht gelesen (Teilabruf: nicht im lokalen Objektspeicher, auf ' + q.slice(0, 3).map(x => knapp(x, 60)).join(', ') + (q.length > 3 ? ' … +' + (q.length - 3) : '') + ') — ein fremder Bump-Halt darin waere hier unsichtbar'); }
  for (const s of strittigBump) offen.push('strittiger Halt ' + s.id + ' {' + s.quellen.map(x => nameSicher(x, 60)).join(', ') + '}' + (s.grund ? ' — ' + knapp(s.grund, 200) : '') + (s.ungelesen ? ' (' + s.ungelesen + ' Fassung(en) nicht gelesen)' : '') + (s.nurSicherung ? ' (nur in der Sicherung: ' + s.nurSicherung + ' Fassung(en), die ein Halt mit laufender Frist sein koennen — Geltung nicht lesbar)' : ''));
  if (o.json) {
    aus(JSON.stringify(Object.assign({}, m, { holen: geholt, nachgeladen: { eintraege: stillNachgeladen, marken: nachMarken }, bumpHalt: bumpHalt.map(h => ({ id: h.e.id, von: h.e.von, quelle: h.e._quelle, bis: new Date(h.bis).toISOString(), text: h.e.text, vetos: vetosGegen(h).map(v => ({ id: v.e.id, von: v.e.von, text: v.e.text })) })),
      nichtRechenbar: offen, fehlend: ung.fehlend.map(x => ({ quelle: x.quelle, pfad: x.pfad, baum: !!x.baum })), strittig: strittigBump.map(s => ({ id: s.id, quellen: s.quellen, grund: s.grund, ungelesen: s.ungelesen, nurSicherung: s.nurSicherung || 0 })) }), null, 1));
    // Dieselben Exit-Codes wie im Text: 1 bei einem Bump-Halt (geht vor), 2 bei „Nicht rechenbar" — sonst liefe
    // `naechste --json || stop` mit einer leeren Version weiter (Gegenpruefung 3: es endete mit 0).
    if (bumpHalt.length) process.exitCode = 1;
    else if (m.grund || offen.length) process.exitCode = 2;
    return;
  }
  holenStillSagen(geholt);
  // Steht der Rat bei abgelaufener Frist schon in diesen Zeilen, wiederholt ihn der Hinweis unten nicht (Gegenpruefung 5c).
  let ratOben = false;
  { const s = nachladeSatz(stillNachgeladen, 'naechste'); if (s.indexOf('!!') >= 0) { aus(s.slice(s.indexOf('!!') - 1)); ratOben = s.indexOf(fristRat('naechste')) >= 0; } }
  if (!ich0) aus('\n(Wer du bist, ist nicht ablesbar — losgeloester HEAD: auch ein EIGENER Bump-Halt zaehlt hier als fremder. --von setzen.)');
  // Ein bekannter Bump-Halt geht vor (wie in --json): er gilt, auch wenn daneben etwas nicht rechenbar ist.
  if (bumpHalt.length) {
    if (!m.grund) markenBlock(m, true);
    if (m.grund || offen.length) aus('\n(Daneben nicht rechenbar: ' + [m.grund].concat(offen).filter(Boolean).map(x => knapp(x, 200)).join(' · ') + ')');
    bumpHalt.forEach(h => { aus('\n!! HALT fuer Bumps: ' + h.e.id + ' {' + nameSicher(h.e._quelle) + '} bis ' + uhr(h.bis) + ' — ' + knapp(h.e.text, 160)); vetosGegen(h).forEach(v => aus('   VETO dagegen: ' + v.e.id + ' von ' + v.e.von + ' bis ' + uhr(v.bis) + ' — ' + knapp(v.e.text, 120))); });
    ende(1, '\nJetzt keine neue Version. Lies den Halt (zeige <id>); er endet ' + uhr(Math.min(...bumpHalt.map(h => h.bis))) + ' von selbst oder wird mit Grund aufgehoben' + (bumpHalt.some(h => vetosGegen(h).length) ? ' — gegen einen steht ein Veto: klaeren, nicht uebergehen' : '') + '.\nNichts geschrieben.');
  }
  // Der Hinweis nennt einen Befehl, der WIRKLICH hilft (vorher „erst holen" — im Teilabruf ein Kreis; und nach einem
  // gescheiterten Nachladen nicht noch einmal derselbe Befehl, sondern der Grund und der andere Weg — R5-werkzeug-4).
  const grundN = (nachMarken && nachMarken.grund) || (stillNachgeladen && stillNachgeladen.grund);
  const weg = (nachladbar) => geholt == null ? '(ohne --nur-lokal holt `naechste` selbst und laedt fehlende Dateien gezielt nach: node scripts/austausch.mjs naechste)'
    : geholt === false ? '(Holen hat nicht geklappt — mit Netz noch einmal: node scripts/austausch.mjs naechste)'
    : !nachladbar ? '(erst `node scripts/austausch.mjs holen`)'
    : '(Nachladen' + (nachMarken ? ' von ' + nachMarken.versucht + ' Objekt(en)' : '') + ' hat nicht alles gebracht' + (grundN ? ' — ' + NACHLADE_GRUND[grundN] : '') + '. '
      // Gegenpruefung 5c (R5c-L1): an der FRIST gescheitert — zuerst `holen` (laengere Frist), erst danach das ganze Repo. Vorher
      // hiess es hier „noch einmal naechste" (dieselbe Frist: im Kreis) und dann sofort das ganze Repo.
      + (grundN === 'frist' ? (ratOben ? 'Was hilft, steht oben: erst `holen`, dann noch einmal `naechste`' : fristRat('naechste')) : 'Mit Netz noch einmal: node scripts/austausch.mjs naechste — scheitert es wieder: ' + OHNE_FILTER + ' (das ganze Repo)') + ')';
  // Gegenpruefung 5c, Skeptiker (R5d-Le4): fehlen Fassungen aus der SICHERUNG (gebraucht, weil ihr Verzeichnis hier nicht verwendbar ist
  // — A.eintraegeNachladen hat sie eben selbst nachzuladen versucht), sagt der Rat WARUM, und nie „noch einmal naechste": vorher lud sie
  // niemand nach, und genau dieser Rat war ein Kreis (Skeptiker u1). An der Frist zuerst `holen` (laedt sie mit, laengere Frist); sonst
  // das ganze Repo — dauerhaft hilft erst ein gueltiges Verzeichnis (der Grund sagt, woran es liegt, etwa an der Uhr des Waechters).
  const si = stillNachgeladen && stillNachgeladen.sicherung, grundE = stillNachgeladen && stillNachgeladen.grund;
  const sicherungWeg = () => '(Gebraucht werden die Fassungen in der Sicherung, weil ihr Verzeichnis hier nicht verwendbar ist — ' + knapp((si && si.grund) || b.verzeichnisGrund || ('Verzeichnis: ' + (b.verzeichnisStatus || 'nicht gelesen')), 240).replace(/([^.?!])$/, '$1.') + ' '
    + (grundE === 'frist' ? (ratOben ? 'Was hilft, steht oben: erst `holen`, dann noch einmal `naechste`' : fristRat('naechste'))
      : 'Der gezielte Abruf hat sie nicht gebracht' + (grundE ? ' (' + NACHLADE_GRUND[grundE] + ')' : '') + ' — was hilft: ' + OHNE_FILTER + ' (das ganze Repo)') + ')';
  if (m.grund) ende(2, 'Nicht rechenbar: ' + m.grund + '\n' + weg(!!(m.nachladbar && m.nachladbar.length)));
  if (offen.length) ende(2, offen.map(x => 'Nicht rechenbar: ' + x).join('\n') + '\n' + (ung.fehlend.length ? (geholt === true && ung.fehlend.some(x => x.sicherung) ? sicherungWeg() : weg(true)) : '(Welche Fassung gilt, entscheidet erst eine Fassung auf main (Merge), ein Grabstein fuer die GANZE id auf main oder der Ablauf ihrer Frist — ein Grabstein je Fassung entscheidet nichts — die Fassungen: ' + (strittigBump.slice(0, 2).flatMap(s => ((b.fassungen && b.fassungen.get(s.id)) || []).flatMap(v => [...v.pfade].filter(([q]) => q !== 'Arbeitsbaum').slice(0, 1).map(([q, p]) => 'git show ' + shWort(q + ':' + p)))).slice(0, 4).join(' · ') || 'nur unter ' + A.FASSUNGEN + '/<id>/ auf origin/' + A.SICHERUNG_ZWEIG + ' (git ls-tree -r origin/' + A.SICHERUNG_ZWEIG + ' -- ' + A.FASSUNGEN + '/)') + '. Bis dahin keine neue Version.)') + '\nNichts geschrieben.');
  markenBlock(m, true);
  aus('\nGerechnet aus main und den Branches, die git kennt (hoechstens 14 Tage alt' + (geholt ? ', eben geholt' : '') + ').\nNichts geschrieben.');
}

// Die Felder eines Eintrags, wie `zeige` sie druckt — jedes aus fremder Hand: eine Zeile durch A.fremd, ein mehrzeiliges
// Feld je Zeile (eingerueckt, damit kein Feld eine eigene Ueberschrift vortaeuscht). Gegenpruefung 5: ein Titel mit
// Zeilenumbruch druckte vorher eigene Zeilen, ein Feld mit ESC[8m blendete den Rest aus.
const EIN = (s) => A.fremd(s);
const MEHR = (s) => String(s).split('\n').map(l => A.fremd(l)).join('\n    ');
// Dasselbe mit eigener Tiefe (`klasse`, der FEHLERKLASSE?-Vorschlag): die Folgezeilen stehen unter dem Wert, nicht am Rand.
const zeilenweise = (s, tiefe) => String(s == null ? '' : s).split('\n').map(l => A.fremd(l)).join('\n' + ' '.repeat(tiefe));
const FELD_NAMEN = { text: 'Text', beleg: 'Beleg', vorschlag: 'Vorschlag', nutzen: 'Nutzen', pruefbar: 'Pruefbar', an: 'An', haengt_daran: 'Haengt daran', regel: 'Regel', instanzen: 'Instanzen',
  suchmuster: 'Suchmuster (Geschwister)', gesucht: 'Gesucht', ohne_waechter: 'Ohne Waechter', ergebnis: 'Ergebnis', wohin: 'Wohin', geschwister: 'Geschwister', bewacht: 'Bewacht von', details_bei: 'Einzelheiten bei', stichworte: 'Stichworte',
  dringlichkeit: 'Dringlichkeit', phase: 'Phase', runde: 'Runde', bis: 'Frist bis (UTC)', geltung: 'Geltung' };
function felderDrucken(e) {
  aus('  ' + EIN(e.titel) + '\n  von ' + EIN(e.von) + ' · ' + EIN(e.datum) + (e.zeit ? ' ' + EIN(e.zeit) + ' UTC' : '') + (e.stand ? ' · Stand ' + EIN(e.stand) : ''));
  for (const k of Object.keys(FELD_NAMEN)) {
    const v = e[k]; if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) { aus('  ' + FELD_NAMEN[k] + ':'); v.forEach(x => aus('    - ' + MEHR(x))); } else aus('  ' + FELD_NAMEN[k] + ': ' + MEHR(v));
  }
  A.alsListe(e.waechter).forEach(w => aus('  Waechter: ' + EIN(w && w.datei) + ' · „' + EIN(w && w.fall) + '"'));
}
function ganz(e, abl, sw) {
  const z = abl.zustand.get(e.id);
  aus('\n' + EIN(String((A.ARTEN[e.art] || { wort: e.art + ' (unbekannte Art)' }).wort).toUpperCase()) + '  ' + e.id + '   ' + z.z + (z.durch ? ' durch ' + z.durch.id : '') + '   {' + nameSicher(e._quelle || 'Arbeitsbaum') + '}');
  felderDrucken(e);
  A.alsListe(e.geliefert).forEach(g => aus('  Geliefert: ' + g.pfad + ' @ ' + g.commit + '   → ' + zeigeBefehl(g)));
  // Durch knapp (Gegenpruefung 5, Skeptiker, R5b-ausgabe-1): der Grund traegt Werte aus fremder Hand (eine Geltung, einen Ref-Namen).
  if (e.art === 'halt' || e.art === 'lage') aus('  Wirkt jetzt: ' + knapp(wirktJetzt(e, sw), 800));
  if (e.sicherheit) aus('  Sicherheit: ja — Einzelheiten stehen bewusst nicht hier (public Repo)');
  const hier = !e._quelle || e._quelle === 'Arbeitsbaum';
  for (const x of A.ankerWirksam(e, abl.rueck)) { const t = A.messtext(x.datei, liesRel(x.datei)); aus('  Anker: ' + EIN(x.datei) + ' :: ' + EIN(x.text) + (hier ? (t == null ? '   ← DATEI FEHLT' : (t.indexOf(x.text) < 0 ? '   ← STEHT NICHT MEHR DA' : '')) : '')); }
  for (const x of A.zaehleWirksam(e, abl.rueck)) { const h = A.wieOft(A.messtext(x.datei, liesRel(x.datei)), x.text); aus('  Zaehlung: ' + EIN(x.datei) + ' :: ' + EIN(x.text) + '  → beim Eintrag ' + x.n + (hier ? ', heute ' + (h == null ? 'nicht lesbar' : h) + (h !== x.n ? '   ← BEWEGT' : '') : '')); }
  for (const bz of A.alsListe(e.bezug)) { const ziel = abl.proId.get(bz.id); aus('  → ' + EIN(bz.art) + ' ' + EIN(bz.id) + (ziel ? '  ' + knapp(ziel.titel, 90) : (bz.ref ? '  (liegt auf ' + nameSicher(bz.ref) + ' — von hier aus nicht zu sehen: `holen`)' : '  (fehlt)')) + (ziel && bz.ref && ziel._quelle !== 'Arbeitsbaum' ? '   {' + nameSicher(ziel._quelle) + '}' : '')); }   // R5d-A2: Quelle streng (vorher EIN)
  for (const r of (abl.rueck.get(e.id) || [])) aus('  ← ' + r.art + ' von ' + r.von.id + '  ' + knapp(r.von.titel, 90) + '  [' + EIN(r.von.von) + ']');
}
// Eine STRITTIGE id (Gegenpruefung 5): keine Fassung gilt — `zeige` nennt den Grund und jede Fassung mit ihrer Quelle und
// ihrem `von`, damit man sieht, wer was abgelegt hat (vorher: „Kein Eintrag").
function strittigZeigen(b, x) {
  const l = (b.fassungen && b.fassungen.get(x.id)) || [];
  aus('\nSTRITTIG  ' + x.id + '   keine Fassung gilt — fuer niemanden gerechnet: ' + knapp(x._strittig.grund || 'verschiedene Fassungen, keine laesst sich zuordnen', 240));
  aus('  ' + l.length + ' Fassung(en) — auf main gilt die Fassung, die dort liegt; sonst die des Schreibers (sein `von`, sein Branch) oder die gesicherte:');
  l.forEach((v, i) => {
    aus('\n  FASSUNG ' + (i + 1) + '/' + l.length + '  ' + EIN(String((A.ARTEN[v.e.art] || { wort: v.e.art }).wort).toUpperCase()) + '   Blob ' + String(v.blob).slice(0, 12) + '   {' + [...v.quellen].map(q => nameSicher(q)).join(', ') + '}');
    felderDrucken(v.e);
  });
}
// Wirkt ein Halt oder eine Lage JETZT? Dieselbe Rechnung wie die Bloecke (schwarm), nicht nur die Frist:
// vorher sagte `zeige` „ja" fuer einen aufgehobenen Halt und eine Lage, die das Brett UNWIRKSAM nennt.
function wirktJetzt(e, sw) {
  const a = sw.aufgehoben.find(x => x.e === e); if (a) return 'nein — aufgehoben durch ' + a.durch.id + ' (' + a.durch.von + '): ' + knapp(a.durch.text, 120);
  // Ein Deckel trifft einzelne ZIELE, nicht die ganze Lage: nimmt sie zwei ihrer drei Ziele wirksam, sagt
  // `zeige` „teilweise" (vorher „nein" — Gegenpruefung 3).
  const u = sw.unwirksam.find(x => x.e === e); if (u && !u.teil) return 'nein — ' + u.grund;
  const h = sw.halts.find(x => x.e === e); if (h) return 'ja, bis ' + uhr(h.bis) + (sw.vetos.get(e.id) ? ' · ' + sw.vetos.get(e.id).length + ' Veto(s) dagegen' : '') + ankunftSatz(h);
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
// Gegenpruefung 5, Skeptiker (R5b-fassungen-2, D2): `zeige` nennt fuer den EIGENEN Eintrag, was fuer die anderen gilt — mit Grund, auch
// wenn eine Quelle feststeht (vorher stand dort nur „Wirkt jetzt: ja", waehrend die anderen die gesicherte Fassung lasen).
function andereZeigen(b, e) {
  const ga = b.giltAndere && b.giltAndere.get(e.id); if (!ga) return;
  // R5c-Le3 (F4): dieselbe (oder die gesicherte) Fassung gilt fuer die anderen, wirkt aber nicht — das steht direkt unter „Wirkt jetzt".
  if (ga.wirktNicht) { aus('  Fuer die anderen wirkt ' + (e.art === 'lage' ? 'sie' : 'er') + ' NICHT' + (ga.quelle ? ' (es gilt die gesicherte {' + nameSicher(ga.quelle) + '})' : '') + ' — ' + knapp(ga.grund, 240) + (e.art === 'lage' ? ' (wieder in Kraft: neue id)' : ' (wieder in Kraft: neue id oder ueber main)')); return; }
  if (ga.eigenWirktNicht) { aus('  Fuer die anderen gilt: die gesicherte Fassung {' + nameSicher(ga.quelle) + '}' + (ga.andereWirkt ? ', und sie wirkt noch' : ', auch sie wirkt nicht mehr') + ' — ' + knapp(ga.grund, 240)); return; }
  aus('  Fuer die anderen gilt: ' + (ga.quelle ? 'eine andere Fassung {' + nameSicher(ga.quelle) + '}' : 'keine (strittig)') + (ga.grund ? ' — ' + knapp(ga.grund, 240) : '') + (ga.neuAngelegt ? ' (deine Berichtigung zaehlt dort nicht — berichtigen ueber main oder mit neuer id)' : ''));
}
function zeige() { const b = brett(), abl = A.ableiten(b.eintraege), sw = schwarmVon(b); if (!o._.length) ende(2, 'Gebrauch: node scripts/austausch.mjs zeige <id>'); for (const k of o._) { const x = finde(b, k, { strittig: true }); if (x._strittig) strittigZeigen(b, x); else { ganz(x, abl, sw); andereZeigen(b, x); } } aus('\nNichts geschrieben.'); }
function suche() {
  const w = o._.join(' ').toLowerCase(); if (!w) ende(2, 'Gebrauch: node scripts/austausch.mjs suche <wort>');
  const b = brett(), abl = A.ableiten(b.eintraege), t = b.eintraege.filter(e => A.textVon(e).toLowerCase().indexOf(w) >= 0);
  // Auch die STRITTIGEN (Gegenpruefung 5: „0 von 92" fuer ein Wort, das in der strittigen id stand) — mit „!" markiert.
  const st = (b.strittig || []).map(x => ({ x, l: ((b.fassungen && b.fassungen.get(x.id)) || []).filter(v => A.textVon(v.e).toLowerCase().indexOf(w) >= 0) })).filter(y => y.l.length);
  aus('\n„' + A.fremd(w, 80) + '": ' + t.length + ' von ' + b.eintraege.length + ' Eintraegen' + (st.length ? ' (+' + st.length + ' strittig)' : '') + '   (× geschlossen/ersetzt · ✓ beantwortet · · Antwort/Abschluss' + (st.length ? ' · ! strittig' : '') + ')');
  t.forEach(e => aus('  ' + zeichen[abl.zustand.get(e.id).z] + ' ' + e.id + '  (' + EIN(e.art) + ')  ' + knapp(e.titel, 100)));
  st.forEach(({ x, l }) => aus('  ! ' + x.id + '  (strittig, ' + l.length + ' von ' + (b.fassungen.get(x.id) || []).length + ' Fassungen: zeige ' + x.id + ')  ' + knapp(l[0].e.titel, 100)));
  aus('\nNichts geschrieben.');
}
function klasse() {
  const w = o._.join(' ').toLowerCase(), b = brett(), abl = A.ableiten(b.eintraege);
  const kl = b.eintraege.filter(e => e.art === 'klasse' && abl.zustand.get(e.id).z === 'offen' && (!w || A.textVon(e).toLowerCase().indexOf(w) >= 0));
  aus('\nFehlerklassen' + (w ? ' zu „' + A.fremd(w, 80) + '"' : '') + ': ' + kl.length);
  // Ohne Suchwort die kurze Liste; mit Suchwort (oder --alles) die ganze Karte. Jedes Feld kommt aus fremder Hand (Gegenpruefung 5,
  // Skeptiker, R5b-ausgabe-2: titel, regel und suchmuster einer fremden Klasse schrieben je einen gefaelschten DICH-BETREFFEND-Block):
  // was eine Zeile ist, durch knapp; was mehrzeilig sein darf (regel, suchmuster, ohne_waechter, gesucht), Zeile fuer Zeile durch
  // A.fremd und unter seinem Feld eingerueckt — keine Zeile beginnt am Rand und taeuscht eine Ueberschrift vor.
  for (const e of kl) {
    const k = A.klasseWirksam(e, abl.rueck);
    if (!w && !o.alles) { aus('  ' + e.id + '  ' + knapp(e.titel, 84) + '   [' + k.instanzen.length + ' Instanzen' + (k.waechter.length ? '' : ' · ohne Waechter') + (k.gesucht.length ? '' : ' · nie gesucht') + ']'); continue; }
    aus('\n  ' + e.id + '  ' + knapp(e.titel, A.TITEL_MAX) + '\n    Regel:      ' + zeilenweise(k.regel, 16));
    if (e.text) aus('    Erkennen:   ' + knapp(e.text, 400));
    aus('    Instanzen:  ' + k.instanzen.length + (k.befunde.length ? ' + ' + k.befunde.length + ' auf dem Brett (' + k.befunde.map(x => x.id).join(', ') + ')' : '') + ' — ' + knapp(k.instanzen.join(' | '), o.alles ? 1e5 : 260));
    aus('    Geschwister suchen: ' + (k.suchmuster ? zeilenweise(k.suchmuster, 24) : '(noch kein Suchmuster — wer eines findet: antworte ' + e.id.slice(-4) + ' --suchmuster "…")'));
    aus('    Waechter:   ' + (k.waechter.length ? k.waechter.map(x => knapp(String(x.datei).replace(/^scripts\//, ''), 120) + ' „' + knapp(x.fall, 70) + '"').join(' · ') : 'KEINER — ' + zeilenweise(k.ohne_waechter, 16)));
    aus('    Gesucht:    ' + (k.gesucht.length ? k.gesucht.map(x => zeilenweise(x, 16)).join(' · ') : 'nie systematisch — „eine Fehlerklasse ist erst geschlossen, wenn man sie GESUCHT hat"'));
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
  if (!absicht) vonHinweis(von);
  const r = A.einspielen(WURZEL, [e], { von, absichtVon: absicht ? [von] : null, datum: e.datum, alleRefs: true });
  if (!r.ok) { aus('\nNICHT geschrieben — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.forEach(f => aus('  !! ' + f.grund)); ende(1, '\nFelder und ein Beispiel: node scripts/austausch.mjs hilfe ' + e.art); }
  const g = r.geschrieben[0];
  aus('\nGeschrieben: ' + g.datei + '\n  ' + g.id + '  ' + g.titel);
  // Gegenpruefung 5c, Skeptiker (R5d-A2): der Branch ist ein NAME — streng wie in einspielen (vorher hier roh: claude/grü<ZWJ>n sah aus wie claude/grün).
  r.auswaerts.forEach(m => aus('Bezug ueber die Branch-Grenze: ' + m.id + ' liegt nur auf ' + nameSicher(m.quelle) + ' — der Bezug nennt den Branch (ref); der Eintrag selbst bleibt dort und kommt mit dessen Merge oder mit `ernten`.  ' + knapp(m.titel, 70)));
  // Lesen ist ins Schreiben eingebaut: was wissen ANDERE an denselben Stichworten?
  const b2 = brett(), neuE = b2.eintraege.find(x => x.id === g.id);
  if (neuE) {
    const nb = A.nachbarn(neuE, b2.eintraege), offenN = nb.filter(x => !x.irrweg), irr = nb.filter(x => x.irrweg);
    if (offenN.length) { aus('\nNACHBARN — offene Eintraege anderer an denselben Stichworten. Gemeinsame Ursache? Dann `antworte <id>` oder ein Eintrag mit --bezug baut_auf:<id> auf beide:'); offenN.slice(0, 6).forEach(x => aus('  ' + x.eintrag.id + '  (' + x.eintrag.art + ', ' + x.gemeinsam.join(', ') + ')  ' + knapp(x.eintrag.titel, 100))); if (offenN.length > 6) aus('  … +' + (offenN.length - 6) + ' weitere'); }
    if (irr.length) { aus('\nIRRWEGE — dort schon versucht und mit Grund VERWORFEN. Lies den Grund, bevor du denselben Weg gehst:'); irr.slice(0, 4).forEach(x => aus('  ' + x.eintrag.id + '  ' + knapp(x.eintrag.titel, 90) + '\n      verworfen, weil: ' + knapp(x.grund, 160))); }
    if (neuE.art === 'befund' && !A.alsListe(neuE.bezug).some(x => x.art === 'gehoert_zu')) {
      const kv = A.klassenVorschlag(neuE, b2.eintraege), abl2 = A.ableiten(b2.eintraege);
      if (kv.length) { aus('\nFEHLERKLASSE? Diese koennten passen — nachschlagen, das Suchmuster fahren, dann `antworte ' + g.id.slice(-4) + ' --klasse <id>`:'); kv.forEach(x => { const sm = A.klasseWirksam(x.klasse, abl2.rueck).suchmuster; aus('  ' + x.klasse.id + '  ' + knapp(x.klasse.titel, 90) + '\n      Suche: ' + (sm ? zeilenweise(sm, 13) : '(kein Suchmuster)')); }); }
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
  // Eine Lage oder ein Halt geht durch DENSELBEN Weg wie `lage`/`nehme` und `halt`: `neu lage --bezug baut_auf:<id>`
  // ging an der Uebernahme-Pruefung vorbei (kein „schon uebernommen", kein Deckel, Gegenpruefung 4, Skeptiker).
  if (art === 'lage') return lageBefehl([]);
  if (art === 'halt') return haltBefehl();
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
  // Eine Lage mit baut_auf im Stapel ist eine Uebernahme wie `nehme`: dieselbe Pruefung, fuer alle Ziele des Stapels
  // zusammen — ein „fertig" desselben Stapels zaehlt dabei ab seiner Sekunde mit (vorher ging einspielen an der
  // Pruefung vorbei, und nach `git branch -m` gab es wieder 3 + 3, Gegenpruefung 4, Skeptiker).
  if (absicht && Array.isArray(roh)) {
    const nimmt = (e) => A.alsListe(e && e.bezug).filter(x => x && x.art === 'baut_auf' && typeof x.id === 'string').map(x => x.id);
    const lagen = roh.filter(e => e && typeof e === 'object' && e.art === 'lage' && e.phase !== 'fertig' && e.mithelfen !== true && nimmt(e).length);
    if (lagen.length) {
      // Gegenpruefung 5 (R5-schwarm-6): alle Eintraege eines Stapels tragen DIESELBE Sekunde — ein „fertig", dessen Bezug ein
      // Ziel nennt, das eine Lage DESSELBEN Stapels nimmt, gibt es in derselben Sekunde nicht frei (die Uebernahme gaelte
      // weiter). Vorher ging so ein Stapel still durch. Jetzt: nichts geschrieben, mit dem Weg, der wirkt.
      const imStapel = new Set(lagen.flatMap(nimmt));
      const leer = roh.filter(e => e && typeof e === 'object' && e.art === 'lage' && e.phase === 'fertig').flatMap(nimmt).filter(z => imStapel.has(z));
      if (leer.length) { aus('\nNICHTS geschrieben (alles oder nichts) — ein „fertig" des Stapels nennt ' + [...new Set(leer)].map(z => knapp(z, 40)).join(', ') + ', das eine Lage DESSELBEN Stapels nimmt: alle Eintraege eines Stapels tragen dieselbe Sekunde, und in derselben Sekunde gibt ein „fertig" nichts frei — die Uebernahme gaelte weiter.\nDas „fertig" spaeter einzeln schreiben: node scripts/austausch.mjs lage --phase fertig --bezug baut_auf:<id>'); process.exit(1); }
      holenStillSagen(holenStill());
      const b0 = brett(), von0 = vonFuerAbsicht('lage'), t0 = A.heute();
      const bekannt = (id) => b0.eintraege.some(e => e.id === id);
      const ziele = [...new Set(lagen.flatMap(nimmt))].filter(bekannt);
      const dazu = roh.filter(e => e && typeof e === 'object' && e.art === 'lage' && e.phase === 'fertig').map((e, i) => Object.assign({ art: 'lage', phase: 'fertig', titel: 'fertig (Stapel)', bis: bisAus('1h') }, e, { id: t0.datum + '-fffffff' + i, datum: t0.datum, zeit: t0.zeit, von: von0 }));
      // Je Lage des Stapels eine Probe (vorher EINE mit allen Zielen: ab vier hiess es „ungueltig" statt Deckel).
      const f = ziele.length ? uebernahmePruefen(b0, ziele, von0, false, dazu, lagen.map(e => nimmt(e).filter(bekannt))) : null;
      if (f) { aus('\nNICHTS geschrieben (alles oder nichts) — eine Lage des Stapels uebernimmt:\n' + f); process.exit(1); }
    }
  }
  const r = A.einspielen(WURZEL, roh, { von: braucht ? ich() : undefined, sitzung: ichVon(), absichtVon: absicht ? [vonFuerAbsicht('lage')] : null, datum: o.datum, alleRefs: true });
  // Ein Grund nennt den Titel eines Stapel-Eintrags und Dateinamen aus fremder Hand — darum durch knapp (Gegenpruefung 5b, R5c-A1):
  // vorher druckte ein zweizeiliger Titel „!! Eintrag 1 (Zwei Zeilen" und den Rest samt Grund auf einer eigenen Zeile.
  if (!r.ok) { aus('\nNICHTS geschrieben (alles oder nichts) — ' + r.fehler.length + ' Grund/Gruende:'); r.fehler.slice(0, 40).forEach(f => aus('  !! ' + knapp(f.wo, 120) + ': ' + knapp(f.grund, 0))); if (r.fehler.length > 40) aus('  … +' + (r.fehler.length - 40) + ' weitere'); process.exit(1); }
  aus('\nGeschrieben: ' + r.geschrieben.length + ' Eintraege nach ' + A.ORDNER + '/');
  r.geschrieben.forEach(g => aus('  ' + g.id + '  (' + g.art + ')  ' + knapp(g.titel, 100)));
  r.auswaerts.forEach(m => aus('Bezug ueber die Branch-Grenze: ' + m.id + ' liegt nur auf ' + nameSicher(m.quelle) + ' (der Bezug nennt den Branch)'));
  const krit = r.geschrieben.filter(g => { const x = Array.isArray(roh) ? roh[r.geschrieben.indexOf(g)] : null; return x && (x.dringlichkeit === 'kritisch' || x.an === 'fernando'); });
  if (krit.length) { aus('\nKRITISCH bzw. an Fernando — diese Zeilen gehoeren in STATUS.md §2 (sonst wird austausch_check A5/A7 rot):'); krit.forEach(g => aus('  brett:' + g.id + ' — ' + knapp(g.titel, 120))); }
  aus('\nNoch NICHT sichtbar fuer andere. Erst nach:  git add ' + A.ORDNER + ' && git commit && git push -u origin HEAD');
}
function erntenBefehl() {
  const r = A.ernten(WURZEL);
  if (r.gitDa === false) return aus('\ngit nicht verfuegbar — es gibt nichts zu ernten.\nNichts geschrieben.');
  aus('\nGeerntet: ' + r.geholt.length + ' Eintrag/Eintraege von anderen Branches (' + r.refs + ' Remote-Refs durchgesehen)');
  r.geholt.forEach(g => aus('  ' + g.id + '  {' + nameSicher(g.quelle) + '}  ' + knapp(g.titel, 100)));
  if (r.uebergangen.length) { aus('Uebergangen (bleibt auf seinem Branch — ungueltig, oder es beschreibt dessen Baum): ' + r.uebergangen.length); r.uebergangen.forEach(u => aus('  ' + A.fremd(u.id, 120) + '  {' + nameSicher(u.quelle, 80) + '}  ' + knapp(u.grund, 400))); }
  aus(r.geholt.length ? '\nJetzt im Arbeitsbaum. Mit dem naechsten Commit und PR kommen sie auf main an.' : '\nNichts geschrieben.');
}
function holen() {
  // OHNE --depth: ein flacher Abruf wuerde origin/main auf einen Commit kuerzen und
  // dem eigenen Branch die gemeinsame Geschichte nehmen (git merge braeche danach ab).
  // --prune: ein geloeschter Branch verschwindet auch hier — sonst zeigte `lesen` seine Eintraege
  // weiter als lebend, und der Verlust faele nie auf (die Sicherung `zz-sicherung` haelt sie fest).
  const bis = Date.now() + holFrist(HOL_FRIST_MS);
  const r = A.git(WURZEL, ['fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*'], { frist: holFrist(HOL_FRIST_MS), bis });
  if (r != null) letztesNachladen = eintraegeNachladenNachHolen(HOL_FRIST_MS, bis, true);
  aus(r == null ? '\nHolen hat NICHT geklappt (kein Netz, kein origin, keine Antwort binnen ' + Math.round(holFrist(HOL_FRIST_MS) / 1000) + ' s — oder wollte git etwas fragen: Passwort, Passphrase, Host-Schluessel? Fragen beantwortet git hier nicht) — gezeigt wird der Stand, den git schon kennt.' : '\nAlle Branches geholt.' + nachladeSatz(letztesNachladen));
  lesen();
}
// Nach dem Holen die Eintraege ausdruecklich NACHLADEN (Gegenpruefung 4, R4-lesen-0): in einem Klon mit
// --filter=blob:none sah `holen` sonst keinen einzigen fremden Eintrag — „Das Brett ist leer", auch nach dem Holen.
// Nur nach einem geklappten Abruf (sonst wartete eine zweite Frist auf denselben haengenden Remote), nur im Teilabruf.
// `bis`: die Gesamtfrist des Befehls (Gegenpruefung 5, R5-lesen-8) — Holen und Nachladen zusammen, nicht je Schritt.
// `aenderung`: nur `holen` (vor DICH BETREFFEND) laedt auch index.html und sw.js von main und der Abzweigstelle.
// `vorAelteren`: was der Befehl selbst braucht, nach den Spitzen und VOR den aelteren Fassungen (`naechste`: die Nummern).
function eintraegeNachladenNachHolen(vorgabe, bis, aenderung, vorAelteren) { return A.eintraegeNachladen(WURZEL, { frist: holFrist(vorgabe), bis, aenderung: !!aenderung, vorAelteren }); }
// Was dieser Prozess zuletzt nachzuladen versuchte (holen oder still) — DICH BETREFFEND sagt danach nicht noch einmal
// „holen", wenn genau das eben gescheitert ist (Gegenpruefung 5, R5-werkzeug-4: ein Rat im Kreis).
let letztesNachladen = null;
const NACHLADE_GRUND = { frist: 'Frist abgelaufen', fehler: 'der Abruf scheiterte — gibt der Server einzelne Objekte nicht heraus?' };
// Was wirklich hilft, gemessen (18.11.2026, git 2.43): scheitert der gezielte Abruf jedes Mal (ein Server ohne die Faehigkeit,
// einzelne Objekte zu liefern — nachgestellt mit protocol.version=0), holt `git fetch --refetch origin` mit dem Filter wieder
// nichts; erst ohne Filter liegt der Blob da. Das laedt das ganze Repo — deshalb erst der zweite Rat.
const OHNE_FILTER = 'git config --unset remote.origin.partialclonefilter && git fetch --refetch origin';
// Im Klon ohne Baeume der Geschichte (--filter=tree:0) holte `git fetch --refetch --filter=blob:none origin` die Baeume nur
// EINMAL — der Filter in der Konfiguration blieb tree:0, und nach dem naechsten Commit fehlte die Geschichte wieder. Dauerhaft
// half erst der Filter in der Konfiguration (gemessen: danach `log --raw` ohne Nachladen auch nach neuen Commits lesbar).
const MIT_BAEUMEN = 'git config remote.origin.partialclonefilter blob:none && git fetch --refetch origin';
// Der Rat, wenn das STILLE Nachladen (vor `naechste`/`nehme`) an der FRIST scheiterte (Gegenpruefung 5c, Skeptiker R5c-L1): zuerst
// `holen` — laengere Frist, und es laedt nur, was fehlt; danach hat der Befehl seine Frist fuer sich. Erst danach das ganze Repo.
// Vorher riet `naechste` „noch einmal naechste" (dieselbe Frist: im Kreis) und dann sofort `git fetch --refetch` ohne Filter;
// `nehme` riet nichts.
// `naechste`: reichen auch dann die stillen Sekunden nicht fuer die Dateien der Nummern (sw.js, STATUS.md und index.html der
// frischen Branches — `holen` laedt sie nicht), gibt AUSTAUSCH_HOLEN_FRIST_MS dem Befehl die Frist von `holen`.
function fristRat(befehl) {
  // Die Zahlen, die gelten: setzt AUSTAUSCH_HOLEN_FRIST_MS beide Fristen gleich, hat `holen` keine laengere — dann steht keine da.
  const lang = Math.round(holFrist(HOL_FRIST_MS) / 1000), kurz = Math.round(holFrist(HOL_FRIST_STILL_MS) / 1000);
  return 'Erst `holen` (' + (lang > kurz ? 'Frist ' + lang + ' s statt ' + kurz + ' s, ' : '') + 'es laedt nur, was fehlt), dann noch einmal: node scripts/austausch.mjs holen && node scripts/austausch.mjs ' + befehl
    + (befehl === 'naechste' ? ' — reicht es dann nicht: AUSTAUSCH_HOLEN_FRIST_MS=' + HOL_FRIST_MS + ' node scripts/austausch.mjs naechste' : '')
    + ' — erst danach: ' + OHNE_FILTER + ' (das ganze Repo)';
}
// `still`: der Befehl ('naechste' · 'nehme'), vor dem das Nachladen lief (stille Frist) — dann ist `holen` der erste Rat, wenn die
// Frist ablief.
function nachladeSatz(n, still) {
  if (!n || !n.teilabruf) return '';
  const g = n.grund ? ' (' + (NACHLADE_GRUND[n.grund] || n.grund) + ')' : (n.ok ? '' : ' (Abruf gescheitert oder Frist abgelaufen)');
  const ae = n.aeltere || { fehlt: [] }, ge = n.geschichte || [], vz = n.verzeichnis, an = n.aenderung;
  // Gegenpruefung 5c, Skeptiker (R5d-Le4): die Fassungen in der Sicherung, nachgeladen, weil ihr Verzeichnis hier nicht verwendbar ist
  // (A.eintraegeNachladen, `sicherung`) — gesagt mit dem GRUND, damit niemand im Kreis `naechste` wiederholt.
  const si = n.sicherung, sf = !!(si && (si.fehlt.length || si.baum));
  let s = (n.geholt ? ' ' + n.geholt + ' Eintragsdatei(en) nachgeladen (Teilabruf).' : '')
    + (si && si.geholt ? ' ' + si.geholt + ' Fassung(en) aus der Sicherung nachgeladen (das Verzeichnis des Waechters ist hier nicht verwendbar: ' + knapp(si.grund, 240) + ').' : '')
    + (n.fehlt.length ? '\n!! ' + n.fehlt.length + ' Eintragsdatei(en) bzw. Baeume liessen sich NICHT nachladen' + g + ' — sie bleiben unlesbar: ' + n.fehlt.slice(0, 3).map(x => /^[0-9a-f]{40,64}$/.test(x) ? x.slice(0, 12) : knapp(x, 70)).join(', ') + (n.fehlt.length > 3 ? ' … +' + (n.fehlt.length - 3) : '') : '');
  // Gegenpruefung 5: was das Brett ausser den Spitzen braucht (aeltere Fassungen, Verzeichnis, Geschichte) — gesagt, wenn es fehlt.
  // Gegenpruefung 5b (R5b-lesen-0/-3): mit den Branches, deren aeltere Fassungen nicht kamen (je Branch ein eigener Abruf) — und jeder
  // Ref-Name aus fremder Hand durch knapp() (eine Zeile, gedeckelt, Steuer- und Bidi-Zeichen sichtbar), wie in `naechste`.
  const refsSatz = (l) => l.slice(0, 3).map(x => knapp(x, 60)).join(', ') + (l.length > 3 ? ' … +' + (l.length - 3) : '');
  if (ae.fehlt.length) s += '\n!! ' + ae.fehlt.length + ' aeltere Fassung(en) von Lagen und Halts kamen nicht' + g + ((ae.refs || []).length ? ' (auf ' + refsSatz(ae.refs) + ')' : '') + ' — seit wann sie auf dem Branch ihres Schreibers liegen, ist hier nicht rechenbar.';
  if (vz === 'fehlt') s += '\n!! Das Verzeichnis des Waechters (' + A.SICHERUNG_ZWEIG + ':' + A.VERZEICHNIS + ') kam nicht' + g + ' — ohne es ist die Ankunft von Lagen und Halts hier nicht rechenbar.';
  if (sf) s += '\n!! ' + (si.baum ? 'Der Baum von ' + A.SICHERUNG_ZWEIG + ':' + A.FASSUNGEN + '/ liegt nicht vor' : si.fehlt.length + ' Fassung(en) in der Sicherung (' + A.SICHERUNG_ZWEIG + ':' + A.FASSUNGEN + '/) kamen nicht' + g) + ' — gebraucht, weil das Verzeichnis des Waechters hier nicht verwendbar ist (' + knapp(si.grund, 240) + '); ohne sie ist ein strittiger Halt, der nur in der Sicherung liegt, nicht rechenbar.';
  if (an && an.fehlt.length) s += '\n!! index.html bzw. sw.js von main oder der Abzweigstelle kamen nicht' + g + ' — ob ein Halt deine Aenderung beruehrt, ist nur unsicher rechenbar.';
  if (ge.length) s += '\n!! Die Geschichte von ' + ge.length + ' Branch(es) ist hier nicht lesbar (ein Klon ohne die Baeume aelterer Commits, --filter=tree:0): ' + refsSatz(ge) + ' — seit wann ihre Lagen und Halts dort liegen, ist nicht rechenbar (eine Lage nimmt dann nichts). Dauerhaft aendert das: ' + MIT_BAEUMEN;
  if ((n.fehlt.length || ae.fehlt.length || vz === 'fehlt' || sf) && n.grund === 'fehler') s += '\n   Scheitert es wieder: ' + OHNE_FILTER + '   (holt alles ohne Filter — das ganze Repo)';
  else if (still && (n.fehlt.length || ae.fehlt.length || vz === 'fehlt' || sf) && n.grund === 'frist') s += '\n   ' + fristRat(still);
  return s;
}
// Frist fuer das Holen (Gegenpruefung 3: `naechste` und `nehme` warteten, solange der Remote hing — 20 s bei
// `ext::sh -c sleep 20`). Still (vor `naechste` und `nehme`) 20 s, `holen` 120 s; danach „Holen hat nicht geklappt"
// wie bei jedem Fehler. AUSTAUSCH_HOLEN_FRIST_MS setzt beide — fuer den Pruefstand (C19), der nicht warten soll.
// Seit Gegenpruefung 5 (R5-lesen-8) ist es eine GESAMTFRIST je Befehl: Holen und jedes Nachladen danach (Eintraege, aeltere
// Fassungen, die Nummern bei `naechste`) teilen sich diese Zeit; dazu kommen hoechstens 2 s fuer das Abraeumen der Huelle.
const HOL_FRIST_MS = 120000, HOL_FRIST_STILL_MS = 20000;
const holFrist = (vorgabe) => { const n = Number(process.env.AUSTAUSCH_HOLEN_FRIST_MS); return n > 0 ? n : vorgabe; };

// ── Der Schwarm: Lage, Uebernahme, Halt, Veto, Aufheben, Sichern.
// Danach die Eintraege nachladen (wie `holen`): `naechste` braucht die fremden Bump-Halts, `nehme` die fremden
// Uebernahmen — im Klon mit --filter=blob:none fehlten beide, und `nehme` schrieb still eine zweite (Gegenpruefung 4).
// Mit --nur-lokal geht keine Anfrage hinaus: Ergebnis null (nicht geholt), und gelesen wird, was git lokal kennt.
let stillNachgeladen = null, stillBis = null;
// opts.vorAelteren (nur `naechste`): siehe eintraegeNachladenNachHolen — laeuft nur nach einem geklappten Abruf und nur im Teilabruf.
function holenStill(opts) {
  if (o.nur_lokal) { stillNachgeladen = null; return null; }
  stillBis = Date.now() + holFrist(HOL_FRIST_STILL_MS);
  const ok = A.git(WURZEL, ['fetch', '--quiet', '--prune', 'origin', '+refs/heads/*:refs/remotes/origin/*'], { frist: holFrist(HOL_FRIST_STILL_MS), bis: stillBis }) != null;
  stillNachgeladen = ok ? eintraegeNachladenNachHolen(HOL_FRIST_STILL_MS, stillBis, false, opts && opts.vorAelteren) : null;
  if (stillNachgeladen) letztesNachladen = stillNachgeladen;
  return ok;
}
// Der eine Satz nach holenStill: geklappt (nichts), nicht geklappt, oder mit --nur-lokal gar nicht versucht.
function holenStillSagen(geholt) {
  if (geholt === false) aus('(Holen hat nicht geklappt — gerechnet auf dem Stand, den git kennt.)');
  else if (geholt == null) aus('(--nur-lokal: nicht geholt — gerechnet auf dem Stand, den git lokal kennt, alle Branches.)');
}
// Darf diese Sitzung diese Ziele nehmen (bzw. dabei mithelfen)? EINE Rechnung mit dem Brett: die neue Lage wird
// probeweise dazugelegt und `schwarm` rechnet — vorher zaehlte `nehme` den Deckel anders als das Brett
// (Mithelf-Lagen nicht), sagte „Geschrieben", und die Uebernahme galt still nicht (Gegenpruefung 3).
//
// Gegenpruefung 4, vier Stellen:
//  · Was NICHT GELESEN ist, entscheidet nichts. Im Teilabruf (--filter=blob:none) fehlte eine fremde Uebernahme
//    im lokalen Objektspeicher, und `nehme` schrieb still eine zweite (R4-lesen-0). Liegt eine Datei ungelesen,
//    die eine Lage sein kann (ihr Name sagt „lage" oder sie hat keinen lesbaren Namen), ist „frei" eine Vermutung.
//  · Der Deckel gilt je SITZUNG, nicht je Name. Nach `git branch -m` nahm eine Sitzung 3 Ziele unter dem neuen
//    und 3 mit --von unter dem alten Namen — sechs, die fuer alle wirkten (R4-fassungen-12). Gezaehlt wird, was
//    die anderen dieser Sitzung zuschreiben: jedes Ziel, das einer ihrer Namen haelt — auch NACHRANGIG, denn
//    eine nachrangige Uebernahme belegt im Brett einen Platz (R4-schwarm-6: die Meldung nannte sie nicht und
//    sagte „schon 2 … mehr als 3"). Die nachrangige steht in der Meldung, mit dem Befehl, der sie freigibt.
//  · Ein ANDERER Grund der Probe ist kein Deckel: ein ungueltiges --bis oder ein Ziel, das man nicht nehmen
//    kann, hiess „Du haeltst schon 0 Uebernahme(n) — hoechstens 3" (R4-schwarm-7, R4-lesen-6). Er steht mit
//    seinem eigenen Satz da.
//  · „ginge nicht an dich" war unerreichbar (zurueckgebaut blieb die Suite gruen). Erreichbar ist genau EIN
//    Fall: ein eigenes „fertig" mit einem Zeitstempel NACH jetzt (eine vorgehende Uhr, bis 15 min erlaubt)
//    gibt die neue Lage im selben Augenblick wieder frei. Den sagt die Pruefung jetzt beim Namen; „schon
//    uebernommen" rechnet sie VORHER aus dem Brett ohne Probe (dort gilt, wer JETZT haelt).
function uebernahmePruefen(b, zielIds, ich0, auch, dazu, proben) {
  zielIds = [...new Set(zielIds)];
  // `dazu`: Lagen, die mit der neuen zugleich geschrieben werden (ein „fertig" im Stapel von `einspielen`) — sie zaehlen mit.
  if (dazu && dazu.length) { b = Object.assign({}, b, { eintraege: b.eintraege.concat(dazu), wo: b.gitDa ? new Map(b.wo) : b.wo }); if (b.gitDa) for (const x of dazu) b.wo.set(x.id, new Set(['Arbeitsbaum'])); }
  const ungelesen = (b.fehlend || []).filter(x => { if (x.zuGross) return false; const m = path.posix.basename(String(x.pfad || '')).match(A.NAME_FORM); return !m || m[2] === 'lage'; });
  if (ungelesen.length) {
    const q = [...new Set(ungelesen.map(x => String(x.quelle || '?')))];
    return 'Nicht entscheidbar: ' + ungelesen.length + ' Datei(en), die eine Lage sein koennen, sind hier nicht gelesen (Teilabruf: nicht im lokalen Objektspeicher, auf ' + q.slice(0, 3).join(', ') + (q.length > 3 ? ' … +' + (q.length - 3) : '') + ') — eine Uebernahme darin waere hier unsichtbar.\nErst holen und nachladen: node scripts/austausch.mjs holen — dann noch einmal.';
  }
  // Alle Namen DIESER Sitzung (nach einem belegten `git branch -m` auch der alte) — auch wenn --von / AUSTAUSCH_VON
  // einen davon waehlt: meineNamen() liefert dann nur diesen einen, der Deckel braucht alle.
  const vorgabe = { von: o.von, env: process.env.AUSTAUSCH_VON };
  let ohneVorgabe;
  try { delete o.von; delete process.env.AUSTAUSCH_VON; ohneVorgabe = meineNamen(); }
  finally { if (vorgabe.von !== undefined) o.von = vorgabe.von; if (vorgabe.env !== undefined) process.env.AUSTAUSCH_VON = vorgabe.env; }
  const namen = [...new Set(meineNamen().concat(ohneVorgabe, [ich0]).filter(Boolean))], meins = (v) => namen.indexOf(v) >= 0;
  // Gegenpruefung 5 (E2, E5): die Ziele einer Lage, die das Brett NICHT rechnet, sind nicht entscheidbar — einer STRITTIGEN
  // (verschiedene `von`, R5-fassungen-0) und einer, deren Ankunft nicht rechenbar ist (Teilabruf, Verzeichnis nicht gelesen:
  // R5-lesen-0/-1/-2). Vorher nahm so eine Lage nichts, und `nehme` schrieb still eine zweite Uebernahme — im vollen Klon
  // hiess es „schon uebernommen". Eine eigene Lage zaehlt nicht (sie verdeckt keinen fremden Anspruch).
  const unklar = new Map();
  const merke = (z, s) => { if (!unklar.has(z)) unklar.set(z, s); };
  // Gegenpruefung 5, Skeptiker (R5b-fassungen-0, D1): gesperrt wird nur ein Ziel, das mindestens eine Fassung JETZT naehme —
  // gueltig (eintragPruefen), Frist laeuft, nicht „fertig", nicht mithelfen, hoechstens LAGE_NIMMT_MAX Ziele. Das laesst sich ohne
  // Ankunft entscheiden. Vorher sperrte jede nicht gerechnete Lage ihre Ziele fuer alle und auf Dauer: zwei Kopien einer seit
  // 20 h abgelaufenen, einer fertigen oder einer Mithelf-Lage (verschiedene `von`) — und im Klon mit --filter=tree:0 jede
  // abgelaufene fremde Lage; auch `nehme --auch` endete mit Exit 1.
  const jetztMs = Date.now();
  const zieleVon = (e) => A.alsListe(e.bezug).filter(y => y && y.art === 'baut_auf').map(y => String(y.id));
  const naehmeJetzt = (e) => !!e && e.art === 'lage' && !A.eintragPruefen(e, e._datei).length && Date.parse(String(e.bis || '')) > jetztMs && e.phase !== 'fertig' && e.mithelfen !== true && zieleVon(e).length <= A.LAGE_NIMMT_MAX;
  for (const s of b.strittig || []) {
    const nehmend = ((b.fassungen && b.fassungen.get(s.id)) || []).map(v => v.e).filter(naehmeJetzt);
    // Eine eigene strittige Lage sperrt die eigenen Ziele nicht (sie verdeckt keinen fremden Anspruch).
    if (!nehmend.length || nehmend.every(e => meins(e.von))) continue;
    for (const z of new Set(nehmend.flatMap(zieleVon))) merke(z, s.id + ' ist strittig (' + knapp(s.grund || 'keine Fassung zuzuordnen', 160) + ')\nErst klaeren: node scripts/austausch.mjs zeige ' + s.id);
  }
  for (const x of b.ankunftOffen || []) {
    if (x.art !== 'lage') continue;
    const e = b.gilt && b.gilt.get(x.id) ? b.gilt.get(x.id).e : null;
    if (!e || meins(e.von) || !naehmeJetzt(e)) continue;
    for (const z of zieleVon(e)) merke(z, 'die Lage ' + x.id + ' von ' + knapp(e.von, 80) + ' {' + knapp(x.ref, 80) + '} hat eine Ankunft, die hier nicht rechenbar ist (' + knapp(x.grund, 160) + ')\nErst holen und nachladen: node scripts/austausch.mjs holen — dann noch einmal.');
  }
  // `nehme --auch` nimmt nichts — es wird nie gesperrt (D1); ist das Ziel unklar, heisst es auch nicht „frei".
  if (!auch) for (const id of zielIds) if (unklar.has(id)) return 'Nicht entscheidbar: ' + id + ' ist Ziel einer Lage, die hier nicht gerechnet wird — ob sie es haelt, ist von hier nicht zu sagen: ' + unklar.get(id);
  const als = (v) => v && v !== ich0 ? ' als ' + v : '';
  const wo = b.gitDa ? new Map(b.wo) : null;
  const sw = A.schwarm(b.eintraege, Date.now(), { wo, ich: namen });
  for (const id of zielIds) {
    const u = sw.uebernahme.get(id);
    if (auch && !u && !unklar.has(id)) return id + ' ist frei — niemand hat es genommen. Uebernehmen statt mithelfen: nehme ' + id.slice(-4) + ' (ohne --auch).';
    if (auch && u && meins(u.lage.e.von)) return id + ' hast du selbst genommen' + als(u.lage.e.von) + ' — mithelfen braucht es nicht.';
    if (!auch && u && !meins(u.lage.e.von)) return id + ' ist schon uebernommen: ' + u.lage.e.von + ' (seit ' + u.lage.e.datum + ' ' + u.lage.e.zeit + ' UTC, bis ' + uhr(u.lage.bis) + ').\nDie aelteste Uebernahme gilt. Mithelfen statt uebernehmen: --auch (deine Lage steht dann daneben).';
  }
  if (auch) return null;
  // Je Lage eine Probe: `proben` (einspielen) nennt die Ziele JEDER Lage des Stapels einzeln — vorher legte die Pruefung alle
  // Ziele in EINE Probe-Lage, und vier einzelne Uebernahmen hiessen „Die Lage waere ungueltig: eine Lage nimmt hoechstens 3"
  // statt des Deckels (Gegenpruefung 5, R5-schwarm-6). Ohne `proben` (nehme, lage --bezug): eine Lage mit allen Zielen.
  const listen = Array.isArray(proben) && proben.length ? proben.map(p => [...new Set(p)]).filter(p => p.length) : [zielIds];
  const t = A.heute(), probenE = listen.map((p, i) => ({ id: t.datum + (listen.length === 1 ? '-ffffffff' : '-ffffff' + i.toString(16).padStart(2, '0')), art: 'lage', datum: t.datum, zeit: t.zeit, von: ich0, titel: 'Probe', phase: 'laeuft', bis: bisAus(o.bis || '6h'), bezug: p.map(z => ({ art: 'baut_auf', id: z })) }));
  const probe = probenE[0], istProbe = (e) => probenE.indexOf(e) >= 0;
  if (wo) for (const p of probenE) wo.set(p.id, new Set(['Arbeitsbaum']));
  const sw2 = A.schwarm(b.eintraege.concat(probenE), Date.now(), { wo, ich: namen });
  const zvs = sw2.unwirksam.filter(x => istProbe(x.e)), zv = zvs.find(x => !Array.isArray(x.ziele)) || zvs[0], deckelGrund = !!(zv && Array.isArray(zv.ziele));
  if (deckelGrund) zv.ziele = [...new Set(zvs.filter(x => Array.isArray(x.ziele)).flatMap(x => x.ziele))];
  if (zv && !deckelGrund) {
    return /^ungueltig: /.test(zv.grund) ? 'Die Lage waere ungueltig: ' + zv.grund.replace(/^ungueltig: /, '') + '.\nFelder und ein Beispiel: node scripts/austausch.mjs hilfe lage'
      : 'Die Lage wirkte fuer die anderen nicht: ' + zv.grund + '.';
  }
  // Was haelt diese Sitzung JETZT (so, wie die anderen es rechnen)? Jedes Ziel, das einer ihrer Namen haelt — und
  // jedes, auf dem sie nachrangig steht (ohne `mithelfen`): auch das belegt im Brett einen Platz.
  const gehalten = new Map();
  for (const [z, u] of sw.uebernahme) {
    if (meins(u.lage.e.von)) { gehalten.set(z, { von: u.lage.e.von }); continue; }
    const l = u.auch.find(x => meins(x.e.von) && x.e.mithelfen !== true);
    if (l) gehalten.set(z, { von: l.e.von, vor: u.lage.e.von });
  }
  const neuZ = zielIds.filter(z => !gehalten.has(z)), platz = Math.max(0, A.LAGE_NIMMT_MAX - gehalten.size), ohnePlatz = neuZ.slice(platz);
  // Ein eigenes „fertig" in DIESER Sekunde oder spaeter gibt fuer den Deckel erst nach seinem Zeitstempel frei —
  // das Brett rechnet den Deckel zur Zeit der neuen Lage (sonst stuende hier „schon 0 … kein Platz").
  const zk = (e) => String(e.datum) + 'T' + String(e.zeit), nimmtZ = (e) => A.alsListe(e.bezug).filter(x => x && x.art === 'baut_auf').map(x => x.id);
  // (streng: NACH dieser Sekunde — nur ein solches gibt auch die neue Lage selbst frei.)
  const eigenesFertigAb = (id, streng) => b.eintraege.find(e => e.art === 'lage' && e.phase === 'fertig' && e.von === ich0 && (streng ? zk(e) > zk(probe) : zk(e) >= zk(probe))
    && (!nimmtZ(e).length || id == null || nimmtZ(e).indexOf(id) >= 0) && (({ ok, abgelaufen }) => ok || abgelaufen)(A.wirksam(e, Date.now())));
  if (ohnePlatz.length || deckelGrund) {
    if (!ohnePlatz.length) {   // nur das Brett zaehlt mehr — der Grund ist ein „fertig", das noch nicht vorbei ist
      const f = eigenesFertigAb(null);
      return 'Fuer ' + zv.ziele.join(', ') + ' ist zur Zeit der neuen Lage kein Platz' + (f ? ': dein „fertig" ' + f.id + ' (' + f.datum + ' ' + f.zeit + ' UTC) gibt fuer den Deckel erst NACH seinem Zeitstempel frei — danach noch einmal.' : ' (' + zv.grund + ').');
    }
    const eig = [...gehalten].filter(([, v]) => !v.vor), nach = [...gehalten].filter(([, v]) => v.vor);
    // Ein Stapel (einspielen) sagt, wie viele er dazunaehme — „Du haeltst schon 0" allein erklaerte nichts (R5-schwarm-6).
    let s = (listen.length > 1 ? 'Der Stapel naehme ' + neuZ.length + ' Ziel(e) dazu (' + neuZ.join(', ') + '; alle Lagen eines Stapels tragen dieselbe Sekunde, ein „fertig" darin gibt sie nicht frei) — ' : '')
      + 'Du haeltst schon ' + gehalten.size + ' Uebernahme(n)' + (eig.length ? ': ' + eig.map(([z, v]) => z + als(v.von)).join(', ') : '');
    if (nach.length) s += (eig.length ? ' — dazu ' : ' — ') + 'NACHRANGIG (bringt dir nichts, belegt trotzdem einen Platz): ' + nach.map(([z, v]) => z + ' (' + v.vor + ' war zuerst' + als(v.von) + ')').join(', ');
    s += ' — hoechstens ' + A.LAGE_NIMMT_MAX + ' zugleich je Sitzung' + (namen.length > 1 ? ' (ueber alle ihre Namen: ' + namen.join(', ') + ')' : '') + '; fuer ' + ohnePlatz.join(', ') + ' ist kein Platz.';
    const frei = nach.length ? nach[0] : null;
    return s + '\nErst eine freigeben: ' + (frei ? 'zuerst die nachrangige — lage --phase fertig --bezug baut_auf:' + frei[0] + (frei[1].von !== ich0 ? ' --von ' + frei[1].von : '')
      : 'lage --phase fertig --bezug baut_auf:<id>' + (eig.some(([, v]) => v.von !== ich0) ? ' (mit --von <Name>, unter dem die Uebernahme steht)' : '')) + '.';
  }
  // Die Probe muss die Ziele auch HALTEN: das tut sie, solange kein eigenes „fertig" sie im selben Augenblick freigibt.
  for (const id of zielIds) {
    const u = sw2.uebernahme.get(id);
    if (u && (istProbe(u.lage.e) || meins(u.lage.e.von))) continue;
    const f = eigenesFertigAb(id, true);
    return id + ' ginge nicht an dich: ' + (f ? 'dein „fertig" ' + f.id + ' traegt einen Zeitstempel NACH jetzt (' + f.datum + ' ' + f.zeit + ' UTC — eine vorgehende Uhr?) und gaebe die neue Lage im selben Augenblick wieder frei. Nach diesem Zeitpunkt noch einmal.'
      : (u ? u.lage.e.von + ' haelt es' : 'das Brett rechnet die Uebernahme nicht') + ' — node scripts/austausch.mjs zeige ' + id.slice(-4) + '.');
  }
  return null;
}
function lageBefehl(ziele, vorab) {
  vorab = vorab || {};
  if (o.datum) ende(2, 'Datum und Zeit einer Lage setzt das Werkzeug.');
  const phase = o.phase || 'laeuft';
  // Eine Uebernahme (baut_auf, nicht „fertig") holt vorher wie `nehme`: wer gleichzeitig nimmt, soll es sehen — und im
  // Teilabruf schrieb `lage --bezug` sonst still eine zweite Uebernahme (Gegenpruefung 4, Skeptiker).
  if (!vorab.geprueft && phase !== 'fertig' && ((ziele || []).length || mehrere(o.bezug).some(x => /^\s*baut_auf:/.test(String(x))))) holenStillSagen(holenStill());
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
  // holenStill hat die Eintraege nachgeladen (Teilabruf). Was sich nicht laden liess, wird VOR der Pruefung gesagt —
  // eine Uebernahme darin waere hier unsichtbar (Gegenpruefung 4: `nehme` schrieb still eine zweite).
  // Der Rat nennt DIESEN Befehl, kopierbar (Gegenpruefung 5c, Skeptiker R5d-L4): vorher „nehme <id>" — in der Shell ist `<id` eine
  // Umleitung, `holen` lief, `nehme` scheiterte („id: No such file or directory"). Jetzt die Argumente, wie sie kamen, je Wort gequotet.
  { const s = nachladeSatz(stillNachgeladen, ['nehme'].concat(argv).map(shWort).join(' ')); if (s.indexOf('!!') >= 0) aus(s.slice(s.indexOf('!!') - 1)); }
  // `von` EINMAL rechnen (vorher zweimal — die Upstream-Warnung stand doppelt da).
  const b = brett(), von = vonFuerAbsicht('lage');
  const f = uebernahmePruefen(b, o._.map(k => finde(b, k).id), von, !!o.auch);
  if (f) ende(1, '\n' + f + '\nNichts geschrieben.');
  holenStillSagen(geholt);
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
  r.neu.slice(0, 40).forEach(x => aus('  - ' + x.id + ' {' + nameSicher(x.quelle) + '}'));
  if (r.neu.length > 40) aus('  - … +' + (r.neu.length - 40) + ' weitere');
  if (r.weitere.length) aus('- **Weitere Fassung(en)** (umgeschrieben, oder auf zwei Branches verschieden — jede wird gesichert; unter eintraege/ liegt die, die fuer Leser gilt): ' + r.weitere.map(x => x.id + ' {' + nameSicher(x.quelle) + '}').join(', '));
  if (r.doppelt.length) aus('- **Doppelt** (zwei Dateien derselben id auf einem Branch — die zweite ist gesichert, unter fassungen/): ' + r.doppelt.map(x => x.id + ' {' + nameSicher(x.quelle) + '}').join(', '));
  if (r.strittig.length) aus('- **Strittig** (verschiedene Fassungen, keine zuzuordnen — fuer Leser nicht gerechnet, hier jede gesichert): ' + r.strittig.join(', '));
  // Unlesbare werden nie mit Dateinamen genannt: der Name traegt den Titel, und dieser Bericht ist oeffentlich (Gegenpruefung 3).
  const ul = (u) => (u.id || 'ohne id') + ' {' + nameSicher(u.quelle) + '} Blob ' + String(u.blob).slice(0, 8);
  if (r.unlesbar.length) aus('- **Unlesbar** (keine gueltigen Eintraege, nicht gesichert — verschwinden sie mit ihrem Branch, wird es gemeldet): ' + r.unlesbar.slice(0, 20).map(ul).join(', '));
  if (r.unlesbarEntfernt.length) aus('- Unlesbare Datei(en) entfernt, ihr Branch besteht (vom Schreiber entfernt oder ersetzt): ' + r.unlesbarEntfernt.map(ul).join(', '));
  if (r.verworfen.length) aus('- **In der Sicherung verworfen** (kein gueltiger Eintrag unter einem Namen der Sicherung, oder ein Geheimnis — der neue Stand traegt sie nicht): ' + r.verworfen.slice(0, 20).map(v => (v.id || 'fremde Datei') + ' Blob ' + String(v.blob).slice(0, 8) + ' (' + v.grund + ')').join(', '));
  if (r.umgelegt.length) aus('- Umgelegt (einmal gesichert, also bleibt es): ' + r.umgelegt.map(x => (x.id || 'ohne id') + ' Blob ' + String(x.blob).slice(0, 8) + ' — ' + x.grund).join(', '));
  if (r.uebersprungen.length) aus('- **Nicht gesichert**: ' + r.uebersprungen.map(x => x.id + ' {' + nameSicher(x.quelle) + '} ' + x.grund).join(' · '));   // R5d-A2: die Quelle streng
  if (r.entfernt.length) aus('- Entfernt (Grabstein): ' + r.entfernt.join(', '));
  if (r.vomSchreiber.length) aus('- Vom Schreiber zurueckgezogen (Grabstein auf seinem Branch; aus der Sicherung, sobald der Grabstein auf main liegt oder sein Branch weg ist): ' + r.vomSchreiber.map(x => x.id + ' {' + nameSicher(x.quelle) + '}').join(', '));
  if (r.zurueckgezogenWeg.length) aus('- Zurueckgezogen und sein Branch ist weg — aus der Sicherung genommen, nicht gerettet: ' + r.zurueckgezogenWeg.map(x => x.id + ' {' + nameSicher(x.quelle) + '}').join(', '));
  if (r.zurueckgezogenWieder && r.zurueckgezogenWieder.length) aus('- **Zurueckgezogen, aber wieder da** (der Schreiber hat sie zurueckgezogen, sein Branch ist weg oder neu angelegt — gesichert, solange sie auf einem Branch liegt; verschwindet sie, wird sie genommen, nicht gerettet): ' + r.zurueckgezogenWieder.map(x => x.id + ' {' + nameSicher(x.quelle) + '}').join(', '));
  if (r.abgelaufenWeg.length) aus('- Abgelaufene Lage/Halt nur noch hier (wirkt nicht mehr — kein Verlust; abgebaut nach ' + A.SICHERUNG_ABBAU_TAGE + ' Tagen): ' + ids(r.abgelaufenWeg).join(', '));
  // Gegenpruefung 5c, Skeptiker (R5d-A2): ein Ref-Name ist ein NAME — streng (nameSicher), wie jede andere Quelle in diesem Bericht.
  // Vorher roh: claude/grü<ZWJ>n stand hier wie claude/grün da (neben dem ü laesst die letzte Wand das ZWJ stehen).
  if (r.neuAngelegt.length) aus('- **Neu angelegt** (verschwand und kam wieder — fuer Eintraege, die schon vorher gesichert waren, ist er nicht mehr der Branch ihres Schreibers: seine Fassung gilt nicht als Berichtigung, sein Grabstein zieht nichts zurueck): ' + r.neuAngelegt.map(q => nameSicher(q)).join(', '));
  if (r.bewahrt.length) aus('- Bewahrt ohne Gedaechtnis (gefunden, als der Waechter kein Gedaechtnis hatte — der Name belegt den Inhalt, nicht den Schreiber; nie unter eintraege/ befoerdert, bis dieselbe Fassung beim Schreiber oder auf main liegt): ' + r.bewahrt.map(x => (x.id || 'ohne id') + ' Blob ' + String(x.blob).slice(0, 8)).join(', '));
  if (r.abgebaut.length) aus('- Abgebaut (abgeloeste Fassung, Eintrag auf main, ' + A.SICHERUNG_ABBAU_TAGE + ' Tage auf keinem Branch): ' + ids(r.abgebaut).join(', '));
  if (r.zurueckgenommen.length) aus('- **Zurueckgenommen?** Auf dem Branch des Schreibers liegt jetzt eine AELTERE Fassung als die zuletzt gesicherte (Ruecknahme — oder ein Force-Push hat zurueckgesetzt); die neuere liegt nur noch hier, unter fassungen/ (in jedem Lauf genannt, nie abgebaut): ' + ids(r.zurueckgenommen).join(', '));
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
    // Pflicht im EINTRAG (so prueft ihn das Brett, so verlangt ihn ein Stapel in `einspielen`) ist nicht dasselbe wie
    // Pflicht beim BEFEHL: `lage` setzt titel, phase und bis selbst, `halt` titel und bis (Gegenpruefung 5: die Hilfe nannte
    // sie als Pflicht, und `lage` ohne jeden Schalter schrieb trotzdem).
    const selbst = { lage: '`lage`/`nehme` setzen titel (aus Phase bzw. Ziel), phase (laeuft) und bis (6h) selbst', halt: '`halt`/`veto` setzen titel (aus Geltung bzw. Ziel) und bis (24h, Veto 48h) selbst — --text gibst du' }[art];
    return aus('\n' + a.wort + ' — ' + a.sinn + '\n  Pflicht' + (selbst ? ' im Eintrag (so verlangt ihn auch `einspielen`)' : '') + ': titel' + (a.pflicht.length ? ', ' + a.pflicht.join(', ') : '') + (a.brauchtBezug ? ', ein Bezug (' + a.brauchtBezug.join(' / ') + ')' : '') + '   (id, datum, zeit, von, stand setzt das Werkzeug)' + (selbst ? '\n  Beim Befehl: ' + selbst : '') + (a.bedingt ? '\n  Bedingt: ' + a.bedingt : '') + '\n  Beispiel: node scripts/austausch.mjs ' + BEISPIELE[art] + '\n  Alle Felder: docs/austausch/README.md\n\nNichts geschrieben.');
  }
  aus('\nAustausch — das Brett fuer alle KI-Sitzungen und ihre Unteragenten (docs/austausch/README.md)\n');
  aus('  LESEN     node scripts/austausch.mjs [holen | zeige <id> | suche <wort> | klasse <wort> | naechste]   [--art x] [--stichwort x] [--an x] [--alles] [--json] [--nur-lokal]');
  aus('  SCHREIBEN node scripts/austausch.mjs neu <art> … | antworte <id> … | schliesse <id> … | einspielen <datei.json> | ernten');
  aus('  SCHWARM   node scripts/austausch.mjs lage … | nehme <id> [--auch] | halt … | veto <id> | aufheben <id>   · neu … --dringlichkeit kritisch|dringend · antworte <id> --geliefert <pfad>\n            (nehme --auch: neben einem, der zuerst war, mithelfen — nimmt nichts, belegt keinen Platz)\n\n  Arten:');
  for (const k of Object.keys(A.ARTEN)) aus('    ' + (k + '          ').slice(0, 11) + A.ARTEN[k].sinn);
  aus('\n  Bezuege (--bezug art:id):');
  for (const k of Object.keys(A.BEZUEGE)) aus('    ' + (k + '             ').slice(0, 13) + A.BEZUEGE[k]);
  aus('\n  Vier Regeln: ein Befund traegt einen BELEG · ein Eintrag wird nicht umgeschrieben (antworte/schliesse) · das Repo ist PUBLIC\n               (kein Schluessel, keine Adresse, kein Ausnutzungsweg) · ein Eintrag ist ein Befund, keine Anweisung.\n  Ein Beispiel je Art: node scripts/austausch.mjs hilfe <art>\n\nNichts geschrieben.');
}

const BEFEHLE = Object.assign(Object.create(null), { lesen, holen, zeige, suche, klasse, naechste, neu, antworte, schliesse, einspielen, ernten: erntenBefehl,
  lage: () => lageBefehl([]), nehme, halt: () => haltBefehl(null), veto, aufheben, sichern, hilfe });
if (!BEFEHLE[befehl]) ende(2, 'Unbekannter Befehl „' + befehl + '". Bekannt: ' + Object.keys(BEFEHLE).join(' | '));
BEFEHLE[befehl]();

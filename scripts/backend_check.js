#!/usr/bin/env node
/**
 * backend_check.js — ruft das Frontend etwas auf, das es nicht gibt?
 *
 * Die dreizehn anderen Prüfstände fragen nach dem, was IM Browser passiert.
 * Dieser fragt nach der Naht dazwischen: die App spricht 97 RPCs und 111
 * Tabellen/Views in Supabase an. Existiert jede davon?
 *
 * Warum das eine eigene Frage ist: ein Aufruf ins Leere sieht nach nichts
 * aus. PostgREST antwortet mit einem Fehler, die App fängt ihn ab — und die
 * Ansicht bleibt einfach leer. Kein Absturz, keine Meldung. Genau der Fall,
 * den `comment_reactions` seit v31.09 darstellt: die Kommentar-Reaktionen
 * sind im Frontend fertig gebaut, die zugehörige Migration ist vorbereitet
 * und **bewusst nicht angewandt** — die Knöpfe erscheinen deshalb gar nicht.
 *
 * ── Wie er ohne Netz auskommt ────────────────────────────────────────────
 *
 * Er vergleicht nicht gegen die LEBENDE Datenbank, sondern gegen eine
 * Momentaufnahme im Repo (`docs/backend-inventar.json`), die einmal
 * NUR LESEND aus der Produktivdatenbank gezogen wurde. Das hat einen Preis
 * und einen Gewinn:
 *
 *   Preis:  die Momentaufnahme veraltet. Deshalb nennt der Bericht IMMER ihr
 *           Datum — eine Zahl ohne Datum wäre eine Behauptung.
 *   Gewinn: er läuft überall, ohne Zugangsdaten, ohne Netz, wie die anderen
 *           dreizehn. Und er läuft VOR dem Ausliefern, nicht danach.
 *
 * ── Drei Klassen, nicht zwei ─────────────────────────────────────────────
 *
 *   ROT    — angesprochen, existiert nicht, und es ist nichts vorbereitet.
 *   OFFEN  — existiert nicht, aber eine Migration liegt bereit. Kein Fehler
 *            im Code; eine Aufgabe für jemanden mit Schreibrecht auf der
 *            Produktivdatenbank. Wird NAMENTLICH genannt, nie stillschweigend
 *            durchgewinkt.
 *   NEU    — seit der Momentaufnahme dazugekommen. Auch das ist kein Fehler,
 *            aber es heisst: die Momentaufnahme ist nachzuziehen.
 *
 *   node scripts/backend_check.js
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
const snapPfad = path.join(WURZEL, 'docs', 'backend-inventar.json');

if (!fs.existsSync(snapPfad)) {
  console.log('\n=== backend_check');
  console.log('  !!   Keine Momentaufnahme (docs/backend-inventar.json). Ohne sie prüft dieser Stand nichts.');
  process.exitCode = 1;
  return;
}
const snap = JSON.parse(fs.readFileSync(snapPfad, 'utf8'));
const objekte = new Set(snap.objekte || []);
const rpcGeprueft = new Set(snap.rpc_geprueft || []);
const offen = snap.offen || {};

const rpc = [...new Set([...src.matchAll(/\/rest\/v1\/rpc\/([a-zA-Z0-9_]+)/g)].map(m => m[1]))].sort();
const tbl = [...new Set([...src.matchAll(/\/rest\/v1\/([a-zA-Z0-9_]+)(?![a-zA-Z0-9_\/])/g)].map(m => m[1]).filter(x => x !== 'rpc'))].sort();

console.log('\n=== backend_check — ruft das Frontend etwas auf, das es nicht gibt?');
console.log('  Momentaufnahme vom ' + (snap.stand || '?') + ' · ' + objekte.size + ' Objekte · ' +
            rpcGeprueft.size + ' geprüfte RPCs');
console.log('  ' + (snap.wie || ''));
console.log('');

let rot = 0;
const melde = (ok, name, info) => {
  if (ok) console.log('  ok   ' + name + (info ? '   [' + info + ']' : ''));
  else { rot++; console.log('  !!   ' + name + '\n         → ' + info); }
};

// ── Tabellen und Views ───────────────────────────────────────────────────
const tblFehlt = tbl.filter(t => !objekte.has(t));
const tblOffen = tblFehlt.filter(t => offen[t]);
const tblRot = tblFehlt.filter(t => !offen[t]);
melde(tblRot.length === 0, 'Jede angesprochene Tabelle/View existiert',
      tblRot.length ? tblRot.length + ' fehlen ohne vorbereitete Migration: ' + tblRot.join(', ')
                    : tbl.length + ' angesprochen · ' + (tbl.length - tblFehlt.length) + ' vorhanden' +
                      (tblOffen.length ? ' · ' + tblOffen.length + ' bewusst offen (siehe unten)' : ''));

// ── RPCs ─────────────────────────────────────────────────────────────────
const rpcNeu = rpc.filter(r => !rpcGeprueft.has(r));
melde(true, 'Jeder aufgerufene RPC war bei der Momentaufnahme vorhanden',
      rpc.length + ' aufgerufen · ' + (rpc.length - rpcNeu.length) + ' geprüft' +
      (rpcNeu.length ? ' · ' + rpcNeu.length + ' seither dazugekommen' : ''));
if (rpcNeu.length) {
  console.log('       NEU seit der Momentaufnahme — noch niemand hat nachgesehen, ob es sie gibt:');
  rpcNeu.forEach(r => console.log('         · ' + r));
  console.log('       Die Momentaufnahme ist nachzuziehen (execute_sql gegen pg_proc, nur lesend).');
}

// ── Bewusst offene Punkte: genannt, nicht durchgewunken ──────────────────
if (Object.keys(offen).length) {
  console.log('');
  console.log('  OFFEN — im Frontend fertig, in der Datenbank noch nicht:');
  Object.keys(offen).forEach(k => {
    const benutzt = tbl.indexOf(k) >= 0 || rpc.indexOf(k) >= 0;
    console.log('    · ' + k + (benutzt ? '' : '  (wird gar nicht mehr aufgerufen — Eintrag kann weg)'));
    console.log('      ' + offen[k]);
  });
  console.log('  Das ist KEIN Fehler im Code und wird deshalb nicht rot gezählt — aber es steht');
  console.log('  hier, damit es niemand vergisst. Anwenden darf es nur, wer Schreibrecht auf der');
  console.log('  Produktivdatenbank hat; dieser Prüfstand fasst nichts an.');
}

// ── Edge-Functions: liegt zu jeder ausgelieferten ein Spiegel im Repo? ───
//
// Die Konvention dieses Repos heisst „mirror-first": was ausgeliefert wird,
// liegt auch als Quelltext hier. Wo der Spiegel fehlt, ist das Repo nicht
// mehr die Quelle der Wahrheit für den eigenen Server-Teil — und niemand kann
// nachlesen oder prüfen, was die Funktion tut, ohne Supabase zu fragen.
//
// Genau so ist `send-receipt` durchgerutscht: ausgeliefert seit April,
// von niemandem aufgerufen, ohne Spiegel — und sie verschickt E-Mails von
// der verifizierten Absenderdomäne mit Inhalten aus dem Anfrage-Rumpf.
const fnListe = snap.edge_functions || [];
if (fnListe.length) {
  const verz = path.join(WURZEL, 'supabase', 'functions');
  const gespiegelt = new Set(fs.existsSync(verz) ? fs.readdirSync(verz) : []);
  // Drei Zustände, wie bei den Migrationen — und aus demselben Grund:
  //   gespiegelt   — `index.ts` liegt da, der Quelltext ist nachlesbar.
  //   dokumentiert — kein Quelltext, aber eine BEFUND.md, die sagt WARUM und
  //                  WIE man ihn zieht. Kein Fehler, aber auch kein Spiegel:
  //                  wird bei JEDEM Lauf namentlich genannt, damit es nicht
  //                  hinter der Datei verschwindet.
  //   nichts       — rot.
  const hatDatei = (f, name) => fs.existsSync(path.join(verz, f, name));
  const ohneSpiegel = fnListe.filter(f => !gespiegelt.has(f) || !hatDatei(f, 'index.ts'));
  const dokumentiert = ohneSpiegel.filter(f => gespiegelt.has(f) && hatDatei(f, 'BEFUND.md'));
  const garnichts = ohneSpiegel.filter(f => dokumentiert.indexOf(f) < 0);
  melde(garnichts.length === 0, 'Jede ausgelieferte Edge-Function ist im Repo nachlesbar',
        garnichts.length ? garnichts.length + ' weder gespiegelt noch dokumentiert: ' + garnichts.join(', ')
                         : (fnListe.length - ohneSpiegel.length) + ' gespiegelt' +
                           (dokumentiert.length ? ' · ' + dokumentiert.length + ' dokumentiert statt gespiegelt (siehe unten)' : ''));
  if (dokumentiert.length) {
    dokumentiert.forEach(f => {
      const erste = (fs.readFileSync(path.join(verz, f, 'BEFUND.md'), 'utf8').split('\n')[0] || '').replace(/^#\s*/, '');
      console.log('       · ' + f + ' — kein Quelltext im Repo. ' + erste);
    });
  }

  // Und die Umkehrung, damit die Momentaufnahme nicht schleichend veraltet.
  const nurRepo = [...gespiegelt].filter(d => fnListe.indexOf(d) < 0 &&
    fs.existsSync(path.join(verz, d, 'index.ts')));
  if (nurRepo.length) {
    console.log('       Nur im Repo, nicht (mehr) ausgeliefert: ' + nurRepo.join(', '));
    console.log('       Entweder nie deployed oder inzwischen entfernt — beides ist eine Frage wert.');
  }
}

console.log('  ---');
console.log('  Angesprochen: ' + rpc.length + ' RPCs · ' + tbl.length + ' Tabellen/Views · ' +
            (snap.edge_functions || []).length + ' Edge-Functions · davon rot: ' + rot);
process.exitCode = rot ? 1 : 0;

#!/usr/bin/env node
/**
 * apk_check.js — ist die Android-App dieselbe App, und haelt sie, was ein
 * Paket verspricht?
 *
 *   node scripts/apk_check.js
 *
 * ANLASS. Fernando am 17.09.2026: „Es soll so eine Apk gemacht werden wie
 * Whatsapp die man vom Internet aus herunterladen kann. Keine Web app mehr
 * sondern eine richtige App die noch besser als die Webapp version
 * funktioniert."
 *
 * Der Entwurf aus v33.43 (`docs/ANDROID-APK.md`) beantwortet das NICHT: eine
 * TWA ist eine Chrome-Huelle, die green-scan.ch bei jedem Start aus dem NETZ
 * holt, und ohne die zwei Fingerabdruecke aus der Play Console zeigt sie die
 * Adressleiste — also genau die Webseite in einer Huelle. Gemessen kam dazu:
 * `dl.google.com` ist aus dieser Umgebung gesperrt (403, dieselbe Klasse wie
 * green-scan.ch selbst), damit gibt es kein Google Maven, damit kein AndroidX,
 * damit weder Bubblewrap/TWA noch Capacitor.
 *
 * Seit v33.49 liegt die App IM PAKET (`android/`, gebaut mit
 * `android/build.sh`) und wird von einer nackten WebView unter dem ECHTEN
 * Ursprung `https://green-scan.ch` ausgeliefert. Das ist kein zweiter
 * Quelltext: es ist dieselbe `index.html`.
 *
 * VIER HAELFTEN, und jede fragt etwas, das die anderen nicht sehen:
 *
 *   RECHNUNG — `Pfade.java` wird UEBERSETZT UND AUSGEFUEHRT (reines Java,
 *              keine Android-Abhaengigkeit — dieselbe Aufteilung wie
 *              `_shared/ingest_regeln.mjs`: die Rechnung im Modul, die Huelle
 *              ist nur der Rand). Eine Regel, die man nicht ausfuehrt, hat man
 *              nicht geprueft (v33.41).
 *   PAKET    — `android/build.sh` wirklich laufen lassen und im APK nachsehen:
 *              ist index.html BYTE-GLEICH? stimmt die Version? Ohne die
 *              Android-Werkzeuge: „nicht pruefbar" (Exit 2), nie gruen.
 *   RAND     — der Quelltext der Huelle: kein `null` fuer den eigenen
 *              Ursprung, keine Bruecke nach JavaScript, dieselbe Marke.
 *   APP      — Playwright ueber HTTP (nicht `file:` — `gsRegisterServiceWorker`
 *              steigt dort schon in Zeile 1 aus, ein Fall auf file: waere aus
 *              dem falschen Grund gruen): jeder Eintrag in GS_HUELLE_ANDERS
 *              wird durchgesetzt, und ohne die Kennung passiert nichts davon.
 *
 * SEIT v33.53 DER KANAL fuer Export und Drucken (`Export.java`): die RECHNUNG
 * wird gegen android.jar 23 uebersetzt und mit Grenzfaellen ausgefuehrt
 * (`scripts/apk/ExportFahrer.java`); in der APP laeuft die Huelle-Fahrt unter
 * dem echten Ursprung https://green-scan.ch (geroutet, mit der CSP aus
 * `_headers`), und jede Anfrage an /__huelle/datei/ geht an einen Java-Prozess
 * mit dem ECHTEN Sammler (`scripts/apk/KanalFahrer.java`). Gestellt ist nur
 * der Dialog „Speichern unter" — was die Person darin tut, entscheidet der
 * Fall, und das Ergebnis kommt mit genau der Zeichenkette zurueck, die
 * `Export.rueckruf` baut. Alle zehn Exporte und Druckwege werden ueber ihre
 * echte Funktion ausgeloest, die Datei wird auf der Platte gelesen.
 *
 * GRENZE, und sie ist die wichtigste Zeile dieser Datei: HIER LAEUFT KEIN
 * ANDROID. Geprueft sind der BAU, die RECHNUNG und die ENTSCHEIDUNG der App —
 * nicht, wie sich ein Telefon verhaelt. Wer „auf dem Geraet geprueft" schreibt,
 * muss sagen, auf welchem.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawnSync, spawn } = require('child_process');

const WURZEL = path.resolve(__dirname, '..');
const ANDROID = path.join(WURZEL, 'android');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
const MANIFEST = fs.readFileSync(path.join(ANDROID, 'AndroidManifest.xml'), 'utf8');
const ASSETSERVER = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/AssetServer.java'), 'utf8');
const MAINACT = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/MainActivity.java'), 'utf8');
const BUILDSH = fs.readFileSync(path.join(ANDROID, 'build.sh'), 'utf8');
const EXPORT_JAVA = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/Export.java'), 'utf8');
const DRUCK_JAVA = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/DruckAnsicht.java'), 'utf8');
const FAHRER = path.join(__dirname, 'apk');   // ExportFahrer.java, KanalFahrer.java
const UHR = new Date('2026-10-09T08:30:00Z'); // gestellt: Huelle und Browser rechnen mit derselben Uhr

const GS_VERSION = (QUELLE.match(/var GS_VERSION = '(v[\d.]+)'/) || [])[1] || '';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apkcheck-'));

function hat(cmd) { return spawnSync('sh', ['-c', 'command -v ' + cmd], { encoding: 'utf8' }).status === 0; }
const ANDROID_JAR = process.env.ANDROID_JAR || '/usr/lib/android-sdk/platforms/android-23/android.jar';
const WERKZEUGE_DA = hat('javac') && hat('java');
const BAU_DA = WERKZEUGE_DA && hat('aapt') && hat('zipalign') && hat('apksigner')
  && (hat('d8') || hat('dalvik-exchange')) && fs.existsSync(ANDROID_JAR) && hat('unzip');

/**
 * Entfernt Kommentare — und fuehrt dabei Zeichenketten mit.
 *
 * Ohne das findet jede Suche ZUERST den eigenen Text UEBER die Sache: der
 * Klassenkommentar „Es gibt kein addJavascriptInterface" zaehlte als ein
 * addJavascriptInterface, und ein Kommentar in index.html ueber
 * `<use href="datei.svg#id">` als eine fehlende Datei. Dieselbe Klasse wie die
 * Jargon-Suche, die ihre eigenen Release-Notizen findet (v32.70), und wie der
 * Schnitt am „UNION ALL" im Kommentar (v33.41). Und die naive Fassung
 * („steht ein /* naeher als das letzte *\/?") reicht nicht — `accept="image/*"`
 * traegt ein /* in einer ZEICHENKETTE und schliesst nie.
 */
function ohneKommentare(t) {
  let o = '', i = 0, n = t.length;
  while (i < n) {
    const c = t[i], c2 = t[i + 1];
    if (c === '"' || c === "'" || c === '`') {                 // Zeichenkette
      const q = c; o += c; i++;
      while (i < n && t[i] !== q) { if (t[i] === '\\') { o += t[i]; i++; } o += t[i]; i++; }
      o += t[i] || ''; i++; continue;
    }
    if (c === '/' && c2 === '/') { while (i < n && t[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < n && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; o += ' '; continue; }
    if (c === '<' && t.substr(i, 4) === '<!--') { const e = t.indexOf('-->', i); i = (e < 0 ? n : e + 3); o += ' '; continue; }
    o += c; i++;
  }
  return o;
}

const QUELLE_OHNE = ohneKommentare(QUELLE);

/**
 * Schneidet den `GS_RELEASES`-Block heraus.
 *
 * Dort steht die Beschreibung der Aenderung — und damit die API, um die es
 * geht, woertlich im Fliesstext. Der Changelog-Eintrag zu v33.49 nennt
 * `navigator.serviceWorker.ready`, und R9 zaehlte ihn als rohen Zugriff:
 * der Pruefstand wurde rot an dem Satz, der erklaert, warum er gruen ist.
 *
 * Dieselbe Regel wie die Jargon-Suche in `nutzersicht_check` (v32.70) und der
 * Schnitt am „UNION ALL" im Kommentar (v33.41) — DRITTES Vorkommen in dieser
 * einen Scheibe, nach dem Klassenkommentar und dem Ursprungs-Waechter. **Wer
 * im Quelltext nach einem Namen ZAEHLT, nimmt Kommentare UND den Changelog
 * heraus; wer nach einer Durchsetzungs-Kennung sucht (R8), braucht sie.**
 */
function ohneChangelog(t) {
  const a = t.indexOf('window.GS_RELEASES = [');
  if (a < 0) return t;
  const b = t.indexOf('\n];', a);
  if (b < 0) return t;
  return t.slice(0, a) + t.slice(b + 3);
}

/** Quelltext ohne Kommentare UND ohne Changelog — zum ZAEHLEN von Namen. */
const QUELLE_CODE = ohneChangelog(QUELLE_OHNE);

const F = [];   // Faelle: {name, r}
let kaputt = 0, offen = 0;
const md5 = (b) => require('crypto').createHash('md5').update(b).digest('hex');

// ===========================================================================
// RECHNUNG · Pfade.java wird uebersetzt und AUSGEFUEHRT
// ===========================================================================
function rechnung() {
  if (!WERKZEUGE_DA) {
    const w = { offen: true, warum: 'kein javac/java in dieser Umgebung — die Rechnung wurde NICHT ausgefuehrt' };
    F.push({ name: 'P1 · Pfade: / wird index.html, die Abfrage faellt weg', r: w });
    F.push({ name: 'P2 · Pfade: kein Ausbruch aus dem Paket, auch kodiert nicht', r: w });
    F.push({ name: 'P3 · mimeTyp ist eine GESCHLOSSENE Liste', r: w });
    F.push({ name: 'P4 · Kopfzeilen kommen aus _headers — mit CSP, ohne HSTS', r: w });
    return;
  }
  const src = path.join(TMP, 'ch/greenscan/app');
  fs.mkdirSync(src, { recursive: true });
  fs.copyFileSync(path.join(ANDROID, 'src/ch/greenscan/app/Pfade.java'), path.join(src, 'Pfade.java'));

  // Der Fahrer. Er ruft die ECHTE Klasse — nicht eine Nachbildung.
  fs.writeFileSync(path.join(TMP, 'Fahrer.java'), `
import ch.greenscan.app.Pfade;
public class Fahrer {
  static StringBuilder out = new StringBuilder();
  static void z(String k, String v) { out.append(k).append('\\t').append(v == null ? "NULL" : v).append('\\n'); }
  public static void main(String[] a) throws Exception {
    String[] pfade = { "/", "", "/?source=app", "/index.html",
      "/data/plants.v1.js?v=1", "/assets/leaflet.css", "/icons/icon-192.png?v=2",
      "/gibtsnicht.js", "/x#anker",
      "/../_headers", "/..%2f_headers", "/%2e%2e/x", "/%252e%252e/x",
      "/a/../../b", "/a\\\\b", "//index.html" };
    for (String p : pfade) z("N:" + p, Pfade.normieren(p));
    String[] typen = { "a.html", "a.js", "a.mjs", "a.css", "a.json", "a.png", "a.svg", "a.bin", "a", "a.JS" };
    for (String t : typen) z("M:" + t, Pfade.mimeTyp(t));
    String[][] urspruenge = {
      {"https","green-scan.ch"}, {"HTTPS","GREEN-SCAN.CH"}, {"https","www.green-scan.ch"},
      {"http","green-scan.ch"}, {"https","abc.supabase.co"}, {"https","api.anthropic.com"},
      {"blob","green-scan.ch"}, {"blob",null}, {"data",null}, {"javascript",null},
      {"https","green-scan.ch.boese.example"}, {null,null}
    };
    for (String[] u : urspruenge) z("U:" + u[0] + "|" + u[1], String.valueOf(Pfade.imUrsprung(u[0], u[1])));
    String h = new String(java.nio.file.Files.readAllBytes(java.nio.file.Paths.get(a[0])), "UTF-8");
    java.util.LinkedHashMap<String,String> k = Pfade.kopfzeilen(h);
    for (java.util.Map.Entry<String,String> e : k.entrySet()) z("H:" + e.getKey(), e.getValue());
    System.out.print(out);
  }
}`);
  const jc = spawnSync('javac', ['-nowarn', '-encoding', 'UTF-8', '-d', TMP,
    path.join(src, 'Pfade.java'), path.join(TMP, 'Fahrer.java')], { encoding: 'utf8' });
  if (jc.status !== 0) {
    const w = { ok: false, warum: 'Pfade.java uebersetzt nicht: ' + String(jc.stderr).split('\n').filter(x => x && !/Picked up/.test(x))[0] };
    F.push({ name: 'P1 · Pfade: / wird index.html, die Abfrage faellt weg', r: w });
    return;
  }
  const run = spawnSync('java', ['-cp', TMP, 'Fahrer', path.join(WURZEL, '_headers')], { encoding: 'utf8' });
  const m = {};
  String(run.stdout).split('\n').forEach(l => { const i = l.indexOf('\t'); if (i > 0) m[l.slice(0, i)] = l.slice(i + 1); });

  const erwartetN = {
    'N:/': 'index.html', 'N:': 'index.html', 'N:/?source=app': 'index.html',
    'N:/index.html': 'index.html', 'N:/data/plants.v1.js?v=1': 'data/plants.v1.js',
    'N:/assets/leaflet.css': 'assets/leaflet.css', 'N:/icons/icon-192.png?v=2': 'icons/icon-192.png',
    'N:/gibtsnicht.js': 'gibtsnicht.js', 'N:/x#anker': 'x', 'N://index.html': 'index.html',
  };
  const falschN = Object.keys(erwartetN).filter(k => m[k] !== erwartetN[k]);
  F.push({
    name: 'P1 · Pfade: / wird index.html, die Abfrage faellt weg',
    r: falschN.length ? { ok: false, warum: falschN.map(k => k + ' → ' + m[k] + ' (erwartet ' + erwartetN[k] + ')').join(' · ') }
                      : { ok: true, info: Object.keys(erwartetN).length + ' Faelle, alle wie erwartet' },
  });

  const ausbruch = ['N:/../_headers', 'N:/..%2f_headers', 'N:/%2e%2e/x', 'N:/%252e%252e/x', 'N:/a/../../b', 'N:/a\\b'];
  const durch = ausbruch.filter(k => m[k] !== 'NULL');
  F.push({
    name: 'P2 · Pfade: kein Ausbruch aus dem Paket, auch kodiert nicht',
    r: durch.length ? { ok: false, warum: durch.length + ' von ' + ausbruch.length + ' kamen durch: ' + durch.map(k => k + ' → ' + m[k]).join(' · ') }
                    : { ok: true, info: ausbruch.length + ' Ausbruchsversuche, alle null (roh, %2f, %2e%2e, doppelt kodiert, Backslash)' },
  });

  // P5 — die Weiche. Das Schema von `blob:https://green-scan.ch/uuid` ist
  // `blob`, nicht `https`: wer nur auf den Wirt prueft, faengt jedes
  // Scanner-Foto ab und die App zeigt kein einziges aufgenommenes Bild.
  const erwartetU = {
    'U:https|green-scan.ch': 'true', 'U:HTTPS|GREEN-SCAN.CH': 'true',
    'U:https|www.green-scan.ch': 'false', 'U:http|green-scan.ch': 'false',
    'U:https|abc.supabase.co': 'false', 'U:https|api.anthropic.com': 'false',
    'U:blob|green-scan.ch': 'false', 'U:blob|null': 'false', 'U:data|null': 'false',
    'U:javascript|null': 'false', 'U:https|green-scan.ch.boese.example': 'false',
    'U:null|null': 'false',
  };
  const falschU = Object.keys(erwartetU).filter(k => m[k] !== erwartetU[k]);
  F.push({
    name: 'P5 · Die Weiche: nur https://green-scan.ch kommt aus dem Paket — blob:, data: und alles Fremde nicht',
    r: falschU.length ? { ok: false, warum: falschU.map(k => k + ' → ' + m[k] + ' (erwartet ' + erwartetU[k] + ')').join(' · ') }
                      : { ok: true, info: Object.keys(erwartetU).length + ' Adressarten, darunter blob:, data:, javascript: und ein aehnlich aussehender Wirt' },
  });

  const erwartetM = { 'M:a.html': 'text/html', 'M:a.js': 'text/javascript', 'M:a.mjs': 'text/javascript',
    'M:a.css': 'text/css', 'M:a.json': 'application/json', 'M:a.png': 'image/png', 'M:a.svg': 'image/svg+xml',
    'M:a.bin': 'application/octet-stream', 'M:a': 'application/octet-stream', 'M:a.JS': 'text/javascript' };
  const falschM = Object.keys(erwartetM).filter(k => m[k] !== erwartetM[k]);
  F.push({
    name: 'P3 · mimeTyp ist eine GESCHLOSSENE Liste (Unbekanntes wird nicht geraten)',
    r: falschM.length ? { ok: false, warum: falschM.map(k => k + ' → ' + m[k] + ' (erwartet ' + erwartetM[k] + ')').join(' · ') }
                      : { ok: true, info: 'auch .JS und ohne Endung richtig' },
  });

  // Die Kopfzeilen muessen die ECHTEN aus _headers sein — sonst liefe die App
  // im Paket ohne CSP, schwaecher als im Browser, und niemand merkte es.
  const csp = m['H:Content-Security-Policy'] || '';
  const cspRepo = (fs.readFileSync(path.join(WURZEL, '_headers'), 'utf8')
    .match(/^\s+Content-Security-Policy:\s*(.+)$/m) || [])[1] || '';
  const hatHsts = Object.keys(m).some(k => /^H:Strict-Transport-Security/i.test(k));
  F.push({
    name: 'P4 · Kopfzeilen kommen aus _headers — dieselbe CSP wie im Web, ohne HSTS',
    r: (csp && cspRepo && csp.trim() === cspRepo.trim() && !hatHsts)
      ? { ok: true, info: Object.keys(m).filter(k => k.startsWith('H:')).length + ' Kopfzeilen, CSP identisch (' + csp.length + ' Zeichen)' }
      : { ok: false, warum: !csp ? 'keine CSP gelesen' : (hatHsts ? 'HSTS steht drin — eine Anweisung ueber einen Server, den es hier nicht gibt'
          : 'CSP weicht vom Repo ab: ' + csp.slice(0, 60) + ' … vs ' + cspRepo.slice(0, 60)) },
  });
}

// ===========================================================================
// RECHNUNG · Export.java (v33.53) — gegen android.jar 23 uebersetzt und AUSGEFUEHRT
// ===========================================================================
// Zwei Dinge auf einmal: (1) Export.java und Pfade.java uebersetzen mit
// `-bootclasspath android.jar` — eine Methode, die es auf API 23 nicht gibt
// (java.util.Base64, ein Lambda), faellt HIER auf und nicht erst im Paket.
// (2) Der Fahrer (scripts/apk/ExportFahrer.java) ruft die ECHTE Klasse gegen
// Grenzfaelle; je Regel ein guter und ein schlechter Fall.
let KANAL_KLASSEN = null;   // Verzeichnis mit den uebersetzten Klassen fuer den KanalFahrer
function rechnungExport() {
  const NAMEN = ['X0 · Export.java uebersetzt gegen android.jar 23 (kein API ueber 23, kein Lambda)',
    'X1 · Dateinamen: erlaubte Liste, Endung aus dem Katalog, kein Pfad, kein Punkt vorn',
    'X2 · Typen: GESCHLOSSENER Katalog — Drucken nur text/html',
    'X3 · base64url: rund in 300 Faellen, + / Leerzeichen und unmoegliche Laengen abgewiesen',
    'X4 · Abfrage: UTF-8 richtig, kaputte Kodierung und doppelte Schluessel abgewiesen',
    'X5 · Sammler: mehrere Teile → dieselben Bytes in der Spool-Datei, EIN Dialog je Datei',
    'X6 · Sammler: falscher Schluessel, Reihenfolge, Luecke, Ueberlaenge, Deckel — jedes mit eigenem Grund',
    'X7 · Verdraengen nur beim Sammeln — ein offener Dialog wird nie verdraengt, auch nicht mit rueckwaerts laufender Uhr',
    'X8 · Aufraeumen: verwaiste Spool-Dateien gehen, der wartende Vorgang bleibt',
    'X9 · Die Weiche: nur GET, nie Hauptrahmen, nur mit Kopfzeile, nur aus dem eigenen Ursprung — und Unsinn wirft nie',
    'X10 · Der Rueckruf an die Seite: geschlossene Liste, keine Einsetzung von Fremdem',
    'X11 · Die Antwort wiederholt nie, was die Seite geschickt hat; der Schluessel ist zufaellig'];
  if (!WERKZEUGE_DA) {
    NAMEN.forEach(n => F.push({ name: n, r: { offen: true, warum: 'kein javac/java — die Export-Rechnung wurde NICHT ausgefuehrt' } }));
    return;
  }
  const kl = path.join(TMP, 'export-klassen');
  fs.mkdirSync(kl, { recursive: true });
  const quellen = [path.join(ANDROID, 'src/ch/greenscan/app/Pfade.java'), path.join(ANDROID, 'src/ch/greenscan/app/Export.java')];
  const jarDa = fs.existsSync(ANDROID_JAR);
  const args = ['-nowarn', '-encoding', 'UTF-8', '-d', kl].concat(jarDa ? ['-source', '8', '-target', '8', '-bootclasspath', ANDROID_JAR] : []).concat(quellen);
  const jc = spawnSync('javac', args, { encoding: 'utf8' });
  const jcFehler = String(jc.stderr).split('\n').filter(x => x && !/Picked up|warning|bootstrap|source value|target value|^Note:/.test(x));
  if (jc.status !== 0) {
    F.push({ name: NAMEN[0], r: { ok: false, warum: 'uebersetzt nicht' + (jarDa ? ' gegen android.jar 23' : '') + ': ' + (jcFehler[0] || '?') } });
    return;
  }
  F.push({ name: NAMEN[0], r: jarDa ? { ok: true, info: 'Pfade.java + Export.java gegen ' + path.basename(path.dirname(ANDROID_JAR)) + '/android.jar, -source 8' }
                                    : { offen: true, warum: 'android.jar fehlt — mit dem Host-JDK uebersetzt, der API-23-Abgleich ist NICHT geprueft' } });
  const fj = spawnSync('javac', ['-nowarn', '-encoding', 'UTF-8', '-cp', kl, '-d', kl,
    path.join(FAHRER, 'ExportFahrer.java'), path.join(FAHRER, 'KanalFahrer.java')], { encoding: 'utf8' });
  if (fj.status !== 0) {
    F.push({ name: NAMEN[1], r: { ok: false, warum: 'Fahrer uebersetzen nicht: ' + String(fj.stderr).split('\n').filter(x => x && !/Picked up/.test(x))[0] } });
    return;
  }
  KANAL_KLASSEN = kl;
  const spoolDir = path.join(TMP, 'export-spool');
  fs.mkdirSync(spoolDir, { recursive: true });
  const run = spawnSync('java', ['-cp', kl, 'ExportFahrer', spoolDir], { encoding: 'utf8', timeout: 120000 });
  const m = {};
  String(run.stdout).split('\n').forEach(l => { const i = l.indexOf('\t'); if (i > 0) m[l.slice(0, i)] = l.slice(i + 1); });
  if (!Object.keys(m).length) {
    F.push({ name: NAMEN[1], r: { ok: false, warum: 'der Fahrer lieferte nichts: ' + String(run.stderr).split('\n').filter(x => x && !/Picked up/.test(x))[0] } });
    return;
  }
  // Ein Vergleich: erwartete Werte gegen die Ausgabe — mit Liste der Abweichungen.
  const pruef = (erwartet, info) => {
    const falsch = Object.keys(erwartet).filter(k => m[k] !== erwartet[k]);
    return falsch.length ? { ok: false, warum: falsch.map(k => k + ' → ' + m[k] + ' (erwartet ' + erwartet[k] + ')').join(' · ') }
                         : { ok: true, info: info || (Object.keys(erwartet).length + ' Faelle') };
  };
  F.push({ name: NAMEN[1], r: pruef({
    'N:0': 'GreenScan-Backup-2026-10-09.json', 'N:1': 'etc-passwd.txt', 'N:2': 'a-b-c.csv', 'N:3': 'versteckt.json',
    'N:4': 'greenscan-export.png', 'N:5': 'greenscan-export.png', 'N:6': 'bericht.html.csv', 'N:7': 'plan.jpg',
    'N:8': 'Pflanzen-Liste.csv', 'N:9': 'gpj.exe.jpg', 'N:10': 'x'.repeat(80) + '.txt', 'N:11': 'greenscan-export.txt',
    'N:12': 'a-b.txt', 'N:13': 'greenscan-plan-2026-10-09.html',
  }, '14 Namen — Pfad, Steuerzeichen, Schreibrichtungs-Zeichen, Endung, Ueberlaenge') });
  F.push({ name: NAMEN[2], r: pruef({
    'T:0': 'text/csv', 'T:1': 'application/gpx+xml', 'T:2': 'text/html', 'T:3': 'NULL', 'T:4': 'NULL',
    'T:5': 'NULL', 'T:6': 'NULL', 'T:7': 'NULL', 'T:8': 'image/png', 'T:9': 'application/json',
  }) });
  F.push({ name: NAMEN[3], r: pruef({
    'B:rund': '300', 'B:+/+/': 'NULL', 'B:ab+c': 'NULL', 'B:ab/c': 'NULL', 'B:ab c': 'NULL', 'B:A': 'NULL',
    'B:AA': '1', 'B:AB': 'NULL', 'B:AAA=': '2', 'B:AA==': '1', 'B:AA===': 'NULL', 'B:AAAA': '3', 'B:QUJD': '3', 'B:': '0',
  }) });
  F.push({ name: NAMEN[4], r: pruef({
    'U:ue': '\\u00fc', 'U:ff': 'NULL', 'U:prozent': '100% Bio', 'U:roh': 'NULL', 'U:plus': 'a+b', 'U:doppelt': 'NULL', 'U:kaputt': 'NULL',
  }) });
  F.push({ name: NAMEN[5], r: pruef({
    'S:start': '200 ok', 'S:kform': 'true', 'S:teile_ok': 'true', 'S:fertig': '200 ok', 'S:zustand_nach_fertig': 'wartet',
    'S:datei_name': 'x.json', 'S:datei_typ': 'application/json', 'S:gleich': 'true', 'S:fertig2': '200 id',
    'S:teil_nach_fertig': '200 id', 'S:abschliessen': 'true', 'S:spool_weg': 'true', 'S:zustand_frei': 'frei',
  }, '700 000 Bytes in 4 Teilen, byte-gleich in der Spool-Datei; zweites „fertig" abgewiesen; Spool nach dem Abschluss weg') });
  F.push({ name: NAMEN[6], r: pruef({
    'F:falscher_k': '200 schluessel', 'F:ohne_k': '200 schluessel', 'F:reihenfolge': '200 teil', 'F:zustand_bleibt': 'sammeln',
    'F:teil0': '200 ok', 'F:doppelt': '200 teil', 'F:fehlt': '200 unvollstaendig', 'F:fehlt_frei': 'frei', 'F:fehlt_spool': 'false',
    'F:zu_lang': '200 laenge', 'F:zu_lang_frei': 'frei', 'F:kaputt_kodiert': '200 kodierung', 'F:kaputt_bleibt': 'sammeln',
    'F:zu_gross_speichern': '200 zu_gross', 'F:zu_gross_drucken': '200 zu_gross', 'F:drucken_max_ok': '200 ok',
    'F:teile_null': '200 teile', 'F:teile_zuviel': '200 teile', 'F:teile_tragen_nicht': '200 teile',
    'F:id': '200 id', 'F:ziel': '200 ziel', 'F:typ': '200 typ', 'F:drucken_csv': '200 typ',
  }) });
  F.push({ name: NAMEN[7], r: pruef({
    'V:b_bei_60000': '200 beschaeftigt', 'V:b_bei_60001': '200 ok', 'V:a_spool_weg': 'true', 'V:a_teil': '200 id',
    'V:a_abschliessen': 'false', 'V:b_lebt': 'sammeln/verdraengt000002', 'V:b_fertig': '200 ok',
    'V:c_wartet_60001': '200 beschaeftigt', 'V:c_wartet_600000': '200 beschaeftigt', 'V:c_wartet_600001': '200 ok',
    'V:uhr_zurueck_sammeln': '200 ok', 'V:uhr_zurueck_wartet': '200 beschaeftigt',
  }, 'Grenzen auf die Millisekunde: 60 000 / 60 001 beim Sammeln, 600 000 / 600 001 beim Warten') });
  F.push({ name: NAMEN[8], r: pruef({ 'A:geloescht': '2', 'A:uebrig': 'jung0000aaaa.part,keep0000aaaa.part' }) });
  F.push({ name: NAMEN[9], r: pruef({
    'W:haupt': '403 herkunft', 'W:ohne_kopf': '403 herkunft', 'W:kopf_gross': '403 herkunft', 'W:referer_fremd': '403 herkunft',
    'W:origin_null': '403 herkunft', 'W:post': '405 methode', 'W:options': '405 methode', 'W:pfad': '404 pfad',
    'W:null_kopf': '403 herkunft', 'W:null_sammler': '200 huelle', 'W:gut': '200 ok', 'W:teil': '200 ok',
    'W:fertig': '200 ok mit Datei probe.txt', 'W:unsinn_geworfen': '0', 'W:unsinn_status_fremd': '0',
  }, '12 Riegel-Faelle, ein ganzer Weg durch die Weiche, 3000 Unsinns-Anfragen ohne eine Ausnahme') });
  F.push({ name: NAMEN[10], r: pruef({
    'R:gut': "window.gsHuelleDateiErgebnis && window.gsHuelleDateiErgebnis('abcdefgh12345678','gespeichert');",
    'R:id_boese': 'NULL', 'R:zustand_boese': 'NULL', 'R:zustand_fremd': 'NULL',
  }) });
  F.push({ name: NAMEN[11], r: pruef({ 'J:start': 'true', 'J:typ': '{"huelle":1,"ok":false,"grund":"typ"}', 'K:verschieden': 'true' }) });
}

// ===========================================================================
// PAKET · build.sh wirklich laufen lassen und im APK nachsehen
// ===========================================================================
function paket() {
  if (!BAU_DA) {
    const w = { offen: true, warum: 'Android-Werkzeuge fehlen (aapt/zipalign/apksigner/dexer/android.jar) — das Paket wurde NICHT gebaut. '
      + 'Auf Debian/Ubuntu: apt-get install -y android-sdk-build-tools android-sdk-platform-23 dalvik-exchange' };
    ['B1 · Die Liste ist das Paket: alles, was die App vom eigenen Ursprung laedt, liegt darin',
     'B2 · Das Paket enthaelt die ECHTEN Dateien (byte-gleich)',
     'B3 · Die Version ist EINE Zahl — GS_VERSION steht im Paket',
     'B4 · targetSdk laesst sich auf einem aktuellen Telefon installieren'].forEach(n => F.push({ name: n, r: w }));
    return null;
  }
  const bau = spawnSync('bash', [path.join(ANDROID, 'build.sh')], { encoding: 'utf8', cwd: WURZEL, timeout: 600000 });
  const apk = (String(bau.stdout).match(/(\S+greenscan-\S+\.apk)/) || [])[1];
  if (bau.status !== 0 || !apk || !fs.existsSync(apk)) {
    const w = { ok: false, warum: 'build.sh ist fehlgeschlagen: ' + String(bau.stdout + bau.stderr).split('\n').filter(Boolean).slice(-2).join(' | ') };
    F.push({ name: 'B2 · Das Paket enthaelt die ECHTEN Dateien (byte-gleich)', r: w });
    return null;
  }
  const liste = String(spawnSync('unzip', ['-Z1', apk], { encoding: 'utf8' }).stdout).split('\n').filter(Boolean);
  const imPaket = new Set(liste.filter(x => x.startsWith('assets/www/')).map(x => x.slice('assets/www/'.length)));

  // B1 — was laedt die App vom EIGENEN Ursprung?
  const gebraucht = new Set();
  const roh = QUELLE_OHNE.match(/(?:src|href)="((?!https?:|data:|blob:|javascript:|mailto:|#)[^"]+)"/g) || [];
  roh.forEach(t => {
    let u = t.replace(/^(?:src|href)="/, '').replace(/"$/, '').split('?')[0].split('#')[0];
    u = u.replace(/^\.?\//, '');
    if (!u || u.indexOf('{') >= 0 || u.indexOf('$') >= 0) return;
    if (!/\.(js|css|png|svg|json|html|webp|jpg|jpeg|ico|woff2?)$/i.test(u)) return;
    gebraucht.add(u);
  });
  // Und was der Service Worker als Schale vorlaedt (SHELL_URLS) — das ist die
  // Liste, die im Web „offline verfuegbar" bedeutet. Im Paket muss sie erst
  // recht drin sein.
  const SW = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  const shell = (SW.match(/const SHELL_URLS = \[([\s\S]*?)\];/) || ['', ''])[1];
  (shell.match(/'\/([^']+)'/g) || []).forEach(t => {
    const u = t.slice(2, -1).split('?')[0];
    if (u && u !== 'index.html') gebraucht.add(u);
  });
  const fehlen = [...gebraucht].filter(u => !imPaket.has(u) && !imPaket.has(u.replace(/^\//, '')));
  F.push({
    name: 'B1 · Die Liste ist das Paket: alles, was die App vom eigenen Ursprung laedt, liegt darin',
    r: fehlen.length ? { ok: false, warum: fehlen.length + ' Datei(en) fehlen im Paket — ohne Empfang sind sie weg: ' + fehlen.slice(0, 6).join(', ') }
                     : { ok: true, info: gebraucht.size + ' gebrauchte Dateien, ' + imPaket.size + ' im Paket' },
  });

  // B2 — byte-gleich, nicht „sieht aus wie"
  const proben = ['index.html', 'data/plants.v1.js', 'sw.js', '_headers', 'manifest.json'];
  const ungleich = proben.filter(f => {
    if (!imPaket.has(f)) return true;
    const aus = spawnSync('unzip', ['-p', apk, 'assets/www/' + f], { maxBuffer: 1 << 28 });
    return md5(aus.stdout) !== md5(fs.readFileSync(path.join(WURZEL, f)));
  });
  F.push({
    name: 'B2 · Das Paket enthaelt die ECHTEN Dateien (byte-gleich)',
    r: ungleich.length ? { ok: false, warum: ungleich.join(', ') + ' fehlen oder weichen ab' }
                       : { ok: true, info: proben.length + ' Proben byte-gleich · ' + Math.round(fs.statSync(apk).size / 1048576 * 10) / 10 + ' MB APK' },
  });

  // B3/B4 — was das Paket ueber sich SAGT
  const badging = String(spawnSync('aapt', ['dump', 'badging', apk], { encoding: 'utf8' }).stdout);
  const vName = (badging.match(/versionName='([^']*)'/) || [])[1];
  const vCode = parseInt((badging.match(/versionCode='([^']*)'/) || [])[1], 10);
  const pkg = (badging.match(/package: name='([^']*)'/) || [])[1];
  const tgt = parseInt((badging.match(/targetSdkVersion:'([^']*)'/) || [])[1], 10);
  const min = parseInt((badging.match(/sdkVersion:'([^']*)'/) || [])[1], 10);
  const roheV = GS_VERSION.replace(/^v/, '');
  const soll = parseInt(roheV.split('.')[0], 10) * 1000 + parseInt(roheV.split('.')[1], 10);
  const assetlinksPkg = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(WURZEL, '.well-known/assetlinks.json'), 'utf8'))[0].target.package_name; }
    catch (_) { return null; }
  })();
  F.push({
    name: 'B3 · Die Version ist EINE Zahl — GS_VERSION steht im Paket, und der Paketname passt zu assetlinks',
    r: (vName === roheV && vCode === soll && pkg === assetlinksPkg)
      ? { ok: true, info: pkg + ' · ' + vName + ' · Code ' + vCode }
      : { ok: false, warum: 'versionName ' + vName + ' (erwartet ' + roheV + ') · versionCode ' + vCode + ' (erwartet ' + soll + ') · package ' + pkg + ' vs assetlinks ' + assetlinksPkg },
  });
  F.push({
    name: 'B4 · targetSdk laesst sich auf einem aktuellen Telefon installieren',
    r: (tgt >= 24 && min >= 23)
      ? { ok: true, info: 'minSdk ' + min + ' (Laufzeitrechte ab 23) · targetSdk ' + tgt }
      : { ok: false, warum: 'minSdk ' + min + ' / targetSdk ' + tgt + ' — Android 14 verweigert die Installation unter targetSdk 23, Android 15 unter 24' },
  });
  return apk;
}

// ===========================================================================
// RAND · der Quelltext der Huelle
// ===========================================================================
function rand() {
  // R1 — die eine Regel, die das ganze Stueck traegt.
  const rumpf = (ohneKommentare(ASSETSERVER).match(/WebResourceResponse beantworte\(Uri u[^)]*\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  // NACH der ganzen Waechterzeile schneiden, nicht am Aufruf: das `return null`
  // fuer FREMDE Urspruenge steht auf derselben Zeile und ist genau richtig —
  // ein Schnitt am Aufruf zaehlt es mit und meldet den gesunden Fall.
  const nachTor = rumpf.split(/if \(!imUrsprung\(u\)\) return null;/)[1] || '';
  const nulls = (nachTor.match(/return null;/g) || []).length;
  const hat404 = /vierNullVier\(\)/.test(nachTor);
  F.push({
    name: 'R1 · Fuer den EIGENEN Ursprung nie null — sonst holt die WebView es aus dem Netz',
    r: (nulls === 0 && hat404)
      ? { ok: true, info: 'nach dem Ursprungs-Tor kein return null, dafuer eine echte 404 aus dem Paket' }
      : { ok: false, warum: nulls + '× `return null` nach dem Ursprungs-Tor' + (hat404 ? '' : ' und keine 404-Antwort') },
  });

  // R2 — keine Bruecke, keine Datei-Tueren.
  const MAINACT_OHNE = ohneKommentare(MAINACT);
  const bruecken = (MAINACT_OHNE.match(/addJavascriptInterface/g) || []).length;
  const aus = ['setAllowFileAccess(false)', 'setAllowContentAccess(false)',
               'setAllowFileAccessFromFileURLs(false)', 'setAllowUniversalAccessFromFileURLs(false)',
               'setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW)'];
  const offen2 = aus.filter(a => MAINACT_OHNE.indexOf(a) < 0);
  F.push({
    name: 'R2 · Keine Bruecke nach Android, keine Tuer zu den Dateien des Geraets',
    r: (bruecken === 0 && offen2.length === 0)
      ? { ok: true, info: '0× addJavascriptInterface · ' + aus.length + ' Riegel gesetzt' }
      : { ok: false, warum: (bruecken ? bruecken + '× addJavascriptInterface · ' : '') + (offen2.length ? 'fehlt: ' + offen2.join(', ') : '') },
  });

  // R3 — dieselbe Marke auf beiden Seiten. Zwei Schreibweisen waeren eine
  // Huelle, die sich anmeldet, und eine App, die sie nicht erkennt.
  const javaMarke = (ohneKommentare(MAINACT).match(/UA_MARKE\s*=\s*"([^"]+)"/) || [])[1];
  const jsMarke = (QUELLE.match(/var GS_HUELLE_MARKE\s*=\s*'([^']+)'/) || [])[1];
  F.push({
    name: 'R3 · Huelle und App meinen dieselbe Marke',
    r: (javaMarke && javaMarke === jsMarke)
      ? { ok: true, info: javaMarke }
      : { ok: false, warum: 'MainActivity: ' + javaMarke + ' · index.html: ' + jsMarke },
  });

  // R4 — jede Berechtigung hat einen Anlass, und jeder Anlass eine Berechtigung.
  const rechte = (MANIFEST.match(/uses-permission android:name="android\.permission\.([A-Z_]+)"/g) || [])
    .map(x => x.replace(/.*permission\./, '').replace(/"$/, ''));
  const brauchtKamera = /getUserMedia\s*\(/.test(QUELLE_OHNE);
  const brauchtOrt = /navigator\.geolocation/.test(QUELLE_OHNE);
  const fehlend = [];
  if (brauchtKamera && rechte.indexOf('CAMERA') < 0) fehlend.push('CAMERA (die App ruft getUserMedia)');
  if (brauchtOrt && !rechte.some(r => /LOCATION/.test(r))) fehlend.push('ACCESS_*_LOCATION (die App ruft navigator.geolocation)');
  // Und die Gegenrichtung: eine Berechtigung, die keinen Anlass hat, ist eine
  // Frage zu viel an die Person.
  const ANLASS = { INTERNET: true, ACCESS_NETWORK_STATE: true, CAMERA: brauchtKamera,
    ACCESS_FINE_LOCATION: brauchtOrt, ACCESS_COARSE_LOCATION: brauchtOrt };
  const grundlos = rechte.filter(r => !ANLASS[r]);
  F.push({
    name: 'R4 · Jede Berechtigung hat einen Anlass in der App — und jeder Anlass eine Berechtigung',
    r: (!fehlend.length && !grundlos.length)
      ? { ok: true, info: rechte.length + ' Berechtigungen: ' + rechte.join(', ') }
      : { ok: false, warum: (fehlend.length ? 'fehlt: ' + fehlend.join(' · ') : '') + (grundlos.length ? ' ohne Anlass: ' + grundlos.join(', ') : '') },
  });

  // R5 — die drei Berechtigungs-Rueckrufe. Ohne sie tut eine WebView NICHTS,
  // und zwar lautlos: kein Fehler, kein Bild, kein Standort, kein Dateifeld.
  const rueckrufe = [
    ['onPermissionRequest', 'getUserMedia (der Scanner)'],
    ['onGeolocationPermissionsShowPrompt', 'navigator.geolocation'],
    ['onShowFileChooser', '<input type="file">'],
  ];
  const ohne = rueckrufe.filter(([m]) => MAINACT_OHNE.indexOf(m) < 0);
  F.push({
    name: 'R5 · Die drei Rueckrufe, ohne die eine WebView lautlos nichts tut',
    r: ohne.length ? { ok: false, warum: 'fehlt: ' + ohne.map(x => x[0] + ' → ' + x[1]).join(' · ') }
                   : { ok: true, info: rueckrufe.map(x => x[0]).join(', ') },
  });

  // R6 — der Zurueck-Knopf geht an den VERLAUF, nicht an eine eigene Regel.
  // Eine zweite Regel wuesste nichts von GS_VOLLBILD_OVERLAYS (v33.43).
  const zurueck = (MAINACT_OHNE.match(/public void onBackPressed\(\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  F.push({
    name: 'R6 · Der Zurueck-Knopf geht an den Verlauf — und damit an gsZurueck()',
    r: (/canGoBack\(\)/.test(zurueck) && /goBack\(\)/.test(zurueck) && /super\.onBackPressed\(\)/.test(zurueck))
      ? { ok: true, info: 'canGoBack → goBack → popstate → gsZurueck; sonst verlaesst er die App' }
      : { ok: false, warum: 'onBackPressed rechnet selbst statt den Verlauf zu fragen: ' + zurueck.replace(/\s+/g, ' ').slice(0, 120) },
  });

  // R9 — EIN Leser fuer die Registrierung. `navigator.serviceWorker.ready` ist
  // eine Zusage, die ohne registrierten Worker NIE zurueckkommt; fuenf Stellen
  // warteten darauf, der Test-Push haette fuer immer „⏳ Sende …" gezeigt.
  const readyRoh = (QUELLE_CODE.match(/navigator\.serviceWorker\.ready/g) || []).length;
  const leserRumpf = (QUELLE_CODE.match(/async function _gsSwReady\(\) \{([\s\S]*?)\n\}/) || ['', ''])[1];
  const imLeser = (leserRumpf.match(/navigator\.serviceWorker\.ready/g) || []).length;
  F.push({
    name: 'R9 · serviceWorker.ready hat EINEN Leser — sonst haengt ein await fuer immer',
    r: (imLeser >= 1 && readyRoh === imLeser)
      ? { ok: true, info: '_gsSwReady ist der einzige Leser (' + imLeser + '× darin, 0× daneben)' }
      : { ok: false, warum: (readyRoh - imLeser) + ' rohe Zugriffe ausserhalb von _gsSwReady' + (imLeser ? '' : ' — und der Leser liest selbst nicht') },
  });

  // R10 — die NAHT zwischen Huelle und App. Eine WebView feuert beim Beenden
  // der Activity weder pagehide noch beforeunload; ohne diesen Anstoss geht die
  // letzte Aenderung verloren, sobald jemand die App wegwischt.
  const rufImJava = /evaluateJavascript\("window\.gsHuellePause/.test(MAINACT_OHNE)
    && /protected void onPause\(\)[\s\S]{0,400}?gsHuellePause/.test(MAINACT_OHNE);
  const funktionInApp = /function gsHuellePause\(\)/.test(QUELLE_CODE)
    && /new Event\('pagehide'\)/.test((QUELLE_CODE.match(/function gsHuellePause\(\)[\s\S]{0,400}/) || [''])[0]);
  F.push({
    name: 'R10 · Beim Verlassen sichert die App — die Huelle ruft, die App hoert (beide Haelften)',
    r: (rufImJava && funktionInApp)
      ? { ok: true, info: 'onPause → gsHuellePause() → pagehide (kein sechster Sicherungsweg neben den fuenf)' }
      : { ok: false, warum: (!rufImJava ? 'die Huelle ruft nicht in onPause' : '') + (!funktionInApp ? ' die App hat kein gsHuellePause, das pagehide ausloest' : '') },
  });

  // R11 — der Netzzustand. Er wird in einer WebView NICHT von selbst gepflegt.
  F.push({
    name: 'R11 · Die Huelle treibt navigator.onLine — sonst steht die App im Wald auf „online"',
    r: (/setNetworkAvailable/.test(MAINACT_OHNE) && /registerNetworkCallback/.test(MAINACT_OHNE)
        && /ACCESS_NETWORK_STATE/.test(MANIFEST))
      ? { ok: true, info: 'NetworkCallback → setNetworkAvailable, Berechtigung erklaert' }
      : { ok: false, warum: 'setNetworkAvailable oder registerNetworkCallback fehlt — ' +
          (QUELLE_CODE.match(/navigator\.onLine/g) || []).length + ' Stellen der App fragen navigator.onLine' },
  });

  // ---------------------------------------------------------------- v33.53
  // R12 — die Weiche im Rand: der Kanal kommt VOR der Suche im Paket, bekommt
  // die KODIERTE Adresse (doppelt dekodiert wuerde „100%25" zu „abfrage"),
  // Methode, Hauptrahmen und Kopfzeilen aus der echten Anfrage, eine
  // monotone Uhr — und eine Ausnahme dort beendet die App nie.
  const AS_OHNE = ohneKommentare(ASSETSERVER);
  const asRumpf = (AS_OHNE.match(/WebResourceResponse beantworte\(Uri u[^)]*\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  const iKanal = asRumpf.indexOf('startsWith(Export.WURZEL)');
  const iPaket = asRumpf.indexOf('pfadNormieren(');
  const kanalRumpf = (AS_OHNE.match(/private WebResourceResponse kanal\(Export\.Antwort a\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  const r12 = [];
  if (!(iKanal > 0 && iPaket > iKanal)) r12.push('der Kanal steht nicht VOR der Suche im Paket');
  if (!/u\.getEncodedPath\(\)/.test(asRumpf) || !/u\.getEncodedQuery\(\)/.test(asRumpf)) r12.push('nicht die KODIERTE Adresse (getEncodedPath/getEncodedQuery)');
  if (!/SystemClock\.elapsedRealtime\(\)/.test(asRumpf)) r12.push('keine monotone Uhr (SystemClock.elapsedRealtime)');
  if (/return null;/.test(kanalRumpf) || !/new WebResourceResponse\(/.test(kanalRumpf)) r12.push('der Kanal-Zweig gibt null oder keine Antwort zurueck');
  if (!/catch \(Throwable/.test(kanalRumpf)) r12.push('kanal() faengt keine Ausnahme');
  if (!/anfrage\.getMethod\(\), anfrage\.isForMainFrame\(\),\s*anfrage\.getRequestHeaders\(\)/.test(MAINACT_OHNE)) r12.push('MainActivity reicht Methode/Hauptrahmen/Kopfzeilen nicht durch');
  F.push({
    name: 'R12 · Die Weiche im Rand: Kanal vor dem Paket, kodierte Adresse, echte Anfrage, monotone Uhr, nie eine Ausnahme',
    r: r12.length ? { ok: false, warum: r12.join(' · ') } : { ok: true, info: 'imUrsprung → Export.WURZEL → pfadNormieren; kanal() faengt Throwable' },
  });

  // R13 — die Druckansicht als geschlossener Kasten, gemessen an IHRER Klasse
  // (R2 sucht die Riegel in MainActivity und saehe die der App-WebView).
  const DR = ohneKommentare(DRUCK_JAVA);
  const r13 = [];
  ['s.setJavaScriptEnabled(false)', 's.setBlockNetworkLoads(true)', 's.setAllowFileAccess(false)', 's.setAllowContentAccess(false)',
   's.setAllowFileAccessFromFileURLs(false)', 's.setAllowUniversalAccessFromFileURLs(false)', 's.setDomStorageEnabled(false)']
    .forEach(x => { if (DR.indexOf(x) < 0) r13.push('fehlt: ' + x); });
  if (!/shouldOverrideUrlLoading\(WebView v, String url\) \{ return true; \}/.test(DR)) r13.push('sie darf navigieren (meta refresh wirkt auch ohne JavaScript)');
  const druckIntercept = (DR.match(/shouldInterceptRequest\(WebView v, WebResourceRequest r\) \{([\s\S]*?)\n      \}/) || ['', ''])[1];
  if (!/"data"\.equalsIgnoreCase/.test(druckIntercept) || (druckIntercept.match(/return null;/g) || []).length !== 1 || !/new WebResourceResponse\(/.test(druckIntercept)) r13.push('Unteranfragen gehen nicht alle ins Leere (nur data: darf durch)');
  if (!/loadDataWithBaseURL\(null,/.test(DR)) r13.push('Grundadresse ist nicht null — das Dokument laege im Ursprung der App');
  if (!/if \(gedruckt\) return;/.test(DR)) r13.push('kein Einmal-Riegel: ein zweites onPageFinished druckte noch einmal');
  if (!/activity\.getSystemService\(Context\.PRINT_SERVICE\)/.test(DR)) r13.push('PrintManager nicht von der Activity');
  if (!/onFinish\(\) \{\s*try \{ innen\.onFinish\(\); \} finally \{ wegraeumen\(\); \}/.test(DR)) r13.push('die Ansicht wird nach dem Druck nicht abgeraeumt');
  if (/addJavascriptInterface/.test(DR) || /AssetServer|beantworte\(/.test(DR)) r13.push('die Druckansicht hat eine Bruecke oder fragt den Paket-Server');
  F.push({
    name: 'R13 · Die Druckansicht ist ein geschlossener Kasten: kein JavaScript, kein Netz, keine Navigation, Grundadresse null, einmal drucken',
    r: r13.length ? { ok: false, warum: r13.join(' · ') } : { ok: true, info: '7 Riegel in DruckAnsicht.java, Unteranfragen leer ausser data:, onFinish raeumt ab' },
  });

  // R14 — „Speichern unter": eigener Anfrage-Code, „wt" vor „w", leere Datei
  // wird geloescht, geschrieben wird nicht auf dem UI-Faden, ein Dialog nur
  // von vorne, und die Kennung ueberlebt eine neue Activity.
  const r14 = [];
  const codes = [...MAINACT_OHNE.matchAll(/static final int (ANFRAGE_[A-Z]+) = (\d+);/g)].map(x => [x[1], x[2]]);
  const nummern = codes.map(x => x[1]);
  if (!codes.some(x => x[0] === 'ANFRAGE_SPEICHERN') || new Set(nummern).size !== nummern.length) r14.push('kein eigener Anfrage-Code fuer den Dialog');
  if (!/Intent\.ACTION_CREATE_DOCUMENT/.test(MAINACT_OHNE) || !/CATEGORY_OPENABLE/.test(MAINACT_OHNE)) r14.push('kein ACTION_CREATE_DOCUMENT/CATEGORY_OPENABLE');
  const iWt = MAINACT_OHNE.indexOf('openOutputStream(ziel, "wt")'), iW = MAINACT_OHNE.indexOf('openOutputStream(ziel, "w")');
  if (!(iWt > 0 && iW > iWt)) r14.push('nicht zuerst "wt" (beim Ersetzen bliebe der Rest der alten Datei stehen)');
  const schreiben = (MAINACT_OHNE.match(/private String schreiben\(Uri ziel, File spool, long bytes\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
  if (!/if \(!Export\.spoolPasst\(spool, bytes\)\) \{ dokumentLoeschen\(ziel\); return "fehler"; \}/.test(schreiben)) r14.push('fehlende Spool-Datei loescht das angelegte Dokument nicht');
  if (!/new Thread\(new Runnable\(\) \{\s*@Override public void run\(\) \{ abschluss\(id, schreiben\(ziel, spool, bytes\)\); \}/.test(MAINACT_OHNE)) r14.push('geschrieben wird nicht auf einem eigenen Faden');
  if (!/if \(!vorne\) \{ ausstehend = d; return; \}/.test(MAINACT_OHNE)) r14.push('ein Dialog kann aus dem Hintergrund starten (Android 10+ verwirft ihn still)');
  if (!/catch \(ActivityNotFoundException e\) \{\s*wartetId = null; wartetBytes = 0;\s*abschluss\(d\.id, "fehler"\);/.test(MAINACT_OHNE)) r14.push('kein Dialog-Programm → kein Ergebnis an die Seite');
  if (!/b\.putString\("gs_export_id", wartetId\)/.test(MAINACT_OHNE) || !/zustand\.getString\("gs_export_id"\)/.test(MAINACT_OHNE)) r14.push('die Kennung ueberlebt keine neue Activity');
  if (!/if \(ziel != null\) dokumentLoeschen\(ziel\);/.test(MAINACT_OHNE)) r14.push('ein Ergebnis ohne Vorgang laesst das leere Dokument stehen');
  F.push({
    name: 'R14 · „Speichern unter": eigener Code, "wt" vor "w", nie eine leere Datei, Schreiben im Hintergrund, Dialog nur von vorne',
    r: r14.length ? { ok: false, warum: r14.join(' · ') } : { ok: true, info: codes.map(x => x[0] + '=' + x[1]).join(', ') },
  });

  // R15 — genau ZWEI Stellen fuehren JavaScript in der Seite aus: der
  // Pausen-Anstoss und der Rueckruf — und der Rueckruf kommt aus
  // Export.rueckruf (geprueft), nie aus einer zusammengesetzten Zeichenkette.
  const evals = (MAINACT_OHNE.match(/evaluateJavascript\(/g) || []).length;
  const evalsAndere = [AS_OHNE, DR, ohneKommentare(EXPORT_JAVA)].map(t => (t.match(/evaluateJavascript\(/g) || []).length).reduce((x, y) => x + y, 0);
  const rueckrufWeg = /final String js = Export\.rueckruf\(id, zustand\);\s*if \(js == null \|\| web == null\) return;/.test(MAINACT_OHNE)
    && /web\.evaluateJavascript\(js, /.test(MAINACT_OHNE);
  F.push({
    name: 'R15 · Genau zwei Stellen fuehren JavaScript aus — der Rueckruf nur aus Export.rueckruf',
    r: (evals === 2 && evalsAndere === 0 && rueckrufWeg)
      ? { ok: true, info: 'gsHuellePause + Export.rueckruf, sonst keine' }
      : { ok: false, warum: evals + '× evaluateJavascript in MainActivity, ' + evalsAndere + '× anderswo' + (rueckrufWeg ? '' : ' · der Rueckruf kommt nicht (nur) aus Export.rueckruf') },
  });

  // R16 — die NAHT: was Java und JavaScript voneinander erwarten, steht auf
  // beiden Seiten gleich da. Eine Umbenennung auf einer Seite liesse jeden
  // Export bis zur Frist haengen, ohne dass irgendetwas einen Fehler meldet.
  const EX = ohneKommentare(EXPORT_JAVA);
  const jv = (re) => (EX.match(re) || [])[1];
  const js = (re) => (QUELLE_CODE.match(re) || [])[1];
  const zahlJ = (s) => s == null ? NaN : Function('return (' + s.replace(/L/g, '') + ')')();
  const naht = [];
  if (jv(/WURZEL = "([^"]+)"/) !== js(/var GS_HUELLE_KANAL = '([^']+)'/)) naht.push('Kanal-Adresse: Java ' + jv(/WURZEL = "([^"]+)"/) + ' · JS ' + js(/var GS_HUELLE_KANAL = '([^']+)'/));
  const kopfJ = jv(/KOPF = "([^"]+)"/), wertJ = jv(/KOPF_WERT = "([^"]+)"/);
  if (!new RegExp("headers: \\{ '" + kopfJ + "': '" + wertJ + "' \\}").test(QUELLE_CODE)) naht.push('Kopfzeile ' + kopfJ + ': ' + wertJ + ' setzt die Seite nicht');
  if (zahlJ(jv(/MAX_BYTES = ([^;]+);/)) !== zahlJ(js(/var GS_HUELLE_DATEI_MAX = ([^;]+);/))) naht.push('Datei-Deckel verschieden');
  if (zahlJ(jv(/MAX_DRUCK_BYTES = ([^;]+);/)) !== zahlJ(js(/var GS_HUELLE_DRUCK_MAX = ([^;]+);/))) naht.push('Druck-Deckel verschieden');
  if (zahlJ(jv(/DIALOG_VERWAIST_MS = ([^;]+);/)) !== zahlJ(js(/var GS_HUELLE_ANTWORT_MS = ([^;]+);/))) naht.push('Frist fuer den Dialog verschieden');
  if (!(zahlJ(js(/var GS_HUELLE_TEIL = ([^;]+);/)) <= zahlJ(jv(/MAX_TEIL_BYTES = ([^;]+);/)))) naht.push('ein Teil der Seite ist groesser als Export.MAX_TEIL_BYTES');
  const rueckName = (EX.match(/window\.(gs\w+) && window\.\1\(/) || [])[1];
  if (!rueckName || !new RegExp('function ' + rueckName + '\\(id, zustand\\)').test(QUELLE_CODE)) naht.push('der Rueckruf ' + rueckName + ' hat in der Seite keine Funktion');
  const zustaende = [...(EX.match(/static boolean zustandOk\(String z\) \{([\s\S]*?)\n  \}/) || ['', ''])[1].matchAll(/"([a-z_]+)"\.equals/g)].map(x => x[1]);
  const angekommen = (QUELLE_CODE.match(/function _gsDateiAngekommen\(r\) \{([\s\S]*?)\n\}/) || ['', ''])[1];
  const nicht = (QUELLE_CODE.match(/function _gsDateiNichtGespeichert\(r, art\) \{([\s\S]*?)\n\}/) || ['', ''])[1];
  const unbedacht = zustaende.filter(z => angekommen.indexOf("'" + z + "'") < 0 && nicht.indexOf("'" + z + "'") < 0 && z !== 'fehler');
  if (zustaende.length < 4 || unbedacht.length) naht.push('Zustaende ohne Lesart in der Seite: ' + (unbedacht.join(', ') || 'Liste nicht gelesen'));
  const paramJ = [...new Set([...EX.matchAll(/q\.get\("([a-z]+)"\)/g)].map(x => x[1]))].sort();
  const paramSeite = [...(QUELLE_CODE.match(/async function _gsHuelleDatei\([\s\S]*?\n\}/) || [''])[0].matchAll(/\{ ([a-z]+: [^}]+) \}/g)]
    .map(x => x[1]).join(', ').match(/\b([a-z]+):/g) || [];
  const gesendet = new Set(paramSeite.map(x => x.slice(0, -1)));
  const ungesendet = paramJ.filter(x => !gesendet.has(x));
  if (paramJ.length < 8 || ungesendet.length) naht.push('Java liest Parameter, die die Seite nicht sendet: ' + (ungesendet.join(', ') || 'Liste nicht gelesen'));
  F.push({
    name: 'R16 · Die Naht: Adresse, Kopfzeile, Deckel, Frist, Rueckruf, Zustaende und Parameter stehen auf beiden Seiten gleich',
    r: naht.length ? { ok: false, warum: naht.join(' · ') }
                   : { ok: true, info: paramJ.length + ' Parameter (' + paramJ.join(',') + '), ' + zustaende.length + ' Zustaende, Rueckruf ' + rueckName },
  });

  // R8 — die LISTE ist die Pruefung: ein Eintrag ohne Durchsetzung waere eine
  // Behauptung, eine Durchsetzung ohne Eintrag eine Aenderung, die niemand
  // erklaert bekommt. Gemessen wird der kommentarfreie Quelltext NICHT — die
  // Durchsetzungsstelle traegt ihre Kennung bewusst IM Kommentar, damit sie
  // beim Lesen auffindbar ist; gezaehlt wird darum im Originaltext.
  const andersSchl = [...QUELLE.matchAll(/schl:\s*'([a-z_]+)',\s*\n\s*titel:/g)].map(m => m[1]);
  const ohneStelle = andersSchl.filter(k => {
    const n = (QUELLE.match(new RegExp("GS_HUELLE_ANDERS '" + k + "'", 'g')) || []).length;
    return n < 1;
  });
  F.push({
    name: 'R8 · Die Liste ist die Pruefung: jeder Eintrag in GS_HUELLE_ANDERS hat eine Durchsetzungsstelle',
    r: (andersSchl.length >= 3 && !ohneStelle.length)
      ? { ok: true, info: andersSchl.length + ' Eintraege: ' + andersSchl.join(', ') }
      : { ok: false, warum: andersSchl.length < 3 ? 'nur ' + andersSchl.length + ' Eintraege gefunden — liest die Suche die Liste noch?'
          : 'ohne Durchsetzung: ' + ohneStelle.join(', ') },
  });

  // R7 — der Schluessel verlaesst das Repo nicht.
  const imRepo = spawnSync('git', ['ls-files', 'android'], { cwd: WURZEL, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const schluessel = imRepo.filter(f => /\.(keystore|jks|p12|pem|key)$/i.test(f));
  const ignoriert = fs.readFileSync(path.join(WURZEL, '.gitignore'), 'utf8');
  F.push({
    name: 'R7 · Kein Signatur-Schluessel im Repo, und das Bauverzeichnis ist ignoriert',
    r: (!schluessel.length && /android\/\.keystore-dev\//.test(ignoriert) && /android\/build\//.test(ignoriert)
        && /GS_APK_KS/.test(BUILDSH))
      ? { ok: true, info: 'Schluessel kommt aus GS_APK_KS, der Wegwerf-Schluessel ist ignoriert' }
      : { ok: false, warum: schluessel.length ? 'im Repo: ' + schluessel.join(', ') : 'android/build/ oder android/.keystore-dev/ steht nicht in .gitignore' },
  });
}

// ===========================================================================
// APP · Playwright ueber HTTP, mit und ohne die Kennung der Huelle
// ===========================================================================
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function server() {
  return new Promise((fertig) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const datei = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
        res.writeHead(404); res.end('nicht da'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
        'Service-Worker-Allowed': '/' });
      fs.createReadStream(datei).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => fertig({ s, port: s.address().port }));
  });
}

// ===========================================================================
// APP · der Kanal (v33.53) — die Seite spricht mit der ECHTEN Java-Rechnung
// ===========================================================================
// Die Huelle-Fahrt laeuft unter dem ECHTEN Ursprung https://green-scan.ch
// (geroutet, mit den Kopfzeilen aus _headers — also mit der CSP), und jede
// Anfrage an /__huelle/datei/ geht unveraendert an einen Java-Prozess mit dem
// echten Export.Sammler (scripts/apk/KanalFahrer.java). Keine Nachbildung des
// Sammlers in JavaScript: die waere eine zweite Regel, die eine Seite
// annimmt, die die echte abweist (Attrappe statt Ware, v33.00).
//
// Nur der RAND ist gestellt — der Dialog „Speichern unter" bzw. der
// Druckdialog. Node entscheidet, was die Person darin tut, und liefert das
// Ergebnis mit genau der Zeichenkette zurueck, die Export.rueckruf baut.

function kopfzeilenAusHeaders() {
  const roh = fs.readFileSync(path.join(WURZEL, '_headers'), 'utf8').split('\n');
  const h = {}; let drin = false;
  for (const z of roh) {
    if (!z.trim() || z.trim().startsWith('#')) continue;
    const ein = /^[ \t]/.test(z);
    if (!ein) { drin = z.trim() === '/*'; continue; }
    if (!drin) continue;
    const i = z.indexOf(':'); if (i <= 0) continue;
    const n = z.slice(0, i).trim(), w = z.slice(i + 1).trim();
    if (!n || !w || /^Strict-Transport-Security$/i.test(n)) continue;
    h[n.toLowerCase()] = w;
  }
  return h;
}

function kanalStarten() {
  if (!KANAL_KLASSEN) return null;
  const spool = path.join(TMP, 'kanal-spool');
  fs.mkdirSync(spool, { recursive: true });
  const kind = spawn('java', ['-cp', KANAL_KLASSEN, 'KanalFahrer', spool], { stdio: ['pipe', 'pipe', 'pipe'] });
  const warten = [];
  let puffer = '';
  kind.stdout.setEncoding('utf8');
  kind.stdout.on('data', (d) => {
    puffer += d;
    let i;
    while ((i = puffer.indexOf('\n')) >= 0) {
      const zeile = puffer.slice(0, i).replace(/\r$/, ''); puffer = puffer.slice(i + 1);
      const w = warten.shift(); if (w) w(zeile);
    }
  });
  const k = {
    kind, dateien: [], anfragen: [], quelle: {}, modus: 'java',
    java(zeile) { return new Promise((f) => { warten.push(f); kind.stdin.write(zeile + '\n'); }); },
    ende() { try { kind.stdin.end(); kind.kill(); } catch (_) {} },
  };
  return k;
}

async function huelleRouten(ctx, k) {
  const KOPF = kopfzeilenAusHeaders();
  await ctx.route('**/*', (r) => r.abort());
  await ctx.route('https://green-scan.ch/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const ohneWirt = url.slice('https://green-scan.ch'.length);
    const qi = ohneWirt.indexOf('?');
    const pfad = (qi >= 0 ? ohneWirt.slice(0, qi) : ohneWirt).split('#')[0];
    const abfrage = qi >= 0 ? ohneWirt.slice(qi + 1).split('#')[0] : '';
    if (pfad.startsWith('/__huelle/')) {
      const h = await req.allHeaders();
      const a = { pfad, abfrage, methode: req.method(), haupt: req.isNavigationRequest(), marke: h['x-gs-huelle'] || null,
        referer: h['referer'] || null, origin: h['origin'] || null, wirt: new URL(url).origin };
      k.anfragen.push(a);
      if (k.modus === 'html') {
        // Was der Hoster im WEB unter dieser Adresse liefert: die Startseite.
        return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>GreenScan</title>' });
      }
      if (k.modus === 'ohne_marke') {
        // Gueltiges JSON mit „ok" und Schluessel — aber OHNE die Marke der
        // Huelle. Ohne diesen Fall waere die Marken-Pruefung ungeprueft: HTML
        // scheitert schon am JSON.parse.
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"k":"0123456789abcdef0123456789abcdef"}' });
      }
      if (/\/start$/.test(pfad)) {
        const q = {}; abfrage.split('&').forEach(p => { const i = p.indexOf('='); if (i > 0) { try { q[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); } catch (_) {} } });
        if (q.id) k.quelle[q.id] = q.quelle || '(keine)';
      }
      const antwort = await k.java(['REQ', req.method(), pfad, abfrage || '-', a.haupt ? '1' : '0',
        a.marke || '-', a.origin || '-', a.referer || '-'].join('\t'));
      const teile = antwort.split('\t');
      if (teile[0] === 'AUSNAHME') return route.fulfill({ status: 500, body: antwort });
      if (teile[2] && teile[2] !== '-') {
        const d = teile[2].split('|');
        k.dateien.push({ id: d[0], ziel: d[1], name: d[2], typ: d[3], bytes: +d[4], inhalt: fs.readFileSync(d[5]), quelle: k.quelle[d[0]] });
      }
      return route.fulfill({ status: +teile[0], contentType: 'application/json',
        headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }, body: teile[1] });
    }
    let p = pfad;
    try { p = decodeURIComponent(pfad); } catch (_) {}
    if (p === '/' || p === '') p = '/index.html';
    const datei = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
    if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ status: 200, body: fs.readFileSync(datei),
      headers: Object.assign({ 'content-type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' }, KOPF) });
  });
}

async function warteAuf(fn, ms) {
  const bis = Date.now() + ms;
  while (Date.now() < bis) { const v = fn(); if (v) return v; await new Promise(r => setTimeout(r, 60)); }
  return null;
}

// Drei Meldewege der App — alle drei werden mitgeschrieben, mit Zeitpunkt.
async function meldungenAufzeichnen(p) {
  await p.evaluate(() => {
    window.__meldungen = [];
    ['gsToast', 'showProfileToast', 'showMarketNotif'].forEach(function (n) {
      var org = window[n]; if (typeof org !== 'function' || org.__mitgeschrieben) return;
      var neu = function (a, b) {
        var t;
        try { t = (a && typeof a === 'object') ? [a.title, a.body, a.msg].filter(Boolean).join(' ') : String(a); } catch (_) { t = '?'; }
        window.__meldungen.push({ fn: n, t: t, typ: (a && typeof a === 'object' && a.type) || b || '' });
        return org.apply(this, arguments);
      };
      neu.__mitgeschrieben = true;
      window[n] = neu;
    });
  });
}

const PAYLOAD = '<img src=x onerror="window.__pwned=1">';
const ANALYSE = {
  site_analysis: { size_m2: 6, shape: 'rechteckig', light: { level: 'sonnig' } },
  recommended_plants: [{ name: PAYLOAD + 'Tomate', lat: 'Solanum lycopersicum', qty: 2, category: 'gemüse', position: { x: 1, y: 1 } },
                       { name: 'Basilikum', lat: 'Ocimum basilicum', qty: 1, category: 'kräuter', position: { x: 2, y: 1 } }],
  monthly_calendar: { mai: ['Tomaten setzen ' + PAYLOAD] },
  tools_needed: ['Spaten'], warnings: [PAYLOAD + ' Spätfrost'], layout_grid: { width_m: 3, depth_m: 2 },
};
const GPX_SPUR = (jetzt) => [{ ts: jetzt - 3600e3, points: [
  { ll: [47.3769, 8.5417], alt: 410, t: jetzt - 3600e3 }, { ll: [47.3771, 8.5420], alt: 412, t: jetzt - 3500e3 }] }];
const utf8 = (b) => Buffer.from(b).toString('utf8');

// Die Exporte, wie die App sie ausloest — die ECHTEN Funktionen, mit dem
// Zustand, den jede braucht (ohne ihn steigen sie still aus und ein Fall
// waere „gruen fuer nichts").
const EXPORTE = [
  { k: 'E1', name: 'Backup', ziel: 'speichern', typ: 'application/json', nameRe: /^GreenScan-Backup-\d{4}-\d\d-\d\d\.json$/,
    aufruf: () => { exportUserData(); }, erfolg: /Backup gespeichert/,
    inhalt: (b) => { try { const o = JSON.parse(utf8(b)); return (o.version >= 16 && Array.isArray(o.messwerte)) ? null : 'Backup ohne version>=16 oder messwerte'; } catch (e) { return 'kein JSON: ' + e.message; } } },
  { k: 'E2', name: 'GPS-Spur (GPX)', ziel: 'speichern', typ: 'application/gpx+xml', nameRe: /^greenscan-track-\d{4}-\d\d-\d\d\.gpx$/,
    vor: (spur) => { localStorage.setItem('gs_gpx_tracks', JSON.stringify(spur)); return true; }, vorArg: () => GPX_SPUR(UHR.getTime()),
    aufruf: () => { gsTrackExportGPX(0); }, erfolg: /GPX gespeichert/,
    inhalt: (b) => (/^<\?xml/.test(utf8(b)) && /<trkpt lat="47\.3769" lon="8\.5417">/.test(utf8(b))) ? null : 'kein GPX mit der Spur' },
  { k: 'E3', name: 'Archiv', ziel: 'speichern', typ: 'application/json', nameRe: /^greenscan-archiv-\d{4}-\d\d-\d\d\.json$/,
    vor: async () => { if (!localStorage.getItem('gs_sb_uid')) localStorage.setItem('gs_sb_uid', 'pruef-uid'); return (await gsArchiveDropped('pruef', [{ a: 1 }, { b: 2 }])) === 2; },
    aufruf: () => { gsArchiveExport(); }, erfolg: /archivierte Einträge gespeichert/,
    inhalt: (b) => { try { const o = JSON.parse(utf8(b)); return (Array.isArray(o) && o.length >= 2) ? null : 'Archiv mit ' + (o && o.length) + ' Eintraegen'; } catch (e) { return 'kein JSON'; } } },
  { k: 'E4', name: 'Pflanzen (CSV)', ziel: 'speichern', typ: 'text/csv', nameRe: /^greenscan-pflanzen-\d{4}-\d\d-\d\d\.csv$/,
    aufruf: () => { gsExportPlantsCSV(); }, erfolg: /Export erstellt/,
    inhalt: (b) => (/Basilikum/.test(utf8(b)) && utf8(b).split('\r\n').length >= 3) ? null : 'CSV ohne die Pflanzen' },
  { k: 'E5', name: 'Tagebuch (CSV)', ziel: 'speichern', typ: 'text/csv', nameRe: /^greenscan-tagebuch-\d{4}-\d\d-\d\d\.csv$/,
    aufruf: () => { gsExportDiaryCSV(); }, erfolg: /Tagebuch exportiert/,
    inhalt: (b) => /^﻿?Datum,Pflanze/.test(utf8(b)) ? null : 'CSV ohne Kopfzeile Datum,Pflanze' },
  { k: 'E6', name: 'Messwerte (CSV)', ziel: 'speichern', typ: 'text/csv', nameRe: /^greenscan-messwerte-\d{4}-\d\d-\d\d\.csv$/,
    aufruf: () => { gsExportMesswerteCSV(); }, erfolg: /Export erstellt/,
    inhalt: (b) => /^﻿?Zeitpunkt,Ger/.test(utf8(b)) ? null : 'CSV ohne Kopfzeile Zeitpunkt,Gerät' },
  { k: 'E7', name: 'Gartenplan (Drucken / Als PDF)', ziel: 'drucken', typ: 'text/html', zustand: 'druck_offen',
    vor: (plan) => { _gsPP.plan = plan; return true; }, vorArg: (S) => S.MUSTERPLAN,
    aufruf: () => { gsPPexportPDF(); }, erfolg: /Druckdialog geöffnet/,
    inhalt: (b) => /Garten-Plan/.test(utf8(b)) ? null : 'Dokument ohne „Garten-Plan"',
    nach: () => ({ modal: !!document.getElementById('modal-pdf-fallback') }), nachOk: (n) => n.modal ? 'das Fenster mit den toten Druck-Knoepfen ging auf' : null },
  { k: 'E8', name: 'Giess-Zettel (Drucken)', ziel: 'drucken', typ: 'text/html', zustand: 'druck_offen',
    aufruf: () => { gsGiessZettelDrucken(); }, erfolg: null,
    inhalt: (b) => /Giess-Zettel/.test(utf8(b)) ? null : 'Dokument ohne „Giess-Zettel"',
    nach: () => ({ open: window.__openRufe, app: !!document.getElementById('app') && !!document.getElementById('screen-home') }),
    nachOk: (n) => (n.open !== 0 ? n.open + '× window.open' : null) || (!n.app ? 'die App ist nicht mehr da — ueberschrieben?' : null) },
  { k: 'E9', name: 'Garten-Scan (Drucken) — KI-Text kommt escaped an', ziel: 'drucken', typ: 'text/html', zustand: 'druck_offen',
    vor: (a) => { window._gsGardenScan = { analysis: a, plan_id: 'pruef' }; return true; }, vorArg: () => ANALYSE,
    aufruf: () => { gsGardenScanExportPDF(); }, erfolg: null,
    inhalt: (b) => { const s = utf8(b); return (s.indexOf('&lt;img src=x onerror=') >= 0 && s.indexOf('<img src=x onerror') < 0) ? null : 'der KI-Text steht ROH im Druck-Dokument'; } },
  { k: 'E10', name: '3D-Foto (PNG)', ziel: 'speichern', typ: 'image/png', nameRe: /^greenscan-plan-\d{4}-\d\d-\d\d\.png$/, frist: 90000,
    vor: async (a) => {
      try { await _gsLoadThree(); } catch (_) { return false; }
      const c = document.createElement('div'); c.style.cssText = 'position:fixed;left:0;top:0;width:320px;height:240px;'; document.body.appendChild(c);
      try { gsRenderGardenScan3D(c, a); } catch (_) { return false; }
      return !!(window._gsGardenScan3DScene && typeof window._gsGardenScan3DScene.exportPhoto === 'function');
    }, vorArg: () => Object.assign({}, ANALYSE, { recommended_plants: [{ name: 'Tomate', qty: 1, category: 'gemüse', position: { x: 1, y: 1 } }] }),
    offen: 'Three.js/WebGL laesst sich hier nicht aufbauen — das 4K-Foto ist NICHT geprueft',
    aufruf: () => { gs3DExportPhoto(); }, erfolg: /4K-Foto gespeichert/,
    inhalt: (b) => (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) ? null : 'kein PNG' },
  // Das Netz fuer kuenftige Stellen — ein Anker, den niemand umgestellt hat.
  { k: 'N1', name: 'Netz: losgeloester Anker, Adresse sofort freigegeben', ziel: 'speichern', typ: 'text/plain', quelle: 'tor',
    aufruf: () => { var b = new Blob(['hallo tor'], { type: 'text/plain' }); var u = URL.createObjectURL(b); var a = document.createElement('a'); a.href = u; a.download = 'tor-probe.txt'; a.click(); URL.revokeObjectURL(u); },
    erfolg: /Gespeichert/, inhalt: (b) => utf8(b) === 'hallo tor' ? null : 'Inhalt: ' + utf8(b) },
  { k: 'N2', name: 'Netz: angehaengter Anker, echtes Klick-Ereignis', ziel: 'speichern', typ: 'text/csv', quelle: 'tor',
    aufruf: () => { var b = new Blob(['x,y\n1,2'], { type: 'text/csv' }); var u = URL.createObjectURL(b); var a = document.createElement('a'); a.href = u; a.download = 'tor.csv'; a.textContent = 'x'; document.body.appendChild(a); a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); a.remove(); },
    erfolg: /Gespeichert/, inhalt: (b) => utf8(b) === 'x,y\n1,2' ? null : 'Inhalt: ' + utf8(b) },
  { k: 'N3', name: 'Netz: data:-Anker', ziel: 'speichern', typ: 'text/csv', quelle: 'tor',
    aufruf: () => { var a = document.createElement('a'); a.href = 'data:text/csv;base64,' + btoa('a,b\n3,4'); a.download = 'd.csv'; a.click(); },
    erfolg: /Gespeichert/, inhalt: (b) => utf8(b) === 'a,b\n3,4' ? null : 'Inhalt: ' + utf8(b) },
];

async function exportFall(p, k, def, SEED) {
  k.dateien = []; k.anfragen = [];
  await p.evaluate(() => { window.__meldungen = []; });
  if (def.vor) {
    const v = await p.evaluate(def.vor, def.vorArg ? def.vorArg(SEED) : null).catch((e) => 'FEHLER ' + e.message.split('\n')[0]);
    if (v !== true) return { def, offen: def.offen || ('Voraussetzung nicht hergestellt: ' + v) };
  }
  await p.evaluate(def.aufruf);
  const d = await warteAuf(() => k.dateien[0], def.frist || 20000);
  const res = { def, datei: d || null, anfragen: k.anfragen.slice() };
  if (!d) { res.meldungen = await p.evaluate(() => window.__meldungen.slice()); return res; }
  // Der Dialog ist „offen": laenger als jeder Zeitgeber der App (300/800 ms).
  await p.waitForTimeout(1500);
  res.vorher = await p.evaluate(() => window.__meldungen.slice());
  res.ende = await k.java('END\t' + d.id);
  res.js = await k.java('CB\t' + d.id + '\t' + (def.zustand || 'gespeichert'));
  res.rueck = res.js === 'NULL' ? 'NULL' : await p.evaluate(res.js);
  await p.waitForTimeout(800);
  res.nachher = await p.evaluate(() => window.__meldungen.slice());
  if (def.nach) res.nachWert = await p.evaluate(def.nach);
  return res;
}

function fallUrteil(f) {
  const def = f.def;
  if (f.offen) return { offen: true, warum: f.offen };
  if (!f.datei) return { ok: false, warum: 'keine Datei am Kanal angekommen · Anfragen: '
    + (f.anfragen.map(a => a.pfad.split('/').pop()).join(',') || 'keine') + ' · Meldungen: ' + JSON.stringify((f.meldungen || []).map(m => m.t)) };
  const d = f.datei, fehler = [];
  if (d.ziel !== def.ziel) fehler.push('Ziel ' + d.ziel + ' statt ' + def.ziel);
  if (def.typ && d.typ !== def.typ) fehler.push('Typ ' + d.typ + ' statt ' + def.typ);
  if (def.nameRe && !def.nameRe.test(d.name)) fehler.push('Name ' + d.name);
  if ((def.quelle || 'app') !== d.quelle) fehler.push('kam ueber ' + d.quelle + ' statt ' + (def.quelle || 'app') + (d.quelle === 'tor' ? ' — die Stelle ist nicht umgestellt, das Netz hat sie aufgefangen' : ''));
  const inh = def.inhalt ? def.inhalt(d.inhalt) : null; if (inh) fehler.push(inh);
  const fremd = f.anfragen.filter(a => a.wirt !== 'https://green-scan.ch');
  if (fremd.length) fehler.push('Anfrage an fremden Ursprung: ' + fremd[0].wirt);
  // Vor dem Ergebnis des Dialogs darf KEINE Zusage stehen — in keinem
  // Wortlaut. Die erste Fassung suchte nur nach dem neuen Satz der Stelle; die
  // Gegenprobe mit dem alten Backup zeigte „Backup erstellt und
  // heruntergeladen!" vor dem Dialog, und der Fall sah es nicht.
  const ZUSAGE = /gespeichert|heruntergeladen|exportiert|Export erstellt|geteilt|Druckdialog geöffnet/i;
  const zufrueh = f.vorher.filter(m => ZUSAGE.test(m.t) && !/Nicht gespeichert|Nicht gedruckt|Unklar/i.test(m.t));
  if (zufrueh.length) fehler.push('Zusage VOR dem Ergebnis des Dialogs: „' + zufrueh[0].t + '"');
  if (def.erfolg && !f.nachher.some(m => def.erfolg.test(m.t))) fehler.push('keine Erfolgsmeldung nach dem Ergebnis: ' + JSON.stringify(f.nachher.map(m => m.t)));
  if (f.rueck !== true) fehler.push('die Seite wartete nicht auf das Ergebnis (Rueckruf → ' + f.rueck + ')');
  if (def.nachOk) { const n = def.nachOk(f.nachWert || {}); if (n) fehler.push(n); }
  return fehler.length ? { ok: false, warum: fehler.join(' · ') }
    : { ok: true, info: d.name + ' · ' + d.typ + ' · ' + d.bytes + ' B · ' + f.anfragen.filter(a => /\/teil$/.test(a.pfad)).length + ' Teil(e)'
        + (def.erfolg ? ' · Meldung erst nach dem Dialog' : ' · keine Zusage vor dem Dialog') };
}

// In der Huelle: alle Faelle des Kanals.
async function kanalFaelle(p, k, SEED, dl) {
  const out = { exporte: [] };
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    var o = window.open; window.__openRufe = 0;
    window.open = function () { window.__openRufe++; return o.apply(this, arguments); };
  });
  await meldungenAufzeichnen(p);
  for (const def of EXPORTE) out.exporte.push(await exportFall(p, k, def, SEED));

  // Abbrechen und Fehler: KEINE Zusage.
  const abbruch = await exportFall(p, k, Object.assign({}, EXPORTE[4], { zustand: 'abgebrochen' }), SEED);
  const fehler = await exportFall(p, k, Object.assign({}, EXPORTE[5], { zustand: 'fehler' }), SEED);
  out.abbruch = { datei: !!abbruch.datei, rueck: abbruch.rueck, nachher: (abbruch.nachher || []).map(m => m.t) };
  out.fehler = { datei: !!fehler.datei, rueck: fehler.rueck, nachher: (fehler.nachher || []).map(m => m.t) };

  // Mehrere Teile, Grenzen der Teilung, jeder Byte-Wert — durch gsDateiSpeichern.
  out.viel = [];
  const TEIL = 192 * 1024;
  for (const n of [1, TEIL, TEIL + 1, 3 * TEIL + 7, 5 * 1024 * 1024 + 3]) {
    k.dateien = []; k.anfragen = [];
    const sha = await p.evaluate(async (n) => {
      const u = new Uint8Array(n);
      for (let i = 0; i < n; i++) u[i] = (i * 131 + (i >> 9)) & 255;
      if (n > 65536) crypto.getRandomValues(u.subarray(n - 65536));
      const h = await crypto.subtle.digest('SHA-256', u);
      window.__probeErg = null;
      gsDateiSpeichern(new Blob([u]), 'probe-' + n + '.json', 'application/json').then(r => { window.__probeErg = r; });
      return Array.from(new Uint8Array(h)).map(x => x.toString(16).padStart(2, '0')).join('');
    }, n);
    const d = await warteAuf(() => k.dateien[0], 60000);
    let erg = null;
    if (d) {
      await k.java('END\t' + d.id);
      await p.evaluate(await k.java('CB\t' + d.id + '\tgespeichert'));
      erg = await p.waitForFunction(() => window.__probeErg, null, { polling: 100, timeout: 5000 }).then(() => p.evaluate(() => window.__probeErg)).catch(() => null);
    }
    out.viel.push({ n, ok: !!d && require('crypto').createHash('sha256').update(d.inhalt).digest('hex') === sha,
      teile: k.anfragen.filter(a => /\/teil$/.test(a.pfad)).length, erwartet: Math.ceil(n / TEIL), state: erg && erg.state });
  }

  // Grenzen auf der Seite: zu gross, Druck zu gross, eine Antwort ohne Marke, einer zur Zeit.
  k.dateien = []; k.anfragen = [];
  out.zuGross = await p.evaluate(() => gsDateiSpeichern(new Blob([new Uint8Array(33 * 1024 * 1024)]), 'gross.json', 'application/json'));
  out.zuGrossAnfragen = k.anfragen.length;
  out.druckZuGross = await p.evaluate(() => gsDrucken('x'.repeat(8 * 1024 * 1024 + 1), 'gross'));
  k.modus = 'html'; k.anfragen = [];
  out.ohneMarke = await p.evaluate(() => gsDateiSpeichern('abc', 'a.txt', 'text/plain'));
  out.ohneMarkeAnfragen = k.anfragen.map(a => a.pfad.split('/').pop());
  k.modus = 'ohne_marke'; k.anfragen = [];
  out.jsonOhneMarke = await p.evaluate(() => gsDateiSpeichern('abc', 'a.txt', 'text/plain'));
  out.jsonOhneMarkeAnfragen = k.anfragen.map(a => a.pfad.split('/').pop());
  k.modus = 'java'; k.dateien = []; k.anfragen = [];
  await p.evaluate(() => { window.__eins = null; gsDateiSpeichern('eins', 'eins.txt', 'text/plain').then(r => { window.__eins = r; }); });
  const eins = await warteAuf(() => k.dateien[0], 15000);
  out.zweiter = await p.evaluate(() => gsDateiSpeichern('zwei', 'zwei.txt', 'text/plain'));
  if (eins) { await k.java('END\t' + eins.id); await p.evaluate(await k.java('CB\t' + eins.id + '\tgespeichert')); }
  await p.waitForTimeout(300);
  out.ersterDanach = await p.evaluate(() => window.__eins && window.__eins.state);

  // Eine verschwundene Datei: ein blob:, den niemand angelegt hat.
  k.anfragen = [];
  await p.evaluate(() => { window.__meldungen = []; var a = document.createElement('a'); a.href = 'blob:https://green-scan.ch/00000000-0000-0000-0000-000000000000'; a.download = 'weg.txt'; a.click(); });
  await p.waitForTimeout(300);
  out.verschwunden = { anfragen: k.anfragen.length, meldungen: await p.evaluate(() => window.__meldungen.map(m => m.t)) };

  // window.print() in der App: ein Satz, kein Kanal.
  k.anfragen = [];
  await p.evaluate(() => { window.__meldungen = []; window.print(); });
  out.print = { anfragen: k.anfragen.length, meldungen: await p.evaluate(() => window.__meldungen.map(m => m.t)) };

  // Ein Satz je Grund — fuer JEDEN Code, den Export.java ausgibt, plus die der Seite.
  const codes = [...new Set([...EXPORT_JAVA.matchAll(/nein\("([a-z_]+)"\)/g)].map(m => m[1])
    .concat([...EXPORT_JAVA.matchAll(/http\(\d+, "([a-z_]+)"\)/g)].map(m => m[1]))
    .concat(['laeuft', 'leer', 'netz', 'keine_huelle']))];
  out.gruende = await p.evaluate((cs) => cs.map(c => [c, _gsDateiGrundSatz(c)]), codes);
  out.downloads = dl.length;
  return out;
}

// Im Browser: der Kanal schweigt, und dieselben Funktionen liefern Downloads —
// byte-gleich mit dem, was in der Huelle ankam.
async function browserFaelle(p, SEED) {
  const out = { dateien: {} };
  await p.evaluate(() => { document.documentElement.classList.remove('gs-preauth'); window.gsRequire = () => true; });
  for (const def of EXPORTE.filter(d => ['E2', 'E4', 'E5', 'E6'].indexOf(d.k) >= 0)) {
    if (def.vor) await p.evaluate(def.vor, def.vorArg ? def.vorArg(SEED) : null);
    try {
      const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 15000 }), p.evaluate(def.aufruf)]);
      out.dateien[def.k] = { name: dl.suggestedFilename(), inhalt: fs.readFileSync(await dl.path()) };
    } catch (e) { out.dateien[def.k] = { fehler: e.message.split('\n')[0] }; }
  }
  // Der Garten-Scan-Druck im Browser: das iframe hat den Ursprung der App —
  // ein roher KI-Text liefe dort mit Zugriff auf den Speicher.
  await p.evaluate((a) => { window.__pwned = undefined; window._gsGardenScan = { analysis: a, plan_id: 'pruef' }; gsGardenScanExportPDF(); }, ANALYSE);
  await p.waitForTimeout(900);
  out.xss = await p.evaluate(() => {
    var f = document.querySelector('iframe[aria-hidden="true"]');
    var t = f && f.contentDocument ? f.contentDocument.body.textContent : null;
    // Der Schadcode schreibt `window.__pwned` — im iframe ist das das iframe.
    // Beide Fenster ansehen, sonst bliebe ein echter Lauf unbemerkt.
    var imRahmen = false; try { imRahmen = !!(f && f.contentWindow && f.contentWindow.__pwned === 1); } catch (_) {}
    return { pwned: window.__pwned === 1 || imRahmen, alsText: !!t && t.indexOf('<img src=x onerror') >= 0, iframe: !!f };
  });
  return out;
}

async function app() {
  const { s, port } = await server();
  const br = await chromium.launch();
  const errs = [];
  const SEED = require('./_seed.js');

  // EIN Aufbau, zweimal gefahren: mit der Kennung der Huelle und ohne. Ohne die
  // zweite Fahrt waere ein Zweig, der IMMER greift, ebenfalls gruen.
  async function fahrt(alsHuelle, kanal) {
    const ctx = await br.newContext({
      viewport: { width: 412, height: 915 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/127.0.0.0 Mobile Safari/537.36' + (alsHuelle ? ' GreenScanApp/' + GS_VERSION.replace(/^v/, '') : ''),
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    // v33.53: in der Huelle darf KEIN Download entstehen (Playwright fuehrte
    // einen Anker-Download zu Ende, den eine WebView still verschluckt) — und
    // im Browser keine einzige Anfrage an den Kanal.
    const downloads = []; p.on('download', d => downloads.push(d));
    const huelleAnfragen = []; p.on('request', rq => { if (rq.url().indexOf('/__huelle/') >= 0) huelleAnfragen.push(rq.url()); });
    if (alsHuelle && kanal) await huelleRouten(ctx, kanal);
    else {
      // Auch der Browser-Lauf kappt alles ausser dem eigenen Pruefserver. Der
      // GitHub-Runner HAT Netz, diese Umgebung nicht: in CI holte die App das
      // Wetter, legte daraus Messwerte an, und der Messwerte-Export war im
      // Browser 4675 B gross, in der (gekappten) Huelle 1908 B — K9 rot in CI,
      // gruen hier. Ein Pruefstand, der das Netz nicht kappt, misst auf zwei
      // Maschinen zwei verschiedene Apps.
      const eigen = 'http://127.0.0.1:' + port + '/';
      await ctx.route('**/*', (r) => (r.request().url().startsWith(eigen) ? r.continue() : r.abort()));
    }
    await p.clock.setFixedTime(UHR);
    // Die Registrierung wird GEZAEHLT statt ausgefuehrt — ein echter Worker
    // wuerde den zweiten Lauf beeinflussen.
    await p.addInitScript(() => {
      // Die Registrierung wird GEZAEHLT statt ausgefuehrt. Der Ersatz muss sich
      // aber verhalten wie ein echter Browser: dort loest `ready` auf, SOBALD
      // ein Worker registriert ist. Ein Ersatz, dessen `ready` nie zurueckkommt,
      // misst den Ersatz und nicht die App — genau das war der erste Anlauf.
      window.__swRufe = 0;
      var _fertig, _bereit = new Promise(function (f) { _fertig = f; });
      var _reg = { pushManager: { getSubscription: function () { return Promise.resolve(null); },
                                 subscribe: function () { return Promise.resolve(null); } },
                   addEventListener: function () {}, waiting: null, installing: null };
      try {
        Object.defineProperty(navigator, 'serviceWorker', {
          configurable: true,
          value: { register: function () { window.__swRufe++; _fertig(_reg); return Promise.resolve(_reg); },
                   addEventListener: function () {}, ready: _bereit, controller: null },
        });
      } catch (_) {}
    });
    await p.addInitScript(SEED);
    await p.goto((alsHuelle && kanal) ? 'https://green-scan.ch/?source=app' : 'http://127.0.0.1:' + port + '/?source=app', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(4000);
    const r = await p.evaluate(() => {
      document.documentElement.classList.remove('gs-preauth');
      window.gsRequire = () => true;
      var out = {};
      out.huelle = (typeof gsAndroidHuelle === 'function') ? gsAndroidHuelle() : 'FUNKTION FEHLT';
      out.alsApp = (typeof gsLaeuftAlsApp === 'function') ? gsLaeuftAlsApp() : null;
      // sw: noch einmal ausdruecklich rufen, damit der Fall nicht davon
      // abhaengt, ob der Start es schon getan hat.
      window.__swRufe = 0;
      try { gsRegisterServiceWorker(); } catch (e) { out.swFehler = e.message; }
      out.swRufe = window.__swRufe;
      try { out.push = gsPushSupportStatus(); } catch (e) { out.push = { fehler: e.message }; }
      try { out.karteHtml = _gsHuelleHtml(); } catch (e) { out.karteHtml = 'FEHLER ' + e.message; }
      out.anders = (window.GS_HUELLE_ANDERS || []).map(function (a) { return a.schl; });
      out.titel = (window.GS_HUELLE_ANDERS || []).map(function (a) { return a.titel; });
      // 'sw' zweite Haelfte: _gsSwReady darf NIE haengen. Gemessen mit einem
      // Wettrennen gegen eine Frist — ein `await`, das nicht zurueckkommt,
      // sieht sonst aus wie ein Fall, der noch laeuft.
      out.readyVersprechen = (function () {
        var frist = new Promise(function (f) { setTimeout(function () { f('HAENGT'); }, 2500); });
        return Promise.race([_gsSwReady().then(function (r) { return r === null ? 'null' : 'reg'; },
                                               function () { return 'abgelehnt'; }), frist]);
      })();
      // 'zahlung': kein zweites Fenster in der Huelle.
      out.fenster = (function () {
        var gerufen = 0, alt = window.open;
        window.open = function () { gerufen++; return null; };
        var r = null;
        try { r = _gsCheckoutFenster('t', 520, 760); } catch (e) { r = 'FEHLER ' + e.message; }
        window.open = alt;
        return { gerufen: gerufen, rueck: (r === null ? 'null' : typeof r) };
      })();
      // Und das GERENDERTE Dokument, nicht das Objekt: steht die Karte wirklich da?
      try {
        if (typeof switchTab === 'function') switchTab('settings');
        if (typeof loadPrefs === 'function') loadPrefs();
      } catch (_) {}
      var el = document.getElementById('about-huelle');
      out.karteImDokument = el ? el.textContent.trim() : null;
      return Promise.resolve(out.readyVersprechen).then(function (v) {
        out.ready = v; delete out.readyVersprechen; return out;
      });
    });
    try { r.kanal = (alsHuelle && kanal) ? await kanalFaelle(p, kanal, SEED, downloads) : (alsHuelle ? null : await browserFaelle(p, SEED)); }
    catch (e) { r.kanalFehler = e.message.split('\n')[0]; }
    r.downloads = downloads.length; r.huelleAnfragen = huelleAnfragen.length;
    await ctx.close();
    return r;
  }

  const kanal = kanalStarten();
  let h;
  try { h = await fahrt(true, kanal); } finally { if (kanal) kanal.ende(); }
  const b = await fahrt(false, null);
  await br.close();
  s.close();

  F.push({
    name: 'A1 · gsAndroidHuelle erkennt die Kennung — und im Browser ist sie null',
    r: (h.huelle === GS_VERSION.replace(/^v/, '') && b.huelle === null)
      ? { ok: true, info: 'Huelle: ' + h.huelle + ' · Browser: null' }
      : { ok: false, warum: 'Huelle: ' + JSON.stringify(h.huelle) + ' (erwartet ' + GS_VERSION.replace(/^v/, '') + ') · Browser: ' + JSON.stringify(b.huelle) },
  });
  F.push({
    name: 'A2 · gsLaeuftAlsApp ist in der Huelle wahr (EIN Praedikat, nicht zwei)',
    r: (h.alsApp === true && b.alsApp === false)
      ? { ok: true, info: 'Huelle true · Browser false' }
      : { ok: false, warum: 'Huelle ' + h.alsApp + ' · Browser ' + b.alsApp },
  });
  F.push({
    name: "A3 · GS_HUELLE_ANDERS 'sw': in der Huelle wird KEIN Service Worker registriert — im Browser schon",
    r: (h.swRufe === 0 && b.swRufe === 1)
      ? { ok: true, info: 'Huelle 0 Registrierungen · Browser 1' }
      : { ok: false, warum: 'Huelle ' + h.swRufe + ' · Browser ' + b.swRufe + ' (erwartet 0 / 1)' + (h.swFehler ? ' · ' + h.swFehler : '') },
  });
  F.push({
    name: "A4 · GS_HUELLE_ANDERS 'push': der Schalter sagt WARUM — statt in ein nie zurueckkommendes ready zu laufen",
    r: (h.push && h.push.ok === false && h.push.reason === 'huelle' && /Browser/.test(h.push.message || '')
        && b.push && b.push.reason !== 'huelle')
      ? { ok: true, info: 'Huelle: reason=huelle mit Satz · Browser: ' + (b.push.ok ? 'ok' : b.push.reason) }
      : { ok: false, warum: 'Huelle ' + JSON.stringify(h.push) + ' · Browser ' + JSON.stringify(b.push && b.push.reason) },
  });
  // Die LISTE ist die Pruefung: jeder Eintrag muss auf dem Bildschirm stehen —
  // nicht drei fest verdrahtete Woerter, sonst waechst der Fall nicht mit.
  const fehltAufDemSchirm = (h.titel || []).filter(t => String(h.karteImDokument || '').indexOf(t) < 0);
  F.push({
    name: "A5 · GS_HUELLE_ANDERS: JEDER Eintrag steht im DOKUMENT — im Browser ist die Karte leer",
    r: (h.karteImDokument && (h.titel || []).length >= 3 && !fehltAufDemSchirm.length
        && /Android-App/.test(h.karteImDokument) && (b.karteHtml === '') && !b.karteImDokument)
      ? { ok: true, info: (h.anders || []).length + ' Punkte (' + (h.anders || []).join(', ') + '), '
          + h.karteImDokument.length + ' Zeichen im Dokument · Browser leer' }
      : { ok: false, warum: fehltAufDemSchirm.length
          ? 'nicht auf dem Bildschirm: ' + fehltAufDemSchirm.join(' · ')
          : ('Huelle im Dokument: ' + JSON.stringify(String(h.karteImDokument).slice(0, 90))
             + ' · Browser: ' + JSON.stringify(String(b.karteImDokument || b.karteHtml).slice(0, 40))) },
  });
  // ---------------------------------------------------------------- v33.53
  // A6 — die Gegenrichtung zuerst: im Browser schweigt der Kanal, und dieselben
  // Funktionen laden herunter. Ohne sie waere ein Zweig, der IMMER den Kanal
  // nimmt, ebenfalls gruen.
  const bDl = (b.kanal && b.kanal.dateien) || {};
  const bDlOk = ['E2', 'E4', 'E5', 'E6'].filter(x => bDl[x] && bDl[x].inhalt);
  F.push({
    name: 'A6 · Im Browser schweigt der Kanal (0 Anfragen an /__huelle/) — und dieselben Exporte laden herunter',
    r: (b.huelleAnfragen === 0 && bDlOk.length === 4)
      ? { ok: true, info: '0 Anfragen · ' + bDlOk.length + ' Downloads (GPX, drei CSV)' }
      : { ok: false, warum: b.huelleAnfragen + ' Anfragen an den Kanal · Downloads: ' + JSON.stringify(Object.keys(bDl).map(x => x + ':' + (bDl[x].fehler || 'ok'))) + (b.kanalFehler ? ' · ' + b.kanalFehler : '') },
  });
  const K = h.kanal;
  const kanalOffen = (n) => F.push({ name: n, r: KANAL_KLASSEN ? { ok: false, warum: 'der Kanal-Teil lief nicht: ' + (h.kanalFehler || 'ohne Ergebnis') }
                                                               : { offen: true, warum: 'kein Java — der Kanal wurde NICHT gefahren' } });
  if (!K) {
    EXPORTE.forEach(d => kanalOffen(d.k + ' · ' + d.name + ' — kommt ueber den Kanal an'));
    ['K1 · Abbrechen', 'K2 · Fehler', 'K3 · Viele Teile', 'K4 · Grenzen', 'K5 · Verschwundene Datei', 'K6 · window.print', 'K7 · Saetze', 'K8 · 0 Downloads', 'K9 · Byte-gleich', 'K10 · KI-Text im Browser-Druck'].forEach(kanalOffen);
  } else {
    K.exporte.forEach(f => F.push({ name: f.def.k + ' · ' + f.def.name + ' — kommt ueber den Kanal an', r: fallUrteil(f) }));
    const nichtGesp = (l) => (l || []).some(t => /Nicht gespeichert/.test(t));
    F.push({
      name: 'K1 · Wer den Dialog schliesst, liest „Nicht gespeichert" — nie „exportiert"',
      r: (K.abbruch.datei && K.abbruch.rueck === true && nichtGesp(K.abbruch.nachher) && !K.abbruch.nachher.some(t => /Tagebuch exportiert/.test(t)))
        ? { ok: true, info: K.abbruch.nachher.join(' | ') }
        : { ok: false, warum: JSON.stringify(K.abbruch) },
    });
    F.push({
      name: 'K2 · Scheitert das Schreiben, sagt die App es — keine Erfolgsmeldung',
      r: (K.fehler.datei && K.fehler.rueck === true && nichtGesp(K.fehler.nachher) && !K.fehler.nachher.some(t => /Export erstellt/.test(t)))
        ? { ok: true, info: K.fehler.nachher.join(' | ') }
        : { ok: false, warum: JSON.stringify(K.fehler) },
    });
    const vielSchlecht = K.viel.filter(v => !v.ok || v.teile !== v.erwartet || v.state !== 'gespeichert');
    F.push({
      name: 'K3 · Viele Teile: 1 Byte, genau ein Teil, ein Teil + 1, jeder Byte-Wert, 5 MB — byte-gleich in der Datei',
      r: vielSchlecht.length ? { ok: false, warum: JSON.stringify(vielSchlecht) }
                             : { ok: true, info: K.viel.map(v => v.n + ' B/' + v.teile + 'T').join(', ') },
    });
    const g = [];
    if (!(K.zuGross && K.zuGross.state === 'abgelehnt' && K.zuGross.grund === 'zu_gross' && K.zuGrossAnfragen === 0)) g.push('33 MB: ' + JSON.stringify(K.zuGross) + ' / ' + K.zuGrossAnfragen + ' Anfragen');
    if (!(K.druckZuGross && K.druckZuGross.state === 'abgelehnt' && K.druckZuGross.grund === 'zu_gross')) g.push('Druck > 8 MB: ' + JSON.stringify(K.druckZuGross));
    if (!(K.ohneMarke && K.ohneMarke.state === 'abgelehnt' && K.ohneMarke.grund === 'keine_huelle' && JSON.stringify(K.ohneMarkeAnfragen) === '["start"]')) g.push('Web-Rueckfall (HTML): ' + JSON.stringify(K.ohneMarke) + ' nach ' + JSON.stringify(K.ohneMarkeAnfragen));
    if (!(K.jsonOhneMarke && K.jsonOhneMarke.state === 'abgelehnt' && K.jsonOhneMarke.grund === 'keine_huelle' && JSON.stringify(K.jsonOhneMarkeAnfragen) === '["start"]')) g.push('JSON ohne Marke: ' + JSON.stringify(K.jsonOhneMarke) + ' nach ' + JSON.stringify(K.jsonOhneMarkeAnfragen));
    if (!(K.zweiter && K.zweiter.state === 'abgelehnt' && K.zweiter.grund === 'laeuft' && K.ersterDanach === 'gespeichert')) g.push('zwei zugleich: ' + JSON.stringify(K.zweiter) + ' / erster ' + K.ersterDanach);
    F.push({
      name: 'K4 · Grenzen: zu gross, Druck zu gross, eine Antwort ohne Marke (HTML-Rueckfall und JSON), zwei zugleich',
      r: g.length ? { ok: false, warum: g.join(' · ') } : { ok: true, info: 'alle fuenf abgelehnt mit Grund — ohne Marke ging kein einziger Teil hinaus' },
    });
    F.push({
      name: 'K5 · Eine verschwundene Datei: kein Kanal, ein Satz',
      r: (K.verschwunden.anfragen === 0 && K.verschwunden.meldungen.some(t => /nicht mehr da/.test(t)))
        ? { ok: true, info: K.verschwunden.meldungen.join(' | ') } : { ok: false, warum: JSON.stringify(K.verschwunden) },
    });
    F.push({
      name: "K6 · window.print() in der App: ein Satz statt Stille, kein Kanal (GS_HUELLE_ANDERS 'drucken')",
      r: (K.print.anfragen === 0 && K.print.meldungen.some(t => /Drucken/.test(t)))
        ? { ok: true, info: K.print.meldungen.join(' | ') } : { ok: false, warum: JSON.stringify(K.print) },
    });
    const schlechtG = K.gruende.filter(([c, t]) => !t || t.length < 15 || new RegExp('\\b' + c + '\\b').test(t) || /_/.test(t) || !/[.!]$/.test(t));
    F.push({
      name: 'K7 · Jeder Grund aus Export.java und der Seite wird ein ganzer Satz — kein roher Code auf dem Bildschirm',
      r: schlechtG.length ? { ok: false, warum: schlechtG.map(x => x[0] + ' → ' + JSON.stringify(x[1])).join(' · ') }
                          : { ok: true, info: K.gruende.length + ' Gruende' },
    });
    F.push({
      name: 'K8 · In der Huelle entsteht ueber den GANZEN Lauf kein einziger Download',
      r: K.downloads === 0 ? { ok: true, info: '0 Downloads bei ' + K.exporte.length + ' Exporten' }
                           : { ok: false, warum: K.downloads + ' Downloads — eine Stelle geht am Kanal vorbei' },
    });
    const vergl = ['E2', 'E4', 'E5', 'E6'].map(x => {
      const sh = K.exporte.find(f => f.def.k === x), br = bDl[x];
      if (!sh || !sh.datei || !br || !br.inhalt) return x + ': fehlt';
      if (sh.datei.name !== br.name) return x + ': Name ' + sh.datei.name + ' vs ' + br.name;
      return Buffer.compare(sh.datei.inhalt, br.inhalt) === 0 ? null : x + ': Inhalt verschieden (' + sh.datei.inhalt.length + ' vs ' + br.inhalt.length + ' B)';
    }).filter(Boolean);
    F.push({
      name: 'K9 · Dieselbe App: was in der Huelle ankommt, ist byte-gleich mit dem Download im Browser',
      r: vergl.length ? { ok: false, warum: vergl.join(' · ') } : { ok: true, info: 'GPX und drei CSV, Name und Inhalt gleich' },
    });
    const x = (b.kanal && b.kanal.xss) || {};
    F.push({
      name: 'K10 · Der Garten-Scan-Druck im Browser: KI-Text steht als TEXT da und laeuft nicht',
      r: (x.iframe && x.alsText && !x.pwned) ? { ok: true, info: 'window.__pwned unberuehrt, der Text sichtbar' }
                                              : { ok: false, warum: JSON.stringify(x) },
    });
  }
  F.push({
    name: "A8 · _gsSwReady haengt nicht: in der Huelle null, im Browser eine Antwort",
    r: (h.ready === 'null' && b.ready !== 'HAENGT')
      ? { ok: true, info: 'Huelle: null (sofort) · Browser: ' + b.ready }
      : { ok: false, warum: 'Huelle ' + h.ready + ' · Browser ' + b.ready + (h.ready === 'HAENGT' ? ' — genau der Fall, der den Test-Push fuer immer auf „Sende …" stehen liess' : '') },
  });
  F.push({
    name: "A7 · GS_HUELLE_ANDERS 'zahlung': in der Huelle wird KEIN zweites Fenster geoeffnet — im Browser schon",
    r: (h.fenster && h.fenster.gerufen === 0 && h.fenster.rueck === 'null'
        && b.fenster && b.fenster.gerufen === 1)
      ? { ok: true, info: 'Huelle 0 window.open · Browser 1' }
      : { ok: false, warum: 'Huelle ' + JSON.stringify(h.fenster) + ' · Browser ' + JSON.stringify(b.fenster) },
  });
  return errs;
}

// ===========================================================================
(async () => {
  console.log('\n=== apk_check — ist die Android-App dieselbe App?');
  rechnung();
  rechnungExport();
  paket();
  rand();
  let errs = [];
  try { errs = await app(); }
  catch (e) { F.push({ name: 'A · App-Haelfte', r: { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] } }); }

  for (const f of F) {
    if (f.r && f.r.ok) console.log('  ok   ' + f.name + (f.r.info ? '   [' + f.r.info + ']' : ''));
    else if (f.r && f.r.offen) { offen++; console.log('  ??   ' + f.name + '\n         → nicht pruefbar: ' + f.r.warum); }
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((f.r && f.r.warum) || 'unbekannt')); }
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}

  console.log('  ---');
  console.log('  Faelle geprueft: ' + F.length + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  GRENZE: hier laeuft kein Android. Geprueft sind der BAU, die RECHNUNG und die');
  console.log('  ENTSCHEIDUNG der App — nicht, wie sich ein Telefon verhaelt.');
  process.exitCode = (kaputt || errs.length) ? 1 : (offen ? 2 : 0);
})();

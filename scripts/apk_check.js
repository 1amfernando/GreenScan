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
 * GRENZE, und sie ist die wichtigste Zeile dieser Datei: HIER LAEUFT KEIN
 * ANDROID. Geprueft sind der BAU, die RECHNUNG und die ENTSCHEIDUNG der App —
 * nicht, wie sich ein Telefon verhaelt. Wer „auf dem Geraet geprueft" schreibt,
 * muss sagen, auf welchem.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const { spawnSync } = require('child_process');

const WURZEL = path.resolve(__dirname, '..');
const ANDROID = path.join(WURZEL, 'android');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
const MANIFEST = fs.readFileSync(path.join(ANDROID, 'AndroidManifest.xml'), 'utf8');
const ASSETSERVER = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/AssetServer.java'), 'utf8');
const MAINACT = fs.readFileSync(path.join(ANDROID, 'src/ch/greenscan/app/MainActivity.java'), 'utf8');
const BUILDSH = fs.readFileSync(path.join(ANDROID, 'build.sh'), 'utf8');

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
  const rumpf = (ohneKommentare(ASSETSERVER).match(/WebResourceResponse beantworte\(Uri u\) \{([\s\S]*?)\n  \}/) || ['', ''])[1];
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
  const readyRoh = (QUELLE_OHNE.match(/navigator\.serviceWorker\.ready/g) || []).length;
  const leserRumpf = (QUELLE_OHNE.match(/async function _gsSwReady\(\) \{([\s\S]*?)\n\}/) || ['', ''])[1];
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
  const funktionInApp = /function gsHuellePause\(\)/.test(QUELLE_OHNE)
    && /new Event\('pagehide'\)/.test((QUELLE_OHNE.match(/function gsHuellePause\(\)[\s\S]{0,400}/) || [''])[0]);
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
          (QUELLE_OHNE.match(/navigator\.onLine/g) || []).length + ' Stellen der App fragen navigator.onLine' },
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

async function app() {
  const { s, port } = await server();
  const br = await chromium.launch();
  const errs = [];
  const SEED = require('./_seed.js');

  // EIN Aufbau, zweimal gefahren: mit der Kennung der Huelle und ohne. Ohne die
  // zweite Fahrt waere ein Zweig, der IMMER greift, ebenfalls gruen.
  async function fahrt(alsHuelle) {
    const ctx = await br.newContext({
      viewport: { width: 412, height: 915 },
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) '
        + 'Chrome/127.0.0.0 Mobile Safari/537.36' + (alsHuelle ? ' GreenScanApp/' + GS_VERSION.replace(/^v/, '') : ''),
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
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
    await p.goto('http://127.0.0.1:' + port + '/?source=app', { waitUntil: 'domcontentloaded', timeout: 120000 });
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
      // 'download': EIN Tor. Ein echter Anker, ein echter Klick — und gemessen
      // wird, ob die Vorgabe-Handlung verhindert wurde UND ob etwas GESAGT wurde.
      out.dl = (function () {
        var gesagt = null;
        var alt = window.gsToast;
        window.gsToast = function (o) { gesagt = (o && (o.title || o.body)) ? String(o.title || '') + ' ' + String(o.body || '') : String(o); };
        var a = document.createElement('a');
        a.href = 'blob:https://green-scan.ch/abc'; a.download = 'GreenScan-Backup.json';
        a.textContent = 'x'; document.body.appendChild(a);
        var ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        var mitgelaufen = false;
        a.addEventListener('click', function () { mitgelaufen = true; });
        a.dispatchEvent(ev);
        a.remove(); window.gsToast = alt;
        return { verhindert: ev.defaultPrevented, eigenerHandler: mitgelaufen, gesagt: gesagt };
      })();
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
    await ctx.close();
    return r;
  }

  const h = await fahrt(true);
  const b = await fahrt(false);
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
  F.push({
    name: "A6 · GS_HUELLE_ANDERS 'download': EIN Tor faengt jeden Export-Anker — und SAGT etwas",
    r: (h.dl && h.dl.verhindert === true && /Export|Browser/i.test(h.dl.gesagt || '')
        && b.dl && b.dl.verhindert === false)
      ? { ok: true, info: 'Huelle: verhindert + „' + String(h.dl.gesagt).slice(0, 50) + '…" · Browser: laeuft durch' }
      : { ok: false, warum: 'Huelle ' + JSON.stringify(h.dl) + ' · Browser verhindert=' + (b.dl && b.dl.verhindert) },
  });
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

#!/usr/bin/env node
/**
 * offline_check.js — hält die PWA, was sie ohne Empfang verspricht?
 *
 * GreenScan wird im Wald benutzt. Genau dort gibt es keinen Empfang, und
 * genau dafür gibt es den Service Worker: 4'342 Arten, die Karte, die
 * eigenen Pflanzen — alles soll auch ohne Netz da sein.
 *
 * Geprüft hat das bisher nichts. Und ein Offline-Fehler ist die stillste
 * Sorte, die es gibt: er tritt nur dort auf, wo niemand ihn melden kann.
 *
 * Die fünf Fragen dieses Prüfstands:
 *
 *   1. Installiert sich der Service Worker überhaupt?
 *   2. Liegt nach der Installation wirklich alles im Shell-Cache, was
 *      `SHELL_URLS` verspricht?
 *   3. Startet die App ohne Netz — mit allen 4'342 Arten?
 *   4. Wird eine vorgeladene Datei auch dann noch gefunden, wenn der
 *      Runtime-Cache weg ist? (Das ist der Fall, der zählt: Browser
 *      verdrängen Caches einzeln, und der Shell-Cache ist der, der
 *      überleben soll.)
 *   5. Liegt dieselbe Datei doppelt auf dem Gerät?
 *   6-9. Überlebt, was offline eingereiht wurde, das Aufräumen danach —
 *        und kommt es beim zuständigen Flush auch wirklich an?
 *   10. Wächst der Bild-Cache (Kartenkacheln!) unbegrenzt?
 *
 * Warum ein eigener HTTP-Server: ein Service Worker braucht einen sicheren
 * Kontext. `file://` ist keiner, `http://127.0.0.1` schon — deshalb 30
 * Zeilen statischer Server statt eines weiteren npm-Pakets.
 *
 *   25–39. Ein Foto per „Teilen → GreenScan" (v33.55): der multipart-POST aus
 *       dem echten share_target geht durch den Worker, die Seite zeigt eine
 *       VORSCHAU (kein Scan, keine Kamera), „Bestimmen" gibt dem Scanner genau
 *       die Bytes; dazu kein Bild · HEIC · leer · fremde Seite · altes Text-Ziel
 *       · ohne Worker (`_redirects`) · ohne Empfang · ein wartender Worker ·
 *       die App schliesst die Vorschau selbst · abgemeldet geteilt.
 *
 *   11. Versionswechsel OHNE Klick (v33.25): ein neuer sw.js wartet — die App
 *       sichert, wendet ihn beim Zurueckkommen nach Abwesenheit an, laedt
 *       einmal neu, stellt den Tab wieder her. Mit den Gegenrichtungen: kein
 *       Reload, solange ein Fenster offen ist / das Quiz offen ist / eine
 *       KI-Antwort laeuft / ein Feld Text traegt / die Kamera an ist; kein
 *       Reload beim Erstbesuch; Loop-Schutz; Zweit-Tab laedt mit; gleiche
 *       Version → Umschalten ohne Reload.
 *
 *   node scripts/offline_check.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const WURZEL = path.resolve(__dirname, '..');
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

// Fall 11: der Server kann sw.js (und index.html) mit einer ANDEREN Version
// ausliefern — so entsteht ein Versionswechsel, ohne das Repo anzufassen.
let versionErsatz = null;   // z.B. 'vTEST2' → sw.js VERSION 'gs-vTEST2', index.html GS_VERSION 'vTEST2'
let swAnhang = '';          // Byte-Aenderung ohne Versionswechsel (gleiche VERSION, neuer Worker)
// v33.55: die Weiterleitungen aus `_redirects`, wie der Hoster sie anwendet —
// nur exakte Pfade mit 3xx (der SPA-Fallback und die Platzhalter-Regeln sind
// fuer diesen Server ohne Belang). Gelesen aus der ECHTEN Datei: der Fall
// „Teilen ohne Worker" prueft damit die Regel, die ausgeliefert wird.
const WEITERLEITUNGEN = (() => {
  const w = {};
  try {
    fs.readFileSync(path.join(WURZEL, '_redirects'), 'utf8').split('\n').forEach((z) => {
      const t = z.replace(/#.*/, '').trim().split(/\s+/);
      if (t.length >= 3 && t[0].indexOf('*') < 0 && t[0].indexOf(':') < 0 && /^30[12378]!?$/.test(t[2])) w[t[0]] = { ziel: t[1], status: parseInt(t[2], 10) };
    });
  } catch (_) {}
  return w;
})();
// Jede Anfrage, die den Server WIRKLICH erreicht (Methode + Pfad) — ein POST
// an /teilen gehoert unter einem aktiven Worker nie dazu.
const ANKUNFT = [];
function server(wunschPort) {
  return new Promise((fertig) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      ANKUNFT.push(req.method + ' ' + p);
      const weiter = WEITERLEITUNGEN[p];
      if (weiter && !fs.existsSync(path.join(WURZEL, p.replace(/^\/+/, '') || 'index.html'))) {
        req.resume();   // einen POST-Rumpf nicht liegen lassen
        res.writeHead(weiter.status, { Location: weiter.ziel }); res.end(); return;
      }
      if ((p === '/sw.js' || p === '/index.html' || p === '/') && (versionErsatz || swAnhang)) {
        const datei = path.join(WURZEL, p === '/sw.js' ? 'sw.js' : 'index.html');
        let text = fs.readFileSync(datei, 'utf8');
        if (versionErsatz) {
          text = (p === '/sw.js')
            ? text.replace(/const VERSION = 'gs-v[\d.]+';/, "const VERSION = 'gs-" + versionErsatz + "';")
            : text.replace(/var GS_VERSION = 'v[\d.]+';/, "var GS_VERSION = '" + versionErsatz + "';");
        }
        if (p === '/sw.js' && swAnhang) text += '\n' + swAnhang + '\n';
        res.writeHead(200, { 'Content-Type': TYPEN[p === '/sw.js' ? '.js' : '.html'], 'Service-Worker-Allowed': '/' });
        res.end(text); return;
      }
      // Nur fuer den Deckel-Fall: beliebig viele unterscheidbare „Kacheln".
      // Ein echtes 1x1-PNG, damit der Service Worker es als Bild behandelt.
      if (p.startsWith('/__kachel/')) {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
          'base64'));
        return;
      }
      if (p === '/') p = '/index.html';
      // Kein Ausbruch aus dem Repo — der Server steht nur fuer diesen Lauf.
      const datei = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
        res.writeHead(404); res.end('nicht da'); return;
      }
      res.writeHead(200, {
        'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
        'Service-Worker-Allowed': '/',
      });
      fs.createReadStream(datei).pipe(res);
    });
    s.listen(wunschPort || 0, '127.0.0.1', () => fertig({ s, port: s.address().port }));
  });
}

(async () => {
  const { s, port } = await server();
  const basis = 'http://127.0.0.1:' + port;
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(e.message.split('\n')[0]));

  console.log('\n=== offline_check — hält die PWA, was sie ohne Empfang verspricht?');
  let kaputt = 0;
  const melde = (name, ok, info) => {
    if (ok) console.log('  ok   ' + name + (info ? '   [' + info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + name + '\n         → ' + info); }
  };

  // ── 1 · Installiert sich der Service Worker? ─────────────────────────
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  let bereit = false;
  try {
    bereit = await p.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const r = await Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise(z => setTimeout(() => z(false), 20000)),
      ]);
      return !!r;
    });
  } catch (_) {}
  melde('Der Service Worker installiert sich', bereit,
        bereit ? 'navigator.serviceWorker.ready' : 'kein aktiver Service Worker nach 20 s — alles Weitere prueft dann nichts');
  if (!bereit) { await br.close(); s.close(); process.exitCode = 1; return; }

  // Dem Vor-Cachen Zeit geben (2,1 MB Artenliste ueber die Schleife).
  await p.waitForTimeout(4000);

  // ── 2 · Liegt im Shell-Cache, was SHELL_URLS verspricht? ─────────────
  const swQuelle = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  const mListe = swQuelle.match(/const SHELL_URLS = \[([\s\S]*?)\n\];/);
  const versprochen = mListe
    ? [...mListe[1].matchAll(/^\s*'([^']+)'/gm)].map(x => x[1])
    : [];
  const version = (swQuelle.match(/const VERSION = '([^']+)'/) || [])[1] || '';

  const shellStand = await p.evaluate(async (v) => {
    const c = await caches.open(v + '-shell');
    const drin = (await c.keys()).map(r => r.url);
    return drin;
  }, version);
  const fehlend = versprochen.filter(u => {
    if (/^https?:/.test(u)) return !shellStand.some(x => x === u);      // pdf.js: CDN, im Lauf nicht erreichbar
    return !shellStand.some(x => x.endsWith(u) || x === basis + u);
  }).filter(u => !/^https?:/.test(u));   // externe Quellen sind hier nicht pruefbar
  // Grenze, damit sie niemand neu entdeckt: EXTERNE Quellen (pdf.js vom CDN)
  // sind von hier aus nicht erreichbar — die Netz-Richtlinie der Cloud-Umgebung
  // laesst nichts ausserhalb der Freigabeliste durch. Sie werden deshalb
  // ausgenommen und die Zahl sagt, wie viele das waren.
  const extern = versprochen.filter(u => /^https?:/.test(u)).length;
  melde('Der Shell-Cache enthält, was SHELL_URLS verspricht', fehlend.length === 0,
        fehlend.length ? fehlend.length + ' von ' + (versprochen.length - extern) + ' fehlen: ' + fehlend.slice(0, 5).join(', ')
                       : shellStand.length + ' Einträge, keine Lücke (' + extern + ' externe Quelle' +
                         (extern === 1 ? '' : 'n') + ' hier nicht prüfbar)');

  // ── 3 · Liegt dieselbe Datei doppelt auf dem Geraet? ─────────────────
  //
  // Diese Frage MUSS vor dem Abschalten kommen — und nach einem zweiten
  // Besuch MIT Netz. Grund: beim ersten Besuch installiert sich der Service
  // Worker erst waehrend die Seite laedt, er sieht ihre Unterdateien also
  // gar nicht. Erst beim zweiten Aufruf greift er auf jede einzelne zu, und
  // erst dann kann ueberhaupt eine zweite Kopie entstehen.
  //
  // Ohne diesen Schritt waere die Frage gruen, auch wenn die Weiche zum
  // Shell-Cache ganz fehlte — sie pruefte dann nur, dass nichts passiert.
  // (Gegenprobe gemacht: Weiche aus → diese Zeile meldet, mit Weiche → still.)
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  const doppelt = await p.evaluate(async () => {
    const namen = await caches.keys();
    const wo = {};
    for (const n of namen) {
      const c = await caches.open(n);
      for (const r of await c.keys()) {
        const u = new URL(r.url);
        const k = u.pathname + u.search;
        (wo[k] = wo[k] || []).push(n);
      }
    }
    return Object.entries(wo).filter(([, l]) => l.length > 1).map(([u, l]) => u + ' in ' + l.join(' + '));
  });
  melde('Keine Datei liegt in zwei Caches gleichzeitig', doppelt.length === 0,
        doppelt.length ? doppelt.length + '× doppelt: ' + doppelt.slice(0, 4).join(' · ') : 'jede Datei genau einmal');

  // ── 4 · Startet die App ohne Netz? ───────────────────────────────────
  s.close();                                   // das Netz ist jetzt wirklich weg
  await ctx.setOffline(true);
  fehler.length = 0;
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const ohneNetz = await p.evaluate(() => ({
    arten: (typeof DB !== 'undefined' && DB && DB.length) ? DB.length : 0,
    version: window.GS_VERSION || null,
    app: !!document.getElementById('app'),
    leaflet: typeof window.L !== 'undefined',
  }));
  melde('Die App startet ohne Netz — mit allen Arten', ohneNetz.arten >= 4000 && !!ohneNetz.version,
        ohneNetz.arten >= 4000 ? ohneNetz.arten + ' Arten · ' + ohneNetz.version + ' · Leaflet ' + (ohneNetz.leaflet ? 'da' : 'fehlt')
          : 'nur ' + ohneNetz.arten + ' Arten geladen (Version ' + ohneNetz.version + ') — ohne Artenliste bestimmt die App nichts');

  // ── 5 · Der Fall, der zählt: Runtime-Cache verdrängt ─────────────────
  //
  // Browser verdrängen Caches EINZELN, wenn der Speicher knapp wird. Der
  // Shell-Cache ist der, der überleben soll — dafür wird er vorgeladen.
  // Diese Prüfung stellt genau das her: Runtime weg, Shell da.
  const nachRaeumung = await p.evaluate(async (v) => {
    const raus = (await caches.keys()).filter(k => k.indexOf('-shell') < 0);
    await Promise.all(raus.map(k => caches.delete(k)));
    // Direkt den Service Worker fragen, so wie es die Seite täte.
    const proben = ['/data/plants.v1.js?v=1', '/assets/leaflet.js', '/assets/three.min.js'];
    const raus2 = {};
    for (const u of proben) {
      try {
        const r = await fetch(u);
        raus2[u] = (r && r.ok) ? r.status : (r ? r.status : 'kein Ergebnis');
      } catch (e) { raus2[u] = 'Fehler: ' + (e.message || e); }
    }
    return { geloescht: raus, ergebnis: raus2 };
  }, version);
  const verloren = Object.entries(nachRaeumung.ergebnis).filter(([, v]) => v !== 200);
  melde('Eine vorgeladene Datei überlebt die Verdrängung des Runtime-Caches', verloren.length === 0,
        verloren.length
          ? verloren.map(([u, v]) => u + ' → ' + v).join(' · ') +
            '  (vorgeladen im Shell-Cache, aber nicht von dort ausgeliefert)'
          : 'alle drei aus dem Shell-Cache bedient');

  // ── 6-8 · Die Warteschlange: überlebt, was offline eingereiht wurde? ──
  //
  // Das zweite Versprechen dieser App an einen Ort ohne Empfang: „📵 Offline
  // gespeichert — wird beim nächsten Online übertragen." Wer das sagt, muss
  // es halten; ein Fund, der beim Aufräumen verschwindet, ist schlimmer als
  // einer, der gar nicht erst angenommen wird.
  //
  // Drei Ablagen, drei Zuständigkeiten:
  //   `pending_scans/diary/sync` → gsFlushOfflineQueue (überträgt)
  //   `pending_photos`           → gsFlushPhotoQueue   (lädt hoch, zählt Versuche)
  //   `dropped_entries`          → NIEMAND (Archiv, v31.08, nur lesen)
  await ctx.setOffline(false);
  // Denselben Port zurueckfordern: ein anderer waere ein anderer URSPRUNG, und
  // damit eine andere IndexedDB. Der Fall waere dann ein anderer als der echte.
  const { s: s3 } = await server(port);
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3000);

  const q = await p.evaluate(async () => {
    const zaehle = (store) => new Promise((fertig) => {
      const rq = indexedDB.open('gs_offline', 3);
      rq.onsuccess = () => {
        try {
          const db = rq.result;
          const c = db.transaction(store, 'readonly').objectStore(store).count();
          c.onsuccess = () => fertig(c.result);
          c.onerror = () => fertig(-1);
        } catch (e) { fertig(-1); }
      };
      rq.onerror = () => fertig(-1);
    });
    // Damit der Scan-Weg nicht am fehlenden Netz scheitert: er soll gelingen,
    // dann MUSS sein Eintrag verschwinden — das ist die Gegenprobe dazu, dass
    // der Flush ueberhaupt noch etwas tut.
    window.gsScanPersistToCloud = async () => true;
    // v32.22: Seit die Warteschlange nach dem EIGENTUEMER fragt, ist
    // „angemeldet" nicht mehr nur ein Token — es braucht eine uid. Der
    // Prüfstand stellt deshalb beides her, sonst prüft er einen Flush, der
    // gleich in der ersten Zeile aussteigt.
    localStorage.setItem('gs_sb_uid', 'nutzer-A');
    window.sbIsLoggedIn = () => true;

    const ref = await window.gsQueuePhoto('scans', 'AAAA', { kind: 'find', ref: 'test-1' });
    const arch = await window.gsArchiveDropped('gs_gartentagebuch', [{ a: 1 }, { a: 2 }]);
    await window.gsQueueOffline('scan', { name: 'Bärlauch' });

    const vor = { fotos: await zaehle('pending_photos'), archiv: await zaehle('dropped_entries'), scans: await zaehle('pending_scans') };
    await window.gsFlushOfflineQueue();
    await new Promise(r => setTimeout(r, 600));
    const nach = { fotos: await zaehle('pending_photos'), archiv: await zaehle('dropped_entries'), scans: await zaehle('pending_scans') };
    return { ref: ref, arch: arch, vor: vor, nach: nach, archivZaehler: await window.gsArchiveCount() };
  });
  s3.close();

  // Die Gegenprobe zu den beiden darunter: der Flush MUSS noch etwas tun.
  // Ohne diesen Fall waeren sie auch dann gruen, wenn man ihn ganz entfernt.
  const scanOk = q.vor.scans >= 1 && q.nach.scans === 0;
  melde('Der Flush räumt seine eigenen Ablagen — der übertragene Scan geht raus', scanOk,
        scanOk ? q.vor.scans + ' eingereiht → 0 übrig'
          : (q.vor.scans < 1 ? 'der Scan wurde gar nicht erst eingereiht — dann prüft der Rest nichts'
                             : 'der übertragene Scan bleibt liegen (' + q.nach.scans + ')'));

  const fotoOk = q.vor.fotos >= 1 && q.nach.fotos === q.vor.fotos;
  melde('Ein offline eingereihtes Foto überlebt den Flush', fotoOk,
        fotoOk ? q.vor.fotos + ' Foto in der Warteschlange, ' + q.nach.fotos + ' danach — bleibt für gsFlushPhotoQueue'
          : (q.vor.fotos < 1 ? 'das Foto wurde nicht eingereiht (' + q.ref + ')'
             : 'von ' + q.vor.fotos + ' Foto(s) sind nach dem Flush ' + q.nach.fotos + ' übrig — gelöscht, bevor sie je hochgeladen wurden; der Platzhalter ' + q.ref + ' zeigt danach ins Leere'));

  const archOk = q.arch === 2 && q.nach.archiv >= 2 && q.archivZaehler >= 2;
  melde('Das Archiv gekürzter Einträge überlebt den Flush', archOk,
        archOk ? q.nach.archiv + ' archivierte Einträge unangetastet (gsArchiveCount: ' + q.archivZaehler + ')'
          : (q.arch !== 2 ? 'es wurde gar nicht archiviert (' + q.arch + ')'
             : 'von ' + q.vor.archiv + ' archivierten Einträgen sind ' + q.nach.archiv + ' übrig (gsArchiveCount meldet ' + q.archivZaehler + ') — das Sicherheitsnetz aus v31.08 wird bei jedem Start geleert'));

  // ── 9 · Und kommt es danach auch wirklich an? ────────────────────────
  //
  // Ohne diese Frage prueft die vorige nur, dass ein Eintrag LIEGEN BLEIBT —
  // und das taete er auch, wenn ihn nie jemand abholte. Der zustaendige Flush
  // muss ihn hochladen UND danach entfernen.
  const { s: s4 } = await server(port);
  const foto = await p.evaluate(async () => {
    const zaehle = () => new Promise((fertig) => {
      const rq = indexedDB.open('gs_offline', 3);
      rq.onsuccess = () => {
        try {
          const c = rq.result.transaction('pending_photos', 'readonly').objectStore('pending_photos').count();
          c.onsuccess = () => fertig(c.result); c.onerror = () => fertig(-1);
        } catch (e) { fertig(-1); }
      };
      rq.onerror = () => fertig(-1);
    });
    const hoch = [];
    localStorage.setItem('gs_sb_uid', 'nutzer-A');
    window.sbIsLoggedIn = () => true;
    window.gsUploadImage = async (b64, bucket, ext, key) => { hoch.push(bucket + '/' + key); return 'https://x/' + key + '.jpg'; };
    const vor = await zaehle();
    const done = await window.gsFlushPhotoQueue();
    await new Promise(r => setTimeout(r, 400));
    return { vor: vor, nach: await zaehle(), hoch: hoch, done: done };
  });
  s4.close();
  const fq = foto.vor >= 1 && foto.hoch.length >= 1 && foto.nach === 0;
  melde('Der Foto-Flush lädt das Wartende hoch und räumt erst dann', fq,
        fq ? foto.hoch.length + '× hochgeladen (' + foto.hoch[0] + '), Warteschlange danach leer'
          : (foto.vor < 1 ? 'nichts in der Warteschlange — dann prüft dieser Fall nichts'
             : (foto.hoch.length ? 'hochgeladen, aber ' + foto.nach + ' bleiben liegen'
                                 : 'kein einziger Upload versucht (' + foto.vor + ' warteten)')));

  // ── 10 · Wächst der Bild-Cache unbegrenzt? ───────────────────────────
  //
  // Regel 4 legt jedes Bild ab — Kartenkacheln eingeschlossen. Eine
  // Wanderung auf Zoomstufe 16 zieht Tausende davon. Ohne Deckel wächst
  // der Cache bis zum nächsten Versionswechsel, und geht dem Gerät der
  // Platz aus, räumt mancher Browser den GANZEN Ursprung ab — mitsamt
  // localStorage, wo der Garten-Zwilling liegt.
  //
  // Dieser Fall fährt den ECHTEN Weg: er holt die Kacheln wirklich durch
  // den Service Worker, statt den Cache von aussen zu füllen. Nur so ist
  // auch geprüft, dass der Deckel überhaupt ausgelöst wird.
  const { s: s5 } = await server(port);
  const deckel = await p.evaluate(async () => {
    // Weit ueber den Deckel hinaus holen, sonst ist „gedeckelt" und
    // „nicht gedeckelt" nicht zu unterscheiden: die echte Obergrenze ist
    // ZIEL + INTERVALL, hier also rund 550 + das gleichzeitig Unterwegse.
    const grenze = 500, intervall = 50, hole = 900;
    const zaehle = async () => {
      const namen = (await caches.keys()).filter(n => n.indexOf('-images') > 0);
      let n = 0;
      for (const k of namen) n += (await (await caches.open(k)).keys()).length;
      return n;
    };
    // In Schüben, sonst öffnet der Browser 560 Verbindungen auf einmal.
    for (let i = 0; i < hole; i += 40) {
      const teil = [];
      for (let j = i; j < Math.min(i + 40, hole); j++) teil.push(fetch('/__kachel/' + j + '.png'));
      await Promise.all(teil).catch(() => {});
    }
    await new Promise(r => setTimeout(r, 1200));   // dem Deckel Zeit lassen
    return { geholt: hole, grenze: grenze, obergrenze: grenze + intervall + 70, drin: await zaehle() };
  });
  s5.close();
  const dOk = deckel.drin > 0 && deckel.drin <= deckel.obergrenze;
  melde('Der Bild-Cache hat eine Obergrenze', dOk,
        dOk ? deckel.geholt + ' Kacheln geholt → ' + deckel.drin + ' im Cache (Ziel ' + deckel.grenze +
              ', geprüft alle 50 → Obergrenze ' + deckel.obergrenze + ')'
          : (deckel.drin === 0 ? 'gar nichts gecacht — dann prüft dieser Fall nichts'
             : deckel.geholt + ' Kacheln geholt, ' + deckel.drin + ' liegen im Cache (erlaubt bis ' +
               deckel.obergrenze + ') — der Deckel greift nicht; auf einer Wanderung wächst er ungebremst'));

  // ── 11-13 · Wem gehört ein Eintrag in der Warteschlange? ─────────────
  //
  // v31.04 hat genau diesen Fehler im localStorage behoben: `gs_sync_queue`
  // überlebte den Logout, die `user_id` wird aber erst BEIM FLUSH eingesetzt —
  // ungesendete Vorgänge von Nutzer A landeten im Konto von Nutzer B. In
  // IndexedDB stand er weiter, und dort geht es um Scans und um Fotos.
  //
  // Jeder Fall wird ZWEIMAL gefahren: einmal als der Fremde (nichts darf
  // passieren) und einmal als der Eigentümer (es MUSS passieren). Nur die
  // zweite Hälfte unterscheidet „schützt richtig" von „tut gar nichts mehr" —
  // dieselbe Lehre wie beim Doppelspeicher-Fall in v32.13.
  const { s: s6 } = await server(port);
  const eig = await p.evaluate(async () => {
    const zaehle = (store) => new Promise((fertig) => {
      const rq = indexedDB.open('gs_offline', 3);
      rq.onsuccess = () => {
        try {
          const c = rq.result.transaction(store, 'readonly').objectStore(store).count();
          c.onsuccess = () => fertig(c.result); c.onerror = () => fertig(-1);
        } catch (e) { fertig(-1); }
      };
      rq.onerror = () => fertig(-1);
    });
    const alsWer = (uid) => { localStorage.setItem('gs_sb_uid', uid); };
    const hoch = [];
    const gesendet = [];
    window.sbIsLoggedIn = () => true;
    window.gsUploadImage = async (b64, bucket, ext, key) => { hoch.push(bucket + '/' + key); return 'https://x/' + key + '.jpg'; };
    window.gsScanPersistToCloud = async (d) => { gesendet.push(d && d.name); return true; };

    // A reiht ein: ein Scan, ein Foto, zwei Archiv-Einträge
    alsWer('nutzer-A');
    // Eigene Grundlinie messen: Fall 8 hat als A bereits archiviert. Ein Fall,
    // der eine feste Zahl erwartet, geht bei der nächsten Erweiterung kaputt,
    // ohne dass irgendetwas am Code falsch wäre.
    const archivVor = await window.gsArchiveCount();
    await window.gsQueueOffline('scan', { name: 'Bärlauch von A' });
    await window.gsQueuePhoto('scans', 'AAAA', { kind: 'find', ref: 'a-1' });
    await window.gsArchiveDropped('gs_gartentagebuch', [{ a: 1 }, { a: 2 }]);
    const nachA = { scans: await zaehle('pending_scans'), fotos: await zaehle('pending_photos') };
    const zaehlerA = await window.gsCountOfflineQueue();
    const archivA = await window.gsArchiveCount();

    // B meldet sich an und flusht: nichts von A darf rausgehen — und nichts
    // von A darf verschwinden.
    alsWer('nutzer-B');
    await window.gsFlushOfflineQueue();
    await window.gsFlushPhotoQueue();
    await new Promise(r => setTimeout(r, 500));
    const alsB = {
      scans: await zaehle('pending_scans'), fotos: await zaehle('pending_photos'),
      gesendet: gesendet.length, hoch: hoch.length,
      zaehler: await window.gsCountOfflineQueue(), archiv: await window.gsArchiveCount(),
    };

    // A kommt zurück: jetzt MUSS beides rausgehen.
    alsWer('nutzer-A');
    await window.gsFlushOfflineQueue();
    await window.gsFlushPhotoQueue();
    await new Promise(r => setTimeout(r, 500));
    const zurueck = {
      scans: await zaehle('pending_scans'), fotos: await zaehle('pending_photos'),
      gesendet: gesendet.length, hoch: hoch.length, archiv: await window.gsArchiveCount(),
    };
    return { nachA, zaehlerA, archivVor, archivA, alsB, zurueck };
  });
  s6.close();

  const scanOwn = eig.nachA.scans >= 1 && eig.alsB.scans === eig.nachA.scans && eig.alsB.gesendet === 0
                  && eig.zurueck.gesendet >= 1 && eig.zurueck.scans === 0;
  melde('Ein offline eingereihter Scan geht nur an das Konto, das ihn gemacht hat', scanOwn,
        scanOwn ? 'als B: 0 gesendet, ' + eig.alsB.scans + ' liegen geblieben · als A: ' + eig.zurueck.gesendet + ' gesendet, 0 übrig'
          : (eig.nachA.scans < 1 ? 'nichts eingereiht — dann prüft dieser Fall nichts'
             : (eig.alsB.gesendet ? 'B hat den Scan von A ins eigene Konto geschrieben'
                : (eig.alsB.scans < eig.nachA.scans ? 'B hat den Scan von A gelöscht statt liegen zu lassen'
                   : 'A bekam den eigenen Scan nicht mehr raus (' + eig.zurueck.scans + ' übrig)'))));

  const fotoOwn = eig.nachA.fotos >= 1 && eig.alsB.fotos === eig.nachA.fotos && eig.alsB.hoch === 0
                  && eig.zurueck.hoch >= 1 && eig.zurueck.fotos === 0;
  melde('Ein offline eingereihtes Foto landet nicht im Speicher des nächsten Nutzers', fotoOwn,
        fotoOwn ? 'als B: 0 Uploads, ' + eig.alsB.fotos + ' liegen geblieben · als A: ' + eig.zurueck.hoch + ' hochgeladen, 0 übrig'
          : (eig.nachA.fotos < 1 ? 'kein Foto eingereiht — dann prüft dieser Fall nichts'
             : (eig.alsB.hoch ? 'B hat das Foto von A in den eigenen Bucket geladen'
                : 'A bekam das eigene Foto nicht mehr raus (' + eig.zurueck.fotos + ' übrig)')));

  const neuArchiviert = eig.archivA - eig.archivVor;
  const zOk = eig.zaehlerA === 2 && eig.alsB.zaehler === 0 && neuArchiviert === 2 && eig.alsB.archiv === 0;
  melde('Zähler und Archiv zeigen nur das eigene — und nur was wirklich wartet', zOk,
        zOk ? 'A: 2 wartend (Scan + Foto, Archiv zählt nicht mit), +2 archiviert · B: 0 und 0'
          : 'A meldet ' + eig.zaehlerA + ' wartend (erwartet 2) und +' + neuArchiviert + ' archiviert (erwartet +2); '
            + 'B meldet ' + eig.alsB.zaehler + ' und ' + eig.alsB.archiv + ' (erwartet 0 und 0)');

  // ── 11 · Versionswechsel ohne Klick (v33.25) ──────────────────────────
  // Der Ablauf, den eine Person auf dem Telefon erlebt: die App laeuft, ein
  // neuer Worker kommt (Deploy), die App sichert — und wendet ihn erst an,
  // wenn sie nach ≥ 5 min Abwesenheit zurueckkommt. Jede Gegenrichtung stellt
  // ihren Zustand wirklich her und zaehlt die Navigationen des Hauptrahmens.
  {
    const { s: s7 } = await server(port);   // der Server des vorigen Falls ist geschlossen
    const swQ = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
    const vAlt = (swQ.match(/const VERSION = '([^']+)'/) || [])[1] || '';
    // (a) Erstbesuch in einem FRISCHEN Kontext: der Uebergang „kein Controller →
    //     Worker" (clients.claim) feuert controllerchange — und darf NICHT laden.
    let navErst = 0;
    {
      const ctxE = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'allow' });
      const e = await ctxE.newPage();
      // v33.43: NUR echte Dokument-Ladungen zaehlen. `framenavigated` feuert
      // auch fuer history.pushState/back im selben Dokument — seit die App
      // einen Verlaufs-Eintrag fuer den Android-Zurueck-Knopf setzt, waere das
      // ein Reload, der keiner ist. `domcontentloaded` gibt es nur einmal je
      // geladenem Dokument.
      e.on('domcontentloaded', () => { navErst++; });
      await e.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await e.waitForTimeout(9000);
      await ctxE.close();
    }
    melde('Erstbesuch: der erste Worker uebernimmt (claim), und die Seite laedt NICHT neu', navErst === 1,
          navErst === 1 ? '1 Navigation (das goto) — controllerchange beim Erstbesuch ist keine Version' : navErst + ' Navigationen beim Erstbesuch');

    // Zwei frische Tabs im bestehenden Kontext (der Worker ist aktiv): q wendet an, z ist der Zweit-Tab.
    try { await p.close(); } catch (_) {}
    const q = await ctx.newPage(), z = await ctx.newPage();
    let navQ = 0, navZ = 0;
    q.on('domcontentloaded', () => { navQ++; });
    z.on('domcontentloaded', () => { navZ++; });
    q.on('pageerror', e => fehler.push('Fall 11: ' + e.message.split('\n')[0]));
    for (const seite of [q, z]) {
      await seite.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await seite.waitForTimeout(3500);
      await seite.evaluate(() => {
        // Angemeldet (frisch) — sonst sichert die App nichts; Sichern und Flush gestellt, gezaehlt.
        const bis = new Date(Date.now() + 3600 * 1000).toISOString();
        localStorage.setItem('gs_sb_token', 'x.y.z'); localStorage.setItem('gs_sb_uid', 'u-update'); localStorage.setItem('gs_sb_expires', String(Date.now() + 3600 * 1000)); localStorage.setItem('gs_sb_expires_at', bis);
        localStorage.setItem('gs_snapshot_last', new Date(Date.now() - 7200 * 1000).toISOString());
        localStorage.setItem('gs_sync_last_push', new Date().toISOString());
        window.__snap = 0; window.__flush = 0;
        window.gsSnapshotCreate = async function(t){ window.__snap++; window.__snapTrig = t; return 'snap-' + window.__snap; };
        if (window.gsCloudSync) gsCloudSync.flushNow = function(){ window.__flush++; };
      });
    }
    const hatte = await q.evaluate(() => !!(window._gsUpdate && window._gsUpdate.hatteController));
    melde('Ein Tab, der unter einem aktiven Worker startet, weiss das (hatteController)', hatte, hatte ? 'true' : 'false — der Zweit-Tab-Weg waere blind');

    // (b) Neuer Worker mit ANDERER Version: reg.update() → waiting; die App sichert sofort (sichtbar, ruhig).
    versionErsatz = 'vTEST2';
    await q.evaluate(() => { try { window._gsSwReg.update(); } catch (_) {} });
    let wartet = false;
    for (let i = 0; i < 40 && !wartet; i++) { await q.waitForTimeout(500); wartet = await q.evaluate(() => !!(window._gsSwReg && window._gsSwReg.waiting && window._gsUpdate && window._gsUpdate.wartend)); }
    const gesichert = await q.evaluate(() => ({ snap: window.__snap, flush: window.__flush, trig: window.__snapTrig }));
    melde('Ein neuer Worker wartet — die App sichert sofort (flushNow + pre_migration), wendet aber noch nichts an', wartet && gesichert.snap >= 1 && gesichert.flush >= 1 && gesichert.trig === 'pre_migration' && navQ === 1,
          wartet ? ('Snapshot ' + gesichert.snap + '× (' + gesichert.trig + ') · flushNow ' + gesichert.flush + '× · Navigationen ' + navQ) : 'kein wartender Worker nach 20 s');

    // (c) Gegenrichtungen: jeder Zustand fuer sich; nie eine Navigation.
    const probe = async (aufbau, abbau, erwartet) => {
      // Laedt die Seite waehrend der Probe neu, stirbt evaluate — genau das ist
      // dann der Befund (die Gegenprobe „Fenster-Pruefung entfernt" endet so).
      let r = null;
      try {
        r = await q.evaluate(async ([auf, ab]) => {
          try { (new Function(auf))(); } catch (e) { return { fehler: 'Aufbau: ' + e.message }; }
          const res = await window.gsUpdateAnwenden('rueckkehr');
          try { (new Function(ab))(); } catch (_) {}
          return res;
        }, [aufbau, abbau]);
      } catch (e) { r = { ok: true, grund: 'Seite hat waehrend der Probe neu geladen (' + String(e.message).slice(0, 60) + ')' }; }
      await q.waitForTimeout(600);
      return { ok: r && r.ok === false && String(r.grund || '').indexOf(erwartet) >= 0 && navQ === 1, grund: r && (r.grund || r.fehler) };
    };
    const proben = [
      ['fenster', "openModal('detail-modal');", "closeModal('detail-modal');"],
      ['quiz', "window.__dq = _dqOpen; _dqOpen = true;", "_dqOpen = window.__dq;"],
      ['ki', "window._gsAiLaufend = 1;", "window._gsAiLaufend = 0;"],
      ['eingabe', "var t=document.createElement('textarea');t.id='__probe';t.value='halb fertig';document.body.appendChild(t);", "document.getElementById('__probe').remove();"],
      ['kamera', "window._gsKameraStreams.push({ getTracks: function(){ return [{ readyState: 'live' }]; } });", "window._gsKameraStreams = [];"],
      ['zahlung', "window._gsBillingPopup = true;", "window._gsBillingPopup = false;"],
      ['dateiwahl', "window._gsDateiwahlOffen = true;", "window._gsDateiwahlOffen = false;"],
    ];
    const rot = [];
    for (const [erw, auf, ab] of proben) { const r = await probe(auf, ab, erw); if (!r.ok) rot.push(erw + ' (Antwort: ' + r.grund + ')'); }
    melde('Kein Reload, solange etwas laeuft oder liest: Fenster · Quiz · KI · Text im Feld · Kamera · Zahlung · Dateiauswahl', rot.length === 0 && navQ === 1,
          rot.length ? rot.join(' · ') : proben.length + ' Zustaende hergestellt, jeder verweigert mit seinem Grund, 0 Navigationen');

    // (d) Loop-Schutz: ein zweiter Versuch auf DIESELBE Zielversion → Banner statt Reload.
    const loop = await q.evaluate(async () => {
      sessionStorage.setItem('gs_update_versuch', JSON.stringify({ nach: 'vTEST2', n: 1 }));
      const r = await window.gsUpdateAnwenden('rueckkehr');
      const b = document.getElementById('gs-sw-update-banner');
      const out = { grund: r && r.grund, banner: !!b, bannerGrund: b && b.getAttribute('data-grund') };
      if (b) b.remove(); sessionStorage.removeItem('gs_update_versuch'); window._gsUpdate.bannerGeschlossen = false;
      return out;
    });
    await q.waitForTimeout(600);
    melde('Loop-Schutz: zweiter Versuch auf dieselbe Zielversion → Banner, kein Reload', loop.grund === 'loop' && loop.banner && loop.bannerGrund === 'loop' && navQ === 1,
          'Antwort ' + loop.grund + ' · Banner ' + loop.banner + ' (' + loop.bannerGrund + ') · Navigationen ' + navQ);

    // (e) Zurueck nach 60 s: zu kurz — nichts passiert.
    await q.evaluate(() => { window._gsUpdate.hiddenSeit = performance.now() - 60 * 1000; window._gsUpdateBeiRueckkehr(); });
    await q.waitForTimeout(2500);
    melde('Zurueck nach einer Minute: das Update wartet weiter (kein Reload)', navQ === 1, navQ === 1 ? '0 Navigationen' : (navQ - 1) + ' Navigation(en) nach 60 s Abwesenheit');

    // (f) Zurueck nach 6 min: anwenden → genau ein Reload, neue Version, Tab wieder da, Zweit-Tab laedt mit.
    await q.evaluate(() => { try { switchTab('wissen'); } catch (_) {} });
    await q.waitForTimeout(400);
    const navQvor = navQ, navZvor = navZ;
    const nachher = q.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 40000 }).then(() => true).catch(() => false);
    try { await q.evaluate(() => { window._gsUpdate.hiddenSeit = performance.now() - 6 * 60 * 1000; window._gsUpdateBeiRueckkehr(); }); } catch (_) {}
    const geladen = await nachher;
    await q.waitForTimeout(4000);
    let stand = { caches: [], ctl: null, tab: null, versuch: 'unbekannt', zurueck: 'unbekannt', gsv: null, toast: false };
    try {
      stand = await q.evaluate(async () => {
        const keys = await caches.keys();
        const ctl = navigator.serviceWorker.controller;
        const ver = await new Promise(res => { try { const ch = new MessageChannel(); ch.port1.onmessage = e => res(e.data && e.data.version); ctl.postMessage({ type: 'GET_VERSION' }, [ch.port2]); setTimeout(() => res(null), 1500); } catch (_) { res(null); } });
        return { caches: keys, ctl: ver, tab: (typeof _gsCurrentTab !== 'undefined' ? _gsCurrentTab : null), versuch: sessionStorage.getItem('gs_update_versuch'), zurueck: sessionStorage.getItem('gs_update_zurueck'),
                 gsv: (typeof GS_VERSION !== 'undefined' ? GS_VERSION : null), toast: /Aktualisiert auf vTEST2/.test(document.body.innerText || '') };
      });
    } catch (_) {}
    const neuDa = stand.caches.some(k => k.indexOf('gs-vTEST2') === 0), altWeg = !stand.caches.some(k => k.indexOf(vAlt) === 0);
    const okF = geladen && (navQ - navQvor) === 1 && neuDa && altWeg && stand.ctl === 'gs-vTEST2' && stand.gsv === 'vTEST2' && stand.tab === 'wissen' && stand.versuch === null && stand.zurueck === null;
    melde('Zurueck nach sechs Minuten: das Update wird angewandt — ein Reload, neue Caches, alte weg, der Worker sagt gs-vTEST2, der Tab „wissen" ist wieder da, Loop-Zaehler geloescht', okF,
          okF ? ('1 Navigation · Caches ' + stand.caches.filter(k => k.indexOf('gs-vTEST2') === 0).length + ' neu, alte (' + vAlt + ') weg · Toast ' + (stand.toast ? 'gesehen' : 'nicht mehr sichtbar'))
              : ('geladen ' + geladen + ' · Navigationen +' + (navQ - navQvor) + ' · Caches ' + stand.caches.join(',') + ' · Worker ' + stand.ctl + ' · GS_VERSION ' + stand.gsv + ' · Tab ' + stand.tab + ' · versuch ' + stand.versuch + ' · zurueck ' + stand.zurueck));
    let zLaed = false;
    for (let i = 0; i < 30 && !zLaed; i++) { await z.waitForTimeout(500); zLaed = (navZ - navZvor) >= 1; }
    melde('Der Zweit-Tab laedt nach dem Wechsel von selbst neu (alte Seite unter neuem Worker gibt es nicht mehr)', zLaed && (navZ - navZvor) === 1,
          zLaed ? '1 Navigation im Zweit-Tab' : 'Zweit-Tab blieb alt (' + (navZ - navZvor) + ' Navigationen)');

    // (g) Gleiche Version, neuer Worker (Kaltstart mit Netz: HTML ist schon neu): umschalten OHNE Reload.
    swAnhang = '// byte-aenderung ' + Date.now();
    await q.evaluate(() => { window.__snap = 0; try { window._gsSwReg.update(); } catch (_) {} });
    let wartet2 = false;
    for (let i = 0; i < 40 && !wartet2; i++) { await q.waitForTimeout(500); wartet2 = await q.evaluate(() => !!(window._gsSwReg && window._gsSwReg.waiting)); }
    const navQ2 = navQ;
    await q.evaluate(() => { window._gsUpdate.hiddenSeit = performance.now() - 6 * 60 * 1000; window._gsUpdateBeiRueckkehr(); });
    // 40 Versuche (20 s): das Anwenden holt notfalls die Worker-Version (2 × 3 s)
    // und sichert (bis 2,5 s), bevor SKIP_WAITING geht. Eine Wartefrist, die
    // KUERZER ist als das Budget der gemessenen Funktion, meldet unter Last rot,
    // ohne dass etwas kaputt waere — genau das ist hier zweimal passiert.
    let ohne = false;
    for (let i = 0; i < 40 && !ohne; i++) { await q.waitForTimeout(500); ohne = await q.evaluate(() => !!(window._gsUpdate && window._gsUpdate.angewandtOhneReload)).catch(() => false); }
    const keinWarten = await q.evaluate(() => !(window._gsSwReg && window._gsSwReg.waiting)).catch(() => false);
    melde('Gleiche Version, neuer Worker: umschalten ohne Reload (die HTML ist schon neu)', wartet2 && ohne && keinWarten && navQ === navQ2,
          wartet2 ? ('angewandtOhneReload ' + ohne + ' · waiting danach ' + !keinWarten + ' · Navigationen +' + (navQ - navQ2)) : 'kein wartender Worker nach 20 s');
    versionErsatz = null; swAnhang = '';
    s7.close();
  }

  // ── 23/24 · v33.48: Die Artenliste hat einen ZWEITEN Versuch ────────
  //
  // Gemessen an v33.47: das Script-Tag hatte kein `onerror`. Faellt die
  // 2,1-MB-Datei aus, ist `DB` leer — und die App sagte beim START nichts.
  // Hier wirklich gefahren: der erste Versuch wird abgebrochen, der zweite
  // durchgelassen (muss sich erholen), und danach beide (muss es SAGEN).
  {
    // Der Hauptserver ist zu diesem Zeitpunkt ZU (ein frueherer Fall geht
    // absichtlich offline). Diese zwei Faelle brauchen ihn wieder — sonst
    // messen sie einen Verbindungsfehler statt der Sache.
    const { s: s8 } = await server(port);
    const lade = async (blockBis) => {
      const c = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
      const q = await c.newPage();
      let n = 0;
      await q.route('**/plants.v1.js*', r => { n++; return (n <= blockBis) ? r.abort() : r.continue(); });
      await q.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await q.waitForTimeout(3200);
      const o = await q.evaluate(() => {
        const el = document.getElementById('home-dayplan');
        const btn = el && el.querySelector('.gs-dp-sync');
        const st = (typeof gsArtenStand === 'function') ? gsArtenStand() : null;
        return {
          db: (window.DB && DB.length) || 0,
          stand: st ? st.zustand : '(fehlt)',
          grund: st ? (st.grund || '') : '',
          zeile: btn ? (btn.textContent || '').replace(/\s+/g, ' ').trim() : ''
        };
      });
      o.anfragen = n;
      await c.close();
      return o;
    };

    const gut = await lade(0);      // nichts blockiert
    const heil = await lade(1);     // nur der erste Versuch faellt aus
    const weg  = await lade(99);    // beide Versuche fallen aus

    // 23 · Der zweite Versuch holt die Liste WIRKLICH zurueck — und zwar
    //      gleichwertig: dieselbe Zahl wie der normale Weg. Die Datei traegt
    //      4'342 Eintraege, die App laeuft mit 4'337; ohne denselben
    //      Dedup-Aufruf liefe der Nachlade-Weg mit fuenf Duplikaten weiter.
    const erholt = heil.anfragen === 2 && heil.db > 0 && heil.db === gut.db && heil.stand === 'ok';
    melde('Faellt die Artenliste aus, holt die App sie nach — gleichwertig, nicht nur irgendwie',
      erholt,
      erholt ? ('normal ' + gut.db + ' Arten in 1 Anfrage · nach Ausfall ' + heil.db + ' in ' + heil.anfragen)
             : ('normal ' + gut.db + ' · nach Ausfall ' + heil.db + ' in ' + heil.anfragen + ' Anfragen, Stand ' + heil.stand));

    // 24 · Geht auch der zweite daneben, ist das ein Zustand MIT Grund, der
    //      auf dem Bildschirm steht — nicht eine leere Liste, die wie
    //      „keine Treffer" aussieht. Gegenrichtung: im guten Fall NICHTS.
    const sagtEs = weg.db === 0 && weg.stand === 'fehlt' && !!weg.grund
                && /artenliste/i.test(weg.zeile) && !gut.zeile && !heil.zeile;
    melde('Geht auch der zweite Versuch daneben, sagt es die Startseite — und sonst nie',
      sagtEs,
      sagtEs ? ('„' + weg.zeile.slice(0, 58) + '…" · Grund: ' + weg.grund + ' · gut und erholt: keine Zeile')
             : ('weg: db=' + weg.db + ' stand=' + weg.stand + ' zeile=„' + weg.zeile.slice(0, 40) + '"'
                + ' · gut: „' + gut.zeile.slice(0, 30) + '" · erholt: „' + heil.zeile.slice(0, 30) + '"'));
    s8.close();
  }

  // ── 25–39 · v33.55: Ein Foto per „Teilen → GreenScan" ───────────────
  //
  // Gemessen an v33.54: das Teilen-Ziel nahm nur Text und Links an (GET, keine
  // Dateien), der Worker kannte kein Teilen, und die Seite sagte „Bild geteilt",
  // obwohl nie eines ankam. Hier wird der Weg GEFAHREN, den Android geht: ein
  // multipart-POST als NAVIGATION (ein Formular mit einer Datei per
  // DataTransfer), gebaut aus dem ECHTEN share_target der manifest.json — damit
  // die Naht Manifest ↔ Worker mitgeprueft ist —, unter einem echten Worker.
  // Die Gegenrichtungen stellen ihren Zustand her: keine Bilddatei, HEIC, leeres
  // Feld, fremde Seite, kein Worker (der Pruefserver wendet `_redirects` an wie
  // der Hoster), das alte Text-Ziel, kein Empfang, ein wartender Worker, Abmelden,
  // die App selbst schliesst die Vorschau, abgemeldet geteilt.
  {
    const { s: s9 } = await server(port);
    let ctxT = null;
    try {
    const ziel = JSON.parse(fs.readFileSync(path.join(WURZEL, 'manifest.json'), 'utf8')).share_target || {};
    const formular = {
      action: ziel.action, method: ziel.method, enctype: ziel.enctype,
      feld: ((ziel.params && ziel.params.files) || [])[0] ? ziel.params.files[0].name : null,
    };
    ctxT = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'allow' });
    const SPAEHER = () => {
      // Kamera-Zaehler UNTER dem Tor der App (v32.33): jede Anfrage kommt hier an.
      window.__gum = 0;
      try {
        const md = navigator.mediaDevices;
        if (md) md.getUserMedia = function () { window.__gum++; return Promise.reject(new DOMException('nein', 'NotAllowedError')); };
      } catch (_) {}
      // Wann ENTSTAND die Teilen-Vorschau, und wann nahm „Bestimmen" an? Gemessen
      // in der Seite (performance.now), nicht am Takt eines Abfrage-Kreises:
      // nur so laesst sich die Dauer der Antipp-Sperre binden (Fall 40).
      window.__vorschauZeiten = [];
      new MutationObserver(ms => ms.forEach(m => {
        if (m.type === 'childList') m.addedNodes.forEach(n => { if (n.id === 'gs-teilen-vorschau') window.__vorschauZeiten.push({ ab: performance.now(), los: null }); });
        else if (m.target && m.target.id === 'gs-teilen-los' && !m.target.disabled) {
          const z = window.__vorschauZeiten[window.__vorschauZeiten.length - 1];
          if (z && z.los == null) z.los = performance.now();
        }
      })).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
      // Jede Meldung, die je auf dem Bildschirm stand — nicht nur die letzte.
      window.__toasts = [];
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          document.querySelectorAll('.gs-toast-body').forEach(b => {
            const t = (b.textContent || '').replace(/\s+/g, ' ').trim();
            if (t && window.__toasts[window.__toasts.length - 1] !== t) window.__toasts.push(t);
          });
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    };
    await ctxT.addInitScript(SPAEHER);
    const t = await ctxT.newPage();
    let ladungenT = 0;
    t.on('domcontentloaded', () => { ladungenT++; });
    t.on('pageerror', e => fehler.push('Teilen: ' + e.message.split('\n')[0]));
    await t.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await t.evaluate(async () => {
      const bis = Date.now() + 3600 * 1000;
      localStorage.setItem('gs_sb_token', 'x.y.z'); localStorage.setItem('gs_sb_uid', 'u-teilen');
      localStorage.setItem('gs_sb_expires', String(bis)); localStorage.setItem('gs_sb_expires_at', new Date(bis).toISOString());
      await Promise.race([navigator.serviceWorker.ready, new Promise(z => setTimeout(z, 20000))]);
    });
    // Unter Kontrolle des Workers: einmal neu laden.
    await t.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await t.waitForTimeout(2500);
    const kontrolliert = await t.evaluate(() => !!navigator.serviceWorker.controller);

    // Schickt ein Formular als NAVIGATION ab — wie das Teilen-Blatt.
    // datei: null (leeres Feld) · {bytes:[…], name, typ} · {jpeg:true} (im Browser gezeichnet)
    const teile = async (seite, datei, nach) => {
      const sha = await seite.evaluate(async ([d, f, z]) => {
        let file = null, sha = null;
        if (d && d.jpeg) {
          const c = document.createElement('canvas'); c.width = 64; c.height = 48;
          const g = c.getContext('2d'); g.fillStyle = '#2e7d32'; g.fillRect(0, 0, 64, 48); g.fillStyle = '#ffeb3b'; g.fillRect(10, 10, 20, 12);
          const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
          const ab = await blob.arrayBuffer();
          sha = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', ab))).map(b => b.toString(16).padStart(2, '0')).join('');
          file = new File([ab], 'foto.jpg', { type: 'image/jpeg' });
        } else if (d) {
          file = new File([new Uint8Array(d.bytes)], d.name, { type: d.typ });
        }
        const form = document.createElement('form');
        form.method = f.method; form.enctype = f.enctype; form.action = z || f.action;
        const i = document.createElement('input'); i.type = 'file'; i.name = f.feld;
        if (file) { const dt = new DataTransfer(); dt.items.add(file); i.files = dt.files; }
        form.appendChild(i); document.body.appendChild(form);
        setTimeout(() => HTMLFormElement.prototype.submit.call(form), 0);
        return sha;
      }, [datei, formular, nach || null]);
      await seite.waitForEvent('domcontentloaded', { timeout: 30000 }).catch(() => {});
      return sha;
    };
    // Wartet auf die Vorschau oder eine Meldung — Versuche zaehlen, nicht die Uhr (v32.61).
    const warteAuf = async (seite, pruef, versuche) => {
      for (let i = 0; i < (versuche || 30); i++) {
        await seite.waitForTimeout(300);
        const r = await seite.evaluate(pruef).catch(() => null);
        if (r) return r;
      }
      return null;
    };
    const stand = (seite) => seite.evaluate(async () => ({
      vorschau: !!document.getElementById('gs-teilen-vorschau'),
      bild: !!document.querySelector('#gs-teilen-vorschau img'),
      adresse: location.pathname + location.search + location.hash,
      cache: await caches.has('gs-geteilt'),
      eintrag: await (async () => { if (!(await caches.has('gs-geteilt'))) return false; const c = await caches.open('gs-geteilt'); return !!(await c.match('/__geteilt/letztes')); })(),
      // Der Start legt die Marke mit null an (index.html); erst analyzeImage setzt das Bild.
      gescannt: typeof window._gsLastScanB64 === 'string' && window._gsLastScanB64.length > 0,
      gum: window.__gum,
      toasts: (window.__toasts || []).slice(),
      ruhig: (typeof _gsAppRuhig === 'function') ? _gsAppRuhig().grund : '(fehlt)',
    })).catch(e => ({
      // Eine Fehlerseite (Navigation gescheitert) hat kein `caches` — das ist
      // ein Befund, kein Absturz des Pruefstands.
      vorschau: false, bild: false, adresse: '(keine App-Seite: ' + String(e.message).split('\n')[0].slice(0, 60) + ')',
      cache: null, eintrag: false, gescannt: false, gum: null, toasts: [], ruhig: '(unbekannt)',
    }));
    const verwerfen = (seite) => seite.evaluate(() => { const b = document.getElementById('gs-teilen-weg'); if (b) b.click(); }).catch(() => {});

    // 25 · Ein JPEG kommt als Vorschau an — gescannt wird NICHTS, die Kamera bleibt aus,
    //      und der POST hat den Server nie erreicht.
    const ankunftVor = ANKUNFT.length;
    const shaGeteilt = await teile(t, { jpeg: true });
    await warteAuf(t, () => !!document.getElementById('gs-teilen-vorschau'));
    const a = await stand(t);
    const postAmServer = ANKUNFT.slice(ankunftVor).filter(x => /^POST /.test(x));
    const nahtOk = formular.method === 'POST' && formular.enctype === 'multipart/form-data' && !!formular.feld;
    const ok25 = nahtOk && kontrolliert && a.vorschau && a.bild && a.adresse === '/' && a.eintrag && !a.gescannt && a.gum === 0 && /teilen/.test(a.ruhig) && postAmServer.length === 0;
    melde('Teilen: ein Foto kommt als VORSCHAU an — der Worker nimmt den POST, Adresse aufgeraeumt, nichts gescannt, Kamera aus, Update haelt still', ok25,
          ok25 ? ('Manifest ' + formular.method + ' ' + formular.action + ' · Feld „' + formular.feld + '" · POST am Server 0× · Adresse „/" · analyzeImage 0× · getUserMedia 0× · _gsAppRuhig: ' + a.ruhig)
               : ('Manifest ' + JSON.stringify(formular) + ' · kontrolliert ' + kontrolliert + ' · Vorschau ' + a.vorschau + ' · Bild ' + a.bild + ' · Adresse „' + a.adresse + '" · Eintrag ' + a.eintrag
                  + ' · gescannt ' + a.gescannt + ' · getUserMedia ' + a.gum + ' · ruhig „' + a.ruhig + '" · am Server ' + JSON.stringify(postAmServer) + ' · Meldungen ' + JSON.stringify(a.toasts)));

    // 26 · Antippen → der Scanner bekommt GENAU diese Bytes, ohne Kamera; der Eintrag ist weg.
    const nach = await t.evaluate(async () => {
      // Ohne Vorschau gibt es nichts anzutippen — dann MELDEN, nicht abstuerzen.
      if (!document.getElementById('gs-teilen-los')) return { dateien: [], fehler: 'keine Vorschau zum Antippen' };
      window.__dateien = []; window.__analyse = 0;
      const orig = window.gsScanDatei;
      window.gsScanDatei = async function (f) {
        const ab = await f.arrayBuffer();
        window.__dateien.push({ typ: f.type, groesse: ab.byteLength,
          sha: Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', ab))).map(b => b.toString(16).padStart(2, '0')).join('') });
        return orig.apply(this, arguments);
      };
      window.analyzeImage = async function () { window.__analyse++; };
      // Der Kamera-Start, nicht erst die Kamera: ohne Freigabe zeigt initScanner
      // zuerst einen Dialog und ruft getUserMedia gar nicht — der Zaehler allein
      // waere dann auch gruen, wenn die Marke ignoriert wuerde.
      window.__init = 0;
      const initOrig = window.initScanner;
      window.initScanner = function () { window.__init++; };
      for (let i = 0; i < 60 && (document.getElementById('gs-teilen-los') || {}).disabled; i++) await new Promise(r => setTimeout(r, 50));   // die Antipp-Sperre (Fall 40)
      document.getElementById('gs-teilen-los').click();
      await new Promise(r => setTimeout(r, 1500));
      window.initScanner = initOrig;
      // Das Foto bleibt, bis ein ERGEBNIS dasteht — ein gescheiterter Scan
      // (kein Netz, KI nicht erreichbar) verloere es sonst.
      const bisErgebnis = await caches.has('gs-geteilt');
      try { showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', family: 'Amaryllidaceae', confidence: 80, alternatives: [], toxicity: 0, edible: true }); } catch (_) {}
      await new Promise(r => setTimeout(r, 400));
      return { dateien: window.__dateien, analyse: window.__analyse, gum: window.__gum, init: window.__init, bisErgebnis,
               tab: (typeof _gsCurrentTab !== 'undefined') ? _gsCurrentTab : null,
               cache: await caches.has('gs-geteilt'), vorschau: !!document.getElementById('gs-teilen-vorschau'),
               ruhig: _gsAppRuhig().grund };
    });
    const d0 = nach.dateien[0] || {};
    const ok26 = nach.dateien.length === 1 && d0.sha === shaGeteilt && d0.typ === 'image/jpeg' && nach.analyse === 1
              && nach.gum === 0 && nach.init === 0 && nach.tab === 'scanner' && nach.bisErgebnis && !nach.cache && !nach.vorschau && !/teilen/.test(nach.ruhig);
    melde('Teilen: „Bestimmen" gibt dem Scanner GENAU die geteilten Bytes — ohne Kamera; das Foto bleibt bis zum Ergebnis, dann ist es weg', ok26,
          ok26 ? ('SHA-256 gleich (' + String(shaGeteilt).slice(0, 12) + '…) · ' + d0.groesse + ' Bytes · analyzeImage 1× · initScanner 0× · getUserMedia 0× · Tab scanner · Foto bleibt bis zum Ergebnis, dann geraeumt')
               : ((nach.fehler ? nach.fehler + ' · ' : '') + 'Dateien ' + JSON.stringify(nach.dateien) + ' (erwartet sha ' + shaGeteilt + ') · analyzeImage ' + nach.analyse + ' · initScanner ' + nach.init + ' · getUserMedia ' + nach.gum
                  + ' · Tab ' + nach.tab + ' · bis zum Ergebnis ' + nach.bisErgebnis + ' · Cache danach ' + nach.cache + ' · Vorschau ' + nach.vorschau + ' · ruhig „' + nach.ruhig + '"'));

    // 27 · Neu laden teilt nicht ein zweites Mal.
    await t.goto(basis + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await t.waitForTimeout(2500);
    const b = await stand(t);
    melde('Teilen: ein Neuladen danach zeigt keine zweite Vorschau', !b.vorschau && !b.cache,
          !b.vorschau ? 'keine Vorschau, kein Cache' : 'Vorschau steht wieder da (Cache ' + b.cache + ')');

    // 28 · Was kein lesbares Foto ist, wird GESAGT — und nie gescannt.
    const gegen = [
      ['kein Bild (Text mit .jpg)', { bytes: Array.from(Buffer.from('Das ist kein Foto, nur Text mit Endung.')), name: 'x.jpg', typ: 'image/jpeg' }, /kein Foto, das GreenScan lesen kann/],
      ['HEIC', { bytes: [0, 0, 0, 0x18].concat(Array.from(Buffer.from('ftypheic')), [0, 0, 0, 0], Array.from(Buffer.from('mif1heic'))), name: 'IMG.heic', typ: 'image/jpeg' }, /HEIC-Format/],
      ['leeres Feld', null, /kein Foto angekommen/],
    ];
    const rot28 = [];
    for (const [name, datei, satz] of gegen) {
      await teile(t, datei);
      await warteAuf(t, (re) => (window.__toasts || []).some(x => new RegExp(re).test(x)) ? true : null, 30);
      const st = await stand(t);
      const getroffen = (st.toasts || []).some(x => satz.test(x));
      if (!getroffen || st.vorschau || st.gescannt || st.cache || st.gum !== 0 || st.adresse !== '/') {
        rot28.push(name + ': Meldungen ' + JSON.stringify(st.toasts) + ' · Vorschau ' + st.vorschau + ' · gescannt ' + st.gescannt + ' · Cache ' + st.cache + ' · Adresse „' + st.adresse + '"');
      }
    }
    melde('Teilen: kein Bild · HEIC · leeres Feld — je ein Satz, keine Vorschau, kein Scan, nichts liegt herum', rot28.length === 0,
          rot28.length ? rot28.join(' | ') : '3 Faelle, je der eigene Satz auf dem Bildschirm, Cache leer, Adresse „/"');

    // 29 · Eine fremde Seite darf kein Foto in die App schieben.
    const tf = await ctxT.newPage();
    tf.on('pageerror', e => fehler.push('Teilen fremd: ' + e.message.split('\n')[0]));
    await tf.goto('http://localhost:' + port + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });   // anderer Ursprung, gleicher Server
    await tf.waitForTimeout(800);
    await teile(tf, { jpeg: true }, basis + formular.action);
    await warteAuf(tf, () => (window.__toasts || []).length ? true : null, 30);
    const f29 = await stand(tf);
    const ok29 = f29.toasts.some(x => /fremde Seite/.test(x)) && !f29.vorschau && !f29.cache && f29.adresse === '/';
    melde('Teilen: ein POST von einer fremden Seite wird abgewiesen — und gesagt', ok29,
          ok29 ? ('Origin http://localhost:' + port + ' → „fremd", kein Eintrag, keine Vorschau') : ('Meldungen ' + JSON.stringify(f29.toasts) + ' · Vorschau ' + f29.vorschau + ' · Cache ' + f29.cache + ' · Adresse „' + f29.adresse + '"'));
    await tf.close();

    // 30 · Das alte Teilen-Ziel (GET mit Text/Link) bekommt einen ehrlichen Satz — und die
    //      ANDEREN Parameter der Adresse bleiben stehen.
    await t.goto(basis + '/?source=pwa&share=1&title=Hallo&text=Welt&url=https%3A%2F%2Fexample.org', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await warteAuf(t, () => (window.__toasts || []).some(x => /Text oder Link/.test(x)) ? true : null, 30);
    const g30 = await stand(t);
    const ok30 = g30.toasts.some(x => /Text oder Link/.test(x)) && !g30.toasts.some(x => /Bild geteilt/.test(x)) && g30.adresse === '/?source=pwa' && !g30.vorschau;
    melde('Teilen: geteilter Text oder Link → „Zum Bestimmen braucht GreenScan ein Foto" statt „Bild geteilt"; ?source=pwa bleibt', ok30,
          ok30 ? 'Satz da, „Bild geteilt" nirgends, Adresse „/?source=pwa"' : ('Meldungen ' + JSON.stringify(g30.toasts) + ' · Adresse „' + g30.adresse + '"'));

    // 31 · Ohne Worker landet der POST beim Hoster — `_redirects` leitet um, die App sagt warum.
    {
      const c = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'block' });
      await c.addInitScript(SPAEHER);
      const n = await c.newPage();
      n.on('pageerror', e => fehler.push('Teilen ohne Worker: ' + e.message.split('\n')[0]));
      await n.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      // Angemeldet — der Fall ist „installiert, aber der Worker ist weg". Ohne
      // Anmeldung wartet der Satz (richtig) auf das Ende des Anmeldebildschirms.
      await n.evaluate(() => { const bis = Date.now() + 3600 * 1000; localStorage.setItem('gs_sb_token', 'x.y.z'); localStorage.setItem('gs_sb_uid', 'u-teilen'); localStorage.setItem('gs_sb_expires', String(bis)); localStorage.setItem('gs_sb_expires_at', new Date(bis).toISOString()); });
      await n.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await n.waitForTimeout(800);
      const vor = ANKUNFT.length;
      await teile(n, { jpeg: true });
      await warteAuf(n, () => (window.__toasts || []).length ? true : null, 30);
      const o = await stand(n);
      const amServer = ANKUNFT.slice(vor).filter(x => /\/teilen$/.test(x));
      const ok31 = o.toasts.some(x => /noch nicht bereit/.test(x)) && o.adresse === '/' && !o.vorschau && amServer.indexOf('POST /teilen') >= 0;
      melde('Teilen ohne Worker: der Hoster leitet /teilen um (_redirects, 303), die App sagt, warum kein Foto da ist', ok31,
            ok31 ? 'POST /teilen am Server → 303 /?teilen=ohne-sw → Satz, Adresse „/"' : ('am Server ' + JSON.stringify(amServer) + ' · Meldungen ' + JSON.stringify(o.toasts) + ' · Adresse „' + o.adresse + '"'));
      await c.close();
    }

    // 32 · Zurueck verlaesst die Vorschau als EINE Schicht — und das Foto bleibt nicht liegen.
    const z32 = await t.evaluate(async () => {
      const c = await caches.open('gs-geteilt');
      const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D, 0x49, 0x48, 0x44, 0x52]);
      sessionStorage.setItem('gs_teilen_nonce', '0123456789abcdef'); window._gsTeilenNonce = '0123456789abcdef';
      // Neun Minuten alt: noch frisch. Gezeigt beginnt die Frist neu.
      await c.put('/__geteilt/letztes', new Response(new Blob([png], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png', 'X-Zeit': String(Date.now() - 9 * 60 * 1000), 'X-Anzahl': '2', 'X-Nonce': '0123456789abcdef' } }));
      const r = await gsTeilenAbholen();
      await new Promise(z => setTimeout(z, 300));
      const neu = await c.match('/__geteilt/letztes');
      const alterNachZeigen = neu ? Date.now() - parseInt(neu.headers.get('X-Zeit') || '0', 10) : null;
      const ov = document.getElementById('gs-teilen-vorschau');
      const mehr = /2 Fotos geteilt/.test((ov || {}).textContent || '');
      const art = gsZurueck();
      await new Promise(z => setTimeout(z, 400));
      return { zustand: r && r.zustand, offen: !!ov, mehr, art, alterNachZeigen, zu: !document.getElementById('gs-teilen-vorschau'), cache: await caches.has('gs-geteilt'), ruhig: _gsAppRuhig().grund };
    });
    const ok32 = z32.zustand === 'vorschau' && z32.offen && z32.mehr && z32.art === 'overlay' && z32.zu && !z32.cache && !/teilen/.test(z32.ruhig)
              && z32.alterNachZeigen !== null && z32.alterNachZeigen < 60 * 1000;
    melde('Teilen: Zurueck schliesst die Vorschau als EINE Schicht und raeumt das Foto; zwei geteilte Fotos werden gesagt; gezeigt beginnt die Frist neu', ok32,
          ok32 ? ('gsZurueck → overlay · Cache geraeumt · „2 Fotos geteilt — bestimmt wird das erste" · 9 min alt gezeigt → Frist neu (' + Math.round(z32.alterNachZeigen / 1000) + ' s)') : JSON.stringify(z32));

    // 37 · Schliesst die APP die Vorschau (jedes switchTab raeumt Dialoge ab — etwa die
    //      Tab-Wiederherstellung nach einem Update), ist das keine Entscheidung der Person:
    //      sie kommt wieder, das Foto bleibt. Ein Tipp daneben schliesst nichts. Und
    //      „Bestimmen" bei schon offenem Scanner laesst keine scharfe Kamera-Marke zurueck.
    const z37 = await t.evaluate(async () => {
      const warte = (ms) => new Promise(z => setTimeout(z, ms));
      const da = () => !!document.getElementById('gs-teilen-vorschau');
      const c = await caches.open('gs-geteilt');
      const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
      window._gsTeilenNonce = '0123456789abcdef';
      await c.put('/__geteilt/letztes', new Response(new Blob([jpg], { type: 'image/jpeg' }), { headers: { 'X-Zeit': String(Date.now()), 'X-Anzahl': '1', 'X-Nonce': '0123456789abcdef' } }));
      await gsTeilenAbholen();
      const vorher = da();
      const ov = document.getElementById('gs-teilen-vorschau');
      ov && ov.dispatchEvent(new MouseEvent('click', { bubbles: true }));   // Tipp auf den abgedunkelten Rand
      await warte(400);
      const nachDaneben = da();
      switchTab('wissen');
      const sofort = da();
      await warte(900);
      const zurueck = da() && await caches.has('gs-geteilt');
      switchTab('scanner');
      await warte(900);
      window.analyzeImage = async function () {};
      for (let i = 0; i < 60 && (document.getElementById('gs-teilen-los') || {}).disabled; i++) await new Promise(r => setTimeout(r, 50));   // die Antipp-Sperre (Fall 40)
      const b = document.getElementById('gs-teilen-los'); if (b) b.click();
      await warte(400);
      const marke = window._gsScanOhneKamera;
      _gsTeilenScanFertig();   // so, als stuende das Ergebnis da
      await warte(300);
      return { vorher, nachDaneben, sofort, zurueck, marke, tab: _gsCurrentTab, cache: await caches.has('gs-geteilt') };
    }).catch(e => ({ fehler: String(e.message).slice(0, 100) }));
    const ok37 = z37.vorher && z37.nachDaneben && !z37.sofort && z37.zurueck && z37.marke === false && z37.tab === 'scanner' && !z37.cache;
    melde('Teilen: schliesst die APP die Vorschau, kommt sie wieder — ein Tipp daneben schliesst nichts, die Kamera-Marke bleibt nicht scharf', ok37,
          ok37 ? 'Tipp daneben: bleibt · switchTab(wissen): weg, nach 900 ms wieder da (Foto im Cache) · Bestimmen bei offenem Scanner: Marke false, Cache geraeumt' : JSON.stringify(z37));

    // 38 · Abgemeldet geteilt: der Anmeldebildschirm liegt ueber allem. Die Vorschau
    //      kommt NICHT darunter (dort wuerde der erste Zurueck-Druck das Foto verwerfen),
    //      sondern nach der Anmeldung.
    {
      const ctxL = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'allow' });
      await ctxL.addInitScript(SPAEHER);
      const l = await ctxL.newPage();
      l.on('pageerror', e => fehler.push('Teilen abgemeldet: ' + e.message.split('\n')[0]));
      await l.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await l.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise(z => setTimeout(z, 20000))]));
      await l.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
      await l.waitForTimeout(2000);
      // Abgemeldet und NICHTS geteilt: kein Zeitgeber — sonst liefe bei jedem
      // Start ohne Anmeldung einer, der nichts zu tun hat (Pruefung v33.56).
      const ohneFoto = await l.evaluate(() => ({ warten: window._gsTeilenWarten || null, preauth: document.documentElement.classList.contains('gs-preauth') })).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
      await teile(l, { jpeg: true });
      await l.waitForTimeout(2500);
      const vor = await l.evaluate(async () => ({
        preauth: document.documentElement.classList.contains('gs-preauth'),
        vorschau: !!document.getElementById('gs-teilen-vorschau'),
        wartet: !!window._gsTeilenWarten,
        eintrag: await caches.has('gs-geteilt'),
      })).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
      // „Anmelden": derselbe Schritt, den der Anmeldeweg am Ende geht.
      await l.evaluate(() => { localStorage.setItem('gs_sb_token', 'x.y.z'); gsOnboardingHide(); }).catch(() => {});
      await warteAuf(l, () => !!document.getElementById('gs-teilen-vorschau'), 20);
      const nach38 = await stand(l);
      const ok38 = ohneFoto.preauth && ohneFoto.warten === null && vor.preauth && !vor.vorschau && vor.wartet && vor.eintrag && nach38.vorschau && nach38.bild;
      melde('Teilen abgemeldet: keine Vorschau unter dem Anmeldebildschirm — sie kommt nach der Anmeldung; ohne Foto wartet auch nichts', ok38,
            ok38 ? 'ohne Foto: kein Zeitgeber · vor der Anmeldung: wartet, Foto im Cache, keine Vorschau · danach: Vorschau mit Bild' : ('ohne Foto ' + JSON.stringify(ohneFoto) + ' · vorher ' + JSON.stringify(vor) + ' · nachher Vorschau ' + nach38.vorschau + ' · Adresse „' + nach38.adresse + '"'));
      await ctxL.close();
    }

    // 39 · Ein Foto mit FREMDEM Einmal-Schluessel (abgelegt von einer anderen
    //      Navigation — etwa einer fremden Seite, deren Tab zu ist) wird beim
    //      naechsten Start verworfen, nie als „Geteiltes Foto" angeboten.
    //      Gegenrichtung: mit dem Schluessel DIESES Tabs kommt es (Fall 35).
    const z39 = await t.evaluate(async () => {
      window._gsTeilenNonce = ''; sessionStorage.setItem('gs_teilen_nonce', 'aaaaaaaaaaaaaaaa');
      const c = await caches.open('gs-geteilt');
      const jpg = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]);
      await c.put('/__geteilt/letztes', new Response(new Blob([jpg], { type: 'image/jpeg' }), { headers: { 'X-Zeit': String(Date.now()), 'X-Nonce': 'bbbbbbbbbbbbbbbb' } }));
      const fremd = await gsTeilenAbholen();
      const nachFremd = { vorschau: !!document.getElementById('gs-teilen-vorschau'), cache: await caches.has('gs-geteilt') };
      await c.put('/__geteilt/letztes', new Response(new Blob([jpg], { type: 'image/jpeg' }), { headers: { 'X-Zeit': String(Date.now()) } }));
      const ohne = await gsTeilenAbholen();
      const nachOhne = { vorschau: !!document.getElementById('gs-teilen-vorschau'), cache: await caches.has('gs-geteilt') };
      sessionStorage.removeItem('gs_teilen_nonce');
      return { fremd: fremd && fremd.zustand, nachFremd, ohne: ohne && ohne.zustand, nachOhne };
    }).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    const ok39 = z39.fremd === 'nichts' && z39.nachFremd && !z39.nachFremd.vorschau && !z39.nachFremd.cache
              && z39.ohne === 'nichts' && !z39.nachOhne.vorschau && !z39.nachOhne.cache;
    melde('Teilen: ein Foto mit fremdem oder fehlendem Einmal-Schluessel wird verworfen, nicht angeboten', ok39,
          ok39 ? 'fremder Schluessel: keine Vorschau, Cache geraeumt · ohne Schluessel: ebenso' : JSON.stringify(z39));

    // 36 · Abmelden raeumt ein Foto, das noch nicht abgeholt wurde — es gehoert der Person,
    //      die es geteilt hat, nicht der naechsten am Geraet. Gegenrichtung: ohne Abmelden bleibt es.
    const a36 = await t.evaluate(async () => {
      const c = await caches.open('gs-geteilt');
      await c.put('/__geteilt/letztes', new Response(new Blob([new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1])], { type: 'image/jpeg' }), { headers: { 'X-Zeit': String(Date.now()) } }));
      await new Promise(z => setTimeout(z, 200));
      const vorher = await caches.has('gs-geteilt');
      gsClearUserDataKeys();
      await new Promise(z => setTimeout(z, 400));
      return { vorher, nachher: await caches.has('gs-geteilt') };
    });
    melde('Teilen: Abmelden raeumt ein nicht abgeholtes Foto', a36.vorher && !a36.nachher,
          a36.vorher && !a36.nachher ? 'vorher da, nach gsClearUserDataKeys weg' : JSON.stringify(a36));

    // 40 · Die Vorschau kommt, weil eine ANDERE App etwas geschickt hat. Wer dort
    //      gerade tippt, loest mit demselben Finger keinen Scan aus: „Bestimmen"
    //      hat keinen Fokus und nimmt erst nach GS_TEILEN_ANTIPP_MS an. Beide
    //      Richtungen — ein Knopf, der NIE annimmt, waere ebenfalls „sicher".
    await teile(t, { jpeg: true });
    await warteAuf(t, () => !!document.getElementById('gs-teilen-vorschau'), 60);
    const v40 = await t.evaluate(() => {
      const b = document.getElementById('gs-teilen-los');
      if (!b) return { fehler: 'keine Vorschau' };
      window.__scan40 = 0;
      window.__scan40Orig = window.gsScanDatei;
      window.gsScanDatei = async function () { window.__scan40++; };
      return { fokus: document.activeElement === b, sofortGesperrt: b.disabled === true };
    }).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    // Ein ECHTER Tastendruck (ein dispatchEvent ist nicht vertrauenswuerdig und
    // loeste ohnehin nie einen Knopf aus — er haette nichts gemessen).
    await t.keyboard.press('Enter').catch(() => {});
    const t40 = await t.evaluate(async (v) => {
      const b = document.getElementById('gs-teilen-los');
      if (!b || v.fehler) return { fehler: v.fehler || 'keine Vorschau' };
      const fokus = v.fokus, sofortGesperrt = v.sofortGesperrt;
      b.click();                                            // der Tipp, der fuer die andere App gedacht war
      const frueh = window.__scan40;
      const offenFrueh = !!document.getElementById('gs-teilen-vorschau');
      let n = 0;
      while (b.disabled && n < 60) { await new Promise(r => setTimeout(r, 50)); n++; }
      const spaeter = !b.disabled;
      const fokusSpaeter = document.activeElement === b;   // auch NACH der Sperre kein Fokus: sonst taete es ein Enter
      b.click();
      await new Promise(r => setTimeout(r, 300));
      const sp = window.__scan40;
      window.gsScanDatei = window.__scan40Orig;
      try { _gsTeilenScanFertig(); } catch (_) {}
      const z = window.__vorschauZeiten[window.__vorschauZeiten.length - 1] || {};
      return { fokus, fokusSpaeter, sofortGesperrt, frueh, offenFrueh, spaeter, spaeterScan: sp,
               dauer: (z.los != null && z.ab != null) ? Math.round(z.los - z.ab) : null, ms: window.GS_TEILEN_ANTIPP_MS };
    }, v40).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    // Die Dauer ist GEBUNDEN: an die Konstante UND an eine feste Untergrenze —
    // eine halbierte Sperre (350 ms) waere sonst gruen geblieben (Pruefung v33.56).
    const dauerOk = typeof t40.dauer === 'number' && t40.dauer >= Math.max(600, (t40.ms || 0) - 50) && t40.dauer <= (t40.ms || 0) + 800;
    const ok40 = !t40.fehler && !t40.fokus && !t40.fokusSpaeter && t40.sofortGesperrt && t40.frueh === 0 && t40.offenFrueh && t40.spaeter && t40.spaeterScan === 1 && dauerOk;
    melde('Teilen: „Bestimmen" hat keinen Fokus und nimmt erst nach ' + (t40.ms || '?') + ' ms an — ein fremder Tipp loest keinen Scan aus, ein spaeterer schon', ok40,
          ok40 ? ('sofort: gesperrt, Tipp + echtes Enter → 0 Scans, Vorschau bleibt · frei nach ' + t40.dauer + ' ms (gemessen in der Seite) → 1 Scan')
               : JSON.stringify(t40).slice(0, 220));
    await verwerfen(t);
    await t.waitForTimeout(400);

    // 41 · Wie gross wird das Bild ENTPACKT? 15 MB sagen nichts: ein PNG traegt in
    //      wenigen Bytes einen Kopf mit 40'000 × 40'000 Bildpunkten. Gelesen wird der
    //      Kopf — gemessen an ECHTEN Bildern des Browsers (JPEG, PNG, WebP) und an
    //      gebauten Koepfen (GIF, VP8L, VP8X), dazu: ein unlesbarer Kopf ist kein Nein.
    const m41 = await t.evaluate(async () => {
      const bild = async (typ, w, h, q) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.fillStyle = '#2e7d32'; g.fillRect(0, 0, w, h);
        const blob = await new Promise(r => c.toBlob(r, typ, q));
        return new Uint8Array(await blob.arrayBuffer());
      };
      const roh = (a) => { const u = new Uint8Array(64); a.forEach((v, i) => { u[i] = v; }); return u; };
      const asc = (t) => Array.from(t).map(c => c.charCodeAt(0));
      const faelle = [];
      const pruef = (name, u, w, h) => { const m = _gsBildMasse(u); faelle.push({ name, ok: w == null ? m === null : !!m && m.w === w && m.h === h, m }); };
      pruef('JPEG 64×48', await bild('image/jpeg', 64, 48, 0.9), 64, 48);
      pruef('JPEG 301×7', await bild('image/jpeg', 301, 7, 0.5), 301, 7);
      pruef('PNG 300×200', await bild('image/png', 300, 200), 300, 200);
      const webp = await bild('image/webp', 123, 45, 0.8);
      const webpArt = String.fromCharCode(webp[12], webp[13], webp[14], webp[15]);
      pruef('WebP (' + webpArt.trim() + ') 123×45', webp, 123, 45);
      pruef('GIF 640×480', roh(asc('GIF89a').concat([0x80, 0x02, 0xE0, 0x01])), 640, 480);
      // VP8L: Signatur 0x2F, dann 14 Bit Breite-1, 14 Bit Hoehe-1 (999×333)
      const vp8l = (() => { const w = 999 - 1, h = 333 - 1, bits = (w | (h << 14)) >>> 0;
        return roh(asc('RIFF').concat([0, 0, 0, 0]).concat(asc('WEBPVP8L')).concat([0, 0, 0, 0, 0x2F, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255])); })();
      pruef('WebP VP8L 999×333', vp8l, 999, 333);
      const vp8x = roh(asc('RIFF').concat([0, 0, 0, 0]).concat(asc('WEBPVP8X')).concat([10, 0, 0, 0, 0x10, 0, 0, 0, 0x0F, 0x27, 0x00, 0x9F, 0x86, 0x01]));
      pruef('WebP VP8X 10000×100000', vp8x, 10000, 100000);
      // VP8 (verlustbehaftet, ohne VP8X): Rahmen-Kennung 9D 01 2A, dann 14 Bit Breite, 14 Bit Hoehe (500×250)
      pruef('WebP VP8 500×250', roh(asc('RIFF').concat([0, 0, 0, 0]).concat(asc('WEBPVP8 ')).concat([0, 0, 0, 0, 0, 0, 0, 0x9D, 0x01, 0x2A, 0xF4, 0x01, 0xFA, 0x00])), 500, 250);
      // GIF mit Bildschirm 0×0, globaler Farbtabelle, einer Erweiterung und einem
      // Bildrahmen 40000×40000: Chromium nimmt den RAHMEN (Pruefung v33.56).
      pruef('GIF 0×0, Rahmen 40000×40000', roh(asc('GIF89a').concat([0, 0, 0, 0, 0x80, 0, 0, 1, 2, 3, 4, 5, 6,
        0x21, 0xF9, 0x04, 0, 0, 0, 0, 0x00, 0x2C, 0, 0, 0, 0, 0x40, 0x9C, 0x40, 0x9C, 0])), 40000, 40000);
      // JPEG mit einem Fuellbyte vor dem SOF: libjpeg ueberspringt es und
      // dekodiert die volle Groesse — die Pruefung darf daran nicht aufgeben.
      pruef('JPEG, Fuellbyte vor SOF 40000×40000', roh([0xFF, 0xD8, 0xFF, 0xE0, 0, 4, 0, 0, 0x00, 0xFF, 0xC0, 0, 17, 8, 0x9C, 0x40, 0x9C, 0x40, 3]), 40000, 40000);
      const echt = await bild('image/jpeg', 64, 48, 0.9);
      const mitFuell = new Uint8Array(echt.length + 1);
      const app0 = 4 + ((echt[4] << 8) | echt[5]);                    // Ende des ersten Segments (APP0)
      mitFuell.set(echt.subarray(0, app0), 0); mitFuell[app0] = 0x00; mitFuell.set(echt.subarray(app0), app0 + 1);
      pruef('echtes JPEG mit Fuellbyte 64×48', mitFuell, 64, 48);
      pruef('PNG ohne IHDR → null', roh([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13].concat(asc('XXXX'))), null, null);
      pruef('JPEG ohne SOF → null', roh([0xFF, 0xD8, 0xFF, 0xDA, 0, 8]), null, null);
      pruef('zu kurz → null', new Uint8Array([0xFF, 0xD8, 0xFF]), null, null);
      return { faelle, max: window.GS_GETEILT_PIXEL_MAX };
    }).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    // Die Bombe: ein PNG-Kopf mit 40'000 × 40'000 (1,6 Milliarden Bildpunkte), 33 Bytes gross.
    const bombe = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
                   0, 0, 0x9C, 0x40, 0, 0, 0x9C, 0x40, 8, 6, 0, 0, 0, 0, 0, 0, 0];
    await t.evaluate(() => { window.__toasts = []; }).catch(() => {});
    await teile(t, { bytes: bombe, name: 'bombe.png', typ: 'image/png' });
    await warteAuf(t, () => (window.__toasts || []).length > 0 || !!document.getElementById('gs-teilen-vorschau'), 40);
    const b41 = await stand(t);
    const masseOk = !m41.fehler && m41.faelle.every(f => f.ok);
    const ok41 = masseOk && !b41.vorschau && !b41.eintrag && b41.toasts.some(x => /200 Megapixel/.test(x));
    melde('Teilen: ein Bild mit mehr als 200 Megapixeln wird am KOPF erkannt und abgelehnt — der Kopf stimmt fuer JPEG, PNG, WebP und GIF', ok41,
          ok41 ? (m41.faelle.length + ' Koepfe richtig gelesen (' + m41.faelle.map(f => f.name).join(' · ') + ') · Bombe 40000×40000: keine Vorschau, Eintrag weg, Satz gesagt')
               : ((m41.fehler || m41.faelle.filter(f => !f.ok).map(f => f.name + ' → ' + JSON.stringify(f.m)).join(' · ') || 'Koepfe ok') + ' · Bombe: Vorschau ' + b41.vorschau + ' · Eintrag ' + b41.eintrag + ' · Meldungen ' + JSON.stringify(b41.toasts)));
    await verwerfen(t);

    // 33 · Im Wald: geteilt OHNE Empfang. Der Worker braucht kein Netz dafuer.
    await ctxT.setOffline(true);
    await teile(t, { jpeg: true });
    await warteAuf(t, () => !!document.getElementById('gs-teilen-vorschau'));
    const o33 = await stand(t);
    // „Bestimmen" ohne Empfang: die Vorschau bleibt offen und sagt es — das Foto
    // geht nicht in einen Scan, der nur scheitern kann.
    const t33 = await t.evaluate(async () => {
      window.__analyse33 = 0; window.analyzeImage = async function () { window.__analyse33++; };
      for (let i = 0; i < 60 && (document.getElementById('gs-teilen-los') || {}).disabled; i++) await new Promise(r => setTimeout(r, 50));   // die Antipp-Sperre (Fall 40)
      const b = document.getElementById('gs-teilen-los'); if (b) b.click();
      await new Promise(z => setTimeout(z, 500));
      const hw = document.getElementById('gs-teilen-hinweis');
      return { offen: !!document.getElementById('gs-teilen-vorschau'), hinweis: hw ? hw.textContent : '', analyse: window.__analyse33, cache: await caches.has('gs-geteilt') };
    }).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    await verwerfen(t);
    await ctxT.setOffline(false);
    const ok33 = o33.vorschau && o33.bild && o33.adresse === '/' && t33.offen && /Ohne Empfang/.test(t33.hinweis) && t33.analyse === 0 && t33.cache;
    melde('Teilen ohne Empfang: das Foto kommt als Vorschau an — und „Bestimmen" sagt, dass es Netz braucht, statt es zu verlieren', ok33,
          ok33 ? 'offline geteilt → Vorschau mit Bild · Bestimmen: Vorschau bleibt, Satz da, analyzeImage 0×, Foto im Cache' : ('Vorschau ' + o33.vorschau + ' · Adresse „' + o33.adresse + '" · nach Antippen ' + JSON.stringify(t33)));

    // 34 · Ein neuer Worker WARTET, waehrend geteilt wird (Auslieferungen kommen fast taeglich).
    //      Der Start wendet sonst wartende Worker an (v33.25) — mit dem Foto im Cache darf er
    //      das nicht: keine zweite Ladung, die Vorschau steht, das Update sagt „teilen".
    // Die Ausgangsseite HERSTELLEN, nicht voraussetzen: ein gescheiterter Fall
    // davor kann t auf einer Fehlerseite zurueckgelassen haben.
    await t.goto(basis + '/', { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(() => {});
    await t.waitForTimeout(1500);
    versionErsatz = 'vTEST3';
    const w34 = await t.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      try { await reg.update(); } catch (_) {}
      for (let i = 0; i < 60 && !reg.waiting; i++) await new Promise(z => setTimeout(z, 300));
      return !!reg.waiting;
    }).catch(() => false);
    const ladVor = ladungenT;
    await teile(t, { jpeg: true });
    await warteAuf(t, () => !!document.getElementById('gs-teilen-vorschau'));
    await t.waitForTimeout(1200);
    const v34 = await t.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const r = await gsUpdateAnwenden('rueckkehr');
      return { vorschau: !!document.getElementById('gs-teilen-vorschau'), wartet: !!(reg && reg.waiting), antwort: r && r.grund,
               eintrag: await (async () => { if (!(await caches.has('gs-geteilt'))) return false; const c = await caches.open('gs-geteilt'); return !!(await c.match('/__geteilt/letztes')); })() };
    }).catch(e => ({ fehler: String(e.message).slice(0, 80) }));
    const ok34 = w34 && v34.vorschau && v34.wartet && v34.eintrag && /teilen/.test(String(v34.antwort)) && (ladungenT - ladVor) === 1;
    melde('Teilen mit wartendem Worker: der Start wendet das Update NICHT an, solange das Foto wartet', ok34,
          ok34 ? ('1 Ladung (kein Reload) · Worker wartet weiter · gsUpdateAnwenden → „' + v34.antwort + '" · Vorschau und Eintrag da')
               : ('wartend vorher ' + w34 + ' · Ladungen +' + (ladungenT - ladVor) + ' · ' + JSON.stringify(v34)));

    // 35 · Und wird der Worker doch gewechselt: der Cache gehoert keiner Version, und die App
    //      bietet das frische Foto auch OHNE Marke in der Adresse wieder an.
    const u35 = await t.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg.waiting) return { fehler: 'kein wartender Worker' };
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      for (let i = 0; i < 60; i++) {
        await new Promise(z => setTimeout(z, 300));
        const k = await caches.keys();
        if (k.some(x => x.indexOf('gs-vTEST3') === 0) && !k.some(x => /^gs-v\d/.test(x) && x.indexOf('gs-vTEST3') !== 0)) break;
      }
      return { keys: await caches.keys() };
    }).catch(e => ({ fehler: 'Seite hat neu geladen: ' + String(e.message).slice(0, 60) }));
    // Die App laedt nach einem Worker-Wechsel unter Umstaenden selbst neu
    // (Zweit-Tab-Regel, v33.25) — diese Ladung erst abwarten, sonst laufen
    // zwei Navigationen gegeneinander.
    await t.waitForEvent('domcontentloaded', { timeout: 8000 }).catch(() => {});
    await t.waitForTimeout(1500);
    const keys35 = await t.evaluate(() => caches.keys()).catch(() => []);
    let nav35 = null;
    try { await t.goto(basis + '/', { waitUntil: 'domcontentloaded', timeout: 120000 }); }
    catch (e) { nav35 = String(e.message).split('\n')[0].slice(0, 80); }
    await warteAuf(t, () => !!document.getElementById('gs-teilen-vorschau'));
    const v35 = await stand(t).catch(() => ({ vorschau: false, adresse: '(keine Seite)' }));
    const ok35 = keys35.includes('gs-geteilt') && keys35.some(k => k.indexOf('gs-vTEST3') === 0) && v35.vorschau && v35.adresse === '/';
    melde('Teilen: ein Worker-Wechsel loescht das wartende Foto nicht — und die App bietet es danach an', ok35,
          ok35 ? ('Caches danach: gs-geteilt + ' + keys35.filter(k => k.indexOf('gs-vTEST3') === 0).length + '× neue Version · Vorschau nach Neuladen ohne Marke')
               : ((nav35 ? 'Neuladen scheiterte: ' + nav35 + ' · ' : '') + 'Antwort ' + JSON.stringify(u35).slice(0, 160) + ' · Caches ' + JSON.stringify(keys35) + ' · Vorschau ' + v35.vorschau));
    await verwerfen(t);
    } catch (e) {
      // Ein Pruefstand, der abstuerzt, hat nichts gemessen — er MELDET es.
      melde('Teilen: der Block lief nicht zu Ende', false, String(e.message || e).split('\n')[0].slice(0, 160));
    } finally {
      versionErsatz = null;
      if (ctxT) await ctxT.close().catch(() => {});
      s9.close();
    }
  }

  console.log('  ---');
  console.log('  Fragen geprueft: 41 · davon rot: ' + kaputt);
  console.log('  JS-Fehler im Offline-Start: ' + (fehler.length ? fehler.length + ' (' + fehler.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();

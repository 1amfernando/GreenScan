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

function server(wunschPort) {
  return new Promise((fertig) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
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

  console.log('  ---');
  console.log('  Fragen geprueft: 13 · davon rot: ' + kaputt);
  console.log('  JS-Fehler im Offline-Start: ' + (fehler.length ? fehler.length + ' (' + fehler.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();

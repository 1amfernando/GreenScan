// Push-Sender (Sicherheitspruefung 10.11.2026, Gruppe e3): wohin darf ein Push gehen,
// und kann EIN Nutzer den Lauf fuer alle anderen anhalten?
//
// Der Endpunkt eines Abonnements schreibt die Person selbst (RLS nur auth.uid() = user_id).
// Ohne Pruefung schickte jede Function einen HTTPS-POST an jede Adresse (SSRF), arbeitete
// alle Abos seriell und ohne Frist ab, und sensor-push las die 500 AELTESTEN Inbox-Zeilen.
// Jeder Fall fuehrt die ECHTE Rechnung aus _shared/*.mjs aus (gestelltes web-push, gestellte
// Datenbank) und misst die WIRKUNG: wurde gesendet? kam der Lauf zurueck? wer wurde geladen?
'use strict';

const GUT = [
  'https://fcm.googleapis.com/fcm/send/dXk2:APA91bH',
  'https://FCM.googleapis.com/wp/abc',
  'https://fcm.googleapis.com:443/fcm/send/x',
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
  'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
  'https://web.push.apple.com/QGdS3x',
];
const BOESE = [
  'https://169.254.169.254/latest/meta-data/',
  'https://10.0.0.7:8443/x',
  'https://127.0.0.1/x',
  'https://[::1]/x',
  'http://fcm.googleapis.com/fcm/send/x',
  'https://fcm.googleapis.com:8443/fcm/send/x',
  'https://opfer.example/fcm.googleapis.com/',
  'https://fcm.googleapis.com.opfer.example/x',
  'https://fcm.googleapis.com@opfer.example/x',
  'https://user:pw@fcm.googleapis.com/x',
  'https://notify.windows.com/x',
  'https://evilpush.apple.com.opfer.example/x',
  // Gegenpruefung: web-push liest mit dem alten url.parse — fuer URL Apple/WNS, fuer url.parse opfer.example
  'https://opfer.example;.push.apple.com/x',
  'https://opfer.example%3b.notify.windows.com/x',
  "https://opfer.example'.push.apple.com/x",
  'https://fcm.googleapis.com\\@opfer.example/x',
  'javascript:alert(1)',
  '',
  null,
];
const VAPID = { subject: 'mailto:info@greenscan.ch', publicKey: 'PUB', privateKey: 'PRIV' };
const frist = (p, ms) => Promise.race([p, new Promise(ja => setTimeout(() => ja('__HAENGT__'), ms))]);

module.exports = [
  {
    name: 'Endpunkt · sendPush schickt nur an bekannte Push-Dienste (keine IP, kein Port, kein http, kein fremder Host) — die guten gehen weiter durch',
    lauf: async (h) => {
      const M = await h.modul('_shared/push_helfer.mjs');
      const gesendet = [];
      const wp = { setVapidDetails: () => {}, sendNotification: async (sub) => { gesendet.push(sub.endpoint); return { statusCode: 201 }; } };
      const durch = [];
      for (const e of BOESE) {
        const r = await M.sendPush(wp, { endpoint: e, p256dh: 'P', auth_secret: 'A' }, { title: 't', body: 'b', url: '/' }, VAPID);
        if (r.ok || gesendet.indexOf(e) >= 0) durch.push(String(e));
      }
      if (durch.length) return { ok: false, warum: durch.length + ' von ' + BOESE.length + ' feindlichen Endpunkten erreicht: ' + durch.slice(0, 4).join(' · ') };
      const vorher = gesendet.length, fehlt = [];
      for (const e of GUT) {
        const r = await M.sendPush(wp, { endpoint: e, p256dh: 'P', auth_secret: 'A' }, { title: 't', body: 'b', url: '/' }, VAPID);
        if (!r.ok) fehlt.push(e + ' → ' + JSON.stringify(r));
      }
      if (fehlt.length || gesendet.length - vorher !== GUT.length) return { ok: false, warum: 'echte Push-Dienste abgewiesen: ' + fehlt.join(' · ') };
      if (!Array.isArray(M.PUSH_HOSTS) || typeof M.pushEndpunktOk !== 'function') return { ok: false, warum: 'PUSH_HOSTS / pushEndpunktOk fehlen' };
      // was pushEndpunktOk annimmt, muss auch der Parser von web-push (url.parse) als bekannten Host lesen
      const url = require('url'), zwei = [];
      GUT.concat(BOESE).forEach(e => { if (!M.pushEndpunktOk(e).ok) return; const ph = String(url.parse(e).hostname || '').toLowerCase();
        if (!M.PUSH_HOSTS.some(x => x.charAt(0) === '.' ? ph.length > x.length && ph.slice(-x.length) === x : ph === x)) zwei.push(e + ' → ' + ph); });
      if (zwei.length) return { ok: false, warum: 'URL und url.parse lesen verschiedene Hosts: ' + zwei.join(' · ') };
      const g = M.pushEndpunktOk('https://10.0.0.7:8443/x');
      if (g.ok || !g.grund) return { ok: false, warum: 'kein Grund: ' + JSON.stringify(g) };
      return { ok: true, info: BOESE.length + ' feindliche Endpunkte: 0 POSTs · ' + GUT.length + ' echte (FCM, Mozilla, WNS, Apple): ' + GUT.length + ' gesendet · PUSH_HOSTS ' + M.PUSH_HOSTS.length };
    },
  },
  {
    name: 'Frist · ein Endpunkt, der die Verbindung annimmt und nie antwortet, haelt sendPush nicht an (web-push bekommt timeout, und das Versprechen hat eine eigene Frist)',
    lauf: async (h) => {
      const M = await h.modul('_shared/push_helfer.mjs');
      let opts = null;
      const wpHaengt = { setVapidDetails: () => {}, sendNotification: (sub, p, o) => { opts = o; return new Promise(() => {}); } };
      const t0 = Date.now();
      const r = await frist(M.sendPush(wpHaengt, { endpoint: GUT[0], p256dh: 'P', auth_secret: 'A' }, { title: 't', body: 'b', url: '/' }, VAPID, { timeoutMs: 120 }), 3000);
      const dauer = Date.now() - t0;
      if (r === '__HAENGT__') return { ok: false, warum: 'sendPush haengt nach 3000 ms noch (keine Frist)' };
      if (r.ok) return { ok: false, warum: 'haengender Versand als Erfolg gemeldet' };
      if (!opts || opts.timeout !== 120 || opts.TTL !== 3600) return { ok: false, warum: 'web-push ohne timeout/TTL: ' + JSON.stringify(opts) };
      if (typeof M.PUSH_TIMEOUT_MS !== 'number' || M.PUSH_TIMEOUT_MS > 15000) return { ok: false, warum: 'PUSH_TIMEOUT_MS: ' + M.PUSH_TIMEOUT_MS };
      return { ok: true, info: 'zurueck nach ' + dauer + ' ms mit ' + JSON.stringify(r.error).slice(0, 50) + ' · Vorgabe ' + M.PUSH_TIMEOUT_MS + ' ms' };
    },
  },
  {
    name: 'Deckel je Nutzer · der Lauf bedient so viele Abos, wie die DB zulaesst (fn_push_subs_deckel) — 7 Geraete bekommen alle einen Push, das 11. faellt weg',
    lauf: async (h) => {
      const M = await h.modul('_shared/push_helfer.mjs');
      const fs = require('fs'), path = require('path');
      const mig = fs.readFileSync(path.join(h.repo, 'supabase/migrations/20261110_sicherheit_konto_speicher.sql'), 'utf8');
      const rumpf = mig.slice(mig.indexOf('FUNCTION public.fn_push_subs_deckel'), mig.indexOf('CREATE TRIGGER trg_push_subs_deckel'));
      const off = /OFFSET\s+(\d+)/.exec(rumpf);
      if (!off) return { ok: false, warum: 'OFFSET im Trigger nicht gefunden' };
      const db = Number(off[1]) + 1;
      if (M.ABOS_JE_NUTZER !== db) return { ok: false, warum: 'zwei Zahlen fuer eine Frage: Modul ' + M.ABOS_JE_NUTZER + ' · DB ' + db };
      const abo = (i) => ({ id: 's' + i, user_id: 'u', endpoint: GUT[0] + 'x' + i, created_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() });
      const sieben = M.abosAuswaehlen(Array.from({ length: 7 }, (_, i) => abo(i)));
      if (sieben.abos.length !== 7 || sieben.gedeckelt !== 0) return { ok: false, warum: '7 Geraete → ' + sieben.abos.length + ' im Lauf, ' + sieben.gedeckelt + ' gedeckelt' };
      const elf = M.abosAuswaehlen(Array.from({ length: db + 1 }, (_, i) => abo(i)));
      if (elf.abos.length !== db || elf.gedeckelt !== 1 || elf.abos.some(s => s.id === 's0')) return { ok: false, warum: 'Gegenrichtung: ' + elf.abos.length + ' im Lauf, gedeckelt ' + elf.gedeckelt };
      // updated_at gewinnt gegen created_at (der Client-Upsert soll es schicken — Uebergabe)
      const alt = Object.assign(abo(0), { updated_at: '2026-11-10T00:00:00Z' });
      const r = M.abosAuswaehlen([alt].concat(Array.from({ length: db }, (_, i) => abo(i + 1))));
      if (!r.abos.some(s => s.id === 's0')) return { ok: false, warum: 'ein frisch erneuertes Erstgeraet faellt heraus' };
      return { ok: true, info: 'Modul ' + M.ABOS_JE_NUTZER + ' = DB ' + db + ' · 7 → 7 · ' + (db + 1) + ' → ' + db + ' · updated_at zaehlt' };
    },
  },
  {
    name: 'Deckel je Nutzer · 40 eigene Abos verdraengen niemanden: je Nutzer die ABOS_JE_NUTZER neuesten, reihum, feindliche Endpunkte gar nicht erst',
    lauf: async (h) => {
      const M = await h.modul('_shared/push_helfer.mjs');
      if (typeof M.abosAuswaehlen !== 'function') return { ok: false, warum: 'abosAuswaehlen fehlt — jedes Abo kommt in den Lauf' };
      const subs = [];
      for (let i = 0; i < 40; i++) subs.push({ id: 'a' + i, user_id: 'angreifer', endpoint: GUT[0] + i, created_at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() });
      subs.push({ id: 'b', user_id: 'anna', endpoint: GUT[3], created_at: '2026-01-01T00:00:00Z' });
      subs.push({ id: 'c', user_id: 'ben', endpoint: GUT[4], created_at: '2026-01-02T00:00:00Z' });
      subs.push({ id: 'd', user_id: 'dora', endpoint: 'https://10.0.0.7:8443/x', created_at: '2026-11-09T00:00:00Z' });
      const r = M.abosAuswaehlen(subs);
      const a = r.abos.filter(s => s.user_id === 'angreifer').map(s => s.id);
      const vorne = r.abos.slice(0, 3).map(s => s.user_id).sort().join(',');
      if (a.length !== M.ABOS_JE_NUTZER) return { ok: false, warum: 'Angreifer im Lauf: ' + a.length };
      if (a[0] !== 'a39' || a.indexOf('a' + (40 - M.ABOS_JE_NUTZER)) < 0 || a.indexOf('a' + (39 - M.ABOS_JE_NUTZER)) >= 0) return { ok: false, warum: 'nicht die neuesten: ' + a.join(',') };
      if (vorne !== 'angreifer,anna,ben') return { ok: false, warum: 'nicht reihum, vorne: ' + vorne };
      if (r.abos.some(s => s.user_id === 'dora') || r.abgewiesen.length !== 1 || r.abgewiesen[0].id !== 'd') return { ok: false, warum: 'feindlicher Endpunkt im Lauf: ' + JSON.stringify(r.abgewiesen) };
      if (r.gedeckelt !== 40 - M.ABOS_JE_NUTZER) return { ok: false, warum: 'gedeckelt: ' + r.gedeckelt };
      return { ok: true, info: '43 Abos → ' + r.abos.length + ' im Lauf (Angreifer ' + a.length + ', neueste a39…), ' + r.gedeckelt + ' gedeckelt, 1 abgewiesen · vorne ' + vorne };
    },
  },
  {
    name: 'Abarbeiten · ein haengendes Abo haelt die anderen nicht auf, das Budget beendet den Lauf ehrlich (haengt / nichtBegonnen gezaehlt)',
    lauf: async (h) => {
      const M = await h.modul('_shared/push_helfer.mjs');
      if (typeof M.abarbeiten !== 'function') return { ok: false, warum: 'abarbeiten fehlt — die Sender arbeiten seriell' };
      const liste = Array.from({ length: 12 }, (_, i) => i);
      const fertig = [];
      const t0 = Date.now();
      const r = await frist(M.abarbeiten(liste, (i) => i === 0 ? new Promise(() => {}) : new Promise(ja => setTimeout(() => { fertig.push(i); ja(i); }, 10)), { parallel: 3, budgetMs: 300, nachlaufMs: 100 }), 4000);
      if (r === '__HAENGT__') return { ok: false, warum: 'abarbeiten wartet ewig auf ein haengendes Abo' };
      if (fertig.length !== 11 || r.erledigt !== 11 || r.haengt !== 1 || !r.abgebrochen) return { ok: false, warum: 'fertig ' + fertig.length + ' · ' + JSON.stringify({ e: r.erledigt, h: r.haengt, a: r.abgebrochen }) };
      const dauer = Date.now() - t0;
      const lang = Array.from({ length: 50 }, (_, i) => i);
      const r2 = await M.abarbeiten(lang, () => new Promise(ja => setTimeout(ja, 30)), { parallel: 2, budgetMs: 100, nachlaufMs: 500 });
      if (!r2.abgebrochen || !(r2.nichtBegonnen > 0) || r2.erledigt + r2.nichtBegonnen + r2.haengt !== 50) return { ok: false, warum: 'Budget: ' + JSON.stringify({ e: r2.erledigt, n: r2.nichtBegonnen, h: r2.haengt, a: r2.abgebrochen }) };
      const r3 = await M.abarbeiten([1, 2, 3], (x) => { if (x === 2) throw new Error('kaputt'); return x * 2; }, { parallel: 2 });
      if (r3.abgebrochen || r3.erledigt !== 3 || r3.ergebnisse[1].status !== 'rejected' || r3.ergebnisse[2].value !== 6) return { ok: false, warum: 'Normalfall: ' + JSON.stringify(r3) };
      return { ok: true, info: '11 von 12 fertig, 1 haengt, zurueck nach ' + dauer + ' ms · Budget: ' + r2.erledigt + ' erledigt, ' + r2.nichtBegonnen + ' nicht begonnen · Normalfall ohne Abbruch, Fehler einzeln' };
    },
  },
  {
    name: 'sensor-push · 600 selbst angelegte sensor_alert-Zeilen verdraengen den echten Alarm eines anderen nicht (neueste zuerst, Deckel je Nutzer, gerechte Runden)',
    lauf: async (h) => {
      const R = await h.modul('_shared/sensor_push_regeln.mjs');
      if (typeof R.meldungenLaden !== 'function') return { ok: false, warum: 'meldungenLaden fehlt — der Rand liest die 500 aeltesten Zeilen' };
      const t = (min) => new Date(Date.UTC(2026, 10, 10, 8, 0) + min * 60000).toISOString();
      const db = [];
      // der echte Alarm ist AELTER als der Angriff (sonst waere „neueste zuerst" allein genug)
      db.push({ id: 'echt', user_id: 'anna', kind: 'sensor_alert', created_at: t(1) });
      for (let i = 0; i < 600; i++) db.push({ id: 'x' + i, user_id: 'angreifer', kind: 'sensor_alert', created_at: t(10 + i * 0.1) });
      for (let i = 0; i < 3; i++) db.push({ id: 'b' + i, user_id: 'ben', kind: 'sensor_alert', created_at: t(5 + i) });
      // der Stub nimmt den Vergleich, den der Rand WIRKLICH schreibt (lt oder lte)
      const src0 = h.ohneKommentare(h.lies('sensor-push/index.ts'));
      const gleich = /\.lte\("created_at",\s*vor\)/.test(src0);
      let abfragen = 0;
      const ladeAus = (tab) => async (aus, vor) => {   // der Rand: neueste zuerst, ohne Ausgeschlossene, vor dem Cursor, Seite
        abfragen++;
        return tab.filter(z => aus.indexOf(z.user_id) < 0 && (vor === null || (gleich ? z.created_at <= vor : z.created_at < vor)))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, R.LADE_SEITE);
      };
      const lade = ladeAus(db);
      const r = await R.meldungenLaden(lade);
      const ids = r.meldungen.map(m => m.id);
      const angr = r.meldungen.filter(m => m.user_id === 'angreifer').length;
      if (ids.indexOf('echt') < 0) return { ok: false, warum: 'echter Alarm nicht geladen (' + r.meldungen.length + ' Zeilen, ' + abfragen + ' Abfragen)' };
      if (angr !== R.MELDUNGEN_JE_NUTZER || ids.filter(i => /^b/.test(i)).length !== 3) return { ok: false, warum: 'Angreifer ' + angr + ' · ben ' + ids.filter(i => /^b/.test(i)).length };
      if (!r.vollstaendig || abfragen > 3) return { ok: false, warum: 'Runden: ' + JSON.stringify({ v: r.vollstaendig, abfragen }) };
      if (r.meldungen.filter(m => m.user_id === 'angreifer').some(m => m.id !== 'x599' && Number(m.id.slice(1)) < 590)) return { ok: false, warum: 'nicht die neuesten des Angreifers' };
      // Gegenpruefung · Gleichstand an der Seitengrenze: ein Cron-Lauf schreibt alle Alarme mit
      // demselben now(), und created_at setzt die Person bei eigenen Zeilen selbst (hier: Zukunft).
      // 199 Zeilen des Angreifers schieben die Seitengrenze mitten in den Lauf von fuenf Echten.
      const abfragen1 = abfragen;
      const T = t(30), db2 = [];
      for (let i = 0; i < 199; i++) db2.push({ id: 'z' + i, user_id: 'angreifer', kind: 'sensor_alert', created_at: '2099-01-01T00:00:' + String(i % 60).padStart(2, '0') + '.000Z' });
      ['anna', 'ben', 'cora', 'dino', 'emil'].forEach((u, i) => db2.push({ id: 'g' + i, user_id: u, kind: 'sensor_alert', created_at: T }));
      db2.push({ id: 'alt', user_id: 'fritz', kind: 'sensor_alert', created_at: t(2) });
      const r2 = await R.meldungenLaden(ladeAus(db2));
      const echt2 = r2.meldungen.filter(m => /^g/.test(m.id)).length;
      if (echt2 !== 5 || !r2.meldungen.some(m => m.id === 'alt')) return { ok: false, warum: 'Gleichstand an der Seitengrenze: ' + echt2 + ' von 5 echten Alarmen desselben Cron-Laufs geladen (Rand ' + (gleich ? 'lte' : 'lt') + ')' };
      // Rand: die Function nimmt die Rechnung und liest nicht mehr aufsteigend
      const src = src0;
      if (!/meldungenLaden\(/.test(src)) return { ok: false, warum: 'sensor-push ruft meldungenLaden nicht' };
      if (/ascending:\s*true/.test(src) || !/ascending:\s*false/.test(src)) return { ok: false, warum: 'sensor-push liest nicht neueste zuerst' };
      if (!/\.not\("user_id",\s*"in"/.test(src) || !gleich) return { ok: false, warum: 'sensor-push: Ausschluss/Cursor (lte) fehlt im Rand' };
      return { ok: true, info: '604 Zeilen → ' + r.meldungen.length + ' geladen in ' + abfragen1 + ' Abfragen · echter Alarm dabei · Angreifer gedeckelt auf ' + angr + ' · Gleichstand an der Seitengrenze: 5 von 5' };
    },
  },
  {
    name: 'Rand · jede Function, die web-push ruft, geht durch die Endpunkt-Pruefung; die Cron-Sender nehmen Auswahl + Abarbeiten statt einer seriellen Schleife; geloescht wird je Abo (id), nie je Endpunkt',
    lauf: async (h) => {
      const f = [];
      const roh = h.functions().filter(d => /sendNotification\(/.test(h.ohneKommentare(h.lies(d + '/index.ts'))));
      roh.forEach(d => { if (!/pushEndpunktOk\(/.test(h.ohneKommentare(h.lies(d + '/index.ts')))) f.push(d + ': web-push ohne pushEndpunktOk'); });
      ['send-push'].forEach(d => { const s = h.ohneKommentare(h.lies(d + '/index.ts')); if (/sendNotification\(/.test(s)) f.push(d + ': eigene Kopie von sendPush'); if (!/push_helfer\.mjs/.test(s)) f.push(d + ': importiert push_helfer nicht'); });
      const cron = ['daily-push-checker', 'weather-alert-checker', 'engagement-push-checker'];
      cron.forEach(d => {
        const s = h.ohneKommentare(h.lies(d + '/index.ts'));
        if (!/abosAuswaehlen\(/.test(s)) f.push(d + ': kein abosAuswaehlen');
        if (!/abarbeiten\(/.test(s)) f.push(d + ': kein abarbeiten');
        if (/for\s*\(const\s+sub\s+of\s+\(?subs/.test(s)) f.push(d + ': serielle Schleife ueber alle Abos');
      });
      const sender = cron.concat(['send-push', 'sensor-push']);
      sender.forEach(d => { if (/push_subscriptions"\)\.delete\(\)\.eq\("endpoint"/.test(h.ohneKommentare(h.lies(d + '/index.ts')))) f.push(d + ': loescht je Endpunkt (auch fremde Zeilen)'); });
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: roh.length + ' Functions mit eigenem web-push-Aufruf, alle mit pushEndpunktOk · ' + cron.length + ' Cron-Sender mit Auswahl + Abarbeiten · Loeschen je id' };
    },
  },
];

#!/usr/bin/env node
// admin_check.js — sagt das Admin-Panel, was STIMMT?
//
//   node scripts/admin_check.js
//
// Anlass: Fernandos Satz „Auch für mich als Admin muss mehr gemacht werden."
// Vor dem Bauen gemessen (16.09.2026, Quelltext von v33.41):
//
//   13 von 16 Sektionen lesen den Fehler GAR NICHT. Sie enden auf
//       return (r && Array.isArray(r.data)) ? r.data : [];
//     } catch(e) { return []; }
//   Eine Ablehnung, ein 404, eine kaputte RPC, ein Netzfehler — alles wird zu
//   einer leeren Liste. Auf dem Bildschirm sieht das aus wie „nichts zu tun".
//
// Bei der MODERATION ist das direkt schaedlich: gemeldete Beitraege bleiben
// liegen, und das Panel meldet Ruhe. Bei den Fehlerberichten ebenso:
// „keine Fehler" kann heissen „die Abfrage kam nie durch".
//
// Das ist dieselbe Klasse wie `_gsSchreibOk` (v32.28) und wie der
// wegdestrukturierte Fehler in `daily-push-checker` (v33.41) — nur auf der
// LESE-Seite und im Gesicht des Admins.
//
// Vorbild fuer die Bauform ist `gsAdminFetchAnalytics` (v33.18): drei
// Zustaende — daten · nicht_verfuegbar · fehler — mit Grund aus
// `_gsFehlerText`. Dieser Pruefstand verlangt das von allen.
//
// Der Server ist GESTELLT (`sbFetch`): es gibt hier kein Supabase. Geprueft
// ist, was die App aus einer Antwort macht — nicht, ob die Antwort echt ist.
'use strict';
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

// Die sechzehn Sektionen, die openAdminPanel in EINEM Promise.all holt.
const SEKTIONEN = [
  'gsAdminListUsers', 'gsAdminFetchMetrics', 'gsAdminFetchStripe', 'gsAdminFetchFlags',
  'gsAdminFetchAudit', 'gsAdminFetchClientErrors', 'gsAdminFetchModerationFeed', 'gsAdminFetchVouchers',
  'gsAdminFetchSpeciesImageQueue', 'gsAdminFetchCronHealth', 'gsAdminFetchSystemEvents', 'gsAdminFetchFinance',
  'gsAdminFetchOpsDigest', 'gsAdminFetchReports', 'gsAdminFetchSpeciesProposalQueue', 'gsAdminFetchAnalytics',
];

const FAELLE = [
  {
    name: 'Zugang · ohne Server-Ja tut keine Sektion etwas — und der Server entscheidet, nicht der Speicher',
    lauf: async (SEKT) => {
      const klagen = [];
      localStorage.setItem('gs_is_admin', '0');
      window.__adm = [];
      window.sbFetch = async (p) => { window.__adm.push(p); return { data: [], error: null }; };
      for (const n of SEKT) { if (typeof window[n] === 'function') { try { await window[n](); } catch (_) {} } }
      if (window.__adm.length) klagen.push('ohne Admin-Ja gingen ' + window.__adm.length + ' Anfragen hinaus: ' + window.__adm.slice(0, 3).join(', '));
      localStorage.setItem('gs_is_admin', '1');
      window.__adm = [];
      for (const n of SEKT) { if (typeof window[n] === 'function') { try { await window[n](); } catch (_) {} } }
      if (window.__adm.length < SEKT.length - 1) klagen.push('mit Admin-Ja gingen nur ' + window.__adm.length + ' von ' + SEKT.length + ' Anfragen hinaus');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'ohne Ja: 0 Anfragen · mit Ja: ' + window.__adm.length + ' von ' + SEKT.length };
    },
  },
  {
    name: 'Drei Zustände · JEDE Sektion unterscheidet „keine Einträge" von „konnte nicht laden" — mit Grund',
    lauf: async (SEKT) => {
      // Gemessen gegen v33.41: 13 von 16 geben bei JEDEM Fehler ein leeres
      // Array zurueck. „Moderation: nichts zu tun" und „die Abfrage ist
      // fehlgeschlagen" sehen dann gleich aus — und das erste ist eine Zusage.
      localStorage.setItem('gs_is_admin', '1');
      const hatZustand = (x) => x && typeof x === 'object' && typeof x.state === 'string';
      const klagen = [];
      const bericht = {};
      for (const n of SEKT) {
        if (typeof window[n] !== 'function') { klagen.push(n + ' gibt es nicht'); continue; }
        // a) der Server LEHNT AB
        window.sbFetch = async () => ({ data: null, error: { message: 'new row violates row-level security policy', status: 403 } });
        let a; try { a = await window[n](); } catch (e) { a = { __wirft: e.message }; }
        // b) die RPC GIBT ES NICHT (404 / PGRST202)
        window.sbFetch = async () => ({ data: null, error: { message: 'Could not find the function public.fn_x in the schema cache (PGRST202)', status: 404 } });
        let b; try { b = await window[n](); } catch (e) { b = { __wirft: e.message }; }
        // c) alles gut, aber LEER
        window.sbFetch = async () => ({ data: [], error: null });
        let c; try { c = await window[n](); } catch (e) { c = { __wirft: e.message }; }
        const za = hatZustand(a) ? a.state : '(kein Zustand)';
        const zb = hatZustand(b) ? b.state : '(kein Zustand)';
        const zc = hatZustand(c) ? c.state : '(kein Zustand)';
        bericht[n] = za + '/' + zb + '/' + zc;
        if (!hatZustand(a) || !hatZustand(b) || !hatZustand(c)) { klagen.push(n + ': ' + bericht[n]); continue; }
        if (a.state !== 'fehler') klagen.push(n + ': Ablehnung ergibt „' + a.state + '" statt „fehler"');
        else if (!a.grund) klagen.push(n + ': „fehler" ohne Grund — der Admin liest nichts');
        if (b.state !== 'nicht_verfuegbar') klagen.push(n + ': fehlende RPC ergibt „' + b.state + '" statt „nicht_verfuegbar"');
        if (c.state === 'fehler' || c.state === 'nicht_verfuegbar') klagen.push(n + ': eine LEERE Antwort ergibt „' + c.state + '"');
      }
      if (klagen.length) return { ok: false, warum: klagen.length + ' Sektion(en): ' + klagen.slice(0, 4).join(' · ') + (klagen.length > 4 ? ' · +' + (klagen.length - 4) + ' weitere' : '') };
      return { ok: true, info: SEKT.length + ' Sektionen, je Ablehnung/fehlende RPC/leer sauber getrennt' };
    },
  },
  {
    name: 'Auf dem Bildschirm · eine Sektion, die nicht laden konnte, SAGT es — statt eine leere Liste zu zeigen',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      // Alles lehnt ab. Das Panel muss trotzdem aufgehen — und sagen, was fehlt.
      window.sbFetch = async () => ({ data: null, error: { message: 'permission denied for function', status: 403 } });
      try { await openAdminPanel(); } catch (e) { return { ok: false, warum: 'das Panel wirft: ' + e.message }; }
      const m = document.getElementById('modal-admin-panel');
      if (!m) return { ok: false, warum: 'das Panel geht bei lauter Ablehnungen gar nicht auf' };
      const txt = (m.textContent || '').replace(/\s+/g, ' ');
      const klagen = [];
      // Die Sätze, die v33.41 bei lauter Ablehnungen auf den Bildschirm schrieb.
      // Jeder einzelne ist eine ZUSAGE, keine Stille.
      const BERUHIGEND = [
        'Keine User gefunden', 'Keine Nutzer gefunden', 'Keine Flags.', 'Kein Inhalt vorhanden',
        'Keine Client-Fehler', 'Keine offenen Meldungen', 'Keine offenen Foto-Beiträge',
        'Keine offenen Vorschläge', 'Keine Job-Daten', 'Alle Jobs laufen', 'alles ruhig',
        'Noch keine Gutscheine', 'Kostendeckung im grünen Bereich', 'Keine Daten verfügbar',
      ];
      const gefunden = BERUHIGEND.filter(p => txt.indexOf(p) >= 0);
      if (gefunden.length) klagen.push('sagt bei LAUTER Ablehnungen: ' + gefunden.map(p => '„' + p + '"').join(' · ') + ' — das sind Zusagen');
      const gesagt = (m.querySelectorAll('.gs-adm-fehlt') || []).length;
      if (gesagt < 10) klagen.push('nur ' + gesagt + ' Sektion(en) sagen, dass sie nicht laden konnten');
      if (!/Konnte nicht geladen werden/i.test(txt) && !/Nicht verfuegbar|Nicht verfügbar/i.test(txt))
        klagen.push('kein Wort darüber, dass nichts geladen werden konnte: „' + txt.slice(0, 140) + '"');
      try { m.remove(); } catch (_) {}
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: gesagt + ' Sektionen sagen es, keine beruhigende Zeile' };
    },
  },
  {
    name: 'Aktualisieren · jede Sektion lässt sich EINZELN neu holen — ohne die anderen fünfzehn',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      if (typeof window.gsAdmSektionNeu !== 'function')
        return { ok: false, warum: 'gsAdmSektionNeu fehlt — eine frische Zahl kostet das Schliessen des Panels und 16 neue Anfragen' };
      window.sbFetch = async () => ({ data: [], error: null });
      try { await openAdminPanel(); } catch (e) { return { ok: false, warum: 'das Panel wirft: ' + e.message }; }
      const m = document.getElementById('modal-admin-panel');
      if (!m) return { ok: false, warum: 'das Panel geht nicht auf' };
      // Eine Marke AUSSERHALB der Sektion. Überlebt sie den Refresh nicht,
      // wurde das ganze Panel neu gebaut — und das waren sechzehn Anfragen.
      const fremd = m.querySelector('#gs-admin-vouchers-sec');
      if (fremd) fremd.setAttribute('data-marke', 'x');
      const vorher = document.getElementById('gs-admin-cron-sec');
      if (!vorher) return { ok: false, warum: 'die Sektion gs-admin-cron-sec gibt es im Panel gar nicht' };
      vorher.setAttribute('data-alt', 'x');
      window.__adm = [];
      window.sbFetch = async (p) => { window.__adm.push(p); return { data: [], error: null }; };
      await gsAdmSektionNeu('cron');
      const klagen = [];
      if (window.__adm.length !== 1) klagen.push('ein Sektions-Refresh löste ' + window.__adm.length + ' Anfragen aus statt einer');
      const nachher = document.getElementById('gs-admin-cron-sec');
      if (!nachher) klagen.push('die Sektion ist nach dem Refresh weg');
      else if (nachher.getAttribute('data-alt')) klagen.push('die Sektion wurde gar nicht ersetzt');
      const marke = m.querySelector('#gs-admin-vouchers-sec');
      if (!marke || !marke.getAttribute('data-marke')) klagen.push('die Nachbar-Sektion wurde mit neu gebaut — das ist ein ganzes Panel');
      try { m.remove(); } catch (_) {}
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'eine Anfrage (' + window.__adm[0] + '), die Sektion ersetzt, die Nachbarn unberührt' };
    },
  },
  {
    name: 'Die Liste ist die Prüfung · jede Sektion steht in GS_ADM_SEKTIONEN, und jeder Eintrag löst auf',
    lauf: async (SEKT) => {
      const reg = window.GS_ADM_SEKTIONEN;
      if (!reg) return { ok: false, warum: 'GS_ADM_SEKTIONEN fehlt — es gibt keine Liste, also auch keine Prüfung' };
      const klagen = [];
      const schluessel = Object.keys(reg);
      for (const k of schluessel) {
        const e = reg[k];
        if (typeof window[e.hol] !== 'function') klagen.push(k + ': Holer ' + e.hol + ' löst nicht auf');
        if (typeof window[e.html] !== 'function') klagen.push(k + ': Anzeige ' + e.html + ' löst nicht auf');
        if (!e.sec) klagen.push(k + ': kein sec-Element');
      }
      // Und umgekehrt: kein Holer darf an der Liste vorbei existieren.
      const eingetragen = new Set(schluessel.map(k => reg[k].hol));
      for (const n of SEKT) if (!eingetragen.has(n)) klagen.push(n + ' steht in keiner Zeile der Liste');
      // Und das Panel muss jedes sec-Element wirklich rendern.
      localStorage.setItem('gs_is_admin', '1');
      window.sbFetch = async () => ({ data: [], error: null });
      try { await openAdminPanel(); } catch (e) { return { ok: false, warum: 'das Panel wirft: ' + e.message }; }
      const m = document.getElementById('modal-admin-panel');
      if (!m) return { ok: false, warum: 'das Panel geht nicht auf' };
      const fehlend = schluessel.filter(k => !m.querySelector('#' + reg[k].sec));
      if (fehlend.length) klagen.push(fehlend.length + ' Sektion(en) ohne Element im Panel: ' + fehlend.join(', '));
      const knoepfe = m.querySelectorAll('[onclick^="gsAdmSektionNeu("]').length;
      if (knoepfe < schluessel.length) klagen.push('nur ' + knoepfe + ' von ' + schluessel.length + ' Sektionen haben einen Aktualisieren-Knopf');
      try { m.remove(); } catch (_) {}
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') + (klagen.length > 4 ? ' · +' + (klagen.length - 4) : '') };
      return { ok: true, info: schluessel.length + ' Sektionen, alle im Panel, alle mit eigenem Knopf' };
    },
  },
  {
    name: 'Überblick · oben steht, WELCHE Sektion fehlt — und „erneut versuchen" holt nur die',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      // Drei Sektionen scheitern, dreizehn nicht.
      const KAPUTT = ['fn_admin_moderation_feed', 'fn_admin_cron_health', 'fn_admin_vouchers_list'];
      window.sbFetch = async (p) => KAPUTT.some(x => String(p).indexOf(x) >= 0)
        ? { data: null, error: { message: 'permission denied for function', status: 403 } }
        : { data: [], error: null };
      try { await openAdminPanel(); } catch (e) { return { ok: false, warum: 'das Panel wirft: ' + e.message }; }
      const m = document.getElementById('modal-admin-panel');
      if (!m) return { ok: false, warum: 'das Panel geht nicht auf' };
      const u = m.querySelector('#gs-admin-ueberblick-sec');
      const klagen = [];
      if (!u) klagen.push('es gibt keinen Überblick — eine Sektion auf Position zwölf, die schweigt, sieht niemand');
      else {
        const t = (u.textContent || '').replace(/\s+/g, ' ');
        if (t.indexOf('3 von 16') < 0) klagen.push('der Überblick nennt die Zahl nicht: „' + t.slice(0, 90) + '"');
        for (const n of ['Moderation', 'Hintergrund-Jobs', 'Gutscheine'])
          if (t.indexOf(n) < 0) klagen.push('der Überblick nennt „' + n + '" nicht');
        if (t.indexOf('Nutzung') >= 0 || t.indexOf('Stripe') >= 0) klagen.push('der Überblick nennt eine Sektion, die geladen hat');
      }
      // Und die Wiederholung holt NUR die drei.
      if (typeof window.gsAdmFehlendeNeu !== 'function') klagen.push('gsAdmFehlendeNeu fehlt');
      else {
        window.__adm = [];
        const vor = window.sbFetch;
        window.sbFetch = async (p) => { window.__adm.push(p); return vor(p); };
        const n = await gsAdmFehlendeNeu();
        if (window.__adm.length !== 3) klagen.push('„erneut versuchen" löste ' + window.__adm.length + ' Anfragen aus statt drei');
        if (n !== 3) klagen.push('gemeldet wurden ' + n + ' Sektionen statt drei');
        // Und wenn sie danach durchgehen, verschwindet die Zeile.
        window.sbFetch = async () => ({ data: [], error: null });
        await gsAdmFehlendeNeu();
        const u2 = m.querySelector('#gs-admin-ueberblick-sec');
        const t2 = u2 ? (u2.textContent || '').replace(/\s+/g, ' ') : '';
        if (!/Alle 16 Sektionen geladen/.test(t2)) klagen.push('nach dem erfolgreichen Nachholen steht oben immer noch: „' + t2.slice(0, 90) + '"');
      }
      try { m.remove(); } catch (_) {}
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 3).join(' · ') };
      return { ok: true, info: '3 von 16 benannt · erneut versuchen = 3 Anfragen · danach „Alle 16 Sektionen geladen"' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true; window.gsToast = () => {}; window.showProfileToast = () => {};
    window.sbIsLoggedIn = () => true; window._gsFreshToken = async () => 'tok';
  });

  console.log('\n=== admin_check — sagt das Admin-Panel, was stimmt?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await p.evaluate(new Function('SEKT', 'return (' + f.lauf.toString() + ')(SEKT)'), SEKTIONEN); }
    catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: der Server ist gestellt. Geprueft ist, was die App aus einer Antwort MACHT —');
  console.log('  nicht ob die RPC existiert (das sagt backend_check) und nicht ob RLS sie durchlaesst.');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();

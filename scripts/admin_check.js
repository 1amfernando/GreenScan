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

  // ═══════════════════════════════════════════════════════════════════════
  // v33.50 · Die SCHREIB-Seite. v33.42 hat das Lesen auf EINEN Weg gebracht
  // (_gsAdmHole + GS_ADM_SEKTIONEN). Gemessen am 23.09.2026: 17 schreibende
  // Admin-Funktionen, 17 eigene Wege, 0× _gsSchreibOk. gsAdminReviewReport
  // sagte „✅ Als erledigt markiert." mit `Prefer: return=minimal` — die
  // Ablehnung UNSICHTBAR, die Zusage laut. Und zwei RPCs darf `authenticated`
  // gar nicht ausfuehren (fn_assign_role, fn_set_global_api_key): der Knopf
  // „Nutzer sperren" zeigte eine Rueckfrage fuer eine Aktion, die danach
  // scheitert. Dieselbe Klasse wie v33.42, nur mit Folgen, die man nicht
  // zuruecknehmen kann — eine Sperre, die nicht greift, sieht aus wie eine.
  // ═══════════════════════════════════════════════════════════════════════
  {
    name: 'Aktionen · Die Liste ist die Prüfung: jeder Admin-Schreibweg geht durch _gsAdmTun, und jeder Eintrag in GS_ADM_AKTIONEN löst auf',
    lauf: async () => {
      if (typeof window.GS_ADM_AKTIONEN !== 'object' || typeof window._gsAdmTun !== 'function')
        return { ok: false, warum: 'GS_ADM_AKTIONEN oder _gsAdmTun fehlt — es gibt keinen einen Weg' };
      const A = window.GS_ADM_AKTIONEN;
      const klagen = [];
      // 1) Jeder Eintrag ist vollstaendig: Titel + genau EIN Ziel (rpc | pfad | fn).
      for (const k of Object.keys(A)) {
        const a = A[k];
        const ziele = ['rpc', 'pfad', 'fn'].filter(z => a[z]);
        if (!a.titel) klagen.push(k + ': kein Titel');
        if (ziele.length !== 1) klagen.push(k + ': ' + ziele.length + ' Ziele statt eines');
        if (a.pfad && !a.method) klagen.push(k + ': Tabellenweg ohne method');
      }
      // 2) Kein Admin-Schreibvorgang mehr am einen Weg vorbei. Der QUELLTEXT
      //    wird gelesen, nicht das Dokument: ein Weg, der nur in einer
      //    Funktion steht, die niemand ruft, ist trotzdem ein zweiter Weg.
      const src = window.__QUELLE_OHNE || '';
      if (!src) klagen.push('Quelltext nicht uebergeben');
      else {
        const fnRe = /(?:async\s+)?function\s+(gsAdmin[A-Za-z]*)\s*\([^)]*\)\s*\{/g;
        let m; const roh = [];
        while ((m = fnRe.exec(src))) {
          // Rumpf bis zur schliessenden Klammer
          let i = m.index + m[0].length - 1, d = 0, j = i;
          for (; j < src.length && j < i + 12000; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
          const r = src.slice(i, j + 1);
          const schreibt = /sbFetch\([^;]{0,300}?method:\s*'(POST|PATCH|DELETE|PUT)'/.test(r);
          if (!schreibt) continue;
          // Ein POST an eine RPC, die nur LIEST, ist kein Schreibweg — aber nur,
          // wenn sie namentlich als Lese-RPC gefuehrt ist (GS_ADM_LESE_RPC oder
          // eine Sektion). Alles andere zaehlt.
          const lese = new Set([].concat(window.GS_ADM_LESE_RPC || [],
            Object.keys(window.GS_ADM_SEKTIONEN || {}).map(k => window.GS_ADM_SEKTIONEN[k].rpc).filter(Boolean)));
          const rpcs = (r.match(/\/rest\/v1\/rpc\/([a-z_]+)/g) || []).map(x => x.replace(/.*\//, ''));
          const nurLesen = rpcs.length > 0 && rpcs.every(x => lese.has(x)) && !/method:\s*'(PATCH|DELETE|PUT)'/.test(r);
          if (!nurLesen) roh.push(m[1]);
        }
        if (roh.length) klagen.push(roh.length + ' Admin-Funktion(en) schreiben noch am einen Weg vorbei: ' + roh.slice(0, 4).join(', '));
        // 3) Und die Umkehrung: jeder Eintrag der Liste wird auch GERUFEN.
        for (const k of Object.keys(A)) {
          const n = (src.match(new RegExp("_gsAdmTun\\(\\s*'" + k + "'", 'g')) || []).length;
          if (!n) klagen.push(k + ': steht in der Liste, ruft aber niemand');
        }
      }
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') + (klagen.length > 4 ? ' · +' + (klagen.length - 4) : '') };
      return { ok: true, info: Object.keys(A).length + ' Aktionen, jede mit genau einem Ziel, 0 Schreibwege daneben' };
    },
  },
  {
    name: 'Aktionen · Sechs Zustände mit Grund: ok · abgelehnt · nicht_freigeschaltet · nicht_verfuegbar · fehler · kein_zugriff — und nie eine Zusage für 0 Zeilen',
    lauf: async () => {
      if (typeof window._gsAdmTun !== 'function') return { ok: false, warum: '_gsAdmTun fehlt' };
      localStorage.setItem('gs_is_admin', '1');
      const klagen = [];
      const stell = (antwort) => { window.sbFetch = async () => antwort; };
      const tun = async (k, body) => { try { return await window._gsAdmTun(k, body || {}); } catch (e) { return { __wirft: e.message }; } };
      const erwarte = async (k, antwort, state, name) => {
        // Die Sperr-Erinnerung ist je Sitzung klebrig — gewollt. Zwischen zwei
        // gestellten Antworten muss sie deshalb geleert werden, sonst misst
        // jedes Szenario nach dem ersten „GRANT fehlt" nur noch die Erinnerung.
        try { window._gsAdmGesperrtLeeren(); } catch (_) {}
        stell(antwort);
        const r = await tun(k, { p_x: 1 });
        if (!r || typeof r.state !== 'string') { klagen.push(name + ': kein Zustand (' + JSON.stringify(r).slice(0, 60) + ')'); return; }
        if (r.state !== state) klagen.push(name + ': „' + r.state + '" statt „' + state + '"');
        else if (state !== 'ok' && !r.grund) klagen.push(name + ': „' + state + '" ohne Grund');
      };
      const RPC = 'moderate';          // ein RPC-Weg
      const TAB = 'report_review';     // der eine Tabellen-Weg (PATCH)
      await erwarte(RPC, { data: null, error: { message: 'new row violates row-level security policy', status: 403 } }, 'abgelehnt', 'RLS');
      await erwarte(RPC, { data: null, error: { message: 'permission denied for function fn_admin_moderate', status: 403 } }, 'nicht_freigeschaltet', 'GRANT fehlt');
      await erwarte(RPC, { data: null, error: { message: 'Could not find the function public.fn_admin_moderate in the schema cache (PGRST202)', status: 404 } }, 'nicht_verfuegbar', 'RPC fehlt');
      await erwarte(RPC, { data: null, error: { message: 'JWT expired', status: 401 } }, 'abgelehnt', 'Sitzung');
      await erwarte(RPC, { data: null, error: { message: 'Failed to fetch', status: 0 } }, 'fehler', 'Netz');
      await erwarte(RPC, { data: { ok: false, error: 'forbidden' }, error: null }, 'abgelehnt', 'RPC sagt {ok:false}');
      await erwarte(RPC, { data: { ok: true }, error: null }, 'ok', 'RPC {ok:true}');
      await erwarte(RPC, { data: { inserted: true }, error: null }, 'ok', 'RPC Objekt ohne ok-Feld');
      // Der Tabellenweg: 0 Zeilen sind eine Ablehnung — das ist der Fall, den
      // `if (r.error)` nie sieht und den return=minimal unsichtbar macht.
      await erwarte(TAB, { data: [], error: null }, 'abgelehnt', 'PATCH 0 Zeilen');
      await erwarte(TAB, { data: [{ id: 'x', status: 'reviewed' }], error: null }, 'ok', 'PATCH 1 Zeile');
      // Ohne Server-Ja geht gar nichts hinaus.
      localStorage.removeItem('gs_is_admin');
      window.__adm = []; window.sbFetch = async (p) => { window.__adm.push(p); return { data: { ok: true }, error: null }; };
      const kz = await tun(RPC, {});
      if (!kz || kz.state !== 'kein_zugriff') klagen.push('ohne Admin: „' + (kz && kz.state) + '" statt „kein_zugriff"');
      if (window.__adm.length) klagen.push('ohne Admin ging trotzdem eine Anfrage hinaus');
      localStorage.setItem('gs_is_admin', '1');
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') + (klagen.length > 4 ? ' · +' + (klagen.length - 4) : '') };
      return { ok: true, info: '11 Antworten des Servers, jede im richtigen Zustand, jede Nicht-ok mit Grund' };
    },
  },
  {
    name: 'Aktionen · Kein `return=minimal` an einem Admin-Schreibvorgang — was man nicht sieht, kann man nicht prüfen',
    lauf: async () => {
      const src = window.__QUELLE_OHNE || '';
      if (!src) return { ok: false, warum: 'Quelltext nicht uebergeben' };
      // Innerhalb des Admin-Blocks: jede Funktion gsAdmin* / _gsAdmTun
      const fnRe = /(?:async\s+)?function\s+(gsAdmin[A-Za-z]*|_gsAdmTun)\s*\([^)]*\)\s*\{/g;
      let m; const funde = [];
      while ((m = fnRe.exec(src))) {
        let i = m.index + m[0].length - 1, d = 0, j = i;
        for (; j < src.length && j < i + 12000; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) break; } }
        if (/return=minimal/.test(src.slice(i, j + 1))) funde.push(m[1]);
      }
      if (funde.length) return { ok: false, warum: funde.length + '× return=minimal: ' + funde.join(', ') };
      return { ok: true, info: '0× return=minimal in den Admin-Schreibwegen' };
    },
  },
  {
    name: 'Aktionen · Ein toter Knopf SAGT es: nach „nicht_freigeschaltet" keine Rückfrage mehr, der Knopf nennt die Migration, der Überblick zählt',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      const klagen = [];
      if (typeof window.gsAdminAssignRole !== 'function') return { ok: false, warum: 'gsAdminAssignRole fehlt' };
      // Der Server sagt: GRANT fehlt (genau die Antwort der Live-DB, 23.09.2026).
      window.sbFetch = async (p) => String(p).indexOf('fn_assign_role') >= 0
        ? { data: null, error: { message: 'permission denied for function fn_assign_role', status: 403 } }
        : { data: [], error: null };
      let rueckfragen = 0;
      window.gsConfirmModal = async () => { rueckfragen++; return true; };
      let gesagt = [];
      window.showProfileToast = (x) => { gesagt.push(typeof x === 'string' ? x : ((x && (x.title || '')) + ' ' + (x && (x.body || '')))); };
      window.gsToast = (x) => { gesagt.push(typeof x === 'string' ? x : ((x && (x.title || '')) + ' ' + (x && (x.body || '')))); };
      // Versuch 1: die Rueckfrage kommt (der Zustand ist noch unbekannt), dann scheitert es — und der Satz stimmt.
      try { if (typeof window._gsAdmGesperrtLeeren === 'function') window._gsAdmGesperrtLeeren(); } catch (_) {}
      const r1 = await window.gsAdminAssignRole('u-1', 'banned', null);
      if (r1) klagen.push('Versuch 1 gibt Erfolg zurueck, obwohl der Server ablehnt');
      const s1 = gesagt.join(' | ');
      if (/Rolle zugewiesen|✅/.test(s1)) klagen.push('Versuch 1 sagt Erfolg: „' + s1.slice(0, 80) + '"');
      if (!/freigegeben|freigeschaltet|Migration/i.test(s1)) klagen.push('Versuch 1 nennt weder „freigeschaltet" noch die Migration: „' + s1.slice(0, 90) + '"');
      // Versuch 2: KEINE Rueckfrage mehr fuer eine Aktion, von der die Sitzung weiss, dass sie nicht geht.
      const vorher = rueckfragen; gesagt = [];
      await window.gsAdminAssignRole('u-1', 'banned', null);
      if (rueckfragen > vorher) klagen.push('Versuch 2 stellt wieder die Rueckfrage — fuer eine Aktion, die nicht freigeschaltet ist');
      if (!gesagt.length) klagen.push('Versuch 2 sagt gar nichts');
      // Und im Nutzer-Detail steht es am Knopf.
      if (typeof window.gsAdminOpenUserDetail === 'function') {
        window.gsAdminUserDetail = async () => ({ profile: { id: 'u-1', role: 'user', tier: 'free', display_name: 'Test' }, subscription: null, counts: {} });
        try { await window.gsAdminOpenUserDetail('u-1'); } catch (e) { klagen.push('Nutzer-Detail wirft: ' + e.message); }
        const m = document.getElementById('modal-admin-userdetail');
        const t = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
        if (!m) klagen.push('Nutzer-Detail geht nicht auf');
        else if (!/freigegeben|freigeschaltet|Migration/i.test(t)) klagen.push('das Nutzer-Detail sagt am Sperr-Knopf nichts: „' + t.slice(0, 100) + '"');
        try { if (m) m.remove(); } catch (_) {}
      }
      // Und der Ueberblick oben zaehlt es.
      try { await openAdminPanel(); } catch (e) { klagen.push('Panel wirft: ' + e.message); }
      const u = document.querySelector('#modal-admin-panel #gs-admin-ueberblick-sec');
      const ut = u ? (u.textContent || '').replace(/\s+/g, ' ') : '';
      if (!u) klagen.push('kein Ueberblick');
      else if (!/Aktion/.test(ut) || !/Rolle/.test(ut)) klagen.push('der Ueberblick nennt die gesperrte Aktion nicht: „' + ut.slice(0, 100) + '"');
      try { const mp = document.getElementById('modal-admin-panel'); if (mp) mp.remove(); } catch (_) {}
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') + (klagen.length > 4 ? ' · +' + (klagen.length - 4) : '') };
      return { ok: true, info: 'Rueckfrage 1× · danach 0× · Detail und Ueberblick nennen es' };
    },
  },
  {
    name: 'Aktionen · Die Meldung kommt NACH der Antwort und stimmt — in beide Richtungen (Meldung erledigt: 0 Zeilen ≠ 1 Zeile)',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      if (typeof window.gsAdminReviewReport !== 'function') return { ok: false, warum: 'gsAdminReviewReport fehlt' };
      const klagen = [];
      let gesagt = [];
      window.gsToast = (x) => { gesagt.push(typeof x === 'string' ? x : ((x && (x.title || '')) + ' ' + (x && (x.body || '')))); };
      window.gsAdmSektionNeu = async () => {};
      // a) RLS laesst 0 Zeilen durch (der Fall, den return=minimal verschluckte)
      window.sbFetch = async () => ({ data: [], error: null });
      await window.gsAdminReviewReport('r-1', 'reviewed');
      const a = gesagt.join(' | ');
      if (/erledigt markiert|✅/.test(a)) klagen.push('0 Zeilen → „' + a.slice(0, 70) + '" — eine Zusage fuer nichts');
      if (!a) klagen.push('0 Zeilen → gar keine Meldung');
      // b) Der Server bestaetigt eine Zeile → JETZT darf es das sagen
      gesagt = [];
      window.sbFetch = async (p, o) => {
        // return=representation ist Pflicht, sonst gibt es nichts zu zaehlen
        const h = (o && o.headers) || {};
        if (!/representation/.test(String(h.Prefer || h.prefer || ''))) return { data: [], error: null };
        return { data: [{ id: 'r-1', status: 'reviewed' }], error: null };
      };
      await window.gsAdminReviewReport('r-1', 'reviewed');
      const b = gesagt.join(' | ');
      if (!/erledigt/.test(b)) klagen.push('1 Zeile → keine Bestaetigung: „' + b.slice(0, 70) + '"');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '0 Zeilen: keine Zusage · 1 Zeile (return=representation): „erledigt"' };
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
  // v33.50: der Quelltext OHNE Kommentare und OHNE Changelog — zum ZAEHLEN von
  // Namen (apk_check R9: der Changelog nennt die API, um die es geht, woertlich).
  const QUELLE_OHNE = (function (t) {
    let o = '', i = 0, n = t.length;
    while (i < n) {
      const c = t[i], c2 = t[i + 1];
      if (c === '"' || c === "'" || c === '`') { const q = c; o += c; i++;
        while (i < n && t[i] !== q) { if (t[i] === '\\') { o += t[i]; i++; } o += t[i]; i++; }
        o += t[i] || ''; i++; continue; }
      if (c === '/' && c2 === '/') { while (i < n && t[i] !== '\n') i++; continue; }
      if (c === '/' && c2 === '*') { i += 2; while (i < n && !(t[i] === '*' && t[i + 1] === '/')) i++; i += 2; o += ' '; continue; }
      if (c === '<' && t.substr(i, 4) === '<!--') { const e = t.indexOf('-->', i); i = (e < 0 ? n : e + 3); o += ' '; continue; }
      o += c; i++;
    }
    const a = o.indexOf('window.GS_RELEASES = ['); if (a >= 0) { const b = o.indexOf('\n];', a); if (b >= 0) o = o.slice(0, a) + o.slice(b + 3); }
    return o;
  })(require('fs').readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'));
  await p.evaluate((q) => { window.__QUELLE_OHNE = q; }, QUELLE_OHNE);

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

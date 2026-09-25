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
//
// v33.51 · DIE SPUR. Gemessen am 25.09.2026 (Live-DB, nur lesend): von den 15
// Aktionen in GS_ADM_AKTIONEN schrieben ZEHN eine Zeile nach audit_log, FUENF
// nicht — darunter zwei Moderationsentscheidungen (Foto-Beitrag, Arten-
// Vorschlag) und „Meldung erledigen" (ein nackter PATCH, gar keine RPC). Und
// zwei Aktionen standen im Protokoll als roher Slug (admin_flag_set,
// voucher_redeem). Seither deklariert jeder Eintrag genau eines von
// spur · spur_ab · ohne_spur, und dieser Pruefstand hat eine SQL-HAELFTE:
// die Migration 20260925_admin_audit_vollstaendig.sql wird in einem lokalen
// Postgres ZWEIMAL angewandt, die drei Funktionen werden als Admin und als
// Nicht-Admin GERUFEN, und die Spuren werden gegen die Deklaration der App
// gehalten. Ohne Postgres: „nicht pruefbar" (Exit 2), nie gruen.
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
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
      // v33.51: report_review ist eine RPC mit ERSATZ-PATCH. Der Tabellenweg wird
      // gemessen, indem die RPC fehlt (404) und die gestellte Antwort dem PATCH gilt.
      const FEHLT = { data: null, error: { message: 'Could not find the function public.fn_admin_review_report in the schema cache (PGRST202)', status: 404 } };
      const stell = (antwort, tabelle) => { window.sbFetch = async (pf) => (tabelle && /\/rpc\//.test(pf)) ? FEHLT : antwort; };
      const tun = async (k, body) => { try { return await window._gsAdmTun(k, body || {}); } catch (e) { return { __wirft: e.message }; } };
      const erwarte = async (k, antwort, state, name) => {
        // Die Sperr-Erinnerung ist je Sitzung klebrig — gewollt. Zwischen zwei
        // gestellten Antworten muss sie deshalb geleert werden, sonst misst
        // jedes Szenario nach dem ersten „GRANT fehlt" nur noch die Erinnerung.
        try { window._gsAdmGesperrtLeeren(); } catch (_) {}
        stell(antwort, k === TAB);
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
      // v33.51: die RPC fehlt (404) → der Ersatz-PATCH ist der Tabellenweg, um den es hier geht.
      const FEHLT = { data: null, error: { message: 'Could not find the function public.fn_admin_review_report in the schema cache (PGRST202)', status: 404 } };
      try { window._gsAdmGesperrtLeeren(); } catch (_) {}
      // a) RLS laesst 0 Zeilen durch (der Fall, den return=minimal verschluckte)
      window.sbFetch = async (pf) => /\/rpc\//.test(pf) ? FEHLT : ({ data: [], error: null });
      await window.gsAdminReviewReport('r-1', 'reviewed');
      const a = gesagt.join(' | ');
      if (/erledigt markiert|✅/.test(a)) klagen.push('0 Zeilen → „' + a.slice(0, 70) + '" — eine Zusage fuer nichts');
      if (!a) klagen.push('0 Zeilen → gar keine Meldung');
      // b) Der Server bestaetigt eine Zeile → JETZT darf es das sagen
      gesagt = [];
      window.sbFetch = async (p, o) => {
        if (/\/rpc\//.test(p)) return FEHLT;
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
  {
    name: 'Spur · Die Liste ist die Prüfung: jede Aktion sagt genau eines von spur · spur_ab · ohne_spur — und die Deckung ist eine Rechnung, keine Behauptung',
    lauf: async () => {
      const A = window.GS_ADM_AKTIONEN || {};
      if (typeof window._gsAdmSpurDeckung !== 'function') return { ok: false, warum: '_gsAdmSpurDeckung fehlt' };
      const klagen = [];
      for (const k of Object.keys(A)) {
        const a = A[k];
        const n = ['spur', 'spur_ab', 'ohne_spur'].filter(x => a[x]).length;
        if (n !== 1) klagen.push(k + ': ' + n + ' Spur-Angaben statt einer');
        if (a.spur_ab && !(a.spur_ab.action && /^\d{8}_.+\.sql$/.test(a.spur_ab.migration || ''))) klagen.push(k + ': spur_ab ohne action/migration');
        if (a.ohne_spur && String(a.ohne_spur).length < 10) klagen.push(k + ': ohne_spur ohne Grund');
        if (!a.emoji) klagen.push(k + ': kein Emoji fuer die Protokoll-Zeile');
      }
      const d = window._gsAdmSpurDeckung([]);
      if (d.server.length + d.ab.length + d.ohne.length !== d.gesamt) klagen.push('Deckung zaehlt ' + (d.server.length + d.ab.length + d.ohne.length) + ' von ' + d.gesamt);
      // Gesehen wird nur, was in den ZEILEN steht — nie aus der Liste allein.
      const ab0 = A[d.ab[0]];
      if (ab0) {
        const d2 = window._gsAdmSpurDeckung([{ action: ab0.spur_ab.action }]);
        if (d2.abGesehen.length !== 1) klagen.push('eine Zeile mit „' + ab0.spur_ab.action + '" → abGesehen=' + d2.abGesehen.length + ' statt 1');
        const d3 = window._gsAdmSpurDeckung([{ action: 'irgendwas_anderes' }]);
        if (d3.abGesehen.length !== 0) klagen.push('eine fremde Zeile → abGesehen=' + d3.abGesehen.length + ' statt 0');
      }
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
      return { ok: true, info: d.gesamt + ' Aktionen: ' + d.server.length + ' mit Spur · ' + d.ab.length + ' erst nach ' + d.migrationen.join(', ') + ' · ' + d.ohne.length + ' bewusst ohne' };
    },
  },
  {
    name: 'Protokoll · kein roher Slug auf dem Bildschirm, der Fuss nennt die Deckung, und „Spur gesehen" steht nur da, wenn eine Zeile da war',
    lauf: async () => {
      if (typeof window._gsAdminAuditHtml !== 'function') return { ok: false, warum: '_gsAdminAuditHtml fehlt' };
      const A = window.GS_ADM_AKTIONEN || {};
      const klagen = [];
      // Eine Zeile je Aktion, die der Server je geschrieben hat (Live-Messung
      // 25.09.2026) — dazu die drei, die erst die Migration schreibt.
      const live = ['knowledge_growth_daily', 'admin_set_tier', 'admin_moderate', 'role_assign', 'global_api_key_change', 'voucher_create', 'voucher_toggle', 'voucher_redeem', 'admin_flag_set', 'knowledge_create', 'knowledge_update', 'knowledge_delete', 'knowledge_publish'];
      const ab = Object.keys(A).filter(k => A[k].spur_ab).map(k => A[k].spur_ab.action);
      const zeile = (action, extra) => Object.assign({ action, target_type: 'profile', target_id: 'x', diff: {}, created_at: new Date().toISOString(), actor_email: 'admin@example.org' }, extra || {});
      const rend = (rows) => { const el = document.createElement('div'); el.innerHTML = window._gsAdminAuditHtml(rows); return el; };
      // a) alle bekannten Aktionen: keine Zeile zeigt ihren rohen Slug
      const el = rend(live.map(x => zeile(x, { diff: { value: '1', title: 'T', published: true, tier: 'pro', new: 'admin', action: 'hide', topic: 'x' } })));
      const text = el.textContent || '';
      const roh = live.filter(x => new RegExp('(^|[^a-z_])' + x + '([^a-z_]|$)').test(text));
      if (roh.length) klagen.push('roher Slug auf dem Bildschirm: ' + roh.join(', '));
      const fuss = el.querySelector('.gs-adm-spur');
      if (!fuss) klagen.push('kein Fuss mit der Deckung');
      else {
        const f = fuss.textContent || '';
        const d = window._gsAdmSpurDeckung([]);
        if (!f.includes(d.server.length + ' von ' + d.gesamt)) klagen.push('Fuss nennt nicht „' + d.server.length + ' von ' + d.gesamt + '": „' + f.slice(0, 80) + '"');
        if (d.ab.length && !/erst nach Migration 20260925/.test(f)) klagen.push('Fuss nennt die Migration nicht, obwohl keine Spur gesehen wurde');
        if (/Spur gesehen/.test(f)) klagen.push('„Spur gesehen" ohne eine solche Zeile');
        if (!/Bewusst ohne/.test(f) || !/liest nur/.test(f)) klagen.push('die bewusst spurlosen Aktionen fehlen im Fuss (mit Grund)');
      }
      // b) eine Zeile einer spur_ab-Aktion → „Spur gesehen" fuer genau diese
      if (ab.length) {
        const el2 = rend([zeile(ab[0], { diff: { approve: true, species: 'sp-1' } })]);
        const f2 = (el2.querySelector('.gs-adm-spur') || {}).textContent || '';
        if (!/Spur gesehen/.test(f2)) klagen.push('Zeile „' + ab[0] + '" da, Fuss sagt nicht „Spur gesehen"');
        const t2 = el2.textContent || '';
        if (new RegExp('(^|[^a-z_])' + ab[0] + '([^a-z_]|$)').test(t2)) klagen.push('roher Slug: ' + ab[0]);
        // c) alle drei → „angewandt"
        const el3 = rend(ab.map(x => zeile(x)));
        const f3 = (el3.querySelector('.gs-adm-spur') || {}).textContent || '';
        if (!/angewandt/.test(f3)) klagen.push('alle ' + ab.length + ' Spuren gesehen, Fuss sagt nicht „angewandt"');
      }
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
      return { ok: true, info: live.length + ' Aktionen mit Beschriftung · Fuss: Deckung, Migration, Spur gesehen nur mit Zeile' };
    },
  },
  {
    name: 'Meldung erledigen · die RPC zuerst; der PATCH nur, wenn sie FEHLT — und dann sagt die Meldung „ohne Protokolleintrag"',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      if (typeof window._gsAdmTun !== 'function' || typeof window.gsAdminReviewReport !== 'function') return { ok: false, warum: '_gsAdmTun / gsAdminReviewReport fehlt' };
      const klagen = [];
      window.gsAdmSektionNeu = async () => {};
      let calls = [];
      const stell = (rpc, patch) => { calls = []; window.sbFetch = async (p, o) => { calls.push({ p, o }); return /\/rpc\//.test(p) ? rpc : patch; }; };
      const FEHLT = { data: null, error: { message: 'Could not find the function public.fn_admin_review_report in the schema cache (PGRST202)', status: 404 } };
      // a) RPC fehlt → PATCH mit return=representation, Filter und Status; Antwort sagt es
      stell(FEHLT, { data: [{ id: 'r-9', status: 'dismissed' }], error: null });
      try { window._gsAdmGesperrtLeeren(); } catch (_) {}
      let r = await window._gsAdmTun('report_review', { p_id: 'r-9', p_status: 'dismissed', p_note: null });
      if (r.state !== 'ok' || !r.ersatz) klagen.push('RPC fehlt → ' + r.state + ' ersatz=' + r.ersatz + ' statt ok+ersatz');
      if (!/20260925_admin_audit_vollstaendig\.sql/.test(r.grund || '')) klagen.push('Ersatz nennt die Migration nicht: „' + (r.grund || '') + '"');
      const patch = calls.find(c => !/\/rpc\//.test(c.p));
      if (!patch) klagen.push('kein PATCH nach fehlender RPC');
      else {
        if (!/\/rest\/v1\/user_reports\?id=eq\.r-9$/.test(patch.p)) klagen.push('PATCH-Pfad: ' + patch.p);
        const h = (patch.o && patch.o.headers) || {};
        if (!/representation/.test(String(h.Prefer || ''))) klagen.push('PATCH ohne return=representation');
        let b = {}; try { b = JSON.parse(patch.o.body); } catch (_) {}
        if (b.status !== 'dismissed' || !b.reviewed_at) klagen.push('PATCH-Body: ' + JSON.stringify(b).slice(0, 60));
        if (patch.o.method !== 'PATCH') klagen.push('Ersatz-Methode ' + patch.o.method);
      }
      // b) RPC da → genau eine Anfrage, kein Ersatz
      stell({ data: { ok: true, status: 'reviewed' }, error: null }, { data: [{ id: 'r-9' }], error: null });
      r = await window._gsAdmTun('report_review', { p_id: 'r-9', p_status: 'reviewed', p_note: null });
      if (r.state !== 'ok' || r.ersatz) klagen.push('RPC da → ' + r.state + ' ersatz=' + r.ersatz);
      if (calls.length !== 1) klagen.push('RPC da, trotzdem ' + calls.length + ' Anfragen');
      // c) RPC gesperrt (GRANT fehlt) oder abgelehnt → KEIN Ersatz
      stell({ data: null, error: { message: 'permission denied for function fn_admin_review_report', status: 403 } }, { data: [{ id: 'r-9' }], error: null });
      try { window._gsAdmGesperrtLeeren(); } catch (_) {}
      r = await window._gsAdmTun('report_review', { p_id: 'r-9', p_status: 'reviewed' });
      if (r.ersatz || calls.length !== 1) klagen.push('GRANT fehlt → Ersatz gelaufen (' + calls.length + ' Anfragen, ersatz=' + r.ersatz + ')');
      // d) RPC fehlt UND der PATCH aendert 0 Zeilen → keine Zusage
      stell(FEHLT, { data: [], error: null });
      try { window._gsAdmGesperrtLeeren(); } catch (_) {}
      r = await window._gsAdmTun('report_review', { p_id: 'r-9', p_status: 'reviewed' });
      if (r.state === 'ok') klagen.push('RPC fehlt + PATCH 0 Zeilen → „ok"');
      // e) durch die Oberflaeche: der Toast sagt es
      let gesagt = [];
      window.gsToast = (x) => { gesagt.push(typeof x === 'string' ? x : ((x && (x.title || '')) + ' ' + (x && (x.body || '')))); };
      stell(FEHLT, { data: [{ id: 'r-9', status: 'reviewed' }], error: null });
      try { window._gsAdmGesperrtLeeren(); } catch (_) {}
      await window.gsAdminReviewReport('r-9', 'reviewed');
      const g = gesagt.join(' | ');
      if (!/erledigt/.test(g) || !/Ohne Protokolleintrag/.test(g)) klagen.push('Toast im Ersatzfall: „' + g.slice(0, 90) + '"');
      gesagt = [];
      stell({ data: { ok: true }, error: null }, { data: [], error: null });
      await window.gsAdminReviewReport('r-9', 'reviewed');
      if (/Protokolleintrag/.test(gesagt.join(' | '))) klagen.push('Toast nennt „Protokolleintrag", obwohl die RPC lief');
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
      return { ok: true, info: 'RPC fehlt → PATCH (representation, Filter, Status) + „ohne Protokolleintrag" · RPC da → 1 Anfrage · GRANT fehlt → kein Ersatz · 0 Zeilen → keine Zusage' };
    },
  },
  {
    name: 'Ein RAISE EXCEPTION („Only admins …", „admin only") ist eine Ablehnung, kein Fehler',
    lauf: async () => {
      localStorage.setItem('gs_is_admin', '1');
      const klagen = [];
      const erwarte = async (msg, state) => {
        try { window._gsAdmGesperrtLeeren(); } catch (_) {}
        window.sbFetch = async () => ({ data: null, error: { message: msg, status: 400 } });
        const r = await window._gsAdmTun('assign_role', { _user_id: 'u', _role: 'banned' });
        if (r.state !== state) klagen.push('„' + msg + '" → ' + r.state + ' statt ' + state);
        else if (!r.grund) klagen.push('„' + msg + '" ohne Grund');
      };
      await erwarte('Only admins can assign roles', 'abgelehnt');
      await erwarte('admin only', 'abgelehnt');
      await erwarte('Not authenticated', 'abgelehnt');
      await erwarte('division by zero', 'fehler');   // die Gegenrichtung: ein echter Fehler bleibt einer
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'drei Nein-Saetze → abgelehnt · ein Fehler → fehler' };
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
  // ── v33.51 · Die Spur, ausserhalb der Seite: Migrationen lesen und SQL AUSFUEHREN ──
  const AKT = await p.evaluate(() => JSON.parse(JSON.stringify(window.GS_ADM_AKTIONEN || {}, (k, v) => (typeof v === 'function' ? undefined : v))));
  const S = [];
  const fallS = (name, fn) => { try { S.push(Object.assign({ name }, fn())); } catch (e) { S.push({ name, ok: false, warum: 'Ausnahme: ' + String(e.message).split('\n')[0] }); } };
  fallS('Spur · jeder deklarierte Aktionsname steht in einer Migration neben einem audit_log-INSERT, und jede spur_ab-Migration liegt im Repo', () => {
    const dir = path.join(__dirname, '..', 'supabase', 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql'));
    const korpus = files.map(f => ({ f, t: fs.readFileSync(path.join(dir, f), 'utf8') }));
    const klagen = [], nurLive = [];
    let n = 0;
    for (const k of Object.keys(AKT)) {
      const a = AKT[k];
      const acts = [].concat(a.spur || [], (a.spur_ab && a.spur_ab.action) || []);
      for (const x of acts) {
        n++;
        // „neben": das Literal innerhalb von 400 Zeichen NACH einem INSERT in audit_log
        const re = new RegExp("insert\\s+into\\s+(public\\.)?audit_log[\\s\\S]{0,400}?'" + x + "'", 'i');
        const imRepo = korpus.some(c => re.test(c.t));
        // Drei Klassen (wie backend_check): im Repo belegt · nur live belegt (mit
        // datierter Quelle deklariert) · gar nicht belegt. Eine Live-Angabe, deren
        // Name inzwischen im Repo steht, ist ueberholt und wird gemeldet.
        if (imRepo && a.spur_quelle) klagen.push(k + ': spur_quelle ueberholt — „' + x + '" steht jetzt in einer Migration');
        else if (!imRepo && a.spur_quelle) nurLive.push(k + ' (' + x + ')');
        else if (!imRepo) klagen.push(k + ': „' + x + '" steht in keiner Migration neben einem audit_log-INSERT — und keine spur_quelle');
      }
      if (a.spur_ab && !files.includes(a.spur_ab.migration)) klagen.push(k + ': Migration ' + a.spur_ab.migration + ' fehlt im Repo');
    }
    if (klagen.length) return { ok: false, warum: klagen.slice(0, 3).join(' · ') };
    return { ok: true, info: n + ' Aktionsnamen: ' + (n - nurLive.length) + ' im Repo neben einem audit_log-INSERT · ' + nurLive.length + ' nur live belegt (' + nurLive.join(', ') + ') · ' + files.length + ' Migrationen gelesen' };
  });

  // SQL-Haelfte: die Migration wirklich anwenden und die Funktionen RUFEN.
  const URL0 = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
  const DBN = 'gs_admin_check';
  const MIGF = path.join(__dirname, '..', 'supabase', 'migrations', '20260925_admin_audit_vollstaendig.sql');
  const psql = (url, args) => spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' });
  const letzte = (r) => { const z = String((r.stderr || r.stdout || '')).trim().split('\n').map(x => x.trim()).filter(Boolean); return (z.find(x => /^(ERROR|FEHLER|DETAIL|HINT)/i.test(x)) || z[0] || '').slice(0, 200); };
  const sql = (url, q) => { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(letzte(r)); return (r.stdout || '').trim(); };
  const sqlFile = (url, f) => { const r = psql(url, ['-f', f]); if (r.status !== 0) throw new Error(path.basename(f) + ': ' + letzte(r)); };
  const ADMIN = '11111111-1111-4111-8111-000000000001';
  const ALS = (admin, uid) => `select set_config('gs.admin','${admin ? '1' : '0'}',false); select set_config('gs.uid','${uid}',false);`;
  let offen = 0;
  let pgOk = false;
  try { sql(URL0, 'select 1'); pgOk = true; }
  catch (e) { offen++; S.push({ name: 'Lokales Postgres', ok: null, warum: 'nicht erreichbar unter ' + URL0.replace(/\/\/.*@/, '//…@') + ' — `bash scripts/_pg_local.sh start` (' + String(e.message).split('\n')[0] + ')' }); }
  if (pgOk) {
    sql(URL0, `drop database if exists ${DBN}`);
    sql(URL0, `create database ${DBN}`);
    const url = URL0.replace(/\/[^/]*$/, '/' + DBN);
    // Die Tabellen wie live (information_schema, 25.09.2026), auf die Spalten
    // gekuerzt, die die drei Funktionen anfassen; auth.uid() und is_admin_user()
    // lesen eine Sitzungsvariable, damit ein Fall den Aufrufer STELLEN kann.
    sql(url, `
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('gs.uid', true), '')::uuid $$;
      create or replace function public.is_admin_user() returns boolean language sql stable as $$ select coalesce(current_setting('gs.admin', true), '') = '1' $$;
      create table public.audit_log (id bigserial primary key, actor_id uuid, action text not null, target_type text, target_id text, diff jsonb, ip_hash text, created_at timestamptz not null default now());
      create table public.species_images (id uuid primary key default gen_random_uuid(), species_id text, url text, is_primary boolean default false, review_status text default 'pending', admin_note text, reviewed_by uuid, reviewed_at timestamptz);
      create table public.species_proposals (id uuid primary key default gen_random_uuid(), user_id uuid, name text, latin text, family text, category text, data jsonb default '{}'::jsonb, review_status text default 'pending', admin_note text, reviewed_by uuid, reviewed_at timestamptz);
      create table public.species (slug text primary key, name text, lat text, fam text, cat text, emoji text, description text, habitat text, season text, uses text, warning text, lookalike text, source text, data jsonb);
      create table public.system_events (id bigserial primary key, severity text, source text, event text, detail jsonb, created_at timestamptz default now());
      create table public.user_reports (id uuid primary key default gen_random_uuid(), reporter_id uuid, target_type text, target_ref text, reason text,
        status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')), admin_note text, reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz default now());
      do $$ begin
        if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
        if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
      end $$;
    `);
    const spuren = () => Number(sql(url, `select count(*) from public.audit_log`));
    const erwartet = {
      species_image: AKT.species_image && AKT.species_image.spur_ab && AKT.species_image.spur_ab.action,
      species_proposal: AKT.species_proposal && AKT.species_proposal.spur_ab && AKT.species_proposal.spur_ab.action,
      report_review: AKT.report_review && AKT.report_review.spur_ab && AKT.report_review.spur_ab.action,
    };
    fallS('SQL · die Migration laesst sich anwenden — und ein zweites Mal (idempotent)', () => {
      sqlFile(url, MIGF); sqlFile(url, MIGF);
      const n = sql(url, `select count(*) from pg_proc where proname in ('fn_admin_review_species_image','fn_admin_review_species_proposal','fn_admin_review_report')`);
      if (n !== '3') return { ok: false, warum: n + ' von 3 Funktionen vorhanden' };
      const g = sql(url, `select has_function_privilege('authenticated', 'public.fn_admin_review_report(uuid,text,text)', 'EXECUTE')::text || '/' || has_function_privilege('anon', 'public.fn_admin_review_report(uuid,text,text)', 'EXECUTE')::text`);
      if (g !== 'true/false') return { ok: false, warum: 'GRANT authenticated/anon = ' + g + ' statt true/false' };
      return { ok: true, info: '3 Funktionen · zweimal angewandt · authenticated ja, anon nein' };
    });
    fallS('SQL · als Admin: Foto-Beitrag, Arten-Vorschlag (aufnehmen UND ablehnen), Meldung → je eine Spur mit GENAU dem Namen aus GS_ADM_AKTIONEN', () => {
      const vorher = spuren();
      sql(url, `insert into public.species_images (id, species_id, url) values ('aaaaaaaa-0000-4000-8000-000000000001', 'sp-tomate', 'https://x/1.jpg')`);
      sql(url, `insert into public.species_proposals (id, name, latin, family, category, data) values ('bbbbbbbb-0000-4000-8000-000000000001', 'Testkraut', 'Testum kraut', 'Testaceae', 'kraeuter', '{"ai_summary":"x"}'::jsonb), ('bbbbbbbb-0000-4000-8000-000000000002', 'Nichtkraut', 'Nix nix', 'X', 'kraeuter', '{}'::jsonb)`);
      sql(url, `insert into public.user_reports (id, reporter_id, target_type, target_ref, reason) values ('cccccccc-0000-4000-8000-000000000001', '${ADMIN}', 'post', 'p-1', 'spam')`);
      sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_species_image('aaaaaaaa-0000-4000-8000-000000000001', true, true, 'gutes Foto');`);
      const j1 = sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_species_proposal('bbbbbbbb-0000-4000-8000-000000000001', true, null)::text;`);
      const j2 = sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_species_proposal('bbbbbbbb-0000-4000-8000-000000000002', false, 'zu vage')::text;`);
      const j3 = sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_report('cccccccc-0000-4000-8000-000000000001', 'reviewed', 'erledigt')::text;`);
      const klagen = [];
      if (!/"ok" ?: ?true/.test(j1) || !/"inserted" ?: ?true/.test(j1)) klagen.push('Vorschlag aufnehmen: ' + j1.slice(0, 80));
      if (!/"ok" ?: ?true/.test(j2) || !/"approved" ?: ?false/.test(j2)) klagen.push('Vorschlag ablehnen: ' + j2.slice(0, 80));
      if (!/"ok" ?: ?true/.test(j3)) klagen.push('Meldung: ' + j3.slice(0, 80));
      const rows = sql(url, `select action || '|' || coalesce(target_type,'') || '|' || coalesce(actor_id::text,'') || '|' || coalesce(diff->>'approve','') from public.audit_log order by id`).split('\n').filter(Boolean);
      if (spuren() - vorher !== 4) klagen.push((spuren() - vorher) + ' Spuren statt 4');
      const soll = [erwartet.species_image + '|species_image|' + ADMIN + '|true', erwartet.species_proposal + '|species_proposal|' + ADMIN + '|true', erwartet.species_proposal + '|species_proposal|' + ADMIN + '|false', erwartet.report_review + '|user_report|' + ADMIN + '|'];
      soll.forEach((z, i) => { if (rows[i] !== z) klagen.push('Zeile ' + (i + 1) + ': „' + (rows[i] || '') + '" statt „' + z + '"'); });
      const st = sql(url, `select status || '|' || coalesce(reviewed_by::text,'') from public.user_reports where id = 'cccccccc-0000-4000-8000-000000000001'`);
      if (st !== 'reviewed|' + ADMIN) klagen.push('user_reports nach der RPC: ' + st);
      const sp = sql(url, `select count(*) from public.species where slug = 'testum-kraut'`);
      if (sp !== '1') klagen.push('die aufgenommene Art fehlt in species (' + sp + ')');
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 3).join(' · ') };
      return { ok: true, info: '4 Spuren: ' + rows.map(r => r.split('|')[0]).join(', ') + ' · Meldung reviewed, Art in species' };
    });
    fallS('SQL · als Nicht-Admin: alle drei sagen Nein, und KEINE Spur entsteht', () => {
      const vorher = spuren();
      const nein = (q) => { try { sql(url, ALS(false, '22222222-2222-4222-8222-000000000002') + ' ' + q); return 'ging durch'; } catch (e) { return /admin only/.test(e.message) ? 'admin only' : e.message; } };
      const a = nein(`select public.fn_admin_review_species_image('aaaaaaaa-0000-4000-8000-000000000001', false, false, null);`);
      const b = nein(`select public.fn_admin_review_species_proposal('bbbbbbbb-0000-4000-8000-000000000002', true, null);`);
      const c = nein(`select public.fn_admin_review_report('cccccccc-0000-4000-8000-000000000001', 'dismissed', null);`);
      const klagen = [];
      [['Foto', a], ['Vorschlag', b], ['Meldung', c]].forEach(([n, x]) => { if (x !== 'admin only') klagen.push(n + ': ' + x); });
      if (spuren() !== vorher) klagen.push((spuren() - vorher) + ' Spur(en) trotz Nein');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'dreimal „admin only" · 0 Spuren' };
    });
    fallS('SQL · Meldung erledigen sagt Nein OHNE Spur bei falschem Status und unbekannter Id — und schreibt bei „open" den alten Status mit', () => {
      const vorher = spuren();
      const x = sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_report('cccccccc-0000-4000-8000-000000000001', 'kaputt', null)::text;`);
      const y = sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_report('cccccccc-0000-4000-8000-0000000000ff', 'reviewed', null)::text;`);
      const klagen = [];
      if (!/invalid_status/.test(x)) klagen.push('falscher Status: ' + x.slice(0, 60));
      if (!/not_found/.test(y)) klagen.push('unbekannte Id: ' + y.slice(0, 60));
      if (spuren() !== vorher) klagen.push((spuren() - vorher) + ' Spur(en) fuer ein Nein');
      sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_report('cccccccc-0000-4000-8000-000000000001', 'open', null);`);
      const d = sql(url, `select diff->>'old' || '→' || (diff->>'new') from public.audit_log where action = '${erwartet.report_review}' order by id desc limit 1`);
      if (d !== 'reviewed→open') klagen.push('alt→neu im diff: ' + d);
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'invalid_status · not_found · 0 Spuren · diff reviewed→open' };
    });
    fallS('Gegenprobe · ohne die INSERT-Zeilen der Migration entstehen keine Spuren (die Messung misst die Sache)', () => {
      const t = fs.readFileSync(MIGF, 'utf8');
      const ohne = t.replace(/insert into public\.audit_log[\s\S]*?;\s*\n/gi, '\n').replace(/INSERT INTO public\.audit_log[\s\S]*?;\s*\n/g, '\n');
      const n1 = (t.match(/audit_log/g) || []).length, n2 = (ohne.match(/audit_log/g) || []).length;
      if (n2 >= n1 - 2) return { ok: false, warum: 'die Gegenprobe hat nichts entfernt (' + n1 + ' → ' + n2 + ')' };
      const tmp = path.join(require('os').tmpdir(), 'gs_admin_check_ohne_spur.sql');
      fs.writeFileSync(tmp, ohne);
      sqlFile(url, tmp);
      const vorher = spuren();
      sql(url, ALS(true, ADMIN) + ` select public.fn_admin_review_species_image('aaaaaaaa-0000-4000-8000-000000000001', false, false, null); select public.fn_admin_review_report('cccccccc-0000-4000-8000-000000000001', 'dismissed', null);`);
      const nach = spuren();
      sqlFile(url, MIGF);   // den echten Stand wiederherstellen
      if (nach !== vorher) return { ok: false, warum: 'ohne INSERT trotzdem ' + (nach - vorher) + ' Spur(en) — die Messung sieht die Sache nicht' };
      return { ok: true, info: 'ohne INSERT: 0 Spuren fuer 2 Aktionen · echte Migration danach wieder eingespielt' };
    });
    try { sql(URL0, `drop database if exists ${DBN}`); } catch (_) {}
  }
  for (const f of S) {
    if (f.ok === true) console.log('  ok   ' + f.name + (f.info ? '   [' + f.info + ']' : ''));
    else if (f.ok === null) console.log('  ??   ' + f.name + '\n         → ' + f.warum);
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + f.warum); }
  }

  console.log('  ---');
  console.log('  Faelle geprueft: ' + (FAELLE.length + S.length) + ' · davon kaputt: ' + kaputt + (offen ? ' · nicht pruefbar: ' + offen + ' (SQL-Haelfte ohne lokales Postgres)' : ''));
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: der Server ist gestellt. Geprueft ist, was die App aus einer Antwort MACHT —');
  console.log('  nicht ob die RPC existiert (das sagt backend_check) und nicht ob RLS sie durchlaesst.');
  console.log('  Die SQL-Haelfte rechnet die Migration 20260925 in einem lokalen Postgres nach — ob sie LIVE angewandt ist, sagt nur Fernando.');
  await br.close();
  process.exitCode = (kaputt || errs.length) ? 1 : (offen ? 2 : 0);
})();

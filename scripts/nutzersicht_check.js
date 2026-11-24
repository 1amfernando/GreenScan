#!/usr/bin/env node
// nutzersicht_check.js — sagt die App, was stimmt, in der Sprache der Person?
//
//   node scripts/nutzersicht_check.js
//
// Anlass: docs/PROFESSIONALITAET-AUDIT-2026-09-06.md §E — Dinge, die kein
// anderer Pruefstand fragt, weil sie nicht kaputt AUSSEHEN: eine Zahl im
// Menue, die um das Neunfache daneben liegt (E3); ein Dialog, der die fetten
// Labels verschluckt (E4); Entwickler-Jargon auf Nutzerseiten (E5); Lina, die
// in jeder App-Sprache Deutsch antwortet und auf Tabs zeigt, die es nicht
// gibt (E2); ein Emoji, das der Screenreader vorliest, und zwei Ansichten,
// die sich widersprechen und trotzdem beide an sind (E8).
// Jeder Fall rendert wirklich oder liest den Quelltext, und jeder hat beide
// Richtungen: die richtige Zahl UND der Rueckfall, das Label UND der Text.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

let __seite = null;
const FAELLE = [
  {
    name: 'E3 · Menue-Zahlen kommen aus der Artenliste: fuenf Kategorien, jede gleich der Zaehlung; ohne Kategorie bleibt der feste Text',
    lauf: async () => __seite.evaluate(() => {
      const mit = MENU_ITEMS.filter(i => i.cat);
      if (mit.length !== 5) return { ok: false, warum: mit.length + ' Eintraege mit cat (erwartet 5)' };
      // v33.08: dieser Fall hat bis hierher den FEHLER erzwungen. Er zaehlte
      // `DB.filter(cat === …).length` — das sind EINTRAEGE — und verlangte das
      // Wort „Arten" daneben; bei den Pilzen also 636 statt 364. E9 verlangt
      // seit v33.04 das Gegenteil. Zwei Faelle im selben Pruefstand, mit
      // gegensaetzlichen Regeln, beide gruen.
      // Gezaehlt wird hier mit dem EIGENEN Massstab (v32.86): eine eigene
      // Entdopplung ueber `lat`, nicht ein Aufruf von gsArtenZahlen — sonst
      // prueft der Fall die Funktion mit sich selbst.
      const falsch = [];
      const _artenJeKat = (cat) => {
        const set = new Set();
        for (const sp of DB) {
          if (!sp || sp.cat !== cat || !sp.lat) continue;
          const k = _gsNormLat(sp.lat);
          if (k) set.add(k);
        }
        return set.size;
      };
      mit.forEach(i => {
        const arten = _artenJeKat(i.cat);
        const eintraege = DB.filter(s => s && s.cat === i.cat).length;
        const soll = arten.toLocaleString('de-CH') + ' Arten';
        if (_gsMenuSub(i) !== soll || arten < 30) {
          falsch.push(i.cat + ': „' + _gsMenuSub(i) + '" (gezaehlt ' + arten + ' Arten in ' + eintraege + ' Eintraegen)');
        }
      });
      if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
      const ohne = MENU_ITEMS.find(i => !i.cat && i.sub);
      if (_gsMenuSub(ohne) !== ohne.sub) return { ok: false, warum: 'ohne cat: ' + _gsMenuSub(ohne) + ' statt ' + ohne.sub };
      // gerendert: die Menue-Suche nach „Pilze" zeigt die gezaehlte Zahl
      const inp = document.getElementById('menu-search-input') || document.querySelector('#gs-menu-search, input[oninput*="enuSearch"]');
      let gerendert = null;
      try {
        const fn = Object.keys(window).map(k => window[k]).find(f => typeof f === 'function' && /scored = MENU_ITEMS\.map/.test(String(f)));
        if (fn) { fn('pilz'); const box = document.querySelector('.menu-search-result'); gerendert = box ? box.textContent : null; }
      } catch (_) {}
      const pilze = _artenJeKat('pilz').toLocaleString('de-CH');
      return { ok: true, info: mit.map(i => i.cat + ' ' + _gsMenuSub(i)).join(' · ') + (gerendert ? ' · gerendert: ' + (gerendert.indexOf(pilze) >= 0 ? 'Pilze ' + pilze + ' sichtbar' : 'ohne Zahl?') : '') };
    }),
  },
  {
    name: 'E4 · „Was ist neu" zeigt das fette Label UND den Text — in beiden Listen (Dialog und Ueber-Liste)',
    lauf: async () => __seite.evaluate(() => {
      const echt = window.GS_RELEASES;
      try {
        window.GS_RELEASES = [{ v: GS_VERSION, date: '07.09.2026', headline: 'Pruefstand', summary: 's', user_summary: 'u',
          user_items: [{ emoji: '🧪', bold: 'Fettes Label:', text: ' und der Text dahinter' }] }];
        const quellen = [];
        // 1) Dialog-Renderer: die Funktion, die itemsHtml aus release.user_items baut
        const fns = Object.keys(window).map(k => [k, window[k]]).filter(([, f]) => typeof f === 'function');
        const dlg = fns.find(([, f]) => /user_items/.test(String(f)) && /techToggleHtml|gs-wn-tech-toggle/.test(String(f)));
        // Erster Start stempelt nur und zeigt nichts — also eine AELTERE gesehene Version stellen, dann kommt der Dialog.
        if (dlg) { try { localStorage.setItem('gs_seen_version', 'v0.0'); dlg[1](); } catch (e) { quellen.push('Dialog wirft: ' + e.message); } }
        const el = Array.from(document.querySelectorAll('b')).find(b => b.textContent === 'Fettes Label:');
        const dialogOk = !!(el && el.parentNode && /Fettes Label:\s*und der Text dahinter/.test(el.parentNode.textContent));
        // 2) Ueber-Liste
        const ueber = fns.find(([, f]) => /rel-tech-/.test(String(f)) && /gsAutoUserItems/.test(String(f)));
        let listeOk = null;
        if (ueber) { try { ueber[1](); const b2 = Array.from(document.querySelectorAll('li b')).find(b => b.textContent === 'Fettes Label:'); listeOk = !!(b2 && /und der Text dahinter/.test(b2.parentNode.textContent)); } catch (e) { quellen.push('Liste wirft: ' + e.message); } }
        if (!dlg) return { ok: false, warum: 'Dialog-Renderer nicht gefunden' };
        if (!dialogOk) return { ok: false, warum: 'Dialog: Label nicht fett oder Text fehlt (' + (el ? el.parentNode.textContent.slice(0, 60) : 'kein <b>') + ') ' + quellen.join(' ') };
        if (listeOk === false) return { ok: false, warum: 'Ueber-Liste ohne fettes Label ' + quellen.join(' ') };
        return { ok: true, info: 'Dialog: <b>Fettes Label:</b> und der Text dahinter · Ueber-Liste: ' + (listeOk === null ? 'nicht gefunden' : 'ebenso') };
      } finally { window.GS_RELEASES = echt; try { document.querySelectorAll('#gs-whats-new-modal').forEach(e => e.remove()); localStorage.removeItem('gs_seen_version'); } catch (_) {} }
    }),
  },
  {
    // v33.00 — die Haelfte, die E4 fehlte. E4 ersetzt GS_RELEASES durch eine
    // EIGENE, korrekt geformte Attrappe und war deshalb gruen, waehrend die
    // ECHTEN Eintraege seit v32.86 kaputt waren: `user_items` als reine
    // Zeichenketten, und der Renderer liest `it.bold` — an einem String ist das
    // `String.prototype.bold`, eine Funktion und damit wahr. Auf dem Telefon
    // stand dreimal „function bold() { [native code] }".
    // Ein Fall, der nur eine Attrappe rendert, prueft die Vorlage, nicht die Ware.
    // v33.01 — der Fall las `gsAllReleases()` und sah damit nur die INLINE
    // vorhandenen Eintraege: das Archiv wird erst beim Oeffnen des Changelogs
    // nachgeladen, und im Pruefstand laedt es nie. Nach dem Umzug von 88
    // Eintraegen ins Archiv (v33.01) waeren das 13 statt 100 gewesen — die
    // Abdeckung waere still geschrumpft, ohne dass etwas rot wird. Das Archiv
    // wird deshalb von der PLATTE geholt und in die Seite gelegt; geprueft
    // werden ALLE Eintraege, nicht die ersten zwanzig.
    name: 'E4b · Die ECHTEN Release-Notizen rendern Text — kein [native code], keine leere Zeile (inline UND Archiv)',
    lauf: async () => {
      const archivQuelle = fs.readFileSync(path.resolve(__dirname, '..', 'data', 'releases.v1.js'), 'utf8');
      const r = await __seite.evaluate((quelle) => {
      const vorher = window.GS_RELEASES_ARCHIVE;
      let ausArchiv = 0;
      try { (0, eval)(quelle); ausArchiv = (window.GS_RELEASES_ARCHIVE || []).length; } catch (e) { return { ok: false, warum: 'Archiv nicht auswertbar: ' + e.message.split('\n')[0] }; }
      try {
      const alle = (typeof gsAllReleases === 'function') ? gsAllReleases() : (window.GS_RELEASES || []);
      if (!alle.length) return { ok: false, warum: 'keine Release-Eintraege — der Fall misst nichts' };
      if (!ausArchiv) return { ok: false, warum: 'das Archiv kam leer an — der Fall wuerde nur die Inline-Liste messen' };
      const pruefe = alle;
      const kaputt = [], leer = [], falschesEmoji = [];
      pruefe.forEach(rel => {
        const items = (typeof gsAutoUserItems === 'function') ? gsAutoUserItems(rel) : (rel.user_items || []);
        items.forEach((it, i) => {
          // Genau messen: der DEFEKT ist ein `bold`, das keine Zeichenkette ist
          // (dann greift der Renderer `String.prototype.bold` ab). Den Text nach
          // „[native code]" zu durchsuchen war zu grob — die Release-Notiz zu
          // v33.00 ZITIERT den Fehlertext und wurde prompt selbst gemeldet.
          const boldRoh = it && it.bold;
          const b = (typeof boldRoh === 'string') ? boldRoh : (boldRoh == null ? '' : '[' + typeof boldRoh + ']');
          const tx = (it && typeof it.text === 'string') ? it.text : '';
          if (boldRoh != null && typeof boldRoh !== 'string') kaputt.push(rel.v + '#' + (i + 1) + ' (bold ist ' + typeof boldRoh + ')');
          else if (!(b + tx).trim()) leer.push(rel.v + '#' + (i + 1));
          // v33.29: `\U0001f4da` ist KEIN JavaScript-Escape (JS kennt nur
          // \uXXXX und \u{...}) — die Zeichenkette wird zu „U0001f4da", und
          // genau das stand seit v33.27 in elf Eintraegen auf dem Bildschirm.
          // Der Fall rendert die echten Eintraege und hat es trotzdem nicht
          // gesehen, weil er nur `bold` und `text` ansah. Ein Emoji ist ein
          // Zeichen, kein Wort.
          const em = it && it.emoji;
          // Beide Formen: '\U0001f4da' wird in JS zu „U0001f4da" (JS kennt
          // kein \U), '\\U0001f4da' zu „\U0001f4da". Auf dem Bildschirm
          // steht in beiden Faellen ein Escape statt eines Bildes.
          if (typeof em === 'string' && /^\\?[Uu]\+?[0-9A-Fa-f]{4,8}/.test(em)) falschesEmoji.push(rel.v + '#' + (i + 1) + ' („' + em.slice(0, 14) + '")');
        });
      });
      if (kaputt.length) return { ok: false, warum: kaputt.length + ' Eintrag/Eintraege rendern [native code]: ' + kaputt.slice(0, 6).join(' ') };
      if (falschesEmoji.length) return { ok: false, warum: falschesEmoji.length + ' Eintrag/Eintraege zeigen einen Escape statt eines Emojis: ' + falschesEmoji.slice(0, 6).join(' ') };
      if (leer.length) return { ok: false, warum: leer.length + ' Eintrag/Eintraege ohne sichtbaren Text: ' + leer.slice(0, 6).join(' ') };
      const n = pruefe.reduce((a, r) => a + ((typeof gsAutoUserItems === 'function') ? gsAutoUserItems(r) : (r.user_items || [])).length, 0);
      return { ok: true, info: pruefe.length + ' echte Releases (' + (pruefe.length - ausArchiv) + ' inline + ' + ausArchiv + ' aus dem Archiv) · ' + n + ' Zeilen, alle mit Text' };
      } finally {
        // Die naechsten Faelle sollen denselben Zustand vorfinden wie ohne E4b.
        if (vorher === undefined) { try { delete window.GS_RELEASES_ARCHIVE; } catch (_) { window.GS_RELEASES_ARCHIVE = undefined; } }
        else window.GS_RELEASES_ARCHIVE = vorher;
      }
      }, archivQuelle);
      return r;
    },
  },
  {
    name: 'E2 · Lina: Sprache der App im Kontext (de/fr/it/en/es), keine Tabs, die es nicht gibt, die fuenf echten benannt',
    lauf: async () => __seite.evaluate(() => {
      const echt = gsI18n.getLang;
      try {
        const erw = { de: 'Deutsch', fr: 'Französisch', it: 'Italienisch', en: 'Englisch', es: 'Spanisch' };
        const falsch = [];
        Object.keys(erw).forEach(l => { gsI18n.getLang = () => l; const c = gsLinaContext(); if (c.indexOf('SPRACHE: Antworte auf ' + erw[l] + '.') < 0) falsch.push(l + ' → ' + (c.match(/SPRACHE: [^\n]*/) || ['fehlt'])[0]); });
        if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
        const p = LINA_SYSTEM;
        // v33.33: „Unter-Tab „Scans"" stand seit v30.62 im Prompt — der Pflanzen-Tab
        // hat genau zwei Unter-Tabs (Wohnung, Garten). Eine feste Phantom-Liste
        // faengt nur, was sie kennt; deshalb ZUSAETZLICH die Gegenrichtung: jeder
        // im Prompt genannte Unter-Tab muss als gsFavsSwitchSub-Wert existieren.
        const phantom = ['Tab „Garten"', 'Tab „Saison"', 'Tab „Suche"', 'Tab „Karte"', 'Tab „Marktplatz"', 'Tab „Einstellungen"', 'Unter-Tab', 'Tab „Scans"', 'antwortest auf Deutsch'].filter(t => p.indexOf(t) >= 0);
        if (phantom.length) return { ok: false, warum: 'noch im Prompt: ' + phantom.join(', ') };
        if (!/Scan-Verlauf[^\n]*„Mehr"/.test(p) && !/Scan-Historie[^\n]*„Mehr"/.test(p)) return { ok: false, warum: 'der Weg zum Scan-Verlauf nennt „Mehr" nicht (dort liegt er: #screen-more)' };
        const echte = ['Scanner', 'Pflanzen', 'Home', 'Community', 'Mehr'].filter(t => p.indexOf(t) < 0);
        if (echte.length) return { ok: false, warum: 'Tab-Leiste nicht genannt: ' + echte.join(', ') };
        if (!/„Mehr" → „Garten"/.test(p)) return { ok: false, warum: 'Weg zum Garten fehlt' };
        return { ok: true, info: '5 Sprachen im Kontext · 0 Phantom-Tabs · Leiste Scanner/Pflanzen/Home/Community/Mehr genannt · „Mehr" → „Garten"' };
      } finally { gsI18n.getLang = echt; }
    }),
  },
  {
    name: 'E5 · kein Entwickler-Jargon auf Nutzerseiten (Quelltext ohne Kommentare): Cowork pg_cron, Super-Agent aktiv, 24h-Lock, Supabase nicht verfuegbar, anfaellig fuer, gequeued',
    lauf: async () => {
      const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').split('\n');
      const off = fs.readFileSync(path.join(__dirname, '..', 'offline.html'), 'utf8').split('\n');
      const muster = [/Cowork pg_cron/, /Super-Agent (aktiv|mit)/, /24h-Lock/, /Supabase nicht verf[uü]gbar/, /anfaellig fuer/, /gequeued/];
      const treffer = [];
      // Kommentare zaehlen nicht (auch nicht am Zeilenende), und die Release-Notizen
      // (GS_RELEASES) sind Geschichte — dort steht der Jargon als Zitat dessen, was raus ist.
      const relStart = idx.findIndex(z => /^window\.GS_RELEASES = \[/.test(z));
      const relEnde = relStart >= 0 ? idx.findIndex((z, i) => i > relStart && /^\];/.test(z)) : -1;
      const ohneKommentar = (z) => z.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/, '').replace(/([^:'"])\/\/.*$/, '$1');
      const pruefe = (zeilen, datei) => zeilen.forEach((z, i) => {
        if (datei === 'index.html' && relStart >= 0 && i >= relStart && i <= relEnde) return;
        const t = ohneKommentar(z).trim(); if (!t || /^\*|^<!--/.test(t)) return;
        muster.forEach(m => { if (m.test(t)) treffer.push(datei + ':' + (i + 1) + ' ' + m.source); }); });
      pruefe(idx, 'index.html'); pruefe(off, 'offline.html');
      if (treffer.length) return { ok: false, warum: treffer.slice(0, 6).join(' · ') };
      return { ok: true, info: '6 Muster, 0 Treffer ausserhalb von Kommentaren' };
    },
  },
  {
    name: 'E6 · Rechtstexte sagen, was stimmt: Stand und Version aus der Release-Liste, Artenzahl aus der Artenliste, du statt Sie, Fotos gehen an Anthropic und liegen im Konto, keine Messung ohne Zustimmung, und das Impressum sagt, was noch fehlt',
    lauf: async () => __seite.evaluate(async () => {
      const f = [];
      try { openLegalModal('agb'); } catch (e) { return { ok: false, warum: 'openLegalModal wirft: ' + e.message }; }
      const lies = (tab) => { showLegalTab(tab); const el = document.getElementById('legal-content'); return el ? el.textContent : ''; };
      const agb = lies('agb'), ds = lies('datenschutz'), haft = lies('haftung'), imp = lies('impressum');
      const alle = agb + ds + haft + imp;
      const datum = (window.GS_RELEASES && GS_RELEASES[0] && GS_RELEASES[0].date) || '';
      if (/März 2026/.test(alle)) f.push('„März 2026" steht noch fest im Text');
      if (!datum || (agb.indexOf('Stand ' + datum) < 0) || (ds.indexOf('Stand ' + datum) < 0)) f.push('Stand nicht aus der Release-Liste (' + datum + ')');
      if (imp.indexOf(GS_VERSION) < 0 || imp.indexOf(datum) < 0) f.push('Impressum ohne Version/Datum');
      // v33.04: neben der Zahl steht „Schweizer Arten" — also die ARTEN-Zahl
      // (gsArtenZahlen), nicht DB.length; das sind die Eintraege.
      const _az = (typeof gsArtenZahlen === 'function') ? gsArtenZahlen() : { arten: 0 };
      const arten = _az.arten ? _az.arten.toLocaleString(gsLocale()) : '?';
      if (imp.indexOf(arten + ' Schweizer Arten') < 0) f.push('Artenzahl nicht aus der Liste (' + arten + ')');
      if (/\bSie\b|\bIhre\b|\bIhnen\b/.test(haft + ds)) f.push('Rechtstexte siezen noch: ' + ((haft + ds).match(/[^.]*\b(Sie|Ihre|Ihnen)\b[^.]*/) || [''])[0].trim().slice(0, 60));
      if (/nicht dauerhaft gespeichert/.test(ds)) f.push('Fotos-Satz behauptet noch „nicht dauerhaft gespeichert"');
      if (!/Anthropic/.test(ds) || !/in deinem Konto gespeichert/.test(ds)) f.push('Fotos-Satz nennt nicht KI-Dienst und Speicherung');
      // v33.11: bis hierher verlangte die Zeile „nichts gemessen" — die Wahrheit,
      // solange es keinen Schalter gab. Jetzt gibt es ihn; der Satz muss sagen,
      // WO er ist und dass die Vorgabe aus ist — und darf nicht mehr behaupten,
      // einen Dialog gebe es nicht. Reparatur und Pruefung brauchen dieselbe
      // Regel (v32.16, v33.08 E3).
      if (!/nur mit deiner Zustimmung/.test(ds) || !/Datenschutz/.test(ds) || !/Vorgabe aus/.test(ds)) f.push('Nutzungsdaten-Satz nennt Schalter oder Vorgabe nicht');
      if (/gibt es derzeit nicht/.test(ds)) f.push('Nutzungsdaten-Satz behauptet noch, es gebe keinen Zustimmungsdialog');
      if (/E-Mail \(verschlüsselt\)/.test(ds)) f.push('„E-Mail (verschlüsselt)" steht noch da');
      if (!/Rechtsträger, Postadresse und UID-Nummer/.test(imp)) f.push('Impressum sagt nicht, was fehlt');
      try { closeModal('modal-rechtlich'); } catch (_) {}
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Stand ' + datum + ' (' + GS_VERSION + ') · ' + arten + ' Arten · du statt Sie · Fotos: Anthropic + Konto · Messung: nur mit Zustimmung · Impressum nennt die Lücke' };
    }),
  },
  {
    name: 'E8 · Kompakt und Senioren schliessen sich aus (in beide Richtungen, Vorgabe und Haekchen ziehen mit); Menue-Emojis sind fuer den Screenreader stumm',
    lauf: async () => __seite.evaluate(async () => {
      const echtSave = window.savePrefs, echtNach = window._gsPrefNachschieben; window.savePrefs = () => {}; window._gsPrefNachschieben = () => {};
      try {
        applyCompact(true); applySenior(true);
        const a = { compact: document.body.classList.contains('compact'), senior: document.body.classList.contains('senior'), pc: !!userPrefs.compact, ps: !!userPrefs.senior, tc: document.getElementById('toggle-compact').checked, ts: document.getElementById('toggle-senior').checked };
        applyCompact(true);
        const b = { compact: document.body.classList.contains('compact'), senior: document.body.classList.contains('senior'), pc: !!userPrefs.compact, ps: !!userPrefs.senior };
        applyCompact(false); applySenior(false);
        if (a.compact || !a.senior || a.pc || !a.ps || a.tc || !a.ts) return { ok: false, warum: 'Senioren an → Kompakt bleibt: ' + JSON.stringify(a) };
        if (!b.compact || b.senior || !b.pc || b.ps) return { ok: false, warum: 'Kompakt an → Senioren bleibt: ' + JSON.stringify(b) };
        const fn = Object.keys(window).map(k => window[k]).find(f => typeof f === 'function' && /scored = MENU_ITEMS\.map/.test(String(f)));
        let emoji = null;
        if (fn) { fn('pilz'); const spans = Array.from(document.querySelectorAll('.menu-search-result > span')); emoji = { n: spans.length, stumm: spans.filter(s => s.getAttribute('aria-hidden') === 'true').length }; }
        if (emoji && emoji.n && emoji.stumm !== emoji.n) return { ok: false, warum: 'Menue-Emojis ohne aria-hidden: ' + JSON.stringify(emoji) };
        return { ok: true, info: 'Senioren an → Kompakt aus (Klasse, Vorgabe, Haekchen) · Kompakt an → Senioren aus' + (emoji ? ' · Emojis ' + emoji.stumm + '/' + emoji.n + ' stumm' : '') };
      } finally { window.savePrefs = echtSave; window._gsPrefNachschieben = echtNach; }
    }),
  },
  {
    // v33.04 — „Art" heisst Art. Die Artenliste hat 4'337 EINTRAEGE und
    // 3'136 verschiedene Arten: jede Zeile traegt EINEN deutschen Namen, 660
    // Arten haben mehr als eine. Der Baerlauch steht viermal drin.
    //
    // Die App schrieb `DB.length` LIVE neben das Wort „Arten" — an fuenf
    // Stellen (Splash, Statistik-Kachel, Einstellungen, Ueber-Dialog,
    // Rechtstexte) — und in siebzehn festen Texten stand dazu noch die alte
    // 4342. Eine getippte Zahl hat keinen Ausloeser; dieser Fall ist er.
    //
    // Gerechnet wird hier SELBST (eigener Massstab, v32.86): der Fall ruft
    // NICHT gsArtenZahlen(), sonst waere er ein Echo der Sache, die er prueft.
    name: 'E9 · Zahl und Wort passen zusammen: wo „Arten" steht, steht die Artenzahl (3\'136) — wo die Zahl der Einträge steht (4\'337), heisst es auch so',
    lauf: async () => {
      const fs = require('fs'), path = require('path');
      const wurzel = path.resolve(__dirname, '..');
      const idx = fs.readFileSync(path.join(wurzel, 'index.html'), 'utf8');

      // _gsNormLat woertlich aus der App holen und die Liste selbst zaehlen
      const a = idx.indexOf('function _gsNormLat');
      if (a < 0) return { ok: false, warum: '_gsNormLat nicht gefunden — der Fall kann nichts rechnen' };
      const b = idx.indexOf('\n}', a);
      let normLat;
      try { normLat = eval('(' + idx.slice(a, b + 2).replace(/^function _gsNormLat/, 'function') + ')'); }
      catch (e) { return { ok: false, warum: '_gsNormLat nicht auswertbar: ' + e.message.split('\n')[0] }; }

      const sandkasten = { window: {} }; sandkasten.window.window = sandkasten.window;
      try {
        const quelle = fs.readFileSync(path.join(wurzel, 'data', 'plants.v1.js'), 'utf8');
        new Function('window', quelle)(sandkasten.window);
      } catch (e) { return { ok: false, warum: 'Artenliste nicht ladbar: ' + e.message.split('\n')[0] }; }
      const roh = sandkasten.window.DB || [];
      if (!roh.length) return { ok: false, warum: 'Artenliste leer — der Fall misst nichts' };

      // dieselbe Entdopplung wie deduplicateDB: doppelte id, dann doppelte name+lat
      const gid = new Set(), gnl = new Set(), liste = [];
      for (const s of roh) {
        if (!s || !s.name) continue;
        if (s.id != null) { if (gid.has(s.id)) continue; gid.add(s.id); }
        const nl = String(s.name).toLowerCase().trim() + '|' + String(s.lat || '').toLowerCase().trim();
        if (gnl.has(nl)) continue;
        gnl.add(nl); liste.push(s);
      }
      const artenSet = new Set();
      for (const s of liste) { const k = s.lat ? normLat(s.lat) : ''; if (k) artenSet.add(k); }
      const EINTRAEGE = liste.length, ARTEN = artenSet.size;
      if (!ARTEN || ARTEN >= EINTRAEGE) return { ok: false, warum: 'Zaehlung unplausibel: ' + ARTEN + ' Arten / ' + EINTRAEGE + ' Eintraege' };

      // ── 1 · feste Texte in den ausgelieferten Dateien ────────────────────
      // Der GS_RELEASES-Block bleibt aussen vor: dort stehen historische
      // Messungen, und die werden nicht nachtraeglich umgeschrieben.
      const relA = idx.indexOf('window.GS_RELEASES = ['), relB = relA < 0 ? -1 : idx.indexOf('\n];', relA);
      const dateien = [
        ['index.html', (relA >= 0 && relB > relA) ? idx.slice(0, relA) + idx.slice(relB) : idx],
        ['install.html', fs.readFileSync(path.join(wurzel, 'install.html'), 'utf8')],
        ['manifest.json', fs.readFileSync(path.join(wurzel, 'manifest.json'), 'utf8')],
      ];
      // Zwei Fallen, beide beim ersten Lauf zugeschlagen:
      // (1) Im QUELLTEXT stehen Escapes, keine Zeichen — `3\u2019136` und
      //     `3\'100`. Wer daraus die Ziffern zieht, liest 2019136 bzw. 100.
      // (2) „100 Arten-Details angesehen" ist eine AUSZEICHNUNG, keine Aussage
      //     ueber die Groesse der Liste. Solche Stellen bleiben aussen vor;
      //     erkannt am Bindestrich oder an einem Verb dahinter.
      // (3) Und die BEUGUNG: `Eintraege\\b` traf „Eintraegen" NICHT — die
      //     Dativform stand in der Seitenbeschreibung und wurde nie geprueft.
      //     Gefunden hat es die Gegenprobe, nicht der Lauf.
      const entEscapen = (t) => t
        .replace(/\\u2019/g, '’').replace(/\\u00a0/gi, ' ')
        .replace(/\\'/g, "'").replace(/\\"/g, '"');
      const muster = /(über|ueber)?\s*(\d[\d'’.]{2,})\s*(?:<\/span>\s*)?(?:Schweizer\s+)?(Arten|Einträgen?|Eintraegen?)\b\s*(-|angesehen|gescannt|gesammelt|bestimmt|entdeckt)?/g;
      const falsch = [];
      for (const [name, roher] of dateien) {
        const text = entEscapen(roher.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*|<!--)/.test(z)).join('\n'));
        let m;
        muster.lastIndex = 0;
        while ((m = muster.exec(text)) !== null) {
          if (m[4]) continue;                     // Auszeichnung/Kompositum, keine Listen-Aussage
          const gerundet = !!m[1];
          const zahl = parseInt(String(m[2]).replace(/[^\d]/g, ''), 10);
          const wort = /Arten/.test(m[3]) ? 'Arten' : 'Einträge';
          const soll = wort === 'Arten' ? ARTEN : EINTRAEGE;
          if (gerundet) {
            // „über N" darf runden — aber nur nach UNTEN und nicht beliebig weit
            if (!(zahl <= soll && zahl >= soll * 0.9)) falsch.push(name + ': „über ' + m[2] + ' ' + wort + '" (echt ' + soll + ')');
          } else if (zahl !== soll) {
            falsch.push(name + ': „' + m[2] + ' ' + wort + '" (echt ' + soll + ')');
          }
        }
      }
      if (falsch.length) return { ok: false, warum: falsch.length + ' feste Stelle(n) mit falscher Zahl oder falschem Wort: ' + falsch.slice(0, 5).join(' · ') };

      // ── 2 · die LIVE gerechneten Anzeigen ────────────────────────────────
      const live = await __seite.evaluate(async () => {
        const holen = (id) => { const el = document.getElementById(id); return el ? el.textContent.replace(/[^\d]/g, '') : null; };
        try { if (typeof gsUpdateStats === 'function') gsUpdateStats(); } catch (_) {}
        try { if (typeof loadSettings === 'function') loadSettings(); } catch (_) {}
        // Die Startkachel zaehlt hoch (gsAnimateCounter, 1,4 s, ab dem Aufbau der Startseite) und
        // ueberschreibt dabei auch, was gsUpdateStats gerade gesetzt hat. Lief E9 allein — also
        // frueh —, las er 3'129 … 3'134 statt 3'136: eine Zwischenzahl der Animation, kein Fehler.
        // Gelesen wird, wenn die Zahl zweimal hintereinander gleich ist (hoechstens 5 s).
        for (let i = 0, vorher = null; i < 20; i++) {
          const jetzt = holen('stat-total');
          if (jetzt && jetzt === vorher) break;
          vorher = jetzt;
          await new Promise(r => setTimeout(r, 250));
        }
        return {
          splash: holen('splash-count'),
          statTotal: holen('stat-total'),
          settings: holen('settings-arten-count'),
          dbTotal: holen('settings-db-total'),
          modalAbout: holen('modal-about-arten'),
          eintraege: holen('about-eintraege-count'),
          dbLen: (window.DB && DB.length) || 0,
        };
      });
      const lebend = [];
      for (const [id, wert] of [['splash-count', live.splash], ['stat-total', live.statTotal],
                                ['settings-arten-count', live.settings], ['settings-db-total', live.dbTotal],
                                ['modal-about-arten', live.modalAbout]]) {
        if (wert == null || wert === '') continue;          // nicht gerendert — kein Befund
        if (parseInt(wert, 10) !== ARTEN) lebend.push(id + ' zeigt ' + wert + ' neben „Arten" (echt ' + ARTEN + (parseInt(wert, 10) === EINTRAEGE ? ', das sind die Einträge' : '') + ')');
      }
      if (lebend.length) return { ok: false, warum: lebend.join(' · ') };
      if (live.dbLen !== EINTRAEGE) return { ok: false, warum: 'DB.length in der Seite ist ' + live.dbLen + ', gezaehlt wurden ' + EINTRAEGE + ' — der Fall misst eine andere Liste' };

      // ── 3 · Aufschluesselung „Was in der Artendatenbank steckt" + Suchkopf ──
      // Beide standen bis v33.08 mit Eintragszahlen unter dem Wort „Arten":
      // die Total-Zeile sagte „4'337 Arten", zwei Bildschirme tiefer stand
      // „3'136 Arten" — auf DEMSELBEN Tab.
      const block = await __seite.evaluate(() => {
        const o = {};
        try { switchTab('more'); } catch (_) {}
        const box = document.getElementById('more-db-cats');
        o.text = box ? box.textContent.replace(/\s+/g, ' ').trim() : '';
        // eigene Zaehlung je Kategorie, ohne gsArtenZahlen zu fragen
        const je = {};
        for (const sp of (window.DB || [])) {
          if (!sp || !sp.cat) continue;
          const e = je[sp.cat] || (je[sp.cat] = { eintraege: 0, set: new Set() });
          e.eintraege++;
          const k = sp.lat ? _gsNormLat(sp.lat) : '';
          if (k) e.set.add(k);
        }
        o.je = Object.keys(je).map(c => [c, je[c].set.size, je[c].eintraege]);
        try { switchTab('search'); if (typeof renderList === 'function') renderList(); } catch (_) {}
        const st = document.getElementById('search-status');
        o.suchkopf = st ? st.textContent.trim() : '';
        return o;
      });
      const blockKlagen = [];
      if (!block.text) blockKlagen.push('Aufschluesselung #more-db-cats leer — der Fall misst nichts');
      else {
        // Jede Zeile muss „<Arten> Arten · <Eintraege> Einträge" tragen
        const paare = [...block.text.matchAll(/([\d'’.]+)\s*Arten\s*·\s*([\d'’.]+)\s*Einträge/g)]
          .map(m => [parseInt(m[1].replace(/[^\d]/g, ''), 10), parseInt(m[2].replace(/[^\d]/g, ''), 10)]);
        if (paare.length < 5) blockKlagen.push('nur ' + paare.length + ' Zeilen der Form „N Arten · M Einträge" — vorher stand dort die Eintragszahl unter „Arten"');
        const echt = new Set(block.je.map(([, a, e]) => a + '|' + e));
        echt.add(ARTEN + '|' + EINTRAEGE);                       // die Total-Zeile
        const fremd = paare.filter(([a, e]) => !echt.has(a + '|' + e));
        if (fremd.length) blockKlagen.push('Zeile(n) mit einer Zahl, die zu keiner Kategorie passt: ' + fremd.map(x => x.join('/')).join(' · '));
        if (!paare.some(([a, e]) => a === ARTEN && e === EINTRAEGE)) blockKlagen.push('Total-Zeile nennt nicht ' + ARTEN + ' Arten · ' + EINTRAEGE + ' Einträge');
      }
      if (/Arten/.test(block.suchkopf) && !/Einträge/.test(block.suchkopf)) {
        blockKlagen.push('Suchkopf sagt „' + block.suchkopf + '" — die Liste zeigt Einträge, jede Zeile ist einer');
      }
      if (blockKlagen.length) return { ok: false, warum: blockKlagen.join(' · ') };

      // ── 4 · Wissen-Tab: Kopf-Chip und Lexikon-Kacheln (Home 3 / Brett 4d79) ──
      // Bis zum 19.11.2026 zaehlte der Wissen-Tab mit eigenen Regeln: „4'337 Arten" (DB.length) im
      // Kopf und auf der Kachel, „Essbar" 1'130 neben 1'062 auf der Startseite und im Filter (die
      // ungeprueften Eintraege zaehlten mit), „Giftig" 598 neben 675 im Filter (die Eintraege der
      // Stufe 1 mit `toxic` fehlten). Die Zahl steht nicht als Literal im Quelltext, also sah Teil 1
      // sie nie, und Teil 2 kannte die Elemente nicht. Gemessen wird wie eine Person: das Lexikon
      // ueber seinen Knopf oeffnen, die Kachel lesen, sie ANTIPPEN und die Trefferzahl der Liste
      // lesen, die sich oeffnet — eine Zahl auf einer Kachel ist ein Versprechen ueber diese Liste.
      const wissen = await __seite.evaluate(async () => {
        const warte = (ms) => new Promise((r) => setTimeout(r, ms));
        const ziffern = (t) => { const z = String(t || '').replace(/[^\d]/g, ''); return z ? parseInt(z, 10) : null; };
        const o = { kacheln: [] };
        try { switchTab('wissen'); } catch (e) { o.fehler = 'switchTab(wissen): ' + e.message; return o; }
        await warte(300);
        const hero = document.getElementById('wissen-hero');
        o.chip = (hero ? [...hero.querySelectorAll('span')].map(s => s.textContent.trim()).find(t => /Arten/.test(t) && /\d/.test(t)) : null) || null;
        const WORT = /^(Arten|Essbar|Giftig|Heilkraft)$/i;
        const lexikon = async () => {
          try { switchTab('wissen'); } catch (_) {}
          const knopf = [...document.querySelectorAll('#wissen-nav .recipe-cat')].find(b => /Lexikon/.test(b.textContent));
          if (!knopf) return [];
          knopf.click(); await warte(300);
          const box = document.getElementById('wissen-content');
          return box ? [...box.querySelectorAll('div')].filter(d => d.children.length === 2 && WORT.test((d.lastElementChild.textContent || '').trim())) : [];
        };
        const anzahl = (await lexikon()).length;
        for (let i = 0; i < anzahl; i++) {
          const k = (await lexikon())[i];
          if (!k) break;
          const e = { wort: k.lastElementChild.textContent.trim().toLowerCase(), zahl: ziffern(k.firstElementChild.textContent) };
          k.click(); await warte(400);
          const aktiv = document.querySelector('.screen.active');
          const st = document.getElementById('search-status');
          e.bildschirm = aktiv ? aktiv.id : null;
          e.status = st ? st.textContent.trim() : '';
          o.kacheln.push(e);
        }
        try { if (typeof gsUpdateStats === 'function') gsUpdateStats(); } catch (_) {}
        o.homeEssbar = ziffern((document.getElementById('stat-edible') || {}).textContent);
        try { gsSucheMitFilter(''); } catch (_) {}            // keinen Filter fuer die naechsten Faelle stehen lassen
        return o;
      });
      const wKlagen = [];
      if (wissen.fehler) wKlagen.push(wissen.fehler);
      const chipZahl = wissen.chip ? parseInt(wissen.chip.replace(/[^\d]/g, ''), 10) : null;
      if (chipZahl == null) wKlagen.push('Kopf des Wissen-Tabs: kein Chip „N Arten" — der Fall misst dort nichts');
      else if (chipZahl !== ARTEN) wKlagen.push('Kopf des Wissen-Tabs zeigt „' + wissen.chip + '" (echt ' + ARTEN + ' Arten' + (chipZahl === EINTRAEGE ? ', das sind die Einträge' : '') + ')');
      const kachel = {};
      for (const k of wissen.kacheln) kachel[k.wort] = k;
      for (const w of ['arten', 'essbar', 'giftig', 'heilkraft']) {
        const k = kachel[w];
        if (!k) { wKlagen.push('Lexikon: keine Kachel „' + w + '" gefunden'); continue; }
        if (k.bildschirm !== 'screen-search') { wKlagen.push('Kachel „' + w + '" öffnet keine Liste (danach: ' + k.bildschirm + ')'); continue; }
        if (w === 'arten') {
          if (k.zahl !== ARTEN) wKlagen.push('Kachel „Arten" zeigt ' + k.zahl + ' (echt ' + ARTEN + (k.zahl === EINTRAEGE ? ', das sind die Einträge' : '') + ')');
          continue;
        }
        const m = /^([\d'’.]+)\s/.exec(k.status);           // „1062 Treffer · ✅ Essbar"
        const treffer = m ? parseInt(m[1].replace(/[^\d]/g, ''), 10) : null;
        if (treffer == null) wKlagen.push('Kachel „' + w + '": Statuszeile danach „' + k.status + '" ohne Trefferzahl');
        else if (treffer !== k.zahl) wKlagen.push('Kachel „' + w + '" sagt ' + k.zahl + ', die Liste, die sie öffnet, hat ' + treffer);
      }
      if (kachel.essbar && wissen.homeEssbar != null && kachel.essbar.zahl !== wissen.homeEssbar) {
        wKlagen.push('„Essbar": Lexikon ' + kachel.essbar.zahl + ', Startseite ' + wissen.homeEssbar);
      }
      if (wKlagen.length) return { ok: false, warum: wKlagen.join(' · ') };

      const gemessen = [live.splash, live.statTotal, live.settings, live.dbTotal, live.modalAbout].filter(x => x != null && x !== '').length;
      if (!gemessen) return { ok: false, warum: 'keine einzige Live-Anzeige gerendert — der Fall misst nichts' };
      return { ok: true, info: ARTEN + ' Arten / ' + EINTRAEGE + ' Einträge selbst gezählt · ' + gemessen + ' Live-Anzeigen stimmen · Aufschlüsselung und Suchkopf benannt · Wissen-Tab: Kopf und vier Kacheln = die Listen, die sie öffnen · feste Texte in index.html, install.html und manifest.json geprüft' };
    },
  },
  {
    name: 'E10 · „Hast du Pflanzen?" wird ueberall gleich beantwortet — auch bei jemandem, der nur ein Beet hat',
    lauf: async () => __seite.evaluate(() => {
      // Seit v32.47 tragen Garten-Pflanzungen dieselben Aufgaben wie
      // ps_myplants, und gsGetDueTasks rechnet ueber BEIDE Listen. Drei
      // Anzeigen benutzten myPlants.length als TOR — und sagten „Noch keine
      // Pflanze", waehrend die Zeile darueber die Aufgaben genau dieser
      // Pflanzen zeigte. Der Fall stellt beide Richtungen her: nur
      // Pflanzungen (dann darf kein Leerzustand kommen) und WIRKLICH nichts
      // (dann MUSS er kommen — sonst waere eine Anzeige, die immer
      // „du hast Pflanzen" sagt, ebenfalls gruen).
      // gsRenderGardenOverview faellt auf den localStorage zurueck, wenn die
      // Variable leer ist — der Zustand muss deshalb an BEIDEN Orten stehen.
      // Ohne das blieb die Gegenrichtung an den drei Seed-Pflanzen haengen und
      // meldete „Leerzustand fehlt", obwohl die Reparatur stimmte.
      const mp0 = window.myPlants, pl0 = window.plantings, gd0 = window.gardens;
      const sp0 = localStorage.getItem('ps_myplants'), sl0 = localStorage.getItem('gs_plantings'), sg0 = localStorage.getItem('gs_gardens');
      const setzen = (mp, pl, gd) => {
        window.myPlants = mp; window.plantings = pl; window.gardens = gd;
        try {
          localStorage.setItem('ps_myplants', JSON.stringify(mp));
          localStorage.setItem('gs_plantings', JSON.stringify(pl));
          localStorage.setItem('gs_gardens', JSON.stringify(gd));
        } catch (_) {}
      };
      const D = 864e5, jetzt = Date.now();
      const lesen = () => {
        try { switchTab('home'); } catch (_) {}
        try { gsRenderDayPlan(); } catch (_) {}
        try { gsUpdateHomeGreeting(); } catch (_) {}
        try { gsRenderGardenOverview(); } catch (_) {}
        // v33.07: die Startkachel gehoert zur selben Frage — sie ist mit
        // „Pflanzen" beschriftet und fuehrt per Tipp auf „Meine Pflanzen".
        // updatePlantStat setzt sie ohne Animation (gsAnimateCounter laeuft
        // 1400 ms; wer waehrenddessen misst, misst einen Zwischenstand).
        try { if (typeof updatePlantStat === 'function') updatePlantStat(); } catch (_) {}
        const t = (id) => { const el = document.getElementById(id); return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; };
        return { plan: t('home-dayplan'), titel: t('home-hero-title'), garten: t('garden-overview'),
                 kachel: t('stat-favs'),
                 faellig: (typeof gsGetDueTasks === 'function') ? gsGetDueTasks().length : -1 };
      };
      try {
        // Richtung 1 — nur ein Beet, keine eigene Pflanze
        setzen([], [
          { id:'nx1', gardenId:'nx-g', name:'Karotte', emoji:'🥕', date:new Date(jetzt-30*D).toISOString(),
            tasks:{ water:{ active:true, intervalDays:2, lastDone:new Date(jetzt-9*D).toISOString() } } },
          { id:'nx2', gardenId:'nx-g', name:'Radieschen', emoji:'🌱', date:new Date(jetzt-20*D).toISOString(),
            tasks:{ water:{ active:true, intervalDays:3, lastDone:new Date(jetzt-3*D).toISOString() } } }
        ], [{ id: 'nx-g', name: 'Hochbeet', kind: 'hochbeet', type: 'hochbeet', size_m2: 6 }]);
        const beet = lesen();
        if (beet.faellig < 1) return { ok: false, warum: 'Fall nicht hergestellt: gsGetDueTasks liefert ' + beet.faellig + ' — ohne faellige Aufgabe misst der Rest nichts' };
        const klagen = [];
        if (/Noch keine Pflanze/.test(beet.plan)) klagen.push('Tagesplan sagt „Noch keine Pflanze", waehrend ' + beet.faellig + ' Aufgabe(n) dieser Pflanzen anstehen');
        if (!/Dein Garten/.test(beet.titel)) klagen.push('Ueberschrift: „' + beet.titel + '" statt „Dein Garten"');
        if (/Erste Pflanze anlegen/.test(beet.garten)) klagen.push('Garten-Uebersicht sagt „Erste Pflanze anlegen" — im Beet stehen zwei Pflanzungen');
        if (beet.kachel !== '2') klagen.push('Startkachel „Pflanzen" zeigt „' + beet.kachel + '" statt 2 — sie fuehrt auf „Meine Pflanzen", wo 2 stehen');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };

        // Richtung 1b — dasselbe Beet, aber NICHTS faellig. Das Tor der
        // Garten-Uebersicht sitzt hinter „keine Schritte"; solange Aufgaben
        // anstehen, ist es unerreichbar — Richtung 1 allein wuerde eine
        // Ruecknahme genau dort nicht bemerken.
        setzen([], pl0 === undefined ? [] : [
          { id:'nx3', gardenId:'nx-g', name:'Karotte', emoji:'🥕', date:new Date(jetzt-30*D).toISOString(),
            tasks:{ water:{ active:true, intervalDays:60, lastDone:new Date(jetzt).toISOString() } } }
        ], [{ id: 'nx-g', name: 'Hochbeet', kind: 'hochbeet', type: 'hochbeet', size_m2: 6 }]);
        const ruhe = lesen();
        if (ruhe.faellig !== 0) return { ok: false, warum: 'Fall 1b nicht hergestellt: ' + ruhe.faellig + ' Aufgaben faellig, erwartet 0' };
        const klagen2 = [];
        if (/Erste Pflanze anlegen/.test(ruhe.garten)) klagen2.push('Garten-Uebersicht sagt „Erste Pflanze anlegen", obwohl eine Pflanzung im Beet steht');
        if (/Noch keine Pflanze/.test(ruhe.plan)) klagen2.push('Tagesplan sagt „Noch keine Pflanze" statt „Alles versorgt"');
        if (klagen2.length) return { ok: false, warum: 'ohne faellige Aufgabe: ' + klagen2.join(' · ') };

        // Richtung 2 — wirklich nichts: der Leerzustand MUSS kommen
        setzen([], [], []);
        const leer = lesen();
        const fehlt = [];
        if (!/Noch keine Pflanze/.test(leer.plan)) fehlt.push('Tagesplan zeigt den Leerzustand nicht mehr: „' + leer.plan.slice(0, 70) + '"');
        if (/Dein Garten/.test(leer.titel)) fehlt.push('Ueberschrift sagt „Dein Garten" ohne eine einzige Pflanze');
        if (!/Erste Pflanze anlegen/.test(leer.garten)) fehlt.push('Garten-Uebersicht zeigt den Leerzustand nicht mehr');
        if (leer.kachel !== '0') fehlt.push('Startkachel zeigt „' + leer.kachel + '" ohne eine einzige Pflanze');
        if (fehlt.length) return { ok: false, warum: 'Gegenrichtung: ' + fehlt.join(' · ') };

        const n = (typeof gsPflanzenZahl === 'function') ? 'gsPflanzenZahl vorhanden' : 'KEINE gsPflanzenZahl — jede Stelle zaehlt selbst';
        if (typeof gsPflanzenZahl !== 'function') return { ok: false, warum: n };
        return { ok: true, info: 'nur Beet: ' + beet.faellig + ' Aufgaben, Kachel ' + beet.kachel + ', Titel „' + beet.titel + '" · Beet ohne faellige Aufgabe: kein „Erste Pflanze anlegen" · wirklich leer: alle drei Leerzustaende da' };
      } finally {
        window.myPlants = mp0; window.plantings = pl0; window.gardens = gd0;
        try {
          if (sp0 == null) localStorage.removeItem('ps_myplants'); else localStorage.setItem('ps_myplants', sp0);
          if (sl0 == null) localStorage.removeItem('gs_plantings'); else localStorage.setItem('gs_plantings', sl0);
          if (sg0 == null) localStorage.removeItem('gs_gardens'); else localStorage.setItem('gs_gardens', sg0);
        } catch (_) {}
        try { gsRenderDayPlan(); gsUpdateHomeGreeting(); } catch (_) {}
      }
    }),
  },
  {
    // v33.71. „erinnere mich …" beantwortete der Sprachmodus mit „Ich habe deinen
    // Wunsch gespeichert … Schau im Tagebuch oder Mein-Garten-Tab nach für die
    // Erinnerung." Gespeichert wurde NICHTS: der einzige Schreiber war
    // `gsBrain.observe`, und gsBrain gibt es seit v28.75 nicht mehr.
    // versprechen_check sieht so etwas nicht — er sucht eine Meldung neben
    // einem sbFetch, und hier gab es gar keinen Schreibvorgang.
    name: 'E17 · Der Sprachmodus verspricht nichts, was er nicht tut: wer „Ich habe … gespeichert" sagt, hat danach etwas gespeichert',
    lauf: async () => __seite.evaluate(async () => {
      if (typeof gsVoiceProcess !== 'function') return { ok: false, warum: 'gsVoiceProcess fehlt' };
      const bild = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return JSON.stringify(o); };
      const echtAI = window.callAI; let kiRufe = 0;
      window.callAI = async function () { kiRufe++; return 'KI-Antwort'; };
      try {
        const saetze = ['Erinnere mich morgen ans Giessen', 'erinner mich bitte am Samstag an die Tomaten', 'Kannst du mich an den Rückschnitt erinnern?'];
        const klagen = []; const antworten = [];
        for (const satz of saetze) {
          const vor = bild();
          const a = String(await gsVoiceProcess(satz) || '');
          const nach = bild();
          antworten.push(a);
          const verspricht = /\b(?:habe|hab)\b[^.!?]*\b(?:gespeichert|eingetragen|notiert|angelegt|vorgemerkt|gemerkt)\b/i.test(a);
          if (verspricht && vor === nach) klagen.push('„' + satz + '" → „' + a.slice(0, 70) + '…" — und im Speicher hat sich NICHTS geändert');
          if (!a.trim()) klagen.push('„' + satz + '" → keine Antwort');
        }
        if (klagen.length) return { ok: false, warum: klagen[0] + (klagen.length > 1 ? ' (+' + (klagen.length - 1) + ' weitere)' : '') };
        // Gegenrichtung: die Antwort muss sagen, WO es geht — Schweigen waere auch „kein Versprechen".
        if (!/Lina/.test(antworten[0])) return { ok: false, warum: 'die Antwort nennt keinen Weg, auf dem es geht: „' + antworten[0].slice(0, 90) + '"' };
        if (kiRufe) return { ok: false, warum: 'für „erinnere mich" wurde die KI gerufen (' + kiRufe + '×) — das kostet Kontingent für eine Antwort, die feststeht' };
        return { ok: true, info: saetze.length + ' Sätze · keine Zusage ohne Speichern · die Antwort nennt Lina · 0 KI-Aufrufe' };
      } finally { window.callAI = echtAI; }
    }),
  },
  {
    // v33.71. Die Kalibrierung des Lichtmessers las `gsUserPosition` — einen
    // Namen, den es nie gab. Mit gespeichertem Standort stand dort „Aktiviere
    // GPS für astronomische Referenz-Kalibrierung"; die Referenz selbst ist
    // kein einziges Mal erschienen.
    name: 'E18 · Die Lichtmesser-Kalibrierung sagt, was stimmt: mit Standort steht die astronomische Referenz da, ohne Standort heisst es „ohne Standort" — nie „Aktiviere GPS", wenn es an ist',
    lauf: async () => __seite.evaluate(async () => {
      if (typeof gsLuxCalibrate !== 'function' || typeof gsSunLuxEstimate !== 'function') return { ok: false, warum: 'gsLuxCalibrate/gsSunLuxEstimate fehlt' };
      const val = document.getElementById('lux-value'), box = document.getElementById('lux-calib-sun');
      if (!val || !box) return { ok: false, warum: '#lux-value oder #lux-calib-sun fehlt' };
      const ort0 = localStorage.getItem('gs_user_location'), val0 = val.textContent, echtSonne = window.gsSunLuxEstimate;
      // Der Sonnenstand haengt an der Uhr; nachts gibt es zu Recht keine Referenz.
      // Gestellt wird der Zeitpunkt der RECHNUNG (21. Juni, 12:30 Ortszeit) — nicht die Uhr der Seite.
      window.gsSunLuxEstimate = function (lat, lng) { return echtSonne(lat, lng, new Date('2026-06-21T10:30:00Z')); };
      const zu = () => { try { closeModal('modal-lux-calib'); } catch (_) {} const m = document.getElementById('modal-lux-calib'); if (m) { m.classList.remove('open', 'active'); } };
      try {
        val.textContent = '1200';
        localStorage.setItem('gs_user_location', JSON.stringify({ lat: 47.3769, lng: 8.5417, lon: 8.5417, name: 'Zürich' }));
        gsLuxCalibrate();
        const mit = box.textContent.replace(/\s+/g, ' ').trim(), mitSichtbar = box.style.display !== 'none';
        zu();
        localStorage.removeItem('gs_user_location');
        gsLuxCalibrate();
        const ohne = box.textContent.replace(/\s+/g, ' ').trim();
        zu();
        const klagen = [];
        // Die Referenz erkennt man an ihrer ZAHL — das Wort „astronomische Referenz" steht auch im Hinweis ohne Standort.
        const hatReferenz = (t) => /Lux/.test(t) && /Sonnenhöhe/.test(t);
        if (!mitSichtbar || !hatReferenz(mit)) klagen.push('mit Standort steht keine Referenz da: „' + mit.slice(0, 80) + '"');
        const lux = parseInt((mit.match(/([\d'’.,\s]+)\s*Lux/) || ['', ''])[1].replace(/[^\d]/g, ''), 10);
        if (hatReferenz(mit) && !(lux >= 30000 && lux <= 120000)) klagen.push('Referenz für Zürich am 21. Juni mittags: ' + lux + ' Lux (erwartet 30\'000–120\'000)');
        if (/Aktiviere GPS/i.test(mit)) klagen.push('mit gespeichertem Standort steht „Aktiviere GPS" da');
        if (hatReferenz(ohne)) klagen.push('OHNE Standort steht eine Referenz da — woher?');
        if (!/Standort/i.test(ohne)) klagen.push('ohne Standort fehlt der Satz, der das sagt: „' + ohne.slice(0, 80) + '"');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'mit Standort: Referenz ' + lux.toLocaleString('de-CH') + ' Lux (Zürich, 21. Juni mittags) · ohne Standort: „' + ohne.slice(0, 44) + '…"' };
      } finally {
        window.gsSunLuxEstimate = echtSonne; val.textContent = val0;
        if (ort0 == null) localStorage.removeItem('gs_user_location'); else localStorage.setItem('gs_user_location', ort0);
        zu();
      }
    }),
  },
  {
    name: 'E12 · Saatgut-Inventar: der Knopf zum Erfassen spricht Deutsch („+ Hinzufügen"), sein Text geht durch die Sprachschicht, er steht unter den Feldern statt daneben — und im Fenster steht kein englisches „Add"',
    lauf: async () => __seite.evaluate(async () => {
      // GARTEN, 11.11.2026: der Knopf hiess „+ Add" — der einzige englische in einer deutschen
      // Oberflaeche, fest verdrahtet (keine Sprache bekam je eine Uebersetzung). Zwei Richtungen:
      // Deutsch steht da, UND ein Sprachpaket kommt an (ein fest verdrahtetes „+ Hinzufügen"
      // waere sonst ebenfalls gruen). Und der Platz: mit dem deutschen Wort in der alten
      // Dreier-Zeile blieben dem Datumsfeld bei 360 px Breite 64 px.
      const alt = localStorage.getItem('gs_seed_inventory');
      const tAlt = window.gsI18n && gsI18n.t;
      const knopfVon = () => document.querySelector('#gs-nl-body button[onclick="gsSeedAdd()"]');
      try {
        localStorage.setItem('gs_seed_inventory', JSON.stringify([{ name: 'Tomate Ochsenherz', qty: '20 Stk', expires: null, ts: 1 }]));
        gsOpenSeedInventory();
        await new Promise(r => setTimeout(r, 450));
        const body = document.getElementById('gs-nl-body'), knopf = knopfVon();
        if (!body || !knopf) return { ok: false, warum: 'das Saatgut-Fenster zeigt keinen Knopf mit gsSeedAdd()' };
        const klagen = [], de = (knopf.textContent || '').trim();
        if (de !== '+ Hinzufügen') klagen.push('der Knopf sagt „' + de + '" statt „+ Hinzufügen"');
        // je Bedienelement gelesen — im Fliesstext des Fensters klebt der Knopftext ohne Abstand an der Liste
        const eng = Array.from(body.querySelectorAll('button, input')).map(x => ((x.textContent || '') + ' ' + (x.getAttribute('placeholder') || '')).trim()).filter(t => /\bAdd\b/.test(t));
        if (eng.length) klagen.push('im Fenster steht das englische „Add": „' + eng.join('", „') + '"');
        // Platz: der Knopf steht UNTER den zwei Feldern, und die teilen sich die Zeile
        const k = knopf.getBoundingClientRect(), q = document.getElementById('gs-s-qty').getBoundingClientRect(), d = document.getElementById('gs-s-exp').getBoundingClientRect();
        if (!(k.width > 0 && d.width > 0)) klagen.push('Knopf oder Datumsfeld nicht sichtbar (' + Math.round(k.width) + ' / ' + Math.round(d.width) + ' px) — der Fall misst nichts');
        if (k.top < d.bottom - 1) klagen.push('der Knopf steht NEBEN den Feldern (Knopf ' + Math.round(k.width) + ' px, Datumsfeld ' + Math.round(d.width) + ' px) — ein längeres Wort drückt das Datum zusammen');
        // die Sprachschicht: mit Paket die Uebersetzung
        let fr = '';
        if (typeof tAlt !== 'function') klagen.push('gsI18n.t ist nicht erreichbar');
        else {
          gsI18n.t = function (key, fb) { return key === 'seed_add_btn' ? 'PRUEFSTAND-FR' : tAlt.apply(gsI18n, arguments); };
          gsOpenSeedInventory();
          fr = ((knopfVon() || {}).textContent || '').trim();
          if (fr !== 'PRUEFSTAND-FR') klagen.push('mit Sprachpaket zeigt der Knopf „' + fr + '" — sein Text geht nicht durch die Sprachschicht (Schlüssel seed_add_btn)');
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'deutsch „' + de + '" · mit Sprachpaket „' + fr + '" · Knopf ' + Math.round(k.width) + ' px unter den Feldern (Menge ' + Math.round(q.width) + ' px · Datum ' + Math.round(d.width) + ' px) · kein „Add" im Fenster' };
      } finally {
        if (typeof tAlt === 'function') gsI18n.t = tAlt;
        if (alt == null) localStorage.removeItem('gs_seed_inventory'); else localStorage.setItem('gs_seed_inventory', alt);
        try { closeModal('gs-nl-modal'); } catch (_) {}
      }
    }),
  },
  {
    // v33.71. „Zu meinen Pflanzen" las `EMOJI_BY_CAT` — eine Tabelle, die es nie
    // gab. Jede aus einem Scan uebernommene Pflanze ohne eigenes Symbol bekam
    // 🌿, auch ein Pilz. Die Scan-Karte daneben zeigte laengst 🍄 (eigene Tabelle).
    name: 'E19 · Eine aus dem Scan übernommene Pflanze trägt das Symbol ihrer Kategorie — dasselbe wie die Scan-Karte; ein eigenes Symbol bleibt, eine unbekannte Kategorie ergibt 🌿',
    lauf: async () => __seite.evaluate(async () => {
      if (typeof gsAddScanToMyPlants !== 'function') return { ok: false, warum: 'gsAddScanToMyPlants fehlt' };
      const mp0 = JSON.stringify(myPlants), roh0 = localStorage.getItem('ps_myplants');
      const r0 = (typeof _lastScanResult !== 'undefined') ? _lastScanResult : null;
      const t0 = (typeof _lastScanThumb !== 'undefined') ? _lastScanThumb : null;
      const echtTab = window.switchTab; window.switchTab = function () {};
      // Die Uebernahme fragt zuerst „Wohnung oder Garten?" und WARTET auf einen
      // Tipp — ohne diese Antwort haengt der Fall (so geschehen beim ersten Lauf).
      const echtOrt = window.gsPickScanLocation; window.gsPickScanLocation = async function () { return 'indoor'; };
      const faelle = [
        [{ name: 'Fliegenpilz Prüfstand', latin: 'Amanita muscaria pruefstand', category: 'pilz', confidence: 91 }, '🍄'],
        [{ name: 'Rotbuche Prüfstand', latin: 'Fagus sylvatica pruefstand', category: 'Baum', confidence: 88 }, '🌳'],
        [{ name: 'Eigene Prüfstand', latin: 'Rosa pruefstand', category: 'wildpflanze', emoji: '🌺', confidence: 80 }, '🌺'],
        [{ name: 'Unbekannte Prüfstand', latin: 'Ignota pruefstand', category: 'qqq', confidence: 70 }, '🌿'],
      ];
      const klagen = []; const gesehen = [];
      try {
        for (const [r, soll] of faelle) {
          _lastScanResult = r; try { _lastScanThumb = ''; } catch (_) {}
          const vorher = myPlants.length;
          await gsAddScanToMyPlants();
          const neu = myPlants.length > vorher ? myPlants[myPlants.length - 1] : null;
          if (!neu) { klagen.push('„' + r.name + '" wurde nicht übernommen — der Fall misst nichts'); continue; }
          gesehen.push(neu.emoji);
          if (neu.emoji !== soll) klagen.push(r.category + (r.emoji ? ' (eigenes ' + r.emoji + ')' : '') + ' → ' + neu.emoji + ' statt ' + soll);
        }
        await new Promise(res => setTimeout(res, 450));   // der Tab-Wechsel nach 350 ms — abgefangen, aber abwarten
        // dieselbe Tabelle wie die Scan-Karte
        if (typeof _gsScanKatEmoji !== 'function') klagen.push('_gsScanKatEmoji fehlt — Karte und Übernahme haben wieder zwei Tabellen');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'pilz → 🍄 · Baum → 🌳 · eigenes Symbol bleibt · unbekannt → 🌿 (' + gesehen.join(' ') + ')' };
      } finally {
        window.switchTab = echtTab; window.gsPickScanLocation = echtOrt;
        try { myPlants = JSON.parse(mp0); } catch (_) {}
        if (roh0 == null) localStorage.removeItem('ps_myplants'); else localStorage.setItem('ps_myplants', roh0);
        try { _lastScanResult = r0; _lastScanThumb = t0; } catch (_) {}
        try { if (typeof renderMyPlants === 'function') renderMyPlants(); } catch (_) {}
      }
    }),
  },  {
    name: 'E20 · Ein Rezept zeigt seine Warnung, ein Heilmittel seine Gegenanzeigen und seine Dosierung — und die Schwierigkeit steht als Etikett da, nicht als rohes Wort',
    lauf: async () => __seite.evaluate(async () => {
      // v33.71 (Audit „Datenform"). Gemessen wird der TEXT des geoeffneten Fensters
      // gegen die Daten des Rezepts — nicht eine neue Funktion. Gegen den Stand
      // davor: die Warnung eines Rezepts fehlte (die Bedingung hiess isRemedy),
      // Gegenanzeigen und Dosierung hatte keine Anzeige, und auf den Karten stand
      // „einfach" statt „🟢 Einfach".
      const warte = (ms) => new Promise((res) => setTimeout(res, ms));
      const alle = recipesData.concat(remediesData);
      const rez = recipesData.find((r) => r.type !== 'remedies' && r.warning && /verwechs|giftig|t(ö|oe)dlich/i.test(r.warning));
      const heil = remediesData.find((r) => r.contraindications && r.dosage);
      const ohne = recipesData.find((r) => r.type !== 'remedies' && !r.warning && !r.contraindications && !r.dosage);
      if (!rez || !heil || !ohne) return { ok: false, warum: 'die Daten tragen den Fall nicht: Rezept mit Warnung ' + !!rez + ' · Heilmittel mit Gegenanzeigen und Dosierung ' + !!heil + ' · Rezept ohne Warnung ' + !!ohne };
      const kern = (t) => String(t).replace(/^[^A-Za-zÄÖÜäöü]+/, '').replace(/\s+/g, ' ').slice(0, 45);
      const lies = async (id) => {
        openRecipeDetail(id); await warte(300);
        const el = document.getElementById('recipe-detail-body');
        return { text: (el.textContent || '').replace(/\s+/g, ' '), bloecke: [...el.querySelectorAll('[style*="--bg-danger-soft"]')].length };
      };
      const f = [];
      try {
        const a = await lies(rez.id);
        if (a.text.indexOf(kern(rez.warning)) < 0) f.push('Rezept „' + rez.title + '": die Warnung „' + kern(rez.warning) + '…" steht nicht im Fenster');
        const b = await lies(heil.id);
        if (b.text.indexOf(kern(heil.contraindications)) < 0) f.push('Heilmittel „' + heil.title + '": die Gegenanzeigen „' + kern(heil.contraindications) + '…" stehen nicht im Fenster');
        if (b.text.indexOf(kern(heil.dosage)) < 0) f.push('Heilmittel „' + heil.title + '": die Dosierung „' + kern(heil.dosage) + '…" steht nicht im Fenster');
        const c = await lies(ohne.id);
        if (c.bloecke) f.push('Gegenrichtung: „' + ohne.title + '" hat keine Warnung, zeigt aber ' + c.bloecke + ' rote Kästen');
        // Schwierigkeit: jede eingebaute Angabe hat ein Etikett, und die Karte zeigt es
        const stufen = {}; alle.forEach((r) => { const d = r.diff || r.difficulty; if (d) stufen[d] = (stufen[d] || 0) + 1; });
        const mit = alle.find((r) => (r.diff || r.difficulty) === 'einfach') || alle.find((r) => r.diff || r.difficulty);
        const karte = document.createElement('div'); karte.innerHTML = buildRecipeCard(mit);
        const kt = (karte.textContent || '').replace(/\s+/g, ' ');
        const roh = Object.keys(stufen).filter((d) => new RegExp('(^|[^A-Za-zÄÖÜäöü])' + d + '([^A-Za-zäöü]|$)').test(kt));
        if (roh.length) f.push('die Karte „' + mit.title + '" zeigt die Schwierigkeit als rohes Wort „' + roh[0] + '" (in den Daten: ' + Object.keys(stufen).map((d) => d + ' ' + stufen[d]).join(', ') + ')');
        if (!/[🟢🟡🔴]/u.test(kt)) f.push('die Karte „' + mit.title + '" trägt kein Schwierigkeits-Etikett');
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: '„' + rez.title + '" zeigt seine Warnung · „' + heil.title + '" Gegenanzeigen und Dosierung · „' + ohne.title + '" keinen roten Kasten · ' + Object.keys(stufen).length + ' Schwierigkeits-Werte, alle mit Etikett' };
      } finally { try { closeModal('modal-recipe-detail'); } catch (_) {} await warte(250); }
    }),
  },
  {
    name: 'E21 · Der Filter „Giftig" zeigt jede Art ab Giftstufe 2 — und „Ungiftig" nur Stufe 0; gefragt wird die ART, nicht der Eintrag',
    lauf: async () => __seite.evaluate(async () => {
      // v33.71 (Audit „Datenform"). `toxic` und `tox` sind zwei Felder fuer dieselbe
      // Frage; bei acht Eintraegen der Stufe 2 stand `toxic:false` — sie fehlten in
      // BEIDEN Filtern. Massstab ist hier die Stufe, nicht das Feld, das der Filter liest.
      const alt = currentFilter;
      try {
        if (!Array.isArray(DB) || DB.length < 3000) return { ok: false, warum: 'die Artenliste ist nicht geladen (' + (DB && DB.length) + ')' };
        currentFilter = 'giftig';
        const fehltGiftig = DB.filter((sp) => (sp.tox | 0) >= 2 && !_gsPassCat(sp));
        const nGiftig = DB.filter((sp) => _gsPassCat(sp)).length;
        currentFilter = 'ungiftig';
        const falschUngiftig = DB.filter((sp) => _gsPassCat(sp) && (sp.tox | 0) > 0);
        const nUngiftig = DB.filter((sp) => _gsPassCat(sp)).length;
        // Und die ART entscheidet: „Wacholder" (T018) traegt selbst Stufe 0, dieselbe Art
        // (Juniperus communis) fuehrt die Liste dreimal mit Stufe 2. Massstab hier: die
        // Eintraege mit genau demselben Binomen — nicht die Funktion, die der Filter ruft.
        const binomen = (sp) => String(sp.lat || '').toLowerCase().trim();
        const w = DB.find((sp) => sp.id === 'T018');
        const wGeschwister = w ? DB.filter((sp) => binomen(sp) === binomen(w) && (sp.tox | 0) >= 2).length : 0;
        currentFilter = 'giftig'; const wGiftig = w ? _gsPassCat(w) : null;
        currentFilter = 'ungiftig'; const wUngiftig = w ? _gsPassCat(w) : null;
        const f = [];
        if (!w || wGeschwister < 1 || (w.tox | 0) !== 0) f.push('die Probe stimmt nicht mehr: T018 ' + (w ? 'Stufe ' + w.tox + ', ' + wGeschwister + ' Geschwister ab Stufe 2' : 'fehlt') + ' — der Fall stellt seinen Zustand nicht her');
        else if (!wGiftig || wUngiftig) f.push('„Wacholder" (T018, Stufe 0; ' + wGeschwister + ' Einträge derselben Art ab Stufe 2) steht ' + (wUngiftig ? 'unter „Ungiftig"' : 'nicht unter „Giftig"') + ' — der Filter fragt den Eintrag, nicht die Art');
        if (fehltGiftig.length) f.push(fehltGiftig.length + ' Einträge der Giftstufe ≥ 2 fehlen unter „Giftig": ' + fehltGiftig.slice(0, 5).map((sp) => sp.name + ' (Stufe ' + sp.tox + ')').join(', '));
        if (falschUngiftig.length) f.push(falschUngiftig.length + ' Einträge mit Giftstufe > 0 stehen unter „Ungiftig": ' + falschUngiftig.slice(0, 3).map((sp) => sp.name).join(', '));
        if (nGiftig < 300 || nUngiftig < 1000) f.push('die Filter liefern ' + nGiftig + ' / ' + nUngiftig + ' Einträge — der Fall misst offenbar etwas anderes');
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: '„Giftig" ' + nGiftig + ' Einträge, darunter jeder ab Stufe 2 · „Ungiftig" ' + nUngiftig + ', alle Stufe 0 · in keinem der beiden: ' + (DB.length - nGiftig - nUngiftig) + ' · „Wacholder" (T018, Stufe 0) nach seiner Art unter „Giftig"' };
      } finally { currentFilter = alt; }
    }),
  },
  {
    // v33.60 · gemessen am 11.11.2026 (Befund IDEE-B, vom Head nachgefahren): die Menue-Suche
    // (51 Eintraege) fand zu „Notfall", „145", „Tox", „Vergiftung" NICHTS, und „gegessen" fuehrte
    // zu den Rezepten. Die Nummern standen nur dort, wo ein Scan oder ein Chat sie ausloest.
    // Zwei Richtungen: wer eines der Notfall-Woerter tippt, findet den Eintrag ZUERST — und wer
    // „Tomate" oder „essbar" tippt, bekommt ihn NICHT (ein Eintrag, der immer oben steht, ist einer,
    // den man zu ueberlesen lernt, v32.98). Dazu das Fenster: genau die vier Nummern, die die App
    // schon nennt bzw. Tox Info Suisse selbst angibt — und kein Rat, was man tun soll.
    name: 'E15 · Notfall: die Menü-Suche findet „Notfall", „145", „Tox", „Vergiftung", „gegessen" (auch fr/it/en/es) ZUERST — „Tomate" und „essbar" nicht; das Fenster ruft 145, die Auslandnummer, 144 und 112 an und gibt keinen Erste-Hilfe-Rat',
    lauf: async () => __seite.evaluate(async () => {
      const klagen = [];
      const res = () => Array.from(document.querySelectorAll('#menu-search-results .menu-search-result'));
      const erster = (q) => { searchMenu(q); const r = res(); return r.length ? (r[0].textContent || '').replace(/\s+/g, ' ').trim() : ''; };
      const alle = (q) => { searchMenu(q); return res().map(r => (r.textContent || '').replace(/\s+/g, ' ').trim()); };
      try {
        if (typeof searchMenu !== 'function') return { ok: false, warum: 'searchMenu fehlt' };
        // (a) die Notfall-Woerter, in vier Sprachen
        // …und drei SAETZE: die trifft kein Suchwort, sondern das eine Notfall-Vokabular (_gsNotfallStufe).
        // Ohne sie blieb die Gegenprobe „eigene Trefferregel ausgebaut" gruen — die gewoehnliche
        // Punktzahl stellte den Eintrag bei allen 17 Einzelwoertern zufaellig auch nach vorn.
        const ja = ['notfall', 'Notfall', '145', 'tox', 'tox info', 'vergiftung', 'vergiftet', 'gift', 'gegessen', 'verschluckt', 'giftnotruf', 'urgence', 'empoisonnement', 'emergenza', 'avvelenamento', 'emergency', 'poison',
          'mein kind hat beeren gegessen', 'hund hat pilz gefressen', 'mon enfant a mangé des baies',
          // v33.60 (brett:2026-11-11-df0b): Spanisch ist die fuenfte App-Sprache — das Menue kennt ihre Woerter
          'emergencia', 'envenenamiento', 'veneno', 'intoxicación', 'intoxicacion'];
        const fehlt = ja.filter(q => !/Notfall/.test(erster(q)));
        if (fehlt.length) klagen.push(fehlt.length + ' von ' + ja.length + ' Notfall-Wörtern führen nicht zuerst zum Notfall: ' + fehlt.slice(0, 8).map(q => '„' + q + '" → „' + (erster(q).slice(0, 28) || 'nichts') + '"').join(' · '));
        // (b) die Gegenrichtung
        // schwache Teiltreffer zaehlen dazu: „giftig" enthaelt „gift", und ein einzelner Buchstabe steckt in jedem Suchwort
        const nein = ['tomate', 'essbar', 'rezept', 'giessen', 'kalender', 'pilz', 'giftig', 'giftige pflanzen', 'a', 'ei'];
        const zuviel = nein.filter(q => alle(q).some(t => /Notfall/.test(t)));
        if (zuviel.length) klagen.push('der Notfall-Eintrag erscheint auch bei: ' + zuviel.join(', '));
        // (c) der echte Treffer wird angetippt
        searchMenu('notfall');
        const tr = res()[0];
        if (!tr) klagen.push('kein Treffer zum Antippen');
        else {
          tr.click();
          await new Promise(r => setTimeout(r, 400));
          const m = document.getElementById('gs-nl-modal'), body = document.getElementById('gs-nl-body');
          const offen = !!(m && (m.classList.contains('open') || m.classList.contains('active')) && body && (body.textContent || '').trim().length > 20);
          if (!offen) klagen.push('der Treffer wurde angetippt, und es steht kein Notfall-Fenster da');
          else {
            const tel = Array.from(body.querySelectorAll('a[href^="tel:"]')).map(a => a.getAttribute('href'));
            ['tel:145', 'tel:+41442515151', 'tel:144', 'tel:112'].forEach(t => { if (tel.indexOf(t) < 0) klagen.push('im Fenster fehlt der Anruf-Link ' + t + ' (da: ' + tel.join(', ') + ')'); });
            if (tel.length !== 4) klagen.push(tel.length + ' Anruf-Links statt 4: ' + tel.join(', '));
            const txt = (body.textContent || '').replace(/\s+/g, ' ');
            if (!/Tox Info Suisse/.test(txt)) klagen.push('das Fenster nennt Tox Info Suisse nicht');
            if (!/toxinfo\.ch/.test(txt) || !/\d{2}\.\d{2}\.\d{4}/.test(txt)) klagen.push('das Fenster nennt weder Quelle noch Prüfdatum der Nummern');
            // kein Rat, was zu tun ist — das sagt die Fachperson am Telefon
            const rat = txt.match(/erbrechen|Milch|Kohle|trinken lassen|Wasser geben|hinlegen|Seitenlage/i);
            if (rat) klagen.push('das Fenster gibt einen Erste-Hilfe-Rat („' + rat[0] + '") — dafür gibt es hier keine Quelle');
            // jeder Link ist ein Antippziel (mindestens 44 px hoch)
            const klein = Array.from(body.querySelectorAll('a[href^="tel:"]')).filter(a => { const r = a.getBoundingClientRect(); return r.height < 44 && a.getAttribute('href') !== 'tel:+41442515151'; });
            if (klein.length) klagen.push(klein.length + ' Anruf-Knöpfe sind niedriger als 44 px');
            const ausland = body.querySelector('a[href="tel:+41442515151"]');
            if (ausland) { const r = ausland.getBoundingClientRect(); if (r.height < 24 || r.width < 24) klagen.push('die Auslandnummer ist als Antippziel kleiner als 24 px (' + Math.round(r.width) + '×' + Math.round(r.height) + ')'); }
          }
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: ja.length + ' Notfall-Eingaben (de/fr/it/en, drei davon ganze Sätze) → Notfall zuerst · ' + nein.length + ' Alltags-Eingaben ohne ihn · Fenster: 145 · +41 44 251 51 51 · 144 · 112, mit Quelle und Datum, ohne Rat' };
      } finally {
        try { clearMenuSearch(); } catch (_) {}
        try { closeModal('gs-nl-modal'); } catch (_) {}
        try { closeMainMenu(); } catch (_) {}
      }
    }),
  },
  {
    // v33.60 · der Menue-Eintrag „Premium freischalten" versprach „TWINT · Karte · IBAN". Welche
    // Zahlungsarten im Checkout erscheinen, entscheidet seit v33.60 das Stripe-Dashboard (keine feste
    // Zahlungsart im Aufruf) — die App kann es nicht wissen. Ob TWINT im Abo-Checkout erscheint, ist
    // nicht gemessen (docs/FUER-FERNANDO.md §30). Eine Zusage, die niemand pruefen kann, steht nicht da.
    name: 'E16 · „Premium freischalten" verspricht keine Zahlungsart, die die App nicht kennen kann — und wer „twint" sucht, findet den Eintrag trotzdem',
    lauf: async () => __seite.evaluate(async () => {
      try {
        searchMenu('premium');
        const tr = Array.from(document.querySelectorAll('#menu-search-results .menu-search-result')).find(r => /Premium/.test(r.textContent || ''));
        if (!tr) return { ok: false, warum: 'die Suche nach „premium" findet den Eintrag nicht' };
        const txt = (tr.textContent || '').replace(/\s+/g, ' ').trim();
        const zusage = txt.match(/TWINT|IBAN|SEPA|Karte|Kreditkarte|PayPal|Rechnung/i);
        if (zusage) return { ok: false, warum: 'der Eintrag verspricht eine Zahlungsart: „' + txt + '"' };
        searchMenu('twint');
        const tw = Array.from(document.querySelectorAll('#menu-search-results .menu-search-result')).some(r => /Premium/.test(r.textContent || ''));
        if (!tw) return { ok: false, warum: 'wer „twint" sucht, findet „Premium freischalten" nicht mehr' };
        return { ok: true, info: '„' + txt + '" · „twint" führt weiter zum Eintrag' };
      } finally { try { clearMenuSearch(); } catch (_) {} }
    }),
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { document.documentElement.classList.remove('gs-preauth'); window.gsRequire = () => true; window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {}; });
  console.log('\n=== nutzersicht_check — sagt die App, was stimmt, in der Sprache der Person?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: ob ein Text VERSTAENDLICH ist, misst niemand — geprueft ist, was sich zaehlen laesst.');
  process.exitCode = kaputt ? 1 : 0;
})();

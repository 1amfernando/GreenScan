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
      const falsch = [];
      mit.forEach(i => {
        const n = DB.filter(s => s && s.cat === i.cat).length;
        const soll = n.toLocaleString('de-CH') + ' Arten';
        if (_gsMenuSub(i) !== soll || n < 50) falsch.push(i.cat + ': ' + _gsMenuSub(i) + ' (gezaehlt ' + n + ')');
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
      const pilze = DB.filter(s => s && s.cat === 'pilz').length.toLocaleString('de-CH');
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
      const kaputt = [], leer = [];
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
        });
      });
      if (kaputt.length) return { ok: false, warum: kaputt.length + ' Eintrag/Eintraege rendern [native code]: ' + kaputt.slice(0, 6).join(' ') };
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
        const phantom = ['Tab „Garten"', 'Tab „Saison"', 'Tab „Suche"', 'Tab „Karte"', 'Tab „Marktplatz"', 'Tab „Einstellungen"', 'antwortest auf Deutsch'].filter(t => p.indexOf(t) >= 0);
        if (phantom.length) return { ok: false, warum: 'noch im Prompt: ' + phantom.join(', ') };
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
      if (!/nur mit deiner Zustimmung/.test(ds) || !/nichts gemessen/.test(ds)) f.push('Nutzungsdaten-Satz sagt nicht, dass nichts gemessen wird');
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
      const live = await __seite.evaluate(() => {
        const holen = (id) => { const el = document.getElementById(id); return el ? el.textContent.replace(/[^\d]/g, '') : null; };
        try { if (typeof gsUpdateStats === 'function') gsUpdateStats(); } catch (_) {}
        try { if (typeof loadSettings === 'function') loadSettings(); } catch (_) {}
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

      const gemessen = [live.splash, live.statTotal, live.settings, live.dbTotal, live.modalAbout].filter(x => x != null && x !== '').length;
      if (!gemessen) return { ok: false, warum: 'keine einzige Live-Anzeige gerendert — der Fall misst nichts' };
      return { ok: true, info: ARTEN + ' Arten / ' + EINTRAEGE + ' Einträge selbst gezählt · ' + gemessen + ' Live-Anzeigen stimmen · feste Texte in index.html, install.html und manifest.json geprüft' };
    },
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

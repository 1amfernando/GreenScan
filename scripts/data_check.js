#!/usr/bin/env node
/**
 * data_check.js — liest der Code Felder, die es in den Daten gar nicht gibt?
 *
 * Warum das existiert: in v31.78 stellte sich heraus, dass der Bluehkalender
 * seit jeher `s.bloom` abfragte — ein Feld, das in KEINER der 4'342 Arten
 * vorkommt. Der Reiter „Wild" war dadurch dauerhaft leer, und der Zaehler
 * daneben meldete brav `0`, als waere das ein Ergebnis. Kein Absturz, keine
 * Fehlermeldung, keine Luecke im Layout — nur eine Ansicht, die nie etwas
 * zeigen konnte.
 *
 * Das ist eine eigene Fehlerklasse, die keiner der anderen Pruefstaende
 * sieht:
 *   wiring_check  fragt: kommt an, was angetippt wird?
 *   field_check   fragt: liest ueberhaupt jemand, was eingegeben wird?
 *   data_check    fragt: GIBT es, was gelesen wird?
 *
 * Vorgehen: dynamisch, nicht per Textsuche. `window.DB` wird durch einen
 * Proxy ersetzt, der jeden Feldzugriff auf einen Arten-Datensatz mitschreibt.
 * Danach wird die App durch alle Tabs und ein paar Fenster geschickt. Jeder
 * Zugriff auf einen Namen, den KEIN Datensatz kennt, ist ein Fund — kein
 * Verdacht, sondern ein belegter Zugriff ins Leere.
 *
 * GRENZE, damit sie niemand neu entdeckt: gemeldet wird nur, was WIRKLICH
 * gelaufen ist. Ein Feldzugriff in einem Zweig, den dieser Durchlauf nicht
 * betritt, faellt nicht auf. Der Prueflauf ist also eine untere Schranke:
 * was er meldet, ist echt; was er nicht meldet, kann trotzdem kaputt sein.
 *
 *   node scripts/data_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];

// Namen, die auf jedem Objekt vorkommen duerfen, ohne dass es ein Fund ist.
const HARMLOS = new Set([
  'then','toJSON','constructor','length','inspect','nodeType','toString','valueOf',
  'hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','_gsProxy',
]);

const SPAEHER = () => {
  window.__gsUnbekannt = {};      // Feldname → Anzahl Zugriffe
  window.__gsGelesen  = {};       // alle gelesenen Felder (zur Deckungsanzeige)
  let echt = null, wrapper = null;
  const cache = new WeakMap();

  const wrapRec = (rec) => {
    if (cache.has(rec)) return cache.get(rec);
    const p = new Proxy(rec, {
      get(t, k) {
        // Felder mit fuehrendem _ setzt der Code selbst an die Datensaetze
        // (Markierungen wie _unverified). Die gehoeren nicht ins Schema und
        // sind kein Fund.
        if (typeof k === 'string' && k[0] !== '_' && !window.__gsHarmlos.has(k)) {
          window.__gsGelesen[k] = (window.__gsGelesen[k] || 0) + 1;
          if (!(k in t)) window.__gsUnbekannt[k] = (window.__gsUnbekannt[k] || 0) + 1;
        }
        return t[k];
      },
      has(t, k) { return k in t; },
    });
    cache.set(rec, p);
    return p;
  };

  // WICHTIG und beim ersten Anlauf falsch gemacht: die Array-Methoden duerfen
  // NICHT an das rohe Array gebunden werden. `DB.filter(fn)` liefe dann ueber
  // das Original, die Datensaetze kaemen ungewickelt beim Aufrufer an, und der
  // Spaeher saehe drei Feldzugriffe statt zwanzigtausend. Unveraendert
  // zurueckgeben heisst: `this` ist beim Aufruf der Proxy, jeder Indexzugriff
  // laeuft durch den `get`-Haken.
  const wrapArr = (arr) => new Proxy(arr, {
    get(t, k) {
      if (typeof k === 'string' && /^\d+$/.test(k)) {
        const v = t[k];
        return (v && typeof v === 'object') ? wrapRec(v) : v;
      }
      return t[k];
    },
  });

  Object.defineProperty(window, 'DB', {
    configurable: true,
    set(v) {
      echt = v;
      wrapper = Array.isArray(v) ? wrapArr(v) : v;
      // Das Feld-Universum EINMAL bilden: welche Namen kommen ueberhaupt vor,
      // und bei wie vielen Arten stehen sie nicht leer?
      try {
        const alle = {}, voll = {};
        v.forEach(r => Object.keys(r).forEach(k2 => {
          alle[k2] = (alle[k2] || 0) + 1;
          const x = r[k2];
          if (x !== null && x !== undefined && x !== '' && !(Array.isArray(x) && !x.length)) voll[k2] = (voll[k2] || 0) + 1;
        }));
        window.__gsSchema = { alle: alle, voll: voll, arten: v.length };
      } catch (_) {}
    },
    get() { return wrapper; },
  });
};

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(h => { window.__gsHarmlos = new Set(h); }, [...HARMLOS]);
  await p.addInitScript(SEED);
  await p.addInitScript(SPAEHER);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display', 'none', 'important');
  });

  for (const t of TABS) {
    try { await p.evaluate(t => { if (typeof switchTab === 'function') switchTab(t); }, t); } catch (_) {}
    await p.waitForTimeout(450);
  }

  // Fenster, die viel mit Arten arbeiten
  const fenster = [
    ['Blühkalender (Jan/Jun/Sep)', () => {
      ['0','5','8'].forEach(m => { localStorage.setItem('gs_bl_month', m); if (typeof openBluehkalender === 'function') openBluehkalender(); });
    }],
    ['Arten-Detail', () => {
      const erste = (window.DB && window.DB[0]) ? window.DB[0].id : null;
      if (erste && typeof openDetail === 'function') openDetail(erste);
    }],
    ['Suche', () => {
      const inp = document.getElementById('search-input') || document.querySelector('#search input');
      if (inp) { inp.value = 'bär'; inp.dispatchEvent(new Event('input', { bubbles: true })); }
    }],
  ];
  for (const [name, fn] of fenster) {
    try { await p.evaluate(new Function('return (' + fn.toString() + ')()')); } catch (e) { console.log('  (' + name + ' uebersprungen: ' + e.message.split('\n')[0] + ')'); }
    await p.waitForTimeout(500);
  }

  const { unbekannt, gelesen, schema } = await p.evaluate(() => ({
    unbekannt: window.__gsUnbekannt, gelesen: window.__gsGelesen, schema: window.__gsSchema || { alle: {}, voll: {}, arten: 0 },
  }));

  console.log('\n=== data_check — Feldzugriffe auf die Arten-Datenbank');
  console.log('  JS-Fehler beim Durchlauf: ' + (errs.length ? errs.length + ' (' + errs.slice(0,2).join(' | ') + ')' : 'keine'));
  const gel = Object.keys(gelesen).sort((a,b) => gelesen[b]-gelesen[a]);
  console.log('  gelesene Felder: ' + gel.length);
  // Zwei Klassen, und nur die erste ist ein Fehler.
  const roh = Object.keys(unbekannt);
  const nirgends = roh.filter(k => !schema.alle[k]).sort((a,b) => unbekannt[b]-unbekannt[a]);
  const teils    = roh.filter(k =>  schema.alle[k]).sort((a,b) => unbekannt[b]-unbekannt[a]);

  console.log('\n  ZUGRIFFE INS LEERE (Feld existiert bei KEINER der ' + schema.arten + ' Arten): ' + nirgends.length);
  nirgends.forEach(k => console.log('    !! .' + k + '  — ' + unbekannt[k] + '× gelesen, existiert nirgends'));
  if (!nirgends.length) console.log('    (keine)');

  if (teils.length) {
    console.log('\n  Zugriffe auf OPTIONALE Felder (existieren, aber nicht bei jeder Art) — kein Fehler:');
    teils.forEach(k => console.log('     · .' + k + '  — bei ' + schema.alle[k] + '/' + schema.arten + ' Arten vorhanden'));
  }

  // Deckung der Felder, auf denen Anzeigen aufbauen. Ein Feld, das es gibt,
  // aber bei 80 % der Arten leer ist, ist kein Fehler — wer eine Anzeige
  // darauf baut, sollte es trotzdem wissen.
  const duenn = gel.filter(k => schema.alle[k] && (schema.voll[k] || 0) < schema.arten * 0.5)
                   .sort((a,b) => (schema.voll[a]||0) - (schema.voll[b]||0));
  if (duenn.length) {
    console.log('\n  Gelesene Felder, die bei ueber der Haelfte der Arten LEER sind:');
    duenn.forEach(k => console.log('     · .' + k + '  — gefuellt bei ' + (schema.voll[k]||0) + '/' + schema.arten +
      ' (' + Math.round((schema.voll[k]||0)/schema.arten*100) + ' %), ' + gelesen[k] + '× gelesen'));
  }
  await br.close();
  process.exitCode = nirgends.length ? 1 : 0;
})();

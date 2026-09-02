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

  // ── v31.89: Widersprueche in den Sicherheitsangaben ──────────────────
  //
  // Gefunden beim Ausmessen der Arten-Luecken: 25 Eintraege mit
  // `toxic:true, tox:3` trugen im Feld `uses` den Standardsatz „Junge
  // Blätter, Blüten oder Samen je nach Art verwendbar" — darunter Aconitum,
  // Oenanthe, Datura, Digitalis und Daphne. Auf derselben Karte stand
  // gleichzeitig „⚠️ Giftig — nicht essen."
  //
  // Der Ladevorgang korrigiert das seit v31.89. Diese Pruefung sorgt dafuer,
  // dass es nicht unbemerkt zurueckkommt — weder durch eine neue
  // Datenlieferung noch durch ein Entfernen der Korrektur.
  const widerspruch = await p.evaluate(() => {
    if (typeof DB === 'undefined' || !Array.isArray(DB)) return null;
    // Der erste Anlauf pruefte nur auf „essbar|verwendbar" — und meldete
    // prompt den Knollenblaetterpilz, weil dort „NICHT essbar oder nur mit
    // Fachkenntnis" steht. Ein Werkzeug, das die richtigen Eintraege
    // anschwaerzt, wird weggeklickt. Also satzweise pruefen und alles
    // verwerfen, was eine Verneinung enthaelt.
    const einladend = /verwendbar|essbar|Salat|roh gegessen|schmeckt/i;
    const verneint  = /\bnicht\b|\bkein|\bnie\b|\bunge|\bmeiden\b|\bgiftig\b|Fachkenntnis/i;
    const wirbt = txt => String(txt || '').split(/[.;!?]+/).some(satz =>
      einladend.test(satz) && !verneint.test(satz));
    const giftig = s => s.toxic === true || (typeof s.tox === 'number' && s.tox >= 2);

    // Zweiter Anlauf, und der entscheidende Unterschied: es blieben 16
    // Treffer uebrig, die KEINE Fehler sind — Robinie (Blueten essbar,
    // Rinde giftig), Tintling (essbar, aber nicht mit Alkohol),
    // Natternkopf (Blueten im Salat). Das sind sorgfaeltig geschriebene
    // Eintraege ueber teilweise essbare Arten, und ein Pruefstand, der
    // sie jedes Mal anschwaerzt, wird weggeklickt.
    //
    // Der Unterschied zum echten Fehler ist messbar: der Fehler war ein
    // IDENTISCHER Satz auf 1'408 Eintraegen. Ein Text, der auf vielen Arten
    // gleichzeitig steht, kann ueber keine einzelne etwas aussagen — und
    // darf deshalb auf einer als giftig eingestuften Art keine Verwendung
    // versprechen. Genau das wird geprueft.
    const haeufig = {};
    DB.forEach(s => { const u = String(s.uses || '').trim(); if (u) haeufig[u] = (haeufig[u] || 0) + 1; });
    const GENERISCH_AB = 50;
    const treffer = DB.filter(s => giftig(s) && wirbt(s.uses) && (haeufig[String(s.uses || '').trim()] || 0) >= GENERISCH_AB)
                      .map(s => s.name + ' (' + s.lat + ', tox=' + s.tox + ', Text steht auf ' +
                                haeufig[String(s.uses || '').trim()] + ' Arten): ' + String(s.uses || '').slice(0, 55));
    const einzeln = DB.filter(s => giftig(s) && wirbt(s.uses) && (haeufig[String(s.uses || '').trim()] || 0) < GENERISCH_AB).length;
    return { gesamt: DB.length, giftig: DB.filter(giftig).length, treffer: treffer, einzeln: einzeln };
  });

  console.log('\n=== data_check — Feldzugriffe auf die Arten-Datenbank');
  if (widerspruch) {
    console.log('  Als giftig eingestuft: ' + widerspruch.giftig + ' von ' + widerspruch.gesamt);
    console.log('  DAVON mit GENERISCHEM Verwendungs-Versprechen: ' + widerspruch.treffer.length + (widerspruch.treffer.length ? '' : '  (gut)'));
    widerspruch.treffer.slice(0, 12).forEach(t => console.log('    !! ' + t));
    if (widerspruch.treffer.length > 12) console.log('    … und ' + (widerspruch.treffer.length - 12) + ' weitere');
    console.log('  (' + widerspruch.einzeln + " einzeln geschriebene Texte ueber teilweise essbare Arten — kein Fehler)");
  }
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
  process.exitCode = (nirgends.length || (widerspruch && widerspruch.treffer.length)) ? 1 : 0;
})();

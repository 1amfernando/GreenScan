// Spalten-Scan fuer ALLE Edge-Functions (v33.59, Austausch-Runde offen-i1/offen-b2/offen-b3).
//
// Anlass: plant-doctor-diagnose laeuft live und waehlte in loadDiseaseContext vier Spalten,
// die es in plant_diseases nicht gibt — PostgREST antwortet 42703, der Fehler wurde
// wegdestrukturiert, die Diagnose bekam nie Krankheitswissen. Den Spalten-Abgleich gab es
// bis dahin nur fuer die Zahlungs-Functions (10_stripe, ueber die Attrappe).
//
// Gelesen wird jede Kette `<x>.from("<tabelle>")…` in supabase/functions/*/index.ts und
// _shared/*.mjs (ohne Kommentare): .select("…") (Aliasse a:b, Casts ::t, JSON-Pfade ->,
// Einbettungen rel(…) gegen die eingebettete Tabelle, *), .insert/.update/.upsert({…})
// (Schluessel der obersten Ebene, auch Kurzform { user_id }), onConflict, und die
// Filter .eq/.neq/.gt/.gte/.lt/.lte/.like/.ilike/.is/.in/.contains/.order mit festem
// Spaltennamen. Ein .select(NAME) mit einer Konstante wird aufgeloest, wenn NAME in der
// Datei oder in einem importierten _shared-Modul als Zeichenkette steht.
//
// Drei Klassen wie backend_check:
//   stimmt         — jede genannte Spalte steht in scripts/edge/_live_schema.mjs
//   bekannt kaputt — namentlich mit Grund in BEKANNT (nie ausgeliefert); ist so eine Function
//                    eines Tages sauber, ist der Eintrag ueberholt → rot
//   nicht pruefbar — Tabelle ohne Momentaufnahme (heute nicht live) oder dynamischer
//                    Tabellen-/Spalten-/Zeilenname; mit Namen gezaehlt, nie still.
// Alles andere ist rot.
'use strict';
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Nie ausgeliefert (live/edge_functions.txt, 10.11.2026), Spalten aus einem anderen Entwurf
// von push_subscriptions; brain_memory gibt es live nicht (gsBrain ist entfernt, CLAUDE.md §4).
const BEKANNT = {
  'daily-push': 'nie ausgeliefert — liest push_subscriptions.auth/send_hour/locale, schreibt last_sent_at/failure_count (live: auth_secret, last_push_sent_at, push_failure_count) und brain_memory (gibt es live nicht); reparieren oder entfernen ist eine Entscheidung',
  'push-test': 'nie ausgeliefert — liest push_subscriptions.auth/enabled, schreibt enabled/last_error_at (gibt es live nicht); sensor-push und send-push decken den Weg',
};
// Einzelne Spalten, die eine LAUFENDE Function bewusst anspricht, obwohl es sie live nicht gibt —
// dieselbe Liste wie in 10_stripe (BEWUSST): beide Schreibvorgaenge laufen durch warne(), der
// Fehler wird protokolliert und nichts haengt daran. Steht der Eintrag nicht mehr im Code → rot.
const BEWUSST_SPALTEN = {
  'stripe-webhook': { 'stripe_subscriptions.trial_will_end_notified_at': 'warne() — Markierung, an der nichts haengt', 'profiles.stripe_email': 'warne() — Abgleich der E-Mail, Spalte gibt es live nicht' },
};
const FILTER = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'contains', 'containedBy', 'order', 'not']);
const SCHREIB = new Set(['insert', 'update', 'upsert']);

// ── kleine Leser ────────────────────────────────────────────────────────────
// liest ab s[i] === oeffnend bis zum passenden Gegenstueck; Zeichenketten zaehlen nicht mit
function klammer(s, i) {
  const auf = s[i], zu = { '(': ')', '{': '}', '[': ']' }[auf];
  let t = 0, q = null;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(' || c === '{' || c === '[') t++;
    else if (c === ')' || c === '}' || c === ']') { t--; if (t === 0) return k; }
  }
  return -1;
}
// teilt an Kommas der obersten Ebene
function teile(s) {
  const out = []; let t = 0, q = null, a = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (q) { if (c === '\\') { k++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '(' || c === '{' || c === '[') t++;
    else if (c === ')' || c === '}' || c === ']') t--;
    else if (c === ',' && t === 0) { out.push(s.slice(a, k)); a = k + 1; }
  }
  out.push(s.slice(a));
  return out.map(x => x.trim()).filter(Boolean);
}
// eine Zeichenkette ohne Ausdruck → ihr Inhalt; sonst null
function literal(x) {
  const m = /^(["'`])([\s\S]*)\1$/.exec(String(x || '').trim());
  if (!m || (m[1] === '`' && /\$\{/.test(m[2]))) return null;
  return m[2];
}
// "a, b:c, d::text, e->>f, rel(x, y), alias:rel!fk(z), *" → { spalten:[…], einbettungen:[{rel, inhalt}] }
function selectListe(text) {
  const spalten = [], einbettungen = [];
  for (let teil of teile(text)) {
    teil = teil.replace(/\s+/g, ' ').trim();
    if (teil === '*' || teil === 'count') continue;
    const auf = teil.indexOf('(');
    if (auf > 0) {
      let kopf = teil.slice(0, auf).trim();
      if (kopf.indexOf(':') >= 0) kopf = kopf.split(':').pop();
      einbettungen.push({ rel: kopf.split('!')[0].trim(), inhalt: teil.slice(auf + 1, teil.lastIndexOf(')')) });
      continue;
    }
    let name = teil;
    if (/^[\w]+\s*:(?!:)/.test(name)) name = name.slice(name.indexOf(':') + 1);  // alias:spalte
    name = name.split('::')[0].split('->')[0].trim();
    if (name) spalten.push(name);
  }
  return { spalten, einbettungen };
}
// Schluessel der obersten Ebene eines Objekt-Literals; null, wenn kein Literal
function objektSchluessel(text) {
  let t = String(text || '').trim();
  if (t[0] === '[') { const z = klammer(t, 0); const innen = teile(t.slice(1, z)); t = innen[0] || ''; }
  if (t[0] !== '{') return null;
  const z = klammer(t, 0);
  const out = { schluessel: [], spread: false };
  for (const p of teile(t.slice(1, z))) {
    if (p.startsWith('...')) { out.spread = true; continue; }
    const m = /^(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*(:|$)/.exec(p);
    if (m) out.schluessel.push(m[1] || m[2] || m[3]);
    else out.spread = true;
  }
  return out;
}

// alle .from()-Ketten einer Datei
function ketten(src) {
  const out = [];
  const re = /([\w$\]\)]+)\s*\.\s*from\s*\(/g; let m;
  while ((m = re.exec(src))) {
    const empf = m[1];
    if (/^(Array|Buffer|Uint8Array|Object|String|storage)$/.test(empf) || /storage$/.test(empf)) continue;
    const auf = m.index + m[0].length - 1;
    const zu = klammer(src, auf); if (zu < 0) continue;
    const arg = src.slice(auf + 1, zu).trim();
    const k = { tabelle: literal(arg), tabellenAusdruck: arg, glieder: [], zeile: src.slice(0, m.index).split('\n').length };
    let i = zu + 1;
    for (;;) {
      const mm = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*/.exec(src.slice(i, i + 200));
      if (!mm) break;
      const name = mm[1]; i += mm[0].length;
      if (src[i] !== '(') { k.glieder.push({ name, args: [] }); continue; }
      const z2 = klammer(src, i); if (z2 < 0) break;
      k.glieder.push({ name, args: teile(src.slice(i + 1, z2)) });
      i = z2 + 1;
    }
    out.push(k);
  }
  return out;
}

// Konstanten-Aufloesung fuer .select(NAME)
function konstanten(src, sharedTexte) {
  const map = {};
  for (const t of [src].concat(sharedTexte)) {
    const re = /(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*=\s*(["'`])([^"'`$]*)\2\s*;/g; let m;
    while ((m = re.exec(t))) if (!(m[1] in map)) map[m[1]] = m[3];
  }
  return map;
}

// Die Pruefung einer Datei → { fehlt: [ 'tabelle.spalte (Methode, Zeile)' ], offen: [ … ], geprueft: n }
function pruefe(src, SPALTEN, sharedTexte) {
  const konst = konstanten(src, sharedTexte || []);
  const fehlt = [], offen = []; let geprueft = 0;
  const gegen = (tab, spalte, wo) => {
    if (!SPALTEN[tab]) { offen.push(tab + ' (keine Momentaufnahme) ' + wo); return; }
    geprueft++;
    if (SPALTEN[tab].indexOf(spalte) < 0) fehlt.push(tab + '.' + spalte + ' ' + wo);
  };
  const selectPruefen = (tab, text, wo) => {
    const s = selectListe(text);
    for (const sp of s.spalten) gegen(tab, sp, wo);
    for (const e of s.einbettungen) {
      // eine Einbettung nennt eine ANDERE Tabelle; ihre Spalten gelten dort
      const unter = selectListe(e.inhalt);
      if (!SPALTEN[e.rel]) { offen.push(e.rel + ' (eingebettet, keine Momentaufnahme) ' + wo); continue; }
      for (const sp of unter.spalten) gegen(e.rel, sp, wo);
    }
  };
  for (const k of ketten(src)) {
    const wo = '(Z. ' + k.zeile + ')';
    if (!k.tabelle) { offen.push('dynamische Tabelle ' + k.tabellenAusdruck + ' ' + wo); continue; }
    const tab = k.tabelle;
    if (!SPALTEN[tab]) { offen.push(tab + ' (keine Momentaufnahme) ' + wo); continue; }
    for (const g of k.glieder) {
      const w = '(.' + g.name + ', Z. ' + k.zeile + ')';
      if (g.name === 'select' && g.args.length) {
        const a = g.args[0];
        const lit = literal(a) !== null ? literal(a) : (/^[A-Z_][A-Z0-9_]*$/.test(a) && konst[a] !== undefined ? konst[a] : null);
        if (lit === null) offen.push(tab + ': select(' + a + ') dynamisch ' + w); else selectPruefen(tab, lit, w);
      } else if (SCHREIB.has(g.name) && g.args.length) {
        const o = objektSchluessel(g.args[0]);
        if (!o) offen.push(tab + ': ' + g.name + '(' + g.args[0].slice(0, 30) + ') Zeile aus Variable ' + w);
        else { for (const sp of o.schluessel) gegen(tab, sp, w); if (o.spread) offen.push(tab + ': ' + g.name + ' mit ...Spread ' + w); }
        const opt = g.args[1] ? objektSchluessel(g.args[1]) : null;
        if (opt && opt.schluessel.indexOf('onConflict') >= 0) {
          const m = /onConflict\s*:\s*(["'`])([^"'`]*)\1/.exec(g.args[1]);
          if (m) for (const sp of m[2].split(',')) gegen(tab, sp.trim(), w + ' onConflict');
        }
      } else if (FILTER.has(g.name) && g.args.length) {
        const lit = literal(g.args[0]);
        if (lit === null) offen.push(tab + ': .' + g.name + '(' + g.args[0].slice(0, 30) + ') dynamisch ' + w);
        else gegen(tab, lit.split('->')[0].trim(), w);
      }
    }
  }
  return { fehlt, offen, geprueft };
}

async function lade(h) {
  const L = await import(pathToFileURL(path.join(__dirname, '_live_schema.mjs')).href);
  const dateien = h.functions().map(d => ({ name: d, rel: d + '/index.ts' }))
    .concat(fs.readdirSync(path.join(h.repo, 'supabase', 'functions', '_shared')).filter(f => /\.mjs$/.test(f)).map(f => ({ name: '_shared/' + f, rel: '_shared/' + f })));
  return { L, dateien };
}
function sharedImporte(h, src) {
  const out = []; const re = /from\s+["']\.\.\/_shared\/([\w.]+\.mjs)["']/g; let m;
  while ((m = re.exec(src))) if (h.gibtEs('_shared/' + m[1])) out.push(h.ohneKommentare(h.lies('_shared/' + m[1])));
  return out;
}
async function scan(h) {
  const { L, dateien } = await lade(h);
  const ergebnis = {};
  for (const d of dateien) {
    const roh = h.lies(d.rel);
    const src = h.ohneKommentare(roh);
    ergebnis[d.name] = pruefe(src, L.SPALTEN, sharedImporte(h, roh));
  }
  return { ergebnis, L };
}

module.exports = [
  {
    name: 'Spalten · jede .from("t")-Kette aller Functions (select · insert/update/upsert · Filter) nennt nur Spalten, die es live gibt — drei Klassen: stimmt · bekannt kaputt (nie ausgeliefert) · nicht pruefbar mit Namen',
    lauf: async (h) => {
      const { ergebnis, L } = await scan(h);
      const rot = [], bekannt = [], ueberholt = [], offen = []; let stimmt = 0, geprueft = 0;
      for (const [f, r] of Object.entries(ergebnis)) {
        geprueft += r.geprueft;
        if (r.offen.length) offen.push(f + ': ' + r.offen.length);
        if (BEKANNT[f]) { if (r.fehlt.length) bekannt.push(f + ' (' + r.fehlt.length + ')'); else ueberholt.push(f); continue; }
        const bew = BEWUSST_SPALTEN[f] || {};
        const gesehen = new Set(r.fehlt.map(x => x.split(' ')[0]));
        for (const sp of Object.keys(bew)) if (!gesehen.has(sp)) ueberholt.push(f + ' ' + sp);
        r.fehlt = r.fehlt.filter(x => !bew[x.split(' ')[0]]);
        if (r.fehlt.length) rot.push(f + ': ' + r.fehlt.slice(0, 6).join(' · ') + (r.fehlt.length > 6 ? ' … +' + (r.fehlt.length - 6) : ''));
        else stimmt++;
      }
      for (const b of Object.keys(BEKANNT)) if (!ergebnis[b]) ueberholt.push(b + ' (Verzeichnis gibt es nicht mehr)');
      if (rot.length) return { ok: false, warum: rot.length + ' Datei(en) nennen Spalten, die es live (Stand ' + L.STAND + ') nicht gibt — PostgREST 42703/PGRST204: ' + rot.join(' | ') };
      if (ueberholt.length) return { ok: false, warum: 'BEKANNT/BEWUSST_SPALTEN ist ueberholt (sauber oder weg): ' + ueberholt.join(', ') };
      if (geprueft < 200) return { ok: false, warum: 'nur ' + geprueft + ' Spalten geprueft — der Parser sieht zu wenig' };
      return { ok: true, info: stimmt + ' Dateien stimmen (' + geprueft + ' Spalten-Nennungen gegen die Momentaufnahme ' + L.STAND + ') · bekannt kaputt: ' + bekannt.join(', ') + ' · bewusst (warne): ' + Object.keys(BEWUSST_SPALTEN).map(f => f + ' ' + Object.keys(BEWUSST_SPALTEN[f]).length).join(', ') + ' · nicht pruefbar: ' + offen.join(', ') };
    },
  },
  {
    name: 'Spalten · Gegenprobe: eine erfundene Spalte in einer gruenen Function (select, update, eq, Einbettung) wird rot; Alias, Cast, JSON-Pfad, Kurzform, Kommentar und * bleiben gruen',
    lauf: async (h) => {
      const { L } = await lade(h);
      const S = L.SPALTEN;
      const gut = `
        // .from("profiles").select("erfunden_im_kommentar")
        const a = await sb.from("profiles").select("id, name:display_name, xp::text, stats->>scans, *").eq("id", uid).maybeSingle();
        const b = await sb.from("stripe_subscriptions").select("id, stripe_prices(id, product_id)").eq("user_id", uid);
        const c = await sb.from("ai_usage").insert({ user_id, day: t, "model": m, tokens_in: 1, tokens_out: 2 });
        const d = await sb.from("profiles").update({ xp: 1 }).eq("id", uid);
        const e = await sb.storage.from("plant-photos").remove(["x"]);
        const f = Array.from(x);
        const g = await sb.from("audit_log").select(\`id,
          action, created_at\`).order("created_at", { ascending: false });`;
      const r0 = pruefe(h.ohneKommentare(gut), S);
      if (r0.fehlt.length || r0.geprueft < 15) return { ok: false, warum: 'gute Ketten falsch gelesen: ' + JSON.stringify(r0) };
      const boese = [
        ['select', 'await sb.from("profiles").select("id, erfundene_spalte")', 'profiles.erfundene_spalte'],
        ['update', 'await sb.from("profiles").update({ xp: 1, erfunden: 2 }).eq("id", u)', 'profiles.erfunden'],
        ['eq', 'await sb.from("profiles").select("id").eq("erfunden", u)', 'profiles.erfunden'],
        ['Einbettung', 'await sb.from("stripe_subscriptions").select("id, stripe_prices(erfunden)")', 'stripe_prices.erfunden'],
        ['upsert onConflict', 'await sb.from("launch_offer_usage").upsert({ user_id: u }, { onConflict: "erfunden" })', 'launch_offer_usage.erfunden'],
        ['Konstante', 'const SP = "id, erfunden";\nawait sb.from("profiles").select(SP)', 'profiles.erfunden'],
      ];
      for (const [was, code, erwartet] of boese) {
        const r = pruefe(h.ohneKommentare(code), S);
        if (!r.fehlt.some(x => x.startsWith(erwartet + ' '))) return { ok: false, warum: 'Gegenprobe ' + was + ' blieb gruen: ' + JSON.stringify(r) };
      }
      // und an einer ECHTEN gruenen Function: eine erfundene Spalte in ihren Quelltext
      const echt = h.ohneKommentare(h.lies('plant-doctor-diagnose/index.ts')).replace('.from("plant_doctor_history")', '.from("plant_doctor_history").select("erfunden_xy")');
      const re = pruefe(echt, S, sharedImporte(h, h.lies('plant-doctor-diagnose/index.ts')));
      if (!re.fehlt.some(x => /plant_doctor_history\.erfunden_xy/.test(x))) return { ok: false, warum: 'erfundene Spalte in plant-doctor-diagnose nicht gemeldet' };
      return { ok: true, info: r0.geprueft + ' gute Nennungen gruen (Alias, Cast, JSON-Pfad, Kurzform, Einbettung, Vorlage ueber zwei Zeilen; Kommentar, storage.from, Array.from ignoriert) · 6 Gegenproben + 1 an der echten Function rot' };
    },
  },
  {
    // knowledge-bulk-gen spricht seine 35 Tabellen ueber schema.table an — fuer den Scan oben
    // dynamisch. Die Spalten stehen aber im SCHEMA-TEXT (kiSchemaSpalten), und genau die gehen nach
    // kiZeileOk in den Insert: hier gegen die Live-Spalten gehalten (dazu KI_SICHERHEIT und source).
    name: 'Spalten · knowledge-bulk-gen: jede Spalte, die ein Schema-Text dem Modell nennt (und die nach dem Sieb in den Insert geht), gibt es live in der Zieltabelle',
    lauf: async (h) => {
      const { L } = await lade(h);
      const m = await h.modul('_shared/ki_tor.mjs');
      const src = h.lies('knowledge-bulk-gen/index.ts');
      const re = /^\s*(\w+):\s*\{\s*table:\s*"(\w+)",[^`]*?system:\s*`([^`]*)`(.*)$/gm;
      const rot = [], ohne = []; let n = 0, spalten = 0, mm;
      while ((mm = re.exec(src))) {
        n++;
        const [, topic, tab, sys, rest] = mm;
        const live = L.SPALTEN[tab];
        if (!live) { ohne.push(tab); continue; }
        let keys;
        const mapper = /mapper:\s*\([^)]*\)\s*=>\s*\((\{[\s\S]*\})\)\s*\}\s*,?\s*$/.exec(rest);
        if (mapper) keys = (objektSchluessel(mapper[1]) || { schluessel: [] }).schluessel;   // daily_quizzes: der Mapper baut die Zeile
        else {
          const sp = m.kiSchemaSpalten(sys);
          if (!sp) { rot.push(topic + ': Schema nicht lesbar'); continue; }
          const probe = m.kiZeileOk(tab, {}, sp, []);
          keys = Object.keys(sp).filter(k => k !== 'source' && k !== 'sources').concat(Object.keys(probe.zeile || {}));
        }
        for (const k of new Set(keys)) { spalten++; if (live.indexOf(k) < 0) rot.push(topic + ' → ' + tab + '.' + k); }
      }
      if (n < 30) return { ok: false, warum: 'nur ' + n + ' Schemata gelesen' };
      if (rot.length) return { ok: false, warum: rot.length + ' Spalte(n) aus dem Schema-Text gibt es live nicht — jede KI-Zeile dieser Tabelle scheitert am Insert (42703): ' + rot.join(' · ') };
      return { ok: true, info: n + ' Schemata · ' + spalten + ' Spalten gegen die Momentaufnahme ' + L.STAND + ' · ohne Momentaufnahme: ' + (ohne.join(', ') || 'keine') };
    },
  },
  {
    // v33.59 (Austausch-Runde offen-x2): STATUS sagte „alle 29 geaenderten ausliefern", FUER-FERNANDO §30b
    // nahm fuenf aus — zwei Texte, die dieselbe Liste von Hand fuehren. Die Liste steht jetzt EINMAL
    // (supabase/functions/AUSLIEFERUNG.json), und wer ausgeliefert wird oder live laeuft, besteht den Scan.
    name: 'Auslieferung · AUSLIEFERUNG.json nennt jedes Function-Verzeichnis genau einmal mit Zustand und Grund; was live laeuft oder ausgeliefert wird, besteht den Spalten-Scan (Gegenprobe: daily-push auf „ausliefern" → rot)',
    lauf: async (h) => {
      const roh = h.lies('AUSLIEFERUNG.json');
      let doc; try { doc = JSON.parse(roh); } catch (e) { return { ok: false, warum: 'AUSLIEFERUNG.json ist kein JSON: ' + e.message }; }
      const verz = fs.readdirSync(path.join(h.repo, 'supabase', 'functions')).filter(d => d !== '_shared' && fs.statSync(path.join(h.repo, 'supabase', 'functions', d)).isDirectory()).sort();
      const migr = new Set(fs.readdirSync(path.join(h.repo, 'supabase', 'migrations')));
      const { ergebnis } = await scan(h);
      const rot = auslieferungPruefen(doc, verz, migr, ergebnis);
      if (rot.length) return { ok: false, warum: rot.join(' | ') };
      // Gegenproben: eine nicht lauffaehige Function zum Ausliefern, ein fehlendes und ein fremdes Verzeichnis
      const kopie = () => JSON.parse(roh);
      const g1 = kopie(); g1.functions['daily-push'].zustand = 'ausliefern';
      const g2 = kopie(); delete g2.functions['stripe-webhook'];
      const g3 = kopie(); g3.functions['gibt-es-nicht'] = { zustand: 'live', grund: 'x', live_version: 'v1' };
      const g4 = kopie(); g4.functions['plant-doctor-diagnose'].nach = 'erfunden.sql';
      const g5 = Object.assign({}, ergebnis, { 'stripe-portal': { fehlt: ['profiles.erfunden (.select, Z. 1)'], offen: [], geprueft: 1 } });
      const proben = [['daily-push ausliefern', auslieferungPruefen(g1, verz, migr, ergebnis)], ['Verzeichnis fehlt', auslieferungPruefen(g2, verz, migr, ergebnis)], ['fremder Eintrag', auslieferungPruefen(g3, verz, migr, ergebnis)], ['Migration erfunden', auslieferungPruefen(g4, verz, migr, ergebnis)], ['ausliefern mit fehlender Spalte', auslieferungPruefen(doc, verz, migr, g5)]];
      for (const [was, r] of proben) if (!r.length) return { ok: false, warum: 'Gegenprobe „' + was + '" blieb gruen' };
      const z = {}; for (const [d, e] of Object.entries(doc.functions)) { const k = e.zustand + (e.nach ? ' ' + e.nach : ''); (z[k] = z[k] || []).push(d); }
      return { ok: true, info: verz.length + ' Verzeichnisse · ' + Object.entries(z).map(([k, v]) => k + ': ' + v.length).join(' · ') + ' · 5 Gegenproben rot' };
    },
  },
];
const ZUSTAENDE = ['live', 'ausliefern', 'erst_nach', 'nicht'];
function auslieferungPruefen(doc, verz, migr, ergebnis) {
  const rot = [];
  const f = (doc && doc.functions) || {};
  for (const d of verz) if (!f[d]) rot.push(d + ': kein Eintrag');
  for (const [d, e] of Object.entries(f)) {
    if (verz.indexOf(d) < 0) { rot.push(d + ': Eintrag ohne Verzeichnis'); continue; }
    if (!e || ZUSTAENDE.indexOf(e.zustand) < 0) { rot.push(d + ': Zustand ' + JSON.stringify(e && e.zustand)); continue; }
    if (!e.grund || typeof e.grund !== 'string') rot.push(d + ': ohne Grund');
    if (e.zustand === 'erst_nach' ? !(e.nach && migr.has(e.nach)) : e.nach !== undefined) rot.push(d + ': nach=' + JSON.stringify(e.nach) + (e.zustand === 'erst_nach' ? ' ist keine Migration im Repo' : ' nur bei erst_nach'));
    if (e.zustand === 'nicht' && e.live_version) rot.push(d + ': laeuft live (' + e.live_version + '), steht aber auf „nicht"');
    if (e.zustand === 'live' && !e.live_version) rot.push(d + ': „live" ohne live_version');
    if (e.zustand === 'nicht') continue;
    if (BEKANNT[d]) { rot.push(d + ': steht auf „' + e.zustand + '", ist aber bekannt kaputt (' + BEKANNT[d].split(' — ')[0] + ')'); continue; }
    const r = ergebnis[d];
    if (!r) continue;   // ohne index.ts (book-ingest): nichts zu scannen
    const bew = BEWUSST_SPALTEN[d] || {};
    const fehlt = r.fehlt.filter(x => !bew[x.split(' ')[0]]);
    if (fehlt.length) rot.push(d + ' (' + e.zustand + '): Spalten fehlen live — ' + (e.zustand === 'live' || e.live_version ? 'reparieren: ' : 'nicht ausliefern: ') + fehlt.slice(0, 4).join(' · '));
  }
  return rot;
}
module.exports.pruefe = pruefe;
module.exports.scan = scan;
module.exports.BEKANNT = BEKANNT;
module.exports.BEWUSST_SPALTEN = BEWUSST_SPALTEN;
module.exports.auslieferungPruefen = auslieferungPruefen;

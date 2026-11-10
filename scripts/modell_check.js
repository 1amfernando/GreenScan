#!/usr/bin/env node
// modell_check.js — antwortet die KI auch dann noch, wenn Anthropic ein Modell abschaltet?
//
//   node scripts/modell_check.js
//   GS_MODELL_CHECK_PROXY=<pfad/zu/altem/index.ts> node scripts/modell_check.js   # Gegenprobe am Rand
//
// Anlass (10.11.2026, gemessen): `claude-sonnet-4-20250514` ist seit dem 15.06.2026
// abgeschaltet — plant-doctor-diagnose, garden-scan-analyze und plan-iterate nannten
// genau dieses eine Modell und waren fuenf Monate tot, ohne dass etwas meldete. Und
// `claude-sonnet-4-5` endet am 30.11.2026: der Vorgabewert von ai-proxy, auf den er
// JEDES nicht freigegebene Modell still umschrieb (ai_usage: 37 von 37 Aufrufen).
// Ab dem 30.11. waere jeder Scan gescheitert.
//
// Drei Haelften, wie bei apk_check:
//   RECHNUNG  supabase/functions/_shared/modelle.mjs laeuft in Node — Ketten, Freigabe,
//             der Zusatz je Modell (Sonnet 5.5 und 5 denken sonst von sich aus nach — das
//             zaehlt gegen max_tokens und stellt einen thinking-Block vor den Text),
//             „ist das ein Modellfehler?", Rueckfall, der Ersatz fuer fetch.
//   RAND      der ECHTE Handler von ai-proxy wird ausgefuehrt: Typen entfernt
//             (node:module stripTypeScriptTypes), Deno/Supabase/Anthropic gestellt. Eine
//             Regel, die man nicht ausfuehren kann, hat man nicht geprueft (v33.41).
//   QUELLTEXT kein Modellname als Zeichenkette in einer Edge-Function; die Kette der App
//             (index.html) und die des Servers meinen dieselben Modelle.
//
// Was hier NICHT geprueft wird, und das steht auch im Bericht: ob Anthropic die Namen
// der Kette heute annimmt (kein Netz dorthin) und ob die ausgelieferte Function der im
// Repo entspricht. Dafuer: `select model, count(*) from ai_usage group by 1`.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');

const WURZEL = path.resolve(__dirname, '..');
const FUNKTIONEN = path.join(WURZEL, 'supabase', 'functions');
const MODUL = path.join(FUNKTIONEN, '_shared', 'modelle.mjs');
const PROXY = process.env.GS_MODELL_CHECK_PROXY
  ? path.resolve(process.env.GS_MODELL_CHECK_PROXY)
  : path.join(FUNKTIONEN, 'ai-proxy', 'index.ts');
const z = (o) => JSON.stringify(o);

// ── Quelltext ohne Kommentare — fuehrt Zeichenketten mit, sonst gilt das „//" in
//    "https://…" als Kommentaranfang (dieselbe Falle wie in wiring_check, v31.45).
function ohneKommentare(src) {
  let aus = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; aus += c; i++;
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { aus += src[i] + (src[i + 1] || ''); i += 2; continue; }
        aus += src[i]; i++;
      }
      aus += q; i++; continue;
    }
    aus += c; i++;
  }
  return aus;
}
const MODELLNAME = /claude-(?:[a-z]+-)?[0-9][a-z0-9.-]*|claude-(?:opus|sonnet|haiku|fable|mythos|instant)[a-z0-9.-]*/g;
function modellNamenIn(src) { return (ohneKommentare(src).match(MODELLNAME) || []); }

function functionDateien() {
  return fs.readdirSync(FUNKTIONEN, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => path.join(FUNKTIONEN, d.name, 'index.ts'))
    .filter((p) => fs.existsSync(p));
}

// ── RAND: den Handler von ai-proxy wirklich laden ──────────────────────────────
const ENV_VORGABE = { SUPABASE_URL: 'https://stub.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', ANTHROPIC_API_KEY: 'sk-env' };
const stub = { handler: null, szen: null, prot: null };
const USAGE_OK = (m) => ({ status: 200, text: z({ id: 'msg_1', model: m, content: [{ type: 'text', text: 'ok' }], usage: { input_tokens: 11, output_tokens: 7 } }) });
const MODELL_WEG = (m) => ({ status: 404, text: z({ type: 'error', error: { type: 'not_found_error', message: 'model: ' + m } }) });

function antwortFuer(q) {
  const s = stub.szen;
  if (q.tabelle === 'v_user_entitlements') {
    stub.prot.entAbfragen.push(q.cols);
    if (s.entFehlerBreit && /is_admin|role/.test(String(q.cols))) return { data: null, error: { message: 'column v_user_entitlements.is_admin does not exist' } };
    if (!s.ent) return { data: null, error: null };
    const zeile = {};
    String(q.cols).split(',').map((c) => c.trim()).forEach((c) => { if (c in s.ent) zeile[c] = s.ent[c]; });
    return { data: zeile, error: null };
  }
  if (q.tabelle === 'ai_usage') return { count: s.benutzt || 0, data: null, error: null };
  if (q.tabelle === 'app_settings') {
    if (!q.admin) return { data: null, error: null };          // RLS: der Nutzer-Client sieht app_settings nicht
    if (q.filter.key === 'global_anthropic_api_key') return { data: s.keyInDb ? { value: s.keyInDb } : null, error: null };
    if (q.filter.key === 'global_api_enabled') return { data: s.an === undefined ? { value: 'true' } : (s.an === null ? null : { value: s.an }), error: null };
  }
  return { data: null, error: null };
}
function createClientStub(_url, key) {
  const admin = key === ENV_VORGABE.SUPABASE_SERVICE_ROLE_KEY;
  return {
    auth: {
      getUser: async () => stub.szen.user
        ? { data: { user: stub.szen.user }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } },
    },
    from(tabelle) {
      const q = { tabelle, filter: {}, cols: null, admin };
      const k = {
        select(cols) { q.cols = cols; return k; },
        eq(f, v) { q.filter[f] = v; return k; },
        maybeSingle() { return Promise.resolve(antwortFuer(q)); },
        insert(zeile) { stub.prot.inserts.push({ tabelle, zeile, admin }); return Promise.resolve({ data: null, error: null }); },
        then(ja, nein) { return Promise.resolve(antwortFuer(q)).then(ja, nein); },
      };
      return k;
    },
  };
}

async function proxyLaden() {
  const mod = require('node:module');
  if (typeof mod.stripTypeScriptTypes !== 'function') return { grund: 'node:module.stripTypeScriptTypes fehlt (Node ' + process.version + ', gebraucht ≥ 22.13)' };
  if (!fs.existsSync(PROXY)) return { grund: 'ai-proxy nicht gefunden: ' + PROXY };
  let src = fs.readFileSync(PROXY, 'utf8');
  const warnAlt = process.emitWarning;
  process.emitWarning = () => {};                              // „ExperimentalWarning" gehoert nicht in den Bericht
  try { src = mod.stripTypeScriptTypes(src); } finally { process.emitWarning = warnAlt; }
  const vorher = src;
  src = src.replace(/import\s*\{\s*createClient\s*\}\s*from\s*["']jsr:@supabase\/supabase-js@2["'];?/, 'const createClient = globalThis.__gsModellCheck.createClient;');
  if (src === vorher) return { grund: 'der Import von supabase-js steht nicht mehr so da — den Lader in modell_check.js nachziehen' };
  src = src.replace(/from\s*["']\.\.\/_shared\/modelle\.mjs["']/g, 'from ' + z(pathToFileURL(MODUL).href));
  globalThis.__gsModellCheck = { createClient: createClientStub };
  globalThis.Deno = {
    env: { get: (k) => { const e = Object.assign({}, ENV_VORGABE, (stub.szen && stub.szen.env) || {}); return e[k] === null ? undefined : e[k]; } },
    serve: (h) => { stub.handler = h; },
  };
  const tmp = path.join(os.tmpdir(), 'gs_modell_check_' + process.pid + '_' + Date.now() + '.mjs');
  fs.writeFileSync(tmp, src);
  try { await import(pathToFileURL(tmp).href); } finally { try { fs.unlinkSync(tmp); } catch (_) { /* egal */ } }
  if (typeof stub.handler !== 'function') return { grund: 'Deno.serve wurde nicht gerufen' };
  return { ok: true };
}

// Eine Anfrage durch den echten Handler. `szen`: user · ent · benutzt · an · keyInDb · env · upstream(modell) · entFehlerBreit
async function fahre(szen, anfrage) {
  stub.szen = Object.assign({ user: { id: 'u-1' }, ent: { tier: 'free', is_admin: false, role: 'user' }, benutzt: 0 }, szen || {});
  stub.prot = { upstream: [], inserts: [], entAbfragen: [], log: [] };
  const a = Object.assign({ method: 'POST', auth: 'Bearer nutzer-jwt', origin: 'https://green-scan.ch',
    body: { model: 'claude-sonnet-4-6', max_tokens: 900, system: 'S', messages: [{ role: 'user', content: 'Hallo' }] } }, anfrage || {});
  const kopf = { 'content-type': 'application/json' };
  if (a.auth) kopf.authorization = a.auth;
  if (a.origin) kopf.origin = a.origin;
  if (a.contentLength) kopf['content-length'] = String(a.contentLength);
  const init = { method: a.method, headers: kopf };
  if (a.method === 'POST') init.body = typeof a.body === 'string' ? a.body : z(a.body);
  const fetchAlt = globalThis.fetch, warnAlt = console.warn, errAlt = console.error;
  globalThis.fetch = async (url, o) => {
    const rumpf = JSON.parse(o.body);
    stub.prot.upstream.push({ url: String(url), modell: rumpf.model, max_tokens: rumpf.max_tokens, key: o.headers['x-api-key'], felder: Object.keys(rumpf).sort().join(','),
      denken: rumpf.thinking ? rumpf.thinking.type : (rumpf.output_config ? 'effort:' + rumpf.output_config.effort : '') });
    const r = (stub.szen.upstream || USAGE_OK)(rumpf.model, stub.prot.upstream.length);
    if (r && r.wirft) throw new Error(r.wirft);
    return new Response(r.text, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  };
  console.warn = (...t) => stub.prot.log.push('warn: ' + t.join(' '));
  console.error = (...t) => stub.prot.log.push('error: ' + t.join(' '));
  let res;
  try { res = await stub.handler(new Request('https://stub.supabase.co/functions/v1/ai-proxy', init)); }
  finally { globalThis.fetch = fetchAlt; console.warn = warnAlt; console.error = errAlt; }
  await new Promise((r) => setTimeout(r, 0));                   // der ai_usage-Insert ist nicht abgewartet
  const text = await res.text();
  let daten = null; try { daten = JSON.parse(text); } catch (_) { daten = null; }
  return { status: res.status, text, daten, typ: daten && daten.error && daten.error.type, cors: res.headers.get('access-control-allow-origin'),
    up: stub.prot.upstream, ins: stub.prot.inserts, ent: stub.prot.entAbfragen, log: stub.prot.log };
}
const modelle = (r) => r.up.map((u) => u.modell).join(' → ') || '(kein Aufruf)';

// ══ RECHNUNG ══════════════════════════════════════════════════════════════════
const RECHNUNG = [
  {
    name: 'Ketten · beide Rollen haben eine, keine nennt ein abgeschaltetes Modell, keine nennt eines doppelt',
    lauf: (M) => {
      const rollen = Object.keys(M.MODELL_KETTEN);
      if (rollen.sort().join() !== 'schnell,vision') return { ok: false, warum: 'Rollen: ' + rollen.join() };
      for (const r of rollen) {
        const k = M.MODELL_KETTEN[r];
        if (!Array.isArray(k) || k.length < 2) return { ok: false, warum: r + ': eine Kette mit weniger als zwei Modellen ist keine Kette (' + z(k) + ')' };
        const tot = k.filter((m) => Object.prototype.hasOwnProperty.call(M.MODELLE_ABGESCHALTET, m));
        if (tot.length) return { ok: false, warum: r + ' nennt Abgeschaltetes: ' + tot.map((m) => m + ' (' + M.MODELLE_ABGESCHALTET[m] + ')').join(', ') };
        if (k.some((m, i) => k.indexOf(m) !== i)) return { ok: false, warum: r + ' nennt ein Modell doppelt: ' + z(k) };
        if (k.some((m) => !M.modellGueltig(m))) return { ok: false, warum: r + ' nennt einen Namen, den modellGueltig ablehnt: ' + z(k) };
      }
      const daten = Object.values(M.MODELLE_ABGESCHALTET);
      if (daten.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || isNaN(Date.parse(d)))) return { ok: false, warum: 'ein Abschaltdatum ist kein Datum: ' + z(daten) };
      return { ok: true, info: 'vision ' + M.MODELL_KETTEN.vision.join(' → ') + ' · schnell ' + M.MODELL_KETTEN.schnell.join(' → ') + ' · ' + daten.length + ' abgeschaltete Namen' };
    },
  },
  {
    name: 'Ein Name · gut ist, was wie ein Claude-Modell aussieht und nicht abgeschaltet ist; alles andere geht nie an Anthropic',
    lauf: (M) => {
      const gut = ['claude-sonnet-5-5', 'claude-haiku-4-5-20251001', ' claude-sonnet-4-6 '];
      const schlecht = ['claude-sonnet-4-5', 'claude-sonnet-4-20250514', 'claude-3-5-haiku-latest', '', null, undefined, 'gpt-4o', 'claude-', 'claude-x"}', 'claude-sonnet 5', 'CLAUDE-SONNET-5-5', 'claude-' + 'a'.repeat(80)];
      const a = gut.filter((n) => !M.modellGueltig(n)), b = schlecht.filter((n) => M.modellGueltig(n));
      if (a.length || b.length) return { ok: false, warum: 'faelschlich abgelehnt: ' + z(a) + ' · faelschlich angenommen: ' + z(b) };
      return { ok: true, info: gut.length + ' gute, ' + schlecht.length + ' schlechte — darunter das Modell, das am 30.11.2026 endet' };
    },
  },
  {
    name: 'Secret · ein Name oder „a,b" kommt VOR die eingebaute Kette, Abgeschaltetes und Dubletten fallen heraus, die Kette ist nie leer',
    lauf: (M) => {
      const basis = M.MODELL_KETTEN.vision;
      const a = M.modellKette('vision', 'claude-sonnet-9');
      if (a[0] !== 'claude-sonnet-9' || a.slice(1).join() !== basis.join()) return { ok: false, warum: 'ein Name: ' + z(a) };
      const b = M.modellKette('vision', ' claude-sonnet-9 , claude-sonnet-4-5,  ' + basis[1] + ' ,, ');
      if (b.join() !== ['claude-sonnet-9', basis[1]].concat(basis.filter((m) => m !== basis[1])).join()) return { ok: false, warum: 'Liste: ' + z(b) };
      const c = M.modellKette('vision', 'claude-sonnet-4-5,claude-3-5-sonnet-latest');
      if (c.join() !== basis.join()) return { ok: false, warum: 'nur Abgeschaltetes im Secret: ' + z(c) };
      const d = M.modellKette('gibtesnicht', '');
      if (d.join() !== basis.join()) return { ok: false, warum: 'unbekannte Rolle: ' + z(d) };
      const e = M.modellKette('schnell', undefined);
      if (e.join() !== M.MODELL_KETTEN.schnell.join()) return { ok: false, warum: 'ohne Secret: ' + z(e) };
      e.push('x');
      if (M.MODELL_KETTEN.schnell.indexOf('x') >= 0) return { ok: false, warum: 'die Rueckgabe IST die eingebaute Liste — ein Aufrufer koennte sie veraendern' };
      return { ok: true, info: 'Secret vorn: ' + b.join(' → ') };
    },
  },
  {
    name: 'Was ein Client verlangt · erlaubt steht vorn mit SEINER Kette dahinter, Abgeschaltetes und Fremdes wird ersetzt — und der Grund sagt es',
    lauf: (M) => {
      const v = M.MODELL_KETTEN.vision, s = M.MODELL_KETTEN.schnell;
      const leer = M.modellFuerAnfrage('', 'vision');
      if (leer.ersetzt || leer.kette.join() !== v.join() || leer.grund !== 'kein Modell verlangt') return { ok: false, warum: 'ohne Wunsch: ' + z(leer) };
      const letzter = v[v.length - 1];
      const a = M.modellFuerAnfrage(letzter, 'vision');
      if (a.ersetzt || a.kette[0] !== letzter || a.kette.length !== v.length || a.kette.slice(1).join() !== v.slice(0, -1).join()) return { ok: false, warum: 'erlaubt (vision): ' + z(a) };
      const b = M.modellFuerAnfrage(s[0], 'vision');
      if (b.ersetzt || b.kette.join() !== s.join()) return { ok: false, warum: 'ein schnelles Modell behaelt die Kette SEINER Rolle: ' + z(b) };
      const tot = M.modellFuerAnfrage('claude-sonnet-4-5', 'vision');
      if (!tot.ersetzt || tot.kette.join() !== v.join() || tot.grund !== 'abgeschaltet seit 2026-11-30') return { ok: false, warum: 'abgeschaltet: ' + z(tot) };
      const teuer = M.modellFuerAnfrage('claude-opus-5-5', 'vision');
      if (!teuer.ersetzt || teuer.kette.join() !== v.join() || teuer.grund !== 'nicht freigegeben') return { ok: false, warum: 'teureres Modell: ' + z(teuer) };
      const quatsch = M.modellFuerAnfrage('"},{"model":"x', 'schnell');
      if (!quatsch.ersetzt || quatsch.kette.join() !== s.join()) return { ok: false, warum: 'Unsinn: ' + z(quatsch) };
      const sec = M.modellFuerAnfrage('claude-sonnet-9', 'vision', 'claude-sonnet-9', '');
      if (sec.ersetzt || sec.kette[0] !== 'claude-sonnet-9') return { ok: false, warum: 'ein Modell aus dem Secret ist freigegeben: ' + z(sec) };
      tot.kette.push('x');
      if (M.MODELL_KETTEN.vision.indexOf('x') >= 0) return { ok: false, warum: 'die Rueckgabe IST die eingebaute Liste' };
      return { ok: true, info: 'claude-sonnet-4-5 → ' + v[0] + ' („' + tot.grund + '") · claude-opus-5-5 → ' + v[0] + ' („' + teuer.grund + '")' };
    },
  },
  {
    name: 'Zusatz je Modell · Sonnet 5.5 und 5 denken sonst von sich aus nach: jedes Modell bekommt SEINE Angabe und SEIN Token-Budget — und die bisherigen Modelle bleiben, wie sie waren',
    lauf: (M) => {
      const tab = [
        ['claude-sonnet-4-6', '{}', 900],
        ['claude-haiku-4-5-20251001', '{}', 900],
        ['claude-sonnet-5-5', '{"thinking":{"type":"between_tools"}}', 1215],
        ['claude-sonnet-5', '{"thinking":{"type":"disabled"}}', 1215],
        ['claude-sonnet-5-20260301', '{"thinking":{"type":"disabled"}}', 1215],
        ['claude-haiku-5-5', '{"output_config":{"effort":"low"}}', 3263],
        ['claude-sonnet-6', '{}', 3263],
      ];
      for (const [m, felder, budget] of tab) {
        const zu = M.modellZusatz(m);
        const r = M.rumpfFuerModell({ max_tokens: 900, messages: [{ role: 'user', content: 'x' }], model: 'claude-sonnet-4-5' }, m, false);
        if (z(zu.felder) !== felder) return { ok: false, warum: m + ': Zusatz ' + z(zu.felder) + ' statt ' + felder };
        if (r.max_tokens !== budget) return { ok: false, warum: m + ': max_tokens ' + r.max_tokens + ' statt ' + budget };
        if (r.model !== m) return { ok: false, warum: m + ': ein `model` im Rumpf hat gewonnen (' + r.model + ')' };
      }
      // Sonnet 5.5 nimmt 'disabled' NICHT (400), Sonnet 5 nimmt 'between_tools' nicht — die zwei duerfen nie dieselbe Angabe bekommen.
      if (z(M.modellZusatz('claude-sonnet-5-5').felder) === z(M.modellZusatz('claude-sonnet-5').felder)) return { ok: false, warum: 'Sonnet 5.5 und Sonnet 5 bekommen dieselbe Angabe' };
      const ein = { max_tokens: 900, messages: [] };
      const aus = M.rumpfFuerModell(ein, 'claude-sonnet-5-5', false);
      if (ein.model !== undefined || ein.thinking !== undefined || ein.max_tokens !== 900 || aus === ein) return { ok: false, warum: 'der uebergebene Rumpf wurde veraendert: ' + z(ein) };
      const ohne = M.rumpfFuerModell(ein, 'claude-sonnet-5-5', true);
      if (ohne.thinking !== undefined || ohne.max_tokens !== 1215 + 2048) return { ok: false, warum: 'zweiter Versuch ohne Angabe: ' + z(ohne) };
      const ohneAlt = M.rumpfFuerModell(ein, 'claude-sonnet-4-6', true);
      if (ohneAlt.max_tokens !== 900) return { ok: false, warum: 'ein Modell ohne Angabe bekommt Denk-Luft: ' + ohneAlt.max_tokens };
      if (M.rumpfFuerModell({ messages: [] }, 'claude-sonnet-4-6', false).max_tokens !== 1024) return { ok: false, warum: 'ohne max_tokens: kein Vorgabewert' };
      return { ok: true, info: '900 Token: 4.6 → 900 · 5.5 → 1215 mit between_tools · 5 → 1215 mit disabled · Haiku 5.5 → 3263 mit effort low · unbekannt → 3263 ohne Angabe' };
    },
  },
  {
    name: 'Denk-Bloecke · eine Antwort, die mit `thinking` beginnt, kommt ohne ihn an — der Rest bleibt; und eine Antwort ohne ihn bleibt Byte fuer Byte',
    lauf: (M) => {
      const mit = z({ id: 'm1', model: 'claude-sonnet-5-5', stop_reason: 'end_turn', usage: { input_tokens: 5, output_tokens: 9 },
        content: [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'redacted_thinking', data: 'x' }, { type: 'text', text: '{"name":"Bärlauch"}' }] });
      const a = JSON.parse(M.ohneDenkBloecke(mit));
      if (a.content.length !== 1 || a.content[0].type !== 'text' || a.content[0].text !== '{"name":"Bärlauch"}') return { ok: false, warum: 'content: ' + z(a.content) };
      if (a.usage.output_tokens !== 9 || a.stop_reason !== 'end_turn' || a.model !== 'claude-sonnet-5-5' || a.id !== 'm1') return { ok: false, warum: 'der Rest wurde veraendert: ' + z(a) };
      const ohne = '{ "content": [ { "type": "text", "text": "ok" } ],   "usage": {"output_tokens": 1} }';
      if (M.ohneDenkBloecke(ohne) !== ohne) return { ok: false, warum: 'eine Antwort ohne thinking wurde neu geschrieben' };
      const werkzeug = z({ content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', id: 't', name: 'n', input: {} }] });
      const w = JSON.parse(M.ohneDenkBloecke(werkzeug));
      if (w.content.length !== 1 || w.content[0].type !== 'tool_use') return { ok: false, warum: 'ein tool_use-Block ging verloren: ' + z(w.content) };
      const nur = JSON.parse(M.ohneDenkBloecke(z({ stop_reason: 'max_tokens', content: [{ type: 'thinking', thinking: '' }] })));
      if (!Array.isArray(nur.content) || nur.content.length !== 0 || nur.stop_reason !== 'max_tokens') return { ok: false, warum: 'nur thinking: ' + z(nur) };
      for (const roh of ['kein json', '', '{"error":{"type":"x"}}', '[1,2]', 'null']) if (M.ohneDenkBloecke(roh) !== roh) return { ok: false, warum: 'veraendert: ' + roh };
      return { ok: true, info: '[thinking, redacted_thinking, text] → [text] · usage/stop_reason/model bleiben · ohne thinking: dieselbe Zeichenkette · tool_use bleibt' };
    },
  },
  {
    name: 'Ein Modell rufen · nimmt es die Angabe zum Nachdenken nicht an (400), geht derselbe Aufruf EINMAL ohne sie, mit Platz zum Denken und einem Satz; ein anderes 400 wird nicht wiederholt',
    lauf: async (M) => {
      const rufe = []; const saetze = [];
      const sende = (plan) => async (rumpf) => { rufe.push(rumpf); return plan(rumpf, rufe.length); };
      const gut = z({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'T' }] });
      const a = await M.rufeModell('claude-sonnet-5-5', { max_tokens: 900, messages: [] }, sende((r) => (r.thinking
        ? { status: 400, text: '{"type":"error","error":{"type":"invalid_request_error","message":"thinking.type: unknown value between_tools"}}' }
        : { status: 200, text: gut })), (x) => saetze.push(x));
      if (a.status !== 200 || rufe.length !== 2 || rufe[0].thinking === undefined || rufe[1].thinking !== undefined) return { ok: false, warum: 'status ' + a.status + ' · Aufrufe ' + rufe.length + ' · ' + z(rufe.map((r) => r.thinking)) };
      if (rufe[1].max_tokens !== 1215 + 2048 || rufe[1].model !== 'claude-sonnet-5-5') return { ok: false, warum: 'zweiter Aufruf: ' + z({ m: rufe[1].model, t: rufe[1].max_tokens }) };
      if (JSON.parse(a.text).content.length !== 1 || JSON.parse(a.text).content[0].text !== 'T') return { ok: false, warum: 'thinking-Block nicht entfernt: ' + a.text };
      if (saetze.length !== 1 || !/claude-sonnet-5-5/.test(saetze[0])) return { ok: false, warum: 'kein Satz dazu: ' + z(saetze) };
      rufe.length = 0;
      const b = await M.rufeModell('claude-sonnet-5-5', { max_tokens: 900, messages: [] }, sende(() => ({ status: 400, text: '{"error":{"message":"messages: at least one message is required"}}' })), null);
      if (b.status !== 400 || rufe.length !== 1) return { ok: false, warum: 'ein anderes 400 wurde wiederholt: ' + rufe.length + ' Aufrufe' };
      rufe.length = 0;
      const c = await M.rufeModell('claude-sonnet-4-6', { max_tokens: 900, messages: [] }, sende(() => ({ status: 400, text: '{"error":{"message":"thinking is weird"}}' })), null);
      if (rufe.length !== 1) return { ok: false, warum: 'ein Modell OHNE Angabe wurde ein zweites Mal gerufen' };
      rufe.length = 0;
      const fehlerText = '{"type":"error","error":{"type":"overloaded_error"},"content":[{"type":"thinking"}]}';
      const d = await M.rufeModell('claude-sonnet-5', { max_tokens: 10, messages: [] }, sende(() => ({ status: 529, text: fehlerText })), null);
      if (d.text !== fehlerText || d.status !== 529) return { ok: false, warum: 'eine Fehlerantwort wurde umgeschrieben' };
      return { ok: true, info: '400 „thinking…" → 2. Aufruf ohne Angabe mit 3263 Token → 200, Text an erster Stelle · anderes 400: 1 Aufruf · „' + saetze[0].slice(0, 60) + '…"' };
    },
  },
  {
    name: 'Modellfehler · nur „dieses Modell gibt es nicht" lohnt das naechste — Schluessel, Limit, Ueberlast und eine falsche Anfrage nicht',
    lauf: (M) => {
      const ja = [
        [404, '{"type":"error","error":{"type":"not_found_error","message":"model: claude-sonnet-4-5"}}'],
        [404, '{"error":{"message":"The model claude-x does not exist"}}'],
        [400, '{"error":{"type":"invalid_request_error","message":"model claude-sonnet-4-5 is deprecated and no longer available"}}'],
        [400, 'Invalid model: claude-foo'],
      ];
      const nein = [
        [401, '{"error":{"type":"authentication_error","message":"invalid x-api-key"}}'],
        [429, '{"error":{"type":"rate_limit_error","message":"rate limit for model claude-sonnet-5-5"}}'],
        [529, '{"error":{"type":"overloaded_error"}}'],
        [500, 'model exploded'],
        [400, '{"error":{"type":"invalid_request_error","message":"messages: field required"}}'],
        [400, '{"error":{"message":"max_tokens: 9000 > 8192, the maximum for this model"}}'],
        [404, '<html>Not Found</html>'],
        [200, '{"model":"claude-sonnet-5-5","content":[{"text":"the model was not found in the forest"}]}'],
        [404, null],
      ];
      const a = ja.filter((f) => !M.istModellFehler(f[0], f[1])), b = nein.filter((f) => M.istModellFehler(f[0], f[1]));
      if (a.length || b.length) return { ok: false, warum: 'nicht erkannt: ' + z(a) + ' · faelschlich erkannt: ' + z(b) };
      return { ok: true, info: ja.length + ' Modellfehler erkannt, ' + nein.length + ' andere Antworten nicht (auch 429 mit dem Wort „model")' };
    },
  },
  {
    name: 'Rueckfall · das erste antwortet → ein Aufruf; „gibt es nicht" → das naechste, mit einem Satz; 429 faellt NICHT durch; alle weg → die letzte Antwort; ein Netzfehler wird durchgereicht',
    lauf: async (M) => {
      const k = ['m1', 'm2', 'm3'];
      let rufe = []; const saetze = [];
      const ruf = (plan) => async (m) => { rufe.push(m); return plan[m]; };
      const a = await M.mitModellRueckfall(k, ruf({ m1: { status: 200, text: 'A' } }), (s) => saetze.push(s));
      if (a.modell !== 'm1' || a.status !== 200 || rufe.length !== 1 || a.versuche.length || saetze.length) return { ok: false, warum: 'gut: ' + z(a) + ' rufe ' + rufe };
      rufe = [];
      const b = await M.mitModellRueckfall(k, ruf({ m1: MODELL_WEG('m1'), m2: { status: 200, text: 'B' } }), (s) => saetze.push(s));
      if (b.modell !== 'm2' || b.text !== 'B' || rufe.join() !== 'm1,m2' || z(b.versuche) !== z([{ modell: 'm1', status: 404 }]) || saetze.length !== 1 || !/m1.*404.*m2/.test(saetze[0])) return { ok: false, warum: 'Rueckfall: ' + z(b) + ' Saetze ' + z(saetze) };
      rufe = [];
      const c = await M.mitModellRueckfall(k, ruf({ m1: { status: 429, text: '{"error":{"type":"rate_limit_error"}}' } }), null);
      if (c.status !== 429 || c.modell !== 'm1' || rufe.length !== 1) return { ok: false, warum: '429 faellt durch: ' + z(c) + ' rufe ' + rufe };
      rufe = []; saetze.length = 0;
      const d = await M.mitModellRueckfall(k, ruf({ m1: MODELL_WEG('m1'), m2: MODELL_WEG('m2'), m3: MODELL_WEG('m3') }), (s) => saetze.push(s));
      if (d.status !== 404 || rufe.length !== 3 || d.versuche.length !== 3 || d.modell !== 'm3' || !/kein weiteres Modell/.test(saetze[2] || '')) return { ok: false, warum: 'alle weg: ' + z(d) + ' Saetze ' + z(saetze) };
      let geworfen = '';
      try { await M.mitModellRueckfall(k, async () => { throw new Error('Netz weg'); }, null); } catch (e) { geworfen = e.message; }
      if (geworfen !== 'Netz weg') return { ok: false, warum: 'ein Netzfehler wurde verschluckt' };
      return { ok: true, info: '„' + saetze[0] + '"' };
    },
  },
  {
    name: 'anthropicFetch · derselbe Aufruf wie fetch, nur ohne Modell: Kopfzeilen bleiben, ein `model` im Rumpf verliert gegen die Kette, zurueck kommt eine echte Response mit dem Modell, das geantwortet hat',
    lauf: async (M) => {
      const rufe = [];
      const fetchFn = (plan) => async (url, init) => {
        const r = JSON.parse(init.body); rufe.push({ url, modell: r.model, kopf: init.headers, rumpf: r, method: init.method });
        const p = plan(r.model); return new Response(p.text, { status: p.status });
      };
      const init = { method: 'POST', headers: { 'x-api-key': 'sk-1', 'anthropic-version': '2023-06-01' }, body: z({ model: 'claude-sonnet-4-5', max_tokens: 50, messages: [{ role: 'user', content: 'x' }] }) };
      const still = [];
      const a = await M.anthropicFetch('vision', init, { fetchFn: fetchFn((m) => (m === M.MODELL_KETTEN.vision[0] ? MODELL_WEG(m) : USAGE_OK(m))), ueberschreibung: '', sagen: (s) => still.push(s) });
      if (!(a instanceof Response) || !a.ok || a.status !== 200) return { ok: false, warum: 'keine brauchbare Response: ' + a.status };
      const j = await a.json();
      if (a.gsModell !== M.MODELL_KETTEN.vision[1] || j.model !== a.gsModell || z(a.gsVersuche) !== z([{ modell: M.MODELL_KETTEN.vision[0], status: 404 }])) return { ok: false, warum: 'Modell: ' + a.gsModell + ' · ' + z(a.gsVersuche) };
      if (rufe.length !== 2 || rufe[0].modell !== M.MODELL_KETTEN.vision[0] || rufe.some((r) => r.modell === 'claude-sonnet-4-5')) return { ok: false, warum: 'das abgeschaltete Modell aus dem Rumpf wurde gesendet: ' + rufe.map((r) => r.modell) };
      if (rufe[0].url !== 'https://api.anthropic.com/v1/messages' || rufe[0].kopf['x-api-key'] !== 'sk-1' || rufe[0].method !== 'POST' || rufe[0].rumpf.max_tokens !== 50 || rufe[0].rumpf.messages.length !== 1) return { ok: false, warum: 'Anfrage veraendert: ' + z(rufe[0]) };
      if (still.length !== 1) return { ok: false, warum: 'der Rueckfall wurde nicht gesagt: ' + z(still) };
      rufe.length = 0;
      const b = await M.anthropicFetch('schnell', { method: 'POST', headers: {}, body: z({ max_tokens: 5, messages: [] }) }, { fetchFn: fetchFn(USAGE_OK), ueberschreibung: 'claude-haiku-9', sagen: () => {} });
      if (b.gsModell !== 'claude-haiku-9' || rufe.length !== 1) return { ok: false, warum: 'Secret vorn: ' + b.gsModell };
      rufe.length = 0;
      const c = await M.anthropicFetch('schnell', { method: 'POST', headers: {}, body: z({ max_tokens: 5, messages: [] }) }, { fetchFn: fetchFn(() => ({ status: 529, text: '{"error":{"type":"overloaded_error"}}' })), ueberschreibung: '', sagen: () => {} });
      if (c.ok || c.status !== 529 || rufe.length !== 1) return { ok: false, warum: 'Ueberlast: status ' + c.status + ', Aufrufe ' + rufe.length };
      return { ok: true, info: 'Rumpf nannte claude-sonnet-4-5 → gesendet ' + M.MODELL_KETTEN.vision[0] + ' (404) → ' + a.gsModell + ' (200) · 529 bleibt 529 nach einem Aufruf' };
    },
  },
];

// ══ RAND ══════════════════════════════════════════════════════════════════════
const RAND = [
  {
    name: 'ai-proxy · ein alter Client verlangt claude-sonnet-4-5 (endet 30.11.2026) → Anthropic bekommt das erste Modell der Kette, die Antwort geht 1:1 zurueck, ai_usage nennt das Modell, das geantwortet hat',
    lauf: async (M) => {
      const r = await fahre({ benutzt: 3 }, { body: { model: 'claude-sonnet-4-5', max_tokens: 900, system: 'S', messages: [{ role: 'user', content: 'Hallo' }] } });
      const v0 = M.MODELL_KETTEN.vision[0];
      if (r.status !== 200 || r.up.length !== 1 || r.up[0].modell !== v0) return { ok: false, warum: 'status ' + r.status + ' · an Anthropic: ' + modelle(r) };
      if (r.text !== USAGE_OK(v0).text) return { ok: false, warum: 'die Antwort wurde veraendert' };
      if (r.up[0].key !== 'sk-env' || r.up[0].felder !== 'max_tokens,messages,model,system' || r.up[0].max_tokens !== 900) return { ok: false, warum: 'Anfrage: ' + z(r.up[0]) };
      const i = r.ins[0];
      if (r.ins.length !== 1 || i.tabelle !== 'ai_usage' || !i.admin || i.zeile.model !== v0 || i.zeile.user_id !== 'u-1' || i.zeile.tokens_in !== 11 || i.zeile.tokens_out !== 7) return { ok: false, warum: 'ai_usage: ' + z(r.ins) };
      if (!r.log.some((l) => /ersetzt.*abgeschaltet seit 2026-11-30/.test(l))) return { ok: false, warum: 'der Ersatz steht nicht im Log: ' + z(r.log) };
      return { ok: true, info: 'verlangt claude-sonnet-4-5 → gesendet ' + v0 + ' · ai_usage.model = ' + i.zeile.model + ' · Log: „' + r.log[0].replace(/^warn: \[ai-proxy\] /, '').slice(0, 70) + '…"' };
    },
  },
  {
    name: 'ai-proxy · ein freigegebenes Modell bleibt, wie verlangt; ein teureres laesst sich nicht erzwingen; ohne Wunsch gilt die Kette',
    lauf: async (M) => {
      const v = M.MODELL_KETTEN.vision, letzter = v[v.length - 1];
      const a = await fahre({}, { body: { model: letzter, messages: [{ role: 'user', content: 'x' }] } });
      if (a.status !== 200 || modelle(a) !== letzter) return { ok: false, warum: 'freigegeben: ' + modelle(a) };
      const b = await fahre({}, { body: { model: 'claude-opus-5-5', messages: [{ role: 'user', content: 'x' }] } });
      if (b.status !== 200 || modelle(b) !== v[0] || b.ins[0].zeile.model !== v[0]) return { ok: false, warum: 'teureres Modell: ' + modelle(b) };
      const c = await fahre({}, { body: { messages: [{ role: 'user', content: 'x' }] } });
      if (c.status !== 200 || modelle(c) !== v[0] || c.up[0].max_tokens !== 1200) return { ok: false, warum: 'ohne Wunsch: ' + modelle(c) + ' · max_tokens ' + (c.up[0] && c.up[0].max_tokens) };
      const d = await fahre({}, { body: { model: v[0], max_tokens: 999999, messages: [{ role: 'user', content: 'x' }] } });
      if (d.up[0].max_tokens !== 4096) return { ok: false, warum: 'max_tokens nicht gedeckelt: ' + d.up[0].max_tokens };
      return { ok: true, info: letzter + ' bleibt · claude-opus-5-5 → ' + v[0] + ' · max_tokens 999999 → 4096' };
    },
  },
  {
    name: 'ai-proxy · Sonnet 5.5 bekommt seinen Rumpf (Nachdenken aus, 900 → 1215 Token), und was mit einem thinking-Block zurueckkommt, erreicht die App als Text an erster Stelle — auch eine alte, die content[0].text liest',
    lauf: async (M) => {
      const mitDenken = (m) => ({ status: 200, text: z({ id: 'msg_2', model: m, stop_reason: 'end_turn',
        content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'text', text: '{"name":"Bärlauch"}' }], usage: { input_tokens: 20, output_tokens: 30 } }) });
      const a = await fahre({ upstream: mitDenken }, { body: { model: 'claude-sonnet-5-5', max_tokens: 900, system: 'S', messages: [{ role: 'user', content: 'x' }], temperature: 0.2, thinking: { type: 'enabled', budget_tokens: 9999 }, tools: [{ name: 'x' }] } });
      if (a.status !== 200 || a.up.length !== 1) return { ok: false, warum: 'status ' + a.status + ' · Aufrufe ' + a.up.length };
      const u = a.up[0];
      if (u.modell !== 'claude-sonnet-5-5' || u.denken !== 'between_tools' || u.max_tokens !== 1215) return { ok: false, warum: 'Rumpf an Sonnet 5.5: ' + z(u) };
      if (u.felder !== 'max_tokens,messages,model,system,thinking') return { ok: false, warum: 'es ging mehr an Anthropic als die vier Felder plus der Zusatz: ' + u.felder };
      if (!a.daten || !Array.isArray(a.daten.content) || a.daten.content.length !== 1 || a.daten.content[0].text !== '{"name":"Bärlauch"}') return { ok: false, warum: 'bei der App kommt an: ' + z(a.daten && a.daten.content) };
      if (a.ins.length !== 1 || a.ins[0].zeile.model !== 'claude-sonnet-5-5' || a.ins[0].zeile.tokens_out !== 30) return { ok: false, warum: 'ai_usage: ' + z(a.ins) };
      const b = await fahre({}, { body: { model: 'claude-sonnet-5', max_tokens: 4096, messages: [{ role: 'user', content: 'x' }] } });
      if (b.up[0].denken !== 'disabled' || b.up[0].max_tokens !== 5530) return { ok: false, warum: 'Rumpf an Sonnet 5: ' + z(b.up[0]) };
      const c = await fahre({ upstream: (m, n) => (n === 1 ? { status: 400, text: '{"type":"error","error":{"type":"invalid_request_error","message":"thinking.type: Input should be \'adaptive\'"}}' } : mitDenken(m)) },
        { body: { model: 'claude-sonnet-5-5', max_tokens: 900, messages: [{ role: 'user', content: 'x' }] } });
      if (c.status !== 200 || c.up.length !== 2 || c.up[1].denken !== '' || c.up[1].max_tokens !== 3263 || c.up[1].modell !== 'claude-sonnet-5-5') return { ok: false, warum: 'Angabe abgelehnt: status ' + c.status + ' · ' + z(c.up.map((x) => [x.modell, x.denken, x.max_tokens])) };
      if (c.daten.content.length !== 1 || !c.log.some((l) => /KI-Einstellung abgelehnt/.test(l))) return { ok: false, warum: 'zweiter Versuch: content ' + z(c.daten.content) + ' · Log ' + z(c.log) };
      const d = await fahre({}, { body: { model: M.MODELL_KETTEN.vision[0], max_tokens: 900, messages: [{ role: 'user', content: 'x' }] } });
      if (d.up[0].denken !== '' || d.up[0].max_tokens !== 900 || d.up[0].felder !== 'max_tokens,messages,model,system') return { ok: false, warum: 'das bisherige Modell wurde veraendert: ' + z(d.up[0]) };
      return { ok: true, info: '5.5: between_tools, 1215 Token, [thinking, text] → [text] · 5: disabled, 4096 → 5530 · Angabe abgelehnt → 2. Aufruf mit 3263 · ' + M.MODELL_KETTEN.vision[0] + ' unveraendert (900, kein Zusatz)' };
    },
  },
  {
    name: 'ai-proxy · Anthropic kennt das erste Modell nicht mehr → das naechste antwortet, ai_usage nennt DIESES; 429 von Anthropic faellt nicht durch und zaehlt nicht; alle weg → die 404 geht zurueck',
    lauf: async (M) => {
      const v = M.MODELL_KETTEN.vision;
      const a = await fahre({ upstream: (m) => (m === v[0] ? MODELL_WEG(m) : USAGE_OK(m)) }, { body: { model: v[0], messages: [{ role: 'user', content: 'x' }] } });
      if (a.status !== 200 || modelle(a) !== v[0] + ' → ' + v[1] || a.ins.length !== 1 || a.ins[0].zeile.model !== v[1]) return { ok: false, warum: 'Rueckfall: status ' + a.status + ' · ' + modelle(a) + ' · ai_usage ' + z(a.ins.map((i) => i.zeile.model)) };
      if (!a.log.some((l) => /KI-R.ckfall/.test(l))) return { ok: false, warum: 'der Rueckfall steht nicht im Log' };
      const b = await fahre({ upstream: () => ({ status: 429, text: '{"type":"error","error":{"type":"rate_limit_error","message":"model busy"}}' }) });
      if (b.status !== 429 || b.up.length !== 1 || b.ins.length !== 0) return { ok: false, warum: '429: status ' + b.status + ' · Aufrufe ' + b.up.length + ' · ai_usage ' + b.ins.length };
      const c = await fahre({ upstream: (m) => MODELL_WEG(m) }, { body: { model: v[0], messages: [{ role: 'user', content: 'x' }] } });
      if (c.status !== 404 || c.up.length !== v.length || c.ins.length !== 0) return { ok: false, warum: 'alle weg: status ' + c.status + ' · Aufrufe ' + c.up.length };
      const d = await fahre({ upstream: () => ({ wirft: 'connection reset' }) });
      if (d.status !== 502 || d.ins.length !== 0) return { ok: false, warum: 'Netzfehler: status ' + d.status };
      return { ok: true, info: modelle(a) + ' · 429 nach 1 Aufruf, 0 Zeilen · alle weg → 404 nach ' + c.up.length + ' Aufrufen · Netzfehler → 502' };
    },
  },
  {
    name: 'ai-proxy · Stufen: free 15 · basic/plus/premium 200 · pro/lifetime 2000 · Admin 2000 — und am Limit geht NICHTS an Anthropic',
    lauf: async () => {
      const f = async (ent, benutzt) => { const r = await fahre({ ent, benutzt }); return { st: r.status, typ: r.typ, up: r.up.length, lim: r.daten && r.daten.error && r.daten.error.limit }; };
      const tab = [
        [{ tier: 'free', role: 'user' }, 14, 200], [{ tier: 'free', role: 'user' }, 15, 429],
        [{ tier: 'basic', role: 'user' }, 199, 200], [{ tier: 'basic', role: 'user' }, 200, 429],
        [{ tier: 'plus', role: 'user' }, 199, 200], [{ tier: 'premium', role: 'user' }, 15, 200], [{ tier: 'premium', role: 'user' }, 200, 429],
        [{ tier: 'pro', role: 'user' }, 1999, 200], [{ tier: 'lifetime', role: 'user' }, 2000, 429],
        [{ tier: 'free', role: 'admin', is_admin: true }, 500, 200], [{ tier: 'unbekannt', role: 'user' }, 15, 429], [null, 15, 429],
      ];
      for (const [ent, n, erwartet] of tab) {
        const r = await f(ent, n);
        if (r.st !== erwartet) return { ok: false, warum: z(ent) + ' mit ' + n + ' Aufrufen heute: status ' + r.st + ' statt ' + erwartet };
        if (erwartet === 429 && (r.typ !== 'quota_exceeded' || r.up !== 0)) return { ok: false, warum: z(ent) + ': am Limit ging trotzdem ' + r.up + '× etwas an Anthropic (typ ' + r.typ + ')' };
      }
      return { ok: true, info: tab.length + ' Faelle · premium mit 15 Aufrufen → 200 (bis v33.56: Gratis-Limit) · Admin mit 500 → 200' };
    },
  },
  {
    name: 'ai-proxy · gesperrt → 403, Notschalter → 503, zu gross → 413 — jedes Mal OHNE Aufruf bei Anthropic; und die Gegenrichtung: angeschaltet und klein geht durch',
    lauf: async () => {
      const a = await fahre({ ent: { tier: 'pro', role: 'banned' } });
      if (a.status !== 403 || a.typ !== 'account_banned' || a.up.length) return { ok: false, warum: 'gesperrt: status ' + a.status + ' · Aufrufe ' + a.up.length };
      for (const wert of ['false', 'FALSE', ' false ']) {
        const b = await fahre({ an: wert });
        if (b.status !== 503 || b.typ !== 'service_disabled' || b.up.length) return { ok: false, warum: 'Notschalter „' + wert + '": status ' + b.status + ' · Aufrufe ' + b.up.length };
      }
      for (const wert of ['true', null, '1']) {
        const c = await fahre({ an: wert });
        if (c.status !== 200 || c.up.length !== 1) return { ok: false, warum: 'Schalter „' + wert + '" blockiert: status ' + c.status };
      }
      const gross = z({ model: 'x', messages: [{ role: 'user', content: 'A'.repeat(20000001) }] });
      const d = await fahre({}, { body: gross });
      if (d.status !== 413 || d.typ !== 'request_too_large' || d.up.length) return { ok: false, warum: 'zu gross (gelesen): status ' + d.status + ' · Aufrufe ' + d.up.length };
      const e = await fahre({}, { contentLength: 30000000 });
      if (e.status !== 413 || e.up.length) return { ok: false, warum: 'zu gross (Kopfzeile): status ' + e.status };
      const f = await fahre({}, { body: z({ messages: [{ role: 'user', content: 'A'.repeat(4000000) }] }) });
      if (f.status !== 200) return { ok: false, warum: 'vier Megabyte wurden abgewiesen: status ' + f.status };
      return { ok: true, info: 'gesperrt 403 · global_api_enabled=false 503 · 20 MB+ 413 · 4 MB 200' };
    },
  },
  {
    name: 'ai-proxy · die Stufe geht nie an einer Abfrage verloren: scheitert die breite Abfrage der Sicht, gilt die schmale — und der Fehler steht im Log',
    lauf: async () => {
      const a = await fahre({ ent: { tier: 'pro', role: 'user', is_admin: false }, benutzt: 100, entFehlerBreit: true });
      if (a.status !== 200) return { ok: false, warum: 'pro mit 100 Aufrufen fiel auf das Gratis-Limit: status ' + a.status + ' (' + a.typ + ')' };
      if (a.ent.length !== 2 || !/is_admin/.test(a.ent[0]) || a.ent[1] !== 'tier') return { ok: false, warum: 'Abfragen: ' + z(a.ent) };
      if (!a.log.some((l) => /^error: .*v_user_entitlements.*does not exist/.test(l))) return { ok: false, warum: 'der Fehler steht nicht im Log: ' + z(a.log) };
      const b = await fahre({ ent: { tier: 'pro', role: 'user', is_admin: false }, benutzt: 100 });
      if (b.status !== 200 || b.ent.length !== 1) return { ok: false, warum: 'Normalfall: status ' + b.status + ' · Abfragen ' + z(b.ent) };
      return { ok: true, info: 'breit scheitert → schmal: tier pro, 100 Aufrufe → 200 · im Log: „' + a.log.find((l) => /^error/.test(l)).slice(7, 80) + '…"' };
    },
  },
  {
    name: 'ai-proxy · Zugang und Schluessel: ohne Anmeldung 401, der Schluessel kommt aus dem Secret, sonst aus app_settings, sonst 503 — und nie in die Antwort',
    lauf: async () => {
      const a = await fahre({}, { auth: '' });
      const b = await fahre({ user: null });
      if (a.status !== 401 || b.status !== 401 || a.up.length || b.up.length) return { ok: false, warum: 'ohne Anmeldung: ' + a.status + ' / ' + b.status };
      const c = await fahre({ env: { ANTHROPIC_API_KEY: null }, keyInDb: 'sk-db' });
      if (c.status !== 200 || c.up[0].key !== 'sk-db') return { ok: false, warum: 'Schluessel aus app_settings: status ' + c.status + ' · key ' + (c.up[0] && c.up[0].key) };
      const d = await fahre({ env: { ANTHROPIC_API_KEY: null } });
      if (d.status !== 503 || d.up.length) return { ok: false, warum: 'ohne Schluessel: status ' + d.status };
      const e = await fahre({ keyInDb: 'sk-db' });
      if (e.up[0].key !== 'sk-env') return { ok: false, warum: 'das Secret gewinnt nicht: ' + e.up[0].key };
      if ([c, e].some((r) => /sk-db|sk-env/.test(r.text))) return { ok: false, warum: 'der Schluessel steht in der Antwort' };
      const g = await fahre({}, { body: '{kaputt' });
      const h = await fahre({}, { body: { model: 'x', messages: [] } });
      if (g.status !== 400 || h.status !== 400 || g.up.length || h.up.length) return { ok: false, warum: 'kaputte Anfrage: ' + g.status + ' / ' + h.status };
      const i = await fahre({}, { origin: 'https://boese.example' });
      const j = await fahre({}, { origin: 'https://abc123.greenscan-app.pages.dev' });
      if (i.cors !== 'https://green-scan.ch' || j.cors !== 'https://abc123.greenscan-app.pages.dev') return { ok: false, warum: 'CORS: ' + i.cors + ' / ' + j.cors };
      return { ok: true, info: '401 · Secret vor app_settings · ohne Schluessel 503 · kaputtes JSON 400 · fremde Herkunft bekommt green-scan.ch' };
    },
  },
];

// ══ QUELLTEXT ═════════════════════════════════════════════════════════════════
const QUELLTEXT = [
  {
    name: 'Kein Modellname in einer Edge-Function · als Zeichenkette steht er nur in _shared/modelle.mjs (Kommentare zaehlen nicht) — und die Suche findet, was sie finden soll',
    lauf: () => {
      const probe = 'const a = "claude-sonnet-4-5"; // claude-opus-4-1 im Kommentar\n/* claude-3-haiku */ const u = "https://x.y/claude-key-row"; const b = `m=${"claude-haiku-4-5-20251001"}`;';
      const gefunden = modellNamenIn(probe);
      if (gefunden.join() !== 'claude-sonnet-4-5,claude-haiku-4-5-20251001') return { ok: false, warum: 'die Suche selbst stimmt nicht: ' + z(gefunden) };
      const dateien = functionDateien();
      const funde = [];
      for (const d of dateien) for (const m of modellNamenIn(fs.readFileSync(d, 'utf8'))) funde.push(path.basename(path.dirname(d)) + ': ' + m);
      if (funde.length) return { ok: false, warum: funde.length + ' Modellnamen ausserhalb des Moduls — ' + funde.slice(0, 6).join(' · ') };
      return { ok: true, info: dateien.length + ' Edge-Functions gelesen, 0 Modellnamen als Zeichenkette' };
    },
  },
  {
    name: 'Wer Anthropic ruft, nimmt das Modul · jede Edge-Function mit einem Aufruf von /v1/messages importiert _shared/modelle.mjs und benutzt den Rueckfall',
    lauf: () => {
      const ohne = [], mit = [];
      for (const d of functionDateien()) {
        const s = ohneKommentare(fs.readFileSync(d, 'utf8'));
        const ruft = /api\.anthropic\.com\/v1\/messages/.test(s) || /\banthropicFetch\s*\(/.test(s);
        if (!ruft) continue;
        const name = path.basename(path.dirname(d));
        const importiert = /from\s*["']\.\.\/_shared\/modelle\.mjs["']/.test(s);
        const rueckfall = /\banthropicFetch\s*\(/.test(s) || /\bmitModellRueckfall\s*\(/.test(s);
        (importiert && rueckfall ? mit : ohne).push(name);
      }
      if (ohne.length) return { ok: false, warum: 'ohne Modul oder ohne Rueckfall: ' + ohne.join(', ') };
      if (mit.length < 9) return { ok: false, warum: 'nur ' + mit.length + ' Functions erkannt (erwartet mindestens 9) — die Suche sieht etwas nicht: ' + mit.join(', ') };
      return { ok: true, info: mit.length + ' Functions: ' + mit.join(', ') };
    },
  },
  {
    name: 'App und Server meinen dieselben Modelle · die Kette der App (_gsClaudeFallbacks) nennt nichts Abgeschaltetes, und der Proxy nimmt jeden ihrer Namen, wie er ist',
    lauf: (M) => {
      const html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
      const m = html.match(/window\._gsClaudeFallbacks\s*=\s*\[([^\]]*)\]/);
      if (!m) return { ok: false, warum: 'window._gsClaudeFallbacks nicht gefunden' };
      const app = (m[1].match(/claude-[a-z0-9.-]+/g) || []);
      if (app.length < 2) return { ok: false, warum: 'die Kette der App hat weniger als zwei Modelle: ' + z(app) };
      const tot = app.filter((n) => Object.prototype.hasOwnProperty.call(M.MODELLE_ABGESCHALTET, n));
      if (tot.length) return { ok: false, warum: 'die App nennt Abgeschaltetes: ' + tot.map((n) => n + ' (' + M.MODELLE_ABGESCHALTET[n] + ')').join(', ') };
      const ersetzt = app.filter((n) => M.modellFuerAnfrage(n, 'vision', '', '').ersetzt);
      if (ersetzt.length) return { ok: false, warum: 'der Proxy wuerde ersetzen, was die App verlangt: ' + ersetzt.join(', ') };
      if (app[0] !== M.MODELL_KETTEN.vision[0]) return { ok: false, warum: 'App beginnt mit ' + app[0] + ', Server mit ' + M.MODELL_KETTEN.vision[0] };
      // Der Rest der Seite: ein abgeschalteter Name darf nur noch in Kommentaren und im Changelog stehen.
      const a = html.indexOf('window.GS_RELEASES = ['), b = html.indexOf('\n];', a);
      const rest = ohneKommentare(a >= 0 && b > a ? html.slice(0, a) + html.slice(b) : html);
      const alt = (rest.match(MODELLNAME) || []).filter((n) => Object.prototype.hasOwnProperty.call(M.MODELLE_ABGESCHALTET, n));
      if (alt.length) return { ok: false, warum: 'index.html nennt ausserhalb von Kommentaren und Changelog: ' + alt.filter((n, i) => alt.indexOf(n) === i).join(', ') };
      return { ok: true, info: 'App: ' + app.join(' → ') + ' · Server (vision): ' + M.MODELL_KETTEN.vision.join(' → ') };
    },
  },
];

(async () => {
  console.log('\n=== modell_check — antwortet die KI noch, wenn Anthropic ein Modell abschaltet?');
  let kaputt = 0, geprueft = 0, nichtPruefbar = 0;
  const fahreListe = async (titel, liste, arg) => {
    console.log('  ' + titel);
    for (const f of liste) {
      let r;
      try { r = await f.lauf(arg); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + String(e && e.message).split('\n')[0] }; }
      geprueft++;
      if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
      else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
    }
  };
  let M = null;
  try { M = await import(pathToFileURL(MODUL).href); }
  catch (e) { kaputt++; console.log('  !!   das Modul laesst sich nicht laden: ' + String(e && e.message).split('\n')[0]); }
  if (M) {
    await fahreListe('RECHNUNG · supabase/functions/_shared/modelle.mjs, ausgefuehrt in Node', RECHNUNG, M);
    const lader = await proxyLaden().catch((e) => ({ fehler: String(e && e.message).split('\n')[0] }));
    if (lader.ok) {
      await fahreListe('RAND · der echte Handler von ' + path.relative(WURZEL, PROXY) + ', Deno · Supabase · Anthropic gestellt', RAND, M);
    } else if (lader.fehler) {
      kaputt++; console.log('  RAND\n  !!   ai-proxy laesst sich nicht laden: ' + lader.fehler);
    } else {
      nichtPruefbar = RAND.length;
      console.log('  RAND\n  ??   nicht pruefbar: ' + lader.grund);
    }
    await fahreListe('QUELLTEXT · Edge-Functions und index.html', QUELLTEXT, M);
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + geprueft + ' · davon kaputt: ' + kaputt + (nichtPruefbar ? ' · nicht pruefbar: ' + nichtPruefbar : ''));
  console.log('  Grenze: ob Anthropic die Namen der Kette HEUTE annimmt, ist von hier nicht messbar (kein Netz');
  console.log('  dorthin), und ob die ausgelieferte Function der im Repo entspricht, auch nicht. Dafuer:');
  console.log('  select model, count(*) from ai_usage group by 1 — nach einem echten Scan.');
  process.exitCode = kaputt ? 1 : (nichtPruefbar ? 2 : 0);
})();

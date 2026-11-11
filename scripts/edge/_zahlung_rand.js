// Der Rand der Zahlungs-Functions, WIRKLICH ausgefuehrt (v33.59).
//
// Deno gibt es hier nicht — Node 22 kann TypeScript aber selbst lesen (die
// Typen werden gestrichen). Ein Lade-Haken lenkt die Deno-Importe um
// (npm:stripe, esm.sh/stripe, jsr:@supabase/supabase-js, esm.sh/@supabase,
// deno.land/std/http/server.ts, edge-runtime.d.ts) auf zwei gestellte Module
// in diesem Verzeichnis; `Deno.serve` faengt den Handler. Danach laeuft die
// ECHTE index.ts mit echten Request-Objekten gegen eine Tabellenablage im
// Arbeitsspeicher. Jeder Lauf laedt die Datei frisch (`?lauf=n`), damit
// Modul-Zustand (z.B. der gemerkte Webhook-Schluessel) nicht hinueberwandert.
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const mod = require('node:module');

const HIER = __dirname;
const FN = path.resolve(HIER, '..', '..', 'supabase', 'functions');
const STRIPE = pathToFileURL(path.join(HIER, '_zahlung_stripe.mjs')).href;
const SUPA = pathToFileURL(path.join(HIER, '_zahlung_supabase.mjs')).href;

let registriert = false;
function haken() {
  if (registriert) return;
  registriert = true;
  const src = `
    export async function resolve(spec, ctx, next) {
      if (/^npm:stripe@|^https:\\/\\/esm\\.sh\\/stripe@/.test(spec)) return { url: ${JSON.stringify(STRIPE)}, shortCircuit: true };
      if (/^jsr:@supabase\\/supabase-js|^https:\\/\\/esm\\.sh\\/@supabase\\/supabase-js/.test(spec)) return { url: ${JSON.stringify(SUPA)}, shortCircuit: true };
      if (/edge-runtime\\.d\\.ts$/.test(spec)) return { url: 'data:text/javascript,export{}', shortCircuit: true };
      if (/^https:\\/\\/deno\\.land\\/std@[^/]+\\/http\\/server\\.ts$/.test(spec)) return { url: 'data:text/javascript,export function serve(h){ globalThis.Deno.serve(h); }', shortCircuit: true };
      return next(spec, ctx);
    }`;
  mod.register('data:text/javascript,' + encodeURIComponent(src));
}

let lauf = 0;
// szenario: { env, tabellen, schluessel, nutzer, fehler, rpc, stripeAntwort }
// Rueckgabe: { aufruf(req) -> {status, body, headers}, z } — z ist der Zustand (ops, stripe, tabellen).
async function lade(fnName, szenario) {
  haken();
  const z = {
    env: Object.assign({ SUPABASE_URL: 'https://projekt.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x' }, szenario.env || {}),
    tabellen: JSON.parse(JSON.stringify(szenario.tabellen || {})),
    schluessel: Object.assign({ launch_offer_usage: ['user_id'], expert_verifications: ['post_id', 'expert_id'] }, szenario.schluessel || {}),
    nutzer: szenario.nutzer || {},
    fehler: szenario.fehler || {},
    rpc: szenario.rpc || {},
    stripeAntwort: szenario.stripeAntwort || {},
    beziehungen: szenario.beziehungen || [],   // zusaetzliche Fremdschluessel (Gegenprobe), sonst nur die live vorhandenen
    ops: [], stripe: [], log: [], handler: null,
  };
  for (const k of Object.keys(z.env)) if (z.env[k] === null) delete z.env[k];
  globalThis.__gsZ = z;
  globalThis.Deno = { serve: (a, b) => { z.handler = typeof a === 'function' ? a : b; }, env: { get: (k) => (k in z.env ? z.env[k] : undefined) } };
  const url = pathToFileURL(path.join(FN, fnName, 'index.ts')).href + '?lauf=' + (++lauf);
  const alt = { log: console.log, warn: console.warn, error: console.error };
  console.log = (...a) => z.log.push(['log', a.join(' ')]);
  console.warn = (...a) => z.log.push(['warn', a.join(' ')]);
  console.error = (...a) => z.log.push(['error', a.join(' ')]);
  try { await import(url); } finally { Object.assign(console, alt); }
  if (!z.handler) throw new Error(fnName + ': kein Deno.serve-Handler');
  async function aufruf(opts) {
    globalThis.__gsZ = z;
    const o = opts || {};
    const h = Object.assign({ 'content-type': 'application/json' }, o.headers || {});
    const req = new Request('https://projekt.supabase.co/functions/v1/' + fnName, {
      method: o.method || 'POST', headers: h,
      body: (o.method || 'POST') === 'GET' || o.method === 'OPTIONS' ? undefined : (typeof o.body === 'string' ? o.body : JSON.stringify(o.body || {})),
    });
    console.log = (...a) => z.log.push(['log', a.join(' ')]);
    console.warn = (...a) => z.log.push(['warn', a.join(' ')]);
    console.error = (...a) => z.log.push(['error', a.join(' ')]);
    let res;
    try { res = await z.handler(req); } finally { Object.assign(console, alt); }
    const text = await res.text();
    let body = text; try { body = JSON.parse(text); } catch (_) {}
    return { status: res.status, body, text, headers: res.headers };
  }
  return { aufruf, z };
}

module.exports = { lade };

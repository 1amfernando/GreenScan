#!/usr/bin/env node
// stripe_check.js — kommt an, was bezahlt wurde — und nur das?
//
//   node scripts/stripe_check.js
//   GS_STRIPE_CHECK_WEBHOOK=<alt/index.ts> node scripts/stripe_check.js     # Gegenprobe am Rand
//   (ebenso GS_STRIPE_CHECK_CHECKOUT, GS_STRIPE_CHECK_PORTAL, GS_STRIPE_CHECK_MODUL, GS_STRIPE_CHECK_APP für index.html)
//   GS_STRIPE_PAKET=<pfad/zu/node_modules/stripe> node scripts/stripe_check.js   # Fremdmassstab: Stripes eigene Bibliothek
//
// Anlass (11.11.2026, gemessen): `stripe_webhook_events` hat 0 Zeilen — der Zahlungsweg ist
// nie Ende-zu-Ende gelaufen, und es gab keinen Prüfstand dafür. Beim ersten Lauf gegen den
// Stand von v33.58 waren 28 von 40 Fällen rot, darunter:
//   • stripe-checkout schickte `automatic_payment_methods` an Checkout (den Parameter gibt es
//     dort nicht) — jeder Kauf endete mit 500;
//   • stripe-webhook hängte `.catch()` an supabase-js-Bauer, die kein `catch` haben — fünf
//     Ereignisarten endeten immer mit 500;
//   • kein Schreibaufruf las `error` — Stripe bekam „ok", auch wenn die Datenbank Nein sagte;
//   • checkout und portal lasen `stripe_customers` — die Tabelle gibt es nicht.
//
// Vier Teile (die ersten drei wie bei modell_check):
//   RECHNUNG  supabase/functions/_shared/stripe_regeln.mjs läuft in Node: Signatur (gegen
//             node:crypto als eigenen Massstab), Abo-Zeile in beiden API-Formen, Preis und
//             Probezeit, Checkout-Parameter, Rückkehr-Adressen, Portal-Ziel, Erstattung.
//   RAND      die ECHTEN Handler von stripe-webhook, stripe-checkout und stripe-portal werden
//             ausgeführt: Typen entfernt (node:module stripTypeScriptTypes), Deno, supabase-js
//             und die Stripe-Seite gestellt. Die Datenbank des Prüfstands trägt die Spalten,
//             die am 11.11.2026 live gemessen wurden (information_schema) — eine Spalte, die
//             es nicht gibt, wird abgelehnt wie von PostgREST; ein Bauer hat `then`, aber kein
//             `catch` (gemessen an @supabase/postgrest-js 2.119.0); Stripe lehnt einen
//             unbekannten Parameter ab (Liste aus stripe@17.7.0).
//   SQL       ein lokales Postgres (GS_PG_URL, sonst scripts/_pg_local.sh): die gestellte
//             Funktion launch_offer_available antwortet wie die aus der Migration; die Migration
//             20261111_launch_offer_usage_nur_server.sql wird gegen den Live-Stand nachgespielt.
//             Ohne Postgres: „nicht prüfbar" (Exit 2), nie grün.
//   QUELLTEXT kein `.catch()` an einer supabase-js-Kette in irgendeiner Edge-Function; jeder
//             Datenbank-Aufruf der drei Functions geht durch `dbMuss`; die Ereignisliste und
//             der Handler meinen dieselben Ereignisse; was der Abo-Bildschirm verspricht.
//
// Was hier NICHT geprüft wird, und das steht auch im Bericht: ob Stripe die Anfragen HEUTE
// annimmt (kein Netz dorthin), ob die ausgelieferten Functions denen im Repo entsprechen, und
// die Sicht `v_user_entitlements` samt Trigger — beide sind hier in JavaScript NACHGEBAUT
// (aus den Migrationen 20260504 und v29_16) und nur über den Quelltext an sie gebunden.
//
// Und die Lehre aus dem Bau (11.11.2026): der erste Stand dieses Prüfstands war 40 von 40 grün —
// gegen eine Datenbank, die er sich selbst ausgedacht hatte. Gegen die echte gehalten (nur lesend:
// information_schema, pg_constraint, pg_get_functiondef) waren drei Wege kaputt, die hier grün
// waren: `launch_offer_available` antwortet mit einem Objekt und rechnet mit auth.uid() (gestellt
// war `true` — der neue Checkout hätte JEDEN Lifetime-Kauf abgelehnt); `price_id` ist ein
// Fremdschlüssel (ein fremder Preis → 500 bei jeder Wiederholung); `user_id` verweist auf
// auth.users (ein gelöschtes Konto → ebenso). EINE NACHBILDUNG IST NUR SO VIEL WERT WIE DIE MESSUNG,
// AUS DER SIE STAMMT — darum tragen SPALTEN, EINDEUTIG, FREMD, CHECK und die gestellte Funktion
// jetzt ihr Messdatum, und der Fall „Die Naht" lehnt jede Tabelle ohne gemessene Spalten ab.
'use strict';
const path = require('path');
const fs = require('fs');
const os = require('os');
const nodeCrypto = require('node:crypto');
const { pathToFileURL } = require('url');
const { spawnSync } = require('child_process');
// Die SQL-Hälfte (dieselbe Bauform wie naht_check und backup_check): ein lokales Postgres,
// ohne es „nicht prüfbar" (Exit 2) statt grün.
const PG_URL = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const PG_DB = 'gs_stripe_check';
function psql(url, args) { return spawnSync('psql', [url, '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', ...args], { encoding: 'utf8' }); }
function pgLetzte(r) {
  const zl = String((r.stderr || r.stdout || '')).trim().split('\n').map((x) => x.trim()).filter(Boolean);
  return (zl.find((x) => /^(ERROR|FEHLER|DETAIL|HINT)/i.test(x)) || zl[0] || '').slice(0, 200);
}
function pgSql(url, q) { const r = psql(url, ['-c', q]); if (r.status !== 0) throw new Error(pgLetzte(r)); return (r.stdout || '').trim(); }
function pgDa() { return psql(PG_URL, ['-c', 'select 1']).status === 0; }

const WURZEL = path.resolve(__dirname, '..');
const FUNKTIONEN = path.join(WURZEL, 'supabase', 'functions');
const von = (envName, vorgabe) => (process.env[envName] ? path.resolve(process.env[envName]) : vorgabe);
const MODUL = von('GS_STRIPE_CHECK_MODUL', path.join(FUNKTIONEN, '_shared', 'stripe_regeln.mjs'));
const DATEI = {
  webhook: von('GS_STRIPE_CHECK_WEBHOOK', path.join(FUNKTIONEN, 'stripe-webhook', 'index.ts')),
  checkout: von('GS_STRIPE_CHECK_CHECKOUT', path.join(FUNKTIONEN, 'stripe-checkout', 'index.ts')),
  portal: von('GS_STRIPE_CHECK_PORTAL', path.join(FUNKTIONEN, 'stripe-portal', 'index.ts')),
};
const APP = von('GS_STRIPE_CHECK_APP', path.join(WURZEL, 'index.html'));   // für Gegenproben an einer Kopie
const z = (o) => JSON.stringify(o);
const klon = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

// ── Quelltext ohne Kommentare — führt Zeichenketten mit (dieselbe Funktion wie in modell_check).
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
// Für die drei Zahlungs-Functions gilt die Datei, die auch der Rand fährt — sonst sähe eine
// Gegenprobe (GS_STRIPE_CHECK_…) im Quelltext-Fall das Original und bliebe dort grün.
function functionDateien() {
  const eigene = { 'stripe-webhook': DATEI.webhook, 'stripe-checkout': DATEI.checkout, 'stripe-portal': DATEI.portal };
  return fs.readdirSync(FUNKTIONEN, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== '_shared')
    .map((d) => ({ name: d.name, pfad: eigene[d.name] || path.join(FUNKTIONEN, d.name, 'index.ts') }))
    .filter((f) => fs.existsSync(f.pfad));
}
// Jede supabase-js-Kette (`.from(…)…` / `.rpc(…)…`) bis zum Ende ihrer Anweisung.
function ketten(src) {
  const s = ohneKommentare(src), aus = [], re = /\.(from|rpc)\(/g;
  let m;
  while ((m = re.exec(s))) {
    let tiefe = 0, ende = s.length, inStr = '';
    for (let j = m.index; j < s.length; j++) {
      const c = s[j];
      if (inStr) { if (c === '\\') j++; else if (c === inStr) inStr = ''; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '(' || c === '{' || c === '[') tiefe++;
      else if (c === ')' || c === '}' || c === ']') { tiefe--; if (tiefe < 0) { ende = j; break; } }
      else if (c === ';' && tiefe === 0) { ende = j; break; }
    }
    aus.push({ pos: m.index, text: s.slice(m.index, ende), davor: s.slice(Math.max(0, m.index - 60), m.index) });
  }
  return aus;
}
function aufTiefeNull(text, nadel) {
  let tiefe = 0, inStr = '';
  for (let j = 0; j < text.length; j++) {
    const c = text[j];
    if (inStr) { if (c === '\\') j++; else if (c === inStr) inStr = ''; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '(' || c === '{' || c === '[') tiefe++;
    else if (c === ')' || c === '}' || c === ']') tiefe--;
    else if (tiefe === 0 && text.startsWith(nadel, j)) return true;
  }
  return false;
}

// ══ Die gestellte Welt ════════════════════════════════════════════════════════
const U1 = '11111111-1111-4111-8111-111111111111';   // Anna
const U2 = '22222222-2222-4222-8222-222222222222';   // Ben
// Die zwei gestellten Konten. Ihre Adressen enden auf die reservierte Endung `.invalid`
// (RFC 2606) — es gibt sie nicht und kann sie nie geben; kein Fall hängt an ihrem Wert.
const TOKEN = { 'jwt-anna': { id: U1, email: 'anna@pruefstand.invalid' }, 'jwt-ben': { id: U2, email: 'ben@pruefstand.invalid' } };
// Bewusst ohne die Vorsilben echter Schlüssel — das Repo ist öffentlich.
const GEHEIMNIS = 'geheimnis-des-pruefstands-aus-der-umgebung';
const GEHEIMNIS_DB = 'geheimnis-des-pruefstands-aus-app-settings';
const ENV_VORGABE = { SUPABASE_URL: 'https://stub.supabase.co', SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service', STRIPE_SECRET_KEY: 'stripe-schluessel-des-pruefstands', STRIPE_WEBHOOK_SECRET: GEHEIMNIS };
const TAG = 86400;

// Spalten, live gemessen am 11.11.2026 (information_schema.columns, nur lesend) — für JEDE
// Tabelle, die eine der drei Functions anfasst. Eine Tabelle ohne Eintrag lehnt der Prüfstand ab
// (Fall „Die Naht"): sonst prüfte er dort gar nichts und meldete trotzdem grün.
const SPALTEN = {
  stripe_webhook_events: ['id', 'type', 'payload', 'processed', 'error', 'created_at', 'processed_at'],
  stripe_subscriptions: ['id', 'user_id', 'customer_id', 'status', 'price_id', 'current_period_end', 'cancel_at_period_end', 'metadata', 'created_at', 'updated_at', 'is_lifetime', 'tier', 'trial_end', 'canceled_at', 'ended_at', 'current_period_start', 'stripe_customer_id'],
  stripe_prices: ['id', 'product_id', 'lookup_key', 'currency', 'unit_amount', 'recurring', 'active', 'metadata', 'updated_at'],
  stripe_products: ['id', 'name', 'description', 'active', 'tier', 'metadata', 'created_at', 'updated_at'],
  launch_offer_usage: ['user_id', 'subscription_id', 'claimed_at'],
  notifications: ['id', 'user_id', 'kind', 'title', 'body', 'link', 'dedup_key', 'is_read', 'read_at', 'created_at'],
  audit_log: ['id', 'actor_id', 'action', 'target_type', 'target_id', 'diff', 'ip_hash', 'created_at'],
  expert_verifications: ['id', 'post_id', 'expert_id', 'status', 'verification_text', 'fee_paid_chf', 'fee_paid_at', 'stripe_payment_intent_id', 'created_at', 'updated_at'],
  marketplace_sellers: ['user_id', 'stripe_account_id', 'status', 'charges_enabled', 'payouts_enabled', 'details_submitted', 'requirements', 'country', 'default_currency', 'business_type', 'display_name', 'created_at', 'updated_at'],
  app_settings: ['key', 'value', 'description', 'updated_at', 'updated_by'],
  profiles: ['id', 'email', 'display_name', 'avatar_emoji', 'bio', 'xp', 'level', 'login_streak', 'longest_streak', 'total_logins', 'last_login', 'stats', 'milestones', 'tier', 'is_expert', 'is_admin', 'created_at', 'updated_at', 'role', 'role_assigned_at', 'role_assigned_by', 'role_note', 'scan_count', 'last_scan_at', 'is_lifetime', 'showcase_achievements', 'opt_in_achievement_feed', 'quiz_elo', 'battles_won', 'battles_lost', 'battles_tied', 'avatar_url', 'profile_visibility', 'show_finds_public', 'show_plants_count', 'show_achievements', 'show_marketplace', 'opt_in_feed', 'region', 'bio_emoji', 'comp_tier', 'comp_expires_at', 'comp_granted_by', 'comp_granted_at'],
};
// Was eine Spaltenliste NICHT sagt — live gemessen am 11.11.2026 (pg_constraint, pg_indexes, nur
// lesend). Der erste Stand dieses Prüfstands kannte davon nichts und war 40 von 40 grün, während
// drei Wege an der echten Datenbank gescheitert wären: ein Abo mit einem Preis, den stripe_prices
// nicht kennt (Fremdschlüssel → 500 bei jeder Wiederholung), ein spätes Ereignis für ein gelöschtes
// Konto (ebenso) und eine Experten-Gebühr mit einer Beitrags-Id, die keine UUID ist.
const SCHLUESSEL = { stripe_webhook_events: ['id'], stripe_subscriptions: ['id'], stripe_prices: ['id'], stripe_products: ['id'], launch_offer_usage: ['user_id'], profiles: ['id'], marketplace_sellers: ['user_id'], app_settings: ['key'], notifications: ['id'], audit_log: ['id'], expert_verifications: ['id'] };
// Worauf ON CONFLICT zeigen darf: nur auf eine VOLLE eindeutige Einschränkung (ein Teil-Index zählt nicht → 42P10).
const EINDEUTIG = {
  stripe_webhook_events: [['id']], stripe_subscriptions: [['id']], stripe_prices: [['id'], ['lookup_key']], stripe_products: [['id']],
  launch_offer_usage: [['user_id']], notifications: [['id'], ['dedup_key']], marketplace_sellers: [['user_id'], ['stripe_account_id']],
  expert_verifications: [['id'], ['post_id', 'expert_id']], app_settings: [['key']], profiles: [['id']], audit_log: [['id']],
};
// NOT NULL ohne Vorgabewert.
const PFLICHT = { stripe_webhook_events: ['id', 'type', 'payload'], stripe_subscriptions: ['id', 'user_id'], notifications: ['user_id', 'title'], audit_log: ['action'], launch_offer_usage: ['user_id'], expert_verifications: ['post_id', 'expert_id'], marketplace_sellers: ['user_id'] };
// Fremdschlüssel: 'nutzer' = auth.users (ON DELETE CASCADE), sonst die Tabelle, deren `id` gemeint ist.
const FREMD = {
  stripe_subscriptions: { user_id: 'nutzer', price_id: 'stripe_prices' },
  notifications: { user_id: 'nutzer' },
  launch_offer_usage: { user_id: 'nutzer' },
  marketplace_sellers: { user_id: 'nutzer' },
  expert_verifications: { expert_id: 'nutzer', post_id: 'social_posts' },
};
const FREMD_NAME = { 'stripe_subscriptions.user_id': 'stripe_subscriptions_user_id_fkey1', 'stripe_subscriptions.price_id': 'stripe_subscriptions_price_id_fkey1' };
const CHECK = {
  marketplace_sellers: { status: ['pending', 'active', 'restricted', 'disabled'] },
  expert_verifications: { status: ['pending', 'verified', 'rejected', 'expired'] },
  profiles: { tier: ['free', 'pro', 'lifetime'] },
};
const UUID_SPALTEN = { stripe_subscriptions: ['user_id'], notifications: ['id', 'user_id'], launch_offer_usage: ['user_id'], expert_verifications: ['id', 'post_id', 'expert_id'], marketplace_sellers: ['user_id'], profiles: ['id'], audit_log: ['actor_id'] };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const U3 = '33333333-3333-4333-8333-333333333333';   // Cleo — hat ihr Konto gelöscht: es gibt sie in auth.users nicht mehr
const POST1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', POST2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
// Was die festgenagelte API-Version an „Create a Checkout Session" annimmt (stripe@17.7.0,
// types/Checkout/SessionsResource.d.ts, 41 Felder) — alles andere lehnt Stripe mit 400 ab.
const STRIPE_CHECKOUT_PARAMETER = ['adaptive_pricing', 'after_expiration', 'allow_promotion_codes', 'automatic_tax', 'billing_address_collection', 'cancel_url', 'client_reference_id', 'consent_collection', 'currency', 'custom_fields', 'custom_text', 'customer', 'customer_creation', 'customer_email', 'customer_update', 'discounts', 'expand', 'expires_at', 'invoice_creation', 'line_items', 'locale', 'metadata', 'mode', 'payment_intent_data', 'payment_method_collection', 'payment_method_configuration', 'payment_method_data', 'payment_method_options', 'payment_method_types', 'phone_number_collection', 'redirect_on_completion', 'return_url', 'saved_payment_method_options', 'setup_intent_data', 'shipping_address_collection', 'shipping_options', 'submit_type', 'subscription_data', 'success_url', 'tax_id_collection', 'ui_mode'];
const STRIPE_PORTAL_PARAMETER = ['configuration', 'customer', 'expand', 'flow_data', 'locale', 'on_behalf_of', 'return_url'];

let W = null;   // die Welt des laufenden Falls
function neueWelt(o) {
  const a = o || {};
  const jetzt = Math.floor(Date.now() / 1000);
  W = {
    jetzt,
    env: Object.assign({}, ENV_VORGABE, a.env || {}),
    log: [],
    db: {
      fehlt: new Set(['stripe_customers']),           // live gemessen: die Tabelle gibt es nicht
      nein: [],                                       // gestellte Ablehnungen: { tabelle, op? }
      prot: [],
      trigger: a.trigger !== false,                   // fn_sync_lifetime_to_profile, nachgebaut (Migration 20260504)
      nutzer: new Set([U1, U2]),                      // auth.users — worauf jedes user_id verweist
      // 'live' = die Funktion, wie sie am 11.11.2026 in der Datenbank steht (pg_get_functiondef):
      // sie antwortet mit einem OBJEKT und rechnet mit auth.uid(). Der erste Stand dieses Prüfstands
      // stellte hier `true` hin — eine Antwort, die es nie gab; daran war ein Checkout grün, der
      // live jeden Lifetime-Kauf abgelehnt hätte.
      rpc: { launch_offer_available: 'live' },
      t: {
        app_settings: [{ key: 'stripe_webhook_secret', value: GEHEIMNIS_DB }],
        profiles: [
          { id: U1, tier: 'free', is_lifetime: false, is_admin: false, role: 'user', comp_tier: null, comp_expires_at: null, is_expert: false },
          { id: U2, tier: 'free', is_lifetime: false, is_admin: false, role: 'user', comp_tier: null, comp_expires_at: null, is_expert: true },
        ],
        stripe_products: [
          { id: 'prod_pro', name: 'GreenScan Pro', tier: 'pro', active: true },
          { id: 'prod_leben', name: 'GreenScan Pro Lifetime', tier: 'pro', active: true },
          { id: 'prod_plus', name: 'GreenScan Plus', tier: 'plus', active: false },
        ],
        stripe_prices: [
          { id: 'price_monat', product_id: 'prod_pro', lookup_key: 'pro_monthly', currency: 'chf', unit_amount: 790, recurring: { interval: 'month' }, active: true, metadata: { lookup_key: 'pro_monthly', interval: 'month', is_launch_offer: false, launch_offer_cap: null } },
          { id: 'price_jahr', product_id: 'prod_pro', lookup_key: 'pro_yearly', currency: 'chf', unit_amount: 7900, recurring: { interval: 'year' }, active: true, metadata: { lookup_key: 'pro_yearly', interval: 'year', is_launch_offer: false, launch_offer_cap: null } },
          { id: 'price_leben', product_id: 'prod_leben', lookup_key: 'pro_lifetime', currency: 'chf', unit_amount: 4560, recurring: null, active: true, metadata: { lookup_key: 'pro_lifetime', interval: 'lifetime', is_launch_offer: true, launch_offer_cap: 100 } },
          { id: 'price_alt', product_id: 'prod_plus', lookup_key: 'plus_monthly', currency: 'chf', unit_amount: 390, recurring: { interval: 'month' }, active: false, metadata: { lookup_key: 'plus_monthly', interval: 'month' } },
        ],
        stripe_subscriptions: [], stripe_webhook_events: [], notifications: [], audit_log: [], launch_offer_usage: [],
        expert_verifications: [], marketplace_sellers: [], social_posts: [{ id: POST1 }],
      },
    },
    stripe: {
      rufe: [], abos: {}, kunden: {}, posten: {}, n: 0,
      // Preise, die es BEI STRIPE gibt — zwei davon stehen nicht in stripe_prices.
      preise: { price_monat: 'recurring', price_jahr: 'recurring', price_leben: 'one_time', price_alt: 'recurring', price_fremd: 'recurring', price_einmal_fremd: 'one_time' },
    },
  };
  return W;
}
const tab = (name) => W.db.t[name] || (W.db.t[name] = []);
const schreibRufe = (tabelle) => W.db.prot.filter((p) => p.tabelle === tabelle && p.op !== 'select');
const stripeRufe = (was) => W.stripe.rufe.filter((r) => r.was === was);

// ── Trigger und Sicht, NACHGEBAUT (Grenze im Bericht) ─────────────────────────
// fn_sync_lifetime_to_profile, Migration 20260504_user_entitlements_past_due.sql.
function triggerSync(neu) {
  const p = tab('profiles').find((x) => x.id === neu.user_id);
  if (!p) return;
  const tierVorher = p.tier;
  try { triggerSyncRechnen(neu, p); } finally {
    // profiles_tier_check (live): free · pro · lifetime. Setzte der Trigger etwas anderes, scheiterte
    // die ganze Anweisung auf stripe_subscriptions — der Aufrufer bekommt 23514.
    if (CHECK.profiles.tier.indexOf(p.tier) < 0) { const falsch = p.tier; p.tier = tierVorher; throw { dbFehler: dbFehler('23514', 'new row for relation "profiles" violates check constraint "profiles_tier_check" (tier = ' + falsch + ')') }; }
  }
}
function triggerSyncRechnen(neu, p) {
  if (neu.is_lifetime === true) { p.tier = 'lifetime'; p.is_lifetime = true; }
  else if (neu.status === 'active' || neu.status === 'trialing') {
    const sp = tab('stripe_prices').find((x) => x.id === neu.price_id);
    const lk = sp ? String(sp.lookup_key || '') : null;
    if (lk !== null) p.tier = /pro/.test(lk) ? 'pro' : /plus/.test(lk) ? 'plus' : /basic/.test(lk) ? 'basic' : p.tier;
  } else if (['canceled', 'unpaid', 'incomplete_expired'].indexOf(neu.status) >= 0) {
    if (p.is_lifetime === false) p.tier = 'free';
  }
}
// v_user_entitlements.tier, Migration v29_16_comp_entitlements.sql — der Massstab des Prüfstands.
const KULANZ_TAGE = 7;
function sichtTier(uid, jetztS) {
  const jetzt = (jetztS === undefined ? W.jetzt : jetztS) * 1000;
  const p = tab('profiles').find((x) => x.id === uid);
  if (!p) return null;
  const aktiv = tab('stripe_subscriptions').filter((s) => s.user_id === uid && (s.is_lifetime === true || s.status === 'active' || s.status === 'trialing'
    || (s.status === 'past_due' && s.current_period_end && Date.parse(s.current_period_end) > jetzt - KULANZ_TAGE * TAG * 1000)));
  const subLeben = aktiv.some((s) => s.is_lifetime === true);
  const tiers = aktiv.map((s) => s.tier).filter((t) => ['pro', 'lifetime', 'plus', 'premium', 'basic'].indexOf(t) >= 0).sort();
  const subTier = tiers.length ? tiers[tiers.length - 1] : null;
  const comp = ['pro', 'lifetime'].indexOf(p.comp_tier) >= 0 && (!p.comp_expires_at || Date.parse(p.comp_expires_at) > jetzt);
  if (p.is_lifetime === true || subLeben || (comp && p.comp_tier === 'lifetime')) return 'lifetime';
  if (aktiv.length) return subTier || p.tier;
  if (comp) return p.comp_tier;
  return 'free';
}

// ── supabase-js, gestellt ─────────────────────────────────────────────────────
const dbFehler = (code, message, status, details) => ({ data: null, error: { code, message, details: details || null, hint: null }, count: null, status: status || 400, statusText: 'Bad Request' });
function colsLesen(cols) {
  // "a, b, stripe_products(tier)" → { einfach: ['a','b'], eingebettet: [{ name, cols }] }
  const aus = { einfach: [], eingebettet: [] };
  let tiefe = 0, teil = '';
  const teile = [];
  for (const c of String(cols || '*')) {
    if (c === '(') tiefe++; else if (c === ')') tiefe--;
    if (c === ',' && tiefe === 0) { teile.push(teil); teil = ''; } else teil += c;
  }
  teile.push(teil);
  for (const t of teile.map((x) => x.trim()).filter(Boolean)) {
    const m = /^([a-z_]+)\((.*)\)$/.exec(t);
    if (m) aus.eingebettet.push({ name: m[1], cols: m[2] }); else aus.einfach.push(t);
  }
  return aus;
}
function dbAusfuehren(q) {
  const D = W.db;
  D.prot.push({ tabelle: q.tabelle, op: q.op, body: klon(q.body), filter: q.filter.slice(), cols: q.cols });
  if (D.fehlt.has(q.tabelle)) return dbFehler('PGRST205', "Could not find the table 'public." + q.tabelle + "' in the schema cache", 404);
  for (const n of D.nein) {
    if (n.tabelle === q.tabelle && (!n.op || n.op === q.op || (n.op === 'schreiben' && q.op !== 'select'))) {
      n.treffer = (n.treffer || 0) + 1;
      return dbFehler(n.code || '42501', n.message || 'permission denied for table ' + q.tabelle, 403);
    }
  }
  const spalten = SPALTEN[q.tabelle];
  if (!spalten) { W.ohneSpalten = (W.ohneSpalten || new Set()).add(q.tabelle); }
  const t = tab(q.tabelle);
  const passt = (zeile) => q.filter.every(([c, v]) => zeile[c] === v || (zeile[c] != null && v != null && String(zeile[c]) === String(v)));
  const uuidSpalten = UUID_SPALTEN[q.tabelle] || [];
  for (const [c, v] of q.filter) {
    if (spalten && spalten.indexOf(c) < 0) return dbFehler('42703', 'column ' + q.tabelle + '.' + c + ' does not exist');
    if (uuidSpalten.indexOf(c) >= 0 && !UUID.test(String(v))) return dbFehler('22P02', 'invalid input syntax for type uuid: "' + v + '"');
  }
  const koerper = q.body == null ? [] : (Array.isArray(q.body) ? q.body : [q.body]);
  if (q.op !== 'select' && q.op !== 'delete') {
    for (const k of koerper) {
      if (spalten) for (const c of Object.keys(k)) if (spalten.indexOf(c) < 0) return dbFehler('PGRST204', "Could not find the '" + c + "' column of '" + q.tabelle + "' in the schema cache");
      for (const c of uuidSpalten) if (k[c] != null && !UUID.test(String(k[c]))) return dbFehler('22P02', 'invalid input syntax for type uuid: "' + k[c] + '"');
      if (q.op !== 'update') for (const c of PFLICHT[q.tabelle] || []) if (k[c] == null) return dbFehler('23502', 'null value in column "' + c + '" of relation "' + q.tabelle + '" violates not-null constraint');
      for (const [c, erlaubt] of Object.entries(CHECK[q.tabelle] || {})) if (k[c] != null && erlaubt.indexOf(k[c]) < 0) return dbFehler('23514', 'new row for relation "' + q.tabelle + '" violates check constraint "' + q.tabelle + '_' + c + '_check"');
      for (const [c, ziel] of Object.entries(FREMD[q.tabelle] || {})) {
        if (k[c] == null) continue;
        const da = ziel === 'nutzer' ? D.nutzer.has(String(k[c])) : tab(ziel).some((x) => x.id === k[c]);
        if (!da) return dbFehler('23503', 'insert or update on table "' + q.tabelle + '" violates foreign key constraint "' + (FREMD_NAME[q.tabelle + '.' + c] || q.tabelle + '_' + c + '_fkey') + '"', 409, 'Key (' + c + ')=(' + k[c] + ') is not present in table "' + (ziel === 'nutzer' ? 'users' : ziel) + '".');
      }
    }
    if (q.op === 'upsert') {
      const konflikt = q.opts && q.opts.onConflict ? String(q.opts.onConflict).split(',').map((x) => x.trim()) : (SCHLUESSEL[q.tabelle] || ['id']);
      const eindeutig = EINDEUTIG[q.tabelle];
      if (eindeutig && !eindeutig.some((e) => e.length === konflikt.length && e.every((c) => konflikt.indexOf(c) >= 0))) return dbFehler('42P10', 'there is no unique or exclusion constraint matching the ON CONFLICT specification');
    }
  }
  // Eine Anweisung gilt ganz oder gar nicht — auch wenn erst der Trigger scheitert.
  const standVorher = q.op === 'select' ? null : klon(D.t);
  try { return dbSchreibenLesen(q, D, t, spalten, passt, koerper); }
  catch (e) { if (e && e.dbFehler) { D.t = standVorher; return e.dbFehler; } throw e; }
}
function dbSchreibenLesen(q, D, t, spalten, passt, koerper) {
  const nachSchreiben = (zeile) => { if (q.tabelle === 'stripe_subscriptions' && D.trigger) triggerSync(zeile); };
  const vorgaben = (k) => {
    const jetztIso = new Date().toISOString();
    if (q.tabelle === 'stripe_subscriptions') return Object.assign({ is_lifetime: false, created_at: jetztIso }, k);
    if (q.tabelle === 'stripe_webhook_events') return Object.assign({ processed: false, processed_at: null, error: null, created_at: jetztIso }, k);
    return Object.assign({}, k);
  };
  let betroffen = [];
  if (q.op === 'insert') {
    const pk = SCHLUESSEL[q.tabelle];
    for (const k of koerper) {
      if (pk && t.some((x) => pk.every((c) => x[c] === k[c]))) return dbFehler('23505', 'duplicate key value violates unique constraint "' + q.tabelle + '_pkey"', 409);
      const neu = vorgaben(klon(k)); t.push(neu); nachSchreiben(neu); betroffen.push(neu);
    }
  } else if (q.op === 'upsert') {
    const konflikt = q.opts && q.opts.onConflict ? String(q.opts.onConflict).split(',').map((x) => x.trim()) : (SCHLUESSEL[q.tabelle] || ['id']);
    for (const k of koerper) {
      const da = t.find((x) => konflikt.every((c) => x[c] === k[c]));
      if (da) { if (!(q.opts && q.opts.ignoreDuplicates)) { Object.assign(da, klon(k)); nachSchreiben(da); } betroffen.push(da); }
      else { const neu = vorgaben(klon(k)); t.push(neu); nachSchreiben(neu); betroffen.push(neu); }
    }
  } else if (q.op === 'update') {
    for (const zeile of t.filter(passt)) { Object.assign(zeile, klon(koerper[0] || {})); nachSchreiben(zeile); betroffen.push(zeile); }
  } else if (q.op === 'delete') {
    betroffen = t.filter(passt);
    D.t[q.tabelle] = t.filter((x) => !passt(x));
  } else {
    betroffen = t.filter(passt);
  }
  if (q.op !== 'select' && !q.rueck) return { data: null, error: null, count: null, status: q.op === 'insert' || q.op === 'upsert' ? 201 : 204, statusText: 'OK' };
  const cols = colsLesen(q.cols);
  if (spalten) for (const c of cols.einfach) if (c !== '*' && spalten.indexOf(c) < 0) return dbFehler('42703', 'column ' + q.tabelle + '.' + c + ' does not exist');
  let zeilen = betroffen.slice();
  if (q.order) zeilen.sort((a, b) => (String(a[q.order.col]) < String(b[q.order.col]) ? -1 : String(a[q.order.col]) > String(b[q.order.col]) ? 1 : 0) * (q.order.auf ? 1 : -1));
  if (typeof q.limit === 'number') zeilen = zeilen.slice(0, q.limit);
  const sicht = zeilen.map((zeile) => {
    const aus = {};
    if (cols.einfach.indexOf('*') >= 0) Object.assign(aus, klon(zeile)); else for (const c of cols.einfach) aus[c] = klon(zeile[c] === undefined ? null : zeile[c]);
    for (const e of cols.eingebettet) {
      if (q.tabelle === 'stripe_prices' && e.name === 'stripe_products') {
        const pr = tab('stripe_products').find((x) => x.id === zeile.product_id);
        aus.stripe_products = pr ? colsLesen(e.cols).einfach.reduce((o, c) => { o[c] = pr[c] === undefined ? null : pr[c]; return o; }, {}) : null;
      } else return { __fehler: dbFehler('PGRST200', "Could not find a relationship between '" + q.tabelle + "' and '" + e.name + "' in the schema cache") };
    }
    return aus;
  });
  const kaputt = sicht.find((x) => x && x.__fehler);
  if (kaputt) return kaputt.__fehler;
  if (q.einzel) {
    if (sicht.length > 1) return dbFehler('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406);
    if (sicht.length === 0) return q.einzel === 'muss' ? dbFehler('PGRST116', 'JSON object requested, multiple (or no) rows returned', 406) : { data: null, error: null, count: null, status: 200, statusText: 'OK' };
    return { data: sicht[0], error: null, count: null, status: 200, statusText: 'OK' };
  }
  return { data: sicht, error: null, count: null, status: 200, statusText: 'OK' };
}
function createClientStub(_url, key, opts) {
  const auth = (opts && opts.global && opts.global.headers && (opts.global.headers.Authorization || opts.global.headers.authorization)) || '';
  const nutzer = (token) => {
    const u = TOKEN[String(token || '').replace(/^Bearer\s+/i, '')];
    return u ? { data: { user: klon(u) }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } };
  };
  const dienst = key === ENV_VORGABE.SUPABASE_SERVICE_ROLE_KEY;
  const uid = () => { if (dienst) return null; const u = TOKEN[String(auth || '').replace(/^Bearer\s+/i, '')]; return u ? u.id : null; };   // auth.uid()
  return {
    auth: { getUser: async (token) => nutzer(token !== undefined ? token : auth) },
    from(tabelle) {
      const q = { tabelle, op: 'select', filter: [], cols: '*', body: null, opts: null, order: null, limit: null, einzel: null, rueck: false, dienst: key === ENV_VORGABE.SUPABASE_SERVICE_ROLE_KEY };
      // Wie der echte Bauer (gemessen an @supabase/postgrest-js 2.119.0): `then`, aber KEIN `catch` und kein `finally`.
      const k = {
        select(cols) { if (q.op === 'select') q.cols = cols === undefined ? '*' : cols; else { q.rueck = true; q.cols = cols === undefined ? '*' : cols; } return k; },
        insert(body) { q.op = 'insert'; q.body = body; return k; },
        upsert(body, o) { q.op = 'upsert'; q.body = body; q.opts = o || null; return k; },
        update(body) { q.op = 'update'; q.body = body; return k; },
        delete() { q.op = 'delete'; return k; },
        eq(c, v) { q.filter.push([c, v]); return k; },
        order(c, o) { q.order = { col: c, auf: !(o && o.ascending === false) }; return k; },
        limit(n) { q.limit = n; return k; },
        maybeSingle() { q.einzel = 'kann'; return k; },
        single() { q.einzel = 'muss'; return k; },
        then(ja, nein) { return Promise.resolve().then(() => dbAusfuehren(q)).then(ja, nein); },
      };
      return k;
    },
    rpc(name, args) {
      const k = {
        then(ja, nein) {
          return Promise.resolve().then(() => {
            W.db.prot.push({ tabelle: 'rpc/' + name, op: 'rpc', body: klon(args), dienst, uid: uid() });
            for (const n of W.db.nein) if (n.tabelle === 'rpc/' + name) return dbFehler('42501', 'permission denied for function ' + name, 403);
            if (!Object.prototype.hasOwnProperty.call(W.db.rpc, name)) return dbFehler('PGRST202', 'Could not find the function public.' + name + ' in the schema cache', 404);
            let daten = W.db.rpc[name];
            if (name === 'launch_offer_available' && daten === 'live') {
              // public.launch_offer_available(), Wort für Wort (live gelesen am 11.11.2026):
              //   IF auth.uid() IS NULL THEN RETURN {available: true, logged_in: false};
              //   RETURN {available: (count < 100) AND NOT used, logged_in: true, claimed: count}
              const ich = uid(), zeilen = tab('launch_offer_usage');
              daten = ich === null ? { available: true, logged_in: false } : { available: zeilen.length < 100 && !zeilen.some((x) => x.user_id === ich), logged_in: true, claimed: zeilen.length };
            }
            return { data: klon(daten), error: null, count: null, status: 200, statusText: 'OK' };
          }).then(ja, nein);
        },
      };
      return k;
    },
  };
}

// ── Stripe, gestellt ──────────────────────────────────────────────────────────
// Stripes Verfahren mit node:crypto — der Massstab, an dem die Signaturprüfung gemessen wird.
function unterschrift(rumpf, geheimnis, t) {
  return 't=' + t + ',v1=' + nodeCrypto.createHmac('sha256', geheimnis).update(Buffer.concat([Buffer.from(t + '.'), Buffer.isBuffer(rumpf) ? rumpf : Buffer.from(String(rumpf), 'utf8')])).digest('hex');
}
function stripeFehler(message, statusCode) { const e = new Error(message); e.type = 'StripeInvalidRequestError'; e.statusCode = statusCode || 400; return e; }
class StripeStub {
  constructor(key, opts) {
    this._key = key; this._api = opts && opts.apiVersion;
    const S = () => W.stripe;
    const ruf = (was, arg) => { S().rufe.push({ was, arg: klon(arg), key, api: this._api }); };
    this.webhooks = {
      // Nur der alte Handler ruft das — der neue rechnet die Signatur im Modul.
      constructEventAsync: async (body, sig, secret) => {
        const teile = String(sig || '').split(',').map((x) => x.split('='));
        const t = Number((teile.find((x) => x[0] === 't') || [])[1]);
        const v1 = teile.filter((x) => x[0] === 'v1').map((x) => x[1]);
        const soll = nodeCrypto.createHmac('sha256', secret).update(t + '.' + body).digest('hex');
        if (!v1.some((v) => v && v.length === soll.length && nodeCrypto.timingSafeEqual(Buffer.from(v), Buffer.from(soll)))) throw new Error('No signatures found matching the expected signature for payload.');
        if (Math.floor(Date.now() / 1000) - t > 300) throw new Error('Timestamp outside the tolerance zone');
        return JSON.parse(body);
      },
    };
    this.subscriptions = {
      retrieve: async (id) => { ruf('subscriptions.retrieve', id); if (S().abosWerfen) throw new Error('Stripe ist gerade nicht erreichbar'); const a = S().abos[id]; if (!a) throw stripeFehler('No such subscription: ' + id, 404); return klon(a); },
    };
    this.customers = {
      create: async (p) => { ruf('customers.create', p); const id = 'cus_neu_' + (++S().n); S().kunden[id] = { id, object: 'customer', email: p && p.email, metadata: (p && p.metadata) || {} }; return klon(S().kunden[id]); },
      retrieve: async (id) => { ruf('customers.retrieve', id); const k = S().kunden[id]; if (!k) throw stripeFehler('No such customer: ' + id, 404); return klon(k); },
      search: async (p) => {
        ruf('customers.search', p);
        if (S().sucheWirft) throw stripeFehler('Search is not available right now', 503);
        const m = /^metadata\['supabase_user_id'\]:'([^']*)'$/.exec(String(p && p.query));
        if (!m) throw stripeFehler('Invalid search query: ' + (p && p.query));
        return { object: 'search_result', data: Object.values(S().kunden).filter((k) => k.metadata && k.metadata.supabase_user_id === m[1]).slice(0, (p && p.limit) || 10).map(klon) };
      },
    };
    this.checkout = {
      sessions: {
        create: async (p) => {
          ruf('checkout.sessions.create', p);
          const fremd = Object.keys(p || {}).filter((k) => p[k] !== undefined && STRIPE_CHECKOUT_PARAMETER.indexOf(k) < 0);
          if (fremd.length) throw stripeFehler('Received unknown parameter: ' + fremd[0]);
          const preis = p.line_items && p.line_items[0] && p.line_items[0].price;
          const art = S().preise[preis];
          if (!art) throw stripeFehler('No such price: ' + preis);
          if (p.mode === 'subscription' && art !== 'recurring') throw stripeFehler('You specified `subscription` mode but passed a one-time price.');
          if (p.mode === 'payment' && art !== 'one_time') throw stripeFehler('You specified `payment` mode but passed a recurring price.');
          if (!/^https?:\/\//.test(String(p.success_url))) throw stripeFehler('Invalid URL: success_url');
          if (p.customer && !S().kunden[p.customer]) throw stripeFehler('No such customer: ' + p.customer);
          const id = 'cs_pruefstand_' + (++S().n);
          return { id, object: 'checkout.session', url: 'https://checkout.stripe.com/c/pay/' + id };
        },
        listLineItems: async (id, o) => { ruf('checkout.sessions.listLineItems', { id, o }); return { object: 'list', data: klon(S().posten[id] || []) }; },
      },
    };
    this.billingPortal = {
      sessions: {
        create: async (p) => {
          ruf('billingPortal.sessions.create', p);
          const fremd = Object.keys(p || {}).filter((k) => p[k] !== undefined && STRIPE_PORTAL_PARAMETER.indexOf(k) < 0);
          if (fremd.length) throw stripeFehler('Received unknown parameter: ' + fremd[0]);
          if (!S().kunden[p.customer]) throw stripeFehler('No such customer: ' + p.customer);
          const f = p.flow_data;
          const ziel = f && ((f.subscription_cancel && f.subscription_cancel.subscription) || (f.subscription_update && f.subscription_update.subscription));
          if (f && !S().abos[ziel]) throw stripeFehler('No such subscription: ' + ziel);
          return { id: 'bps_pruefstand_' + (++S().n), object: 'billing_portal.session', url: 'https://billing.stripe.com/p/session/pruefstand_' + S().n };
        },
      },
    };
  }
  static createFetchHttpClient() { return {}; }
  static createSubtleCryptoProvider() { return {}; }
}
// Ein Abo, wie Stripe es liefert. form 'acacia': Zeitraum am Abo · 'basil': am Posten (seit 2025-03-31).
function abo(o) {
  const a = Object.assign({ id: 'sub_1', status: 'active', nutzer: U1, preis: 'price_monat', kunde: 'cus_anna', start: W.jetzt - 3 * TAG, ende: W.jetzt + 27 * TAG, form: 'acacia' }, o || {});
  const posten = { id: 'si_1', object: 'subscription_item', price: { id: a.preis, object: 'price' } };
  const s = { id: a.id, object: 'subscription', status: a.status, customer: a.kunde, cancel_at_period_end: !!a.kuendigtZumEnde, cancel_at: a.cancel_at || null,
    trial_end: a.trial_end || null, canceled_at: a.canceled_at || null, ended_at: a.ended_at || null, metadata: a.metadata !== undefined ? a.metadata : (a.nutzer ? { supabase_user_id: a.nutzer } : {}),
    items: { object: 'list', data: [posten] } };
  if (a.form === 'basil') { posten.current_period_start = a.start; posten.current_period_end = a.ende; } else { s.current_period_start = a.start; s.current_period_end = a.ende; }
  return s;
}
let ereignisNr = 0;
function ereignis(typ, objekt, o) {
  return Object.assign({ id: 'evt_' + (++ereignisNr), object: 'event', api_version: '2024-12-18.acacia', created: W.jetzt, livemode: false, type: typ, data: { object: klon(objekt) } }, o || {});
}

// ── Die echten Handler laden ──────────────────────────────────────────────────
const H = {};
let ladeNr = 0;
async function lade(name, env) {
  const mod = require('node:module');
  if (typeof mod.stripTypeScriptTypes !== 'function') return { grund: 'node:module.stripTypeScriptTypes fehlt (Node ' + process.version + ', gebraucht ≥ 22.13)' };
  const pfad = DATEI[name];
  if (!fs.existsSync(pfad)) return { grund: name + ' nicht gefunden: ' + pfad };
  let src = fs.readFileSync(pfad, 'utf8');
  const warnAlt = process.emitWarning;
  process.emitWarning = () => {};
  try { src = mod.stripTypeScriptTypes(src); } finally { process.emitWarning = warnAlt; }
  const ersetze = (re, durch, was) => { const vorher = src; src = src.replace(re, durch); return src === vorher ? was : null; };
  src = src.replace(/import\s*["']jsr:@supabase\/functions-js\/edge-runtime\.d\.ts["'];?/, '');
  const fehlt = [
    ersetze(/import\s+Stripe\s+from\s*["'][^"']*stripe[^"']*["'];?/, 'const Stripe = globalThis.__gsStripeCheck.Stripe;', 'der Import von stripe'),
    ersetze(/import\s*\{\s*createClient\s*\}\s*from\s*["']jsr:@supabase\/supabase-js@2["'];?/, 'const createClient = globalThis.__gsStripeCheck.createClient;', 'der Import von supabase-js'),
  ].filter(Boolean);
  if (fehlt.length) return { grund: name + ': ' + fehlt.join(' und ') + ' steht nicht mehr so da — den Lader in stripe_check.js nachziehen' };
  src = src.replace(/from\s*["']\.\.\/_shared\/([A-Za-z0-9_]+\.mjs)["']/g, (_, datei) => 'from ' + z(pathToFileURL(datei === 'stripe_regeln.mjs' ? MODUL : path.join(FUNKTIONEN, '_shared', datei)).href));
  let gefangen = null;
  globalThis.__gsStripeCheck = { Stripe: StripeStub, createClient: createClientStub };
  const envBeimLaden = Object.assign({}, ENV_VORGABE, env || {});
  globalThis.Deno = {
    // Beim Laden gilt die Umgebung des Ladens (Konstanten auf Modulebene), danach die der Welt.
    env: { get: (k) => { const e = W ? W.env : envBeimLaden; return e[k] === null ? undefined : e[k]; } },
    serve: (h) => { gefangen = h; },
  };
  const weltAlt = W; W = null;
  const tmp = path.join(os.tmpdir(), 'gs_stripe_check_' + name + '_' + process.pid + '_' + (++ladeNr) + '.mjs');
  fs.writeFileSync(tmp, src);
  try { await import(pathToFileURL(tmp).href); } finally { W = weltAlt; try { fs.unlinkSync(tmp); } catch (_) { /* egal */ } }
  if (typeof gefangen !== 'function') return { grund: name + ': Deno.serve wurde nicht gerufen' };
  return { ok: true, handler: gefangen };
}
async function sende(handler, a) {
  const init = { method: a.method || 'POST', headers: a.headers || {} };
  if (a.body !== undefined && init.method !== 'GET' && init.method !== 'OPTIONS') init.body = a.body;
  const alt = [console.log, console.warn, console.error];
  console.log = (...t) => W.log.push('log: ' + t.join(' '));
  console.warn = (...t) => W.log.push('warn: ' + t.join(' '));
  console.error = (...t) => W.log.push('error: ' + t.join(' '));
  let res;
  try { res = await handler(new Request(a.url || 'https://stub.supabase.co/functions/v1/x', init)); }
  finally { console.log = alt[0]; console.warn = alt[1]; console.error = alt[2]; }
  const text = await res.text();
  let daten = null; try { daten = JSON.parse(text); } catch (_) { daten = null; }
  return { status: res.status, text, daten, cors: res.headers.get('access-control-allow-origin') };
}
// Ein Ereignis an den Webhook, unterschrieben wie von Stripe.
async function liefere(ev, o) {
  const a = o || {};
  const rumpf = a.rumpf !== undefined ? a.rumpf : z(ev);
  const t = a.t !== undefined ? a.t : Math.floor(Date.now() / 1000);
  const kopf = a.kopf !== undefined ? a.kopf : unterschrift(a.unterschrieben !== undefined ? a.unterschrieben : rumpf, a.geheimnis || GEHEIMNIS, t);
  const headers = { 'content-type': 'application/json' };
  if (kopf !== null) headers['stripe-signature'] = kopf;
  return sende(a.handler || H.webhook, { url: 'https://stub.supabase.co/functions/v1/stripe-webhook', headers, body: rumpf });
}
async function rufe(name, a) {
  const o = a || {};
  const headers = { 'content-type': 'application/json' };
  if (o.token !== null) headers.authorization = 'Bearer ' + (o.token || 'jwt-anna');
  if (o.origin) headers.origin = o.origin;
  return sende(o.handler || H[name], { url: 'https://stub.supabase.co/functions/v1/stripe-' + name, method: o.method || 'POST', headers, body: o.body === undefined ? undefined : (typeof o.body === 'string' ? o.body : z(o.body)) });
}
const aboZeile = (id) => tab('stripe_subscriptions').find((x) => x.id === id) || null;
const ereignisZeile = (id) => tab('stripe_webhook_events').find((x) => x.id === id) || null;
const ANNA_KUNDE = () => { W.stripe.kunden.cus_anna = { id: 'cus_anna', object: 'customer', email: 'anna@pruefstand.invalid', metadata: { supabase_user_id: U1 } }; };

// ══ RECHNUNG ══════════════════════════════════════════════════════════════════
const RECHNUNG = [
  {
    name: 'Signatur · gültig wird angenommen, alles andere mit Grund abgelehnt — gemessen an node:crypto, nicht an sich selbst',
    lauf: async (M) => {
      const jetzt = 1794300000, g = 'ein-geheimnis';
      const rumpf = '{"id":"evt_1","text":"Bärlauch — 7.90 CHF ✓"}';
      const k = unterschrift(rumpf, g, jetzt);
      const fall = async (e) => { const r = await M.signaturPruefen(Object.assign({ kopf: k, rumpf, geheimnis: g, jetztS: jetzt }, e)); return r.ok ? 'ok' : r.grund; };
      const erwartet = [
        ['gültig (Zeichenkette)', {}, 'ok'],
        ['gültig (Bytes)', { rumpf: new TextEncoder().encode(rumpf) }, 'ok'],
        ['anderes Geheimnis', { geheimnis: 'ein-anderes' }, 'signatur_falsch'],
        ['ein Zeichen im Rumpf geändert', { rumpf: rumpf.replace('7.90', '0.90') }, 'signatur_falsch'],
        ['Zeitstempel im Kopf geändert', { kopf: k.replace('t=' + jetzt, 't=' + (jetzt + 1)) }, 'signatur_falsch'],
        ['300 s alt (an der Grenze)', { jetztS: jetzt + 300 }, 'ok'],
        ['301 s alt', { jetztS: jetzt + 301 }, 'zu_alt'],
        ['ein Tag alt', { jetztS: jetzt + 86400 }, 'zu_alt'],
        ['ohne Kopfzeile', { kopf: null }, 'kein_kopf'],
        ['Kopf ohne v1', { kopf: 't=' + jetzt }, 'kopf_unlesbar'],
        ['nur v0', { kopf: k.replace('v1=', 'v0=') }, 'kopf_unlesbar'],
        ['Kopf ohne Zeitstempel', { kopf: k.replace(/^t=\d+,/, '') }, 'kopf_unlesbar'],
        ['ohne Geheimnis', { geheimnis: '' }, 'kein_geheimnis'],
        ['zwei v1, die zweite passt (Geheimnis wird gewechselt)', { kopf: 't=' + jetzt + ',v1=' + '0'.repeat(64) + ',' + k.split(',')[1] }, 'ok'],
        ['Signatur in Grossbuchstaben', { kopf: k.replace(/v1=([0-9a-f]+)/, (_, h) => 'v1=' + h.toUpperCase()) }, 'kopf_unlesbar'],
        ['Zeitstempel in der Zukunft (mitunterschrieben)', { jetztS: jetzt - 3600 }, 'ok'],
      ];
      for (const [was, e, soll] of erwartet) { const ist = await fall(e); if (ist !== soll) return { ok: false, warum: was + ': ' + ist + ' statt ' + soll }; }
      if (M.SIGNATUR_TOLERANZ_S !== 300) return { ok: false, warum: 'Toleranz ' + M.SIGNATUR_TOLERANZ_S + ' s statt 300 (Stripes Vorgabe)' };
      return { ok: true, info: erwartet.length + ' Fälle · darunter ein Rumpf mit Umlaut und ✓, 300 s ok / 301 s zu alt, zwei v1' };
    },
  },
  {
    name: 'Ereignisliste · sechzehn Ereignisse, jedes mit einer Wirkung aus dem Vokabular; „nichts" nur mit Grund; Unbekanntes ist unbekannt',
    lauf: (M) => {
      const arten = ['abo', 'abschluss', 'erstattung', 'mitteilung', 'protokoll', 'marktplatz', 'nichts'];
      const namen = Object.keys(M.STRIPE_EREIGNISSE);
      const falsch = namen.filter((n) => arten.indexOf(M.STRIPE_EREIGNISSE[n].wirkung) < 0 || !/^[a-z_]+(\.[a-z_]+)+$/.test(n));
      if (falsch.length) return { ok: false, warum: 'ohne gültige Wirkung: ' + falsch.join(', ') };
      const ohneGrund = namen.filter((n) => M.STRIPE_EREIGNISSE[n].wirkung === 'nichts' && !M.STRIPE_EREIGNISSE[n].grund);
      if (ohneGrund.length) return { ok: false, warum: '„nichts" ohne Grund: ' + ohneGrund.join(', ') };
      if (namen.length !== 16) return { ok: false, warum: namen.length + ' Ereignisse statt 16 — den Namen dieses Falls und die Liste in docs/FUER-FERNANDO nachziehen' };
      const muss = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'charge.refunded', 'customer.subscription.trial_will_end'];
      const fehlt = muss.filter((n) => M.ereignisWirkung(n) === null);
      if (fehlt.length) return { ok: false, warum: 'fehlt in der Liste: ' + fehlt.join(', ') };
      if (M.ereignisWirkung('customer.created') !== null || M.ereignisWirkung('toString') !== null || M.ereignisWirkung('') !== null) return { ok: false, warum: 'ein unbekanntes Ereignis gilt als bekannt' };
      return { ok: true, info: namen.length + ' Ereignisse · ' + arten.map((a) => a + ' ' + namen.filter((n) => M.STRIPE_EREIGNISSE[n].wirkung === a).length).join(' · ') };
    },
  },
  {
    name: 'Abo-Zeile · dieselbe Zeile aus beiden API-Formen (Zeitraum am Abo oder am Posten); nichts wirft, was fehlt, ist null',
    lauf: (M) => {
      neueWelt();
      const a = abo({ form: 'acacia', status: 'trialing', trial_end: W.jetzt + 4 * TAG }), b = abo({ form: 'basil', status: 'trialing', trial_end: W.jetzt + 4 * TAG });
      const za = M.aboZeile(a, { userId: U1, tier: 'pro', jetztMs: 1 }), zb = M.aboZeile(b, { userId: U1, tier: 'pro', jetztMs: 1 });
      if (!za.ok || !zb.ok || z(za.zeile) !== z(zb.zeile)) return { ok: false, warum: 'die Formen ergeben verschiedene Zeilen: ' + z(za) + ' / ' + z(zb) };
      const erw = { id: 'sub_1', user_id: U1, stripe_customer_id: 'cus_anna', price_id: 'price_monat', tier: 'pro', status: 'trialing', cancel_at_period_end: false };
      for (const k of Object.keys(erw)) if (za.zeile[k] !== erw[k]) return { ok: false, warum: k + ' = ' + z(za.zeile[k]) + ' statt ' + z(erw[k]) };
      if (za.zeile.current_period_end !== new Date((W.jetzt + 27 * TAG) * 1000).toISOString() || za.zeile.trial_end !== new Date((W.jetzt + 4 * TAG) * 1000).toISOString()) return { ok: false, warum: 'Zeitraum: ' + z(za.zeile) };
      const fremd = Object.keys(za.zeile).filter((k) => SPALTEN.stripe_subscriptions.indexOf(k) < 0);
      if (fremd.length) return { ok: false, warum: 'die Zeile nennt Spalten, die es live nicht gibt: ' + fremd.join(', ') };
      const leer = M.aboZeile({ id: 'sub_x', status: 'active', customer: { id: 'cus_o' }, items: { data: [] } }, { userId: U1, tier: null });
      if (!leer.ok || leer.zeile.current_period_end !== null || leer.zeile.price_id !== null || leer.zeile.stripe_customer_id !== 'cus_o' || leer.zeile.tier !== 'free') return { ok: false, warum: 'ohne Zeitraum und Posten: ' + z(leer) };
      const nein = [M.aboZeile(null, { userId: U1 }), M.aboZeile(a, { userId: 'nicht-uuid' }), M.aboZeile(a, {}), M.aboZeile({ id: 'sub_y' }, { userId: U1 })];
      if (nein.some((r) => r.ok || !r.grund)) return { ok: false, warum: 'eine unbrauchbare Eingabe ergab eine Zeile: ' + z(nein) };
      const k1 = M.aboZeile(abo({ kuendigtZumEnde: true }), { userId: U1, tier: 'pro' }).zeile.cancel_at_period_end;
      const k2 = M.aboZeile(abo({ cancel_at: W.jetzt + 27 * TAG }), { userId: U1, tier: 'pro' }).zeile.cancel_at_period_end;
      const k3 = M.aboZeile(abo({ status: 'canceled', cancel_at: W.jetzt - TAG }), { userId: U1, tier: 'pro' }).zeile.cancel_at_period_end;
      if (k1 !== true || k2 !== true || k3 !== false) return { ok: false, warum: 'endet von selbst: Schalter ' + k1 + ' · cancel_at ' + k2 + ' · schon beendet ' + k3 };
      if (M.aboIdAusRechnung({ subscription: 'sub_1' }) !== 'sub_1' || M.aboIdAusRechnung({ parent: { subscription_details: { subscription: { id: 'sub_2' } } } }) !== 'sub_2' || M.aboIdAusRechnung({ parent: { quote_details: {} } }) !== null || M.aboIdAusRechnung(null) !== null) return { ok: false, warum: 'Rechnung → Abo: eine der beiden Formen wird nicht gelesen' };
      return { ok: true, info: 'acacia = basil · ' + Object.keys(za.zeile).length + ' Spalten, alle live vorhanden · ohne Zeitraum null statt Ausnahme · cancel_at zählt als „endet von selbst"' };
    },
  },
  {
    name: 'Preis und Probezeit · gekauft wird nur ein aktiver Preis der eigenen Tabelle; Lifetime ist Einmalzahlung; das Launch-Angebot hängt am Preis; Probezeit nur beim ersten Abo, höchstens 7 Tage',
    lauf: (M) => {
      neueWelt();
      const P = (id) => tab('stripe_prices').find((x) => x.id === id);
      const plan = (e) => M.checkoutPlan(Object.assign({ ersterAbschluss: true, launchStand: 'frei' }, e));
      const a = plan({ preisZeile: P('price_monat') });
      if (!a.ok || a.modus !== 'subscription' || a.probeTage !== 7 || a.launch !== false) return { ok: false, warum: 'Monat: ' + z(a) };
      const b = plan({ preisZeile: P('price_leben') });
      if (!b.ok || b.modus !== 'payment' || b.probeTage !== 0 || b.launch !== true) return { ok: false, warum: 'Lifetime: ' + z(b) };
      const nein = [[plan({ preisZeile: null }), 400, 'preis_unbekannt'], [plan({ preisZeile: P('price_alt') }), 400, 'preis_inaktiv'], [plan({ preisZeile: { id: 'p', active: true, recurring: null, metadata: {} } }), 400, 'preis_ohne_intervall'],
        [plan({ preisZeile: P('price_leben'), launchStand: 'ausverkauft' }), 410, 'launch_ausverkauft'], [plan({ preisZeile: P('price_leben'), launchStand: 'schon_gekauft' }), 409, 'launch_schon_gekauft'],
        [plan({ preisZeile: P('price_leben'), launchStand: null }), 503, 'launch_unklar'], [plan({ preisZeile: P('price_leben'), launchStand: undefined }), 503, 'launch_unklar'], [plan({ preisZeile: P('price_leben'), launchStand: true }), 503, 'launch_unklar']];
      for (const [r, status, grund] of nein) if (r.ok || r.status !== status || r.grund !== grund) return { ok: false, warum: 'erwartet ' + status + ' ' + grund + ', bekommen ' + z(r) };
      if (!plan({ preisZeile: P('price_monat'), launchStand: 'ausverkauft' }).ok || !plan({ preisZeile: P('price_monat'), launchStand: null }).ok) return { ok: false, warum: 'ein gewöhnlicher Preis hängt am Launch-Zähler' };
      // Die Antwort der Datenbankfunktion, wie sie live aussieht — und wie sie NICHT gelesen werden darf.
      const ls = [[{ available: true, logged_in: true, claimed: 0 }, 'frei'], [{ available: true, logged_in: true, claimed: 99 }, 'frei'], [{ available: false, logged_in: true, claimed: 100 }, 'ausverkauft'], [{ available: false, logged_in: true, claimed: 140 }, 'ausverkauft'],
        [{ available: false, logged_in: true, claimed: 7 }, 'schon_gekauft'], [{ available: false, logged_in: true }, 'ausverkauft'], [{ available: true, logged_in: false }, null], [{ available: true }, null], [true, null], [false, null], [null, null], [undefined, null],
        ['true', null], [[{ available: true, logged_in: true }], null], [{ available: 'true', logged_in: true }, null], [{ logged_in: true }, null]];
      for (const [antwort, soll] of ls) { const ist = M.launchStand(antwort); if (ist !== soll) return { ok: false, warum: 'launchStand(' + z(antwort) + ') = ' + z(ist) + ' statt ' + z(soll) }; }
      if (M.LAUNCH_PLAETZE !== 100) return { ok: false, warum: 'Plätze: ' + M.LAUNCH_PLAETZE + ' — die Datenbankfunktion zählt bis 100' };
      const t = [[undefined, true, 7], [null, true, 7], [3, true, 3], [30, true, 7], [7, true, 7], [0, true, 0], [-2, true, 0], ['7', true, 0], [6.9, true, 6], [0.5, true, 0], [NaN, true, 0], [undefined, false, 0], [7, false, 0]];
      for (const [wunsch, erst, soll] of t) { const ist = M.probeTage({ modus: 'subscription', ersterAbschluss: erst, wunsch }); if (ist !== soll) return { ok: false, warum: 'Probezeit bei Wunsch ' + z(wunsch) + (erst ? '' : ' (nicht das erste Abo)') + ': ' + ist + ' statt ' + soll }; }
      if (M.probeTage({ modus: 'payment', ersterAbschluss: true, wunsch: 7 }) !== 0) return { ok: false, warum: 'eine Einmalzahlung bekommt eine Probezeit' };
      return { ok: true, info: 'Monat → Abo mit 7 Tagen · Lifetime → Einmalzahlung, Launch · inaktiv/unbekannt 400 · ausverkauft 410 · schon gekauft 409 · nicht feststellbar 503 · ' + ls.length + ' Antworten der Datenbankfunktion (ein blosses `true` ist KEIN „frei") · ' + t.length + ' Probezeit-Fälle (30 → 7, 0.5 → 0)' };
    },
  },
  {
    name: 'Checkout-Parameter · nur Namen, die Checkout kennt — nie `payment_method_types`, nie `automatic_payment_methods`; die Zahlungsart wählt das Dashboard',
    lauf: (M) => {
      const p1 = M.checkoutParameter({ kundeId: 'cus_1', preisId: 'price_monat', modus: 'subscription', probeTage: 7, userId: U1, launch: false, erfolgUrl: 'https://green-scan.ch/?a', abbruchUrl: 'https://green-scan.ch/?b' });
      const p2 = M.checkoutParameter({ kundeId: 'cus_1', preisId: 'price_leben', modus: 'payment', probeTage: 0, userId: U1, launch: true, erfolgUrl: 'https://green-scan.ch/?a', abbruchUrl: 'https://green-scan.ch/?b' });
      for (const p of [p1, p2]) {
        const fremd = Object.keys(p).filter((k) => STRIPE_CHECKOUT_PARAMETER.indexOf(k) < 0);
        if (fremd.length) return { ok: false, warum: 'Stripe kennt nicht: ' + fremd.join(', ') };
        if (M.checkoutParameterFremd(p).length) return { ok: false, warum: 'die eigene Liste kennt nicht: ' + M.checkoutParameterFremd(p).join(', ') };
        if ('payment_method_types' in p || 'automatic_payment_methods' in p) return { ok: false, warum: 'eine feste Zahlungsart steht im Aufruf' };
        if (z(p.line_items) !== z([{ price: p === p1 ? 'price_monat' : 'price_leben', quantity: 1 }])) return { ok: false, warum: 'Posten: ' + z(p.line_items) };
        if (p.metadata.supabase_user_id !== U1) return { ok: false, warum: 'der Nutzer reist nicht mit' };
      }
      if (p1.subscription_data.trial_period_days !== 7 || p1.subscription_data.metadata.supabase_user_id !== U1 || p1.payment_method_collection !== 'always' || p1.payment_intent_data) return { ok: false, warum: 'Abo: ' + z(p1) };
      if (p2.subscription_data || p2.payment_method_collection || p2.payment_intent_data.metadata.kind !== 'lifetime' || p2.payment_intent_data.metadata.supabase_user_id !== U1 || p2.metadata.claim_launch_offer !== '1') return { ok: false, warum: 'Einmalzahlung: ' + z(p2) };
      if ('trial_period_days' in M.checkoutParameter({ modus: 'subscription', probeTage: 0, userId: U1 }).subscription_data) return { ok: false, warum: 'ohne Probezeit steht trotzdem trial_period_days im Aufruf' };
      const nichtInStripe = M.CHECKOUT_PARAMETER.filter((k) => STRIPE_CHECKOUT_PARAMETER.indexOf(k) < 0);
      if (nichtInStripe.length || M.CHECKOUT_PARAMETER.indexOf('payment_method_types') >= 0) return { ok: false, warum: 'die Liste des Moduls: ' + (nichtInStripe.join(', ') || 'nennt payment_method_types') };
      if (M.checkoutParameterFremd({ mode: 'payment', automatic_payment_methods: { enabled: true }, x: undefined }).join() !== 'automatic_payment_methods') return { ok: false, warum: 'der Fremdling von v8 wird nicht erkannt' };
      return { ok: true, info: Object.keys(p1).length + ' Parameter im Abo, ' + Object.keys(p2).length + ' in der Einmalzahlung — alle unter den ' + M.CHECKOUT_PARAMETER.length + ' bekannten' };
    },
  },
  {
    name: 'Rückkehr-Adressen · nur der eigene Ursprung; alles andere bekommt die Vorgabe und einen Grund',
    lauf: (M) => {
      const V = 'https://green-scan.ch/?billing=success';
      const gut = ['https://green-scan.ch/?billing=success&popup=1', 'https://green-scan.ch/app?x=1#y', 'https://www.green-scan.ch/', 'https://greenscan-app.pages.dev/?billing=cancel', 'https://54e6aba1.greenscan-app.pages.dev/?billing=return',
        'https://green-scanswitzerland.netlify.app/?billing=success', 'http://localhost:8080/?billing=success', 'http://127.0.0.1/?b=1'];
      const schlecht = ['https://boese.example/?billing=success', 'https://green-scan.ch.boese.example/', 'https://green-scan.ch@boese.example/', 'https://nutzer:pass@green-scan.ch/', 'http://green-scan.ch/', 'javascript:alert(1)', '//boese.example/x',
        '/nur/ein/pfad', 'https://greenscan.ch/', 'https://boese-greenscan-app.pages.dev/', 'https://x.greenscan-app.pages.dev.boese.example/', 'https://deploy-preview-1--green-scanswitzerland.netlify.app/', 'https://green-scan.ch\t.boese.example/',
        'data:text/html,x', 42, {}, 'https://green-scan.ch/' + 'a'.repeat(2100)];
      const a = gut.filter((u) => { const r = M.rueckkehrAdresse(u, V); return r.ersetzt || r.url !== new URL(u).href; });
      const b = schlecht.filter((u) => { const r = M.rueckkehrAdresse(u, V); return !r.ersetzt || r.url !== V || !r.grund; });
      if (a.length || b.length) return { ok: false, warum: 'fälschlich ersetzt: ' + z(a) + ' · fälschlich angenommen: ' + z(b.map(String)) };
      for (const leer of [undefined, null, '']) { const r = M.rueckkehrAdresse(leer, V); if (r.url !== V || r.ersetzt) return { ok: false, warum: 'ohne Wunsch: ' + z(r) }; }
      const nah = M.rueckkehrAdresse('https://green-scan.ch\\@boese.example/x', V);
      if (nah.ersetzt || new URL(nah.url).origin !== 'https://green-scan.ch') return { ok: false, warum: 'die Adresse mit „\\" geht nicht als gelesene Form weiter: ' + z(nah) };
      return { ok: true, info: gut.length + ' eigene Adressen bleiben · ' + schlecht.length + ' fremde bekommen die Vorgabe (auch „green-scan.ch@…", ein Tabulator im Namen, eine Netlify-Vorschau)' };
    },
  },
  {
    name: 'Portal-Ziel und Erstattung · „kündigen" meint ein echtes laufendes Abo, nie die Lifetime-Zeile; nur die VOLLE Erstattung des Lifetime-Kaufs nimmt Lifetime zurück',
    lauf: (M) => {
      const zl = [{ id: 'lifetime_' + U1, status: 'active', is_lifetime: true, cancel_at_period_end: false }, { id: 'sub_alt', status: 'canceled', cancel_at_period_end: false }, { id: 'sub_neu', status: 'active', cancel_at_period_end: false }];
      if (M.portalZiel(zl, 'cancel') !== 'sub_neu' || M.portalZiel(zl, 'reactivate') !== null || M.portalZiel(zl, undefined) !== null || M.portalZiel(zl.slice(0, 2), 'cancel') !== null || M.portalZiel(null, 'cancel') !== null) return { ok: false, warum: 'Ziel: ' + z([M.portalZiel(zl, 'cancel'), M.portalZiel(zl, 'reactivate'), M.portalZiel(zl.slice(0, 2), 'cancel')]) };
      if (M.portalZiel([{ id: 'sub_k', status: 'active', cancel_at_period_end: true }], 'reactivate') !== 'sub_k' || M.portalZiel([{ id: 'sub_k', status: 'active', cancel_at_period_end: true }], 'cancel') !== null) return { ok: false, warum: 'ein gekündigtes Abo: fortsetzen ja, noch einmal kündigen nein' };
      const zeile = { id: 'lifetime_' + U1, user_id: U1, is_lifetime: true, metadata: { payment_intent: 'pi_leben' } };
      const w = (c, zz) => M.erstattungWirkung(c, zz === undefined ? zeile : zz).wirkung;
      const t = [
        [w({ refunded: true, payment_intent: 'pi_leben' }), 'lifetime_zurueck', 'volle Erstattung des Kaufs'],
        [w({ refunded: false, amount_refunded: 1000, payment_intent: 'pi_leben' }), 'keine', 'Teil-Erstattung'],
        [w({ refunded: true, payment_intent: 'pi_abo' }), 'keine', 'eine andere Zahlung desselben Kunden'],
        [w({ refunded: true, payment_intent: 'pi_leben' }, null), 'keine', 'kein Lifetime-Kauf'],
        [w({ refunded: true, payment_intent: 'pi_x', metadata: { kind: 'lifetime' } }, { is_lifetime: true, metadata: {} }), 'lifetime_zurueck', 'alte Zeile ohne gemerkte Zahlung, Kennung an der Zahlung'],
        [w({ refunded: true, payment_intent: 'pi_x' }, { is_lifetime: true, metadata: {} }), 'keine', 'alte Zeile, Zahlung ohne Kennung'],
        [w(null), 'keine', 'kein Objekt'],
      ];
      for (const [ist, soll, was] of t) if (ist !== soll) return { ok: false, warum: was + ': ' + ist + ' statt ' + soll };
      if (M.erstattungWirkung({ refunded: false }, zeile).grund === undefined) return { ok: false, warum: '„keine" ohne Grund' };
      return { ok: true, info: '3 Zeilen → kündigen: sub_neu · ' + t.length + ' Erstattungs-Fälle (Teil-Erstattung und fremde Zahlung lassen Lifetime stehen)' };
    },
  },
  {
    name: 'Kleine Regeln · ein Nein der Datenbank ist eine Ausnahme mit dem Schritt davor; der Tag der Mitteilung ist der in der Schweiz; „Karte hinterlegen" steht nirgends',
    lauf: (M) => {
      if (M.dbNein({ data: [], error: null }) !== null || M.dbNein({ data: null, error: null }) !== null) return { ok: false, warum: 'eine Antwort ohne Fehler gilt als Nein' };
      let geworfen = '';
      try { M.dbMuss({ data: null, error: { code: '42501', message: 'permission denied for table x' } }, 'x schreiben'); } catch (e) { geworfen = e.message; }
      if (geworfen !== 'x schreiben: 42501 permission denied for table x') return { ok: false, warum: 'dbMuss: „' + geworfen + '"' };
      if (z(M.dbMuss({ data: [{ a: 1 }], error: null }, 's')) !== '[{"a":1}]' || M.dbNein(undefined) === null) return { ok: false, warum: 'dbMuss gibt die Daten nicht zurück, oder „keine Antwort" gilt als ja' };
      const mz = Date.UTC(2026, 4, 23, 22, 30) / 1000;       // 23.05.2026 22:30 UTC = 24.05. 00:30 in Zürich (Sommerzeit)
      const wz = Date.UTC(2026, 11, 31, 23, 30) / 1000;      // 31.12.2026 23:30 UTC = 01.01.2027 00:30 in Zürich
      if (M.datumSchweiz(mz) !== '24.5.2026' || M.datumSchweiz(wz) !== '1.1.2027' || M.datumSchweiz(null) !== null) return { ok: false, warum: 'Datum: ' + M.datumSchweiz(mz) + ' / ' + M.datumSchweiz(wz) };
      const m = M.probeEndeMitteilung(mz), ohne = M.probeEndeMitteilung(null);
      if (m.body.indexOf('24.5.2026') < 0 || /Karte|Trial/i.test(m.title + m.body + ohne.body) || ohne.body.indexOf('bald') < 0 || !/kündigen/.test(m.body)) return { ok: false, warum: 'Mitteilung: ' + z(m) + ' / ' + z(ohne) };
      if (M.nutzerAusMetadaten({ supabase_user_id: U1.toUpperCase() }) !== U1 || M.nutzerAusMetadaten({ supabase_user_id: 'anna' }) !== null || M.nutzerAusMetadaten(null) !== null || M.idVon({ id: 'x' }) !== 'x' || M.idVon('') !== null) return { ok: false, warum: 'Nutzer/Id aus Metadaten' };
      // Die Datenbank sagt „diese Person gibt es nicht" — mit den Texten, die PostgREST wirklich schickt.
      const fk = (spalte, tabelle) => { try { M.dbMuss(dbFehler('23503', 'insert or update on table "stripe_subscriptions" violates foreign key constraint "stripe_subscriptions_' + spalte + '_fkey1"', 409, 'Key (' + spalte + ')=(x) is not present in table "' + tabelle + '".'), 's'); } catch (e) { return e; } return null; };
      let anderer = null; try { M.dbMuss(dbFehler('42501', 'permission denied for table stripe_subscriptions (user_id)'), 's'); } catch (e) { anderer = e; }
      if (M.istNutzerWeg(fk('user_id', 'users')) !== true || M.istNutzerWeg(fk('price_id', 'stripe_prices')) !== false || M.istNutzerWeg(anderer) !== false || M.istNutzerWeg(new Error('23503 user_id')) !== false || M.istNutzerWeg(null) !== false) return { ok: false, warum: 'istNutzerWeg: ein verletzter user_id-Fremdschlüssel ist „Konto weg" — ein fremder Preis, eine Ablehnung oder ein blosser Text sind es nicht' };
      const sp = [['fr', 'fr'], ['IT', 'it'], ['de-CH', 'de'], ['en_US', 'en'], [' de ', 'de'], ['rm', 'auto'], ['', 'auto'], [undefined, 'auto'], [null, 'auto'], [7, 'auto'], [{}, 'auto'], ['auto', 'auto']];
      for (const [wunsch, soll] of sp) if (M.stripeSprache(wunsch) !== soll) return { ok: false, warum: 'stripeSprache(' + z(wunsch) + ') = ' + M.stripeSprache(wunsch) + ' statt ' + soll };
      return { ok: true, info: '„' + geworfen + '" · 23.05. 22:30 UTC → ' + M.datumSchweiz(mz) + ' · „' + m.body.slice(0, 62) + '…" · gelöschtes Konto erkannt (nur am user_id-Fremdschlüssel) · ' + sp.length + ' Sprach-Fälle' };
    },
  },
];

// ══ RAND · stripe-webhook ═════════════════════════════════════════════════════
const WEBHOOK = [
  {
    name: 'Signatur · ein Ereignis mit Stripes Unterschrift kommt an; gefälscht, verändert, zu alt oder ohne Kopfzeile: 400, keine Zeile, keine Wirkung',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const ev = () => ereignis('customer.subscription.created', W.stripe.abos.sub_1);
      const gut = await liefere(ev());
      if (gut.status !== 200 || !aboZeile('sub_1') || tab('stripe_webhook_events').length !== 1) return { ok: false, warum: 'gültig: status ' + gut.status + ' · Abo-Zeile ' + !!aboZeile('sub_1') + ' · Ereigniszeilen ' + tab('stripe_webhook_events').length + ' · ' + gut.text.slice(0, 120) };
      const jetzt = Math.floor(Date.now() / 1000);
      const boese = [
        ['fremdes Geheimnis', { geheimnis: 'nicht-das-geheimnis' }],
        ['Rumpf nach dem Unterschreiben verändert', (e) => ({ unterschrieben: z(e), rumpf: z(e).replace('"active"', '"trialing"') })],
        ['301 Sekunden alt', { t: jetzt - 301 }],
        ['ohne Kopfzeile', { kopf: null }],
        ['Kopf ohne Signatur', { kopf: 't=' + jetzt }],
        ['Signatur aus Nullen', { kopf: 't=' + jetzt + ',v1=' + '0'.repeat(64) }],
      ];
      for (const [was, o] of boese) {
        neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
        const e = ev();
        const r = await liefere(e, typeof o === 'function' ? o(e) : o);
        const wirkung = tab('stripe_subscriptions').length + tab('stripe_webhook_events').length + W.stripe.rufe.length;
        if (r.status !== 400 || wirkung !== 0) return { ok: false, warum: was + ': status ' + r.status + ' · Zeilen und Stripe-Aufrufe danach: ' + wirkung };
      }
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const grenze = await liefere(ev(), { t: jetzt - 290 });
      const kaputt = await liefere(ev(), { kopf: 'v1=abc,quatsch,t=gestern' });
      if (grenze.status !== 200) return { ok: false, warum: '290 Sekunden alt wurde abgelehnt: ' + grenze.status };
      if (kaputt.status !== 400) return { ok: false, warum: 'eine kaputte Kopfzeile wurde angenommen: ' + kaputt.status };
      const e2 = ev(), r2 = z(e2);
      const rot = await liefere(e2, { rumpf: r2, kopf: 't=' + jetzt + ',v1=' + 'b'.repeat(64) + ',' + unterschrift(r2, GEHEIMNIS, jetzt).split(',')[1] });
      if (rot.status !== 200) return { ok: false, warum: 'zwei v1 (Geheimnis wird gewechselt), die zweite passt: status ' + rot.status };
      const get = await sende(H.webhook, { method: 'GET', url: 'https://stub.supabase.co/functions/v1/stripe-webhook' });
      if (get.status !== 405) return { ok: false, warum: 'GET: status ' + get.status };
      return { ok: true, info: 'gültig 200 mit Zeile · ' + boese.length + ' Fälschungen 400 ohne Zeile und ohne Stripe-Aufruf · 290 s alt geht, 301 s nicht · zwei v1 · GET 405' };
    },
  },
  {
    name: 'Dasselbe Ereignis zweimal · eine Wirkung — und ein Ereignis, das beim ersten Mal SCHEITERTE, wird beim zweiten Mal verarbeitet',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const ev = ereignis('charge.dispute.created', { id: 'dp_1', object: 'dispute', charge: 'ch_1', amount: 790, currency: 'chf', reason: 'fraudulent', status: 'needs_response' });
      const a = await liefere(ev), b = await liefere(ev);
      if (a.status !== 200 || b.status !== 200) return { ok: false, warum: 'status ' + a.status + ' / ' + b.status + ' · ' + a.text.slice(0, 140) };
      if (tab('audit_log').length !== 1 || tab('stripe_webhook_events').length !== 1) return { ok: false, warum: 'audit_log ' + tab('audit_log').length + ' Zeilen, Ereignisse ' + tab('stripe_webhook_events').length + ' — erwartet je 1' };
      const e2 = ereignis('customer.subscription.created', W.stripe.abos.sub_1);
      await liefere(e2); const vorher = schreibRufe('stripe_subscriptions').length; await liefere(e2); await liefere(e2);
      if (schreibRufe('stripe_subscriptions').length !== vorher || vorher !== 1) return { ok: false, warum: 'drei Zustellungen → ' + schreibRufe('stripe_subscriptions').length + ' Schreibaufrufe auf stripe_subscriptions (erwartet 1)' };
      // Scheitern, dann Wiederholung
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const e3 = ereignis('customer.subscription.created', W.stripe.abos.sub_1);
      W.db.nein.push({ tabelle: 'stripe_subscriptions', op: 'schreiben' });
      const f = await liefere(e3);
      const zf = ereignisZeile(e3.id);
      if (f.status < 500 || aboZeile('sub_1') || !zf || zf.processed_at || !zf.error) return { ok: false, warum: 'erster Versuch mit DB-Nein: status ' + f.status + ' · Ereigniszeile ' + z(zf && { processed_at: zf.processed_at, error: zf.error }) };
      const grundDavor = String(zf.error);          // die Zeile ist dieselbe — nach der Wiederholung ist der Grund geräumt
      W.db.nein = [];
      const g = await liefere(e3);
      const zg = ereignisZeile(e3.id);
      if (g.status !== 200 || !aboZeile('sub_1') || !zg.processed_at || zg.error) return { ok: false, warum: 'Wiederholung: status ' + g.status + ' · Abo-Zeile ' + !!aboZeile('sub_1') + ' · Ereigniszeile ' + z({ processed_at: zg.processed_at, error: zg.error }) };
      return { ok: true, info: '2 Zustellungen → 1 Zeile in audit_log · 3 Zustellungen → 1 Schreibaufruf · gescheitert (' + f.status + ', Grund „' + grundDavor.slice(0, 60) + '…") → wiederholt → 200, Grund geräumt' };
    },
  },
  {
    name: 'Abschluss · „Checkout fertig" allein schaltet frei (Pro in der Probezeit); das Abo-Ereignis danach ändert nichts; Stripe wird nach dem Stand GEFRAGT',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo({ status: 'trialing', trial_end: W.jetzt + 7 * TAG, start: W.jetzt, ende: W.jetzt + 7 * TAG });
      if (sichtTier(U1) !== 'free') return { ok: false, warum: 'Ausgangslage ist nicht free' };
      const a = await liefere(ereignis('checkout.session.completed', { id: 'cs_1', object: 'checkout.session', mode: 'subscription', payment_status: 'no_payment_required', customer: 'cus_anna', subscription: 'sub_1', metadata: { supabase_user_id: U1, claim_launch_offer: '0' } }));
      const zeile = aboZeile('sub_1');
      if (a.status !== 200 || !zeile) return { ok: false, warum: 'nach „Checkout fertig": status ' + a.status + ' · Abo-Zeile ' + !!zeile + ' — die Freischaltung hinge allein an customer.subscription.created' };
      if (zeile.status !== 'trialing' || zeile.tier !== 'pro' || zeile.user_id !== U1 || zeile.stripe_customer_id !== 'cus_anna' || zeile.price_id !== 'price_monat' || zeile.is_lifetime !== false) return { ok: false, warum: 'Zeile: ' + z(zeile) };
      if (sichtTier(U1) !== 'pro' || sichtTier(U2) !== 'free') return { ok: false, warum: 'Berechtigung: Anna ' + sichtTier(U1) + ', Ben ' + sichtTier(U2) };
      const b = await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      if (b.status !== 200 || tab('stripe_subscriptions').length !== 1 || sichtTier(U1) !== 'pro') return { ok: false, warum: 'Abo-Ereignis danach: status ' + b.status + ' · Zeilen ' + tab('stripe_subscriptions').length };
      if (stripeRufe('subscriptions.retrieve').length !== 2) return { ok: false, warum: 'Stripe wurde ' + stripeRufe('subscriptions.retrieve').length + '× nach dem Abo gefragt (erwartet 2)' };
      if (tab('stripe_webhook_events').some((e) => !e.processed_at || e.error)) return { ok: false, warum: 'Ereigniszeilen: ' + z(tab('stripe_webhook_events').map((e) => [e.type, !!e.processed_at, e.error])) };
      return { ok: true, info: 'free → pro nach checkout.session.completed · Zeile trialing/pro/price_monat · 1 Abo-Zeile nach 2 Ereignissen · Ben bleibt free' };
    },
  },
  {
    name: 'Testphase · drei Tage vorher steht EINE Mitteilung in der Inbox (mit dem Schweizer Tag, ohne „Karte hinterlegen"); nach der Probezeit ist das Abo aktiv',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      const ende = Math.floor(Date.UTC(2027, 0, 14, 23, 30) / 1000);          // 14.01. 23:30 UTC = 15.01. 00:30 in Zürich
      W.stripe.abos.sub_1 = abo({ status: 'trialing', trial_end: ende, start: ende - 7 * TAG, ende });
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      const a = await liefere(ereignis('customer.subscription.trial_will_end', W.stripe.abos.sub_1));
      const b = await liefere(ereignis('customer.subscription.trial_will_end', W.stripe.abos.sub_1));   // ein zweites Ereignis, dieselbe Sache
      const n = tab('notifications');
      if (a.status !== 200 || b.status !== 200) return { ok: false, warum: 'status ' + a.status + ' / ' + b.status + ' · ' + a.text.slice(0, 160) };
      if (n.length !== 1) return { ok: false, warum: n.length + ' Mitteilungen statt 1' };
      const m = n[0];
      if (m.user_id !== U1 || m.kind !== 'trial_ending' || m.link !== '/?open=abo' || m.dedup_key !== 'trial_will_end_sub_1') return { ok: false, warum: 'Mitteilung: ' + z(m) };
      if (m.body.indexOf('15.1.2027') < 0) return { ok: false, warum: 'der Tag ist nicht der in der Schweiz: „' + m.body + '"' };
      if (/Karte/i.test(m.title + ' ' + m.body)) return { ok: false, warum: 'die Mitteilung verlangt eine Karte, die beim Abschluss schon hinterlegt wurde: „' + m.body + '"' };
      if (sichtTier(U1) !== 'pro') return { ok: false, warum: 'in der Probezeit: ' + sichtTier(U1) };
      W.stripe.abos.sub_1 = abo({ status: 'active', start: ende, ende: ende + 30 * TAG });
      const c = await liefere(ereignis('invoice.paid', { id: 'in_1', object: 'invoice', subscription: 'sub_1', customer: 'cus_anna' }));
      const zeile = aboZeile('sub_1');
      if (c.status !== 200 || zeile.status !== 'active' || zeile.current_period_end !== new Date((ende + 30 * TAG) * 1000).toISOString() || sichtTier(U1) !== 'pro') return { ok: false, warum: 'nach der Probezeit: status ' + c.status + ' · ' + z({ s: zeile.status, e: zeile.current_period_end }) };
      // Gegenrichtung: ein Abo, das niemandem gehört, bekommt keine Mitteilung
      W.stripe.abos.sub_o = abo({ id: 'sub_o', status: 'trialing', nutzer: null, kunde: 'cus_ohne' }); W.stripe.kunden.cus_ohne = { id: 'cus_ohne', metadata: {} };
      const d = await liefere(ereignis('customer.subscription.trial_will_end', W.stripe.abos.sub_o));
      if (d.status !== 200 || tab('notifications').length !== 1) return { ok: false, warum: 'ohne Nutzer: status ' + d.status + ' · Mitteilungen ' + tab('notifications').length };
      return { ok: true, info: '2 Ereignisse → 1 Mitteilung: „' + m.body.slice(0, 44) + '…" · danach active bis ' + zeile.current_period_end.slice(0, 10) };
    },
  },
  {
    name: 'Verlängerung · „Rechnung bezahlt" rückt das Periodenende vor — in der alten Form der Rechnung (subscription) und in der neuen (parent.subscription_details)',
    lauf: async () => {
      for (const form of ['acacia', 'basil']) {
        neueWelt(); ANNA_KUNDE();
        W.stripe.abos.sub_1 = abo({ start: W.jetzt - 30 * TAG, ende: W.jetzt });
        await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
        const vorher = aboZeile('sub_1') && aboZeile('sub_1').current_period_end;
        W.stripe.abos.sub_1 = abo({ start: W.jetzt, ende: W.jetzt + 30 * TAG });
        const rechnung = form === 'acacia' ? { id: 'in_2', object: 'invoice', subscription: 'sub_1' } : { id: 'in_2', object: 'invoice', parent: { type: 'subscription_details', subscription_details: { subscription: 'sub_1' } } };
        const r = await liefere(ereignis('invoice.paid', rechnung, { api_version: form === 'acacia' ? '2024-12-18.acacia' : '2026-10-28.endive' }));
        const zeile = aboZeile('sub_1');
        const soll = new Date((W.jetzt + 30 * TAG) * 1000).toISOString();
        if (r.status !== 200 || !zeile || zeile.current_period_end !== soll || zeile.status !== 'active') return { ok: false, warum: 'Rechnung in der Form „' + form + '": status ' + r.status + ' · Periodenende ' + (zeile && zeile.current_period_end) + ' statt ' + soll + ' (vorher ' + vorher + ')' };
        if (sichtTier(U1) !== 'pro') return { ok: false, warum: form + ': ' + sichtTier(U1) };
      }
      neueWelt();
      const ohne = await liefere(ereignis('invoice.paid', { id: 'in_3', object: 'invoice', subscription: null }));
      if (ohne.status !== 200 || W.stripe.rufe.length !== 0 || tab('stripe_subscriptions').length !== 0) return { ok: false, warum: 'eine Rechnung ohne Abo: status ' + ohne.status + ' · Stripe-Aufrufe ' + W.stripe.rufe.length };
      return { ok: true, info: 'Periodenende + 30 Tage in beiden Formen · eine Rechnung ohne Abo: bestätigt, kein Aufruf' };
    },
  },
  {
    name: 'Zahlungsausfall · das Abo steht auf „überfällig" und bleibt in der Kulanz Pro; beendet Stripe es, ist es frei — und der Bericht nennt, wie lange die Kulanz wirklich dauert',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo({ start: W.jetzt - 30 * TAG, ende: W.jetzt });
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      // Die Verlängerung scheitert: Stripe hat die NEUE Periode schon begonnen, der Status ist past_due.
      W.stripe.abos.sub_1 = abo({ status: 'past_due', start: W.jetzt, ende: W.jetzt + 30 * TAG });
      const r = await liefere(ereignis('invoice.payment_failed', { id: 'in_f', object: 'invoice', subscription: 'sub_1' }));
      const zeile = aboZeile('sub_1');
      if (r.status !== 200 || !zeile || zeile.status !== 'past_due') return { ok: false, warum: 'status ' + r.status + ' · Zeile ' + z(zeile && zeile.status) };
      if (sichtTier(U1) !== 'pro') return { ok: false, warum: 'sofort nach dem Ausfall: ' + sichtTier(U1) + ' — keine Kulanz' };
      const endeS = Date.parse(zeile.current_period_end) / 1000;
      if (sichtTier(U1, endeS + KULANZ_TAGE * TAG + 60) !== 'free') return { ok: false, warum: 'nach Ablauf der Kulanz noch ' + sichtTier(U1, endeS + KULANZ_TAGE * TAG + 60) };
      const kulanzTage = Math.round((endeS + KULANZ_TAGE * TAG - W.jetzt) / TAG);
      W.stripe.abos.sub_1 = abo({ status: 'canceled', start: W.jetzt, ende: W.jetzt + 30 * TAG, canceled_at: W.jetzt + 21 * TAG, ended_at: W.jetzt + 21 * TAG });
      const d = await liefere(ereignis('customer.subscription.deleted', W.stripe.abos.sub_1));
      if (d.status !== 200 || aboZeile('sub_1').status !== 'canceled' || sichtTier(U1) !== 'free') return { ok: false, warum: 'Stripe beendet das Abo: status ' + d.status + ' · ' + aboZeile('sub_1').status + ' · ' + sichtTier(U1) };
      const unbezahlt = async (status) => { W.stripe.abos.sub_1 = abo({ status, start: W.jetzt, ende: W.jetzt + 30 * TAG }); await liefere(ereignis('customer.subscription.updated', W.stripe.abos.sub_1)); return sichtTier(U1); };
      if (await unbezahlt('unpaid') !== 'free' || await unbezahlt('incomplete_expired') !== 'free') return { ok: false, warum: '„unpaid" oder „incomplete_expired" gilt als bezahlt' };
      return { ok: true, info: 'past_due → Pro in der Kulanz · canceled/unpaid → free · BEFUND: die Sicht rechnet die 7 Tage ab dem ENDE der neuen Periode — das sind ' + kulanzTage + ' Tage nach dem Ausfall (monatlich), solange Stripe das Abo nicht selbst beendet' };
    },
  },
  {
    name: 'Kündigung zum Periodenende · bleibt Pro bis zum Ende und zeigt „endet"; danach frei. Sofortige Kündigung: sofort frei',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo();
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      W.stripe.abos.sub_1 = abo({ kuendigtZumEnde: true, canceled_at: W.jetzt });
      const a = await liefere(ereignis('customer.subscription.updated', W.stripe.abos.sub_1));
      let zeile = aboZeile('sub_1');
      if (a.status !== 200 || zeile.cancel_at_period_end !== true || zeile.status !== 'active' || sichtTier(U1) !== 'pro') return { ok: false, warum: 'gekündigt zum Ende: status ' + a.status + ' · ' + z({ k: zeile.cancel_at_period_end, s: zeile.status }) + ' · ' + sichtTier(U1) };
      W.stripe.abos.sub_1 = abo({ status: 'canceled', canceled_at: W.jetzt, ended_at: W.jetzt + 27 * TAG });
      const b = await liefere(ereignis('customer.subscription.deleted', W.stripe.abos.sub_1));
      zeile = aboZeile('sub_1');
      if (b.status !== 200 || zeile.status !== 'canceled' || !zeile.ended_at || sichtTier(U1) !== 'free') return { ok: false, warum: 'am Periodenende: status ' + b.status + ' · ' + zeile.status + ' · ' + sichtTier(U1) };
      // neuere API-Form: cancel_at gesetzt, der Schalter bleibt false
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo({ cancel_at: W.jetzt + 27 * TAG });
      await liefere(ereignis('customer.subscription.updated', W.stripe.abos.sub_1));
      if (!aboZeile('sub_1') || aboZeile('sub_1').cancel_at_period_end !== true) return { ok: false, warum: 'Kündigung über cancel_at (neuere API-Form): die Zeile sagt nicht „endet"' };
      // sofort
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo();
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      if (sichtTier(U1) !== 'pro') return { ok: false, warum: 'vor der sofortigen Kündigung: ' + sichtTier(U1) };
      W.stripe.abos.sub_1 = abo({ status: 'canceled', canceled_at: W.jetzt, ended_at: W.jetzt });
      const c = await liefere(ereignis('customer.subscription.deleted', W.stripe.abos.sub_1));
      if (c.status !== 200 || aboZeile('sub_1').status !== 'canceled' || sichtTier(U1) !== 'free') return { ok: false, warum: 'sofort: status ' + c.status + ' · ' + aboZeile('sub_1').status + ' · ' + sichtTier(U1) };
      return { ok: true, info: 'zum Ende: active + „endet" → pro, danach canceled → free · cancel_at zählt · sofort: pro → free' };
    },
  },
  {
    name: 'Reihenfolge · ein ALTES Ereignis, das nach der Kündigung ankommt, schaltet nicht wieder frei — geschrieben wird der Stand bei Stripe, nicht der im Ereignis',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      const alt = abo();                                                        // Momentaufnahme „aktiv"
      W.stripe.abos.sub_1 = abo({ status: 'canceled', canceled_at: W.jetzt, ended_at: W.jetzt });
      await liefere(ereignis('customer.subscription.deleted', W.stripe.abos.sub_1));
      if (!aboZeile('sub_1') || aboZeile('sub_1').status !== 'canceled') return { ok: false, warum: 'die Kündigung kam nicht an' };
      const r = await liefere(ereignis('customer.subscription.updated', alt, { created: W.jetzt - 3600 }));   // Stripe wiederholt ein Ereignis von vor einer Stunde
      const zeile = aboZeile('sub_1');
      if (r.status !== 200 || zeile.status !== 'canceled' || sichtTier(U1) !== 'free') return { ok: false, warum: 'nach dem alten Ereignis: Zeile „' + zeile.status + '", Berechtigung ' + sichtTier(U1) + ' — eine gekündigte Person hat wieder Pro, für immer' };
      // und die Form des Ereignisses spielt keine Rolle
      neueWelt(); ANNA_KUNDE();
      W.stripe.abos.sub_1 = abo({ form: 'basil' });
      const b = await liefere(ereignis('customer.subscription.updated', abo({ form: 'basil' }), { api_version: '2026-10-28.endive' }));
      if (b.status !== 200 || !aboZeile('sub_1') || !aboZeile('sub_1').current_period_end) return { ok: false, warum: 'ein Ereignis in der neuen API-Form (Zeitraum am Posten): status ' + b.status + ' · ' + b.text.slice(0, 120) };
      return { ok: true, info: 'altes „aktiv" nach „gekündigt" → bleibt canceled/free · Ereignis in der Form von 2026 (Zeitraum am Posten) → 200 mit Periodenende' };
    },
  },
  {
    name: 'Lifetime und Erstattung · der Einmalkauf des Lifetime-Preises schaltet Lifetime frei und zählt das Launch-Angebot; die volle Erstattung nimmt es zurück, eine Teil-Erstattung nicht',
    lauf: async () => {
      const kauf = async () => {
        neueWelt(); ANNA_KUNDE();
        W.stripe.posten.cs_l = [{ id: 'li_1', price: { id: 'price_leben' } }];
        return liefere(ereignis('checkout.session.completed', { id: 'cs_l', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_anna', payment_intent: 'pi_leben', amount_total: 4560, metadata: { supabase_user_id: U1, claim_launch_offer: '1' } }));
      };
      const a = await kauf();
      const zeile = aboZeile('lifetime_' + U1);
      if (a.status !== 200 || !zeile || zeile.is_lifetime !== true || zeile.status !== 'active' || zeile.price_id !== 'price_leben') return { ok: false, warum: 'Kauf: status ' + a.status + ' · Zeile ' + z(zeile) + ' · ' + a.text.slice(0, 120) };
      if (sichtTier(U1) !== 'lifetime') return { ok: false, warum: 'nach dem Kauf: ' + sichtTier(U1) };
      if (tab('launch_offer_usage').length !== 1 || tab('launch_offer_usage')[0].user_id !== U1) return { ok: false, warum: 'das Launch-Angebot wurde nicht gezählt: ' + z(tab('launch_offer_usage')) };
      const voll = await liefere(ereignis('charge.refunded', { id: 'ch_l', object: 'charge', customer: 'cus_anna', payment_intent: 'pi_leben', amount: 4560, amount_refunded: 4560, refunded: true, metadata: { supabase_user_id: U1, kind: 'lifetime' } }));
      if (voll.status !== 200 || sichtTier(U1) !== 'free') return { ok: false, warum: 'nach der vollen Erstattung: status ' + voll.status + ' · Berechtigung ' + sichtTier(U1) + ' — Geld zurück, Lifetime behalten' };
      await kauf();
      const teil = await liefere(ereignis('charge.refunded', { id: 'ch_l', object: 'charge', customer: 'cus_anna', payment_intent: 'pi_leben', amount: 4560, amount_refunded: 1000, refunded: false, metadata: { kind: 'lifetime' } }));
      if (teil.status !== 200 || sichtTier(U1) !== 'lifetime') return { ok: false, warum: 'nach einer Teil-Erstattung: ' + sichtTier(U1) };
      const fremd = await liefere(ereignis('charge.refunded', { id: 'ch_a', object: 'charge', customer: 'cus_anna', payment_intent: 'pi_abo', amount: 790, amount_refunded: 790, refunded: true }));
      if (fremd.status !== 200 || sichtTier(U1) !== 'lifetime') return { ok: false, warum: 'die Erstattung einer ANDEREN Zahlung nahm Lifetime zurück: ' + sichtTier(U1) };
      // Erstattung einer Abo-Rechnung: das Abo bleibt, wie Stripe es sagt
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      const abo1 = await liefere(ereignis('charge.refunded', { id: 'ch_b', object: 'charge', customer: 'cus_anna', payment_intent: 'pi_abo', amount: 790, amount_refunded: 790, refunded: true }));
      if (abo1.status !== 200 || sichtTier(U1) !== 'pro') return { ok: false, warum: 'Erstattung einer Abo-Rechnung: ' + sichtTier(U1) };
      return { ok: true, info: 'Kauf → lifetime, Launch-Zähler 1 · volle Erstattung → free · Teil-Erstattung und fremde Zahlung → bleibt lifetime · Abo-Rechnung erstattet → bleibt pro' };
    },
  },
  {
    name: 'Kein Lifetime ohne Lifetime-Preis · eine bezahlte Einmalzahlung für einen anderen Preis schaltet nichts frei — und die Ereigniszeile sagt, warum',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      W.stripe.posten.cs_x = [{ id: 'li_x', price: { id: 'price_einmal_fremd' } }];
      const ev = ereignis('checkout.session.completed', { id: 'cs_x', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_anna', payment_intent: 'pi_x', metadata: { supabase_user_id: U1, claim_launch_offer: '0' } });
      const r = await liefere(ev);
      if (r.status !== 200 || sichtTier(U1) !== 'free' || tab('stripe_subscriptions').length !== 0) return { ok: false, warum: 'Einmalzahlung für einen Preis, der kein Lifetime-Preis ist: Berechtigung ' + sichtTier(U1) + ', Zeilen ' + tab('stripe_subscriptions').length };
      const ez = ereignisZeile(ev.id);
      if (!ez || !ez.processed_at || !ez.error) return { ok: false, warum: 'die Ereigniszeile nennt keinen Grund: ' + z(ez && { p: ez.processed_at, e: ez.error }) };
      W.stripe.posten.cs_u = [{ id: 'li_u', price: { id: 'price_leben' } }];
      const unbezahlt = await liefere(ereignis('checkout.session.completed', { id: 'cs_u', object: 'checkout.session', mode: 'payment', payment_status: 'unpaid', customer: 'cus_anna', metadata: { supabase_user_id: U1 } }));
      if (unbezahlt.status !== 200 || sichtTier(U1) !== 'free') return { ok: false, warum: 'eine UNBEZAHLTE Sitzung schaltet frei: ' + sichtTier(U1) };
      return { ok: true, info: 'fremder Einmalpreis → free, Grund: „' + String(ez.error).slice(0, 70) + '…" · unbezahlt → free' };
    },
  },
  {
    name: 'Unbekannt und bewusst nichts · ein Ereignis, das der Handler nicht kennt, wird bestätigt und festgehalten, ohne eine einzige weitere Zeile; „Kunde geändert" schreibt nichts mehr',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      const vorher = W.db.prot.filter((p) => p.op !== 'select' && p.tabelle !== 'stripe_webhook_events').length;
      const stripeVorher = W.stripe.rufe.length;
      const fremd = [];
      for (const typ of ['customer.created', 'invoice.finalized', 'setup_intent.succeeded', 'product.updated']) {
        const ev = ereignis(typ, { id: 'obj_' + typ, object: typ.split('.')[0], customer: 'cus_anna' });
        const r = await liefere(ev);
        const ez = ereignisZeile(ev.id);
        if (r.status !== 200 || !ez || !ez.processed_at || ez.error) return { ok: false, warum: typ + ': status ' + r.status + ' · Ereigniszeile ' + z(ez && { p: !!ez.processed_at, e: ez.error }) };
        fremd.push(typ);
      }
      const k = await liefere(ereignis('customer.updated', { id: 'cus_anna', object: 'customer', email: 'neu@pruefstand.invalid' }));
      if (k.status !== 200) return { ok: false, warum: 'customer.updated: status ' + k.status + ' · ' + k.text.slice(0, 160) };
      const danach = W.db.prot.filter((p) => p.op !== 'select' && p.tabelle !== 'stripe_webhook_events').length;
      if (danach !== vorher || W.stripe.rufe.length !== stripeVorher) return { ok: false, warum: (danach - vorher) + ' Schreibaufrufe und ' + (W.stripe.rufe.length - stripeVorher) + ' Stripe-Aufrufe für Ereignisse ohne Wirkung' };
      if (schreibRufe('profiles').length) return { ok: false, warum: 'customer.updated schreibt in profiles (stripe_email liest niemand)' };
      return { ok: true, info: fremd.length + ' unbekannte Ereignisse + customer.updated: je 200, festgehalten, 0 weitere Schreibaufrufe, 0 Stripe-Aufrufe' };
    },
  },
  {
    name: 'Die Datenbank sagt Nein · dann bekommt Stripe KEIN „ok" — für jede Ereignisart, die schreibt; und nach der Wiederholung steht die Wirkung da',
    lauf: async () => {
      const faelle = [
        ['customer.subscription.created', 'stripe_subscriptions', () => ereignis('customer.subscription.created', W.stripe.abos.sub_1), () => !!aboZeile('sub_1')],
        ['customer.subscription.deleted', 'stripe_subscriptions', () => ereignis('customer.subscription.deleted', W.stripe.abos.sub_1), () => !!aboZeile('sub_1')],
        ['invoice.paid', 'stripe_subscriptions', () => ereignis('invoice.paid', { id: 'in_n', object: 'invoice', subscription: 'sub_1' }), () => !!aboZeile('sub_1')],
        ['invoice.payment_failed', 'stripe_subscriptions', () => ereignis('invoice.payment_failed', { id: 'in_m', object: 'invoice', subscription: 'sub_1' }), () => !!aboZeile('sub_1')],
        ['checkout.session.completed (Abo)', 'stripe_subscriptions', () => ereignis('checkout.session.completed', { id: 'cs_n', object: 'checkout.session', mode: 'subscription', subscription: 'sub_1', customer: 'cus_anna', metadata: { supabase_user_id: U1 } }), () => !!aboZeile('sub_1')],
        ['checkout.session.completed (Lifetime)', 'stripe_subscriptions', () => { W.stripe.posten.cs_ll = [{ price: { id: 'price_leben' } }]; return ereignis('checkout.session.completed', { id: 'cs_ll', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_anna', payment_intent: 'pi_l', metadata: { supabase_user_id: U1, claim_launch_offer: '1' } }); }, () => !!aboZeile('lifetime_' + U1)],
        ['checkout.session.completed (Launch-Zähler)', 'launch_offer_usage', () => { W.stripe.posten.cs_lz = [{ price: { id: 'price_leben' } }]; return ereignis('checkout.session.completed', { id: 'cs_lz', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_anna', payment_intent: 'pi_l', metadata: { supabase_user_id: U1, claim_launch_offer: '1' } }); }, () => tab('launch_offer_usage').length === 1],
        ['customer.subscription.trial_will_end', 'notifications', () => ereignis('customer.subscription.trial_will_end', W.stripe.abos.sub_1), () => tab('notifications').length === 1],
        ['charge.failed', 'audit_log', () => ereignis('charge.failed', { id: 'ch_f', object: 'charge', customer: 'cus_anna', amount: 790, currency: 'chf', failure_code: 'card_declined' }), () => tab('audit_log').length === 1],
        ['charge.dispute.created', 'audit_log', () => ereignis('charge.dispute.created', { id: 'dp_n', object: 'dispute', charge: 'ch_1', amount: 790, currency: 'chf', reason: 'fraudulent', status: 'needs_response' }), () => tab('audit_log').length === 1],
        ['payment_method.attached', 'audit_log', () => ereignis('payment_method.attached', { id: 'pm_1', object: 'payment_method', customer: 'cus_anna', type: 'twint' }), () => tab('audit_log').length === 1],
        ['jedes Ereignis (festhalten)', 'stripe_webhook_events', () => ereignis('customer.subscription.created', W.stripe.abos.sub_1), () => !!aboZeile('sub_1')],
      ];
      const okTrotzNein = [], nichtNachgeholt = [], nieGeschrieben = [];
      for (const [name, tabelle, baue, wirkung] of faelle) {
        neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo({ status: 'trialing', trial_end: W.jetzt + 3 * TAG });
        const ev = baue();
        W.db.nein.push({ tabelle, op: 'schreiben' });
        const r = await liefere(ev);
        // Ohne diesen Blick wäre ein Handler, der die Tabelle gar nicht anfasst, aus dem falschen Grund in Ordnung.
        if (!W.db.nein[0].treffer) nieGeschrieben.push(name + ' (' + r.status + ')');
        else if (r.status < 500) okTrotzNein.push(name + ' (' + r.status + ')');
        W.db.nein = [];
        const s = await liefere(ev);
        if (s.status !== 200 || !wirkung()) nichtNachgeholt.push(name + ' (' + s.status + ')');
      }
      if (okTrotzNein.length || nieGeschrieben.length || nichtNachgeholt.length) {
        return { ok: false, warum: okTrotzNein.length + ' von ' + faelle.length + ' bekamen ein „ok", obwohl die Datenbank Nein sagte — Stripe wiederholt dann nicht: ' + (okTrotzNein.join(' · ') || '—')
          + '\n         → ' + nieGeschrieben.length + ' kamen gar nicht bis zum Schreiben: ' + (nieGeschrieben.join(' · ') || '—')
          + '\n         → ' + nichtNachgeholt.length + ' ohne Wirkung nach der Wiederholung: ' + (nichtNachgeholt.join(' · ') || '—') };
      }
      // Stripe selbst nicht erreichbar: ebenfalls kein ok
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo(); W.stripe.abosWerfen = true;
      const st = await liefere(ereignis('customer.subscription.updated', W.stripe.abos.sub_1));
      if (st.status < 500) return { ok: false, warum: 'Stripe antwortet nicht auf die Rückfrage, der Webhook sagt trotzdem ' + st.status };
      return { ok: true, info: faelle.length + ' Ereignisarten: Nein der Datenbank → 500, Wiederholung → 200 mit Wirkung · Stripe nicht erreichbar → ' + st.status };
    },
  },
  {
    name: 'Nicht zuordenbar · ein Abo ohne Nutzer oder mit einem unbekannten Preis wird bestätigt (Wiederholen hilft nicht) — aber der Grund steht in der Ereigniszeile, nicht nirgends',
    lauf: async () => {
      neueWelt();
      W.stripe.kunden.cus_niemand = { id: 'cus_niemand', object: 'customer', metadata: {} };
      W.stripe.abos.sub_n = abo({ id: 'sub_n', nutzer: null, kunde: 'cus_niemand' });
      const e1 = ereignis('customer.subscription.created', W.stripe.abos.sub_n);
      const a = await liefere(e1);
      const z1 = ereignisZeile(e1.id);
      if (a.status !== 200 || tab('stripe_subscriptions').length !== 0) return { ok: false, warum: 'ohne Nutzer: status ' + a.status + ' · Zeilen ' + tab('stripe_subscriptions').length };
      if (!z1 || !z1.processed_at || !z1.error || !/sub_n/.test(z1.error)) return { ok: false, warum: 'ohne Nutzer steht kein Grund in der Ereigniszeile: ' + z(z1 && { p: !!z1.processed_at, e: z1.error }) };
      // Der Nutzer steht am KUNDEN (so legt ihn der Checkout an), nicht am Abo
      W.stripe.kunden.cus_ben = { id: 'cus_ben', object: 'customer', metadata: { supabase_user_id: U2 } };
      W.stripe.abos.sub_b = abo({ id: 'sub_b', nutzer: null, kunde: 'cus_ben' });
      const b = await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_b));
      if (b.status !== 200 || !aboZeile('sub_b') || aboZeile('sub_b').user_id !== U2 || sichtTier(U2) !== 'pro') return { ok: false, warum: 'Nutzer nur am Kunden: status ' + b.status + ' · Zeile ' + z(aboZeile('sub_b') && aboZeile('sub_b').user_id) };
      // Keine UUID: die Datenbank würde bei JEDER Wiederholung ablehnen
      W.stripe.abos.sub_k = abo({ id: 'sub_k', metadata: { supabase_user_id: 'anna' }, kunde: 'cus_niemand' });
      const c = await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_k));
      if (c.status !== 200 || aboZeile('sub_k')) return { ok: false, warum: 'ein Nutzer, der keine UUID ist: status ' + c.status + ' (500 hiesse: Stripe wiederholt drei Tage lang dasselbe)' };
      // Dasselbe beim Einmalkauf — dort gibt es kein Abo, das die Id noch einmal prüfen würde
      W.stripe.posten.cs_k = [{ id: 'li_k', price: { id: 'price_leben' } }];
      const c2 = await liefere(ereignis('checkout.session.completed', { id: 'cs_k', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_niemand', payment_intent: 'pi_k', metadata: { supabase_user_id: 'anna', claim_launch_offer: '1' } }));
      if (c2.status !== 200 || tab('stripe_subscriptions').some((x) => x.is_lifetime)) return { ok: false, warum: 'Lifetime-Kauf mit einem Nutzer, der keine UUID ist: status ' + c2.status + ' — ' + c2.text.slice(0, 110) };
      // Unbekannter Preis: die Zeile wird geschrieben (der Status ist eine Tatsache), aber ohne Pro — und es steht da.
      // `price_id` ist live ein Fremdschlüssel auf stripe_prices: der fremde Preis darf NICHT in die Zeile (sonst 500
      // bei jeder Wiederholung) — er steht im Grund.
      W.stripe.kunden.cus_anna = { id: 'cus_anna', metadata: { supabase_user_id: U1 } };
      W.stripe.abos.sub_p = abo({ id: 'sub_p', preis: 'price_fremd' });
      const e4 = ereignis('customer.subscription.created', W.stripe.abos.sub_p);
      const d = await liefere(e4);
      const z4 = ereignisZeile(e4.id);
      if (d.status !== 200 || !aboZeile('sub_p') || aboZeile('sub_p').tier !== 'free' || sichtTier(U1) === 'pro') return { ok: false, warum: 'unbekannter Preis: status ' + d.status + ' · Zeile ' + !!aboZeile('sub_p') + ' · tier ' + (aboZeile('sub_p') && aboZeile('sub_p').tier) + ' · ' + sichtTier(U1) + ' — ' + d.text.slice(0, 150) };
      if (aboZeile('sub_p').price_id !== null || aboZeile('sub_p').status !== 'active' || aboZeile('sub_p').stripe_customer_id !== 'cus_anna') return { ok: false, warum: 'unbekannter Preis: die Zeile trägt ' + z({ price_id: aboZeile('sub_p').price_id, status: aboZeile('sub_p').status }) + ' — erwartet price_id null, Status und Kunde wie bei Stripe' };
      if (!z4.error || !/price_fremd/.test(z4.error)) return { ok: false, warum: 'ein zahlendes Abo ohne Tier, und nichts sagt es: ' + z(z4.error) };
      return { ok: true, info: 'ohne Nutzer: 200, „' + z1.error.slice(0, 52) + '…" · Nutzer am Kunden → zugeordnet · keine UUID → 200 ohne Zeile · fremder Preis → Zeile ohne Preis und ohne Pro, „' + z4.error.slice(0, 40) + '…"' };
    },
  },
  {
    name: 'Geheimnis und Schlüssel · aus der Umgebung, sonst aus app_settings; ohne beides 503; passt nur das ANDERE Geheimnis, bleibt es 400 — und das Log sagt, welches veraltet ist',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const ev = () => ereignis('customer.subscription.created', W.stripe.abos.sub_1);
      // nur app_settings
      const ohneEnv = await lade('webhook', { STRIPE_WEBHOOK_SECRET: null });
      if (!ohneEnv.ok) return { ok: false, warum: 'Laden: ' + ohneEnv.grund };
      neueWelt({ env: { STRIPE_WEBHOOK_SECRET: null } }); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const a = await liefere(ev(), { handler: ohneEnv.handler, geheimnis: GEHEIMNIS_DB });
      if (a.status !== 200 || !aboZeile('sub_1')) return { ok: false, warum: 'Geheimnis nur in app_settings: status ' + a.status };
      // gewechselt, während die Function läuft: das neue Geheimnis gilt ohne Neustart
      tab('app_settings')[0].value = 'ein-neues-geheimnis-nach-dem-wechsel';
      const a2 = await liefere(ev(), { handler: ohneEnv.handler, geheimnis: 'ein-neues-geheimnis-nach-dem-wechsel' });
      if (a2.status !== 200) return { ok: false, warum: 'nach einem Wechsel des Geheimnisses in app_settings: status ' + a2.status + ' — die laufende Function hält am alten fest' };
      // gar keines
      const leer = await lade('webhook', { STRIPE_WEBHOOK_SECRET: null });
      neueWelt({ env: { STRIPE_WEBHOOK_SECRET: null } }); W.db.t.app_settings = [];
      const b = await liefere(ereignis('customer.created', { id: 'cus_x' }), { handler: leer.handler });
      if (b.status !== 503 || tab('stripe_webhook_events').length) return { ok: false, warum: 'ohne Geheimnis: status ' + b.status };
      // kein Stripe-Schlüssel
      const ohneKey = await lade('webhook', { STRIPE_SECRET_KEY: null });
      neueWelt({ env: { STRIPE_SECRET_KEY: null } });
      const c = await liefere(ereignis('customer.created', { id: 'cus_x' }), { handler: ohneKey.handler });
      if (c.status !== 503) return { ok: false, warum: 'ohne Stripe-Schlüssel: status ' + c.status };
      // Umgebung veraltet, app_settings richtig
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const d = await liefere(ev(), { geheimnis: GEHEIMNIS_DB });
      if (d.status !== 400 || aboZeile('sub_1')) return { ok: false, warum: 'unterschrieben mit dem Geheimnis aus app_settings, die Umgebung nennt ein anderes: status ' + d.status + ' — zwei gültige Geheimnisse' };
      if (!W.log.some((l) => /^error: .*app_settings.*STRIPE_WEBHOOK_SECRET/.test(l))) return { ok: false, warum: 'das Log sagt nicht, welches Geheimnis veraltet ist: ' + z(W.log) };
      if (/geheimnis-des-pruefstands/.test(d.text + W.log.join(' '))) return { ok: false, warum: 'ein Geheimnis steht in der Antwort oder im Log' };
      const e = await liefere(ev(), { geheimnis: 'weder-noch' });
      if (e.status !== 400 || W.log.filter((l) => /STRIPE_WEBHOOK_SECRET/.test(l)).length !== 1) return { ok: false, warum: 'ein ganz fremdes Geheimnis löst denselben Hinweis aus' };
      return { ok: true, info: 'nur app_settings → 200 · gewechselt → gilt ohne Neustart · keines → 503 · ohne Schlüssel → 503 · Umgebung veraltet → 400 und: „' + W.log.find((l) => /STRIPE_WEBHOOK_SECRET/.test(l)).slice(7, 90) + '…"' };
    },
  },
  {
    name: 'Gelöschtes Konto · ein spätes Ereignis für eine Person, die es nicht mehr gibt, wird bestätigt und begründet — nicht drei Tage lang mit 500 beantwortet; ein ANDERES Nein der Datenbank bleibt 500',
    lauf: async () => {
      // Cleo (U3) hat ihr Konto gelöscht: auth.users kennt sie nicht mehr, ihr Stripe-Abo läuft noch aus.
      const welt = () => { neueWelt(); W.stripe.kunden.cus_cleo = { id: 'cus_cleo', object: 'customer', metadata: { supabase_user_id: U3 } }; W.stripe.abos.sub_c = abo({ id: 'sub_c', nutzer: U3, kunde: 'cus_cleo', status: 'canceled', canceled_at: W.jetzt, ended_at: W.jetzt }); };
      welt();
      const e1 = ereignis('customer.subscription.deleted', W.stripe.abos.sub_c);
      const a = await liefere(e1);
      const z1 = ereignisZeile(e1.id);
      if (a.status !== 200) return { ok: false, warum: 'Kündigung für ein gelöschtes Konto: status ' + a.status + ' — Stripe wiederholt das drei Tage lang · ' + a.text.slice(0, 160) };
      if (tab('stripe_subscriptions').length || !z1 || z1.processed !== true || !z1.error || !/Konto/.test(z1.error)) return { ok: false, warum: 'gelöschtes Konto: Abo-Zeilen ' + tab('stripe_subscriptions').length + ' · Ereigniszeile ' + z(z1 && { processed: z1.processed, error: z1.error }) };
      welt(); W.stripe.abos.sub_c = abo({ id: 'sub_c', nutzer: U3, kunde: 'cus_cleo', status: 'trialing', trial_end: W.jetzt + 3 * TAG });
      const b = await liefere(ereignis('customer.subscription.trial_will_end', W.stripe.abos.sub_c));
      if (b.status !== 200 || tab('notifications').length) return { ok: false, warum: '„Probezeit endet" für ein gelöschtes Konto: status ' + b.status + ' · Mitteilungen ' + tab('notifications').length };
      welt(); W.stripe.posten.cs_c = [{ id: 'li_c', price: { id: 'price_leben' } }];
      const e3 = ereignis('checkout.session.completed', { id: 'cs_c', object: 'checkout.session', mode: 'payment', payment_status: 'paid', customer: 'cus_cleo', payment_intent: 'pi_c', metadata: { supabase_user_id: U3, claim_launch_offer: '1' } });
      const c = await liefere(e3);
      if (c.status !== 200 || tab('stripe_subscriptions').length || tab('launch_offer_usage').length || !/Konto/.test(String(ereignisZeile(e3.id).error))) return { ok: false, warum: 'Lifetime-Kauf für ein gelöschtes Konto: status ' + c.status + ' · Zeilen ' + tab('stripe_subscriptions').length + '/' + tab('launch_offer_usage').length + ' · Grund ' + z(ereignisZeile(e3.id).error) };
      // Gegenrichtung: ein fremder PREIS in der Lifetime-Zeile wäre auch 23503 — das ist KEIN gelöschtes Konto
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      W.db.nein.push({ tabelle: 'stripe_subscriptions', op: 'schreiben', code: '23503', message: 'insert or update on table "stripe_subscriptions" violates foreign key constraint "stripe_subscriptions_price_id_fkey1"' });
      const d = await liefere(ereignis('customer.subscription.created', W.stripe.abos.sub_1));
      if (d.status < 500) return { ok: false, warum: 'ein verletzter Fremdschlüssel, der NICHT user_id ist, wurde als „Konto weg" bestätigt: status ' + d.status };
      return { ok: true, info: 'Kündigung, „Probezeit endet" und Lifetime-Kauf für ein gelöschtes Konto → je 200, 0 Zeilen, Grund: „' + String(z1.error).slice(0, 58) + '…" · ein anderer Fremdschlüssel bleibt ' + d.status };
    },
  },
  {
    name: 'Buchführung · ein verarbeitetes Ereignis trägt `processed = true` (das liest die Admin-Übersicht als „unverarbeitet"), ein gescheitertes nicht',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_1 = abo();
      const e1 = ereignis('customer.subscription.created', W.stripe.abos.sub_1), e2 = ereignis('customer.created', { id: 'cus_x', object: 'customer' });
      await liefere(e1); await liefere(e2);
      const offen = tab('stripe_webhook_events').filter((e) => e.processed !== true || !e.processed_at);
      if (tab('stripe_webhook_events').length !== 2 || offen.length) return { ok: false, warum: offen.length + ' von ' + tab('stripe_webhook_events').length + ' verarbeiteten Ereignissen stehen auf processed = ' + z(offen.map((e) => e.processed)) + ' — fn_admin_stripe_overview zählt sie als „unverarbeitet", für immer' };
      const e3 = ereignis('customer.subscription.updated', W.stripe.abos.sub_1);
      W.db.nein.push({ tabelle: 'stripe_subscriptions', op: 'schreiben' });
      const f = await liefere(e3);
      const z3 = ereignisZeile(e3.id);
      if (f.status < 500 || !z3 || z3.processed === true || z3.processed_at) return { ok: false, warum: 'ein GESCHEITERTES Ereignis gilt als verarbeitet: ' + z(z3 && { processed: z3.processed, processed_at: z3.processed_at }) };
      const sicht = fs.readFileSync(path.join(WURZEL, 'supabase', 'migrations', 'v28_65_admin_stripe_overview_rpc.sql'), 'utf8');
      if (!/WHERE processed=false/.test(sicht)) return { ok: false, warum: 'fn_admin_stripe_overview liest `processed` nicht mehr so — diesen Fall nachziehen' };
      return { ok: true, info: '2 verarbeitet → processed = true · 1 gescheitert → processed bleibt false, Stripe bekommt ' + f.status };
    },
  },
  {
    name: 'Verzögerte Zahlungsart · „Checkout fertig" kommt UNBEZAHLT und schaltet nichts frei — ohne einen Fehler zu behaupten; erst „Zahlung eingegangen" schaltet Lifetime frei',
    lauf: async () => {
      neueWelt(); ANNA_KUNDE();
      W.stripe.posten.cs_v = [{ id: 'li_v', price: { id: 'price_leben' } }];
      const sitzung = (bezahlt) => ({ id: 'cs_v', object: 'checkout.session', mode: 'payment', payment_status: bezahlt ? 'paid' : 'unpaid', customer: 'cus_anna', payment_intent: 'pi_v', amount_total: 4560, metadata: { supabase_user_id: U1, claim_launch_offer: '1' } });
      const e1 = ereignis('checkout.session.completed', sitzung(false));
      const a = await liefere(e1);
      if (a.status !== 200 || sichtTier(U1) !== 'free' || tab('stripe_subscriptions').length) return { ok: false, warum: 'unbezahlt: status ' + a.status + ' · ' + sichtTier(U1) };
      if (ereignisZeile(e1.id).error) return { ok: false, warum: 'der gewöhnliche Stand einer verzögerten Zahlung steht als Fehler in der Ereigniszeile: ' + z(ereignisZeile(e1.id).error) };
      const b = await liefere(ereignis('checkout.session.async_payment_succeeded', sitzung(true)));
      const zeile = aboZeile('lifetime_' + U1);
      if (b.status !== 200 || !zeile || zeile.is_lifetime !== true || sichtTier(U1) !== 'lifetime' || tab('launch_offer_usage').length !== 1) return { ok: false, warum: 'nach „Zahlung eingegangen": status ' + b.status + ' · Zeile ' + !!zeile + ' · ' + sichtTier(U1) + ' — bezahlt, aber nie freigeschaltet' };
      return { ok: true, info: 'completed/unpaid → 200, free, kein Vermerk · async_payment_succeeded → lifetime, Launch-Zähler 1' };
    },
  },
  {
    name: 'Marktplatz und Experten-Gebühr · der Status eines Verkäufer-Kontos folgt Stripe; die bezahlte Gebühr bestätigt genau diese Verifikation — und eine Zahlung ohne Eintrag sagt es',
    lauf: async () => {
      const konto = async (felder, start) => {
        neueWelt(); tab('marketplace_sellers').push({ user_id: U2, stripe_account_id: 'acct_1', status: start || 'pending' });
        const r = await liefere(ereignis('account.updated', Object.assign({ id: 'acct_1', object: 'account', business_type: 'individual', charges_enabled: false, payouts_enabled: false, details_submitted: false, requirements: { currently_due: [], disabled_reason: null } }, felder)));
        return r.status === 200 ? tab('marketplace_sellers')[0].status : 'status ' + r.status;
      };
      const t = [
        [await konto({ charges_enabled: true, payouts_enabled: true, details_submitted: true }), 'active'],
        [await konto({ requirements: { currently_due: ['external_account'], disabled_reason: null } }), 'restricted'],
        [await konto({ requirements: { currently_due: [], disabled_reason: 'requirements.pending_verification' } }), 'restricted'],
        [await konto({ requirements: { currently_due: [], disabled_reason: 'rejected.fraud' } }), 'disabled'],
        [await konto({}), 'pending'],
      ];
      for (const [ist, soll] of t) if (ist !== soll) return { ok: false, warum: 'Konto: ' + ist + ' statt ' + soll };
      neueWelt();
      const fremd = await liefere(ereignis('account.updated', { id: 'acct_fremd', object: 'account', charges_enabled: true, payouts_enabled: true, details_submitted: true }));
      if (fremd.status !== 200 || schreibRufe('marketplace_sellers').length) return { ok: false, warum: 'ein unbekanntes Konto wurde beschrieben' };
      neueWelt(); tab('marketplace_sellers').push({ user_id: U2, stripe_account_id: 'acct_1', status: 'active', charges_enabled: true, payouts_enabled: true });
      const weg = await liefere(ereignis('account.application.deauthorized', { id: 'ca_1', object: 'application' }, { account: 'acct_1' }));
      if (weg.status !== 200 || tab('marketplace_sellers')[0].status !== 'disabled' || tab('marketplace_sellers')[0].charges_enabled !== false) return { ok: false, warum: 'getrennt: ' + z(tab('marketplace_sellers')[0]) };
      // Experten-Gebühr
      neueWelt(); tab('expert_verifications').push({ post_id: POST1, expert_id: U2, status: 'pending', fee_paid_chf: 0 });
      const sitzung = (post) => ereignis('checkout.session.completed', { id: 'cs_e_' + post, object: 'checkout.session', mode: 'payment', payment_status: 'paid', payment_intent: 'pi_e', amount_total: 50, metadata: { kind: 'expert_verification', supabase_user_id: U1, post_id: post, expert_id: U2 } });
      const e1 = await liefere(sitzung(POST1));
      const v = tab('expert_verifications')[0];
      if (e1.status !== 200 || v.status !== 'verified' || v.fee_paid_chf !== 0.5 || v.stripe_payment_intent_id !== 'pi_e') return { ok: false, warum: 'Gebühr: status ' + e1.status + ' · ' + z(v) };
      if (tab('stripe_subscriptions').length || sichtTier(U1) !== 'free') return { ok: false, warum: 'die Experten-Gebühr hat ein Abo oder Lifetime angelegt' };
      const ev2 = sitzung(POST2);
      const e2 = await liefere(ev2);
      const ez = ereignisZeile(ev2.id);
      if (e2.status !== 200 || !ez.error) return { ok: false, warum: 'bezahlt, aber keine Verifikation dazu — und die Ereigniszeile schweigt: status ' + e2.status + ' · ' + z(ez.error) };
      // post_id und expert_id sind live uuid: etwas anderes lehnte die Datenbank bei JEDER Wiederholung ab (22P02)
      const ev3 = sitzung('beitrag-nummer-eins');
      const e3 = await liefere(ev3);
      const ez3 = ereignisZeile(ev3.id);
      if (e3.status !== 200 || !ez3 || !ez3.error || W.db.prot.some((p) => p.tabelle === 'expert_verifications' && p.filter.some((f) => f[1] === 'beitrag-nummer-eins'))) return { ok: false, warum: 'eine Beitrags-Id, die keine UUID ist: status ' + e3.status + ' (500 hiesse: Stripe wiederholt drei Tage lang) · Grund ' + z(ez3 && ez3.error) };
      const pi = await liefere(ereignis('payment_intent.succeeded', { id: 'pi_q', object: 'payment_intent', amount_received: 50, metadata: { kind: 'expert_verification', post_id: 'x', expert_id: U2 } }));
      if (pi.status !== 200) return { ok: false, warum: 'dieselbe Gebühr über einen PaymentIntent mit einer Id, die keine UUID ist: status ' + pi.status };
      return { ok: true, info: t.length + ' Konto-Zustände · unbekanntes Konto unberührt · getrennt → disabled · Gebühr 0.50 CHF → verified · Zahlung ohne Eintrag: „' + String(ez.error).slice(0, 50) + '…" · Id ohne UUID-Form → 200 mit Grund, keine Anfrage an die Datenbank' };
    },
  },
];

// ══ RAND · stripe-checkout ════════════════════════════════════════════════════
const CHECKOUT = [
  {
    name: 'Nur angemeldet · ohne oder mit falschem Token 401 — kein Stripe-Kunde, keine Sitzung, kein Blick in die Preise',
    lauf: async () => {
      neueWelt();
      const a = await rufe('checkout', { token: null, body: { price_id: 'price_monat' } });
      const b = await rufe('checkout', { token: 'jwt-gefaelscht', body: { price_id: 'price_monat' } });
      const c = await rufe('checkout', { token: null, body: {} });
      if (a.status !== 401 || b.status !== 401 || c.status !== 401) return { ok: false, warum: 'status ' + a.status + ' / ' + b.status + ' / ' + c.status + ' (ohne Preis und ohne Anmeldung muss 401 kommen, nicht 400)' };
      if (W.stripe.rufe.length) return { ok: false, warum: W.stripe.rufe.length + ' Stripe-Aufrufe ohne Anmeldung: ' + W.stripe.rufe.map((r) => r.was).join(', ') };
      const g = await rufe('checkout', { method: 'GET' });
      const o = await rufe('checkout', { method: 'OPTIONS' });
      if (g.status !== 405 || o.status !== 200) return { ok: false, warum: 'GET ' + g.status + ' · OPTIONS ' + o.status };
      return { ok: true, info: 'ohne Token 401 · falscher Token 401 · 0 Stripe-Aufrufe · GET 405' };
    },
  },
  {
    name: 'Der Kauf kommt zustande · Stripe nimmt den Aufruf an: Abo mit 7 Tagen Probezeit, Zahlungsart hinterlegt, KEINE feste Liste von Zahlungsarten — was im Dashboard an ist, erscheint (Karte, TWINT)',
    lauf: async () => {
      neueWelt();
      const r = await rufe('checkout', { body: { price_id: 'price_monat', claim_launch_offer: false, success_url: 'https://green-scan.ch/?billing=success&popup=1', cancel_url: 'https://green-scan.ch/?billing=cancel&popup=1', trial_days: 7 } });
      if (r.status !== 200 || !r.daten || !/^https:\/\/checkout\.stripe\.com\//.test(String(r.daten.url))) return { ok: false, warum: 'status ' + r.status + ' · ' + r.text.slice(0, 160) };
      const s = stripeRufe('checkout.sessions.create');
      if (s.length !== 1) return { ok: false, warum: s.length + ' Sitzungen angelegt' };
      const p = s[0].arg;
      if ('payment_method_types' in p || 'automatic_payment_methods' in p) return { ok: false, warum: 'der Aufruf nennt eine feste Zahlungsart: ' + Object.keys(p).join(', ') };
      if (p.mode !== 'subscription' || z(p.line_items) !== z([{ price: 'price_monat', quantity: 1 }]) || p.subscription_data.trial_period_days !== 7 || p.payment_method_collection !== 'always') return { ok: false, warum: 'Aufruf: ' + z(p) };
      if (p.metadata.supabase_user_id !== U1 || p.subscription_data.metadata.supabase_user_id !== U1) return { ok: false, warum: 'der Nutzer reist nicht mit: ' + z(p.metadata) };
      if (r.daten.mode !== 'subscription' || r.daten.trial_days !== 7) return { ok: false, warum: 'Antwort: ' + z(r.daten) };
      if (p.locale !== 'auto') return { ok: false, warum: 'ohne Angabe der App entscheidet der Browser (auto) — an Stripe ging „' + p.locale + '"' };
      for (const [wunsch, soll] of [['fr', 'fr'], ['it', 'it'], ['en', 'en'], ['de', 'de'], ['xx', 'auto'], [42, 'auto']]) {
        await rufe('checkout', { body: { price_id: 'price_monat', locale: wunsch } });
        const letzte = stripeRufe('checkout.sessions.create').slice(-1)[0].arg;
        if (letzte.locale !== soll) return { ok: false, warum: 'Sprache ' + z(wunsch) + ': an Stripe ging „' + letzte.locale + '" statt „' + soll + '"' };
      }
      W.stripe.rufe = W.stripe.rufe.filter((x) => x.was !== 'checkout.sessions.create').concat(s);
      const j = await rufe('checkout', { body: { price_id: 'price_jahr', trial_days: 7 } });
      const l = await rufe('checkout', { body: { price_id: 'price_leben', claim_launch_offer: true } });
      const pl = stripeRufe('checkout.sessions.create')[2] && stripeRufe('checkout.sessions.create')[2].arg;
      if (j.status !== 200 || l.status !== 200 || !pl || pl.mode !== 'payment' || pl.subscription_data || z(pl.line_items) !== z([{ price: 'price_leben', quantity: 1 }])) return { ok: false, warum: 'Jahr ' + j.status + ' · Lifetime ' + l.status + ' · ' + z(pl) };
      return { ok: true, info: '3 Käufe (Monat, Jahr, Lifetime) → 3 Sitzungen · Sprache der App reist mit (fr/it/en/de, sonst auto) · Parameter: ' + Object.keys(p).sort().join(', ') };
    },
  },
  {
    name: 'Kein Preis aus dem Browser · gekauft wird nur ein AKTIVER Preis aus stripe_prices; ein fremder, alter oder erfundener Preis ergibt 400 und keine Sitzung; ein Betrag in der Anfrage wird nie gelesen',
    lauf: async () => {
      neueWelt();
      const nein = [['price_fremd', 'ein Preis, den es bei Stripe gibt, aber nicht in stripe_prices'], ['price_alt', 'der stillgelegte Plus-Preis (active = false)'], ['price_gibt_es_nicht', 'ein erfundener Preis'], ['', 'kein Preis'], [null, 'null']];
      for (const [id, was] of nein) {
        const r = await rufe('checkout', { body: { price_id: id } });
        if (r.status !== 400) return { ok: false, warum: was + ': status ' + r.status + ' statt 400' };
      }
      if (stripeRufe('checkout.sessions.create').length) return { ok: false, warum: stripeRufe('checkout.sessions.create').length + ' Sitzungen für Preise, die nicht angeboten werden' };
      const r = await rufe('checkout', { body: { price_id: 'price_monat', amount: 1, unit_amount: 1, currency: 'usd', mode: 'payment', quantity: 0, line_items: [{ price: 'price_fremd', quantity: 1 }], price_data: { currency: 'chf', unit_amount: 1, product_data: { name: 'x' } }, customer: 'cus_fremd', metadata: { supabase_user_id: U2 } } });
      const p = stripeRufe('checkout.sessions.create')[0] && stripeRufe('checkout.sessions.create')[0].arg;
      if (r.status !== 200 || !p) return { ok: false, warum: 'ein gültiger Preis mit Beiwerk: status ' + r.status + ' · ' + r.text.slice(0, 120) };
      if (z(p.line_items) !== z([{ price: 'price_monat', quantity: 1 }]) || p.mode !== 'subscription' || p.customer === 'cus_fremd' || p.metadata.supabase_user_id !== U1 || z(p).indexOf('price_data') >= 0 || z(p).indexOf('usd') >= 0) return { ok: false, warum: 'etwas aus der Anfrage ging an Stripe: ' + z(p) };
      const lk = await rufe('checkout', { body: { lookup_key: 'pro_yearly' } });
      const p2 = stripeRufe('checkout.sessions.create')[1] && stripeRufe('checkout.sessions.create')[1].arg;
      if (lk.status !== 200 || !p2 || p2.line_items[0].price !== 'price_jahr') return { ok: false, warum: 'Kauf über den Namen des Angebots (lookup_key): status ' + lk.status };
      const lk2 = await rufe('checkout', { body: { lookup_key: 'plus_monthly' } });
      if (lk2.status !== 400) return { ok: false, warum: 'ein stillgelegtes Angebot über seinen Namen: status ' + lk2.status };
      return { ok: true, info: nein.length + ' fremde Preise → 400, 0 Sitzungen · Betrag, Währung, Modus, Kunde und Nutzer aus der Anfrage: ignoriert · lookup_key geht auch' };
    },
  },
  {
    name: 'Rückkehr-Adressen · nach dem Bezahlen geht es nur auf den eigenen Ursprung zurück; eine fremde Adresse wird durch die Vorgabe ersetzt, der Kauf kommt trotzdem zustande',
    lauf: async () => {
      neueWelt();
      const mit = async (su, cu) => { const r = await rufe('checkout', { body: { price_id: 'price_monat', success_url: su, cancel_url: cu } }); const s = stripeRufe('checkout.sessions.create'); return { status: r.status, p: s.length ? s[s.length - 1].arg : null }; };
      const a = await mit('https://green-scan.ch/?billing=success&popup=1', 'https://green-scan.ch/?billing=cancel&popup=1');
      if (a.status !== 200 || a.p.success_url !== 'https://green-scan.ch/?billing=success&popup=1' || a.p.cancel_url !== 'https://green-scan.ch/?billing=cancel&popup=1') return { ok: false, warum: 'die eigene Adresse: ' + z(a) };
      const boese = ['https://boese.example/danke', 'https://green-scan.ch@boese.example/', 'javascript:alert(1)', 'https://green-scan.ch.boese.example/?billing=success', '//boese.example'];
      for (const u of boese) {
        const b = await mit(u, u);
        if (b.status !== 200) return { ok: false, warum: 'eine fremde Adresse hat den Kauf verhindert: status ' + b.status };
        for (const feld of ['success_url', 'cancel_url']) {
          let ursprung = ''; try { ursprung = new URL(b.p[feld]).origin; } catch (_) { ursprung = '(keine Adresse)'; }
          if (ursprung !== 'https://green-scan.ch') return { ok: false, warum: feld + ' „' + u + '" ging an Stripe als „' + b.p[feld] + '" — nach dem Bezahlen landet die Person auf ' + ursprung };
        }
      }
      const v = await mit('https://54e6aba1.greenscan-app.pages.dev/?billing=success&popup=1', undefined);
      if (v.p.success_url !== 'https://54e6aba1.greenscan-app.pages.dev/?billing=success&popup=1' || new URL(v.p.cancel_url).origin !== 'https://green-scan.ch') return { ok: false, warum: 'die eigene Vorschau: ' + z(v.p.success_url) + ' / ' + z(v.p.cancel_url) };
      const o = await mit(undefined, undefined);
      if (!/^https:\/\/green-scan\.ch\/\?billing=success/.test(o.p.success_url) || !/^https:\/\/green-scan\.ch\/\?billing=cancel/.test(o.p.cancel_url)) return { ok: false, warum: 'ohne Adressen: ' + z([o.p.success_url, o.p.cancel_url]) };
      return { ok: true, info: 'eigene Adresse und eigene Vorschau bleiben · ' + boese.length + ' fremde → https://green-scan.ch/…, Kauf 200 · ohne Angabe die Vorgabe' };
    },
  },
  {
    name: 'Probezeit · sieben Tage nur beim ERSTEN Abo; die Anfrage kann kürzen, nie verlängern; wer schon ein Abo hatte, zahlt sofort',
    lauf: async () => {
      const alt = { id: 'sub_frueher', user_id: U1, status: 'canceled', stripe_customer_id: 'cus_anna', is_lifetime: false, created_at: '2026-01-01T00:00:00Z' };
      const tage = async (wunsch, frueher) => {
        neueWelt();
        if (frueher) { ANNA_KUNDE(); tab('stripe_subscriptions').push(Object.assign({}, alt)); }
        const body = { price_id: 'price_monat' }; if (wunsch !== undefined) body.trial_days = wunsch;
        const r = await rufe('checkout', { body });
        const s = stripeRufe('checkout.sessions.create')[0];
        if (r.status !== 200 || !s) return 'status ' + r.status;
        return ('trial_period_days' in s.arg.subscription_data ? s.arg.subscription_data.trial_period_days : 0) + '/' + r.daten.trial_days;
      };
      const t = [[7, false, '7/7'], [undefined, false, '7/7'], [30, false, '7/7'], [3, false, '3/3'], [0, false, '0/0'], [7, true, '0/0'], [undefined, true, '0/0']];
      for (const [wunsch, frueher, soll] of t) {
        const ist = await tage(wunsch, frueher);
        if (ist !== soll) return { ok: false, warum: 'Wunsch ' + z(wunsch) + (frueher ? ' mit früherem Abo' : '') + ': an Stripe/in der Antwort ' + ist + ' statt ' + soll };
      }
      return { ok: true, info: t.length + ' Fälle: ohne Angabe 7 · 30 → 7 · 3 → 3 · 0 → 0 · mit früherem Abo 0' };
    },
  },
  {
    name: 'Launch-Angebot · ob es noch frei ist, entscheidet der PREIS und der Zähler der Datenbank — gefragt als die PERSON, gelesen als das Objekt, das die Funktion wirklich schickt; ausverkauft 410, schon gekauft 409, nicht feststellbar 503 — nie eine Sitzung',
    lauf: async () => {
      const andere = (n) => { for (let i = 0; i < n; i++) tab('launch_offer_usage').push({ user_id: '9' + String(i).padStart(7, '0') + '-0000-4000-8000-000000000000', subscription_id: 'lifetime_x' + i }); };
      // frei: der erste Lifetime-Kauf kommt zustande — genau der Fall, den ein Vergleich mit `true` ablehnte
      neueWelt();
      const frei = await rufe('checkout', { body: { price_id: 'price_leben', claim_launch_offer: false } });
      const p = stripeRufe('checkout.sessions.create')[0] && stripeRufe('checkout.sessions.create')[0].arg;
      if (frei.status !== 200 || !p || p.mode !== 'payment' || p.metadata.claim_launch_offer !== '1') return { ok: false, warum: 'frei (0 von 100 vergeben): status ' + frei.status + ' · ' + frei.text.slice(0, 120) + ' · Marke ' + z(p && p.metadata) + ' — ohne die Marke zählt der Webhook den Kauf nicht' };
      const frage = W.db.prot.filter((x) => x.tabelle === 'rpc/launch_offer_available');
      if (frage.length !== 1 || frage[0].dienst !== false || frage[0].uid !== U1) return { ok: false, warum: 'die Datenbankfunktion wurde ' + frage.length + '× gefragt, als ' + z(frage[0] && { dienst: frage[0].dienst, uid: frage[0].uid }) + ' — mit dem Service-Schlüssel ist auth.uid() leer und die Antwort immer „frei"' };
      // 99 vergeben: noch frei · 100 vergeben: ausverkauft, in jeder Schreibweise der Anfrage
      neueWelt(); andere(99);
      const knapp = await rufe('checkout', { body: { price_id: 'price_leben' } });
      if (knapp.status !== 200) return { ok: false, warum: '99 von 100 vergeben: status ' + knapp.status };
      neueWelt(); andere(100);
      const a = await rufe('checkout', { body: { price_id: 'price_leben', claim_launch_offer: true } });
      const b = await rufe('checkout', { body: { price_id: 'price_leben', claim_launch_offer: false } });
      const c = await rufe('checkout', { body: { price_id: 'price_leben' } });
      if (a.status !== 410 || b.status !== 410 || c.status !== 410 || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'ausverkauft (100 vergeben): mit Feld ' + a.status + ' · Feld auf false ' + b.status + ' · ohne Feld ' + c.status + ' · Sitzungen ' + stripeRufe('checkout.sessions.create').length + ' — wer das Feld weglässt, kauft das Angebot nach dem hundertsten Mal' };
      if (!a.daten || a.daten.grund !== 'launch_ausverkauft') return { ok: false, warum: 'ausverkauft ohne Grund-Kennung für die App: ' + a.text.slice(0, 120) };
      const m = await rufe('checkout', { body: { price_id: 'price_monat', claim_launch_offer: true } });
      if (m.status !== 200) return { ok: false, warum: 'ein gewöhnliches Abo scheitert am Launch-Zähler: ' + m.status };
      if (stripeRufe('checkout.sessions.create')[0].arg.metadata.claim_launch_offer !== '0') return { ok: false, warum: 'ein Abo trägt die Launch-Marke aus der Anfrage' };
      if (W.db.prot.some((x) => x.tabelle === 'rpc/launch_offer_available' && x.uid === U1) === false) return { ok: false, warum: 'die Funktion wurde nicht als Anna gefragt' };
      // schon gekauft: Anna hat ihren Platz — das ist nicht „ausverkauft"
      neueWelt(); andere(3); tab('launch_offer_usage').push({ user_id: U1, subscription_id: 'lifetime_' + U1 });
      const schon = await rufe('checkout', { body: { price_id: 'price_leben' } });
      if (schon.status !== 409 || !schon.daten || schon.daten.grund !== 'launch_schon_gekauft' || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'schon gekauft: status ' + schon.status + ' · ' + schon.text.slice(0, 120) };
      const ben = await rufe('checkout', { token: 'jwt-ben', body: { price_id: 'price_leben' } });
      if (ben.status !== 200) return { ok: false, warum: 'Annas Kauf sperrt Ben aus: status ' + ben.status };
      // nicht feststellbar: die Funktion ist nicht lesbar, oder sie antwortet in einer Form, die niemand gemessen hat
      neueWelt(); W.db.nein.push({ tabelle: 'rpc/launch_offer_available' });
      const e = await rufe('checkout', { body: { price_id: 'price_leben' } });
      if (e.status < 500 || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'der Zähler ist nicht lesbar, verkauft wird trotzdem: status ' + e.status };
      const formen = [true, false, 'true', null, [], { available: true }, { available: 1, logged_in: true }, { frei: true }];
      for (const form of formen) {
        neueWelt(); W.db.rpc.launch_offer_available = form;
        const r = await rufe('checkout', { body: { price_id: 'price_leben' } });
        if (r.status < 500 || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'die Funktion antwortet ' + z(form) + ' (so sah sie nie aus): status ' + r.status + ' · Sitzungen ' + stripeRufe('checkout.sessions.create').length + ' — geraten statt gelesen' };
        if (!r.daten || r.daten.grund !== 'launch_unklar') return { ok: false, warum: 'Antwort ' + z(form) + ': „nicht feststellbar" ohne Grund-Kennung — ' + r.text.slice(0, 100) };
      }
      return { ok: true, info: 'frei → 200 mit Marke „1", gefragt als Anna · 99 → frei · 100 → 410 in drei Schreibweisen, 0 Sitzungen · schon gekauft → 409 (Ben kauft trotzdem) · nicht lesbar → ' + e.status + ' · ' + formen.length + ' ungemessene Antwortformen → 503, nie verkauft' };
    },
  },
  {
    name: 'Der Stripe-Kunde · wer schon einen hat, bekommt keinen zweiten: aus der Abo-Zeile, sonst über die Suche bei Stripe; nur wer keinen hat, bekommt genau einen — und `stripe_customers` liest niemand',
    lauf: async () => {
      neueWelt();
      await rufe('checkout', { body: { price_id: 'price_monat' } });
      const erster = stripeRufe('customers.create');
      if (erster.length !== 1 || erster[0].arg.metadata.supabase_user_id !== U1) return { ok: false, warum: 'erster Kauf: ' + erster.length + ' Kunden angelegt · ' + z(erster[0] && erster[0].arg) };
      await rufe('checkout', { body: { price_id: 'price_jahr' } });
      await rufe('checkout', { body: { price_id: 'price_monat' } });
      if (stripeRufe('customers.create').length !== 1) return { ok: false, warum: '3 Kaufversuche → ' + stripeRufe('customers.create').length + ' neue Stripe-Kunden (erwartet 1)' };
      const kunden = stripeRufe('checkout.sessions.create').map((s) => s.arg.customer);
      if (kunden.length !== 3 || kunden.some((k) => k !== kunden[0])) return { ok: false, warum: 'die drei Sitzungen gehören verschiedenen Kunden: ' + kunden.join(', ') };
      neueWelt(); ANNA_KUNDE();
      tab('stripe_subscriptions').push({ id: 'sub_frueher', user_id: U1, status: 'canceled', stripe_customer_id: 'cus_anna', is_lifetime: false, created_at: '2026-01-01T00:00:00Z' });
      await rufe('checkout', { body: { price_id: 'price_monat' } });
      if (stripeRufe('customers.create').length !== 0 || stripeRufe('checkout.sessions.create')[0].arg.customer !== 'cus_anna') return { ok: false, warum: 'mit Abo-Zeile: ' + stripeRufe('customers.create').length + ' neue Kunden · Sitzung für ' + (stripeRufe('checkout.sessions.create')[0] && stripeRufe('checkout.sessions.create')[0].arg.customer) };
      // Ben kauft: Annas Kunde bleibt Annas
      const ben = await rufe('checkout', { token: 'jwt-ben', body: { price_id: 'price_monat' } });
      const letzte = stripeRufe('checkout.sessions.create')[1].arg;
      if (ben.status !== 200 || letzte.customer === 'cus_anna' || letzte.metadata.supabase_user_id !== U2) return { ok: false, warum: 'Ben kauft auf Annas Kunden: ' + z(letzte.customer) };
      if (W.db.prot.some((p) => p.tabelle === 'stripe_customers')) return { ok: false, warum: 'stripe_customers wird angesprochen — die Tabelle gibt es nicht' };
      // Die Suche bei Stripe scheitert: verkauft wird trotzdem, und das Log sagt, warum ein neuer Kunde entsteht
      neueWelt(); W.stripe.sucheWirft = true;
      const ohneSuche = await rufe('checkout', { body: { price_id: 'price_monat' } });
      if (ohneSuche.status !== 200 || stripeRufe('customers.create').length !== 1 || !W.log.some((l) => /^warn: .*nicht feststellbar/.test(l))) return { ok: false, warum: 'die Suche bei Stripe scheitert: status ' + ohneSuche.status + ' · neue Kunden ' + stripeRufe('customers.create').length + ' · Log ' + z(W.log) };
      return { ok: true, info: '3 Kaufversuche → 1 neuer Kunde, 3 Sitzungen für denselben · mit Abo-Zeile → 0 neue · Ben bekommt seinen eigenen · Suche bei Stripe gescheitert → Kauf 200, mit einem Satz im Log' };
    },
  },
  {
    name: 'Die Datenbank sagt Nein · sind die Preise oder die früheren Abos nicht lesbar, wird nichts verkauft (500) — und ohne Stripe-Schlüssel 503',
    lauf: async () => {
      neueWelt(); W.db.nein.push({ tabelle: 'stripe_prices' });
      const a = await rufe('checkout', { body: { price_id: 'price_monat' } });
      if (a.status < 500 || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'Preise nicht lesbar: status ' + a.status + ' · Sitzungen ' + stripeRufe('checkout.sessions.create').length + ' — verkauft wurde ein Preis, den niemand geprüft hat' };
      neueWelt(); W.db.nein.push({ tabelle: 'stripe_subscriptions' });
      const b = await rufe('checkout', { body: { price_id: 'price_monat' } });
      if (b.status < 500 || stripeRufe('checkout.sessions.create').length) return { ok: false, warum: 'frühere Abos nicht lesbar: status ' + b.status + ' — jeder bekäme wieder eine Probezeit' };
      const ohneKey = await lade('checkout', { STRIPE_SECRET_KEY: null });
      neueWelt({ env: { STRIPE_SECRET_KEY: null } });
      const c = await rufe('checkout', { handler: ohneKey.handler, body: { price_id: 'price_monat' } });
      if (c.status !== 503) return { ok: false, warum: 'ohne Stripe-Schlüssel: ' + c.status };
      neueWelt();
      const d = await rufe('checkout', { body: '{kaputt' });
      if (d.status !== 400 || W.stripe.rufe.length) return { ok: false, warum: 'kaputtes JSON: status ' + d.status };
      if (/stripe-schluessel-des-pruefstands/.test(a.text + b.text + c.text + d.text)) return { ok: false, warum: 'der Schlüssel steht in einer Antwort' };
      return { ok: true, info: 'Preise nicht lesbar → ' + a.status + ' · Abos nicht lesbar → ' + b.status + ' · ohne Schlüssel 503 · kaputtes JSON 400 — jedes Mal 0 Sitzungen' };
    },
  },
];

// ══ RAND · stripe-portal ══════════════════════════════════════════════════════
const PORTAL = [
  {
    name: 'Nur angemeldet, nur der eigene Kunde · das Portal öffnet sich für den Kunden der angemeldeten Person — eine Kunden-Id in der Anfrage wird nie gelesen',
    lauf: async () => {
      const welt = () => {
        neueWelt(); ANNA_KUNDE();
        W.stripe.kunden.cus_ben = { id: 'cus_ben', object: 'customer', metadata: { supabase_user_id: U2 } };
        W.stripe.abos.sub_a = abo({ id: 'sub_a' }); W.stripe.abos.sub_b = abo({ id: 'sub_b', nutzer: U2, kunde: 'cus_ben' });
        tab('stripe_subscriptions').push({ id: 'sub_a', user_id: U1, status: 'active', cancel_at_period_end: false, stripe_customer_id: 'cus_anna', is_lifetime: false, created_at: '2026-10-01T00:00:00Z' });
        tab('stripe_subscriptions').push({ id: 'sub_b', user_id: U2, status: 'active', cancel_at_period_end: false, stripe_customer_id: 'cus_ben', is_lifetime: false, created_at: '2026-10-02T00:00:00Z' });
      };
      welt();
      const a = await rufe('portal', { token: null, body: {} });
      const b = await rufe('portal', { token: 'jwt-gefaelscht', body: {} });
      if (a.status !== 401 || b.status !== 401 || W.stripe.rufe.length) return { ok: false, warum: 'ohne Anmeldung: ' + a.status + ' / ' + b.status + ' · Stripe-Aufrufe ' + W.stripe.rufe.length };
      const c = await rufe('portal', { body: {} });
      const s = stripeRufe('billingPortal.sessions.create');
      if (c.status !== 200 || s.length !== 1 || s[0].arg.customer !== 'cus_anna' || !/^https:\/\/billing\.stripe\.com\//.test(String(c.daten && c.daten.url))) return { ok: false, warum: 'Anna: status ' + c.status + ' · Portal für ' + z(s[0] && s[0].arg.customer) + ' · ' + c.text.slice(0, 140) };
      welt();
      const d = await rufe('portal', { body: { customer: 'cus_ben', customer_id: 'cus_ben', stripe_customer_id: 'cus_ben', user_id: U2, flow: 'cancel', subscription: 'sub_b', subscription_id: 'sub_b' } });
      const s2 = stripeRufe('billingPortal.sessions.create');
      if (d.status !== 200 || s2.length !== 1 || s2[0].arg.customer !== 'cus_anna') return { ok: false, warum: 'Anna nennt Bens Kunden: status ' + d.status + ' · Portal für ' + z(s2[0] && s2[0].arg.customer) };
      if (z(s2[0].arg).indexOf('sub_b') >= 0 || z(s2[0].arg).indexOf('cus_ben') >= 0) return { ok: false, warum: 'etwas von Ben steht im Aufruf: ' + z(s2[0].arg) };
      const e = await rufe('portal', { token: 'jwt-ben', body: {} });
      if (e.status !== 200 || stripeRufe('billingPortal.sessions.create')[1].arg.customer !== 'cus_ben') return { ok: false, warum: 'Ben bekommt nicht sein eigenes Portal' };
      return { ok: true, info: 'ohne Token 401, 0 Aufrufe · Anna → cus_anna (auch wenn die Anfrage cus_ben nennt) · Ben → cus_ben' };
    },
  },
  {
    name: 'Ohne Kunde kein Portal · wer nie gekauft hat, bekommt 404 und keine Sitzung; wer nur bei Stripe bekannt ist, wird dort gefunden',
    lauf: async () => {
      neueWelt();
      const a = await rufe('portal', { body: {} });
      if (a.status !== 404 || stripeRufe('billingPortal.sessions.create').length || stripeRufe('customers.create').length) return { ok: false, warum: 'nie gekauft: status ' + a.status + ' · Portal-Sitzungen ' + stripeRufe('billingPortal.sessions.create').length + ' · neue Kunden ' + stripeRufe('customers.create').length };
      neueWelt(); ANNA_KUNDE();
      const b = await rufe('portal', { body: {} });
      if (b.status !== 200 || stripeRufe('billingPortal.sessions.create')[0].arg.customer !== 'cus_anna') return { ok: false, warum: 'nur bei Stripe bekannt: status ' + b.status };
      neueWelt(); ANNA_KUNDE(); W.db.nein.push({ tabelle: 'stripe_subscriptions' });
      const c = await rufe('portal', { body: {} });
      if (c.status < 500 || stripeRufe('billingPortal.sessions.create').length) return { ok: false, warum: 'Abo-Zeilen nicht lesbar: status ' + c.status + ' (das ist kein „nie gekauft")' };
      if (W.db.prot.some((p) => p.tabelle === 'stripe_customers')) return { ok: false, warum: 'stripe_customers wird angesprochen — die Tabelle gibt es nicht' };
      // Nicht feststellbar ist nicht „nie gekauft": keine Abo-Zeile, und die Suche bei Stripe scheitert
      neueWelt(); ANNA_KUNDE(); W.stripe.sucheWirft = true;
      const d = await rufe('portal', { body: {} });
      if (d.status < 500 || stripeRufe('billingPortal.sessions.create').length) return { ok: false, warum: 'die Suche bei Stripe scheitert: status ' + d.status + ' — „No Stripe customer found" wäre geraten' };
      // … mit Abo-Zeile wird Stripe gar nicht gefragt
      neueWelt(); ANNA_KUNDE(); W.stripe.sucheWirft = true;
      tab('stripe_subscriptions').push({ id: 'sub_a', user_id: U1, status: 'active', cancel_at_period_end: false, stripe_customer_id: 'cus_anna', is_lifetime: false, created_at: '2026-10-01T00:00:00Z' });
      const e = await rufe('portal', { body: {} });
      if (e.status !== 200 || stripeRufe('customers.search').length) return { ok: false, warum: 'mit Abo-Zeile: status ' + e.status + ' · Suchen bei Stripe ' + stripeRufe('customers.search').length };
      return { ok: true, info: 'nie gekauft → 404 · nur bei Stripe → gefunden · Datenbank sagt Nein → ' + c.status + ', nicht 404 · Suche gescheitert → ' + d.status + ', nicht 404 · mit Abo-Zeile keine Suche' };
    },
  },
  {
    name: 'Zurück und Ziel · die Rückkehr-Adresse nur auf den eigenen Ursprung; „kündigen" zeigt auf das echte laufende Abo — nie auf die Lifetime-Zeile',
    lauf: async () => {
      const welt = (zeilen) => { neueWelt(); ANNA_KUNDE(); W.stripe.abos.sub_a = abo({ id: 'sub_a' }); for (const zl of zeilen) tab('stripe_subscriptions').push(Object.assign({ user_id: U1, stripe_customer_id: 'cus_anna', is_lifetime: false, cancel_at_period_end: false }, zl)); };
      const laufend = { id: 'sub_a', status: 'active', created_at: '2026-10-01T00:00:00Z' };
      welt([laufend]);
      const a = await rufe('portal', { body: { return_url: 'https://boese.example/zurueck' } });
      const p = stripeRufe('billingPortal.sessions.create')[0] && stripeRufe('billingPortal.sessions.create')[0].arg;
      if (a.status !== 200 || !p || new URL(p.return_url).origin !== 'https://green-scan.ch') return { ok: false, warum: 'fremde Rückkehr-Adresse: status ' + a.status + ' · an Stripe ging „' + (p && p.return_url) + '"' };
      const b = await rufe('portal', { body: { return_url: 'https://green-scan.ch/?billing=return&popup=1', locale: 'it' } });
      if (b.status !== 200 || stripeRufe('billingPortal.sessions.create')[1].arg.return_url !== 'https://green-scan.ch/?billing=return&popup=1') return { ok: false, warum: 'die eigene Adresse wurde ersetzt' };
      if (p.locale !== 'auto' || stripeRufe('billingPortal.sessions.create')[1].arg.locale !== 'it') return { ok: false, warum: 'Sprache des Portals: ohne Angabe „' + p.locale + '" (erwartet auto), mit „it" „' + stripeRufe('billingPortal.sessions.create')[1].arg.locale + '"' };
      const c = await rufe('portal', { body: { flow: 'cancel' } });
      const pc = stripeRufe('billingPortal.sessions.create')[2].arg;
      if (c.status !== 200 || !pc.flow_data || pc.flow_data.type !== 'subscription_cancel' || pc.flow_data.subscription_cancel.subscription !== 'sub_a' || new URL(pc.flow_data.after_completion.redirect.return_url).origin !== 'https://green-scan.ch') return { ok: false, warum: 'kündigen: ' + z(pc) };
      // Lifetime gekauft, das Abo längst beendet: „kündigen" darf nicht auf lifetime_<id> zeigen
      welt([{ id: 'lifetime_' + U1, status: 'active', is_lifetime: true, created_at: '2026-11-01T00:00:00Z' }, { id: 'sub_alt', status: 'canceled', created_at: '2026-01-01T00:00:00Z' }]);
      const d = await rufe('portal', { body: { flow: 'cancel' } });
      const pd = stripeRufe('billingPortal.sessions.create')[0] && stripeRufe('billingPortal.sessions.create')[0].arg;
      if (d.status !== 200 || !pd || pd.flow_data) return { ok: false, warum: 'nur Lifetime und ein beendetes Abo, „kündigen": status ' + d.status + ' · ' + d.text.slice(0, 120) + ' · Ziel ' + z(pd && pd.flow_data) };
      welt([Object.assign({}, laufend, { cancel_at_period_end: true })]);
      const e = await rufe('portal', { body: { flow: 'reactivate' } });
      const pe = stripeRufe('billingPortal.sessions.create')[0].arg;
      if (e.status !== 200 || !pe.flow_data || z(pe.flow_data).indexOf('sub_a') < 0) return { ok: false, warum: 'fortsetzen: ' + z(pe) };
      return { ok: true, info: 'fremde Adresse → https://green-scan.ch/… · kündigen → sub_a · nur Lifetime → Portal ohne Ziel statt „No such subscription" · fortsetzen → sub_a' };
    },
  },
];

// ══ SQL · das, was dieser Prüfstand sonst nur nachbaut, einmal ausgeführt ═══════
// Die Funktion kommt aus der Migration v30_32 (am 11.11.2026 gegen pg_get_functiondef der
// Live-DB gelesen: gleich), die Policies sind der Live-Stand (pg_policy, 11.11.2026).
const SQL = [
  {
    name: 'Launch-Zähler · SQL: die gestellte Datenbankfunktion antwortet wie die echte; das Loch im Zähler ist reproduziert; die Migration schliesst es, zweimal anwendbar — und der Webhook-Weg schreibt weiter',
    lauf: async (M) => {
      if (!pgDa()) return { offen: true, warum: 'kein lokales Postgres erreichbar (GS_PG_URL) — die Funktion und die Migration wurden NICHT ausgeführt' };
      const mig = fs.readFileSync(path.join(WURZEL, 'supabase', 'migrations', 'v30_32_audit2_readpath_fixes.sql'), 'utf8');
      const fn = /CREATE OR REPLACE FUNCTION public\.launch_offer_available\(\)[\s\S]*?\$function\$;/.exec(mig);
      if (!fn) return { ok: false, warum: 'launch_offer_available() steht nicht mehr so in v30_32_audit2_readpath_fixes.sql — diesen Fall nachziehen' };
      const neu = fs.readFileSync(path.join(WURZEL, 'supabase', 'migrations', '20261111_launch_offer_usage_nur_server.sql'), 'utf8');
      const url = PG_URL.replace(/\/[^/]*$/, '/' + PG_DB);
      try {
        pgSql(PG_URL, 'drop database if exists ' + PG_DB); pgSql(PG_URL, 'create database ' + PG_DB);
        pgSql(url, `
          do $$ begin
            if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
            if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
          end $$;
          create schema if not exists auth;
          create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('gs.uid', true), '')::uuid $f$;
          grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;
          create table public.launch_offer_usage (user_id uuid primary key, subscription_id text, claimed_at timestamptz default now());
          alter table public.launch_offer_usage enable row level security;
          grant all on public.launch_offer_usage to anon, authenticated;
          create policy launch_offer_insert_own on public.launch_offer_usage for insert with check ((select auth.uid()) = user_id);
          create policy launch_offer_usage_select on public.launch_offer_usage for select using ((select auth.uid()) = user_id);
          ${fn[0]}
          grant execute on function public.launch_offer_available() to anon, authenticated;`);
      } catch (e) { return { ok: false, warum: 'der Live-Stand lässt sich lokal nicht aufbauen: ' + e.message }; }
      const als = (uid, q) => { const r = psql(url, ['-c', "set gs.uid = '" + (uid || '') + "'; set role " + (uid ? 'authenticated' : 'anon') + '; ' + q]); return { ok: r.status === 0, aus: (r.stdout || '').trim(), fehler: r.status === 0 ? '' : pgLetzte(r) }; };
      const frage = (uid) => { const r = als(uid, 'select public.launch_offer_available()::text'); return r.ok ? JSON.parse(r.aus) : { fehler: r.fehler }; };
      const nr = (i) => '9' + String(i).padStart(7, '0') + '-0000-4000-8000-000000000000';
      // 1 · Dieselben Fragen an die echte Funktion und an die gestellte (rpc 'live' in createClientStub)
      const gestellt = (uid, zeilen) => (uid === null ? { available: true, logged_in: false } : { available: zeilen.length < 100 && zeilen.indexOf(uid) < 0, logged_in: true, claimed: zeilen.length });
      const lagen = [[null, 0, false], [U1, 0, false], [U1, 3, false], [U1, 3, true], [U1, 99, false], [U1, 100, false], [U1, 100, true]];
      for (const [uid, andere, selbst] of lagen) {
        pgSql(url, 'truncate public.launch_offer_usage');
        const zeilen = []; for (let i = 0; i < andere - (selbst ? 1 : 0); i++) zeilen.push(nr(i));
        if (selbst) zeilen.push(U1);
        if (zeilen.length) pgSql(url, 'insert into public.launch_offer_usage(user_id) values ' + zeilen.map((x) => "('" + x + "')").join(','));
        const echt = frage(uid), soll = gestellt(uid, zeilen);
        // jsonb ordnet seine Schlüssel selbst — verglichen wird der Inhalt, nicht die Reihenfolge
        const kanon = (o) => z(Object.keys(o).sort().map((k) => [k, o[k]]));
        if (kanon(echt) !== kanon(soll)) return { ok: false, warum: 'die echte Funktion antwortet anders als die gestellte (' + z({ uid: uid ? 'Anna' : null, vergeben: zeilen.length, selbst }) + '): echt ' + z(echt) + ' · gestellt ' + z(soll) };
        if (M.launchStand(echt) !== M.launchStand(soll)) return { ok: false, warum: 'launchStand liest die echte Antwort anders als die gestellte' };
      }
      // 2 · Das Loch (Live-Stand): ein Konto trägt sich selbst ein, ohne zu kaufen — hundert davon, und es ist ausverkauft
      pgSql(url, 'truncate public.launch_offer_usage');
      const selbst = als(U1, "insert into public.launch_offer_usage(user_id) values ('" + U1 + "')");
      if (!selbst.ok) return { ok: false, warum: 'das Loch lässt sich nicht reproduzieren (der Live-Stand ist anders als hier nachgebaut): ' + selbst.fehler };
      const fremd = als(U1, "insert into public.launch_offer_usage(user_id) values ('" + U2 + "')");
      if (fremd.ok) return { ok: false, warum: 'ein Konto kann eine Zeile für ein ANDERES Konto schreiben — das wäre mehr als gemessen' };
      for (let i = 0; i < 99; i++) { const r = als(nr(i), "insert into public.launch_offer_usage(user_id) values ('" + nr(i) + "')"); if (!r.ok) return { ok: false, warum: 'Konto ' + i + ': ' + r.fehler }; }
      const voll = frage(U2);
      if (voll.available !== false || voll.claimed !== 100 || M.launchStand(voll) !== 'ausverkauft') return { ok: false, warum: 'nach 100 selbst eingetragenen Zeilen: ' + z(voll) };
      // 3 · Die Migration — zweimal
      for (const mal of [1, 2]) { const r = psql(url, ['-c', neu]); if (r.status !== 0) return { ok: false, warum: 'die Migration scheitert beim ' + mal + '. Anwenden: ' + pgLetzte(r) }; }
      pgSql(url, 'truncate public.launch_offer_usage');
      const danach = als(U1, "insert into public.launch_offer_usage(user_id) values ('" + U1 + "')");
      if (danach.ok) return { ok: false, warum: 'nach der Migration kann sich ein Konto weiter selbst in den Zähler schreiben' };
      const anonDanach = als(null, "insert into public.launch_offer_usage(user_id) values ('" + U2 + "')");
      if (anonDanach.ok) return { ok: false, warum: 'nach der Migration schreibt ein nicht angemeldeter Aufrufer in den Zähler' };
      // … der Server schreibt weiter (hier: der Besitzer der Tabelle, wie der Service-Schlüssel an RLS vorbei), die Person liest ihre Zeile, die Funktion zählt
      try { pgSql(url, "insert into public.launch_offer_usage(user_id, subscription_id) values ('" + U1 + "', 'lifetime_" + U1 + "')"); } catch (e) { return { ok: false, warum: 'nach der Migration kann auch der Server nicht mehr schreiben: ' + e.message }; }
      const lesen = als(U1, 'select count(*) from public.launch_offer_usage'), lesenBen = als(U2, 'select count(*) from public.launch_offer_usage');
      if (!lesen.ok || lesen.aus !== '1' || !lesenBen.ok || lesenBen.aus !== '0') return { ok: false, warum: 'Lesen nach der Migration: Anna ' + z(lesen) + ' · Ben ' + z(lesenBen) };
      const a = frage(U1), b = frage(U2);
      if (M.launchStand(a) !== 'schon_gekauft' || M.launchStand(b) !== 'frei') return { ok: false, warum: 'die Funktion nach der Migration: Anna ' + z(a) + ' · Ben ' + z(b) };
      try { pgSql(PG_URL, 'drop database if exists ' + PG_DB); } catch (_) { /* egal */ }
      return { ok: true, info: lagen.length + ' Lagen: echte Funktion = gestellte · Loch reproduziert (1 Konto trägt sich ein, 100 → ausverkauft ohne Kauf) · Migration 2× · danach: Konto und Anonym abgelehnt („' + danach.fehler.slice(0, 40) + '…"), Server schreibt, Anna liest 1 Zeile, Ben 0' };
    },
  },
];

// ══ QUELLTEXT ═════════════════════════════════════════════════════════════════
const QUELLTEXT = [
  {
    name: 'Kein `.catch()` an einer supabase-js-Kette · in KEINER Edge-Function — der Bauer hat kein `catch`, der Aufruf wirft selbst; und die Suche findet, was sie finden soll',
    lauf: () => {
      const probe = 'await admin.from("a").insert({x: 1}).catch(() => {}); // .from("k").catch(\n const r = await admin.from("b").update({ t: "x.catch(" }).eq("id", f(1));\n await sb.rpc("f", {}).finally(g); fetch(u).then((r) => r.json()).catch(() => null);';
      const k = ketten(probe);
      const treffer = k.filter((c) => aufTiefeNull(c.text, '.catch(') || aufTiefeNull(c.text, '.finally('));
      if (k.length !== 3 || treffer.length !== 2) return { ok: false, warum: 'die Suche selbst stimmt nicht: ' + k.length + ' Ketten, ' + treffer.length + ' Treffer (erwartet 3 und 2)' };
      const funde = [];
      let gezaehlt = 0;
      for (const f of functionDateien()) {
        const alle = ketten(fs.readFileSync(f.pfad, 'utf8'));
        gezaehlt += alle.length;
        const n = alle.filter((c) => aufTiefeNull(c.text, '.catch(') || aufTiefeNull(c.text, '.finally(')).length;
        if (n) funde.push(f.name + ' ' + n + '×');
      }
      if (funde.length) return { ok: false, warum: funde.join(' · ') + ' — jeder dieser Aufrufe endet in „… .catch is not a function"' };
      if (gezaehlt < 100) return { ok: false, warum: 'nur ' + gezaehlt + ' Ketten gefunden — die Suche sieht etwas nicht' };
      return { ok: true, info: functionDateien().length + ' Edge-Functions, ' + gezaehlt + ' Ketten, 0 mit .catch/.finally' };
    },
  },
  {
    name: 'Jeder Datenbank-Aufruf wird GELESEN · in stripe-webhook, stripe-checkout und stripe-portal steht jede Kette in `dbMuss(await …)` — ein Nein der Datenbank kann nicht mehr verschwinden',
    lauf: () => {
      const ohne = [];
      let n = 0;
      for (const name of ['webhook', 'checkout', 'portal']) {
        const src = fs.readFileSync(DATEI[name], 'utf8');
        for (const c of ketten(src)) {
          n++;
          if (!/dbMuss\(\s*await\s+[A-Za-z_$][\w$]*\s*$/.test(c.davor)) ohne.push(name + ': ' + c.text.replace(/\s+/g, ' ').slice(0, 46));
        }
        if (!/from\s*["']\.\.\/_shared\/stripe_regeln\.mjs["']/.test(ohneKommentare(src))) ohne.push(name + ' importiert das Modul nicht');
      }
      if (ohne.length) return { ok: false, warum: ohne.length + ' Aufrufe ohne Blick auf die Antwort — ' + ohne.slice(0, 5).join(' · ') };
      if (n < 15) return { ok: false, warum: 'nur ' + n + ' Ketten in den drei Functions — die Suche sieht etwas nicht' };
      return { ok: true, info: n + ' Aufrufe in drei Functions, alle durch dbMuss' };
    },
  },
  {
    name: 'Eine Liste, ein Handler · jedes Ereignis der Liste hat seinen Zweig im Webhook, und jeder Zweig steht in der Liste — sie ist auch die Liste fürs Stripe-Dashboard',
    lauf: (M) => {
      const src = ohneKommentare(fs.readFileSync(DATEI.webhook, 'utf8'));
      const zweige = [...src.matchAll(/case\s+["']([a-z_]+(?:\.[a-z_]+)+)["']\s*:/g)].map((m) => m[1]);
      const liste = Object.keys(M.STRIPE_EREIGNISSE);
      const ohneZweig = liste.filter((n) => zweige.indexOf(n) < 0), ohneEintrag = zweige.filter((n) => liste.indexOf(n) < 0);
      if (ohneZweig.length || ohneEintrag.length) return { ok: false, warum: 'in der Liste, aber ohne Zweig: ' + (ohneZweig.join(', ') || '—') + ' · im Handler, aber nicht in der Liste: ' + (ohneEintrag.join(', ') || '—') };
      if (zweige.some((n, i) => zweige.indexOf(n) !== i)) return { ok: false, warum: 'ein Ereignis hat zwei Zweige' };
      if (/constructEvent/.test(src)) return { ok: false, warum: 'der Webhook prüft die Signatur an der Bibliothek vorbei am Modul — zwei Prüfungen für eine Frage' };
      if (!/signaturPruefen\s*\(/.test(src) || !/req\.arrayBuffer\s*\(/.test(src)) return { ok: false, warum: 'der Webhook ruft signaturPruefen nicht mit dem ROHEN Rumpf (req.arrayBuffer)' };
      return { ok: true, info: liste.length + ' Ereignisse in der Liste = ' + zweige.length + ' Zweige im Handler · Signatur über das Modul, am rohen Rumpf' };
    },
  },
  {
    name: 'Keine feste Zahlungsart, keine Tabelle, die es nicht gibt · stripe-checkout nennt weder `payment_method_types` noch `automatic_payment_methods`; keine der drei Functions liest `stripe_customers`',
    lauf: () => {
      const c = ohneKommentare(fs.readFileSync(DATEI.checkout, 'utf8'));
      const fest = ['payment_method_types', 'automatic_payment_methods'].filter((w) => c.indexOf(w) >= 0);
      if (fest.length) return { ok: false, warum: 'stripe-checkout nennt: ' + fest.join(', ') };
      const tote = ['webhook', 'checkout', 'portal'].filter((n) => /stripe_customers/.test(ohneKommentare(fs.readFileSync(DATEI[n], 'utf8'))));
      if (tote.length) return { ok: false, warum: 'stripe_customers (live: gibt es nicht) wird gelesen von: ' + tote.join(', ') };
      const spalten = ['webhook', 'checkout', 'portal'].filter((n) => /trial_will_end_notified_at|stripe_email/.test(ohneKommentare(fs.readFileSync(DATEI[n], 'utf8'))));
      if (spalten.length) return { ok: false, warum: 'eine Spalte, die es live nicht gibt (trial_will_end_notified_at) oder die niemand liest (stripe_email), wird geschrieben von: ' + spalten.join(', ') };
      for (const n of ['checkout', 'portal']) {
        const s = ohneKommentare(fs.readFileSync(DATEI[n], 'utf8'));
        if (!/kundeFinden\s*\(/.test(s) || !/rueckkehrAdresse\s*\(/.test(s)) return { ok: false, warum: 'stripe-' + n + ' fragt nicht das Modul nach Kunde und Rückkehr-Adresse' };
      }
      return { ok: true, info: 'checkout ohne feste Zahlungsart · 0 Zugriffe auf stripe_customers · Kunde und Rückkehr-Adresse aus dem Modul' };
    },
  },
  {
    name: 'Was der Abo-Bildschirm verspricht · Preise, Rabatt und Probezeit der App sind die der Function; und die App schickt die Felder, die stripe-checkout liest',
    lauf: (M) => {
      const html = fs.readFileSync(APP, 'utf8');
      const boot = fs.readFileSync(path.join(FUNKTIONEN, 'stripe-bootstrap', 'index.ts'), 'utf8');
      const kat = /var GS_PRICE_CATALOG = \[([\s\S]*?)\];/.exec(html);
      if (!kat) return { ok: false, warum: 'GS_PRICE_CATALOG nicht gefunden' };
      const app = [...kat[1].matchAll(/key:'([a-z_]+)'[^}]*?price:'CHF ([0-9.]+)/g)].map((m) => [m[1], Math.round(parseFloat(m[2]) * 100)]);
      const server = [...boot.matchAll(/lookup:\s*"([a-z_]+)",\s*amount:\s*(\d+)/g)].map((m) => [m[1], Number(m[2])]);
      if (app.length !== 3 || server.length !== 3) return { ok: false, warum: 'Preise nicht lesbar: App ' + z(app) + ' · stripe-bootstrap ' + z(server) };
      for (const [key, rappen] of app) { const s = server.find((x) => x[0] === key); if (!s || s[1] !== rappen) return { ok: false, warum: key + ': die App nennt ' + rappen + ' Rappen, stripe-bootstrap ' + (s ? s[1] : 'nichts') }; }
      const monat = server.find((x) => x[0] === 'pro_monthly')[1], jahr = server.find((x) => x[0] === 'pro_yearly')[1];
      const rabatt = Math.round((1 - jahr / (12 * monat)) * 100);
      const schirm = html.slice(html.indexOf('function gsShowAboScreen('), html.indexOf('var GS_LAUNCH_PLAETZE = '));
      if (schirm.length < 2000) return { ok: false, warum: 'der Abo-Bildschirm ist im Quelltext nicht mehr so abgegrenzt (gsShowAboScreen … GS_LAUNCH_PLAETZE) — diesen Fall nachziehen' };
      const amSchirm = [...schirm.matchAll(/−(\d+)%/g)].map((m) => Number(m[1])).concat([...kat[1].matchAll(/(\d+)% Rabatt/g)].map((m) => Number(m[1])));
      if (!amSchirm.length || amSchirm.some((n) => n !== rabatt)) return { ok: false, warum: 'Rabatt: gerechnet ' + rabatt + ' %, auf dem Bildschirm ' + z(amSchirm) };
      const tage = [...schirm.matchAll(/gsStartCheckout\(\\'pro_(?:monthly|yearly)\\',\s*false,\s*(\d+)\)/g)].map((m) => Number(m[1]));
      if (tage.length !== 2 || tage.some((t) => t !== M.PROBE_TAGE_VORGABE || t > M.PROBE_TAGE_MAX)) return { ok: false, warum: 'Probezeit: die Knöpfe verlangen ' + z(tage) + ' Tage, die Function gibt ' + M.PROBE_TAGE_VORGABE + ' (höchstens ' + M.PROBE_TAGE_MAX + ')' };
      if (!new RegExp(M.PROBE_TAGE_VORGABE + ' Tage gratis').test(schirm)) return { ok: false, warum: 'der Bildschirm nennt die Probezeit nicht mit ' + M.PROBE_TAGE_VORGABE + ' Tagen' };
      const start = html.slice(html.indexOf('async function gsStartCheckout('), html.indexOf('async function gsOpenBillingPortal('));
      const fn = ohneKommentare(fs.readFileSync(DATEI.checkout, 'utf8'));
      const felder = ['price_id', 'claim_launch_offer', 'success_url', 'cancel_url', 'trial_days', 'locale'];
      const nichtGeschickt = felder.filter((f) => !new RegExp('\\b' + f + '\\s*[:=]').test(start)), nichtGelesen = felder.filter((f) => f !== 'claim_launch_offer' && !new RegExp('\\b' + f + '\\b').test(fn));
      if (nichtGeschickt.length || nichtGelesen.length) return { ok: false, warum: 'die App schickt nicht: ' + (nichtGeschickt.join(', ') || '—') + ' · die Function liest nicht: ' + (nichtGelesen.join(', ') || '—') };
      return { ok: true, info: app.map((a) => a[0] + ' ' + (a[1] / 100).toFixed(2)).join(' · ') + ' CHF in App und Function · Rabatt ' + rabatt + ' % nachgerechnet · ' + tage[0] + ' Tage Probezeit · ' + felder.length + ' Felder über die Naht' };
    },
  },
  {
    name: 'Zwei Leser, eine Antwort · die App liest rpc/launch_offer_available wie stripe-checkout — an der Form, die die Datenbank wirklich schickt; und ein Grund des Servers wird in der App ein Satz',
    lauf: async (M) => {
      const html = fs.readFileSync(APP, 'utf8');
      const von = html.indexOf('var GS_LAUNCH_PLAETZE = '), bis = html.indexOf('\n}\n', html.indexOf('function _gsCheckoutGrund('));
      if (von < 0 || bis < von) return { ok: false, warum: 'GS_LAUNCH_PLAETZE … _gsCheckoutGrund stehen nicht mehr so in index.html' };
      const vm = require('node:vm');
      const welt = { sbFetch: null, _gsSatz: (v, a) => String(v).replace('{1}', a) };
      vm.createContext(welt);
      vm.runInContext(html.slice(von, bis + 2) + '\nthis.aus = _gsLaunchStandAus; this.stand = gsLaunchStand; this.grund = _gsCheckoutGrund; this.plaetze = GS_LAUNCH_PLAETZE;', welt);
      if (welt.plaetze !== M.LAUNCH_PLAETZE) return { ok: false, warum: 'Plätze: App ' + welt.plaetze + ', Function ' + M.LAUNCH_PLAETZE };
      const antworten = [{ available: true, logged_in: true, claimed: 0 }, { available: false, logged_in: true, claimed: 100 }, { available: false, logged_in: true, claimed: 12 }, { available: false, logged_in: true }, { available: true, logged_in: false },
        { available: true }, true, false, null, undefined, 'true', [], [{ available: true, logged_in: true }], { available: 'ja', logged_in: true }];
      const anders = antworten.filter((a) => welt.aus(a) !== M.launchStand(a));
      if (anders.length) return { ok: false, warum: 'App und Function lesen dieselbe Antwort verschieden: ' + anders.map((a) => z(a) + ' → App ' + z(welt.aus(a)) + ', Function ' + z(M.launchStand(a))).join(' · ') };
      // … und durch den echten Aufruf: die Antwort, wie sie live aussieht, ausverkauft → 'ausverkauft' (nicht: „immer frei")
      const mit = async (antwort) => { welt.sbFetch = async () => antwort; return welt.stand(); };
      const t = [[await mit({ data: { available: false, logged_in: true, claimed: 100 }, error: null }), 'ausverkauft'], [await mit({ data: { available: false, logged_in: true, claimed: 4 }, error: null }), 'schon_gekauft'],
        [await mit({ data: { available: true, logged_in: true, claimed: 4 }, error: null }), 'frei'], [await mit({ data: null, error: { message: 'x' } }), null], [await mit({ data: true, error: null }), null]];
      for (const [ist, soll] of t) if (ist !== soll) return { ok: false, warum: 'gsLaunchStand: ' + z(ist) + ' statt ' + z(soll) };
      welt.sbFetch = async () => { throw new Error('offline'); };
      if (await welt.stand() !== null) return { ok: false, warum: 'ohne Netz: nicht „nicht feststellbar"' };
      // jede Kennung, die stripe-checkout nennen kann, wird ein deutscher Satz — keine englische Serverzeile
      const kennungen = ['preis_unbekannt', 'preis_inaktiv', 'preis_ohne_intervall', 'launch_ausverkauft', 'launch_schon_gekauft', 'launch_unklar'];
      const modul = ohneKommentare(fs.readFileSync(MODUL, 'utf8'));
      const planVon = modul.indexOf('export function checkoutPlan('), plan = modul.slice(planVon, modul.indexOf('\n}\n', planVon));
      const imModul = planVon < 0 ? [] : [...plan.matchAll(/grund:\s*'([a-z_]+)'/g)].map((m) => m[1]).filter((k, i, a) => a.indexOf(k) === i);
      const ohneSatz = imModul.filter((k) => kennungen.indexOf(k) < 0 || welt.grund({ grund: k, error: 'ENGLISCH' }, 400) === 'ENGLISCH');
      if (imModul.length < 6 || ohneSatz.length) return { ok: false, warum: 'checkoutPlan nennt ' + imModul.length + ' Kennungen; ohne eigenen Satz in der App: ' + (ohneSatz.join(', ') || '—') };
      if (welt.grund({ error: 'Stripe sagt etwas' }, 500) !== 'Stripe sagt etwas' || !/401|Anmeldung/.test(welt.grund({}, 401)) || !/502/.test(welt.grund(null, 502))) return { ok: false, warum: 'Rückfall: ' + z([welt.grund({ error: 'x' }, 500), welt.grund({}, 401), welt.grund(null, 502)]) };
      return { ok: true, info: antworten.length + ' Antworten, App = Function · live-Form ausverkauft → „ausverkauft" (bis v33.59: immer „frei") · ' + imModul.length + ' Kennungen → ' + imModul.length + ' Sätze' };
    },
  },
  {
    name: 'Die Naht · jede Tabelle, die eine der drei Functions anfasst, trägt gemessene Spalten — und keine Spalte daneben',
    lauf: () => {
      // Welche Tabellen nennen die drei Functions und das Modul im Quelltext?
      const genannt = new Set();
      for (const pfad of [DATEI.webhook, DATEI.checkout, DATEI.portal, MODUL]) for (const m of ohneKommentare(fs.readFileSync(pfad, 'utf8')).matchAll(/\.from\(\s*["']([a-z_]+)["']\s*\)/g)) genannt.add(m[1]);
      const ohne = [...genannt].filter((t) => !SPALTEN[t]);
      if (ohne.length) return { ok: false, warum: 'ohne gemessene Spalten: ' + ohne.join(', ') + ' — dort prüft der Prüfstand nichts (information_schema.columns nachmessen und in SPALTEN eintragen)' };
      if (genannt.size < 9) return { ok: false, warum: 'nur ' + genannt.size + ' Tabellen im Quelltext gefunden — die Suche sieht etwas nicht' };
      const nieBenutzt = Object.keys(SPALTEN).filter((t) => !genannt.has(t));
      if (nieBenutzt.length) return { ok: false, warum: 'in SPALTEN, aber von keiner Function angefasst: ' + nieBenutzt.join(', ') + ' — eine Momentaufnahme, die niemand braucht, veraltet unbemerkt' };
      for (const [t, fk] of Object.entries(FREMD)) for (const c of Object.keys(fk)) if (SPALTEN[t].indexOf(c) < 0) return { ok: false, warum: 'FREMD nennt ' + t + '.' + c + ', die Spalte steht nicht in SPALTEN' };
      for (const [t, e] of Object.entries(EINDEUTIG)) for (const gruppe of e) for (const c of gruppe) if (!SPALTEN[t] || SPALTEN[t].indexOf(c) < 0) return { ok: false, warum: 'EINDEUTIG nennt ' + t + '.' + c + ', die Spalte steht nicht in SPALTEN' };
      return { ok: true, info: genannt.size + ' Tabellen im Quelltext = ' + Object.keys(SPALTEN).length + ' mit gemessenen Spalten (11.11.2026) · ' + Object.values(FREMD).reduce((n, o) => n + Object.keys(o).length, 0) + ' Fremdschlüssel, ' + Object.values(CHECK).reduce((n, o) => n + Object.keys(o).length, 0) + ' CHECKs, ON CONFLICT nur auf volle eindeutige Einschränkungen' };
    },
  },
  {
    name: 'Der Massstab und die Sicht · was dieser Prüfstand als „Berechtigung" rechnet, steht so in der jüngsten Migration von v_user_entitlements und im Trigger',
    lauf: () => {
      const dir = path.join(WURZEL, 'supabase', 'migrations');
      const dateien = fs.readdirSync(dir).filter((f) => /CREATE\s+(OR\s+REPLACE\s+)?VIEW\s+public\.v_user_entitlements/i.test(fs.readFileSync(path.join(dir, f), 'utf8')));
      if (dateien.join() !== ['20260504_user_entitlements_past_due.sql', 'v29_16_comp_entitlements.sql'].join()) return { ok: false, warum: 'die Sicht wird in anderen Migrationen definiert als gedacht: ' + dateien.join(', ') + ' — den Massstab sichtTier nachziehen' };
      const v = fs.readFileSync(path.join(dir, 'v29_16_comp_entitlements.sql'), 'utf8').replace(/\s+/g, ' ');
      const saetze = ["WHERE s.is_lifetime = true OR s.status IN ('active','trialing') OR (s.status = 'past_due' AND s.current_period_end > now() - interval '" + KULANZ_TAGE + " days')",
        "max(s.tier) FILTER (WHERE s.tier IN ('pro','lifetime','plus','premium','basic')) AS sub_tier",
        "WHEN e.sub_uid IS NOT NULL THEN coalesce(e.sub_tier, e.raw_tier)", "WHEN e.comp_active THEN e.comp_tier ELSE 'free'"];
      const fehlt = saetze.filter((s) => v.indexOf(s) < 0);
      if (fehlt.length) return { ok: false, warum: 'die Sicht sagt etwas anderes als der Massstab: „' + fehlt[0].slice(0, 80) + '…" steht nicht mehr in v29_16' };
      const t = fs.readFileSync(path.join(dir, '20260504_user_entitlements_past_due.sql'), 'utf8').replace(/\s+/g, ' ');
      const trig = ["IF NEW.is_lifetime = true THEN UPDATE public.profiles SET tier = 'lifetime', is_lifetime = true WHERE id = NEW.user_id;", "ELSIF NEW.status IN ('canceled','unpaid','incomplete_expired') THEN UPDATE public.profiles SET tier = 'free' WHERE id = NEW.user_id AND is_lifetime = false;"];
      const tf = trig.filter((s) => t.indexOf(s) < 0);
      if (tf.length) return { ok: false, warum: 'der Trigger sagt etwas anderes als sein Nachbau: „' + tf[0].slice(0, 70) + '…"' };
      return { ok: true, info: saetze.length + ' Sätze der Sicht und ' + trig.length + ' des Triggers stehen wörtlich in den Migrationen — live gegengelesen hat sie dieser Prüfstand nicht' };
    },
  },
];

// ── Fremdmassstab (nur wenn gestellt): Stripes eigene Bibliothek entscheidet dieselben Fälle ──
async function fremdmassstab(M) {
  const pfad = process.env.GS_STRIPE_PAKET;
  if (!pfad) return null;
  let Stripe;
  try { Stripe = require(path.resolve(pfad)); Stripe = Stripe.default || Stripe; } catch (e) { return { ok: false, warum: 'GS_STRIPE_PAKET lässt sich nicht laden: ' + String(e.message).split('\n')[0] }; }
  const stripe = new Stripe('pruefstand', {});
  const g = 'ein-geheimnis-fuer-den-vergleich', jetzt = Math.floor(Date.now() / 1000);
  const rumpf = '{"id":"evt_x","object":"event","type":"customer.created","data":{"object":{"name":"Zürich ✓"}}}';
  const faelle = [
    ['von Stripe unterschrieben', stripe.webhooks.generateTestHeaderString({ payload: rumpf, secret: g, timestamp: jetzt }), rumpf, g],
    ['vom Prüfstand unterschrieben', unterschrift(rumpf, g, jetzt), rumpf, g],
    ['falsches Geheimnis', unterschrift(rumpf, 'anderes', jetzt), rumpf, g],
    ['Rumpf verändert', unterschrift(rumpf, g, jetzt), rumpf + ' ', g],
    ['299 s alt', unterschrift(rumpf, g, jetzt - 299), rumpf, g],
    ['302 s alt', unterschrift(rumpf, g, jetzt - 302), rumpf, g],
    ['eine Stunde in der Zukunft', unterschrift(rumpf, g, jetzt + 3600), rumpf, g],
    ['zwei v1', 't=' + jetzt + ',v1=' + '0'.repeat(64) + ',' + unterschrift(rumpf, g, jetzt).split(',')[1], rumpf, g],
    ['nur v0', unterschrift(rumpf, g, jetzt).replace('v1=', 'v0='), rumpf, g],
    ['leerer Kopf', '', rumpf, g],
  ];
  const anders = [];
  for (const [was, kopf, r, geheimnis] of faelle) {
    let lib = true;
    try { await stripe.webhooks.constructEventAsync(r, kopf, geheimnis); } catch (_) { lib = false; }
    const eigen = (await M.signaturPruefen({ kopf, rumpf: r, geheimnis })).ok;
    if (lib !== eigen) anders.push(was + ' (Stripe ' + lib + ', Modul ' + eigen + ')');
  }
  if (anders.length) return { ok: false, warum: 'Stripes Bibliothek entscheidet anders: ' + anders.join(' · ') };
  return { ok: true, info: faelle.length + ' Fälle, ' + faelle.length + '-mal dieselbe Entscheidung wie stripe@' + (Stripe.PACKAGE_VERSION || '?') };
}

(async () => {
  console.log('\n=== stripe_check — kommt an, was bezahlt wurde — und nur das?');
  let kaputt = 0, geprueft = 0, nichtPruefbar = 0;
  const fahreListe = async (titel, liste, arg) => {
    console.log('  ' + titel);
    for (const f of liste) {
      let r;
      try { r = await f.lauf(arg); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + String(e && e.message).split('\n')[0] }; }
      if (r && r.offen) { nichtPruefbar++; console.log('  ??   ' + f.name + '\n         → nicht prüfbar: ' + r.warum); continue; }
      geprueft++;
      if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
      else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
    }
  };
  let M = null;
  try { M = await import(pathToFileURL(MODUL).href); }
  catch (e) { kaputt++; console.log('  !!   das Modul lässt sich nicht laden: ' + String(e && e.message).split('\n')[0]); }
  if (M) {
    await fahreListe('RECHNUNG · ' + path.relative(WURZEL, MODUL) + ', ausgeführt in Node', RECHNUNG, M);
    const fm = await fremdmassstab(M).catch((e) => ({ ok: false, warum: 'Ausnahme: ' + String(e && e.message).split('\n')[0] }));
    if (fm) { geprueft++; if (fm.ok) console.log('  ok   Fremdmassstab · Stripes eigene Bibliothek entscheidet jede Signatur wie das Modul   [' + fm.info + ']'); else { kaputt++; console.log('  !!   Fremdmassstab · Stripes eigene Bibliothek\n         → ' + fm.warum); } }
    else console.log('  --   Fremdmassstab nicht gestellt (GS_STRIPE_PAKET=<pfad zum stripe-Paket>): die Signatur ist an node:crypto gemessen, nicht an Stripes Bibliothek');
    for (const [name, liste, titel] of [['webhook', WEBHOOK, 'stripe-webhook'], ['checkout', CHECKOUT, 'stripe-checkout'], ['portal', PORTAL, 'stripe-portal']]) {
      neueWelt();
      const lader = await lade(name).catch((e) => ({ fehler: String(e && e.message).split('\n')[0] }));
      const kopf = 'RAND · der echte Handler von ' + path.relative(WURZEL, DATEI[name]) + ', Deno · supabase-js · Stripe gestellt';
      if (lader.ok) { H[name] = lader.handler; await fahreListe(kopf, liste, M); }
      else if (lader.fehler) { kaputt++; console.log('  ' + kopf + '\n  !!   ' + titel + ' lässt sich nicht laden: ' + lader.fehler); }
      else { nichtPruefbar += liste.length; console.log('  ' + kopf + '\n  ??   nicht prüfbar (' + liste.length + ' Fälle): ' + lader.grund); }
    }
    await fahreListe('SQL · lokales Postgres (' + PG_URL.replace(/\/\/[^@]*@/, '//') + ')', SQL, M);
    await fahreListe('QUELLTEXT · Edge-Functions, Migrationen und index.html', QUELLTEXT, M);
  }
  console.log('  ---');
  console.log('  Fälle geprüft: ' + geprueft + ' · davon kaputt: ' + kaputt + (nichtPruefbar ? ' · nicht prüfbar: ' + nichtPruefbar : ''));
  console.log('  Grenze: ob Stripe diese Aufrufe HEUTE annimmt und ob TWINT im Abo-Checkout erscheint, ist von hier');
  console.log('  nicht messbar (kein Netz dorthin) — das zeigt nur ein Probekauf im Testmodus. Die Sicht');
  console.log('  v_user_entitlements und ihr Trigger sind hier NACHGEBAUT (Migrationen v29_16, 20260504; am 11.11.2026');
  console.log('  gegen pg_get_viewdef/pg_get_functiondef gelesen: gleich), nicht ausgeführt. Spalten, Schlüssel,');
  console.log('  Fremdschlüssel und CHECKs der ' + Object.keys(SPALTEN).length + ' berührten Tabellen sind eine MOMENTAUFNAHME der Live-Datenbank vom');
  console.log('  11.11.2026 — wer eine dieser Tabellen ändert, zieht sie hier nach (Abfragen im Kopf von SPALTEN).');
  console.log('  Und ob die ausgelieferten Functions denen im Repo entsprechen, sagt nur ein Blick in Supabase.');
  process.exitCode = kaputt ? 1 : (nichtPruefbar ? 2 : 0);
})();

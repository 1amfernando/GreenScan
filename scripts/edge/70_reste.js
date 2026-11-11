// Reste von vier Brett-Befunden (v33.59, Gruppe u1): stripe-webhook (fe36), delete-user
// (cde7), plan-iterate (9d96) und eigene Kopien eines Geheimnis-Vergleichs (4515).
//
// Bauform wie 10_stripe.js: der RAND laeuft als ECHTE index.ts ueber _zahlung_rand.js
// gegen die PostgREST-Attrappe; ein Fehler fuer EINE Operationsart wird mit
// `fehler: { 'tabelle:update': {...} }` gestellt. Jede Frage mit gut UND schlecht.
'use strict';
const { lade } = require('./_zahlung_rand.js');

const U = '11111111-1111-4111-8111-111111111111';
const NUTZER = { tok_u: { id: U, email: 'u@example.org' } };
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const ok = (info) => ({ ok: true, info });
const nein = (warum) => ({ ok: false, warum });
const DBFEHLER = { code: 'XX000', message: 'connection reset' };

// ── stripe-webhook ─────────────────────────────────────────────────────────
const LIFE = { id: 'price_life001', active: true, recurring: null, metadata: { lookup_key: 'pro_lifetime', interval: 'lifetime', is_launch_offer: true, launch_offer_cap: 100 }, currency: 'chf', unit_amount: 4560, product_id: 'prod_life' };
const PRODUKTE = [{ id: 'prod_life', name: 'Pro Lifetime', tier: 'pro', active: true }];
const ereignis = (id, type, obj, extra) => JSON.stringify(Object.assign({ id, type, created: Math.floor(Date.now() / 1000), data: { object: obj } }, extra || {}));
const SELLER = () => [{ user_id: U, stripe_account_id: 'acct_1', status: 'pending', charges_enabled: false, payouts_enabled: false, details_submitted: false }];
const KONTO = { id: 'acct_1', charges_enabled: true, payouts_enabled: true, details_submitted: true, business_type: 'individual', requirements: { currently_due: [] } };
async function webhook(evt, tabellen, fehler, f0) {
  const f = f0 || await lade('stripe-webhook', { tabellen: Object.assign({ stripe_webhook_events: [], stripe_subscriptions: [], stripe_prices: [LIFE], stripe_products: PRODUKTE, launch_offer_usage: [], expert_verifications: [], notifications: [], audit_log: [], profiles: [], marketplace_sellers: SELLER() }, tabellen || {}), fehler: fehler || {} });
  const r = await f.aufruf({ headers: { 'stripe-signature': 'sig-gut' }, body: evt });
  return { r, z: f.z, f };
}
const verarbeitet = (z, id) => { const e = (z.tabellen.stripe_webhook_events || []).find(x => x.id === id); return !!(e && e.processed_at); };

// ── plan-iterate ───────────────────────────────────────────────────────────
const PLAN_ID = '44444444-4444-4444-8444-444444444444';
const ALT_PLAN = { site_analysis: { size_m2: 6 }, recommended_plants: [{ name: 'Tomate', qty: 2 }], warnings: [] };
function antwort(text, stop) { return { id: 'msg_1', model: 'claude-sonnet-4-6', role: 'assistant', stop_reason: stop || 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 200 } }; }
async function planIterate(anthropic) {
  const f = await lade('plan-iterate', {
    nutzer: NUTZER,
    env: { ANTHROPIC_API_KEY: 'sk-ant-test' },
    tabellen: {
      garden_plans: [{ id: PLAN_ID, user_id: U, ai_analysis: JSON.parse(JSON.stringify(ALT_PLAN)), iterations: [], scan_input: {} }],
      v_user_entitlements: [{ user_id: U, tier: 'free', role: 'user', is_admin: false }],
      app_settings: [], regional_garden_calendars: [], ai_usage: [],
    },
    rpc: {
      fn_ai_kontingent_reservieren: () => ({ data: true, error: null }),
      fn_ai_kontingent_freigeben: (a) => { f.z.freigaben = (f.z.freigaben || 0) + 1; return { data: true, error: null }; },
      fn_log_ai_usage: () => ({ data: null, error: null }),
    },
  });
  const altFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).indexOf('api.anthropic.com') >= 0) return new Response(JSON.stringify(anthropic), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error('kein Netz: ' + url);
  };
  let r;
  try { r = await f.aufruf({ headers: auth('tok_u'), body: { plan_id: PLAN_ID, user_message: 'Bitte Basilikum dazu' } }); }
  finally { globalThis.fetch = altFetch; }
  const zeile = f.z.tabellen.garden_plans[0];
  return { r, z: f.z, zeile, geschrieben: f.z.ops.some(o => o.table === 'garden_plans' && o.art === 'update') };
}

// ── Geheimnis-Vergleich ────────────────────────────────────────────────────
// Eine EIGENE konstantzeitige Vergleichsfunktion oder -schleife in einer index.ts.
// Erkannt an der FORM: eine Funktionsdefinition namens constantTimeEquals/timingSafeEqual,
// oder eine Schleife, die per XOR ueber charCodeAt akkumuliert.
function eigeneVergleiche(src) {
  const t = [];
  if (/function\s+(constantTimeEquals|timingSafeEqual|safeEqual)\s*\(/.test(src)) t.push('eigene Funktion');
  if (/\|=\s*[A-Za-z_$][\w$.]*\.charCodeAt\([^)]*\)\s*\^/.test(src)) t.push('eigene XOR-Schleife');
  return t;
}
// Bewusst NICHT umgestellt — mit Grund: nie ausgeliefert, und ob sie bleibt, ist eine Entscheidung.
const VERGLEICH_BEWUSST = {
  'daily-push': 'AUSLIEFERUNG.json „nicht" (nie ausgeliefert, liest Spalten, die es live nicht gibt) — reparieren oder entfernen ist eine Entscheidung; die Schleife steht hier benannt, nicht repariert',
};

module.exports = [
  // ── A · stripe-webhook (Brett fe36) ───────────────────────────────────────
  {
    name: 'stripe-webhook · account.updated / account.application.deauthorized: ein Schreibfehler in marketplace_sellers → 500, processed_at bleibt leer (Stripe wiederholt); ohne Fehler 200 und der Status steht da (fe36)',
    lauf: async () => {
      const fehler = [];
      const a = await webhook(ereignis('evt_au', 'account.updated', KONTO), null, { 'marketplace_sellers:update': DBFEHLER });
      if (a.r.status !== 500 || verarbeitet(a.z, 'evt_au')) fehler.push('account.updated mit Schreibfehler → ' + a.r.status + ', processed_at ' + verarbeitet(a.z, 'evt_au'));
      const b = await webhook(ereignis('evt_ad', 'account.application.deauthorized', { id: 'ca_1' }, { account: 'acct_1' }), null, { 'marketplace_sellers:update': DBFEHLER });
      if (b.r.status !== 500 || verarbeitet(b.z, 'evt_ad')) fehler.push('deauthorized mit Schreibfehler → ' + b.r.status + ', processed_at ' + verarbeitet(b.z, 'evt_ad'));
      const c = await webhook(ereignis('evt_al', 'account.updated', KONTO), null, { 'marketplace_sellers:select': DBFEHLER });
      if (c.r.status !== 500 || verarbeitet(c.z, 'evt_al')) fehler.push('account.updated mit Lesefehler (Vorpruefung) → ' + c.r.status + ' (galt als „unbekanntes Konto")');
      const g = await webhook(ereignis('evt_ag', 'account.updated', KONTO));
      if (g.r.status !== 200 || !verarbeitet(g.z, 'evt_ag') || g.z.tabellen.marketplace_sellers[0].status !== 'active') fehler.push('gut: ' + g.r.status + ' ' + g.z.tabellen.marketplace_sellers[0].status);
      const d = await webhook(ereignis('evt_dg', 'account.application.deauthorized', { id: 'ca_1' }, { account: 'acct_1' }));
      if (d.r.status !== 200 || d.z.tabellen.marketplace_sellers[0].status !== 'disabled') fehler.push('deauthorized gut: ' + d.r.status + ' ' + d.z.tabellen.marketplace_sellers[0].status);
      const u = await webhook(ereignis('evt_au2', 'account.updated', Object.assign({}, KONTO, { id: 'acct_fremd' })));
      if (u.r.status !== 200) fehler.push('unbekanntes Konto (keine Zeile) soll 200 bleiben: ' + u.r.status);
      return fehler.length ? nein(fehler.join(' · ')) : ok('Schreib- und Lesefehler → 500 ohne processed_at · gut → 200 active/disabled · unbekanntes Konto 200');
    },
  },
  {
    name: 'stripe-webhook · stripe_webhook_events: Lesefehler beim Duplikat-Blick oder Fehler beim Vorab-Eintrag → 500, NICHTS verbucht; ein Fehler beim Setzen von processed_at NACH der Verbuchung bleibt 200 mit Warnung (fe36)',
    lauf: async () => {
      const fehler = [];
      const sess = { id: 'cs_l', mode: 'payment', payment_status: 'paid', customer: 'cus_1', payment_intent: 'pi_l', line_items: { data: [{ price: { id: LIFE.id } }] }, metadata: { supabase_user_id: U } };
      const evt = ereignis('evt_cl', 'checkout.session.completed', sess);
      const a = await webhook(evt, null, { 'stripe_webhook_events:select': DBFEHLER });
      if (a.r.status !== 500 || a.z.tabellen.stripe_subscriptions.length) fehler.push('Lesefehler: ' + a.r.status + ', verbucht ' + a.z.tabellen.stripe_subscriptions.length);
      const b = await webhook(evt, null, { 'stripe_webhook_events:upsert': DBFEHLER });
      if (b.r.status !== 500 || b.z.tabellen.stripe_subscriptions.length) fehler.push('Vorab-Eintrag scheitert: ' + b.r.status + ', verbucht ' + b.z.tabellen.stripe_subscriptions.length);
      // processed_at: die Verbuchung ist geschehen — 200, aber laut.
      const c = await webhook(evt, null, { 'stripe_webhook_events:update': DBFEHLER });
      if (c.r.status !== 200 || c.z.tabellen.stripe_subscriptions.length !== 1) fehler.push('processed_at-Fehler: ' + c.r.status + ', verbucht ' + c.z.tabellen.stripe_subscriptions.length);
      if (!c.z.log.some(l => l[0] === 'warn' && /processed_at/.test(l[1]))) fehler.push('processed_at-Fehler ohne Warnung im Log');
      // Und wenn Stripe es doch wiederholt (processed_at fehlt): dieselbe Zustellung ist idempotent.
      const vorher = JSON.stringify([c.z.tabellen.stripe_subscriptions.map(x => [x.id, x.tier, x.status, x.is_lifetime]), c.z.tabellen.launch_offer_usage]);
      const d = await webhook(evt, null, null, c.f);
      const nachher = JSON.stringify([d.z.tabellen.stripe_subscriptions.map(x => [x.id, x.tier, x.status, x.is_lifetime]), d.z.tabellen.launch_offer_usage]);
      if (d.r.status !== 200 || vorher !== nachher) fehler.push('Wiederholung nicht idempotent: ' + vorher + ' → ' + nachher);
      const g = await webhook(evt);
      if (g.r.status !== 200 || !verarbeitet(g.z, 'evt_cl')) fehler.push('gut: ' + g.r.status);
      const e = await webhook(evt, { stripe_webhook_events: [{ id: 'evt_cl', type: 'x', processed_at: '2026-11-11T00:00:00Z' }] });
      if (e.r.status !== 200 || e.z.tabellen.stripe_subscriptions.length) fehler.push('schon verarbeitet soll nichts tun: ' + e.r.status);
      return fehler.length ? nein(fehler.join(' · ')) : ok('Lesen/Vorab-Eintrag scheitert → 500, 0 verbucht · processed_at scheitert → 200 + Warnung · zweite Zustellung idempotent · schon verarbeitet → nichts');
    },
  },
  {
    name: 'stripe-webhook · kein Schreib- oder Lesevorgang mehr, dessen Antwort niemand ansieht (Quelltext: jedes `await admin.from(…)` steht in pruefe/warne, wird destrukturiert mit error oder als Ergebnis gelesen) (fe36, Klasse)',
    lauf: async (h) => {
      const src = h.ohneKommentare(h.lies('stripe-webhook/index.ts'));
      const nackt = [];
      const re = /(^|[^\w.])await\s+admin\s*\.\s*from\(/g;
      let m;
      while ((m = re.exec(src))) {
        const vor = src.slice(Math.max(0, m.index - 80), m.index + m[1].length);
        const zeile = src.slice(0, m.index).split('\n').length;
        if (/(pruefe|warne)\(\s*$/.test(vor)) continue;
        if (/const\s*\{[^}]*\berror\b[^}]*\}\s*=\s*$/.test(vor)) continue;
        const gemerkt = vor.match(/const\s+([A-Za-z_]\w*)\s*=\s*$/);   // ganzes Ergebnis gemerkt — dann muss <name>.error gelesen werden
        if (gemerkt && new RegExp('\\b' + gemerkt[1] + '\\.error\\b').test(src.slice(m.index))) continue;
        nackt.push('Z.' + zeile);
      }
      return nackt.length ? nein(nackt.length + ' Aufrufe ohne Blick auf error: ' + nackt.join(', ')) : ok('jeder admin.from()-Aufruf liest seine Antwort');
    },
  },

  // ── B · delete-user (Brett cde7) ──────────────────────────────────────────
  {
    name: 'delete-user · Organisations-Abfrage: nur eine fehlende Tabelle (42P01) heisst „keine Sperre"; jeder andere Fehler bricht ab, BEVOR etwas geloescht wird (cde7)',
    lauf: async (h) => {
      const fehler = [];
      const L = await h.modul('_shared/loeschung_regeln.mjs');
      if (typeof L.orgAbfrageSperre !== 'function') fehler.push('orgAbfrageSperre fehlt in loeschung_regeln.mjs');
      else {
        const a = L.orgAbfrageSperre({ code: '42P01', message: 'x' }), a2 = L.orgAbfrageSperre({ code: 'PGRST205', message: 'x' }), b = L.orgAbfrageSperre(DBFEHLER), c = L.orgAbfrageSperre(null), d = L.orgAbfrageSperre({ message: 'ohne Code' });
        if (a.gesperrt || a2.gesperrt || c.gesperrt || !b.gesperrt || !d.gesperrt || b.status !== 409 || !b.message || b.message.length > 120 || /^(org_creator|abo_kuendigung):/.test(b.message) || /connection reset/.test(JSON.stringify(b))) fehler.push('Regel: ' + JSON.stringify([a, a2, b, c, d]));
      }
      const tab = () => ({ organizations: [], stripe_subscriptions: [], profiles: [{ id: U }] });
      const loeschOps = (z) => z.ops.filter(o => o.art === 'delete' || o.art === 'storage.remove' || o.art === 'storage.list' || o.art === 'auth.deleteUser').length;
      const f = await lade('delete-user', { nutzer: NUTZER, tabellen: tab(), fehler: { 'organizations:select': DBFEHLER } });
      const r = await f.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      if (r.status === 200 || loeschOps(f.z)) fehler.push('Abfragefehler → ' + r.status + ', Loeschschritte ' + loeschOps(f.z));
      if (/connection reset/.test(r.text)) fehler.push('Rohtext der Datenbank in der Antwort: ' + r.text);
      const ohneT = tab(); delete ohneT.organizations;
      const g = await lade('delete-user', { nutzer: NUTZER, tabellen: ohneT });
      const r2 = await g.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      if (r2.status !== 200 || !g.z.ops.some(o => o.art === 'auth.deleteUser')) fehler.push('fehlende Tabelle (42P01) soll loeschen: ' + r2.status + ' ' + r2.text);
      const s = await lade('delete-user', { nutzer: NUTZER, tabellen: Object.assign(tab(), { organizations: [{ id: 'o1', name: 'Schule', created_by: U }] }) });
      const r3 = await s.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      if (r3.status !== 409 || loeschOps(s.z)) fehler.push('Ersteller → ' + r3.status);
      return fehler.length ? nein(fehler.join(' · ')) : ok('Abfragefehler → ' + r.status + ' ohne Loeschschritt · 42P01 → 200 · Ersteller → 409');
    },
  },

  // ── C · plan-iterate (Brett 9d96) ─────────────────────────────────────────
  {
    name: 'plan-iterate · Formpruefung als Regel (_shared/plan_antwort.mjs): ok · abgeschnitten · kein_json · struktur — gegen die Felder, die die App liest (9d96)',
    lauf: async (h) => {
      if (!h.gibtEs('_shared/plan_antwort.mjs')) return nein('_shared/plan_antwort.mjs fehlt');
      const P = await h.modul('_shared/plan_antwort.mjs');
      const z = (text, stop) => P.planAntwortPruefen(antwort(text, stop)).zustand;
      const gut = JSON.stringify(Object.assign({}, ALT_PLAN, { change_summary: 'Basilikum dazu' }));
      const faelle = [
        [gut, 'end_turn', 'ok'],
        ['```json\n' + gut + '\n```', 'end_turn', 'ok'],
        [gut.slice(0, 40), 'max_tokens', 'abgeschnitten'],
        [gut, 'max_tokens', 'abgeschnitten'],
        ['Hier ist dein Plan: …', 'end_turn', 'kein_json'],
        ['[1,2,3]', 'end_turn', 'struktur'],
        ['"nur Text"', 'end_turn', 'struktur'],
        [JSON.stringify({ site_analysis: { size_m2: 6 } }), 'end_turn', 'struktur'],
        [JSON.stringify({ recommended_plants: 'Tomate' }), 'end_turn', 'struktur'],
        [JSON.stringify({ recommended_plants: [{ qty: 2 }] }), 'end_turn', 'struktur'],
        [JSON.stringify({ recommended_plants: [], warnings: 'Achtung' }), 'end_turn', 'struktur'],
        [JSON.stringify({ recommended_plants: [], site_analysis: [] }), 'end_turn', 'struktur'],
        [JSON.stringify({ recommended_plants: [{ name: "Tomate d'Or 🍅" }], change_summary: 'ok' }), 'end_turn', 'ok'],
      ];
      const rot = faelle.filter(([t, s, w]) => z(t, s) !== w).map(([t, s, w]) => w + ' erwartet, ' + z(t, s) + ' fuer ' + t.slice(0, 40));
      const r = P.planAntwortPruefen(antwort(gut));
      if (r.analyse.change_summary !== undefined || r.zusammenfassung !== 'Basilikum dazu') rot.push('change_summary nicht abgetrennt');
      const lang = P.planAntwortPruefen(antwort(JSON.stringify({ recommended_plants: [], change_summary: 'x'.repeat(5000) })));
      if (lang.zusammenfassung.length > 200 || typeof P.planAntwortPruefen(antwort(JSON.stringify({ recommended_plants: [], change_summary: { a: 1 } }))).zusammenfassung !== 'string') rot.push('change_summary nicht gedeckelt/als Text');
      return rot.length ? nein(rot.join(' · ')) : ok(faelle.length + ' Antworten richtig eingeordnet · change_summary abgetrennt und gedeckelt');
    },
  },
  {
    name: 'plan-iterate · stop_reason max_tokens oder falsche Form → 502 mit klarem Satz, garden_plans bleibt unveraendert, die Reservierung bleibt (der Anbieter hat gerechnet); eine gute Antwort wird geschrieben (9d96)',
    lauf: async () => {
      const fehler = [];
      const gut = JSON.stringify(Object.assign({}, ALT_PLAN, { recommended_plants: [{ name: 'Tomate', qty: 2 }, { name: 'Basilikum', qty: 3 }], change_summary: 'Basilikum dazu' }));
      const a = await planIterate(antwort(gut.slice(0, gut.length - 30), 'max_tokens'));
      if (a.r.status !== 502 || a.geschrieben || a.zeile.ai_analysis.recommended_plants.length !== 1) fehler.push('abgeschnitten → ' + a.r.status + ', geschrieben ' + a.geschrieben);
      if (!a.r.body || !a.r.body.error || a.r.body.error.code !== 'abgeschnitten' || !a.r.body.error.message) fehler.push('abgeschnitten ohne Satz: ' + a.r.text.slice(0, 120));
      if (a.z.freigaben) fehler.push('abgeschnitten gibt die Reservierung frei (der Anbieter hat gerechnet)');
      // Auch ein abgeschnittenes, zufaellig gueltiges JSON wird nicht geschrieben.
      const a2 = await planIterate(antwort(gut, 'max_tokens'));
      if (a2.r.status !== 502 || a2.geschrieben) fehler.push('max_tokens mit gueltigem JSON → ' + a2.r.status + ', geschrieben ' + a2.geschrieben);
      const b = await planIterate(antwort(JSON.stringify({ recommended_plants: 'alles weg', change_summary: 'x' })));
      if (b.r.status !== 502 || b.geschrieben || !Array.isArray(b.zeile.ai_analysis.recommended_plants)) fehler.push('falsche Form → ' + b.r.status + ', geschrieben ' + b.geschrieben);
      const c = await planIterate(antwort('[]'));
      if (c.r.status !== 502 || c.geschrieben) fehler.push('Liste statt Plan → ' + c.r.status + ', geschrieben ' + c.geschrieben);
      const g = await planIterate(antwort(gut));
      if (g.r.status !== 200 || !g.geschrieben || g.zeile.ai_analysis.recommended_plants.length !== 2 || g.r.body.change_summary !== 'Basilikum dazu' || g.zeile.ai_analysis.change_summary !== undefined) fehler.push('gut → ' + g.r.status + ' ' + g.r.text.slice(0, 160));
      return fehler.length ? nein(fehler.join(' · ')) : ok('max_tokens → 502 abgeschnitten, nichts geschrieben, keine Freigabe · falsche Form → 502 · gut → 200 und geschrieben');
    },
  },

  // ── D · Geheimnis-Vergleich (Brett 4515) ──────────────────────────────────
  {
    name: 'Geheimnis-Vergleich · keine Function traegt eine eigene constantTimeEquals-Kopie oder XOR-Schleife; send-push und i18n-translate importieren sie aus _shared/auth_vergleich.mjs; daily-push benannt (4515)',
    lauf: async (h) => {
      // Gegenprobe der Suche selbst: beide Formen MUESSEN erkannt werden, ein Import nicht.
      if (eigeneVergleiche('function constantTimeEquals(a: string, b: string) {}').length !== 1
        || eigeneVergleiche('let m = 0; for (;;) m |= x.charCodeAt(i) ^ y.charCodeAt(i);').length !== 1
        || eigeneVergleiche('import { constantTimeEquals } from "../_shared/auth_vergleich.mjs"; constantTimeEquals(a, b);').length !== 0) return nein('die Suche erkennt die Formen nicht');
      const rot = [], benannt = [];
      for (const fn of h.functions()) {
        const t = eigeneVergleiche(h.ohneKommentare(h.lies(fn + '/index.ts')));
        if (!t.length) continue;
        if (VERGLEICH_BEWUSST[fn]) benannt.push(fn); else rot.push(fn + ' (' + t.join(', ') + ')');
      }
      for (const fn of Object.keys(VERGLEICH_BEWUSST)) if (!benannt.includes(fn)) rot.push(fn + ' steht in VERGLEICH_BEWUSST, hat aber keine eigene Kopie mehr — Eintrag ueberholt');
      for (const fn of ['send-push', 'i18n-translate']) {
        const s = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (!/import\s*\{[^}]*\bconstantTimeEquals\b[^}]*\}\s*from\s*["']\.\.\/_shared\/auth_vergleich\.mjs["']/.test(s)) rot.push(fn + ' importiert constantTimeEquals nicht aus _shared/auth_vergleich.mjs');
      }
      const ausl = JSON.parse(h.lies('AUSLIEFERUNG.json')).functions;
      for (const fn of benannt) if (!ausl[fn] || ausl[fn].zustand !== 'nicht') rot.push(fn + ' ist benannt, aber laut AUSLIEFERUNG.json nicht „nicht" — dann gehoert sie repariert');
      return rot.length ? nein(rot.join(' · ')) : ok('0 eigene Vergleiche · benannt: ' + benannt.join(', ') + ' (' + benannt.map(f => VERGLEICH_BEWUSST[f].split(' — ')[0]).join('; ') + ')');
    },
  },
];

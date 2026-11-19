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
  const f = f0 || await lade('stripe-webhook', { konten: [U], tabellen: Object.assign({ stripe_webhook_events: [], stripe_subscriptions: [], stripe_prices: [LIFE], stripe_products: PRODUKTE, launch_offer_usage: [], expert_verifications: [], notifications: [], audit_log: [], profiles: [], marketplace_sellers: SELLER(), system_events: [] }, tabellen || {}), fehler: fehler || {} });
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
  globalThis.fetch = anthropicStellen(f, anthropic);
  let r;
  try { r = await f.aufruf({ headers: auth('tok_u'), body: { plan_id: PLAN_ID, user_message: 'Bitte Basilikum dazu' } }); }
  finally { globalThis.fetch = altFetch; }
  const zeile = f.z.tabellen.garden_plans[0];
  return { r, z: f.z, zeile, geschrieben: f.z.ops.some(o => o.table === 'garden_plans' && o.art === 'update') };
}
// Anthropic gestellt: eine Antwort — oder eine Ausnahme (ein Zeitablauf ist ein DOMException
// 'TimeoutError', wie AbortSignal.timeout ihn wirft). Der Rumpf wird mitgeschrieben.
function anthropicStellen(f, anthropic) {
  return async (url, init) => {
    if (String(url).indexOf('api.anthropic.com') >= 0) {
      f.z.anthropicRumpf = init && typeof init.body === 'string' ? init.body : null;
      if (anthropic instanceof Error) throw anthropic;
      return new Response(JSON.stringify(anthropic), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error('kein Netz: ' + url);
  };
}
const zeitablauf = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

// ── garden-scan-analyze (der Erzeuger des Plans) ───────────────────────────
async function gardenScan(anthropic, horizont) {
  const f = await lade('garden-scan-analyze', {
    nutzer: NUTZER,
    env: { ANTHROPIC_API_KEY: 'sk-ant-test' },
    tabellen: {
      v_user_entitlements: [{ user_id: U, tier: 'free', role: 'user', is_admin: false }],
      plant_companion_matrix: [], garden_plans: [], app_settings: [], regional_garden_calendars: [], ai_usage: [],
    },
    rpc: {
      fn_check_rate_limit: () => ({ data: true, error: null }),
      fn_ai_kontingent_reservieren: () => ({ data: true, error: null }),
      fn_ai_kontingent_freigeben: () => { f.z.freigaben = (f.z.freigaben || 0) + 1; return { data: true, error: null }; },
      fn_log_ai_usage: () => ({ data: null, error: null }),
    },
  });
  const altFetch = globalThis.fetch;
  globalThis.fetch = anthropicStellen(f, anthropic);
  let r;
  try { r = await f.aufruf({ headers: auth('tok_u'), body: { photos: ['QUJDRA=='], metadata: {}, save_as_plan: true, planning_horizon_years: horizont || 1 } }); }
  finally { globalThis.fetch = altFetch; }
  return { r, z: f.z };
}

// ── Was die App ZEIGT (Gegenpruefung g2) ───────────────────────────────────
// Die ECHTEN Funktionen aus index.html: der Wrapper, der die Function ruft (gsIteratePlan /
// gsRunGardenScan), _gsEdgeFehler, _gsEdgeAusnahme, _gsFehlerText — und die Zeile `var em = …;`
// des Aufrufers, der den Satz auf den Bildschirm setzt (gsGardenScanChatSend / gsGardenScanSubmit),
// aus dem QUELLTEXT gelesen, nicht abgeschrieben: aendert jemand die Anzeige, misst der Fall die neue.
let _appSrc = null;
function appFunktion(kopf, repo) {
  if (!_appSrc) _appSrc = require('fs').readFileSync(require('path').join(repo, 'index.html'), 'utf8');
  const src = _appSrc, i = src.indexOf(kopf);
  if (i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; }
  return src.slice(i, j + 1);
}
const APP_WEGE = {
  iterate: { wrapper: 'async function gsIteratePlan(', aufrufer: 'async function gsGardenScanChatSend(', ruf: 'gsIteratePlan("p1", "Bitte Basilikum dazu")' },
  scan: { wrapper: 'async function gsRunGardenScan(', aufrufer: 'async function gsGardenScanSubmit(', ruf: 'gsRunGardenScan(["QUJDRA=="], {}, { save_as_plan: true })' },
};
async function appZeigt(repo, weg, antwort) {
  const w = APP_WEGE[weg];
  // Seit dem Tor (19.11.2026, Brett 89ee) fragen die Wrapper die Person (_gsPersonJetzt/_gsPersonAnders) und
  // _gsFehlerText kennt person_gewechselt — die Helfer kommen ECHT mit, nur _gsPerson ist gestellt: hier
  // wechselt niemand das Konto (das misst sicherheit_check 71_person, „Tor n").
  const teile = [w.wrapper, 'function _gsEdgeFehler(', 'function _gsEdgeAusnahme(', 'function _gsFehlerText(',
    'function _gsPersonJetzt(', 'function _gsPersonAnders(', 'function _gsPersonGewechselt(', 'function _gsPersonFehler(', 'function _gsPersonAusnahme(']
    .map(k => appFunktion(k, repo));
  const satz = (_appSrc.match(/\nvar GS_PERSON_GEWECHSELT_SATZ = ('[^'\n]*');/) || [])[1];
  if (!satz) return { fehler: 'GS_PERSON_GEWECHSELT_SATZ nicht gefunden' };
  teile.unshift('var GS_PERSON_GEWECHSELT_SATZ = ' + satz + '; function _gsPerson(){ return "u1"; }');
  const aufrufer = appFunktion(w.aufrufer, repo);
  const em = aufrufer && aufrufer.match(/\n\s*var em = ([^\n]+);\n/);
  if (teile.some(t => !t) || !em) return { fehler: 'App-Funktionen nicht gefunden: ' + teile.map(t => !!t).join(',') + ' · var em: ' + !!em };
  const app = new Function('window', 'sbIsLoggedIn', '_gsFreshToken', 'SB_URL', 'SB_KEY', 'gsAsyncLock', 'gsLocale', 'localStorage', teile.join('\n') +
    '\nreturn async function(){ var res = await ' + w.ruf + '; if (res && res.ok) return null; var em = ' + em[1] + '; return em; };');
  const fenster = { _gsFetch: async () => ({ ok: antwort.status >= 200 && antwort.status < 300, status: antwort.status, json: async () => antwort.body }) };
  return { gezeigt: await app(fenster, () => true, async () => 'tok', 'https://x', 'k', () => false, () => 'de-CH', { getItem: () => null })() };
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

  {
    name: 'plan-iterate · abgeschnitten: der Satz, den die Person sieht (gsIteratePlan → _gsEdgeFehler → _gsFehlerText der App), nennt den UMFANG DES PLANS als Ursache und sagt „unverändert" — kein „Wunsch kürzer fassen", keine Einladung zum selben Versuch; der Plan geht ohne Einrückung an die KI (Gesamtpruefung, Fund 5)',
    lauf: async (h) => {
      const fehler = [];
      const gut = JSON.stringify(Object.assign({}, ALT_PLAN, { change_summary: 'Basilikum dazu' }));
      const a = await planIterate(antwort(gut.slice(0, gut.length - 30), 'max_tokens'));
      const satz = a.r.body && a.r.body.error && a.r.body.error.message;
      if (a.r.status !== 502 || !satz) return nein('abgeschnitten → ' + a.r.status + ' ' + a.r.text.slice(0, 160));
      // Was auf dem Bildschirm steht: die ECHTEN Funktionen der App (gsIteratePlan, _gsEdgeFehler,
      // _gsEdgeAusnahme, _gsFehlerText) mit der Antwort dieser Function, und die Zeile, mit der
      // gsGardenScanChatSend den Satz zeigt — aus dem Quelltext gelesen (appZeigt).
      const z = await appZeigt(h.repo, 'iterate', { status: a.r.status, body: a.r.body });
      if (z.fehler) return nein(z.fehler);
      const gezeigt = z.gezeigt;
      if (gezeigt !== satz) fehler.push('die App zeigt einen anderen Satz als die Function schickt (gekuerzt oder ersetzt): „' + gezeigt + '"');
      if (!/\bPlan\b[^.]{0,40}\b(umfangreich|zu gro(ss|ß)|zu lang)\b/i.test(gezeigt)) fehler.push('nennt den Umfang des Plans nicht als Ursache: „' + gezeigt + '"');
      if (!/unver(ä|ae)ndert/i.test(gezeigt)) fehler.push('sagt nicht, dass der Plan unveraendert ist: „' + gezeigt + '"');
      if (/k(ü|ue)rzer|Wunsch/i.test(gezeigt)) fehler.push('schickt die Person zum Kuerzen des Wunsches — der Wunsch ist gedeckelt, die Laenge kommt vom Plan: „' + gezeigt + '"');
      if (/erneut|nochmal|noch einmal|versuch/i.test(gezeigt)) fehler.push('laedt zum selben Versuch ein (kostet je eine Kontingent-Einheit, aendert nichts): „' + gezeigt + '"');
      // Gegenpruefung g2: auch nicht zum AUFTEILEN — jede Iteration verlangt den GANZEN Plan zurueck,
      // ein kleinerer Schritt wird genauso lang. „in einem Schritt" stand in der ersten Fassung.
      if (/Schritt|aufteil|nacheinander|einzeln|kleiner/i.test(gezeigt)) fehler.push('laedt zum Aufteilen in kleinere Schritte ein — jede Iteration schreibt den ganzen Plan neu, ein kleiner Schritt wird ebenso abgeschnitten: „' + gezeigt + '"');
      // Der Plan geht OHNE Einrueckung an das Modell — die Antwort kommt sonst im selben, laengeren Format zurueck.
      let rumpf = null; try { rumpf = JSON.parse(a.z.anthropicRumpf || 'null'); } catch (_) {}
      const inhalt = rumpf && rumpf.messages && rumpf.messages[0] && String(rumpf.messages[0].content);
      if (!inhalt) fehler.push('kein Rumpf an Anthropic gesehen');
      else {
        if (inhalt.indexOf(JSON.stringify(ALT_PLAN)) < 0) fehler.push('der Plan steht nicht kompakt im Prompt');
        if (inhalt.indexOf(JSON.stringify(ALT_PLAN, null, 2)) >= 0) fehler.push('der Plan geht eingerueckt an die KI (JSON.stringify(…, null, 2))');
      }
      return fehler.length ? nein(fehler.join(' · ')) : ok('gezeigt: „' + gezeigt + '" (' + gezeigt.length + ' Zeichen, unveraendert durch die App) · Plan kompakt im Prompt · max_tokens ' + (rumpf && rumpf.max_tokens));
    },
  },

  {
    name: 'Zeitablauf · plan-iterate und garden-scan-analyze (110 s): der Satz, den die App zeigt (Wrapper → _gsEdgeFehler „⏱️" → _gsFehlerText), ist der GANZE Satz der Function — hoechstens 120 Zeichen, sonst kuerzt die App ihn mitten im Wort —, mit Umlauten, und der Rat „kuerzerer Horizont" kommt nur bei einem Mehrjahresplan (Gegenpruefung g2 zu Fund 5)',
    lauf: async (h) => {
      const fehler = [], gezeigt = {};
      const UMSCHRIFT = /k(ue)rz|l(ae)ng|gr(oe)ss|zur(ue)ck|\bf(ue)r\b|(ue)ber|m(oe)glich|(ae)nder|gew(ae)hl/i;   // ASCII-Umschrift auf dem Bildschirm
      const wege = [
        ['plan-iterate', 'iterate', () => planIterate(zeitablauf()), false],
        ['garden-scan-analyze (1 Jahr)', 'scan', () => gardenScan(zeitablauf(), 1), false],
        ['garden-scan-analyze (3 Jahre)', 'scan', () => gardenScan(zeitablauf(), 3), true],
      ];
      for (const [name, weg, lauf, mehrjahr] of wege) {
        const a = await lauf();
        const e = a.r.body && a.r.body.error;
        if (a.r.status !== 504 || !e || e.code !== 'timeout' || !e.message) { fehler.push(name + ': Zeitablauf → ' + a.r.status + ' ' + a.r.text.slice(0, 140)); continue; }
        const satz = String(e.message);
        // Eine KOPIE der Antwort: _gsEdgeFehler setzt „⏱️ " an das Objekt, das es bekommt.
        const z = await appZeigt(h.repo, weg, { status: a.r.status, body: JSON.parse(JSON.stringify(a.r.body)) });
        if (z.fehler) return nein(z.fehler);
        gezeigt[name] = z.gezeigt;
        if (z.gezeigt !== '⏱️ ' + satz) fehler.push(name + ': die App zeigt nicht den ganzen Satz (' + ('⏱️ ' + satz).length + ' Zeichen mit „⏱️", _gsFehlerText laesst 120 durch): „' + z.gezeigt + '"');
        if (UMSCHRIFT.test(satz)) fehler.push(name + ': Umschrift statt Umlaut auf dem Bildschirm: „' + satz + '"');
        if (!/nichts wurde gespeichert|unver(ä|ae)ndert/i.test(satz)) fehler.push(name + ': sagt nicht, dass nichts gespeichert wurde: „' + satz + '"');
        // Der Rat muss zur Anfrage passen: ein kuerzerer Horizont ist nur bei einem Mehrjahresplan moeglich.
        if (!mehrjahr && /Horizont/.test(satz)) fehler.push(name + ': raet zu einem kuerzeren Horizont, obwohl schon 1 Jahr geplant war: „' + satz + '"');
      }
      return fehler.length ? nein(fehler.join(' · ')) : ok(Object.keys(gezeigt).map(k => k + ': „' + gezeigt[k] + '" (' + gezeigt[k].length + ')').join(' · '));
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
      // Gesamtpruefung (16.11.2026): was umgestellt ist, sagt auch die Auslieferungsliste — wer
      // ausliefert, liest den Grund. „nur die Versionen festgelegt" verschwieg den neuen Vergleich
      // (zwei leere Werte sind dort kein Treffer mehr — eine Verhaltensaenderung).
      for (const fn of ['send-push', 'i18n-translate']) {
        const g = String((ausl[fn] && ausl[fn].grund) || '');
        if (!/Vergleich/.test(g)) rot.push('AUSLIEFERUNG.json ' + fn + ': der Grund nennt den umgestellten Geheimnis-Vergleich nicht („' + g + '")');
        if (/^nur\b/.test(g)) rot.push('AUSLIEFERUNG.json ' + fn + ': „' + g + '" — es ist nicht NUR das');
      }
      return rot.length ? nein(rot.join(' · ')) : ok('0 eigene Vergleiche · benannt: ' + benannt.join(', ') + ' (' + benannt.map(f => VERGLEICH_BEWUSST[f].split(' — ')[0]).join('; ') + ')');
    },
  },
];

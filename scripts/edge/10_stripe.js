// Bezahlen: stripe-checkout, stripe-portal, stripe-expert-checkout, stripe-webhook,
// delete-user, stripe-create-connect-account, stripe-bootstrap,
// stripe-admin-extend-webhook, entitlements (v33.59, Sicherheitspruefung
// 10.11.2026, edge-stripe #1–#16 und quelle-markt-admin #3).
//
// Zwei Haelften: die RECHNUNG in _shared/zahlung_regeln.mjs wird in Node
// ausgefuehrt, und der RAND — die echte index.ts — laeuft ueber
// scripts/edge/_zahlung_rand.js mit gestelltem Stripe und gestellter Datenbank.
// Jeder Fall misst die WIRKUNG (was an Stripe geht, was in der Tabelle steht,
// was der Aufrufer liest) mit einem feindlichen UND einem gutartigen Wert.
'use strict';
const { lade } = require('./_zahlung_rand.js');

const U = '11111111-1111-4111-8111-111111111111';   // gewoehnliche Person
const E = '22222222-2222-4222-8222-222222222222';   // Expertin
const A = '33333333-3333-4333-8333-333333333333';   // jemand anderes
const NUTZER = {
  tok_u: { id: U, email: 'u@example.org' },
  tok_e: { id: E, email: 'e@example.org' },
};
const MONAT = { id: 'price_monat01', active: true, recurring: { interval: 'month' }, metadata: { lookup_key: 'pro_monthly', interval: 'month' }, currency: 'chf', unit_amount: 790, product_id: 'prod_pro' };
const LIFE = { id: 'price_life001', active: true, recurring: null, metadata: { lookup_key: 'pro_lifetime', interval: 'lifetime', is_launch_offer: true, launch_offer_cap: 100 }, currency: 'chf', unit_amount: 4560, product_id: 'prod_life' };
const ALT = { id: 'price_alt0001', active: false, recurring: { interval: 'month' }, metadata: { interval: 'month' }, currency: 'chf', unit_amount: 100, product_id: 'prod_pro' };
// v33.59 (d1 #1): der tier steht in stripe_products — live OHNE Fremdschluessel von
// stripe_prices.product_id, also nicht einbettbar (die Attrappe antwortet darauf PGRST200).
const PRODUKTE = [{ id: 'prod_pro', name: 'Pro', tier: 'pro', active: true }, { id: 'prod_life', name: 'Pro Lifetime', tier: 'pro', active: true }, { id: 'prod_plus', name: 'Plus', tier: 'plus', active: true }];
const PLUS = { id: 'price_plus001', active: true, recurring: { interval: 'month' }, metadata: { lookup_key: 'plus_monthly', interval: 'month' }, currency: 'chf', unit_amount: 390, product_id: 'prod_plus' };
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const R = (h) => h.modul('_shared/zahlung_regeln.mjs');
const nimm = (z, name) => z.stripe.filter(c => c.name === name);
const nutzung = (n) => Array.from({ length: n }, (_, i) => ({ user_id: 'f' + i, subscription_id: 'lifetime_f' + i }));

function checkoutSzenario(extra) {
  return Object.assign({
    nutzer: NUTZER,
    tabellen: { stripe_prices: [MONAT, LIFE, ALT], stripe_subscriptions: [], launch_offer_usage: [], stripe_products: [] },
  }, extra || {});
}
async function checkout(body, extra) {
  const f = await lade('stripe-checkout', checkoutSzenario(extra));
  const r = await f.aufruf({ headers: auth('tok_u'), body });
  return { r, z: f.z, sess: nimm(f.z, 'checkout.sessions.create')[0] };
}
const ereignis = (id, type, obj, created) => JSON.stringify({ id, type, created: created || Math.floor(Date.now() / 1000), data: { object: obj } });
async function webhook(evt, tabellen, extra) {
  const f = await lade('stripe-webhook', Object.assign({ tabellen: Object.assign({ stripe_webhook_events: [], stripe_subscriptions: [], stripe_prices: [MONAT, LIFE, PLUS], stripe_products: PRODUKTE, launch_offer_usage: [], expert_verifications: [], notifications: [], audit_log: [], profiles: [] }, tabellen || {}) }, extra || {}));
  const r = await f.aufruf({ headers: { 'stripe-signature': 'sig-gut' }, body: evt });
  return { r, z: f.z };
}
const ok = (info) => ({ ok: true, info });
const nein = (warum) => ({ ok: false, warum });

module.exports = [
  // ── Rechnung ─────────────────────────────────────────────────────────────
  {
    name: 'Rechnung · rueckkehrAdresse laesst nur eigene Urspruenge durch (Vorschau-Unterdomaenen ja, fremde Hosts, javascript:, //host, Benutzerinfo, fremde Ports nein)',
    lauf: async (h) => {
      const { rueckkehrAdresse: ra, rueckkehrUrsprung: ru } = await R(h);
      const V = 'VORGABE';
      const gut = ['https://green-scan.ch/?billing=success&popup=1', 'https://greenscan-app.pages.dev/', 'https://abc123.greenscan-app.pages.dev/?billing=cancel&popup=1', 'https://green-scan.ch/?session_id={CHECKOUT_SESSION_ID}'];
      const boese = ['https://boese.example/phish', 'javascript:alert(1)', '//boese.example/x', 'https://green-scan.ch@boese.example/', 'https://u:p@green-scan.ch/', 'https://green-scan.ch:8443/', 'http://green-scan.ch/', 'https://green-scan.ch.boese.example/', 'https://evilgreenscan-app.pages.dev/', 'https://x.y.greenscan-app.pages.dev/', 'https://green-scan.ch/\n', 42, null, ''];
      const fg = gut.filter(u => ra(u, V) === V);
      const fb = boese.filter(u => ra(u, V) !== V);
      if (fg.length || fb.length) return nein('abgewiesen obwohl eigen: ' + JSON.stringify(fg) + ' · durchgelassen: ' + JSON.stringify(fb));
      if (ra(gut[3], V).indexOf('{CHECKOUT_SESSION_ID}') < 0) return nein('Platzhalter {CHECKOUT_SESSION_ID} beschaedigt: ' + ra(gut[3], V));
      if (ru('https://boese.example', V) !== V || ru('https://green-scan.ch', V) !== 'https://green-scan.ch') return nein('rueckkehrUrsprung rechnet falsch');
      return ok(gut.length + ' eigene bleiben · ' + boese.length + ' fremde/kaputte werden zur Vorgabe');
    },
  },
  {
    name: 'Rechnung · Katalog, Lifetime, Launch-Deckel und Gratisphase (gut UND schlecht)',
    lauf: async (h) => {
      const r = await R(h);
      const fehler = [];
      if (r.preisErlaubt('price_monat01', [MONAT, ALT]) !== MONAT) fehler.push('aktiver Preis abgelehnt');
      if (r.preisErlaubt('price_alt0001', [MONAT, ALT]) !== null) fehler.push('inaktiver Preis erlaubt');
      if (r.preisErlaubt('price_gibtsnicht', [MONAT]) !== null || r.preisErlaubt("price_x' or 1=1", [MONAT]) !== null) fehler.push('unbekannter Preis erlaubt');
      if (!r.istLifetimePreis(LIFE) || r.istLifetimePreis(MONAT) || !r.istLaunchPreis(LIFE) || r.istLaunchPreis(MONAT)) fehler.push('Lifetime/Launch falsch erkannt');
      if (r.preisIntervall({ metadata: {} }) !== null) fehler.push('Preis ohne Intervall wird zum Monatsabo');
      const L = (o) => r.launchAngebot(Object.assign({ preisIstLaunch: true, deckel: 100 }, o)).erlaubt;
      if (!L({ beansprucht: false, vergeben: 5 }) || L({ beansprucht: false, vergeben: 100 }) || L({ beansprucht: true, vergeben: 5 }) || L({ beansprucht: false, vergeben: null }) || L({ beansprucht: null, vergeben: 5 })) fehler.push('launchAngebot rechnet falsch');
      if (!r.launchAngebot({ preisIstLaunch: false }).erlaubt) fehler.push('Nicht-Launch-Preis gesperrt');
      const G = (o) => r.gratisTage(o);
      if (G({ fruehereAbos: [] }) !== 7 || G({ fruehereAbos: [], wunsch: 30 }) !== 7 || G({ fruehereAbos: [], wunsch: 0 }) !== 0 || G({ fruehereAbos: [{}] }) !== 0 || G({ fruehereAbos: null, abfrageFehler: { message: 'x' } }) !== 0 || G({ fruehereAbos: [], wunsch: '7' }) !== 0) fehler.push('gratisTage rechnet falsch');
      if (r.kundenId([{ stripe_customer_id: null, customer_id: 'cus_alt' }]) !== 'cus_alt' || r.kundenId([{ stripe_customer_id: 'x' }]) !== null) fehler.push('kundenId falsch');
      return fehler.length ? nein(fehler.join(' · ')) : ok('Katalog · Lifetime/Launch · Deckel mit „nicht pruefbar" · Gratisphase nur bei beantworteter Frage');
    },
  },
  {
    name: 'Rechnung · Reihenfolge, Entzug, Kuendigung, Admin-Geheimnis, Fehlercodes',
    lauf: async (h) => {
      const r = await R(h);
      const fehler = [];
      if (!r.ereignisIstNeuer(1700000100, '2023-11-14T22:13:00Z') || r.ereignisIstNeuer(1700000000, '2023-11-14T22:15:00Z') || !r.ereignisIstNeuer(1700000000, null) || r.ereignisIstNeuer(null, '2023-11-14T22:15:00Z')) fehler.push('ereignisIstNeuer');
      // Gegenpruefung: Stripe nennt ganze Sekunden — ein Ereignis aus DERSELBEN Sekunde wie der Stand ist nicht aelter.
      if (!r.ereignisIstNeuer(1700000000, '2023-11-14T22:13:20.500Z') || r.ereignisIstNeuer(1700000000, '2023-11-14T22:13:21.000Z')) fehler.push('ereignisIstNeuer (Sekunden-Rundung)');
      const zeilen = [{ id: 'lifetime_a', is_lifetime: true, metadata: { payment_intent: 'pi_1' } }, { id: 'sub_m', is_lifetime: false, metadata: { payment_intent: 'pi_2' } }];
      if (!r.lifetimeZumEntzug(zeilen, 'pi_1') || r.lifetimeZumEntzug(zeilen, 'pi_2') || r.lifetimeZumEntzug(zeilen, null) || r.lifetimeZumEntzug(zeilen.concat([{ id: 'lifetime_b', is_lifetime: true, metadata: { payment_intent: 'pi_1' } }]), 'pi_1')) fehler.push('lifetimeZumEntzug (eindeutig, nur Lifetime)');
      if (!r.ladungVollErstattet({ refunded: true }) || r.ladungVollErstattet({ refunded: false, amount: 4560, amount_refunded: 100 })) fehler.push('ladungVollErstattet');
      const k = r.zuKuendigendeAbos([{ id: 'sub_1', status: 'active' }, { id: 'sub_2', status: 'canceled' }, { id: 'lifetime_x', status: 'active', is_lifetime: true }, { id: 'sub_3', status: 'trialing' }]);
      if (k.join() !== 'sub_1,sub_3') fehler.push('zuKuendigendeAbos: ' + k.join());
      if (!r.adminGeheimnisOk('geheim', 'geheim') || r.adminGeheimnisOk('geheiM', 'geheim') || r.adminGeheimnisOk('', '') || r.adminGeheimnisOk(null, '') || r.adminGeheimnisOk('x', null)) fehler.push('adminGeheimnisOk');
      const c = r.fehlerCode(Object.assign(new Error('No such price: price_x (live mode)'), { type: 'StripeInvalidRequestError', param: 'line_items[0][price]' }));
      if (c.error !== 'unbekannter_preis' || /price_x/.test(JSON.stringify(c))) fehler.push('fehlerCode Preis');
      if (r.fehlerCode(new Error('relation stripe_customers does not exist'), 'checkout_failed').error !== 'checkout_failed') fehler.push('fehlerCode Rueckfall');
      return fehler.length ? nein(fehler.join(' · ')) : ok('alle sechs Regeln mit gut und schlecht');
    },
  },

  // ── stripe-checkout ──────────────────────────────────────────────────────
  {
    name: 'stripe-checkout · fremde success_url/cancel_url werden zur eigenen Adresse; eigene (auch Vorschau) bleiben (#6)',
    lauf: async () => {
      const b = await checkout({ price_id: MONAT.id, success_url: 'https://boese.example/danke', cancel_url: 'javascript:alert(1)' });
      if (!b.sess) return nein('keine Session angelegt: ' + b.r.status + ' ' + b.r.text);
      const p = b.sess.args[0];
      if (!/^https:\/\/green-scan\.ch\//.test(p.success_url) || !/^https:\/\/green-scan\.ch\//.test(p.cancel_url)) return nein('an Stripe ging success_url=' + p.success_url + ' cancel_url=' + p.cancel_url);
      const g = await checkout({ price_id: MONAT.id, success_url: 'https://abc.greenscan-app.pages.dev/?billing=success&popup=1', cancel_url: 'https://green-scan.ch/?billing=cancel&popup=1' });
      const q = g.sess && g.sess.args[0];
      if (!q || q.success_url !== 'https://abc.greenscan-app.pages.dev/?billing=success&popup=1' || q.cancel_url !== 'https://green-scan.ch/?billing=cancel&popup=1') return nein('eigene Adressen nicht unveraendert: ' + JSON.stringify(q && [q.success_url, q.cancel_url]));
      return ok('fremd → ' + p.success_url + ' · eigen bleibt');
    },
  },
  {
    name: 'stripe-checkout · unbekannter oder inaktiver Preis → 400, keine Session (#10)',
    lauf: async () => {
      const a = await checkout({ price_id: ALT.id });
      const b = await checkout({ price_id: 'price_gibtsnicht' });
      if (a.sess || a.r.status !== 400) return nein('inaktiver Preis: Status ' + a.r.status + ', Session: ' + !!a.sess);
      if (b.sess || b.r.status !== 400) return nein('unbekannter Preis: Status ' + b.r.status + ', Session: ' + !!b.sess);
      const g = await checkout({ price_id: MONAT.id });
      if (!g.sess || g.sess.args[0].mode !== 'subscription') return nein('aktiver Monatspreis geht nicht durch: ' + g.r.status + ' ' + g.r.text);
      return ok('inaktiv 400 · unbekannt 400 · aktiv → subscription');
    },
  },
  {
    name: 'stripe-checkout · Launch-Deckel entscheidet der Server, nicht das Flag des Clients (#1)',
    lauf: async () => {
      const voll = { tabellen: { stripe_prices: [MONAT, LIFE], stripe_subscriptions: [], launch_offer_usage: nutzung(100) } };
      const a = await checkout({ price_id: LIFE.id, claim_launch_offer: false }, voll);
      const b = await checkout({ price_id: LIFE.id, claim_launch_offer: true }, voll);
      if (a.sess || b.sess) return nein('bei 100 von 100 trotzdem eine Session: ohne Flag ' + !!a.sess + ' (Status ' + a.r.status + '), mit Flag ' + !!b.sess + ' (Status ' + b.r.status + ')');
      const schon = await checkout({ price_id: LIFE.id }, { tabellen: { stripe_prices: [LIFE], stripe_subscriptions: [], launch_offer_usage: [{ user_id: U }] } });
      if (schon.sess) return nein('zweiter Launch-Kauf derselben Person erlaubt');
      const g = await checkout({ price_id: LIFE.id, claim_launch_offer: false }, { tabellen: { stripe_prices: [LIFE], stripe_subscriptions: [], launch_offer_usage: nutzung(5) } });
      if (!g.sess) return nein('5 von 100: keine Session (' + g.r.status + ' ' + g.r.text + ')');
      const p = g.sess.args[0];
      if (p.mode !== 'payment' || p.metadata.claim_launch_offer !== '1') return nein('Metadaten setzt nicht der Server: ' + JSON.stringify(p.metadata));
      const m = await checkout({ price_id: MONAT.id, claim_launch_offer: true });
      if (!m.sess || m.sess.args[0].metadata.claim_launch_offer !== '0') return nein('Monatsabo mit Flag des Clients wird als Launch markiert');
      return ok('voll → ' + a.r.status + '/' + b.r.status + ' · schon beansprucht → ' + schon.r.status + ' · frei → Session mit claim=1 · Monatsabo claim=0');
    },
  },
  {
    name: 'stripe-checkout · Kunden-Id aus stripe_subscriptions statt bei jedem Aufruf einen neuen Stripe-Kunden (#5)',
    lauf: async () => {
      const a = await checkout({ price_id: MONAT.id }, { tabellen: { stripe_prices: [MONAT], stripe_subscriptions: [{ id: 'sub_alt', user_id: U, status: 'canceled', stripe_customer_id: 'cus_alt', is_lifetime: false }], launch_offer_usage: [] } });
      if (!a.sess) return nein('keine Session: ' + a.r.status + ' ' + a.r.text);
      if (a.sess.args[0].customer !== 'cus_alt' || nimm(a.z, 'customers.create').length) return nein('Kunde ' + a.sess.args[0].customer + ', neu angelegt: ' + nimm(a.z, 'customers.create').length);
      const b = await checkout({ price_id: MONAT.id });
      if (!b.sess || b.sess.args[0].customer !== 'cus_neu') return nein('ohne frueheres Abo kein neuer Kunde');
      return ok('vorhanden → cus_alt, 0 neu · ohne → cus_neu');
    },
  },
  {
    name: 'stripe-checkout · Gratisphase nur, wenn die Frage nach frueheren Abos beantwortet ist (#4, Teil ohne Schema)',
    lauf: async () => {
      const a = await checkout({ price_id: MONAT.id }, { fehler: { stripe_subscriptions: { code: '57014', message: 'canceling statement due to statement timeout' } } });
      const t = a.sess && a.sess.args[0].subscription_data && a.sess.args[0].subscription_data.trial_period_days;
      if (a.sess && t) return nein('Abfragefehler ergab ' + t + ' Gratistage');
      const g = await checkout({ price_id: MONAT.id });
      const tg = g.sess && g.sess.args[0].subscription_data && g.sess.args[0].subscription_data.trial_period_days;
      if (tg !== 7) return nein('erstes Abo ohne 7 Gratistage: ' + tg);
      const w = await checkout({ price_id: MONAT.id, trial_days: 30 });
      if (w.sess.args[0].subscription_data.trial_period_days !== 7) return nein('Wunsch 30 nicht auf 7 gedeckelt');
      return ok('Fehler → ' + (a.sess ? '0 Tage' : 'keine Session ' + a.r.status) + ' · erstes Abo → 7 · Wunsch 30 → 7');
    },
  },
  {
    name: 'stripe-checkout · Stripe-Fehler kommt als Kennung an, nicht als Rohtext (#15)',
    lauf: async () => {
      const roh = 'No such price: price_monat01; a similar object exists in live mode, but a test mode key was used';
      const a = await checkout({ price_id: MONAT.id }, { stripeAntwort: { 'checkout.sessions.create': () => { throw Object.assign(new Error(roh), { type: 'StripeInvalidRequestError', param: 'line_items[0][price]' }); } } });
      if (a.r.text.indexOf('live mode') >= 0 || a.r.text.indexOf('price_monat01') >= 0) return nein('Rohtext beim Aufrufer: ' + a.r.text);
      if (!a.r.body || typeof a.r.body.error !== 'string' || a.r.status < 400) return nein('keine Kennung: ' + a.r.status + ' ' + a.r.text);
      if (!a.z.log.some(l => l[0] === 'error' && l[1].indexOf('live mode') >= 0)) return nein('Rohtext nicht protokolliert');
      return ok(a.r.status + ' ' + a.r.text + ' · Rohtext im Protokoll');
    },
  },

  // ── stripe-portal ────────────────────────────────────────────────────────
  {
    name: 'stripe-portal · Kunde aus stripe_subscriptions (stripe_customers gibt es live nicht), fremde return_url → eigene (#5, #6, #15)',
    lauf: async () => {
      const f = await lade('stripe-portal', { nutzer: NUTZER, tabellen: { stripe_subscriptions: [{ id: 'sub_1', user_id: U, status: 'active', stripe_customer_id: 'cus_alt', created_at: '2026-01-01' }] } });
      const r = await f.aufruf({ headers: auth('tok_u'), body: { return_url: 'https://boese.example/' } });
      const s = nimm(f.z, 'billingPortal.sessions.create')[0];
      if (!s) return nein('keine Portal-Session: ' + r.status + ' ' + r.text);
      if (s.args[0].customer !== 'cus_alt') return nein('Kunde ' + s.args[0].customer);
      if (!/^https:\/\/green-scan\.ch\//.test(s.args[0].return_url)) return nein('return_url ' + s.args[0].return_url);
      const g = await f.aufruf({ headers: auth('tok_u'), body: { return_url: 'https://green-scan.ch/?billing=return&popup=1' } });
      const s2 = nimm(f.z, 'billingPortal.sessions.create')[1];
      if (!s2 || s2.args[0].return_url !== 'https://green-scan.ch/?billing=return&popup=1') return nein('eigene return_url veraendert');
      const f2 = await lade('stripe-portal', { nutzer: NUTZER, tabellen: { stripe_subscriptions: [{ id: 'sub_1', user_id: U, status: 'active', stripe_customer_id: 'cus_alt' }] }, stripeAntwort: { 'billingPortal.sessions.create': () => { throw new Error('No configuration provided and your live mode default configuration has not been created'); } } });
      const e = await f2.aufruf({ headers: auth('tok_u'), body: {} });
      if (e.text.indexOf('live mode') >= 0) return nein('Rohtext beim Aufrufer: ' + e.text);
      return ok('cus_alt · fremd → ' + s.args[0].return_url + ' · eigen bleibt · Fehler → ' + e.text);
    },
  },

  // ── stripe-expert-checkout + Webhook ────────────────────────────────────
  {
    name: 'stripe-expert-checkout · nur der Autor bezahlt, nie fuer sich selbst als Experte, Betrag fest (#2, quelle-markt-admin #3)',
    lauf: async () => {
      const tab = () => ({ social_posts: [{ id: 'p-u', user_id: U }, { id: 'p-a', user_id: A }, { id: 'p-e', user_id: E }], profiles: [{ id: E, is_expert: true }, { id: U, is_expert: false }, { id: A, is_expert: false }], expert_verifications: [] });
      const lauf = async (tok, body) => { const f = await lade('stripe-expert-checkout', { nutzer: NUTZER, tabellen: tab() }); const r = await f.aufruf({ headers: auth(tok), body }); return { r, z: f.z, s: nimm(f.z, 'checkout.sessions.create')[0] }; };
      const fremd = await lauf('tok_u', { post_id: 'p-a', expert_id: E });
      if (fremd.s) return nein('Beitrag einer anderen Person bezahlbar (' + fremd.r.status + ')');
      const selbst = await lauf('tok_e', { post_id: 'p-e', expert_id: E });
      if (selbst.s) return nein('Expertin bezahlt Verifikation ihres eigenen Beitrags durch sich selbst');
      const kein = await lauf('tok_u', { post_id: 'p-u', expert_id: A });
      if (kein.s) return nein('Nicht-Experte als expert_id angenommen');
      const g = await lauf('tok_u', { post_id: 'p-u', expert_id: E, amount_chf: 5 });
      if (!g.s) return nein('Autor mit echter Expertin abgewiesen: ' + g.r.status + ' ' + g.r.text);
      const betrag = g.s.args[0].line_items[0].price_data.unit_amount;
      if (betrag !== 50) return nein('Betrag aus dem Rumpf: ' + betrag);
      const zeile = g.z.tabellen.expert_verifications[0];
      if (!zeile || zeile.status !== 'pending') return nein('Anfrage-Zeile: ' + JSON.stringify(zeile));
      return ok('fremd ' + fremd.r.status + ' · selbst ' + selbst.r.status + ' · kein Experte ' + kein.r.status + ' · Autor+Expertin → Session 50 Rappen, Zeile pending');
    },
  },
  {
    name: 'stripe-webhook · eine bezahlte Experten-Anfrage schreibt die Gebuehr, nie „verified" (#2)',
    lauf: async () => {
      const ev = (st) => ({ expert_verifications: [{ post_id: 'p-u', expert_id: E, status: st, fee_paid_chf: 0 }] });
      const sess = { id: 'cs_1', mode: 'payment', payment_status: 'paid', amount_total: 50, payment_intent: 'pi_ev', metadata: { kind: 'expert_verification', supabase_user_id: U, post_id: 'p-u', expert_id: E } };
      const a = await webhook(ereignis('evt_1', 'checkout.session.completed', sess), ev('pending'));
      const z1 = a.z.tabellen.expert_verifications[0];
      if (z1.status !== 'pending') return nein('checkout.session.completed setzt status=' + z1.status);
      if (z1.fee_paid_chf !== 0.5 || z1.stripe_payment_intent_id !== 'pi_ev') return nein('Gebuehr nicht geschrieben: ' + JSON.stringify(z1));
      const b = await webhook(ereignis('evt_2', 'payment_intent.succeeded', { id: 'pi_ev', amount_received: 50, metadata: sess.metadata }), ev('pending'));
      const z2 = b.z.tabellen.expert_verifications[0];
      if (z2.status !== 'pending' || z2.fee_paid_chf !== 0.5) return nein('payment_intent.succeeded: ' + JSON.stringify(z2));
      const c = await webhook(ereignis('evt_3', 'checkout.session.completed', sess), ev('rejected'));
      if (c.z.tabellen.expert_verifications[0].status !== 'rejected') return nein('ein Urteil der Expertin wird von der Zahlung ueberschrieben');
      return ok('pending bleibt pending, Gebuehr 0.50 + pi geschrieben · rejected bleibt rejected');
    },
  },

  // ── stripe-webhook ───────────────────────────────────────────────────────
  {
    name: 'stripe-webhook · kein .catch an einer Abfrage: trial_will_end, charge.failed, Dispute, customer.updated, payment_method.attached antworten 200 und schreiben (#9)',
    lauf: async () => {
      const subZeile = { id: 'sub_1', user_id: U, stripe_customer_id: 'cus_1', status: 'trialing', is_lifetime: false };
      const faelle = [
        ['customer.subscription.trial_will_end', { id: 'sub_1', customer: 'cus_1', trial_end: 1900000000 }, (t) => t.notifications.length === 1],
        ['charge.failed', { id: 'ch_1', customer: 'cus_1', amount: 790, currency: 'chf', failure_code: 'card_declined', payment_intent: 'pi_x' }, (t) => t.audit_log.some(r => r.action === 'stripe_charge_failed')],
        ['charge.dispute.created', { id: 'dp_1', charge: 'ch_1', amount: 790, currency: 'chf', reason: 'fraudulent', status: 'needs_response', payment_intent: 'pi_x' }, (t) => t.audit_log.some(r => r.action === 'stripe_dispute_created')],
        ['customer.updated', { id: 'cus_1', email: 'neu@example.org' }, () => true],
        ['payment_method.attached', { id: 'pm_1', customer: 'cus_1' }, (t) => t.audit_log.some(r => r.action === 'stripe_payment_method_attached')],
      ];
      const rot = [];
      for (const [typ, obj, pruef] of faelle) {
        const w = await webhook(ereignis('evt_' + typ, typ, obj), { stripe_subscriptions: [Object.assign({}, subZeile)], profiles: [{ id: U }] });
        if (w.r.status !== 200 || !pruef(w.z.tabellen)) rot.push(typ + ' → ' + w.r.status + ' ' + w.r.text.slice(0, 80));
      }
      return rot.length ? nein(rot.join(' | ')) : ok(faelle.length + ' Zweige: 200 und die Zeile steht da');
    },
  },
  {
    name: 'stripe-webhook · Lifetime nur fuer den Lifetime-Preis; Launch-Zaehlung nach dem PREIS, nicht nach den Session-Metadaten; payment_intent wird vermerkt (#10, #1)',
    lauf: async () => {
      const sess = (claim) => ({ id: 'cs_9', mode: 'payment', payment_status: 'paid', customer: 'cus_1', payment_intent: 'pi_life', metadata: { supabase_user_id: U, claim_launch_offer: claim } });
      const monat = await webhook(ereignis('evt_a', 'checkout.session.completed', sess('0')), {}, { stripeAntwort: { 'checkout.sessions.listLineItems': () => ({ data: [{ price: { id: MONAT.id } }] }) } });
      if (monat.z.tabellen.stripe_subscriptions.some(r => r.is_lifetime)) return nein('Einmalzahlung auf einen Monatspreis ergab is_lifetime');
      const life = await webhook(ereignis('evt_b', 'checkout.session.completed', sess('0')), {}, { stripeAntwort: { 'checkout.sessions.listLineItems': () => ({ data: [{ price: { id: LIFE.id } }] }) } });
      const z = life.z.tabellen.stripe_subscriptions[0];
      if (!z || z.is_lifetime !== true) return nein('Lifetime-Preis ohne Lifetime: ' + JSON.stringify(z));
      if (!z.metadata || z.metadata.payment_intent !== 'pi_life') return nein('payment_intent nicht vermerkt (Rueckerstattung waere nicht zuordenbar)');
      if (life.z.tabellen.launch_offer_usage.length !== 1) return nein('Launch-Preis mit claim=0 in den Metadaten nicht gezaehlt');
      const unbekannt = await webhook(ereignis('evt_c', 'checkout.session.completed', sess('1')), {}, { stripeAntwort: { 'checkout.sessions.listLineItems': () => ({ data: [] }) } });
      if (unbekannt.z.tabellen.stripe_subscriptions.some(r => r.is_lifetime) || unbekannt.z.tabellen.launch_offer_usage.length) return nein('ohne aufloesbaren Preis freigeschaltet');
      return ok('Monatspreis → kein Lifetime · Lifetime-Preis → Lifetime + pi + Launch gezaehlt · unaufloesbar → nichts');
    },
  },
  {
    name: 'stripe-webhook · volle Rueckerstattung und Chargeback entziehen die Lifetime, Teil-Erstattung und fremde Zahlung nicht (#8)',
    lauf: async () => {
      const t = () => ({ stripe_subscriptions: [{ id: 'lifetime_' + U, user_id: U, is_lifetime: true, status: 'active', metadata: { payment_intent: 'pi_life' } }], profiles: [{ id: U, is_lifetime: true, tier: 'lifetime' }] });
      const voll = await webhook(ereignis('evt_r1', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_life', refunded: true, amount: 4560, amount_refunded: 4560 }), t());
      const z = voll.z.tabellen.stripe_subscriptions[0], p = voll.z.tabellen.profiles[0];
      if (voll.r.status !== 200 || z.is_lifetime !== false || z.status !== 'canceled' || p.is_lifetime !== false) return nein('volle Erstattung: ' + voll.r.status + ' ' + JSON.stringify(z) + ' ' + JSON.stringify(p));
      const teil = await webhook(ereignis('evt_r2', 'charge.refunded', { id: 'ch_1', payment_intent: 'pi_life', refunded: false, amount: 4560, amount_refunded: 500 }), t());
      if (teil.z.tabellen.stripe_subscriptions[0].is_lifetime !== true) return nein('Teil-Erstattung entzieht');
      const fremd = await webhook(ereignis('evt_r3', 'charge.refunded', { id: 'ch_2', payment_intent: 'pi_monat', refunded: true, amount: 790, amount_refunded: 790 }), t());
      if (fremd.z.tabellen.stripe_subscriptions[0].is_lifetime !== true) return nein('Erstattung einer anderen Zahlung entzieht');
      const dp = await webhook(ereignis('evt_r4', 'charge.dispute.created', { id: 'dp_1', charge: 'ch_1', payment_intent: 'pi_life', amount: 4560, currency: 'chf', reason: 'fraudulent', status: 'needs_response' }), t());
      if (dp.z.tabellen.stripe_subscriptions[0].is_lifetime !== false || dp.z.tabellen.profiles[0].is_lifetime !== false) return nein('Chargeback entzieht nicht');
      return ok('voll → entzogen (Zeile + Profil) · teil/fremd → bleibt · Dispute → entzogen');
    },
  },
  {
    name: 'stripe-webhook · ein verspaetetes aelteres Abo-Ereignis setzt ein gekuendigtes Abo nicht wieder auf active (#11)',
    lauf: async () => {
      const gespeichert = { id: 'sub_9', user_id: U, status: 'canceled', is_lifetime: false, updated_at: '2026-11-01T12:00:00Z', stripe_customer_id: 'cus_1' };
      const aktiv = { id: 'sub_9', customer: 'cus_1', status: 'active', cancel_at_period_end: false, current_period_start: 1761000000, current_period_end: 1763600000, trial_end: null, canceled_at: null, ended_at: null, metadata: { supabase_user_id: U }, items: { data: [{ price: { id: MONAT.id } }] } };
      const jetzt = Object.assign({}, aktiv, { status: 'canceled', canceled_at: 1762000000, ended_at: 1762000000 });
      const alt = Math.floor(Date.parse('2026-10-30T00:00:00Z') / 1000);
      const a = await webhook(ereignis('evt_alt', 'customer.subscription.updated', aktiv, alt), { stripe_subscriptions: [Object.assign({}, gespeichert)] }, { stripeAntwort: { 'subscriptions.retrieve': () => jetzt } });
      if (a.z.tabellen.stripe_subscriptions[0].status !== 'canceled') return nein('aelteres Ereignis schrieb status=' + a.z.tabellen.stripe_subscriptions[0].status);
      // Die Reihenfolge-Regel allein (ohne den frischen Abruf): ein aelteres Ereignis fragt Stripe gar nicht erst.
      if (nimm(a.z, 'subscriptions.retrieve').length) return nein('aelteres Ereignis wurde nicht vor dem Abruf verworfen');
      const neu = Math.floor(Date.parse('2026-11-05T00:00:00Z') / 1000);
      const reakt = Object.assign({}, aktiv);
      // Das Ereignis selbst sagt past_due, Stripe sagt JETZT active — es gilt der frische Stand.
      const b = await webhook(ereignis('evt_neu', 'customer.subscription.updated', Object.assign({}, aktiv, { status: 'past_due' }), neu), { stripe_subscriptions: [Object.assign({}, gespeichert)] }, { stripeAntwort: { 'subscriptions.retrieve': () => reakt } });
      if (b.z.tabellen.stripe_subscriptions[0].status !== 'active') return nein('neueres Ereignis nicht uebernommen: ' + b.z.tabellen.stripe_subscriptions[0].status + ' ' + b.r.text);
      // Gegenpruefung: der Stand ist der Zeitpunkt VOR dem Abruf — ein Ereignis aus derselben Sekunde,
      // das nach diesem Abruf entstand, darf danach nicht als „aelter" verworfen werden.
      let abgerufen = 0;
      const c = await webhook(ereignis('evt_c', 'customer.subscription.updated', aktiv, neu), { stripe_subscriptions: [Object.assign({}, gespeichert)] }, { stripeAntwort: { 'subscriptions.retrieve': () => { abgerufen = Date.now(); const bis = abgerufen + 15; while (Date.now() < bis) {} return reakt; } } });
      // v33.59 (d1 #2): der Stand steht in metadata.gs_stripe_stand — updated_at setzt live der Trigger (die Attrappe auch).
      const stand = Date.parse((c.z.tabellen.stripe_subscriptions[0].metadata || {}).gs_stripe_stand);
      if (!(stand <= abgerufen)) return nein('metadata.gs_stripe_stand fehlt oder liegt NACH dem Abruf (' + (stand - abgerufen) + ' ms) — ein Ereignis aus diesem Fenster gaelte als aelter');
      const sek = Math.floor(stand / 1000);
      const d = await webhook(ereignis('evt_d', 'customer.subscription.updated', aktiv, sek), { stripe_subscriptions: [Object.assign({}, gespeichert, { status: 'active', metadata: { supabase_user_id: U, gs_stripe_stand: new Date(sek * 1000 + 500).toISOString() } })] }, { stripeAntwort: { 'subscriptions.retrieve': () => jetzt } });
      if (d.z.tabellen.stripe_subscriptions[0].status !== 'canceled') return nein('Ereignis aus derselben Sekunde wie der Stand verworfen: ' + d.z.tabellen.stripe_subscriptions[0].status);
      return ok('alt → bleibt canceled · neu → active (frisch von Stripe geholt) · Stand vor dem Abruf, dieselbe Sekunde gilt als neuer');
    },
  },

  // ── Schlusspruefung d1 (v33.59) ─────────────────────────────────────────
  {
    name: 'Attrappe · verhaelt sich wie PostgREST: Einbettung ohne Live-Fremdschluessel → PGRST200, mit → aufgeloest; unbekannte Spalte → 42703 / PGRST204; updated_at gehoert dem Trigger (d1 #1, #2)',
    lauf: async (h) => {
      const S = await import(require('url').pathToFileURL(require('path').join(__dirname, '_zahlung_supabase.mjs')).href);
      const neu = (bez) => { globalThis.__gsZ = { tabellen: { stripe_prices: [Object.assign({}, MONAT)], stripe_products: PRODUKTE.map(p => Object.assign({}, p)), stripe_subscriptions: [{ id: 'sub_1', user_id: U, price_id: MONAT.id, updated_at: '2020-01-01T00:00:00Z' }] }, schluessel: {}, fehler: {}, ops: [], beziehungen: bez || [] }; return S.createClient('u', 'k'); };
      const fehler = [];
      const a = await neu().from('stripe_prices').select('id, product_id, stripe_products(tier)').eq('id', MONAT.id).maybeSingle();
      if (!a.error || a.error.code !== 'PGRST200') fehler.push('Einbettung ohne FK beantwortet: ' + JSON.stringify(a));
      const b = await neu([['stripe_prices', 'product_id', 'stripe_products', 'id']]).from('stripe_prices').select('id, stripe_products(tier)').eq('id', MONAT.id).maybeSingle();
      if (b.error || !b.data || !b.data.stripe_products || b.data.stripe_products.tier !== 'pro') fehler.push('Einbettung MIT deklariertem FK nicht aufgeloest: ' + JSON.stringify(b));
      const c = await neu().from('stripe_subscriptions').select('id, stripe_prices(product_id)').eq('id', 'sub_1').maybeSingle();
      if (c.error || !c.data.stripe_prices || c.data.stripe_prices.product_id !== 'prod_pro') fehler.push('live vorhandener FK (stripe_subscriptions.price_id) nicht aufgeloest: ' + JSON.stringify(c));
      const d = await neu().from('stripe_prices').select('id, gibtsnicht').eq('id', MONAT.id).maybeSingle();
      if (!d.error || d.error.code !== '42703') fehler.push('unbekannte Spalte gelesen: ' + JSON.stringify(d));
      const e = await neu().from('stripe_subscriptions').update({ gibtsnicht: 1 }).eq('id', 'sub_1');
      if (!e.error || e.error.code !== 'PGRST204') fehler.push('unbekannte Spalte geschrieben: ' + JSON.stringify(e));
      const k = neu(); await k.from('stripe_subscriptions').upsert({ id: 'sub_1', updated_at: '2001-01-01T00:00:00Z' }, { onConflict: 'id' });
      const st = globalThis.__gsZ.tabellen.stripe_subscriptions[0].updated_at;
      if (Date.now() - Date.parse(st) > 5000) fehler.push('Upsert auf eine bestehende Zeile behielt updated_at=' + st + ' (live setzt der Trigger now())');
      return fehler.length ? nein(fehler.join(' · ')) : ok('PGRST200 ohne FK · mit FK aufgeloest · 42703 / PGRST204 · Trigger setzt updated_at');
    },
  },
  {
    name: 'stripe-webhook · Abo-, Rechnungs- und Lifetime-Ereignisse antworten 200 und schreiben die Zeile, der tier kommt aus stripe_products (live ohne Fremdschluessel); scheitert nur diese Abfrage, gilt der alte Rueckfall (d1 #1)',
    lauf: async () => {
      const sub = (preis) => ({ id: 'sub_p', customer: 'cus_1', status: 'active', cancel_at_period_end: false, current_period_start: 1761000000, current_period_end: 1763600000, trial_end: null, canceled_at: null, ended_at: null, metadata: { supabase_user_id: U }, items: { data: [{ price: { id: preis } }] } });
      const rot = [];
      const a = await webhook(ereignis('evt_s1', 'customer.subscription.created', sub(PLUS.id)), {}, { stripeAntwort: { 'subscriptions.retrieve': () => sub(PLUS.id) } });
      const za = a.z.tabellen.stripe_subscriptions[0];
      if (a.r.status !== 200 || !za || za.tier !== 'plus') rot.push('subscription.created → ' + a.r.status + ' ' + a.r.text.slice(0, 140) + ' · Zeile ' + JSON.stringify(za && za.tier));
      const b = await webhook(ereignis('evt_s2', 'invoice.paid', { id: 'in_1', subscription: 'sub_p' }), {}, { stripeAntwort: { 'subscriptions.retrieve': () => sub(MONAT.id) } });
      const zb = b.z.tabellen.stripe_subscriptions[0];
      if (b.r.status !== 200 || !zb || zb.tier !== 'pro') rot.push('invoice.paid → ' + b.r.status + ' ' + b.r.text.slice(0, 140));
      const sess = { id: 'cs_l', mode: 'payment', payment_status: 'paid', customer: 'cus_1', payment_intent: 'pi_l', metadata: { supabase_user_id: U } };
      const c = await webhook(ereignis('evt_s3', 'checkout.session.completed', sess), {}, { stripeAntwort: { 'checkout.sessions.listLineItems': () => ({ data: [{ price: { id: LIFE.id } }] }) } });
      const zc = c.z.tabellen.stripe_subscriptions[0];
      if (c.r.status !== 200 || !zc || zc.is_lifetime !== true || zc.tier !== 'pro') rot.push('Lifetime-Kauf → ' + c.r.status + ' ' + c.r.text.slice(0, 140));
      // Gegenrichtung: scheitert NUR die Produkt-Abfrage, wird nicht geworfen (Rueckfall wie bis 44bb824: Abo 'free', Lifetime 'pro').
      const PF = { fehler: { stripe_products: { code: 'PGRST301', message: 'kaputt' } }, stripeAntwort: { 'subscriptions.retrieve': () => sub(PLUS.id), 'checkout.sessions.listLineItems': () => ({ data: [{ price: { id: LIFE.id } }] }) } };
      const d = await webhook(ereignis('evt_s4', 'customer.subscription.created', sub(PLUS.id)), {}, PF);
      if (d.r.status !== 200 || (d.z.tabellen.stripe_subscriptions[0] || {}).tier !== 'free') rot.push('Produkt-Abfrage kaputt, Abo → ' + d.r.status + ' ' + JSON.stringify(d.z.tabellen.stripe_subscriptions[0]));
      const e = await webhook(ereignis('evt_s5', 'checkout.session.completed', sess), {}, PF);
      if (e.r.status !== 200 || (e.z.tabellen.stripe_subscriptions[0] || {}).tier !== 'pro') rot.push('Produkt-Abfrage kaputt, Lifetime → ' + e.r.status);
      // Die Preisabfrage selbst darf werfen: ohne Preis kein Lifetime-Urteil, Stripe stellt neu zu.
      const f = await webhook(ereignis('evt_s6', 'checkout.session.completed', sess), {}, { fehler: { stripe_prices: { code: 'PGRST301', message: 'kaputt' } }, stripeAntwort: PF.stripeAntwort });
      if (f.r.status !== 500 || f.z.tabellen.stripe_subscriptions.length) rot.push('Preisabfrage kaputt → ' + f.r.status + ' (erwartet 500, keine Zeile)');
      return rot.length ? nein(rot.join(' | ')) : ok('created → 200 tier plus · invoice.paid → 200 tier pro · Lifetime → 200 · Produkt-Abfrage kaputt → 200 mit Rueckfall · Preis-Abfrage kaputt → 500');
    },
  },
  {
    name: 'stripe-webhook · keine Function bettet eine Tabelle ein, zu der live kein Fremdschluessel fuehrt; die Zahlungs-Functions lesen/schreiben nur Spalten, die es live gibt (d1 #1, Klasse)',
    lauf: async (h) => {
      const { SPALTEN, BEZIEHUNGEN, STAND } = await import(require('url').pathToFileURL(require('path').join(__dirname, '_live_schema.mjs')).href);
      // Bewusst: zwei Schreibvorgaenge auf Spalten, die es live nicht gibt — beide mit warne(), der Fehler wird protokolliert.
      const BEWUSST = ['stripe-webhook/index.ts stripe_subscriptions.trial_will_end_notified_at', 'stripe-webhook/index.ts profiles.stripe_email'];
      const ZAHLUNG = /^(stripe-[a-z-]+|delete-user|entitlements)\/index\.ts$|^_shared\/zahlung_regeln\.mjs$/;
      const rel = (a, b) => BEZIEHUNGEN.some(r => (r[0] === a && r[2] === b) || (r[0] === b && r[2] === a));
      const teile = (s) => { const o = []; let d = 0, c = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { o.push(c); c = ''; } else c += ch; } o.push(c); return o.map(x => x.trim()).filter(Boolean); };
      const einb = [], spalten = [];
      function sel(fn, t, s) {
        for (let it of teile(s)) {
          it = it.replace(/^[A-Za-z_0-9]+:(?!:)/, '');
          const m = it.match(/^([a-z_0-9]+)(![a-z_0-9]+)?\s*\((.*)\)$/s);
          if (m) { if (!rel(t, m[1])) einb.push(fn + ': ' + t + ' → ' + m[1]); else sel(fn, m[1], m[3]); continue; }
          const c = it.split('::')[0].split('->')[0].trim();
          if (c !== '*' && SPALTEN[t] && !SPALTEN[t].includes(c)) spalten.push(fn + ' ' + t + '.' + c);
        }
      }
      let n = 0;
      const shared = require('fs').readdirSync(require('path').join(h.repo, 'supabase', 'functions', '_shared')).filter(f => /\.mjs$/.test(f)).map(f => '_shared/' + f);
      for (const fn of h.functions().map(f => f + '/index.ts').concat(shared)) {
        let src; try { src = h.ohneKommentare(h.lies(fn)); } catch (_) { continue; }
        const re = /\.from\(\s*["']([a-z_0-9]+)["']\s*\)/g; let m;
        while ((m = re.exec(src))) {
          n++;
          const t = m[1], rest = src.slice(re.lastIndex, re.lastIndex + 1500);
          const e = rest.search(/;\s*\n|\.from\(/); const kette = e >= 0 ? rest.slice(0, e) : rest;
          for (const s of kette.matchAll(/\.select\(\s*["'`]([^"'`]*)["'`]/g)) {
            if (ZAHLUNG.test(fn)) sel(fn, t, s[1]);
            else for (const it of teile(s[1])) { const mm = it.replace(/^[A-Za-z_0-9]+:(?!:)/, '').match(/^([a-z_0-9]+)(![a-z_0-9]+)?\s*\(/); if (mm && !rel(t, mm[1])) einb.push(fn + ': ' + t + ' → ' + mm[1]); }
          }
          if (!ZAHLUNG.test(fn) || !SPALTEN[t]) continue;
          for (const s of kette.matchAll(/\.(?:eq|neq|in|is|lt|lte|gt|gte|like|ilike|order)\(\s*["']([a-z_0-9]+)/g)) if (!SPALTEN[t].includes(s[1])) spalten.push(fn + ' ' + t + '.' + s[1]);
          const w = kette.match(/\.(update|insert|upsert)\(\s*\{/);
          if (w) {
            let i = kette.indexOf('{', w.index), d = 0, j = i;
            for (; j < kette.length; j++) { if ('{(['.includes(kette[j])) d++; if ('})]'.includes(kette[j])) d--; if (d === 0) break; }
            let d2 = 0, cur = ''; const keys = [];
            for (const ch of kette.slice(i + 1, j)) { if ('{(['.includes(ch)) d2++; if ('})]'.includes(ch)) d2--; if (ch === ',' && d2 === 0) { keys.push(cur); cur = ''; } else cur += ch; }
            keys.push(cur);
            for (const k of keys) { const km = k.trim().match(/^["']?([a-z_0-9]+)["']?\s*(:|$)/); if (km && !SPALTEN[t].includes(km[1]) && BEWUSST.indexOf(fn + ' ' + t + '.' + km[1]) < 0) spalten.push(fn + ' ' + t + '.' + km[1] + ' (schreibt)'); }
          }
        }
      }
      if (n < 40) return nein('nur ' + n + ' Abfragen gefunden — der Parser sieht nichts');
      if (einb.length || spalten.length) return nein('Einbettung ohne Live-FK: ' + JSON.stringify(einb) + ' · Spalten, die es live nicht gibt: ' + JSON.stringify(spalten) + ' (Schema-Stand ' + STAND + ')');
      return ok(n + ' Abfragen in allen Functions: 0 Einbettungen ohne FK · Zahlungs-Functions: 0 unbekannte Spalten (' + BEWUSST.length + ' bewusst, mit warne) · Schema-Stand ' + STAND);
    },
  },
  {
    name: 'stripe-webhook · die Reihenfolge haengt an metadata.gs_stripe_stand, nicht an updated_at (das setzt live der Trigger auf now()); ein aelteres Ereignis aendert nichts, ein neueres wird nicht wegen eines Trigger-Stempels verworfen (d1 #2)',
    lauf: async () => {
      const aktiv = { id: 'sub_7', customer: 'cus_1', status: 'active', cancel_at_period_end: false, current_period_start: 1761000000, current_period_end: 1763600000, trial_end: null, canceled_at: null, ended_at: null, metadata: { supabase_user_id: U }, items: { data: [{ price: { id: MONAT.id } }] } };
      const gekuendigt = Object.assign({}, aktiv, { cancel_at_period_end: true });
      const T = '2026-11-05T00:00:00.000Z';
      // updated_at = jetzt (der Trigger hat beim letzten Schreiben gestempelt), der Stand der Momentaufnahme liegt davor.
      const zeile = () => ({ id: 'sub_7', user_id: U, status: 'active', is_lifetime: false, cancel_at_period_end: false, stripe_customer_id: 'cus_1', updated_at: new Date().toISOString(), metadata: { supabase_user_id: U, gs_stripe_stand: T } });
      const zwischen = Math.floor(Date.parse('2026-11-08T00:00:00Z') / 1000);
      const a = await webhook(ereignis('evt_k', 'customer.subscription.updated', gekuendigt, zwischen), { stripe_subscriptions: [zeile()] }, { stripeAntwort: { 'subscriptions.retrieve': () => gekuendigt } });
      const za = a.z.tabellen.stripe_subscriptions[0];
      if (za.cancel_at_period_end !== true) return nein('Kuendigung nach dem Stand, aber vor dem Trigger-Stempel verworfen (cancel_at_period_end=' + za.cancel_at_period_end + ', ' + a.r.status + ')');
      const vor = Math.floor(Date.parse('2026-11-01T00:00:00Z') / 1000);
      const b = await webhook(ereignis('evt_alt7', 'customer.subscription.updated', gekuendigt, vor), { stripe_subscriptions: [zeile()] }, { stripeAntwort: { 'subscriptions.retrieve': () => gekuendigt } });
      if (b.z.tabellen.stripe_subscriptions[0].cancel_at_period_end !== false || nimm(b.z, 'subscriptions.retrieve').length) return nein('aelteres Ereignis (vor dem Stand) hat geschrieben oder Stripe gefragt');
      // Der geschriebene Stand liegt VOR dem Abruf, auch wenn updated_at (Trigger) danach liegt; supabase_user_id bleibt.
      let abgerufen = 0;
      const c = await webhook(ereignis('evt_k2', 'customer.subscription.updated', gekuendigt, zwischen), { stripe_subscriptions: [zeile()] }, { stripeAntwort: { 'subscriptions.retrieve': () => { abgerufen = Date.now(); const bis = abgerufen + 15; while (Date.now() < bis) {} return gekuendigt; } } });
      const zc = c.z.tabellen.stripe_subscriptions[0];
      const stand = Date.parse(zc.metadata && zc.metadata.gs_stripe_stand);
      if (!(stand <= abgerufen)) return nein('metadata.gs_stripe_stand fehlt oder liegt nach dem Abruf: ' + JSON.stringify(zc.metadata));
      if (zc.metadata.supabase_user_id !== U) return nein('die Stripe-Metadaten gingen verloren: ' + JSON.stringify(zc.metadata));
      // Altzeile ohne gs_stripe_stand: Rueckfall auf updated_at.
      const alt = { id: 'sub_7', user_id: U, status: 'canceled', is_lifetime: false, stripe_customer_id: 'cus_1', updated_at: '2026-11-05T00:00:00Z', metadata: { supabase_user_id: U } };
      const d = await webhook(ereignis('evt_alt8', 'customer.subscription.updated', aktiv, vor), { stripe_subscriptions: [alt] }, { stripeAntwort: { 'subscriptions.retrieve': () => aktiv } });
      if (d.z.tabellen.stripe_subscriptions[0].status !== 'canceled') return nein('Altzeile: aelteres Ereignis schrieb (Rueckfall auf updated_at fehlt)');
      return ok('zwischen Stand und Trigger-Stempel → uebernommen · vor dem Stand → nichts, kein Abruf · Stand vor dem Abruf, Metadaten erhalten · Altzeile → updated_at');
    },
  },
  {
    name: 'stripe-checkout / stripe-portal · eine verworfene Rueckkehr-Adresse mit popup=1 (Netlify, localhost) behaelt popup=1 in der Vorgabe — sonst schliesst sich das Stripe-Fenster nicht (d1 #3)',
    lauf: async (h) => {
      const r = await R(h);
      const V = 'https://green-scan.ch/?billing=success&session_id={CHECKOUT_SESSION_ID}';
      const fehler = [];
      const a = r.rueckkehrAdresse('https://deploy-preview-9--green-scanswitzerland.netlify.app/?billing=success&popup=1', V);
      if (a !== V + '&popup=1') fehler.push('Netlify mit popup=1 → ' + a);
      if (r.rueckkehrAdresse('http://localhost:8080/?billing=cancel&popup=1', 'https://green-scan.ch/?billing=cancel') !== 'https://green-scan.ch/?billing=cancel&popup=1') fehler.push('localhost mit popup=1');
      if (r.rueckkehrAdresse('https://boese.example/', V) !== V) fehler.push('ohne popup=1 bekommt die Vorgabe eines dazu');
      if (r.rueckkehrAdresse('javascript:alert(1)//?popup=1', V).indexOf('javascript') >= 0) fehler.push('fremde Adresse durchgelassen');
      if (r.rueckkehrAdresse('https://boese.example/?popup=1&next=https://x', V) !== V + '&popup=1') fehler.push('mehr als popup=1 uebernommen');
      if (r.rueckkehrAdresse('https://green-scan.ch/?billing=success&popup=1', V) !== 'https://green-scan.ch/?billing=success&popup=1') fehler.push('eigene Adresse veraendert');
      if (r.rueckkehrUrsprung('https://boese.example', 'https://green-scan.ch') !== 'https://green-scan.ch') fehler.push('rueckkehrUrsprung');
      const b = await checkout({ price_id: MONAT.id, success_url: 'https://deploy-preview-9--green-scanswitzerland.netlify.app/?billing=success&popup=1', cancel_url: 'https://deploy-preview-9--green-scanswitzerland.netlify.app/?billing=cancel&popup=1' });
      const p = b.sess && b.sess.args[0];
      if (!p || !/[?&]popup=1(&|$)/.test(p.success_url) || !/[?&]popup=1(&|$)/.test(p.cancel_url) || p.success_url.indexOf('{CHECKOUT_SESSION_ID}') < 0) fehler.push('Checkout: ' + JSON.stringify(p && [p.success_url, p.cancel_url]));
      const f = await lade('stripe-portal', { nutzer: NUTZER, tabellen: { stripe_subscriptions: [{ id: 'sub_1', user_id: U, status: 'active', stripe_customer_id: 'cus_alt' }] } });
      await f.aufruf({ headers: auth('tok_u'), body: { return_url: 'http://localhost:5173/?billing=return&popup=1' } });
      const s = nimm(f.z, 'billingPortal.sessions.create')[0];
      if (!s || s.args[0].return_url !== 'https://green-scan.ch/?billing=return&popup=1') fehler.push('Portal: ' + (s && s.args[0].return_url));
      return fehler.length ? nein(fehler.join(' · ')) : ok('popup=1 bleibt (Checkout, Portal) · ohne popup=1 keine Zutat · Fremdes nie durchgelassen');
    },
  },

  // ── delete-user ──────────────────────────────────────────────────────────
  {
    name: 'delete-user · laufendes Abo wird VOR dem Loeschen gekuendigt; scheitert die Kuendigung, bleibt das Konto (#3)',
    lauf: async () => {
      const tab = () => ({ organizations: [], stripe_subscriptions: [{ id: 'sub_lauf', user_id: U, status: 'active', is_lifetime: false }, { id: 'lifetime_' + U, user_id: U, status: 'active', is_lifetime: true }, { id: 'sub_alt', user_id: U, status: 'canceled', is_lifetime: false }], profiles: [{ id: U }] });
      const f = await lade('delete-user', { nutzer: NUTZER, tabellen: tab() });
      const r = await f.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      const k = nimm(f.z, 'subscriptions.cancel').map(c => c.args[0]);
      if (k.join() !== 'sub_lauf') return nein('gekuendigt: [' + k.join() + '] (erwartet sub_lauf), Status ' + r.status);
      const erstesLoeschen = f.z.ops.findIndex(o => o.art === 'delete' || o.art === 'storage.remove' || o.art === 'storage.list');
      if (erstesLoeschen < 0 || r.status !== 200) return nein('Loeschung lief nicht: ' + r.status + ' ' + r.text);
      const n = await lade('delete-user', { nutzer: NUTZER, tabellen: tab(), stripeAntwort: { 'subscriptions.cancel': () => { throw Object.assign(new Error('Stripe down'), { type: 'StripeAPIError' }); } } });
      const r2 = await n.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      const geloescht = n.z.ops.filter(o => o.art === 'delete' || o.art === 'storage.remove' || o.art === 'auth.deleteUser');
      if (r2.status !== 409 || geloescht.length) return nein('Kuendigung gescheitert → Status ' + r2.status + ', Loeschschritte: ' + geloescht.length);
      if (!/^abo_kuendigung/.test(String(r2.body && r2.body.message)) || /Stripe down/.test(r2.text)) return nein('Antwort: ' + r2.text);
      const ohne = await lade('delete-user', { nutzer: NUTZER, env: { STRIPE_SECRET_KEY: null }, tabellen: tab() });
      const r3 = await ohne.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      if (r3.status !== 409 || ohne.z.ops.some(o => o.art === 'auth.deleteUser')) return nein('ohne Stripe-Schluessel und mit laufendem Abo geloescht: ' + r3.status);
      const leer = await lade('delete-user', { nutzer: NUTZER, env: { STRIPE_SECRET_KEY: null }, tabellen: { organizations: [], stripe_subscriptions: [{ id: 'lifetime_' + U, user_id: U, status: 'active', is_lifetime: true }], profiles: [{ id: U }] } });
      const r4 = await leer.aufruf({ headers: auth('tok_u'), body: { user_id: U } });
      if (r4.status !== 200 || leer.z.stripe.length) return nein('ohne laufendes Abo nicht geloescht: ' + r4.status + ' ' + r4.text);
      return ok('sub_lauf gekuendigt vor dem Loeschen · Fehler → 409 ' + r2.body.message + ', 0 Loeschschritte · ohne Schluessel 409 · nur Lifetime → 200 ohne Stripe');
    },
  },
  {
    name: 'delete-user · die Sperre steht als Regel im Modul (loeschung_regeln.mjs aboSperre), Meldung mit festem Praefix',
    lauf: async (h) => {
      const L = await h.modul('_shared/loeschung_regeln.mjs');
      if (typeof L.aboSperre !== 'function') return nein('aboSperre fehlt in loeschung_regeln.mjs');
      const s = L.aboSperre(['sub_1']), o = L.aboSperre([]);
      if (!s.gesperrt || s.status !== 409 || s.error !== 'abo_kuendigung' || o.gesperrt) return nein(JSON.stringify([s, o]));
      if (L.aboSperreMeldung(s).indexOf(L.ABO_SPERRE_PRAEFIX) !== 0) return nein('Meldung ohne Praefix');
      return ok(L.aboSperreMeldung(s));
    },
  },

  // ── stripe-create-connect-account ───────────────────────────────────────
  {
    name: 'stripe-create-connect-account · Origin nur aus eigenen Urspruengen, fremdes Stripe-Konto in der eigenen Zeile → 403, Fehler als Kennung (#6, #7, #15)',
    lauf: async () => {
      const lauf = async (zeile, origin, antw) => { const f = await lade('stripe-create-connect-account', { nutzer: NUTZER, tabellen: { marketplace_sellers: zeile ? [zeile] : [] }, stripeAntwort: antw || {} }); const r = await f.aufruf({ headers: Object.assign(auth('tok_u'), origin ? { Origin: origin } : {}) }); return { r, z: f.z, l: nimm(f.z, 'accountLinks.create')[0] }; };
      const a = await lauf(null, 'https://boese.example');
      if (!a.l || !/^https:\/\/green-scan\.ch\//.test(a.l.args[0].return_url) || !/^https:\/\/green-scan\.ch\//.test(a.l.args[0].refresh_url)) return nein('fremder Origin: ' + JSON.stringify(a.l && a.l.args[0]) + ' ' + a.r.text);
      const g = await lauf(null, 'https://abc.greenscan-app.pages.dev');
      if (!g.l || g.l.args[0].return_url.indexOf('https://abc.greenscan-app.pages.dev/') !== 0) return nein('Vorschau-Origin nicht uebernommen');
      const fremd = await lauf({ user_id: U, stripe_account_id: 'acct_fremd' }, null, { 'accounts.retrieve': (id) => ({ id, metadata: { gs_user_id: A } }) });
      if (fremd.l || fremd.r.status !== 403) return nein('Onboarding-Link fuer ein fremdes Konto: ' + fremd.r.status);
      const eigen = await lauf({ user_id: U, stripe_account_id: 'acct_eigen' }, null, { 'accounts.retrieve': (id) => ({ id, metadata: { gs_user_id: U } }) });
      if (!eigen.l) return nein('eigenes Konto abgewiesen: ' + eigen.r.status + ' ' + eigen.r.text);
      const err = await lauf(null, null, { 'accounts.create': () => { throw new Error('Your account cannot currently make live charges. acct_platform_123'); } });
      if (err.r.text.indexOf('acct_platform') >= 0) return nein('Rohtext: ' + err.r.text);
      return ok('fremd → green-scan.ch · Vorschau bleibt · fremdes Konto 403 · eigenes ok · Fehler ' + err.r.text);
    },
  },

  // ── Admin-Werkzeuge ──────────────────────────────────────────────────────
  {
    name: 'stripe-bootstrap / stripe-admin-extend-webhook · Geheimnis konstantzeitig ueber adminGeheimnisOk, falsches/leeres → 403 ohne Stripe',
    lauf: async (h) => {
      const rot = [];
      for (const fn of ['stripe-bootstrap', 'stripe-admin-extend-webhook']) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (!/adminGeheimnisOk\(/.test(src) || /!==\s*expectedSecret|expectedSecret\s*!==|===\s*expectedSecret/.test(src)) rot.push(fn + ': Vergleich nicht ueber adminGeheimnisOk');
        for (const [hdr, wert] of [['falsch', 'geheiM'], ['leer', ''], ['ohne', null]]) {
          const f = await lade(fn, { tabellen: { app_settings: [{ key: 'stripe_admin_secret', value: 'geheim' }] } });
          const r = await f.aufruf({ headers: wert === null ? {} : { 'X-Admin-Secret': wert } });
          if (r.status !== 403 || f.z.stripe.length) rot.push(fn + ' ' + hdr + ' → ' + r.status);
        }
        const leer = await lade(fn, { tabellen: { app_settings: [] } });
        const r = await leer.aufruf({ headers: { 'X-Admin-Secret': '' } });
        if (r.status !== 403) rot.push(fn + ': ohne gespeichertes Geheimnis ' + r.status);
      }
      // Geschwister derselben Ursache: jede Function, die ein X-Admin-Secret prueft, vergleicht konstantzeitig.
      for (const fn of h.functions()) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (/X-Admin-Secret/.test(src) && /(!==|===)\s*expectedSecret|expectedSecret\s*(!==|===)/.test(src)) rot.push(fn + ': X-Admin-Secret mit ===/!==');
      }
      return rot.length ? nein(rot.join(' · ')) : ok('beide: falsch/leer/ohne → 403, kein Stripe-Aufruf · kein X-Admin-Secret im Repo mehr mit ===/!==');
    },
  },

  // ── App ──────────────────────────────────────────────────────────────────
  {
    name: 'App · „Ausverkauft" liest das OBJEKT der RPC launch_offer_available; Kennungen der Functions werden zu Saetzen (#1, #15)',
    lauf: async (h) => {
      const src = require('fs').readFileSync(require('path').join(h.repo, 'index.html'), 'utf8');
      const fn = (kopf) => { const i = src.indexOf(kopf); if (i < 0) return null; let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
      // Seit der Schlusspruefung (i1 #1) ist gsCheckLaunchAvailable nur noch die boolean-Huelle
      // um gsLaunchStand (das Objekt, das die Abo-Ansicht fuer „bereits genutzt" liest) — der
      // Fall laedt deshalb BEIDE; ohne die zweite stirbt er an „gsLaunchStand is not defined".
      const stand = fn('async function gsLaunchStand(');
      const launch = fn('async function gsCheckLaunchAvailable(');
      if (!launch || !stand) return nein('gsCheckLaunchAvailable / gsLaunchStand nicht gefunden');
      const mach = (antwort) => new Function('sbFetch', stand + '\n' + launch + '\nreturn gsCheckLaunchAvailable;')(async () => antwort);
      const voll = await mach({ data: { available: false, logged_in: true, claimed: 100 } })();
      const frei = await mach({ data: { available: true, logged_in: true, claimed: 3 } })();
      if (voll !== false || frei !== true) return nein('RPC-Objekt: voll → ' + voll + ', frei → ' + frei);
      const tab = src.match(/var GS_ZAHLUNG_FEHLER = \{[\s\S]*?\n\};/);
      const zf = fn('function _gsZahlungFehler(');
      if (!tab || !zf) return nein('GS_ZAHLUNG_FEHLER / _gsZahlungFehler fehlen');
      const Z = new Function(tab[0] + '\n' + zf + '\nreturn _gsZahlungFehler;')();
      const roh = 'No such price: price_x; a similar object exists in live mode';
      if (Z(roh, 'Rueckfall') !== 'Rueckfall' || !/ausverkauft/.test(Z('launch_ausverkauft')) || Z('constructor') !== Z('nichts')) return nein('_gsZahlungFehler: ' + JSON.stringify([Z(roh, 'Rueckfall'), Z('launch_ausverkauft'), Z('constructor')]));
      const r = await R(h);
      const kennungen = ['unbekannter_preis', 'karte_abgelehnt', 'zu_viele_anfragen', 'zahlungsdienst_nicht_erreichbar'].concat(['ausverkauft', 'schon_beansprucht', 'nicht_pruefbar'].map(g => 'launch_' + g));
      const ohne = kennungen.filter(k => Z(k) === Z('gibt_es_nicht'));
      if (ohne.length) return nein('Kennung ohne Satz in der App: ' + ohne.join(', '));
      return ok('voll → false · frei → true · Rohtext → Rueckfall · ' + kennungen.length + ' Kennungen haben einen Satz');
    },
  },

  // ── entitlements ─────────────────────────────────────────────────────────
  {
    name: 'entitlements · CORS nur fuer eigene Urspruenge (nicht jede *.pages.dev), Fehlerantworten tragen den Ursprung (#16, Haertung)',
    lauf: async () => {
      const f = await lade('entitlements', { nutzer: NUTZER, tabellen: { v_user_entitlements: [{ user_id: U, tier: 'pro' }], ai_usage: [] } });
      const ac = (r) => r.headers.get('access-control-allow-origin');
      const fremd = await f.aufruf({ method: 'GET', headers: Object.assign(auth('tok_u'), { Origin: 'https://boese.pages.dev' }) });
      if (ac(fremd) === 'https://boese.pages.dev') return nein('fremde pages.dev-Seite bekommt ACAO');
      const eigen = await f.aufruf({ method: 'GET', headers: Object.assign(auth('tok_u'), { Origin: 'https://green-scan.ch' }) });
      if (ac(eigen) !== 'https://green-scan.ch') return nein('kanonische Domain ohne ACAO: ' + ac(eigen));
      const vorschau = await f.aufruf({ method: 'GET', headers: Object.assign(auth('tok_u'), { Origin: 'https://abc.greenscan-app.pages.dev' }) });
      if (ac(vorschau) !== 'https://abc.greenscan-app.pages.dev') return nein('Vorschau ohne ACAO');
      const fehl = await f.aufruf({ method: 'GET', headers: { Origin: 'https://green-scan.ch' } });
      if (fehl.status !== 401 || ac(fehl) !== 'https://green-scan.ch') return nein('401 ohne Ursprung: ' + ac(fehl));
      return ok('fremd → ' + ac(fremd) + ' · eigen/Vorschau gespiegelt · 401 traegt den Ursprung');
    },
  },
];

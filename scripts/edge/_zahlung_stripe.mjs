// Gestellte Stripe-Bibliothek fuer scripts/edge/10_stripe.js (v33.59).
// Jeder Aufruf landet im Protokoll globalThis.__gsZ.stripe; was Stripe
// antwortet (oder wirft), bestimmt das Szenario ueber __gsZ.stripeAntwort.
const Z = () => globalThis.__gsZ;

// v33.63 (P-C2): Stripe lehnt einen unbekannten Parameter mit 400 `parameter_unknown` ab. Die Attrappe
// tut es auch — sonst bleibt ein falscher Parameter (v8: automatic_payment_methods an Checkout) grün.
// Die Liste ist BEWUSST eine eigene Abschrift (stripe@17.7.0 types/Checkout/SessionsResource.d.ts,
// SessionCreateParams; gelesen von PR #329 am 11.11.2026), NICHT CHECKOUT_PARAMETER aus dem Modul:
// eine Attrappe, die die Liste des Prüflings liest, prüft den Prüfling gegen sich selbst.
const CHECKOUT_BEKANNT = new Set([
  'adaptive_pricing', 'after_expiration', 'allow_promotion_codes', 'automatic_tax', 'billing_address_collection',
  'cancel_url', 'client_reference_id', 'consent_collection', 'currency', 'custom_fields', 'custom_text', 'customer',
  'customer_creation', 'customer_email', 'customer_update', 'discounts', 'expand', 'expires_at', 'invoice_creation', 'line_items',
  'locale', 'metadata', 'mode', 'payment_intent_data', 'payment_method_collection', 'payment_method_configuration',
  'payment_method_data', 'payment_method_options', 'payment_method_types', 'phone_number_collection', 'redirect_on_completion', 'return_url',
  'saved_payment_method_options', 'setup_intent_data', 'shipping_address_collection', 'shipping_options', 'submit_type',
  'subscription_data', 'success_url', 'tax_id_collection', 'ui_mode',
]);
function checkoutPruefen(p) {
  for (const k of Object.keys(p || {})) {
    if (p[k] === undefined) continue;
    if (!CHECKOUT_BEKANNT.has(k)) {
      throw Object.assign(new Error('Received unknown parameter: ' + k), { type: 'StripeInvalidRequestError', code: 'parameter_unknown', param: k, statusCode: 400 });
    }
  }
}

function ruf(name, ...args) {
  const z = Z();
  z.stripe.push({ name, args });
  const f = z.stripeAntwort && z.stripeAntwort[name];
  if (f) return Promise.resolve().then(() => f(...args));
  const vorgabe = {
    'customers.create': () => ({ id: 'cus_neu' }),
    'customers.retrieve': (id) => ({ id, metadata: {} }),
    'customers.search': () => ({ data: [] }),
    'subscriptions.update': (id, p) => Object.assign({ id }, p),
    'checkout.sessions.create': (p) => ({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }),
    'checkout.sessions.listLineItems': () => ({ data: [] }),
    'billingPortal.sessions.create': () => ({ url: 'https://billing.stripe.com/p/session/1' }),
    'subscriptions.retrieve': (id) => { throw Object.assign(new Error('No such subscription: ' + id), { type: 'StripeInvalidRequestError' }); },
    'subscriptions.cancel': (id) => ({ id, status: 'canceled' }),
    'accounts.create': () => ({ id: 'acct_neu' }),
    'accounts.retrieve': (id) => ({ id, metadata: {} }),
    'accountLinks.create': () => ({ url: 'https://connect.stripe.com/setup/e/1' }),
  }[name];
  return Promise.resolve().then(() => vorgabe ? vorgabe(...args) : {});
}

export default class Stripe {
  constructor(key, opts) { this.key = key; this.opts = opts; }
  static createFetchHttpClient() { return {}; }
  customers = { create: (p) => ruf('customers.create', p), retrieve: (id) => ruf('customers.retrieve', id), search: (p) => ruf('customers.search', p) };
  checkout = { sessions: { create: (p) => Promise.resolve().then(() => checkoutPruefen(p)).then(() => ruf('checkout.sessions.create', p)), listLineItems: (id, p) => ruf('checkout.sessions.listLineItems', id, p) } };
  billingPortal = { sessions: { create: (p) => ruf('billingPortal.sessions.create', p) } };
  subscriptions = { retrieve: (id) => ruf('subscriptions.retrieve', id), cancel: (id, p) => ruf('subscriptions.cancel', id, p), update: (id, p) => ruf('subscriptions.update', id, p) };
  accounts = { create: (p) => ruf('accounts.create', p), retrieve: (id) => ruf('accounts.retrieve', id) };
  accountLinks = { create: (p) => ruf('accountLinks.create', p) };
  webhookEndpoints = { list: (p) => ruf('webhookEndpoints.list', p), update: (id, p) => ruf('webhookEndpoints.update', id, p) };
  prices = { list: (p) => ruf('prices.list', p), create: (p) => ruf('prices.create', p) };
  products = { list: (p) => ruf('products.list', p), create: (p) => ruf('products.create', p) };
  webhooks = {
    constructEventAsync: async (body, sig, secret) => {
      if (sig !== 'sig-gut' || !secret) throw new Error('No signatures found matching the expected signature for payload');
      return JSON.parse(body);
    },
  };
}

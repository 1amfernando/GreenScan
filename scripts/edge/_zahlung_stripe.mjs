// Gestellte Stripe-Bibliothek fuer scripts/edge/10_stripe.js (v33.59).
// Jeder Aufruf landet im Protokoll globalThis.__gsZ.stripe; was Stripe
// antwortet (oder wirft), bestimmt das Szenario ueber __gsZ.stripeAntwort.
const Z = () => globalThis.__gsZ;

function ruf(name, ...args) {
  const z = Z();
  z.stripe.push({ name, args });
  const f = z.stripeAntwort && z.stripeAntwort[name];
  if (f) return Promise.resolve().then(() => f(...args));
  const vorgabe = {
    'customers.create': () => ({ id: 'cus_neu' }),
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
  customers = { create: (p) => ruf('customers.create', p) };
  checkout = { sessions: { create: (p) => ruf('checkout.sessions.create', p), listLineItems: (id, p) => ruf('checkout.sessions.listLineItems', id, p) } };
  billingPortal = { sessions: { create: (p) => ruf('billingPortal.sessions.create', p) } };
  subscriptions = { retrieve: (id) => ruf('subscriptions.retrieve', id), cancel: (id, p) => ruf('subscriptions.cancel', id, p) };
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

// Gestellter supabase-js-Client fuer scripts/edge/10_stripe.js (v33.59).
//
// Eine kleine Tabellenablage im Arbeitsspeicher (globalThis.__gsZ.tabellen),
// gegen die die ECHTEN Abfragen der index.ts laufen: Filter eq/neq/in/is/like,
// maybeSingle/single, count/head, insert/upsert/update/delete. Eine Tabelle, die
// nicht in der Ablage steht, antwortet wie PostgREST mit 42P01.
//
// Treu zum Original in dem Punkt, der Fund #9 traegt: der Abfrage-Baustein ist
// PromiseLike — er hat `then`, aber KEIN `catch`. Ein `.catch(…)` daran wirft
// also TypeError, genau wie in supabase-js v2.
//
// v33.59 (Schlusspruefung d1 #1/#2): die Attrappe kennt das LIVE-Schema
// (_live_schema.mjs, Stand 10.11.2026). Eine Einbettung `tabelle(spalten)` ohne
// Fremdschluessel antwortet wie PostgREST mit PGRST200, eine unbekannte Spalte
// beim Lesen/Filtern mit 42703, beim Schreiben mit PGRST204 — vorher beantwortete
// sie JEDE Einbettung, und `stripe_products(tier)` war gruen, waehrend der Webhook
// live auf jedes Abo-Ereignis 500 antwortete. Und wie die Live-Trigger setzt ein
// UPDATE auf einer Tabelle aus UPDATED_AT_TRIGGER updated_at = now().
import { SPALTEN, BEZIEHUNGEN, UPDATED_AT_TRIGGER } from './_live_schema.mjs';
const Z = () => globalThis.__gsZ;
const beziehungen = () => BEZIEHUNGEN.concat((Z() && Z().beziehungen) || []);

function teile(s) {
  const o = []; let d = 0, c = '';
  for (const ch of String(s)) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { o.push(c); c = ''; } else c += ch; }
  o.push(c);
  return o.map(x => x.trim()).filter(Boolean);
}
const spalteBasis = (sp) => String(sp).split('->')[0].split('::')[0].trim();
function spalteFehlt(table, sp) {
  const liste = SPALTEN[table];
  const b = spalteBasis(sp);
  return !!liste && b !== '*' && !liste.includes(b);
}
// [art, fk-tabelle, fk-spalte, ziel, zielspalte] — von `von` nach `nach`, oder null.
function beziehung(von, nach) {
  for (const r of beziehungen()) {
    if (r[0] === von && r[2] === nach) return { art: 'eins', spalte: r[1], ziel: r[3] };
    if (r[2] === von && r[0] === nach) return { art: 'viele', spalte: r[3], ziel: r[1] };
  }
  return null;
}
// Liest eine select-Liste: { fehler } oder { einbettungen: [{alias, ziel, bez, sub}] }.
function selectLesen(table, spalten) {
  const einb = [];
  for (let it of teile(spalten == null ? '*' : spalten)) {
    let alias = null;
    const am = it.match(/^([A-Za-z_0-9]+):(?!:)(.*)$/s);
    if (am) { alias = am[1]; it = am[2].trim(); }
    const m = it.match(/^([a-z_0-9]+)(![a-z_0-9]+)?\s*\((.*)\)$/s);
    if (m) {
      const bez = beziehung(table, m[1]);
      if (!bez) return { fehler: { code: 'PGRST200', message: "Could not find a relationship between '" + table + "' and '" + m[1] + "' in the schema cache" } };
      const sub = selectLesen(m[1], m[3]);
      if (sub.fehler) return sub;
      einb.push({ alias: alias || m[1], ziel: m[1], bez, sub: sub.einbettungen, inner: m[2] === '!inner' });
      continue;
    }
    if (spalteFehlt(table, it)) return { fehler: { code: '42703', message: 'column ' + table + '.' + spalteBasis(it) + ' does not exist' } };
  }
  return { einbettungen: einb };
}
function einbetten(table, zeile, einb) {
  if (!einb.length) return zeile;
  const r = Object.assign({}, zeile);
  for (const e of einb) {
    const t = Z().tabellen[e.ziel] || [];
    if (e.bez.art === 'eins') { const z = t.find(x => x[e.bez.ziel] === zeile[e.bez.spalte]); r[e.alias] = z ? einbetten(e.ziel, z, e.sub) : null; }
    else r[e.alias] = t.filter(x => x[e.bez.ziel] === zeile[e.bez.spalte]).map(x => einbetten(e.ziel, x, e.sub));
  }
  return r;
}
function schreibFehler(table, werte) {
  for (const w of (Array.isArray(werte) ? werte : [werte])) for (const k of Object.keys(w || {}))
    if (spalteFehlt(table, k)) return { code: 'PGRST204', message: "Could not find the '" + k + "' column of '" + table + "' in the schema cache" };
  return null;
}
function trigger(table, zeile) {
  if (UPDATED_AT_TRIGGER.includes(table)) zeile.updated_at = new Date().toISOString();
}

function passt(zeile, f) {
  const [art, sp, w] = f;
  let v;
  if (sp.includes('->>')) { const [a, b] = sp.split('->>'); v = zeile[a] && zeile[a][b]; v = v === undefined ? null : String(v); }
  else v = zeile[sp];
  if (art === 'eq') return v === w || (v != null && w != null && String(v) === String(w));
  if (art === 'neq') return !(v === w || String(v) === String(w));
  if (art === 'in') return w.map(String).includes(String(v));
  if (art === 'is') return w === null ? v == null : v === w;
  if (art === 'like') { const re = new RegExp('^' + String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$'); return re.test(String(v)); }
  return true;
}

function ausfuehren(op) {
  const z = Z();
  z.ops.push(op);
  if (z.fehler && z.fehler[op.table]) return { data: null, error: z.fehler[op.table], count: null };
  // v33.59 (Brett fe36): ein Fehler nur fuer EINE Operationsart — 'tabelle:select|insert|upsert|update|delete'.
  if (z.fehler && z.fehler[op.table + ':' + op.art]) return { data: null, error: z.fehler[op.table + ':' + op.art], count: null };
  if (op.art === 'rpc') {
    const f = z.rpc && z.rpc[op.table];
    return f ? f(op.args) : { data: null, error: { code: 'PGRST202', message: 'function not found' } };
  }
  const t = z.tabellen[op.table];
  if (!t) return { data: null, error: { code: '42P01', message: 'relation "public.' + op.table + '" does not exist' }, count: null };
  for (const f of op.filter) if (spalteFehlt(op.table, f[1])) return { data: null, error: { code: '42703', message: 'column ' + op.table + '.' + spalteBasis(f[1]) + ' does not exist' }, count: null };
  if (op.art === 'insert' || op.art === 'upsert' || op.art === 'update') { const f = schreibFehler(op.table, op.werte); if (f) return { data: null, error: f, count: null }; }
  const treffer = t.filter(r => op.filter.every(f => passt(r, f)));
  if (op.art === 'select') {
    const sel = selectLesen(op.table, op.spalten);
    if (sel.fehler) return { data: null, error: sel.fehler, count: null };
    let rows = treffer.map(r => einbetten(op.table, r, sel.einbettungen));
    if (op.limit != null) rows = rows.slice(0, op.limit);
    if (op.head) return { data: null, error: null, count: treffer.length };
    if (op.einzeln) return { data: rows[0] || null, error: null, count: op.count ? treffer.length : null };
    return { data: rows, error: null, count: op.count ? treffer.length : null };
  }
  if (op.art === 'insert' || op.art === 'upsert') {
    const neu = Array.isArray(op.werte) ? op.werte : [op.werte];
    const k = (op.optionen && op.optionen.onConflict) ? String(op.optionen.onConflict).split(',') : (z.schluessel[op.table] || ['id']);
    const raus = [];
    for (const w of neu) {
      const alt = t.find(r => k.every(s => r[s] !== undefined && r[s] === w[s]));
      if (alt) {
        if (op.art === 'insert') return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
        if (op.optionen && op.optionen.ignoreDuplicates) continue;
        Object.assign(alt, w); trigger(op.table, alt); raus.push(alt);
      } else { const r = Object.assign({}, w); t.push(r); raus.push(r); }
    }
    return { data: op.zurueck ? raus : null, error: null };
  }
  if (op.art === 'update') {
    for (const r of treffer) { Object.assign(r, op.werte); trigger(op.table, r); }
    return { data: op.zurueck ? treffer : null, error: null, count: treffer.length };
  }
  if (op.art === 'delete') {
    z.tabellen[op.table] = t.filter(r => !treffer.includes(r));
    return { data: op.zurueck ? treffer : null, error: null, count: treffer.length };
  }
  return { data: null, error: { message: 'unbekannte Operation' } };
}

function baustein(table, art, args) {
  const op = { table, art: art || 'select', filter: [], args };
  const b = {
    select(spalten, o) { if (op.art === 'select') { op.spalten = spalten; if (o && o.count) op.count = true; if (o && o.head) op.head = true; } else op.zurueck = true; return b; },
    insert(w, o) { op.art = 'insert'; op.werte = w; op.optionen = o; return b; },
    upsert(w, o) { op.art = 'upsert'; op.werte = w; op.optionen = o; return b; },
    update(w) { op.art = 'update'; op.werte = w; return b; },
    delete(o) { op.art = 'delete'; if (o && o.count) op.count = true; return b; },
    eq(s, w) { op.filter.push(['eq', s, w]); return b; },
    neq(s, w) { op.filter.push(['neq', s, w]); return b; },
    in(s, w) { op.filter.push(['in', s, w]); return b; },
    is(s, w) { op.filter.push(['is', s, w]); return b; },
    like(s, w) { op.filter.push(['like', s, w]); return b; },
    order() { return b; },
    limit(n) { op.limit = n; return b; },
    maybeSingle() { op.einzeln = true; return b; },
    single() { op.einzeln = true; return b; },
    then(ok, nein) { let r; try { r = ausfuehren(op); } catch (e) { return Promise.reject(e).then(ok, nein); } return Promise.resolve(r).then(ok, nein); },
  };
  return b;
}

export function createClient(url, key, opts) {
  const hdr = (opts && opts.global && opts.global.headers) || {};
  const token = () => String(hdr.Authorization || hdr.authorization || ('Bearer ' + key)).replace(/^Bearer\s+/i, '');
  return {
    from: (t) => baustein(t),
    rpc: (name, args) => baustein(name, 'rpc', args),
    auth: {
      async getUser(jwt) {
        const t = jwt || token();
        const u = Z().nutzer[t];
        return u ? { data: { user: u }, error: null } : { data: { user: null }, error: { message: 'invalid JWT' } };
      },
      admin: { async deleteUser(uid) { Z().ops.push({ art: 'auth.deleteUser', uid }); return { error: null }; } },
    },
    storage: {
      from: (bucket) => ({
        async list(p) { Z().ops.push({ art: 'storage.list', bucket, p }); return { data: [], error: null }; },
        async remove(p) { Z().ops.push({ art: 'storage.remove', bucket, p }); return { data: [], error: null }; },
      }),
    },
  };
}

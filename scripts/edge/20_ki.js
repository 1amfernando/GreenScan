// KI-Functions: Kontingent und Plan serverseitig, Nutzerpruefung, Eingabegrenzen,
// ungepruefte KI-Zeilen (Sicherheitspruefung 10.11.2026, v33.59).
// Die Rechnung steht in supabase/functions/_shared/ki_tor.mjs und wird hier
// AUSGEFUEHRT (gut UND schlecht); der Rand (index.ts) wird am Quelltext ohne
// Kommentare geprueft — an der FORM des Aufrufs, nicht an einer Erwaehnung.
'use strict';

const KI_FNS = ['ai-proxy', 'plan-iterate', 'garden-scan-analyze', 'plant-doctor-diagnose', 'pest-identify', 'mushroom-identify'];
const TOR = '_shared/ki_tor.mjs';

// Attrappen in der Form von supabase-js: from(...).select(...).eq(...).maybeSingle() und rpc(...)
function userClient(antwort) {
  const q = { select() { return q; }, eq() { return q; }, maybeSingle: async () => { if (antwort === 'wirft') throw new Error('netz'); return antwort; } };
  return { from: () => q };
}
function adminClient(rpcAntwort, protokoll) {
  return { rpc: async (name, args) => { protokoll.push({ name, args }); if (typeof rpcAntwort === 'function') return rpcAntwort(name, args); if (rpcAntwort === 'wirft') throw new Error('netz'); return rpcAntwort; } };
}

function vor(src, a, b) { const i = src.indexOf(a), j = src.indexOf(b); return i >= 0 && j >= 0 && i < j; }

module.exports = [
  {
    name: 'Eingabe · jede KI-Function hat Deckel — eine gute Eingabe geht durch, eine zu grosse (Bild, Text, Bildzahl, Typ) wird mit Grund abgewiesen',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const B = (n) => 'A'.repeat(n);
      const gut = {
        'plan-iterate': { bytes: 30000, texte: { user_message: 'Bitte keinen Bambus, lieber Schnittlauch 🌿 — „Grüne Bohne"', ai_analysis: { plants: [{ name: "Tomate d'Or" }] } } },
        'garden-scan-analyze': { bytes: 3e6, bilder: [B(1e6), B(1e6), B(5e5)], texte: { metadata: { region_slug: 'mittelland' }, constraints: {}, plan_title: 'Mein Garten' } },
        'plant-doctor-diagnose': { bytes: 2e6, bilder: [B(2e6)], texte: { user_note: 'Blätter gelb', species_name: 'Tomate', species_lat: 'Solanum lycopersicum', plant_local_id: 'p1', symptoms: ['gelb'] } },
        'pest-identify': { bytes: 2e6, bilder: [B(2e6)], typen: ['image/jpeg'], texte: { host_plant: 'Rose' } },
        'mushroom-identify': { bytes: 2e6, bilder: [B(2e6)], typen: ['image/jpeg'], texte: { habitat_hint: 'Buchenwald', region_slug: 'ZH' } },
      };
      const schlecht = [
        ['plan-iterate', { texte: { user_message: B(50000) } }, 413],
        ['plan-iterate', { texte: { ai_analysis: { x: B(400000) } } }, 413],
        ['plan-iterate', { bytes: 5e6 }, 413],
        ['garden-scan-analyze', { bilder: [B(10), B(10), B(10), B(10)] }, 413],
        ['garden-scan-analyze', { bilder: [B(9 * 1024 * 1024)] }, 413],
        ['garden-scan-analyze', { texte: { metadata: { a: B(20000) } } }, 413],
        ['plant-doctor-diagnose', { texte: { user_note: B(100000) } }, 413],
        ['plant-doctor-diagnose', { bilder: [B(10), B(10)] }, 413],
        ['pest-identify', { typen: ['text/html'] }, 415],
        ['mushroom-identify', { texte: { habitat_hint: B(5000) } }, 413],
        ['mushroom-identify', { texte: { erfunden: 'x' } }, 500],
      ];
      for (const fn of Object.keys(gut)) { const r = m.kiEingabeOk(fn, gut[fn]); if (!r.ok) return { ok: false, warum: 'gute Eingabe abgewiesen: ' + fn + ' → ' + r.grund }; }
      for (const [fn, e, st] of schlecht) { const r = m.kiEingabeOk(fn, e); if (r.ok || r.status !== st) return { ok: false, warum: fn + ' liess durch / falscher Status: ' + JSON.stringify(r) + ' fuer ' + JSON.stringify(Object.keys(e)) }; }
      if (m.kiMaxTokens('ai-proxy', 99999) !== 4096 || m.kiMaxTokens('ai-proxy', 300) !== 300 || m.kiMaxTokens('plan-iterate', undefined) !== 8000) return { ok: false, warum: 'kiMaxTokens klemmt falsch' };
      return { ok: true, info: '5 gute Eingaben durch · ' + schlecht.length + ' schlechte mit Status abgewiesen · max_tokens geklemmt' };
    },
  },
  {
    name: 'ai-proxy · Eingabe · ein Scan-Rumpf geht durch; 7 Bilder, ein Bild per URL, 300 Nachrichten und 1 MB System-Text werden abgewiesen',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const bild = (n) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'A'.repeat(n) } });
      const gut = { messages: [{ role: 'user', content: [bild(8e5), bild(8e5), { type: 'text', text: 'Was ist das?' }] }], system: [{ type: 'text', text: 'Du bist Lina 🌿' }] };
      const r0 = m.kiProxyEingabe(gut, 2e6);
      if (!r0.ok || r0.eingabe.bilder.length !== 2) return { ok: false, warum: 'guter Rumpf: ' + JSON.stringify(r0.grund || r0.eingabe.bilder.length) };
      const faelle = [
        [{ messages: [{ role: 'user', content: Array.from({ length: 7 }, () => bild(10)) }] }, 413, '7 Bilder'],
        [{ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://example.invalid/x.jpg' } }] }] }, 400, 'Bild per URL'],
        [{ messages: Array.from({ length: 300 }, () => ({ role: 'user', content: 'x' })) }, 413, '300 Nachrichten'],
        [{ messages: [{ role: 'user', content: 'x' }], system: 'S'.repeat(1e6) }, 413, '1 MB System'],
        [{ messages: [{ role: 'user', content: [{ type: 'tool_result', content: [bild(9 * 1024 * 1024)] }] }] }, 413, 'Riesenbild in tool_result'],
      ];
      for (const [b, st, was] of faelle) { const r = m.kiProxyEingabe(b, 1000); if (r.ok || r.status !== st) return { ok: false, warum: was + ' → ' + JSON.stringify({ ok: r.ok, status: r.status }) }; }
      if (m.kiProxyEingabe(gut, 50 * 1024 * 1024).ok) return { ok: false, warum: '50 MB Rumpf durch' };
      return { ok: true, info: 'Scan mit 2 Bildern durch · 5 feindliche Ruempfe + 50 MB abgewiesen' };
    },
  },
  {
    name: 'Tor · Plan vom Server, gesperrtes Konto abgewiesen, reserviert wird mit dem Limit des Plans — und jedes technische Scheitern ist NEIN (fail-closed)',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const U = '11111111-1111-4111-8111-111111111111';
      const lauf = async (fn, ent, rpc) => { const p = []; const r = await m.kiTor({ fn, userClient: userClient(ent), admin: adminClient(rpc, p), userId: U }); return { r, p }; };
      const ok = { data: true, error: null };
      let x = await lauf('ai-proxy', { data: { tier: 'free', role: 'user' }, error: null }, ok);
      if (!x.r.erlaubt || x.p.length !== 1 || x.p[0].name !== 'fn_ai_kontingent_reservieren' || x.p[0].args.p_user !== U || x.p[0].args.p_function !== 'ai-proxy' || x.p[0].args.p_limit !== 15) return { ok: false, warum: 'free: ' + JSON.stringify(x) };
      x = await lauf('ai-proxy', { data: { tier: 'basic', role: 'user' }, error: null }, ok);
      if (x.p[0].args.p_limit !== 100) return { ok: false, warum: 'basic faellt auf ' + x.p[0].args.p_limit };
      x = await lauf('garden-scan-analyze', { data: { tier: 'pro', role: 'user' }, error: null }, ok);
      if (x.p[0].args.p_limit !== 480) return { ok: false, warum: 'pro garden-scan: ' + x.p[0].args.p_limit }; // v33.59: Bremse = alte 20/h × 24
      x = await lauf('plan-iterate', { data: null, error: null }, ok);
      if (!x.r.erlaubt || x.p[0].args.p_limit !== 10) return { ok: false, warum: 'ohne Zeile nicht free: ' + JSON.stringify(x) };
      const nein = [
        ['gesperrt', { data: { tier: 'pro', role: 'banned' }, error: null }, ok, 403, 0],
        ['Plan unlesbar', { data: null, error: { message: 'relation does not exist' } }, ok, 503, 0],
        ['Plan-Abfrage wirft', 'wirft', ok, 503, 0],
        ['RPC fehlt (404)', { data: { tier: 'free' }, error: null }, { data: null, error: { message: 'Could not find the function', code: 'PGRST202' } }, 503, 1],
        ['RPC wirft', { data: { tier: 'free' }, error: null }, 'wirft', 503, 1],
        ['Limit erreicht', { data: { tier: 'free' }, error: null }, { data: false, error: null }, 429, 1],
        ['RPC liefert null', { data: { tier: 'free' }, error: null }, { data: null, error: null }, 429, 1],
      ];
      for (const [was, ent, rpc, st, rufe] of nein) {
        const y = await lauf('mushroom-identify', ent, rpc);
        if (y.r.erlaubt || y.r.status !== st || y.p.length !== rufe) return { ok: false, warum: was + ' → ' + JSON.stringify({ erlaubt: y.r.erlaubt, status: y.r.status, rpc: y.p.length }) };
      }
      return { ok: true, info: 'free 15 · basic 100 · pro/garden 480 · ohne Zeile free · gesperrt 403 ohne Reservierung · 4× technisch 503 · Limit 429' };
    },
  },
  {
    name: 'Tor · 20 gleichzeitige Anfragen bei Limit 15 → genau 15 erlaubt, wenn der Server atomar zaehlt (die Rechnung liest SEINE Antwort, kein eigener Zaehler)',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      let n = 0;
      const rpc = async () => { await new Promise(r => setTimeout(r, Math.random() * 5)); if (n < 15) { n++; return { data: true, error: null }; } return { data: false, error: null }; };
      const p = [];
      const rs = await Promise.all(Array.from({ length: 20 }, () => m.kiTor({ fn: 'ai-proxy', userClient: userClient({ data: { tier: 'free' }, error: null }), admin: adminClient(rpc, p), userId: 'u' })));
      const ja = rs.filter(r => r.erlaubt).length, nein429 = rs.filter(r => r.status === 429).length;
      if (ja !== 15 || nein429 !== 5) return { ok: false, warum: 'erlaubt ' + ja + ' · 429 ' + nein429 };
      return { ok: true, info: '15 erlaubt · 5× 429 (die SQL-Haelfte misst rls_check 50_ki_kontingent)' };
    },
  },
  {
    name: 'Fehler · nach aussen feste Saetze mit Kennung — der Rohtext des Anbieters, der Datenbank oder einer Ausnahme kommt nie an',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const roh = '{"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 250000 tokens > 200000 maximum; org_id=org-geheim"}}';
      const faelle = [[{ status: 400, text: roh }, 'upstream'], [429, 'upstream_limit'], [{ name: 'TimeoutError', message: 'signal timed out' }, 'timeout'], [new SyntaxError('Unexpected token < in JSON'), 'parse'], [new Error('duplicate key value violates unique constraint "x_pkey"'), 'intern'], ['quota_exceeded', 'quota_exceeded'], [{ code: 'gesperrt' }, 'gesperrt']];
      for (const [e, code] of faelle) {
        const r = m.kiFehlerCode(e);
        if (r.code !== code || !r.message || /org-geheim|token|constraint|Unexpected|signal/.test(r.message)) return { ok: false, warum: JSON.stringify(e).slice(0, 60) + ' → ' + JSON.stringify(r) };
      }
      return { ok: true, info: faelle.length + ' Fehlerformen → feste Saetze, kein Rohtext' };
    },
  },
  {
    name: 'Rand · jede KI-Function prueft den Nutzer MIT Token, deckelt die Eingabe und ruft das Tor VOR api.anthropic.com — ohne alten Zaehler-vor-Aufruf und ohne Buchung danach',
    lauf: async (h) => {
      const fehler = [];
      for (const fn of KI_FNS) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (!/from\s+["']\.\.\/_shared\/ki_tor\.mjs["']/.test(src)) { fehler.push(fn + ': importiert ki_tor.mjs nicht'); continue; }
        // Der KI-Aufruf: das fetch an api.anthropic.com — steht es in einer Hilfsfunktion
        // VOR Deno.serve, zaehlt die Stelle, an der diese Funktion gerufen wird.
        let anth = src.indexOf('api.anthropic.com');
        const serve = src.indexOf('Deno.serve');
        if (anth >= 0 && serve > anth) {
          const kopfe = Array.from(src.slice(0, anth).matchAll(/async\s+function\s+(\w+)\s*\(/g));
          const name = kopfe.length ? kopfe[kopfe.length - 1][1] : null;
          anth = name ? src.indexOf('await ' + name + '(', serve) : -1;
        }
        const tor = src.search(/await\s+kiTor\s*\(\s*\{/);
        const ein = src.search(/kiEingabeOk\s*\(\s*(["']|KI_FN\b)|kiProxyEingabe\s*\(/);
        if (anth < 0) fehler.push(fn + ': kein Aufruf an api.anthropic.com gefunden');
        if (tor < 0 || tor > anth) fehler.push(fn + ': kiTor fehlt oder steht NACH dem KI-Aufruf');
        if (ein < 0 || ein > tor) fehler.push(fn + ': Eingabe-Deckel fehlt oder steht nach der Reservierung');
        if (!new RegExp('fn\\s*:\\s*["\']' + fn + '["\']').test(src) && !new RegExp('KI_FN\\s*=\\s*["\']' + fn + '["\']').test(src)) fehler.push(fn + ': ruft das Tor nicht unter dem eigenen Namen');
        if (/\.auth\.getUser\(\s*\)/.test(src)) fehler.push(fn + ': auth.getUser() ohne Token');
        if (!/\.auth\.getUser\(\s*\w+/.test(src)) fehler.push(fn + ': keine Nutzerpruefung mit Token');
        if (/if\s*\(\s*!?\s*\w*\s*\.\s*erlaubt\s*\)/.test(src) === false) fehler.push(fn + ': das Urteil (.erlaubt) wird nicht gelesen');
        if (/count:\s*["']exact["']/.test(src.slice(0, Math.max(anth, 0)))) fehler.push(fn + ': zaehlt noch selbst vor dem Aufruf');
        if (/\.then\(\s*\(\)\s*=>\s*\{\s*\}\s*,\s*\(\)\s*=>\s*\{\s*\}\s*\)/.test(src)) fehler.push(fn + ': Buchung fire-and-forget');
      }
      const proxy = h.ohneKommentare(h.lies('ai-proxy/index.ts'));
      if (!/body\s*:\s*JSON\.stringify\(\s*\{\s*model\s*,\s*max_tokens\s*:\s*maxTokens\s*,\s*system\s*,\s*messages\s*\}\s*\)/.test(proxy)) fehler.push('ai-proxy: Form des Anfrage-Rumpfs an Anthropic veraendert');
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: KI_FNS.length + ' Functions: Token-Pruefung · Deckel vor Tor · Tor vor Anthropic · Urteil gelesen' };
    },
  },
  {
    name: 'Rand · kein Rohtext nach aussen (Anbieter-Rumpf, raw_preview, detail, e.message) und keine KI-Ausgabe in einem PostgREST-Filter',
    lauf: async (h) => {
      const fehler = [];
      for (const fn of KI_FNS.concat(['knowledge-bulk-gen', 'feedback-triage'])) {
        // Zeilen, die nur ins Protokoll schreiben (console.error), gehen nicht nach aussen.
        const src = h.ohneKommentare(h.lies(fn + '/index.ts')).split('\n').filter(z => !/console\.(error|warn|log)\(/.test(z)).join('\n');
        const muster = [
          [/raw_preview/, 'raw_preview'], [/\bdetail\s*:(?!\s*\{)/, 'detail:'], [/(errBody|errText|txt)\.slice\(/, 'Rohtext des Anbieters'],
          [/await\s+\w+\.text\(\)\s*\)/, 'Antwort-Rumpf in einer Meldung'], [/String\(\s*\(?\s*e\b[^)]*\)\s*\.?\s*(message)?/, 'String(e…)'],
          [/["'`][^"'`]*["'`]\s*\+\s*\(?\s*e\s*(as\s+\w+\s*)?\)?\s*\.message/, '"…" + e.message'], [/\bupdateErr\.message|insertErr\.message|error\.message\b(?![^\n]*console)/, 'DB-Fehlertext'],
          [/\.or\(\s*`[^`]*\$\{/, '.or(`…${…}`)'],
        ];
        for (const [re, was] of muster) if (re.test(src)) fehler.push(fn + ': ' + was + ' → ' + (src.match(re) || [''])[0].slice(0, 60));
      }
      const pilz = h.ohneKommentare(h.lies('mushroom-identify/index.ts'));
      if (!/kiSlugAusListe\s*\(/.test(pilz)) fehler.push('mushroom-identify: matched_slug nicht gegen die geladene Liste geprueft');
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: '8 Functions ohne Rohtext nach aussen · Pilz-Slug nur aus der Liste, kein .or mit KI-Wert' };
    },
  },
  {
    name: 'Pilz-Slug · ein Slug aus der KI zaehlt nur, wenn er in der geladenen Liste steht — ein Filter-Ausbruch („x,slug.neq.y") faellt weg',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const liste = [{ slug: 'steinpilz' }, { slug: 'gruener-knollenblaetterpilz' }];
      if (m.kiSlugAusListe('steinpilz', liste) !== 'steinpilz') return { ok: false, warum: 'guter Slug verworfen' };
      for (const s of ['steinpilz,lookalike_slug.neq.x', 'x)', '', null, 42, 'fliegenpilz']) if (m.kiSlugAusListe(s, liste) !== null) return { ok: false, warum: 'durch: ' + JSON.stringify(s) };
      return { ok: true, info: '1 guter Slug · 6 feindliche/unbekannte verworfen' };
    },
  },
  {
    name: 'knowledge-bulk-gen · die ECHTEN Schemata ergeben eine Erlaubnisliste; eine KI-Zeile setzt weder fremde Spalten noch Essbarkeit/Dosis noch die Quelle',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const src = h.lies('knowledge-bulk-gen/index.ts');
      // die Schemata aus dem Quelltext: <name>: { table: "<t>", uniqKey|compositeUniq …, system: `…` }
      const re = /^\s*(\w+):\s*\{\s*table:\s*"(\w+)",\s*(?:uniqKey:\s*"(\w+)"|compositeUniq:\s*\[([^\]]*)\]),\s*system:\s*`([^`]*)`/gm;
      const schemas = []; let mm;
      while ((mm = re.exec(src))) schemas.push({ topic: mm[1], table: mm[2], uniq: mm[3] ? [mm[3]] : mm[4].replace(/["\s]/g, '').split(','), system: mm[5] });
      if (schemas.length < 30) return { ok: false, warum: 'nur ' + schemas.length + ' Schemata gelesen' };
      for (const s of schemas) {
        const sp = m.kiSchemaSpalten(s.system);
        if (!sp || s.uniq.some(u => !sp[u])) return { ok: false, warum: 'Schema ' + s.topic + ' nicht gelesen: ' + JSON.stringify(sp && Object.keys(sp).slice(0, 5)) };
      }
      const pilz = schemas.find(s => s.table === 'mushroom_register');
      const sp = m.kiSchemaSpalten(pilz.system);
      if (!sp.edibility || sp.edibility.art !== 'enum' || sp.cap_color.art !== 'liste' || sp.season_months && sp.season_months.von !== 'int') return { ok: false, warum: 'Formen falsch: ' + JSON.stringify({ e: sp.edibility, c: sp.cap_color, s: sp.season_months }) };
      const boese = { slug: 'neu-pilz', common_name_de: "Grüner Täubling's Bruder", scientific_name: 'Russula x', edibility: 'speisepilz', vapko_klasse: '1', id: '00000000-0000-0000-0000-000000000000', created_at: '1970-01-01', source: 'VAPKO Schweiz (geprueft)', geprueft: true, fremde_spalte: 'x', cap_color: 'gruen', habitat: ['Buchenwald'], smell: 'mild' };
      const r = m.kiZeileOk('mushroom_register', boese, sp, ['slug']);
      if (!r.ok) return { ok: false, warum: 'Zeile verworfen: ' + r.grund };
      const z = r.zeile;
      if (z.edibility !== 'unbekannt' || z.vapko_klasse !== null) return { ok: false, warum: 'Sicherheitsangabe von der KI: ' + JSON.stringify({ e: z.edibility, v: z.vapko_klasse }) };
      for (const k of ['id', 'created_at', 'source', 'geprueft', 'fremde_spalte', 'cap_color']) if (k in z) return { ok: false, warum: 'Spalte durchgekommen: ' + k };
      if (z.common_name_de !== "Grüner Täubling's Bruder" || z.habitat[0] !== 'Buchenwald' || z.smell !== 'mild') return { ok: false, warum: 'gute Werte verloren: ' + JSON.stringify(z) };
      const ohne = m.kiZeileOk('mushroom_register', { common_name_de: 'x' }, sp, ['slug']);
      if (ohne.ok) return { ok: false, warum: 'Zeile ohne Pflichtspalte angenommen' };
      const heil = schemas.find(s => s.table === 'remedies');
      const rr = m.kiZeileOk('remedies', { slug: 'tee', title: 'Tee', dosage: '3x taeglich 20 g', is_published: true }, m.kiSchemaSpalten(heil.system), ['slug']);
      if (!rr.ok || rr.zeile.dosage !== null || rr.zeile.is_published !== false) return { ok: false, warum: 'remedies: ' + JSON.stringify(rr.zeile) };
      // Rand: die Function nimmt die gesaeuberte Zeile, nie die rohe
      const rand = h.ohneKommentare(src);
      if (!/kiZeileOk\s*\(/.test(rand) || /\.insert\(\s*row\s*\)/.test(rand)) return { ok: false, warum: 'knowledge-bulk-gen fuegt die rohe Modellzeile ein' };
      if (!/constantTimeEquals\s*\(/.test(rand) || /!==\s*expectedSecret/.test(rand)) return { ok: false, warum: 'Admin-Secret nicht zeitkonstant verglichen' };
      if (/\{\s*topic\s*,\s*count\s*=\s*12\s*,\s*focus_topics\s*,\s*model\s*=/.test(rand) && !/KB_MODELLE/.test(rand)) return { ok: false, warum: 'model frei waehlbar' };
      return { ok: true, info: schemas.length + ' echte Schemata gelesen · Essbarkeit→unbekannt, VAPKO→null, Dosis→null, unveroeffentlicht · id/source/fremde Spalte/falsche Form weg · gute Werte bleiben' };
    },
  },
  {
    name: 'Pilz-Scanner · ungepruefte Essbarkeit verlangt die VAPKO-Kontrolle, die Wissensbasis ist geordnet',
    lauf: async (h) => {
      const src = h.ohneKommentare(h.lies('mushroom-identify/index.ts'));
      if (!/\.order\(\s*["']slug["']/.test(src)) return { ok: false, warum: 'mushroom_register ohne Reihenfolge geladen' };
      if (!/unbekannt/.test(src.slice(src.indexOf('vapkoRequired')))) return { ok: false, warum: 'edibility unbekannt erzwingt keine VAPKO-Kontrolle' };
      return { ok: true, info: 'order(slug) · unbekannt → vapko_required' };
    },
  },
  {
    name: 'feedback-triage · Text je Eintrag und gesamt gedeckelt; eine vom Modell genannte id gilt nur, wenn sie im Stapel war',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', FREMD = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
      const items = [{ id: A, kind: 'bug', content: 'X'.repeat(100000) + 'ENDE', app_version: 'v33' }, { id: B, kind: 'idee', content: 'Bitte Dunkelmodus 🌙 — „schön"', app_version: null }];
      const p = m.kiFeedbackPrompt(items);
      if (p.length > m.FEEDBACK_GESAMT_MAX + 1000 || /ENDE/.test(p) || !/Dunkelmodus 🌙/.test(p)) return { ok: false, warum: 'Prompt: Laenge ' + p.length };
      const viele = Array.from({ length: 50 }, (_, i) => ({ id: A, kind: 'x', content: 'Y'.repeat(5000) }));
      if (m.kiFeedbackPrompt(viele).length > m.FEEDBACK_GESAMT_MAX + 50 * 200) return { ok: false, warum: 'gesamt nicht gedeckelt' };
      const z = m.kiFeedbackZeilen([{ id: A, priority: 9, sentiment: 'boese', summary: 'S'.repeat(1000), actionable: 'ja' }, { id: FREMD, priority: 1 }, { id: 'x"),or(', priority: 1 }, { id: B, priority: 3, sentiment: 'positive', implementation_effort: 'low', value_score: 0.7, summary: 'Dunkelmodus', actionable: true }], [A, B], 'm', 't');
      if (z.length !== 2 || z.some(r => r.feedback_id === FREMD)) return { ok: false, warum: 'fremde id angenommen: ' + JSON.stringify(z.map(r => r.feedback_id)) };
      if (z[0].priority !== 5 || z[0].sentiment !== null || z[0].summary.length > 161 || z[0].actionable !== false) return { ok: false, warum: 'Felder nicht geprueft: ' + JSON.stringify(z[0]).slice(0, 200) };
      if (z[1].sentiment !== 'positive' || z[1].priority !== 3 || z[1].value_score !== 0.7 || !z[1].actionable) return { ok: false, warum: 'gute Zeile veraendert: ' + JSON.stringify(z[1]) };
      const rand = h.ohneKommentare(h.lies('feedback-triage/index.ts'));
      if (!/kiFeedbackPrompt\s*\(/.test(rand) || !/kiFeedbackZeilen\s*\(/.test(rand) || /items\.map\(\s*it\s*=>\s*`ID:/.test(rand)) return { ok: false, warum: 'feedback-triage nimmt die Rechnung nicht' };
      return { ok: true, info: '100k-Text auf 2000 · gesamt gedeckelt · fremde und kaputte id verworfen · Felder geklemmt · gute Zeile unveraendert' };
    },
  },
  {
    name: 'Freigabe · zurueck nur, wenn der Anbieter NICHT gerechnet hat — ai-proxy bei JEDER Ablehnung (der Client probiert bei 404 das naechste Modell), Pflanzen-Doktor nie nach einer Antwort (ein kaputtes JSON laesst sich ueber die Notiz erzwingen)',
    lauf: async (h) => {
      const fehler = [];
      const proxy = h.ohneKommentare(h.lies('ai-proxy/index.ts'));
      const ab = proxy.indexOf('if (upstream.ok)');
      const zweig = ab >= 0 ? proxy.slice(ab, proxy.indexOf('return new Response(upstreamText', ab)) : '';
      if (!/\}\s*else\s*\{\s*(if\s*\(\s*kiFreigabeNoetig\s*\(\s*upstream\s*\)\s*\)\s*)?await\s+kiFreigeben\s*\(/.test(zweig)) fehler.push('ai-proxy: eine Ablehnung des Anbieters (z.B. 404 Modell) behaelt die Reservierung — ' + (zweig.match(/else[^{]*\{/) || ['?'])[0]);
      const doc = h.ohneKommentare(h.lies('plant-doctor-diagnose/index.ts'));
      const i = doc.indexOf('async function callClaudeVision'), k = doc.indexOf('Deno.serve');
      const nachAntwort = i >= 0 && k > i ? doc.slice(doc.indexOf('if (!r.ok)', i), k) : '';
      // jedes JSON.parse / r.json() nach der Antwort steht in einem try, das „parse" wirft
      const roh = (nachAntwort.match(/[^\n]*(JSON\.parse\(|\br\.json\(\))[^\n]*/g) || []).filter(z => !/try\s*\{[^\n]*code:\s*"parse"/.test(z));
      if (!nachAntwort || roh.length) fehler.push('plant-doctor-diagnose: Parsen nach der Antwort ohne parse-Kennung (eine SyntaxError gibt das Kontingent zurueck): ' + roh.map(z => z.trim().slice(0, 50)).join(' | '));
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: 'ai-proxy gibt jede Ablehnung zurueck · Doktor: Parsen nach der Antwort ist „parse" (keine Rueckgabe)' };
    },
  },
  // ── v33.59 Schlusspruefung d2: zahlende Kunden bekommen nicht weniger als zugesagt ──
  {
    name: 'Grenzen · ein BEZAHLTER Plan bekommt nie weniger als bisher (Stundenbremse × 24, ai-proxy-Tagesgrenze); free/basic bleiben, wie entworfen',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      // Stand 44bb824: Stundenbremsen (fn_check_rate_limit) bzw. TIER_LIMITS des ai-proxy.
      // plan-iterate hatte KEINE Bremse (nur MAX_ITERATIONS je Plan, vom Client schreibbar) — Anker
      // ist die Schwester garden-scan-analyze (20/h).
      const ALT_STUNDE = { 'garden-scan-analyze': 20, 'plant-doctor-diagnose': 30, 'pest-identify': 30, 'mushroom-identify': 30, 'plan-iterate': 20 };
      const ALT_PROXY = { plus: 200, pro: 2000, lifetime: 2000 };
      const BEZAHLT = ['plus', 'premium', 'pro', 'lifetime'];
      const zuWenig = [];
      for (const fn of Object.keys(ALT_STUNDE)) for (const p of BEZAHLT) { const n = m.kiLimit(fn, p, false); if (n < ALT_STUNDE[fn] * 24) zuWenig.push(fn + '/' + p + '=' + n + ' < ' + ALT_STUNDE[fn] * 24); }
      for (const p of Object.keys(ALT_PROXY)) { const n = m.kiLimit('ai-proxy', p, false); if (n < ALT_PROXY[p]) zuWenig.push('ai-proxy/' + p + '=' + n + ' < ' + ALT_PROXY[p]); }
      if (zuWenig.length) return { ok: false, warum: 'weniger als bisher: ' + zuWenig.join(' · ') };
      // Gegenrichtung: die Bremse fuer free/basic ist die entworfene, nicht weggefallen.
      const frei = { 'ai-proxy': [15, 100], 'garden-scan-analyze': [3, 5], 'plant-doctor-diagnose': [5, 15], 'pest-identify': [20, 40], 'mushroom-identify': [20, 40], 'plan-iterate': [10, 20] };
      for (const fn of Object.keys(frei)) if (m.kiLimit(fn, 'free') !== frei[fn][0] || m.kiLimit(fn, 'basic') !== frei[fn][1] || m.kiLimit(fn, 'unbekannt') !== frei[fn][0]) return { ok: false, warum: fn + ' free/basic/unbekannt: ' + [m.kiLimit(fn, 'free'), m.kiLimit(fn, 'basic'), m.kiLimit(fn, 'unbekannt')].join('/') };
      return { ok: true, info: '5 Functions × 4 bezahlte Plaene ≥ Stunde×24 · ai-proxy ≥ alt · free/basic unveraendert' };
    },
  },
  {
    name: 'Grenzen · der Satz am Limit sagt einem BEZAHLTEN Plan nicht „mit einem Abo mehr" — und jede KI-Function gibt dem Satz den Plan',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const satz = (plan) => m.kiFehlerCode({ code: 'quota_exceeded', plan }).message;
      for (const p of ['plus', 'premium', 'pro', 'lifetime', 'PRO']) if (/Abo|Upgrade/i.test(satz(p))) return { ok: false, warum: p + ': ' + satz(p) };
      for (const p of ['free', 'basic', undefined]) if (!/Abo/.test(satz(p))) return { ok: false, warum: 'Gegenrichtung ' + p + ': ' + satz(p) };
      if (m.kiFehlerCode('quota_exceeded').code !== 'quota_exceeded' || m.kiFehlerCode({ code: 'quota_exceeded', plan: 'pro' }).code !== 'quota_exceeded') return { ok: false, warum: 'Kennung veraendert (der Client liest quota_exceeded)' };
      const fehler = [];
      for (const fn of KI_FNS) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (!/kiFehlerCode\(\s*\{\s*code\b[^}]*\bplan\b/.test(src)) fehler.push(fn + ': Satz ohne Plan');
        // und der Zweig am Tor reicht tor.plan wirklich durch (ein Helfer mit Plan-Parameter allein misst nichts)
        const t0 = src.indexOf('!tor.erlaubt'), r0 = t0 >= 0 ? src.indexOf('return', t0) : -1;
        const torZweig = r0 >= 0 ? src.slice(t0, src.indexOf(';', r0) + 1) : '';
        if (!/tor\.plan\b/.test(torZweig)) fehler.push(fn + ': Tor-Zweig ohne tor.plan — ' + torZweig.replace(/\s+/g, ' ').slice(0, 80));
        if (/Upgrade f(ü|ue)r mehr/.test(src)) fehler.push(fn + ': eigener „Upgrade"-Satz');
      }
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: 'bezahlt ohne Abo-Satz · free/basic mit · 6 Functions reichen den Plan durch' };
    },
  },
  {
    name: 'Freigabe · EINE Regel fuer alle sechs: jede Ablehnung des Anbieters (auch 400/401/413) gibt zurueck; Antwort verarbeitet, Timeout und parse behalten',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      if (typeof m.kiFreigabeNoetig !== 'function') return { ok: false, warum: 'kiFreigabeNoetig fehlt im Modul — jede Function rechnet selbst' };
      const ja = [{ ok: false, status: 400 }, { ok: false, status: 401 }, { ok: false, status: 404 }, { ok: false, status: 413 }, { ok: false, status: 429 }, { ok: false, status: 529 }, { code: 'upstream', status: 400 }, new TypeError('fetch failed'), undefined];
      const nein = [{ ok: true, status: 200 }, { name: 'TimeoutError', message: 't' }, { name: 'AbortError' }, { code: 'parse' }, new SyntaxError('x'), { code: 'timeout' }];
      for (const x of ja) if (m.kiFreigabeNoetig(x) !== true) return { ok: false, warum: 'behaelt: ' + JSON.stringify(x) };
      for (const x of nein) if (m.kiFreigabeNoetig(x) !== false) return { ok: false, warum: 'gibt zurueck: ' + JSON.stringify(x) + (x instanceof SyntaxError ? ' (SyntaxError)' : '') };
      const fehler = [];
      for (const fn of KI_FNS) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        if (/status\s*===\s*429\s*\|\|\s*\w+\.status\s*>=\s*500|status\s*<\s*500\s*&&/.test(src)) fehler.push(fn + ': eigene 429/5xx-Bedingung');
        if (!/kiFreigabeNoetig\s*\(/.test(src)) fehler.push(fn + ': ruft kiFreigabeNoetig nicht');
        // JEDE Freigabe geht durch die Regel — ausser „Server ohne Schluessel" (die Zeile davor fragt ihn ab).
        const zl = src.split('\n'); let mitRegel = 0; const roh = [];
        zl.forEach((z, i) => {
          if (!/await\s+kiFreigeben\s*\(/.test(z)) return;
          if (/kiFreigabeNoetig\s*\(/.test(z)) { mitRegel++; return; }
          let j = i - 1; while (j >= 0 && !zl[j].trim()) j--;
          if (!/!\s*(ANTHROPIC_API_KEY|apiKey)\b/.test(zl[j] || '')) roh.push(z.trim());
        });
        if (roh.length) fehler.push(fn + ': ' + roh.length + ' Freigabe(n) ohne die Regel');
        // Ablehnung (!ok) UND Ausnahme (catch) — der Doktor hat beides in EINEM catch (callClaudeVision wirft bei !ok)
        if (mitRegel < (fn === 'plant-doctor-diagnose' ? 1 : 2)) fehler.push(fn + ': nur ' + mitRegel + ' Stelle(n) mit der Regel');
      }
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: ja.length + ' Faelle zurueck · ' + nein.length + ' behalten · 6 Functions rufen die eine Regel' };
    },
  },
  {
    name: 'Bildgroesse · ein Bild ueber dem Anbieter-Limit (5 MB Base64) endet am Tor mit eigenem Satz; das groesste Bild, das gsCompressImage liefert (gemessen 3,07 MB), geht durch',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const MB = 1024 * 1024, B = (n) => 'A'.repeat(n);
      const fehler = [];
      for (const fn of ['ai-proxy', 'garden-scan-analyze', 'plant-doctor-diagnose', 'pest-identify', 'mushroom-identify']) {
        const gross = fn === 'ai-proxy' ? m.kiProxyEingabe({ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: B(5 * MB + 1) } }] }] }, 6 * MB) : m.kiEingabeOk(fn, { bilder: [B(5 * MB + 1)] });
        if (gross.ok || gross.code !== 'bild_zu_gross') fehler.push(fn + ' 5 MB+1 → ' + JSON.stringify({ ok: gross.ok, code: gross.code }));
        const gut = m.kiEingabeOk(fn, { bilder: [B(Math.ceil(3.1 * MB))] });
        if (!gut.ok) fehler.push(fn + ' 3,1 MB abgewiesen: ' + gut.grund);
      }
      if (!/Bild ist zu gross/.test(m.kiFehlerCode('bild_zu_gross').message)) fehler.push('kein eigener Satz');
      if (fehler.length) return { ok: false, warum: fehler.join(' · ') };
      return { ok: true, info: '5 Functions: 5 MB+1 → bild_zu_gross · 3,1 MB durch' };
    },
  },
  {
    name: 'knowledge-bulk-gen · jede Zahlspanne „<a-b>" ist eine Zahl (priority <1-10>, Liste <0-3>) — eine Zahl der KI bleibt, Text bleibt Text',
    lauf: async (h) => {
      const m = await h.modul(TOR);
      const sp = m.kiSchemaSpalten('Test. JSON-Array nur. Schema: { "slug":"<unique>", "priority":<1-10>, "anteil":<0-100 or null>, "idx":[<0-3>], "monate":[<1-12>], "titel":"<text>", "art":"a|b" }. KEINE Markdown.');
      if (!sp) return { ok: false, warum: 'Schema nicht gelesen' };
      const f = { p: sp.priority, a: sp.anteil, i: sp.idx, mo: sp.monate };
      if (!f.p || f.p.art !== 'int' || !f.a || f.a.art !== 'int' || !f.i || f.i.art !== 'liste' || f.i.von !== 'int' || !f.mo || f.mo.von !== 'int') return { ok: false, warum: 'Formen: ' + JSON.stringify(f) };
      const r = m.kiZeileOk('x_tabelle', { slug: 's', priority: 5, anteil: null, idx: [1, 2], monate: [5], titel: 'Bärlauch „wild"', art: 'a' }, sp, ['slug']);
      if (!r.ok || r.zeile.priority !== 5 || (r.weg || []).indexOf('priority') >= 0 || r.zeile.titel !== 'Bärlauch „wild"') return { ok: false, warum: 'priority 5: ' + JSON.stringify(r) };
      const t = m.kiZeileOk('x_tabelle', { slug: 's', priority: 'hoch', titel: 42 }, sp, ['slug']);
      if (!t.ok || 'priority' in t.zeile || 'titel' in t.zeile) return { ok: false, warum: 'Gegenrichtung: ' + JSON.stringify(t) };
      // die echten Schemata: seasonal_tips/seasonal_highlights.priority
      const src = h.lies('knowledge-bulk-gen/index.ts');
      const re = /table:\s*"(seasonal_tips|seasonal_highlights)"[^`]*system:\s*`([^`]*)`/g; let mm, n = 0;
      while ((mm = re.exec(src))) { const s2 = m.kiSchemaSpalten(mm[2]); if (s2 && s2.priority) { n++; if (s2.priority.art !== 'int') return { ok: false, warum: mm[1] + '.priority → ' + JSON.stringify(s2.priority) }; } }
      if (!n) return { ok: false, warum: 'seasonal_tips/highlights nicht gefunden' };
      return { ok: true, info: 'priority/anteil/idx/monate als Zahl · 5 bleibt · Text faellt weg · ' + n + ' echte Schemata' };
    },
  },
  {
    name: 'Geschwister · keine Function prueft den Nutzer mehr mit createClient(URL, <Nutzer-Token>) + getUser() OHNE Token (B-007: jeder Aufruf 401)',
    lauf: async (h) => {
      const fehler = [];
      for (const fn of h.functions()) {
        const src = h.ohneKommentare(h.lies(fn + '/index.ts'));
        const m = src.match(/const\s+(\w+)\s*=\s*createClient\(\s*\w+\s*,\s*(userToken|token|jwt)\b/);
        if (m && new RegExp(m[1] + '\\.auth\\.getUser\\(\\s*\\)').test(src)) fehler.push(fn);
      }
      if (fehler.length) return { ok: false, warum: 'noch kaputt: ' + fehler.join(', ') };
      return { ok: true, info: h.functions().length + ' Functions ohne das Muster' };
    },
  },
];

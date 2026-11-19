// Gruppe tor (19.11.2026) — die Abmelde-Klasse (Brett 2026-11-16-89ee) an den zwei
// Stellen, durch die jede Antwort muss: sbFetch und _gsAiAnfrage.
//
// sbLogout laedt die Seite NICHT neu: es raeumt den Speicher, zeigt das Onboarding und
// laesst den Arbeitsspeicher stehen — und mit ihm jede Anfrage, die gerade unterwegs ist.
// Kommt deren Antwort, nachdem A sich abgemeldet (und B sich angemeldet) hat, gehoert sie
// trotzdem A. v33.61 hat das an vier Hauptfunktionen einzeln geschlossen; hier steht das
// Tor fuer ALLE Wege: wer mit einer Person losgeht und mit einer anderen (oder keiner)
// zurueckkommt, bekommt keine Daten, sondern { error: { code: 'person_gewechselt' } } —
// bzw. bei der KI eine Ausnahme mit diesem code.
//
// Jeder Fall stellt nur den SERVER (window.fetch / window._gsFetch), haelt eine Anfrage
// fest, meldet sich ECHT ab (sbLogout) und ECHT an (sbSaveSession), gibt die Antwort
// frei und misst, was die App danach hat: Rueckgabe, Speicher, Zaehler, Protokoll der
// Anfragen (mit welchem Token sie gingen). Gegenrichtung je Weg: dieselbe Folge OHNE
// Wechsel liefert die Daten — und eine Anmeldung waehrend einer Anfrage ohne Person,
// ein Token-Refresh derselben Person lassen die Daten durch.
'use strict';

const A_UID = '00000000-0000-4000-8000-000000000001';   // aus scripts/_seed.js
const B_UID = '22222222-2222-4222-8222-222222222222';
const JWT_B = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJiIn0.YmJiYmJiYmI';
const JWT_A2 = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhMiJ9.YTJhMmEyYTI';   // A nach einem Refresh

// Im Browser: ein gestellter Server, der Anfragen auf Wunsch FESTHAELT, bis der Fall
// sie freigibt; dazu Abmelden (echt) und Anmelden als B (echt, ueber sbSaveSession).
const STELLEN = `(function(){
  var A = '${A_UID}', B = '${B_UID}', JB = '${JWT_B}', JA2 = '${JWT_A2}';
  var T = window.__tor = { offen: [], log: [], halten: null, refresh: null, A: A, B: B };
  T.tokens = {}; T.tokens['pruef.stand.token'] = A; T.tokens[JB] = B; T.tokens[JA2] = A;
  var json = function (b, st) { return new Response(JSON.stringify(b), { status: st || 200, headers: { 'Content-Type': 'application/json' } }); };
  var stell = function (url, opts) {
    url = String(url); opts = opts || {};
    var hd = opts.headers || {};
    var auth = String(hd.Authorization || hd.authorization || '');
    var body = (typeof opts.body === 'string') ? opts.body : '';
    var e = { url: url, method: String(opts.method || 'GET').toUpperCase(), wer: T.tokens[auth.replace(/^Bearer /, '')] || null, body: body.slice(0, 4000) };
    T.log.push(e);
    if (T.halten && T.halten.test(url)) return new Promise(function (res, rej) { T.offen.push({ e: e, res: res, rej: rej }); });
    if (/\\/auth\\/v1\\/token/.test(url)) return Promise.resolve(T.refresh ? json(T.refresh) : json({ error: 'invalid_grant' }, 400));
    // wie RLS: eine Zeile mit fremder user_id lehnt der Server ab
    if (e.method === 'POST' && /\\/rest\\/v1\\/(user_scans|scan_corrections|garden_harvests)/.test(url)) {
      var b = {}; try { b = JSON.parse(body); } catch (_) {}
      if (b && b.user_id && b.user_id !== e.wer) return Promise.resolve(json({ message: 'new row violates row-level security policy', code: '42501' }, 403));
      return Promise.resolve(json([{ id: 'neu-' + T.log.length }]));
    }
    if (/\\/storage\\/v1\\/object\\//.test(url)) return Promise.resolve(json({ Key: 'x' }));
    if (/\\/rest\\/v1\\/stripe_prices/.test(url)) return Promise.resolve(json([{ id: 'price_tor', metadata: { lookup_key: 'pro_monthly' } }]));
    return Promise.resolve(json([]));
  };
  window.fetch = stell; window._gsFetch = stell;
  T.json = json;
  T.warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  T.warteAuf = async function (n) { for (var i = 0; i < 300 && T.offen.length < (n || 1); i++) await T.warte(15); return T.offen.length >= (n || 1); };
  T.frei = function (body, st) { var o = T.offen.shift(); if (o) o.res(json(body, st)); return !!o; };
  T.reissen = function () { var o = T.offen.shift(); if (o) o.rej(new TypeError('Failed to fetch')); return !!o; };
  // Kopfzeilen JETZT, Rumpf erst auf T.rumpf() — das Lesen des Rumpfs ist ein eigenes await.
  T.freiLangsam = function (body) {
    var o = T.offen.shift(); if (!o) return false;
    var ctl; var rs = new ReadableStream({ start: function (c) { ctl = c; } });
    T.rumpf = function () { ctl.enqueue(new TextEncoder().encode(JSON.stringify(body))); ctl.close(); };
    o.res(new Response(rs, { status: 200, headers: { 'Content-Type': 'application/json' } }));
    return true;
  };
  T.anmeldenB = function () { sbSaveSession({ access_token: JB, refresh_token: 'rt-b', expires_in: 3600, user: { id: B, email: 'b@example.invalid', user_metadata: {} } }); };
  T.wechsel = async function (nachB) { await sbLogout(); if (nachB !== false) T.anmeldenB(); };
  T.alsB = function (pat) { return T.log.filter(function (e) { return e.wer === B && pat.test(e.url + ' ' + e.body); }); };
  // ein Zahlungsfenster, das nur mitschreibt, wohin es geschickt wird
  T.fenster = function () {
    var f = { closed: false, location: { href: '' }, document: { write: function () {}, body: {} }, close: function () { f.closed = true; } };
    window._gsCheckoutFenster = function () { return f; };
    return f;
  };
  T.jpeg = function () {
    var c = document.createElement('canvas'); c.width = 96; c.height = 96;
    var g = c.getContext('2d'); g.fillStyle = '#3f9142'; g.fillRect(0, 0, 96, 96); g.fillStyle = '#d33'; g.fillRect(30, 30, 30, 30);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  };
})();`;

async function fall(seite, h, fn, arg) {
  await seite.evaluate(STELLEN);
  let r;
  try { r = await seite.evaluate(fn, arg || {}); }
  finally { await h.frisch(); }   // jeder Fall beginnt wieder als A
  return r;
}
const satzOk = (s) => typeof s === 'string' && s.length > 10 && s.length <= 120 && /[.!]$/.test(s) && !/person_gewechselt|undefined/.test(s);

// ── Gruppe ki-wege (19.11.2026): die 19 KI-Funktionen ohne Personen-Vergleich ─────────────
// Seit dem Tor WIRFT callAI/callVisionAI nach einem Kontowechsel (code person_gewechselt).
// Was der Aufrufer im catch damit tut, entscheidet, was B sieht: eine Fehlerkarte „Das Konto
// wurde gewechselt …" in einem Fenster von A, ein Toast, ein Dialog, eine Sprachausgabe —
// oder ein Rueckfall, der SCHREIBT. Und ein await VOR dem KI-Aufruf (Wetter, Foto laden,
// Triage) laesst die Frage von A erst NACH dem Wechsel losgehen: dann laeuft sie als B, und
// das Tor sieht nichts. Die Wege unten stehen als Tabelle im Browser; je Weg faehrt der Fall
// dieselbe Folge OHNE Wechsel (das Ergebnis muss dastehen — sonst misst er nichts) und MIT.
const KI_STELLEN = `(function(){
  var T = window.__tor;
  window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
  window.gsAboCanUse = function () { return true; };
  T.toasts = [];
  window.gsToast = function (m) { T.toasts.push(String(typeof m === 'object' ? JSON.stringify(m) : m)); };
  window.showProfileToast = function (m) { T.toasts.push(String(typeof m === 'object' ? JSON.stringify(m) : m)); };
  T.ki = function (t) { return { content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }; };
  T.kasten = function (id, tag) {
    var el = document.getElementById(id);
    if (!el) { el = document.createElement(tag || 'div'); el.id = id; document.body.appendChild(el); }
    return el;
  };
  T.datei = function () {
    var bin = atob(T.jpeg()), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new File([u], 'garten.jpg', { type: 'image/jpeg' });
  };
  // Ein Datei-Feld, das die App per click() oeffnet, wird nicht geoeffnet, sondern gemerkt.
  var _click = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () { if (this.type === 'file') { T.dateiFeld = this; return; } return _click.call(this); };
  T.alsA = async function () {
    await sbLogout();
    sbSaveSession({ access_token: 'pruef.stand.token', refresh_token: 'rt-a', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
  };
  // jeder Wert im Geraetespeicher, der ein Merkmal von A traegt. Ausgenommen: gs_plans_wartend —
  // dort parkt gsClearUserDataKeys die nur lokal gespeicherten Plaene von A, gestempelt mit
  // dessen uid (v33.59, nur A sieht sie wieder); der Fall prueft den Stempel statt des Inhalts.
  // Ebenso gs_garden_twin (Gegenpruefung 19.11.2026, „KI h"): der Zwilling bleibt liegen und
  // traegt sein Konto — rot ist er mit einem fremden Stempel oder ohne Stempel.
  T.speicherMit = function (re) {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i); var v = localStorage.getItem(k) || '';
      if (k === 'gs_garden_twin') {
        try { var tw = JSON.parse(v); if (re.test(v) && !(tw && tw.uid === T.A)) out.push(k + (tw && tw.uid ? ' (fremder Stempel)' : ' (ohne Stempel)')); } catch (_) {}
        continue;
      }
      if (k === 'gs_plans_wartend') {
        try { if (JSON.parse(v).some(function (e) { return e && e.uid !== T.A; })) out.push(k + ' (fremder Stempel)'); } catch (_) {}
        continue;
      }
      if (re.test(v)) out.push(k);
    }
    return out;
  };
  // liegt der Zwilling von A — gestempelt mit A — im Speicher? (der Speicherbefund oben laesst ihn aus)
  T.zwillingVonA = function () { try { var v = localStorage.getItem('gs_garden_twin') || ''; return /ERGEBNIS-A/.test(v) && JSON.parse(v).uid === T.A; } catch (_) { return false; } };
  // eine gehaltene Anfrage mit einem echten JPEG beantworten (Foto aus dem Speicher)
  T.freiBild = function () { var o = T.offen.shift(); if (o) o.res(new Response(T.datei(), { status: 200, headers: { 'Content-Type': 'image/jpeg' } })); return !!o; };
  T.kiAlsB = function (n0) { return T.log.slice(n0).filter(function (e) { return e.wer === T.B && /ai-proxy|api[.]anthropic[.]com/.test(e.url); }).length; };
  T.FEHLER = /gewechselt|fehlgeschlagen|Fehler|❌|nicht geklappt|nicht auswerten|nicht erreichen|nicht möglich|API-Key|Keine Antwort/i;
  // Ein Weg: vor() stellt den Zustand her, lauf() startet ihn, box() ist, was B danach sieht.
  T.fahre = async function (w, mitWechsel) {
    if (_gsPerson() !== T.A) await T.alsA();
    localStorage.removeItem('gs_plans_wartend');   // je Weg ein eigener Befund, kein Nachlauf des vorigen
    var n0 = T.log.length;
    T.halten = w.halt || /ai-proxy/;
    w.vor();
    var p;
    try { p = Promise.resolve(w.lauf()); } catch (e) { p = Promise.reject(e); }
    p = p.then(function (v) { return { wert: v === undefined ? null : String(v).slice(0, 120) }; }, function (e) { return { wurf: (e && (e.code || e.message)) || String(e) }; });
    if (!(await T.warteAuf(1))) { T.halten = null; await p; return { fehlt: w.name + ': ging nie an die KI' }; }
    if (mitWechsel) await T.wechsel(true);
    T.toasts.length = 0;
    T.halten = null;
    T.frei(w.antwort);
    for (var k = 0; k < 5; k++) { await T.warte(60); while (T.offen.length) T.frei(w.antwort); }
    var r = await p;
    await T.warte(w.nach || 150);
    var box = w.box();
    var text = box ? String(box.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 200) : null;
    return {
      r: r, text: text, fehler: !!(text && T.FEHLER.test(text)), ergebnisDa: !!(text && /ERGEBNIS-A/.test(text)),
      toasts: T.toasts.slice(),
      kiAlsB: T.log.slice(n0).filter(function (e) { return e.wer === T.B && /ai-proxy|api[.]anthropic[.]com/.test(e.url); }).map(function (e) { return e.method + " " + e.url.replace(/^https?:[/][/][^/]+/, "") + " " + e.body.slice(0, 120); }),
      speicher: T.speicherMit(/ERGEBNIS-A|GEHEIM-A/),
      extra: w.messe ? w.messe() : null,
    };
  };
  // Ein await, der von aussen freigegeben wird: T.tuer[name]() oeffnet ihn (Wetter, Verkleinern …).
  T.tuer = {};
  T.machTuer = function (name, wert) { return function () { return new Promise(function (res) { T.tuer[name] = function () { res(wert); }; }); }; };
  T.warteTuer = async function (name) { for (var i = 0; i < 300 && !T.tuer[name]; i++) await T.warte(15); return !!T.tuer[name]; };
  // Der ERSTE FileReader, den die App danach anlegt, liest erst auf T.leserFrei() — alle weiteren
  // (Bild ohne Metadaten, Sicherung beim Abmelden) lesen sofort.
  T.leserTuer = function () {
    var Echt = T.EchterLeser || (T.EchterLeser = window.FileReader), gehalten = false;
    T.leser = [];
    window.FileReader = function () {
      var r = new Echt();
      if (!gehalten) { gehalten = true; var lies = r.readAsDataURL.bind(r); r.readAsDataURL = function (b) { T.leser.push(function () { lies(b); }); }; }
      return r;
    };
  };
  T.warteLeser = async function () { for (var i = 0; i < 300 && !(T.leser && T.leser.length); i++) await T.warte(15); return !!(T.leser && T.leser.length); };
  T.leserFrei = function () { var f; while ((f = T.leser.shift())) f(); };
  // Jede Frage beantworten, die ab jetzt an die KI geht (auch die von B, die es nicht geben darf).
  T.alleKi = async function (antwort, runden) { for (var k = 0; k < (runden || 10); k++) { await T.warte(80); while (T.offen.length) { if (/plant-photos/.test(T.offen[0].e.url)) T.freiBild(); else T.frei(antwort); } } };
  // Ein Weg mit einem await VOR oder NACH der KI: w.bis() wartet, bis die App dort steht,
  // dann (optional) der Wechsel, dann w.weiter() — und jede KI-Frage danach wird beantwortet.
  T.fahreTuer = async function (w, mitWechsel) {
    if (_gsPerson() !== T.A) await T.alsA();
    localStorage.removeItem('gs_plans_wartend');   // je Weg ein eigener Befund, kein Nachlauf des vorigen
    if (T.EchterLeser) window.FileReader = T.EchterLeser;
    T.tuer = {}; T.leser = []; T.toasts.length = 0;
    var n0 = T.log.length;
    T.halten = w.halt || null;
    w.vor();
    var p; try { p = Promise.resolve(w.lauf()); } catch (e) { p = Promise.reject(e); }
    p = p.catch(function (e) { return 'wurf:' + ((e && e.code) || e); });
    if (!(await w.bis())) { T.halten = null; return { fehlt: w.name + ': die Stelle vor dem Wechsel wurde nie erreicht' }; }
    if (mitWechsel) await T.wechsel(true);
    T.toasts.length = 0;
    w.weiter();
    T.halten = /ai-proxy|plant-photos/;
    await T.alleKi(w.antwort, w.runden);
    T.halten = null;
    await p; await T.warte(w.nach || 200);
    if (T.EchterLeser) window.FileReader = T.EchterLeser;
    return { kiAlsB: T.kiAlsB(n0), alsB: T.log.slice(n0).filter(function (e) { return e.wer === T.B && w.server && w.server.test(e.url); }).length,
             alsA: T.log.slice(n0).filter(function (e) { return e.wer === T.A && w.server && w.server.test(e.url); }).length,
             kiAlsA: T.log.slice(n0).filter(function (e) { return e.wer === T.A && /ai-proxy/.test(e.url); }).length,
             speicher: T.speicherMit(/ERGEBNIS-A|GEHEIM-A/), zwillingA: T.zwillingVonA(), toasts: T.toasts.slice(), extra: w.messe ? w.messe() : null };
  };
  T.wegeTuer = async function (wege) {
    var out = {};
    for (var i = 0; i < wege.length; i++) {
      var w = wege[i];
      var ohne = await T.fahreTuer(w, false);
      var mit = ohne.fehlt ? ohne : await T.fahreTuer(w, true);
      out[w.name] = { ohne: ohne, ohneOk: !ohne.fehlt && !!w.ok(ohne), mit: mit };
    }
    return out;
  };
  // ohne Wechsel, dann mit — je Weg
  T.wege = async function (liste) {
    var out = {};
    for (var i = 0; i < liste.length; i++) {
      var w = liste[i];
      var ohne = await T.fahre(w, false);
      var ohneOk = ohne.fehlt ? false : (w.ok ? !!w.ok(ohne) : ohne.ergebnisDa);
      var mit = await T.fahre(w, true);
      out[w.name] = { ohne: ohne, ohneOk: ohneOk, mit: mit };
    }
    return out;
  };
})();`;
async function kiFall(seite, h, fn, arg) {
  await seite.evaluate(STELLEN);
  await seite.evaluate(KI_STELLEN);
  let r;
  try { r = await seite.evaluate(fn, arg || {}); }
  finally { await h.frisch(); }
  return r;
}
// Je Weg: ohne Wechsel muss das Ergebnis dastehen (sonst misst der Fall nichts); mit Wechsel
// darf B nichts davon sehen — keine Karte, kein Toast, keine KI-Anfrage als B, nichts im Speicher.
function kiUrteil(r, namen) {
  const f = [];
  for (const n of namen) {
    const x = r[n];
    if (!x) { f.push(n + ': nicht gefahren'); continue; }
    if (x.ohne.fehlt || x.mit.fehlt) { f.push(x.ohne.fehlt || x.mit.fehlt); continue; }
    if (!x.ohneOk) f.push(n + ': ohne Wechsel kein Ergebnis (' + JSON.stringify(x.ohne).slice(0, 160) + ') — der Fall misst dort nichts');
    const m = x.mit;
    if (m.ergebnisDa) f.push(n + ': das Ergebnis von A steht vor B');
    else if (m.fehler) f.push(n + ': Fehlerkarte fuer B „' + m.text.slice(0, 90) + '"');
    if (m.toasts.length) f.push(n + ': Toast fuer B „' + m.toasts[0].slice(0, 80) + '"');
    if (m.kiAlsB.length) f.push(n + ': ' + m.kiAlsB.length + '× KI-Anfrage mit dem Token von B (' + m.kiAlsB[0].slice(0, 100) + ')');
    if (m.speicher.length) f.push(n + ': Merkmal von A im Speicher von B (' + m.speicher.join(', ') + ')');
    if (m.extra && m.extra.warum) f.push(n + ': ' + m.extra.warum);
  }
  return f;
}

// Urteil fuer Wege mit einem await vor/nach der KI (T.wegeTuer): ohne Wechsel fragt A (und
// speichert, wo der Weg speichert); mit Wechsel keine Frage als B, nichts an den Server als B,
// nichts von A im Speicher von B, kein Toast, nichts, was der Weg selbst als Rest meldet.
function kiUrteilTuer(r) {
  const f = [];
  for (const n of Object.keys(r)) {
    const x = r[n];
    if (x.mit.fehlt) { f.push(x.mit.fehlt); continue; }
    if (!x.ohneOk) f.push(n + ': ohne Wechsel kein Ergebnis fuer A (' + JSON.stringify(x.ohne).slice(0, 180) + ') — der Fall misst dort nichts');
    const m = x.mit;
    if (m.kiAlsB) f.push(n + ': die Frage von A ging ' + m.kiAlsB + '× mit dem Token von B an die KI');
    if (m.alsB) f.push(n + ': ' + m.alsB + '× an den Server mit dem Token von B');
    if (m.speicher.length) f.push(n + ': Merkmal von A im Speicher von B (' + m.speicher.join(', ') + ')');
    if (m.toasts.length) f.push(n + ': Toast fuer B „' + m.toasts[0].slice(0, 80) + '"');
    if (m.extra && m.extra.warum) f.push(n + ': ' + m.extra.warum);
  }
  return f;
}

module.exports = [
  {
    name: 'Tor a · sbFetch: A fragt, meldet sich ab, B meldet sich an, DANN kommt die Antwort → kein Datum, error.code person_gewechselt',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /gs_pruef_tor/;
        const p = sbFetch('/rest/v1/gs_pruef_tor?select=*', { method: 'GET' });
        if (!(await T.warteAuf(1))) return { fehlt: 'die Anfrage kam nie beim Server an' };
        const wer0 = _gsPerson();
        await T.wechsel(true);
        const wer1 = _gsPerson();
        T.frei([{ geheim: 'GEHEIM-A-Zeile' }]);
        const x = await p;
        const pg = (typeof _gsPersonGewechselt === 'function') ? _gsPersonGewechselt(x) : 'fehlt';
        const satz = (typeof _gsFehlerText === 'function' && x && x.error) ? _gsFehlerText(x.error) : null;
        return { wer0, wer1, x: JSON.stringify(x), code: x && x.error && x.error.code, daten: x && x.data, pg, satz, satzAusMeldung: x && x.error ? _gsFehlerText(x.error.message) : null };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.wer0 !== A_UID || r.wer1 !== B_UID) return { ok: false, warum: 'Wechsel nicht hergestellt: ' + r.wer0 + ' → ' + r.wer1 };
      if (/GEHEIM-A/.test(r.x)) return { ok: false, warum: 'die Antwort fuer A kommt bei B an: ' + r.x.slice(0, 160) };
      if (r.code !== 'person_gewechselt') return { ok: false, warum: 'kein error.code person_gewechselt: ' + r.x.slice(0, 160) };
      if (r.pg !== true) return { ok: false, warum: '_gsPersonGewechselt sagt ' + r.pg };
      if (!satzOk(r.satz) || r.satzAusMeldung !== r.satz) return { ok: false, warum: '_gsFehlerText: ' + JSON.stringify(r.satz) + ' / aus der Meldung: ' + JSON.stringify(r.satzAusMeldung) };
      return { ok: true, info: 'A → abgemeldet → B, Antwort danach: ' + r.x + ' · Satz „' + r.satz + '"' };
    },
  },
  {
    name: 'Tor b · sbFetch: dieselbe Folge, Antwort kommt VOR der Anmeldung von B (abgemeldet) → ebenso kein Datum',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /gs_pruef_tor/;
        const p = sbFetch('/rest/v1/gs_pruef_tor?select=*', { method: 'GET' });
        if (!(await T.warteAuf(1))) return { fehlt: 'die Anfrage kam nie beim Server an' };
        await T.wechsel(false);
        const wer1 = _gsPerson();
        T.frei([{ geheim: 'GEHEIM-A-Zeile' }]);
        const x = await p;
        return { wer1, x: JSON.stringify(x), code: x && x.error && x.error.code };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.wer1 !== null) return { ok: false, warum: 'nach sbLogout noch angemeldet: ' + r.wer1 };
      if (/GEHEIM-A/.test(r.x)) return { ok: false, warum: 'die Antwort fuer A kommt nach dem Abmelden an: ' + r.x.slice(0, 160) };
      if (r.code !== 'person_gewechselt') return { ok: false, warum: 'kein error.code person_gewechselt: ' + r.x.slice(0, 160) };
      return { ok: true, info: 'A → abgemeldet, Antwort danach: ' + r.x };
    },
  },
  {
    name: 'Tor c · Gegenrichtung: ohne Wechsel · Start ohne Person + Anmeldung · Refresh in sbFetch · Refresh waehrend der Anfrage → die Daten kommen an',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async (o) => {
        const T = window.__tor; T.halten = /gs_pruef_tor/;
        const out = {};
        // c0 · ohne Wechsel
        let p = sbFetch('/rest/v1/gs_pruef_tor?c=0', { method: 'GET' });
        await T.warteAuf(1); T.frei([{ ok: 'c0' }]); out.c0 = JSON.stringify(await p);
        // c1 · Anfrage startet OHNE Person (Anmeldevorgang, oeffentliche Daten), B meldet sich an
        await sbLogout();
        out.c1start = _gsPerson();
        p = sbFetch('/rest/v1/gs_pruef_tor?c=1', { method: 'GET' });
        await T.warteAuf(1); T.anmeldenB(); T.frei([{ ok: 'c1' }]); out.c1 = JSON.stringify(await p);
        // c2 · B, Token laeuft ab → sbFetch erneuert selbst (gleiche uid), dann geht die Anfrage
        T.refresh = { access_token: o.JB2, refresh_token: 'rt-b2', expires_in: 3600, user: { id: T.B, email: 'b@example.invalid', user_metadata: {} } };
        T.tokens[o.JB2] = T.B;
        localStorage.setItem('gs_sb_expires', String(Date.now() + 5000));
        p = sbFetch('/rest/v1/gs_pruef_tor?c=2', { method: 'GET' });
        await T.warteAuf(1);
        out.c2refresh = T.log.some(function (e) { return /\/auth\/v1\/token/.test(e.url); });
        out.c2token = T.offen[0] && T.offen[0].e.wer;
        T.frei([{ ok: 'c2' }]); out.c2 = JSON.stringify(await p);
        // c3 · B, ein anderer Weg erneuert das Token WAEHREND der Anfrage (gleiche uid)
        p = sbFetch('/rest/v1/gs_pruef_tor?c=3', { method: 'GET' });
        await T.warteAuf(1);
        sbSaveSession({ access_token: o.JB3, refresh_token: 'rt-b3', expires_in: 3600, user: { id: T.B, email: 'b@example.invalid', user_metadata: {} } });
        T.frei([{ ok: 'c3' }]); out.c3 = JSON.stringify(await p);
        return out;
      }, { JB2: JWT_B + 'x2', JB3: JWT_B + 'x3' });
      const f = [];
      if (!/"c0"/.test(r.c0)) f.push('ohne Wechsel: ' + r.c0);
      if (r.c1start !== null) f.push('c1 startet nicht ohne Person (' + r.c1start + ')');
      if (!/"c1"/.test(r.c1)) f.push('Start ohne Person, Anmeldung waehrend der Anfrage: ' + r.c1);
      if (!r.c2refresh) f.push('c2: sbFetch hat nicht erneuert — der Fall misst den Refresh nicht');
      if (r.c2token !== B_UID) f.push('c2: die Anfrage ging nicht mit dem erneuerten Token (' + r.c2token + ')');
      if (!/"c2"/.test(r.c2)) f.push('Refresh in sbFetch: ' + r.c2);
      if (!/"c3"/.test(r.c3)) f.push('Refresh waehrend der Anfrage: ' + r.c3);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel · Start ohne Person + Anmeldung · Refresh in sbFetch (neues Token) · Refresh waehrend der Anfrage → 4× Daten' };
    },
  },
  {
    name: 'Tor d · callAI/callVisionAI: A fragt, Wechsel, Antwort → Ausnahme code person_gewechselt, _gsAiLaufend 0, nichts gezaehlt; ohne Wechsel → Text',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
        window.gsAboCanUse = function () { return true; };
        let gezaehlt = 0; window.gsAboTrackAICall = function () { gezaehlt++; };
        const out = {};
        const kiAntwort = function (t) { return { content: [{ type: 'text', text: t }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }; };
        const fang = async function (pr) { try { return { text: await pr }; } catch (e) { return { code: e && e.code, msg: e && e.message }; } };
        // d0 · ohne Wechsel
        T.halten = /ai-proxy/;
        let p = fang(callAI([{ role: 'user', content: 'x' }], 'sys', 50));
        await T.warteAuf(1); out.d0laufend = window._gsAiLaufend; T.frei(kiAntwort('ANTWORT-OHNE-WECHSEL')); out.d0 = await p;
        // d1 · callAI, Wechsel A → B
        p = fang(callAI([{ role: 'user', content: 'GEHEIM-A-Frage' }], 'sys', 50));
        await T.warteAuf(1); out.d1laufend = window._gsAiLaufend;
        await T.wechsel(true);
        T.frei(kiAntwort('GEHEIM-A-Antwort')); out.d1 = await p; out.d1nach = window._gsAiLaufend;
        // d2 · callVisionAI, Wechsel B → abgemeldet
        const bild = T.jpeg();
        p = fang(callVisionAI(bild, 'image/jpeg', 'was ist das?', null, { maxTokens: 50 }));
        const da = await T.warteAuf(1); out.d2da = da; out.d2laufend = window._gsAiLaufend;
        await T.wechsel(false);
        T.frei(kiAntwort('GEHEIM-B-Bild')); out.d2 = await p; out.d2nach = window._gsAiLaufend;
        out.gezaehlt = gezaehlt;
        out.proxyAlsFremd = T.log.filter(function (e) { return /ai-proxy/.test(e.url) && /GEHEIM-A/.test(e.body) && e.wer !== T.A; }).length;
        return out;
      });
      const f = [];
      if (!r.d0 || r.d0.text !== 'ANTWORT-OHNE-WECHSEL') f.push('ohne Wechsel keine Antwort: ' + JSON.stringify(r.d0));
      if (r.d0laufend !== 1 || r.d1laufend !== 1) f.push('der Zaehler laeuft nicht mit (' + r.d0laufend + '/' + r.d1laufend + ') — der Fall misst nicht, was er meint');
      if (!r.d1 || r.d1.text !== undefined || r.d1.code !== 'person_gewechselt') f.push('callAI nach dem Wechsel: ' + JSON.stringify(r.d1));
      if (!r.d2da) f.push('callVisionAI hat den Server nie gefragt');
      if (!r.d2 || r.d2.text !== undefined || r.d2.code !== 'person_gewechselt') f.push('callVisionAI nach dem Abmelden: ' + JSON.stringify(r.d2));
      if (r.d1nach !== 0 || r.d2nach !== 0) f.push('_gsAiLaufend danach ' + r.d1nach + '/' + r.d2nach + ' statt 0');
      if (r.gezaehlt !== 1) f.push('gsAboTrackAICall ' + r.gezaehlt + '× (erwartet 1 — nur die Antwort ohne Wechsel)');
      if (r.proxyAlsFremd) f.push('die Frage von A ging mit einem fremden Token an den Proxy');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel Text · callAI A→B und callVisionAI B→abgemeldet: code person_gewechselt („' + r.d1.msg + '"), Zaehler 0, 1× gezaehlt' };
    },
  },
  {
    name: 'Tor d2 · callAI: Wechsel WAEHREND der Kontingent-Abfrage → die Frage von A geht gar nicht erst hinaus',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
        window.gsShowQuotaCountdown = function () {};
        T.halten = /fn_quota_peek/;
        let fehler = null, text;
        const p = callAI([{ role: 'user', content: 'GEHEIM-A-Frage' }], 'sys', 50, { quotaFeature: 'lina' }).then(function (t) { text = t; }, function (e) { fehler = { code: e && e.code, msg: e && e.message }; });
        if (!(await T.warteAuf(1))) return { fehlt: 'die Kontingent-Abfrage kam nie beim Server an' };
        await T.wechsel(true);
        T.frei({ allowed: true, unlimited: false, used: 0, limit: 15 });
        T.halten = null;
        await p;
        return { fehler, text, alsB: T.alsB(/ai-proxy.*GEHEIM-A|GEHEIM-A.*ai-proxy/).length, proxy: T.log.filter(function (e) { return /ai-proxy/.test(e.url); }).length };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.alsB || r.proxy) return { ok: false, warum: 'die Frage von A ging nach dem Wechsel an den Proxy (' + r.proxy + '×, davon mit dem Token von B: ' + r.alsB + ')' };
      if (!r.fehler || r.fehler.code !== 'person_gewechselt') return { ok: false, warum: 'kein Fehler person_gewechselt: ' + JSON.stringify(r) };
      return { ok: true, info: 'Kontingent-Abfrage als A, Wechsel → 0 Anfragen an den Proxy, Fehler person_gewechselt' };
    },
  },
  {
    name: 'Tor e · echter Weg: der Garten-Abgleich (gsGardenSync.pullAll) schrieb das Tagebuch von A in den Speicher von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        if (!window.gsGardenSync || typeof gsGardenSync.pullAll !== 'function') return { fehlt: 'gsGardenSync.pullAll fehlt' };
        T.halten = /garden_diary/;
        const p = gsGardenSync.pullAll();
        if (!(await T.warteAuf(1))) return { fehlt: 'der Abgleich hat das Tagebuch nie gefragt' };
        await T.wechsel(true);
        T.halten = null;
        T.frei([{ id: 'd5e6f7a8-0000-4000-8000-00000000000a', ts: new Date().toISOString(), text: 'GEHEIM-A-Tagebuch', emoji: '🌱', title: 'GEHEIM-A-Titel' }]);
        await p; await T.warte(100);
        return { wer: _gsPerson(), tb: localStorage.getItem('gs_gartentagebuch') || '', mem: JSON.stringify((typeof _gsTagebuch !== 'undefined' && _gsTagebuch) || []) };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.wer !== B_UID) return { ok: false, warum: 'B ist danach nicht angemeldet (' + r.wer + ')' };
      if (/GEHEIM-A/.test(r.tb + r.mem)) return { ok: false, warum: 'das Tagebuch von A steht im Speicher von B (gs_gartentagebuch — daraus baut gsCloudSync den Blob fuer user_plants von B): ' + r.tb.slice(0, 140) };
      return { ok: true, info: 'Antwort fuer A nach dem Wechsel: gs_gartentagebuch von B bleibt ohne den Eintrag von A' };
    },
  },
  {
    name: 'Tor e2 · echter Weg: sbLoadProfile setzte das Profil von A (Name, XP) fuer B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /\/rest\/v1\/profiles/;
        const p = sbLoadProfile();
        if (!(await T.warteAuf(1))) return { fehlt: 'sbLoadProfile hat nie gefragt' };
        await T.wechsel(true);
        T.halten = null;
        T.frei([{ id: T.A, display_name: 'GEHEIM-A-Name', xp: 9999, avatar_emoji: '🦊' }]);
        const ret = await p;
        return { ret: JSON.stringify(ret), prof: JSON.stringify(typeof _sbProfile !== 'undefined' ? _sbProfile : null) };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (/GEHEIM-A/.test(r.ret + r.prof)) return { ok: false, warum: 'das Profil von A steht nach dem Wechsel in _sbProfile: ' + r.prof.slice(0, 140) };
      if (r.prof.indexOf(A_UID) >= 0) return { ok: false, warum: 'nach dem Wechsel traegt _sbProfile die Id von A: ' + r.prof.slice(0, 140) };
      return { ok: true, info: 'Profil-Antwort fuer A nach dem Wechsel: _sbProfile = ' + r.prof };
    },
  },
  {
    name: 'Tor f · gsCloudSync: die Warteschlange von A laeuft nach dem Wechsel nicht mit dem Token von B weiter und wird nicht zurueckgeschrieben',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        localStorage.setItem('gs_sync_dirty', '{}');
        localStorage.setItem('gs_sync_queue', JSON.stringify([
          { ts: 1, kind: 'harvest_add', row: { id: 'h-a-1', species_name: 'GEHEIM-A-Ernte-1', menge: 1, unit: 'kg' } },
          { ts: 2, kind: 'harvest_add', row: { id: 'h-a-2', species_name: 'GEHEIM-A-Ernte-2', menge: 2, unit: 'kg' } },
        ]));
        T.halten = /garden_harvests/;
        const p = gsCloudSync.flushNow();
        if (!(await T.warteAuf(1))) return { fehlt: 'die Warteschlange ging nie hinaus' };
        await T.wechsel(true);
        T.frei([]);
        await T.warteAuf(1);   // haelt die Schleife eine zweite Anfrage fest, ist sie weitergelaufen
        while (T.offen.length) T.frei([]);
        await p; await T.warte(50);
        return { alsB: T.alsB(/GEHEIM-A-Ernte/).length, queue: localStorage.getItem('gs_sync_queue') || '' };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.alsB) f.push('eine Ernte von A ging nach dem Wechsel mit dem Token von B hinaus (' + r.alsB + '×)');
      if (/GEHEIM-A/.test(r.queue)) f.push('die Warteschlange von A steht nach dem Abmelden wieder im Speicher: ' + r.queue.slice(0, 120));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '1. Vorgang als A unterwegs, Wechsel → kein Vorgang als B, gs_sync_queue bleibt geraeumt' };
    },
  },
  {
    name: 'Tor g · Scan speichern: Wechsel waehrend des Foto-Uploads → der Scan von A wird nicht fuer B eingereiht und das Foto nicht in den Ordner von B geladen',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        const eingereiht = [];
        window.gsQueueOffline = async function (typ, d) { eingereiht.push({ typ: typ, wer: _gsPerson(), name: d && d.name }); return true; };
        window._gsLastScanB64 = T.jpeg();
        T.halten = /\/storage\/v1\/object\/scan-images/;
        showScanResult({ name: 'GEHEIM-A-Scan', latin: 'Bellis perennis', confidence: 91, toxicity: 0, edible: true, category: 'wildpflanze', _scanId: 'scan-tor-g' });
        if (!(await T.warteAuf(1))) return { fehlt: 'der Scan hat nie ein Foto hochgeladen' };
        await T.wechsel(true);
        T.frei({ Key: 'scan-images/x' });
        await T.warte(400);
        while (T.offen.length) { T.frei({ Key: 'y' }); await T.warte(200); }
        await T.warte(300);
        return {
          eingereiht: eingereiht,
          uploadsAlsB: T.log.filter(function (e) { return /\/storage\/v1\/object\/scan-images/.test(e.url) && e.wer === T.B; }).length,
          scansAlsB: T.alsB(/user_scans.*GEHEIM-A|GEHEIM-A.*user_scans/).length,
        };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.eingereiht.length) f.push('der Scan von A wurde nach dem Wechsel eingereiht: ' + JSON.stringify(r.eingereiht));
      if (r.uploadsAlsB) f.push('das Foto von A ging ' + r.uploadsAlsB + '× mit dem Token von B in den Speicher');
      if (r.scansAlsB) f.push('der Scan von A ging mit dem Token von B an user_scans');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Upload als A, Wechsel → nichts eingereiht, kein Upload und kein Insert als B' };
    },
  },
  {
    name: 'Tor h · Korrekturen nachsenden: Wechsel mitten im Nachsenden → keine Korrektur von A mit dem Konto von B, die Warteschlange bleibt geraeumt',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        localStorage.setItem('gs_scan_corrections_queue', JSON.stringify([
          { ai_name: 'X', user_name: 'GEHEIM-A-Korrektur-1', reported_at: new Date().toISOString() },
          { ai_name: 'Y', user_name: 'GEHEIM-A-Korrektur-2', reported_at: new Date().toISOString() },
        ]));
        T.halten = /scan_corrections/;
        const p = gsFlushKorrekturen();
        if (!(await T.warteAuf(1))) return { fehlt: 'das Nachsenden ging nie hinaus' };
        await T.wechsel(true);
        T.frei([{ id: 1 }]);
        await T.warteAuf(1);
        while (T.offen.length) T.frei([{ id: 2 }]);
        await p; await T.warte(50);
        return { alsB: T.alsB(/GEHEIM-A-Korrektur/).length, queue: localStorage.getItem('gs_scan_corrections_queue') || '' };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.alsB) f.push('eine Korrektur von A ging mit dem Konto von B hinaus (' + r.alsB + '×)');
      if (/GEHEIM-A/.test(r.queue)) f.push('die Korrekturen von A stehen nach dem Abmelden wieder im Speicher: ' + r.queue.slice(0, 120));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'erste Korrektur als A unterwegs, Wechsel → keine als B, Warteschlange bleibt geraeumt' };
    },
  },
  {
    name: 'Tor i · Garten-Warteschlange (gsGardenSync): Wechsel mitten im Abarbeiten → kein Vorgang von A als B, nichts zurueckgeschrieben',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        if (!window.gsGardenSync || typeof gsGardenSync.flushQueue !== 'function') return { fehlt: 'gsGardenSync.flushQueue fehlt' };
        localStorage.setItem('gs_garden_sync_queue', JSON.stringify([
          { t: 1, action: 'upsert', table: 'garden_diary', row: { id: 'e5e6f7a8-0000-4000-8000-000000000001', user_id: T.A, text: 'GEHEIM-A-Garten-1' } },
          { t: 2, action: 'delete', table: 'garden_diary', id: 'e5e6f7a8-0000-4000-8000-0000000000d2', _hinweis: 'GEHEIM-A-Garten-2' },
        ]));
        T.halten = /garden_diary/;
        const p = gsGardenSync.flushQueue();
        if (!(await T.warteAuf(1))) return { fehlt: 'die Garten-Warteschlange ging nie hinaus' };
        await T.wechsel(true);
        T.frei([{}]);
        await T.warteAuf(1);
        while (T.offen.length) T.frei([]);
        await p; await T.warte(50);
        // nur die Vorgaenge von A (Schreiben); ein GET von B ist dessen eigener Abgleich
        var als = T.log.filter(function (e) { return /garden_diary/.test(e.url) && e.wer === T.B && e.method !== 'GET' && /GEHEIM-A|e5e6f7a8-0000-4000-8000-0000000000/.test(e.url + ' ' + e.body); });
        return { alsB: als.length, erste: als[0] ? als[0].method + ' ' + als[0].url.replace(/^https?:\/\/[^/]+/, '') : '', queue: localStorage.getItem('gs_garden_sync_queue') || '' };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.alsB) f.push('ein Vorgang von A ging nach dem Wechsel mit dem Token von B hinaus (' + r.alsB + '×, zuerst ' + r.erste + ')');
      if (/GEHEIM-A/.test(r.queue)) f.push('die Garten-Warteschlange von A steht nach dem Abmelden wieder im Speicher: ' + r.queue.slice(0, 120));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'erster Vorgang als A unterwegs, Wechsel → keiner als B, gs_garden_sync_queue bleibt geraeumt' };
    },
  },
  {
    name: 'Tor c2 · Wechsel WAEHREND eines Token-Refreshs: die spaete Antwort fuer A schreibt die Sitzung von A nicht ueber die von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async (o) => {
        const T = window.__tor;
        localStorage.setItem('gs_sb_refresh', 'rt-a');
        localStorage.setItem('gs_sb_expires', String(Date.now() + 5000));
        T.halten = /\/auth\/v1\/token/;
        const p = sbFetch('/rest/v1/gs_pruef_tor?r=1', { method: 'GET' });
        if (!(await T.warteAuf(1))) return { fehlt: 'sbFetch hat nicht erneuert — der Fall misst den Refresh nicht' };
        await T.wechsel(true);   // die Schreibwege in sbLogout warten (2,5-s-Rennen) — sie haengen am selben Refresh
        const vorher = _gsPerson();
        T.halten = null;
        T.tokens[o.JA2] = T.A;
        T.frei({ access_token: o.JA2, refresh_token: 'rt-a2', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        while (T.offen.length) T.frei({ error: 'invalid_grant' }, 400);
        const x = await p; await T.warte(100);
        return { vorher, nachher: _gsPerson(), token: localStorage.getItem('gs_sb_token'), x: JSON.stringify(x),
                 alsA2: T.log.filter(function (e) { return /gs_pruef_tor/.test(e.url); }).map(function (e) { return e.wer; }) };
      }, { JA2: JWT_A2 });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.vorher !== B_UID) f.push('B war vor der Antwort nicht angemeldet (' + r.vorher + ') — der Fall misst nichts');
      if (r.nachher !== B_UID) f.push('nach der spaeten Refresh-Antwort ist ' + r.nachher + ' angemeldet statt B (Token ' + r.token + ')');
      if (!/person_gewechselt/.test(r.x)) f.push('sbFetch lieferte ' + r.x.slice(0, 120));
      if (r.alsA2.length) f.push('die Anfrage ging trotzdem hinaus (als ' + r.alsA2.join(',') + ')');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Refresh fuer A haengt, A → B, Antwort danach: B bleibt angemeldet, nichts geht hinaus, ' + r.x };
    },
  },
  {
    name: 'Tor d3 · KI: Kopfzeilen VOR dem Wechsel, Rumpf DANACH · Netzfehler NACH dem Wechsel → beide Male code person_gewechselt',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
        window.gsAboCanUse = function () { return true; };
        const fang = async function (pr) { try { return { text: await pr }; } catch (e) { return { code: e && e.code, msg: e && e.message }; } };
        const out = {};
        T.halten = /ai-proxy/;
        // i · Rumpf erst nach dem Wechsel
        let p = fang(callAI([{ role: 'user', content: 'x' }], 'sys', 50, { retries: 0 }));
        await T.warteAuf(1);
        T.freiLangsam({ content: [{ type: 'text', text: 'GEHEIM-A-Rumpf' }], stop_reason: 'end_turn' });
        await T.warte(60);
        await T.wechsel(true);
        T.rumpf(); out.i = await p;
        await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        // ii · Netzfehler nach dem Wechsel
        p = fang(callAI([{ role: 'user', content: 'x' }], 'sys', 50, { retries: 0 }));
        await T.warteAuf(1);
        await T.wechsel(true);
        while (T.offen.length) { T.reissen(); await T.warte(30); }
        out.ii = await p; out.laufend = window._gsAiLaufend;
        return out;
      });
      const f = [];
      if (!r.i || r.i.code !== 'person_gewechselt') f.push('Rumpf nach dem Wechsel: ' + JSON.stringify(r.i));
      if (!r.ii || r.ii.code !== 'person_gewechselt') f.push('Netzfehler nach dem Wechsel: ' + JSON.stringify(r.ii));
      if (r.laufend !== 0) f.push('_gsAiLaufend ' + r.laufend);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Rumpf nach dem Wechsel und Netzfehler nach dem Wechsel → beide person_gewechselt, Zaehler 0' };
    },
  },
  {
    name: 'Tor f2 · gsCloudSync keepalive (rohes fetch, am Tor vorbei): der Erfolgs-Stempel von A landet nicht im Speicher von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        localStorage.setItem('gs_sync_queue', '[]');
        localStorage.setItem('gs_sync_dirty', JSON.stringify({ plants: Date.now() }));
        localStorage.removeItem('gs_sync_synced_at_plants');
        // Gegenpruefung blob (19.11.2026): ein Blob geht erst hoch, wenn der Abgleich seine Zeile gelesen hat
        // (gsCloudSync._flush) — im Pruefstand scheitert der Start-Abgleich (kein Netz). Der Zustand wird HERGESTELLT.
        window._gsInitialSyncDone = true;
        T.halten = /user_plants/;
        const p = gsCloudSync.flushNow();
        if (!(await T.warteAuf(1))) return { fehlt: 'der keepalive-Push ging nie hinaus' };
        await T.wechsel(true);
        T.frei([]);
        await p; await T.warte(50);
        return { stempel: localStorage.getItem('gs_sync_synced_at_plants'), dirty: localStorage.getItem('gs_sync_dirty') || '' };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.stempel) return { ok: false, warum: 'gs_sync_synced_at_plants von A steht nach dem Wechsel im Speicher von B: ' + r.stempel };
      return { ok: true, info: 'keepalive als A, Wechsel, 200 → kein Stempel bei B (dirty: ' + (r.dirty || 'leer') + ')' };
    },
  },
  {
    name: 'Tor g2 · gsUploadImage (rohes fetch an den Storage): Antwort nach dem Wechsel → null statt der Adresse im Ordner von A',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /\/storage\/v1\/object\//;
        const ohne = gsUploadImage(T.jpeg(), 'scan-images', 'jpg', 'tor-g2-ohne');
        await T.warteAuf(1); T.frei({ Key: 'x' });
        const url0 = await ohne;
        const p = gsUploadImage(T.jpeg(), 'scan-images', 'jpg', 'tor-g2');
        if (!(await T.warteAuf(1))) return { fehlt: 'gsUploadImage hat nie hochgeladen' };
        await T.wechsel(true);
        T.frei({ Key: 'x' });
        return { url0: url0, url: await p };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (!r.url0 || r.url0.indexOf(A_UID) < 0) return { ok: false, warum: 'ohne Wechsel keine Adresse: ' + r.url0 };
      if (r.url !== null) return { ok: false, warum: 'nach dem Wechsel kommt die Adresse im Ordner von A bei B an: ' + r.url };
      return { ok: true, info: 'ohne Wechsel Adresse · mit Wechsel null' };
    },
  },
  {
    name: 'Tor h2 · Waechter der Folge: eine Korrektur, deren Antwort nach dem Wechsel kommt, wird NICHT fuer B eingereiht (Scan-Ergebnis und Verlauf)',
    // Gegen den Stand vor dem Tor gruen (die Antwort hiess dort „ok"); er haelt fest, dass der neue
    // Fehler 'gewechselt' an den zwei Aufrufern nicht in _gsKorrekturEinreihen faellt.
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        const feld = function (id, v) { var el = document.getElementById(id); if (!el) { el = document.createElement('input'); el.id = id; document.body.appendChild(el); } el.value = v; };
        localStorage.removeItem('gs_scan_corrections_queue');
        // 1 · gsSubmitScanMistake (das Ergebnis auf dem Bildschirm)
        _lastScanResult = { name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: 80, _scanId: 'scan-h2' };
        feld('scan-fix-name', 'GEHEIM-A-Korrigiert'); feld('scan-fix-latin', ''); feld('scan-fix-note', '');
        T.halten = /scan_corrections/;
        let p = gsSubmitScanMistake();
        if (!(await T.warteAuf(1))) return { fehlt: 'gsSubmitScanMistake hat nie gesendet' };
        await T.wechsel(true);
        T.frei([{ id: 1 }]); await p; await T.warte(50);
        const q1 = localStorage.getItem('gs_scan_corrections_queue') || '';
        // 2 · gsScanHistoryReportWrong (der Verlauf) — wieder als A
        await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        localStorage.setItem('gs_scan_history', JSON.stringify([{ id: 'h2-v', name: 'Löwenzahn', ts: Date.now(), conf: 80 }]));
        window.gsPromptModal = function () { return Promise.resolve('GEHEIM-A-Verlauf'); };
        p = gsScanHistoryReportWrong(0);
        if (!(await T.warteAuf(1))) return { fehlt: 'gsScanHistoryReportWrong hat nie gesendet' };
        await T.wechsel(true);
        T.frei([{ id: 2 }]); await p; await T.warte(50);
        return { q1: q1, q2: localStorage.getItem('gs_scan_corrections_queue') || '', hist: localStorage.getItem('gs_scan_history') || '' };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (/GEHEIM-A/.test(r.q1)) f.push('gsSubmitScanMistake reihte die Korrektur von A fuer B ein: ' + r.q1.slice(0, 100));
      if (/GEHEIM-A/.test(r.q2)) f.push('gsScanHistoryReportWrong reihte die Korrektur von A fuer B ein: ' + r.q2.slice(0, 100));
      if (/GEHEIM-A/.test(r.hist)) f.push('der Verlauf von B traegt die Korrektur von A');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'beide Aufrufer: Antwort nach dem Wechsel → nichts eingereiht, nichts umbenannt' };
    },
  },
  {
    name: 'Tor j · Abo-Portal (rohes fetch, am Tor vorbei): das Portal von A wird nach dem Wechsel nicht fuer B geoeffnet; ohne Wechsel schon',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /stripe-portal/;
        const toasts = []; window.gsToast = function (m) { toasts.push(typeof m === 'object' ? JSON.stringify(m) : String(m)); };
        let f = T.fenster();
        let p = gsOpenBillingPortal();
        if (!(await T.warteAuf(1))) return { fehlt: 'das Portal wurde nie angefragt' };
        T.frei({ url: 'https://billing.stripe.com/p/session/OHNE-WECHSEL' }); await p;
        const ohne = f.location.href;
        f = T.fenster();
        p = gsOpenBillingPortal();
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei({ url: 'https://billing.stripe.com/p/session/GEHEIM-A-Portal' }); await p;
        return { ohne: ohne, mit: f.location.href, zu: f.closed, ort: location.href, toasts: toasts };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (!/OHNE-WECHSEL/.test(r.ohne)) return { ok: false, warum: 'ohne Wechsel wurde das Portal nicht geoeffnet (' + r.ohne + ')' };
      if (/GEHEIM-A/.test(r.mit + ' ' + r.ort)) return { ok: false, warum: 'das Portal von A wurde nach dem Wechsel geoeffnet: ' + (r.mit || r.ort) };
      if (!r.zu) return { ok: false, warum: 'das Ladefenster blieb offen' };
      // Gegenpruefung (19.11.2026): die Meldungen wurden gesammelt und nie angesehen — B bekam
      // „Stripe-Portal nicht verfuegbar … Bitte wende dich an info@greenscan.ch".
      const fremd = r.toasts.filter(function (t) { return /nicht verf|info@greenscan|Support/i.test(t); });
      if (fremd.length) return { ok: false, warum: 'B bekam eine Fehlermeldung zum Portal von A: ' + fremd[0].slice(0, 140) };
      return { ok: true, info: 'ohne Wechsel Portal · mit Wechsel: Fenster zu, nichts geoeffnet, keine Meldung' };
    },
  },
  {
    name: 'Tor k · Checkout: nach dem Wechsel keine Kasse von A fuer B und kein „Support kontaktieren?"; ohne Wechsel die Kasse',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor; T.halten = /stripe-checkout/;
        let fragen = 0; window.gsConfirmModal = function () { fragen++; return Promise.resolve(false); };
        window.gsToast = function () {};
        let f = T.fenster();
        let p = gsStartCheckout('pro_monthly');
        if (!(await T.warteAuf(1))) return { fehlt: 'der Checkout wurde nie angefragt' };
        T.frei({ url: 'https://checkout.stripe.com/c/OHNE-WECHSEL' }); await p;
        const ohne = f.location.href;
        f = T.fenster();
        p = gsStartCheckout('pro_monthly');
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei({ url: 'https://checkout.stripe.com/c/GEHEIM-A-Kasse' }); await p;
        const mit = f.location.href, zu = f.closed, fragenMit = fragen;
        // Wechsel schon waehrend der Preis-Abfrage (sbFetch): keine Kasse, keine Rueckfrage
        await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        fragen = 0; T.halten = /stripe_prices/;
        const vorher = T.log.filter(function (e) { return /stripe-checkout/.test(e.url); }).length;
        f = T.fenster();
        p = gsStartCheckout('pro_monthly');
        await T.warteAuf(1);
        await T.wechsel(true);
        T.halten = null;
        T.frei([{ id: 'price_tor', metadata: { lookup_key: 'pro_monthly' } }]); await p;
        return { ohne: ohne, mit: mit, zu: zu, fragen: fragenMit, ort: location.href,
                 preisFragen: fragen, preisKasse: T.log.filter(function (e) { return /stripe-checkout/.test(e.url); }).length - vorher };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (!/OHNE-WECHSEL/.test(r.ohne)) f.push('ohne Wechsel keine Kasse (' + r.ohne + ')');
      if (/GEHEIM-A/.test(r.mit + ' ' + r.ort)) f.push('die Kasse von A wurde nach dem Wechsel geoeffnet: ' + (r.mit || r.ort));
      if (r.fragen) f.push('B bekam ' + r.fragen + '× „Checkout fehlgeschlagen — Support kontaktieren?"');
      if (r.preisKasse) f.push('Wechsel waehrend der Preis-Abfrage: der Checkout wurde trotzdem angefragt (' + r.preisKasse + '×)');
      if (r.preisFragen) f.push('Wechsel waehrend der Preis-Abfrage: B bekam ' + r.preisFragen + '× „Checkout fehlgeschlagen — Support kontaktieren?"');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel Kasse · mit Wechsel: nichts geoeffnet, keine Rueckfrage, Fenster ' + (r.zu ? 'zu' : 'offen') };
    },
  },
  {
    name: 'Tor l · Stripe-Onboarding fuer Verkaeufer: nach dem Wechsel fuehrt der Link von A nicht B in dessen Verkaeuferkonto',
    lauf: async (seite, h) => {
      // Gegenrichtung zuerst: ohne Wechsel geht die Seite zum Onboarding (die Anfrage dorthin
      // bricht der Pruefstand ab — gezaehlt wird, dass der Browser sie stellen WOLLTE).
      await seite.evaluate(STELLEN);
      h.anfragen();
      try {
        await seite.evaluate(async () => {
          const T = window.__tor; T.halten = /stripe-create-connect-account/;
          window.gsToast = function () {};
          const p = gsMarketplaceStartConnect();
          await T.warteAuf(1);
          T.frei({ ok: true, onboarding_url: 'https://connect.stripe.com/setup/OHNE-WECHSEL' }); await p;
          await T.warte(300);
        });
      } catch (e) { /* die Navigation nimmt den Kontext mit */ }
      await new Promise(res => setTimeout(res, 300));
      const ohne = h.anfragen().filter(u => /connect\.stripe\.com\/setup\/OHNE-WECHSEL/.test(u)).length;
      seite = await h.frisch();
      if (!ohne) return { ok: false, warum: 'ohne Wechsel ging die Seite nicht zum Onboarding — der Fall misst nichts' };
      let r;
      await seite.evaluate(STELLEN);
      try {
        r = await seite.evaluate(async () => {
          const T = window.__tor; T.halten = /stripe-create-connect-account/;
          window.gsToast = function () {};
          const p = gsMarketplaceStartConnect();
          if (!(await T.warteAuf(1))) return { fehlt: 'das Onboarding wurde nie angefragt' };
          await T.wechsel(true);
          T.frei({ ok: true, onboarding_url: 'https://connect.stripe.com/setup/GEHEIM-A-Onboarding' }); await p;
          await T.warte(100);
          return { ort: location.href };
        });
      } catch (e) { r = { navigiert: String(e.message).split('\n')[0] }; }
      const url = seite.url();
      await h.frisch();
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.navigiert || /GEHEIM-A|stripe\.com/.test(url + ' ' + (r.ort || ''))) return { ok: false, warum: 'nach dem Wechsel ging die Seite zum Onboarding von A (' + (r.navigiert || url) + ')' };
      return { ok: true, info: 'Antwort fuer A nach dem Wechsel: die Seite bleibt, kein Onboarding fuer B' };
    },
  },
  {
    name: 'Tor m · Waechter der Folge: der Scanner (analyzeImage) ueber das ECHTE callVisionAI — nach dem Wechsel keine Fehlerkarte fuer B und kein Foto von A fuer „Nochmal versuchen"',
    // Gegen den Stand vor dem Tor gruen (der Erfolgszweig fragte die Person schon, v33.61). Seit
    // dem Tor wirft callVisionAI — dieser Fall haelt fest, dass der Fehlerzweig ebenso fragt.
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
        window.gsAboCanUse = function () { return true; };
        window.stopCamera = function () {}; window.gsScanStatusShow = function () {}; window.gsStopScanStatus = function () {}; window.gsAddToScanHistory = function () {};
        window._gsScanDHash = async function () { return 'hash-tor-m'; }; window._gsScanCacheGet = async function () { return null; }; window._gsScanCachePut = function () {};
        const eingereiht = []; window.gsQueueOffline = async function (t, d) { eingereiht.push(d && d.name); return true; };
        window._gsLastScanPayload = null;
        T.halten = /ai-proxy/;
        const foto = T.jpeg();
        const lauf = analyzeImage(foto, 'image/jpeg', '', null, { trotzdem: true });
        if (!(await T.warteAuf(1))) return { fehlt: 'der Scanner hat die KI nie gefragt' };
        await T.wechsel(true);
        const sr = document.getElementById('scan-result');
        const vorher = sr ? sr.innerHTML : '';
        T.frei({ content: [{ type: 'text', text: JSON.stringify({ name: 'GEHEIM-A-Scan', latin: 'Bellis perennis', confidence: 90, toxicity: 0, edible: true, alternatives: [] }) }], stop_reason: 'end_turn' });
        await lauf; await T.warte(200);
        const nachher = sr ? sr.innerHTML : '';
        return { neu: nachher !== vorher ? nachher.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 160) : '',
                 payload: !!(window._gsLastScanPayload && window._gsLastScanPayload.b64), eingereiht: eingereiht,
                 ergebnis: (typeof _lastScanResult !== 'undefined' && _lastScanResult) ? _lastScanResult.name : null };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      const f = [];
      if (r.neu) f.push('nach dem Wechsel zeichnete der Scanner fuer B: „' + r.neu + '"');
      if (r.payload) f.push('das Foto von A liegt fuer „Nochmal versuchen" bereit (_gsLastScanPayload)');
      if (r.eingereiht.length) f.push('eingereiht: ' + JSON.stringify(r.eingereiht));
      if (r.ergebnis && /GEHEIM-A/.test(r.ergebnis)) f.push('das Ergebnis von A steht als _lastScanResult da');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Antwort fuer A nach dem Wechsel: keine Karte, kein gemerktes Foto, nichts eingereiht' };
    },
  },
  // ── Gegenpruefung (19.11.2026): Wege, die das Tor NICHT sah ─────────────────────────────
  // Das Tor in sbFetch faengt eine Antwort ab, die nach dem Wechsel ankommt. Es sieht keine
  // Anfrage, die erst NACH dem Wechsel losgeht (sie gehoert dann B), und keinen Weg mit rohem
  // fetch. Die Faelle unten fahren je einen solchen Weg, der Daten von A in das Konto von B
  // traegt oder vor B zeigt — jeder gegen den Stand b41733a rot.
  {
    name: 'Tor n · KI-Garten-Scan (rohes fetch an garden-scan-analyze): nach dem Wechsel speichert der Client den Plan von A (mit GPS) nicht in „Meine Plaene" von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        const toasts = []; window.gsToast = function (m) { toasts.push(typeof m === 'object' ? JSON.stringify(m) : String(m)); };
        window.gsGetRegionContext = async function () { return null; };
        const antwort = { ok: true, analysis: { recommended_plants: [{ name: 'GEHEIM-A-Tomate' }] }, plan_title: 'GEHEIM-A-Plan' };
        const start = function () {
          window._gsAsyncLocks = {};
          window._gsGardenScan = { photos: [{ b64: T.jpeg() }], metadata: { gps: { lat: 47.123456, lng: 8.654321 }, plan_title: 'GEHEIM-A-Plan' }, busy: false };
          return gsGardenScanSubmit();
        };
        T.halten = /garden-scan-analyze/;
        // Gegenrichtung: ohne Wechsel legt der Client den Plan an (als A)
        let p = start();
        if (!(await T.warteAuf(1))) return { fehlt: 'der Garten-Scan ging nie hinaus' };
        T.frei(antwort); await p; await T.warte(100);
        const ohne = T.log.filter(function (e) { return /\/rest\/v1\/garden_plans/.test(e.url) && e.method === 'POST'; }).map(function (e) { return e.wer; });
        // mit Wechsel waehrend der Analyse
        toasts.length = 0;
        const n0 = T.log.length;
        p = start();
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei(antwort); await p; await T.warte(150);
        const nach = T.log.slice(n0).filter(function (e) { return /garden_plans/.test(e.url) && e.method !== 'GET'; });
        return { ohne: ohne, alsB: nach.filter(function (e) { return e.wer === T.B; }).length, gps: nach.some(function (e) { return e.wer === T.B && /47\.123456/.test(e.body); }), toasts: toasts };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.ohne.indexOf(A_UID) < 0) return { ok: false, warum: 'ohne Wechsel legte der Client keinen Plan an (' + JSON.stringify(r.ohne) + ') — der Fall misst nichts' };
      const f = [];
      if (r.alsB) f.push('der Plan von A ging nach dem Wechsel ' + r.alsB + '× mit dem Token von B an garden_plans' + (r.gps ? ' (samt GPS 47.123456)' : ''));
      const gesagt = r.toasts.filter(function (t) { return /gespeichert|fehlgeschlagen/i.test(t); });
      if (gesagt.length) f.push('B bekam eine Meldung ueber den Scan von A: ' + gesagt[0].slice(0, 120));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel Plan als A · mit Wechsel: kein Schreibvorgang als B, keine Meldung' };
    },
  },
  {
    name: 'Tor o · Funde nachladen (gsMapFinds._uploadLocalOnly): Wechsel mitten im Hochladen → kein Fund von A (mit GPS) im Konto von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.gsToast = function () {};
        const fund = function (i) { return { id: 'lok-' + i, name: 'GEHEIM-A-Fund-' + i, cat: 'pilz', lat: 47.1 + i / 1000, lng: 8.5, date: Date.now(), is_private: true }; };
        T.halten = /map_user_finds/;
        // Gegenrichtung: ohne Wechsel geht der Fund als A hinaus
        let p = gsMapFinds._uploadLocalOnly([fund(0)]);
        if (!(await T.warteAuf(1))) return { fehlt: 'der Fund ging nie hinaus' };
        T.frei([{ id: 'c-0' }]); await p;
        const ohne = T.log.filter(function (e) { return /map_user_finds/.test(e.url) && e.method === 'POST'; }).map(function (e) { return e.wer; });
        // mit Wechsel nach dem ersten von drei Funden
        p = gsMapFinds._uploadLocalOnly([fund(1), fund(2), fund(3)]);
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei([{ id: 'c-1' }]);
        for (let k = 0; k < 4; k++) { await T.warte(250); while (T.offen.length) T.frei([{ id: 'c-x' }]); }
        await p;
        const alsB = T.log.filter(function (e) { return /map_user_finds/.test(e.url) && e.method === 'POST' && e.wer === T.B && /GEHEIM-A-Fund/.test(e.body); });
        let uid = null; try { uid = JSON.parse(alsB[0].body).user_id; } catch (_) {}
        return { ohne: ohne, alsB: alsB.length, uid: uid };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.ohne.indexOf(A_UID) < 0) return { ok: false, warum: 'ohne Wechsel ging der Fund nicht als A hinaus (' + JSON.stringify(r.ohne) + ') — der Fall misst nichts' };
      if (r.alsB) return { ok: false, warum: r.alsB + ' Fund(e) von A gingen nach dem Wechsel mit dem Token von B an map_user_finds (user_id ' + r.uid + ')' };
      return { ok: true, info: 'ohne Wechsel Fund als A · mit Wechsel: kein weiterer Fund von A als B' };
    },
  },
  {
    name: 'Tor p · Fotos nachladen (gsRetryPhotoUploads): Wechsel mitten im Nachladen → kein Foto von A im Ordner von B, der Verlauf von A nicht im Speicher von B',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        const bild = 'data:image/jpeg;base64,' + T.jpeg();
        localStorage.setItem('gs_scan_history', JSON.stringify([1, 2, 3].map(function (i) { return { id: 'rp-' + i, name: 'GEHEIM-A-Scan-' + i, ts: Date.now() - i * 1000, photo: bild }; })));
        T.halten = /\/storage\/v1\/object\/scan-images/;
        const p = gsRetryPhotoUploads();
        if (!(await T.warteAuf(1))) return { fehlt: 'das Nachladen ging nie hinaus' };
        const erstesAls = T.offen[0].e.wer;
        T.frei({ Key: 'eins' });                     // das erste Foto kommt als A an
        if (!(await T.warteAuf(1))) return { fehlt: 'das zweite Foto ging nie hinaus' };
        await T.wechsel(true);
        const geraeumt = localStorage.getItem('gs_scan_history');
        T.frei({ Key: 'zwei' });
        for (let k = 0; k < 4; k++) { await T.warte(300); while (T.offen.length) T.frei({ Key: 'x' }); }
        const fixed = await p;
        return {
          erstesAls: erstesAls, geraeumt: geraeumt, fixed: fixed,
          alsB: T.log.filter(function (e) { return /\/storage\/v1\/object\/scan-images\//.test(e.url) && e.wer === T.B; }).map(function (e) { return e.url.replace(/^https?:\/\/[^/]+/, ''); }),
          hist: localStorage.getItem('gs_scan_history') || '',
        };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (r.erstesAls !== A_UID) return { ok: false, warum: 'das erste Foto ging nicht als A hinaus (' + r.erstesAls + ') — der Fall misst nichts' };
      if (/GEHEIM-A/.test(r.geraeumt || '')) return { ok: false, warum: 'sbLogout hat den Verlauf nicht geraeumt — der Fall misst nichts' };
      const f = [];
      if (r.alsB.length) f.push(r.alsB.length + ' Foto(s) von A gingen mit dem Token von B in den Speicher (' + r.alsB[0] + ')');
      if (/GEHEIM-A/.test(r.hist)) f.push('der Scan-Verlauf von A steht im Speicher von B: ' + r.hist.slice(0, 100));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'erstes Foto als A, Wechsel → kein Upload als B, Verlauf von B bleibt leer (Rueckgabe ' + r.fixed + ')' };
    },
  },
  {
    name: 'Tor q · Wissens-Cache (Huelle um sbFetch): die Antwort person_gewechselt wird nicht zu Treffern aus dem Cache — ohne Wechsel antwortet der Cache bei Netzfehler weiter',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.gsKnowledgeSearch = async function () { return [{ type: 'species', item: { id: 'k1', name: 'Cache-Treffer', description: 'aus dem Cache' }, score: 80 }]; };
        const rumpf = JSON.stringify({ p_q: 'GEHEIM-A-Suche', p_lim: 5 });
        T.halten = /fn_knowledge_search/;
        // Gegenrichtung: Netzfehler ohne Wechsel → der Cache antwortet
        let p = sbFetch('/rest/v1/rpc/fn_knowledge_search', { method: 'POST', body: rumpf });
        if (!(await T.warteAuf(1))) return { fehlt: 'die Suche ging nie hinaus' };
        T.reissen();
        const netz = await p;
        // mit Wechsel
        p = sbFetch('/rest/v1/rpc/fn_knowledge_search', { method: 'POST', body: rumpf });
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei([{ kind: 'species', title: 'GEHEIM-A-Treffer' }]);
        const x = await p;
        return { netz: JSON.stringify(netz), x: JSON.stringify(x), pg: (typeof _gsPersonGewechselt === 'function') ? _gsPersonGewechselt(x) : false };
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (!/_from_cache/.test(r.netz)) return { ok: false, warum: 'ohne Wechsel antwortet der Cache bei Netzfehler nicht mehr: ' + r.netz.slice(0, 120) };
      if (!r.pg) return { ok: false, warum: 'nach dem Wechsel kam statt person_gewechselt: ' + r.x.slice(0, 140) };
      return { ok: true, info: 'Netzfehler ohne Wechsel → Cache · Wechsel → person_gewechselt' };
    },
  },
  {
    name: 'Tor r · Pflanzendoktor, Schaedling, Pilz (rohes fetch an die KI-Functions): nach dem Wechsel kein Ergebnis von A vor B, keine Pilz-Warnung; Wechsel waehrend des Refreshs → das Foto von A geht nicht mit dem Token von B hinaus',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.showProfileToast = function () {};
        const kasten = function (id) { var el = document.getElementById(id); if (!el) { el = document.createElement('div'); el.id = id; document.body.appendChild(el); } el.innerHTML = ''; return el; };
        const foto = 'data:image/jpeg;base64,' + T.jpeg();
        const pilz = { mushroom: { name_de: 'GEHEIM-A-Pilz', edibility: 'toedlich' }, matched_slug: 'geheim-a', confidence: 92, lookalikes: [] };
        const weg = function () { var o = document.getElementById('gs-mushroom-danger'); if (o) o.remove(); };
        const out = {};
        // Gegenrichtung: ohne Wechsel zeigt der Pilz-Scan die Warnung
        weg(); kasten('mushroom-result'); window._gsMushroomPhotoB64 = foto;
        T.halten = /mushroom-identify/;
        let p = gsMushroomRunScan();
        if (!(await T.warteAuf(1))) return { fehlt: 'der Pilz-Scan ging nie hinaus' };
        T.frei(pilz); await p; await T.warte(50);
        out.ohne = !!document.getElementById('gs-mushroom-danger');
        weg();
        // mit Wechsel waehrend der Anfrage — je Weg
        const wege = [
          { name: 'Pilz', halt: /mushroom-identify/, box: 'mushroom-result', setz: function () { window._gsMushroomPhotoB64 = foto; }, lauf: function () { return gsMushroomRunScan(); }, antwort: pilz },
          { name: 'Doktor', halt: /plant-doctor-diagnose/, box: 'doctor-result', setz: function () { window._gsDoctorPhotoB64 = foto; }, lauf: function () { return gsRunDiagnose(); }, antwort: { ok: true, diagnosis: { hypotheses: [{ name: 'GEHEIM-A-Diagnose', confidence: 0.8, reason: 'x' }], urgency: 'high' }, treatment_plan: {} } },
          { name: 'Schaedling', halt: /pest-identify/, box: 'pest-result', setz: function () { window._gsPestPhotoB64 = foto; }, lauf: function () { return gsPestRunScan(); }, antwort: { pest: { common_name_de: 'GEHEIM-A-Laus' }, confidence: 85, reasoning: 'GEHEIM-A-Grund', severity: 'hoch' } },
        ];
        out.gezeigt = [];
        for (const w of wege) {
          await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
          const el = kasten(w.box); w.setz(); T.halten = w.halt;
          p = w.lauf();
          if (!(await T.warteAuf(1))) { out.gezeigt.push(w.name + ': ging nie hinaus'); continue; }
          await T.wechsel(true);
          T.frei(w.antwort); await p; await T.warte(80);
          if (/GEHEIM-A/.test(el.innerHTML)) out.gezeigt.push(w.name + ' zeigt das Ergebnis von A');
          if (document.getElementById('gs-mushroom-danger')) { out.gezeigt.push(w.name + ': Vollbild-Warnung „toedlich" fuer B'); weg(); }
        }
        // Wechsel WAEHREND des Token-Refreshs (vor dem Senden): der Doktor speichert mit save_history in den Verlauf des Tokens
        await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        localStorage.setItem('gs_sb_refresh', 'rt-a'); localStorage.setItem('gs_sb_expires', String(Date.now() + 5000));
        kasten('doctor-result'); window._gsDoctorPhotoB64 = foto;
        T.halten = /\/auth\/v1\/token/;
        p = gsRunDiagnose();
        if (!(await T.warteAuf(1))) { out.refresh = 'der Doktor hat nicht erneuert — der Fall misst den Refresh nicht'; }
        else {
          await T.wechsel(true);
          T.halten = null;
          while (T.offen.length) T.frei({ access_token: 'pruef.stand.token', refresh_token: 'rt-a2', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
          await p; await T.warte(80);
          out.refreshAlsB = T.log.filter(function (e) { return /plant-doctor-diagnose/.test(e.url) && e.wer === T.B; }).length;
        }
        return out;
      });
      if (r.fehlt) return { ok: false, warum: r.fehlt };
      if (!r.ohne) return { ok: false, warum: 'ohne Wechsel zeigte der Pilz-Scan keine Warnung — der Fall misst nichts' };
      const f = [].concat(r.gezeigt);
      if (r.refresh) f.push(r.refresh);
      if (r.refreshAlsB) f.push('Wechsel waehrend des Refreshs: das Foto von A ging ' + r.refreshAlsB + '× mit dem Token von B an plant-doctor-diagnose (save_history)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel Warnung · mit Wechsel: Pilz, Doktor, Schaedling zeigen nichts · Wechsel im Refresh: nichts geht als B hinaus' };
    },
  },
  {
    name: 'Tor s · KI-Rueckfall und Wiederholung nach einem await: nach dem Wechsel geht die Frage von A weder direkt an Anthropic noch ein zweites Mal an den Proxy',
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.gsAboCanUse = function () { return true; };
        window.getApiConfig = function () { return { provider: 'anthropic', key: 'sk-ant-pruef', source: 'global' }; };
        const fang = async function (pr) { try { return { text: await pr }; } catch (e) { return { code: e && e.code, msg: e && e.message }; } };
        const kiAntwort = { content: [{ type: 'text', text: 'DIREKT-OHNE-WECHSEL' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } };
        const direkt = function () { return T.log.filter(function (e) { return /api\.anthropic\.com/.test(e.url); }).length; };
        const proxy = function () { return T.log.filter(function (e) { return /ai-proxy/.test(e.url); }).length; };
        const out = {};
        T.halten = /ai-proxy|api\.anthropic\.com/;
        // Gegenrichtung: Proxy faellt aus (503), ohne Wechsel → einmal direkt, Antwort kommt an
        let d0 = direkt();
        let p = fang(callAI([{ role: 'user', content: 'x' }], 'sys', 50, { retries: 0 }));
        await T.warteAuf(1); T.frei({ error: { message: 'down' } }, 503);
        await T.warteAuf(1); T.frei(kiAntwort);
        out.ohne = await p; out.ohneDirekt = direkt() - d0;
        // s1 · Proxy faellt aus, aber erst nach dem Wechsel
        d0 = direkt();
        p = fang(callAI([{ role: 'user', content: 'GEHEIM-A-Frage' }], 'sys', 50, { retries: 0 }));
        await T.warteAuf(1);
        await T.wechsel(true);
        T.frei({ error: { message: 'down' } }, 503);
        await T.warte(200); while (T.offen.length) T.frei(kiAntwort);
        out.s1 = await p; out.s1Direkt = direkt() - d0;
        // s2 · Wiederholung nach 503 (Wartezeit), Wechsel in der Wartezeit
        await sbLogout(); sbSaveSession({ access_token: 'pruef.stand.token', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
        window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
        const p0 = proxy();
        p = fang(callAI([{ role: 'user', content: 'GEHEIM-A-Frage-2' }], 'sys', 50, { retries: 1 }));
        await T.warteAuf(1); T.frei({ error: { message: 'busy' } }, 503);
        await T.warte(20);
        await T.wechsel(true);
        for (let k = 0; k < 8; k++) { await T.warte(250); while (T.offen.length) T.frei({ error: { message: 'busy' } }, 503); }
        out.s2 = await p; out.s2Proxy = proxy() - p0;
        return out;
      });
      const f = [];
      if (!r.ohne || r.ohne.text !== 'DIREKT-OHNE-WECHSEL' || r.ohneDirekt !== 1) f.push('ohne Wechsel kein Rueckfall auf den Direktweg (' + JSON.stringify(r.ohne) + ', ' + r.ohneDirekt + '× direkt) — der Fall misst nichts');
      if (r.s1Direkt) f.push('nach dem Wechsel ging die Frage von A ' + r.s1Direkt + '× direkt an Anthropic (mit dem Schluessel von A)');
      if (!r.s1 || r.s1.code !== 'person_gewechselt') f.push('Rueckfall nach dem Wechsel: ' + JSON.stringify(r.s1));
      if (r.s2Proxy > 1) f.push('nach dem Wechsel ging die Frage von A ein zweites Mal an den Proxy (' + r.s2Proxy + '× insgesamt)');
      if (!r.s2 || r.s2.code !== 'person_gewechselt') f.push('Wiederholung nach dem Wechsel: ' + JSON.stringify(r.s2));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel 1× direkt · nach dem Wechsel kein Direktweg und keine Wiederholung, beide person_gewechselt' };
    },
  },
  {
    name: 'Tor t · Wechsel WAEHREND des Token-Refreshs vor einem rohen fetch: weder Kasse, Portal, Verkaeufer-Onboarding noch Inserat gehen mit dem Token von B hinaus',
    // Die Zahlungswege (Tor j–l) fragen die Person erst NACH der Antwort. _gsFreshToken ist ein
    // await davor: wechselt die Person dort, liest der Weg danach das Token von B — und die
    // Function legt fuer B etwas an (Checkout-Kunde, Connect-Konto, Inserat mit den Kontaktdaten von A).
    lauf: async (seite, h) => {
      const r = await fall(seite, h, async () => {
        const T = window.__tor;
        window.gsToast = function () {}; window.showProfileToast = function () {};
        window.gsConfirmModal = function () { return Promise.resolve(false); };
        const feld = function (id, v) { var el = document.getElementById(id); if (!el) { el = document.createElement('input'); el.id = id; document.body.appendChild(el); } el.value = v; };
        // Ein Token von A, dessen JWT-exp in 30 s ablaeuft, waehrend gs_sb_expires weit weg liegt:
        // so erneuert NUR _gsFreshToken (vor dem rohen fetch), nicht sbFetch davor (dort steht das Tor).
        const b64u = function (o) { return btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); };
        const jwtA = 'eyJhbGciOiJIUzI1NiJ9.' + b64u({ sub: 'a', exp: Math.floor(Date.now() / 1000) + 30 }) + '.c2ln';
        T.tokens[jwtA] = T.A;
        const alsA = async function () {
          await sbLogout();
          sbSaveSession({ access_token: jwtA, refresh_token: 'rt-a', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
          localStorage.setItem('gs_sb_refresh', 'rt-a');
        };
        const wege = [
          { name: 'Kasse', ziel: /stripe-checkout/, lauf: function () { T.fenster(); return gsStartCheckout('pro_monthly'); } },
          { name: 'Portal', ziel: /stripe-portal/, lauf: function () { T.fenster(); return gsOpenBillingPortal(); } },
          { name: 'Verkaeufer-Onboarding', ziel: /stripe-create-connect-account/, lauf: function () { window._gsAsyncLocks = {}; return gsMarketplaceStartConnect(); } },
          { name: 'Inserat', ziel: /marketplace-publish/, lauf: function () {
              localStorage.setItem('gs_nl_cat', 'gemuese'); localStorage.setItem('gs_nl_pmode', 'gratis');
              feld('nl-title', 'GEHEIM-A-Inserat'); feld('nl-price', ''); feld('nl-region', 'ZH'); feld('nl-desc', 'x'); feld('nl-contact', 'GEHEIM-A-Kontakt');
              window._gsNlPhotos = [];
              return saveListing();
            } },
        ];
        const out = { alsB: [], nieErneuert: [], ohneA: [] };
        for (const w of wege) {
          // Gegenrichtung: derselbe Refresh OHNE Wechsel — danach geht die Anfrage als A hinaus
          await alsA();
          T.halten = /\/auth\/v1\/token/;
          let p0 = w.lauf();
          if (await T.warteAuf(1)) {
            T.halten = null;
            while (T.offen.length) T.frei({ access_token: jwtA, refresh_token: 'rt-a1', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
          }
          T.halten = null;
          try { await p0; } catch (_) {}
          await T.warte(80);
          if (!T.log.some(function (e) { return w.ziel.test(e.url) && e.wer === T.A; })) out.ohneA.push(w.name);
          await alsA();
          T.halten = /\/auth\/v1\/token/;
          const p = w.lauf();
          if (!(await T.warteAuf(1))) { out.nieErneuert.push(w.name); T.halten = null; try { await p; } catch (_) {} continue; }
          await T.wechsel(true);
          T.halten = null;
          while (T.offen.length) T.frei({ access_token: jwtA, refresh_token: 'rt-a2', expires_in: 3600, user: { id: T.A, email: 'pruefstand@example.invalid', user_metadata: {} } });
          try { await p; } catch (_) {}
          await T.warte(80);
          const n = T.log.filter(function (e) { return w.ziel.test(e.url) && e.wer === T.B; }).length;
          if (n) out.alsB.push(w.name + ' ' + n + '×');
        }
        return out;
      });
      const f = [];
      if (r.nieErneuert.length) f.push('kein Refresh vor dem Senden bei: ' + r.nieErneuert.join(', ') + ' — der Fall misst dort nichts');
      if (r.ohneA.length) f.push('ohne Wechsel ging nach dem Refresh nichts als A hinaus: ' + r.ohneA.join(', '));
      if (r.alsB.length) f.push('nach dem Wechsel im Refresh ging mit dem Token von B hinaus: ' + r.alsB.join(' · '));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Kasse, Portal, Onboarding, Inserat: ohne Wechsel nach dem Refresh als A · Wechsel im Refresh → nichts geht als B hinaus' };
    },
  },
  // ── Gruppe ki-wege (19.11.2026): die 19 KI-Funktionen ohne Personen-Vergleich ─────────────
  {
    name: 'KI a · Fehlerkarten: Quiz-Erklaerung, Galerie-Vergleich, Pflegeberatung, Diagnose, Garten-KI, Pflanzendoktor — nach dem Wechsel keine Karte „Konto gewechselt" fuer B, kein haengender Knopf',
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const foto = 'data:image/jpeg;base64,' + T.jpeg();
        const wege = [
          { name: 'Quiz (dqAskKIExplain)', antwort: T.ki('ERGEBNIS-A Erklaerung'),
            vor: function () { T.kasten('dq-question').textContent = 'GEHEIM-A-Frage'; var b = T.kasten('dq-explain-btn', 'button'); b.textContent = '🤖 KI erklärt'; b.disabled = false; var k = T.kasten('dq-expl-block'); k.innerHTML = ''; k.style.display = 'none'; },
            lauf: function () { return dqAskKIExplain(); }, box: function () { return document.getElementById('dq-expl-block'); },
            messe: function () { var b = document.getElementById('dq-explain-btn'); return (b && b.disabled && /denkt/.test(b.textContent)) ? { warum: 'der Knopf haengt auf „' + b.textContent + '"' } : null; } },
          { name: 'Galerie (gsGalCompareGrowth)', antwort: T.ki('{"growth_pct":12,"new_leaves":2,"color_health":"besser","summary":"ERGEBNIS-A","highlights":[],"concerns":[]}'),
            vor: function () { window._gsGalSpecies = { name: 'GEHEIM-A-Art', photos: [{ img: foto, ts: Date.now() - 864e6 }, { img: foto, ts: Date.now() }] }; T.kasten('gs-gal-cmp-btn', 'button'); T.kasten('gs-gal-cmp-result').innerHTML = ''; },
            lauf: function () { return gsGalCompareGrowth(); }, box: function () { return document.getElementById('gs-gal-cmp-result'); } },
          { name: 'Pflegeberatung (aiAnalyzePlant)', antwort: T.ki('ERGEBNIS-A • giessen'),
            vor: function () { myPlants = [{ id: 'kip1', name: 'GEHEIM-A-Basilikum', tasks: {} }]; var k = T.kasten('ai-result-kip1'); k.textContent = ''; k.style.display = 'none'; },
            lauf: function () { return aiAnalyzePlant('kip1'); }, box: function () { return document.getElementById('ai-result-kip1'); },
            messe: function () { var k = document.getElementById('ai-result-kip1'); return (k && /Analysiere/.test(k.textContent)) ? { warum: 'die Karte haengt auf „Analysiere…"' } : null; } },
          { name: 'Diagnose (runDiagnosis)', antwort: T.ki('ERGEBNIS-A Blattlaeuse'),
            vor: function () { diagImageData = T.jpeg(); var d = document.getElementById('diag-result'); if (d) { d.innerHTML = ''; d.style.display = 'none'; } },
            lauf: function () { return runDiagnosis(); }, box: function () { return document.getElementById('diag-result'); },
            messe: function () { var b = document.getElementById('diag-run-btn'); return (b && /analysiert/.test(b.textContent)) ? { warum: 'der Knopf haengt auf „' + b.textContent.trim() + '"' } : null; } },
          { name: 'Garten-KI (analyzeGardenWithAI)', antwort: T.ki('ERGEBNIS-A • Tomaten'),
            vor: function () { var c = document.getElementById('gs-scan-canvas'); if (c) c.style.display = 'none'; var g = document.getElementById('gs-result'); if (g) { g.innerHTML = ''; g.style.display = 'none'; } var wu = document.getElementById('gs-wishes'); if (wu) wu.value = 'GEHEIM-A-Wunsch'; },
            lauf: function () { return analyzeGardenWithAI(); }, box: function () { return document.getElementById('gs-result'); },
            messe: function () { var b = document.getElementById('gs-analyze-btn'); return (b && b.disabled) ? { warum: 'der Knopf haengt auf „' + b.textContent.trim() + '"' } : null; } },
          { name: 'Pflanzendoktor (gsDoctorRun)', antwort: T.ki('**Diagnose:** ERGEBNIS-A Mehltau'),
            vor: function () { T.kasten('gs-doctor-out').innerHTML = ''; },
            lauf: function () { return gsDoctorRun(T.datei()); }, box: function () { return document.getElementById('gs-doctor-out'); }, nach: 300,
            messe: function () { var k = document.getElementById('gs-doctor-out'); return (k && /Analysiere/.test(k.textContent)) ? { warum: 'die Karte haengt auf „Analysiere…"' } : null; } },
        ];
        return T.wege(wege);
      });
      const f = kiUrteil(r, Object.keys(r));
      if (Object.keys(r).length !== 6) f.push('nur ' + Object.keys(r).length + ' von 6 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '6 Wege: ohne Wechsel steht das Ergebnis da · mit Wechsel keine Karte, kein Toast, kein Knopf haengt, nichts als B, nichts im Speicher von B' };
    },
  },
  {
    name: 'KI b · Fehlerkarten im Planer: Flaechen-Foto, Boden-Foto, Plan anpassen, Plan erstellen, Baumplaner-Foto, Garten-Zwilling — nach dem Wechsel keine Karte fuer B, kein Plan von A in seinem Speicher',
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const plan = { summary: 'ERGEBNIS-A-Plan', plants: [{ name: 'Tomate', x_m: 0.5, y_m: 0.5, w_m: 0.5, h_m: 0.5 }] };
        const wege = [
          { name: 'Flaechen-Foto (gsPPanalyzeAreaPhoto)', antwort: T.ki('{"width_m":3.5,"length_m":4.2,"shape":"rechteckig","description":"ERGEBNIS-A","confidence":80}'),
            vor: function () { document.getElementById('pp-photo-analysis').innerHTML = ''; T.dateiFeld = null; gsPPcapturePhoto(); },
            lauf: function () { return T.dateiFeld.onchange({ target: { files: [T.datei()] } }); },
            box: function () { return document.getElementById('pp-photo-analysis'); },
            messe: function () { var k = document.getElementById('pp-photo-analysis'); return (k && /analysiert/.test(k.textContent)) ? { warum: 'die Anzeige haengt auf „KI analysiert…"' } : null; } },
          { name: 'Boden-Foto (gsPPanalyzeSoil)', antwort: T.ki('{"type":"loam","typeLabel":"ERGEBNIS-A","moisture":"normal","ph":"neutral","description":"x","recommendation":"y"}'),
            vor: function () { document.getElementById('pp-soil-analysis').innerHTML = ''; T.dateiFeld = null; gsPPcaptureSoil(); },
            lauf: function () { return T.dateiFeld.onchange({ target: { files: [T.datei()] } }); },
            box: function () { return document.getElementById('pp-soil-analysis'); },
            messe: function () { var k = document.getElementById('pp-soil-analysis'); return (k && /analysiert/.test(k.textContent)) ? { warum: 'die Anzeige haengt auf „KI analysiert Boden…"' } : null; } },
          { name: 'Plan anpassen (gsPPRefine)', antwort: T.ki(JSON.stringify(plan)),
            vor: function () { window._gsPP.plan = { summary: 'GEHEIM-A-Plan', plants: [{ name: 'Kuerbis' }] }; window._gsPP.data = {}; T.kasten('pp-refine-status').innerHTML = ''; },
            lauf: function () { return gsPPRefine('GEHEIM-A-Wunsch: mehr Bohnen'); },
            box: function () { return document.getElementById('pp-refine-status'); },
            ok: function (x) { return x.toasts.some(function (t) { return /angepasst/.test(t); }); },
            messe: function () { var k = document.getElementById('pp-refine-status'); return (k && /passt den Plan an/.test(k.textContent)) ? { warum: 'die Anzeige haengt auf „KI passt den Plan an…"' } : null; } },
          { name: 'Plan erstellen (gsPPrun)', antwort: T.ki(JSON.stringify(plan)), nach: 300,
            vor: function () { window._gsPP.weather = { avgTemp14: 18, avgSunshine14: 6, totalPrecip14: 20, daily: { minTemp: [] } }; document.getElementById('pp-width').value = '3'; document.getElementById('pp-length').value = '4'; var res = document.getElementById('pp-plan-result'); res.innerHTML = ''; res.style.display = 'none'; },
            lauf: function () { return gsPPrun(); },
            box: function () { return document.getElementById('pp-plan-result'); },
            ok: function (x) { return x.text && !/nicht erstellt/.test(x.text) && x.text.length > 20; },
            messe: function () { var l = document.getElementById('pp-plan-loader'); return (l && l.style.display === 'block') ? { warum: 'der Lade-Balken haengt' } : null; } },
          { name: 'Baumplaner-Foto (tpAnalyzePhotos)', antwort: T.ki('{"plot_length_m":5,"plot_width_m":4,"confidence":"mittel","note":"ERGEBNIS-A"}'), nach: 300,
            vor: function () { T.kasten('tp-photo-note').innerHTML = ''; window._gsTP.plot.len = 10; window._gsTP.analyzing = false; },
            lauf: function () { T.dateiFeld = null; window._gsTPphoto(); var dt = new DataTransfer(); dt.items.add(T.datei()); T.dateiFeld.files = dt.files; T.dateiFeld.onchange(); },
            box: function () { return document.getElementById('tp-photo-note'); },
            ok: function () { return window._gsTP.plot.len === 5; },
            messe: function () { return window._gsTP.analyzing ? { warum: 'der Baumplaner haengt auf „analyzing"' } : (window._gsTP.plot.len === 5 ? { warum: 'die Masse von A stehen im Baumplaner von B' } : null); } },
          { name: 'Garten-Zwilling (gsTwinRun)', nach: 1100,
            antwort: T.ki(JSON.stringify({ bed: { width_m: 3, length_m: 4 }, plants: [{ name: 'ERGEBNIS-A-Tomate', x_m: 1, y_m: 1, w_m: 0.5, h_m: 0.5, ix: 0.5, iy: 0.5, confidence: 0.9 }], beds: [], zones: [] })),
            vor: function () { localStorage.removeItem('gs_garden_twin'); },
            lauf: function () { return gsTwinRun(T.jpeg(), 'image/jpeg'); },
            box: function () { return document.getElementById('twin-scan-body'); },
            ok: function () { var t = gsTwinGet(); return !!(t && t.plants && t.plants.length); },
            messe: function () { var b = document.getElementById('twin-scan-body'); return (b && b.querySelector('img')) ? { warum: 'das Garten-Foto von A steht noch im Zwilling-Fenster' } : null; } },
        ];
        return T.wege(wege);
      });
      const f = kiUrteil(r, Object.keys(r));
      if (Object.keys(r).length !== 6) f.push('nur ' + Object.keys(r).length + ' von 6 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '6 Wege: ohne Wechsel Ergebnis · mit Wechsel keine Karte, kein Toast, nichts haengt, kein Plan/Zwilling von A bei B' };
    },
  },
  {
    name: 'KI c · ein await VOR oder NACH der KI (Wetter, Foto laden, Triage, Bild verkleinern, Rueckfrage): nach dem Wechsel geht die Frage von A nicht als B hinaus, und nichts von A landet im Speicher oder auf dem Server von B',
    // Das Tor sieht nur eine Antwort, die nach dem Wechsel ANKOMMT. Wechselt die Person in einem
    // await davor, startet callAI/callVisionAI als B — mit dem Plan, den Fotos, dem Feedback von A
    // im Arbeitsspeicher; wechselt sie in einem await danach, schreibt die Funktion fuer B.
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const bildUrl = function (n) { return SB_URL_DEFAULT + '/storage/v1/object/public/plant-photos/' + T.A + '/geheim-a-' + n + '.jpg'; };
        const plan = { summary: 'ERGEBNIS-A-Plan', plants: [{ name: 'Tomate', x_m: 0.5, y_m: 0.5, w_m: 0.5, h_m: 0.5 }] };
        const wege = [
          { name: 'Plan erstellen, Wechsel im Wetter (gsPPrun)', antwort: T.ki(JSON.stringify(plan)), nach: 400,
            vor: function () { window._gsPP.weather = null; window.gsPPfetchWeather = T.machTuer('wetter'); document.getElementById('pp-width').value = '3'; document.getElementById('pp-length').value = '4'; },
            lauf: function () { return gsPPrun(); }, bis: function () { return T.warteTuer('wetter'); }, weiter: function () { T.tuer.wetter(); },
            ok: function (x) { return x.kiAlsA >= 1 && x.speicher.length; } },
          { name: 'Agent, Wechsel im Wetter (gsAgentRefinePlan)', nach: 300,
            antwort: T.ki(JSON.stringify({ adjustments: ['ERGEBNIS-A anpassen'], alerts: [], newNotifications: [{ when: new Date(Date.now() + 864e5).toISOString(), title: 'ERGEBNIS-A-Erinnerung', body: 'x' }] })),
            vor: function () { var m = document.getElementById('modal-agent'); if (m) m.remove(); window._gsPP.weather = null; window.gsPPfetchWeather = T.machTuer('wetter'); localStorage.setItem('gs_garden_plan_current', JSON.stringify({ plan: { summary: 'GEHEIM-A-Plan', plants: [] }, refinements: [] })); },
            lauf: function () { return gsAgentRefinePlan(); }, bis: function () { return T.warteTuer('wetter'); }, weiter: function () { T.tuer.wetter(); },
            ok: function (x) { return x.kiAlsA >= 1 && x.extra && x.extra.modal; },
            messe: function () { var m = document.getElementById('modal-agent'); return { modal: m ? m.textContent.replace(/\s+/g, ' ').slice(0, 80) : null, warum: (m && _gsPerson() === T.B) ? 'ein Agent-Fenster fuer B: „' + m.textContent.replace(/\s+/g, ' ').slice(0, 60) + '"' : null }; } },
          { name: 'Foto-Vergleich, Wechsel beim Laden der Fotos (gsPhotoDiffAnalyze)', antwort: T.ki('{"growth_pct":5,"new_leaves":1,"color_health":"gleich","summary":"ERGEBNIS-A","highlights":[],"concerns":[]}'), nach: 1500,
            server: /fn_photo_diff_create/, halt: /plant-photos/,
            vor: function () { myPlants = [{ id: 'kip1', name: 'GEHEIM-A-Basilikum', tasks: {} }]; window._gsPhotoTimelineState = { plantId: 'kip1', photos: [{ photo: bildUrl(1), ts: Date.now() - 864e6 }, { photo: bildUrl(2), ts: Date.now() }], mode: 'compare', cmpA: 0, cmpB: 1 }; T.kasten('photo-timeline-modal'); },
            lauf: function () { return gsPhotoDiffAnalyze(); }, bis: function () { return T.warteAuf(1); }, weiter: function () { T.halten = null; T.freiBild(); },
            ok: function (x) { return x.kiAlsA >= 1; },
            messe: function () { var s = window._gsPhotoTimelineState; return { warum: (s && s.diff && /ERGEBNIS-A/.test(JSON.stringify(s.diff)) && _gsPerson() === T.B) ? 'der Vergleich von A steht im Zustand fuer B' : null }; } },
          { name: 'Galerie-Vergleich, Wechsel beim Laden der Fotos (gsGalCompareGrowth)', antwort: T.ki('{"growth_pct":5,"summary":"ERGEBNIS-A","highlights":[],"concerns":[]}'), halt: /plant-photos/,
            vor: function () { window._gsGalSpecies = { name: 'GEHEIM-A-Art', photos: [{ img: bildUrl(3), ts: Date.now() - 864e6 }, { img: bildUrl(4), ts: Date.now() }] }; T.kasten('gs-gal-cmp-btn', 'button'); T.kasten('gs-gal-cmp-result').innerHTML = ''; },
            lauf: function () { return gsGalCompareGrowth(); }, bis: function () { return T.warteAuf(1); }, weiter: function () { T.halten = null; T.freiBild(); },
            ok: function (x) { return x.kiAlsA >= 1; },
            messe: function () { var k = document.getElementById('gs-gal-cmp-result'); return { warum: (k && _gsPerson() === T.B && /ERGEBNIS-A|gewechselt|fehlgeschlagen/.test(k.textContent)) ? 'Karte fuer B: „' + k.textContent.slice(0, 60) + '"' : null }; } },
          { name: 'KI-Verbesserung, Wechsel in der Triage (runKiImprove)', antwort: T.ki('ERGEBNIS-A {"status":"accepted","priority":3,"effort":"low","category":"wissen","rationale":"x","action":"y"}'), nach: 900, runden: 25,
            halt: /ai-proxy/,
            vor: function () {
              window.getApiConfig = function () { return { provider: 'anthropic', key: 'sk-ant-pruef', source: 'global' }; };
              var fb = [{ id: 'fb-ki-1', type: 'idea', title: 'GEHEIM-A-Idee', body: 'Bitte mehr Pilze zeigen', ts: new Date().toISOString(), votes: { up: 1, down: 0 } }];
              localStorage.setItem('ps_feedback', JSON.stringify(fb)); feedbackItems = fb;
              var st = document.getElementById('ki-improve-status'); if (st) st.textContent = '';
            },
            lauf: function () { return runKiImprove(); }, bis: function () { return T.warteAuf(1); }, weiter: function () {},
            ok: function (x) { return x.kiAlsA >= 2; },
            messe: function () { var st = document.getElementById('ki-improve-status'), b = document.getElementById('ki-run-btn'); return { warum: (_gsPerson() === T.B && st && /abgeschlossen|Fehler|gewechselt/.test(st.textContent)) ? 'Status fuer B: „' + st.textContent + '"' : ((b && b.disabled) ? 'der Knopf haengt' : null) }; } },
          { name: 'Garten-Zwilling, Wechsel beim Verkleinern des Fotos (gsTwinRun)', nach: 1200, halt: /ai-proxy/,
            antwort: T.ki(JSON.stringify({ bed: { width_m: 3, length_m: 4 }, plants: [{ name: 'ERGEBNIS-A-Tomate', x_m: 1, y_m: 1, w_m: 0.5, h_m: 0.5, ix: 0.5, iy: 0.5, confidence: 0.9 }], beds: [], zones: [] })),
            vor: function () { localStorage.removeItem('gs_garden_twin'); window.gsTwinShrink = T.machTuer('klein', null); },
            lauf: function () { return gsTwinRun(T.jpeg(), 'image/jpeg'); },
            bis: async function () { if (!(await T.warteAuf(1))) return false; T.halten = null; T.frei(this.antwort); return T.warteTuer('klein'); },
            weiter: function () { T.tuer.klein(); },
            ok: function (x) { return x.zwillingA; } },
          // Die KI sagt NEIN, A bekommt die Rueckfrage „trotzdem freigeben?" — und meldet sich ab,
          // waehrend sie offen ist. Wer danach auf „Trotzdem" tippt, gibt nicht mit dem Konto von B frei.
          { name: 'Foto-Beitrag, Wechsel waehrend der Rueckfrage (gsAdminReviewSpeciesImage)', antwort: T.ki('NEIN'), halt: /ai-proxy/, server: /fn_admin_review_species_image/, nach: 300,
            vor: function () { window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = T.machTuer('dialog', true); window._gsAdminImgQueue = [{ id: 'simg-ki-2', url: 'data:image/jpeg;base64,' + T.jpeg(), species_id: DB[0].id }]; },
            lauf: function () { return gsAdminReviewSpeciesImage('simg-ki-2', true); },
            bis: async function () { for (var i = 0; i < 150 && !T.tuer.dialog; i++) { await T.warte(30); while (T.offen.length) T.frei(this.antwort); } return !!T.tuer.dialog; },
            weiter: function () { T.tuer.dialog(); },
            ok: function (x) { return x.alsA >= 1; } },
          { name: 'Arten-Vorschlag, Wechsel waehrend der Rueckfrage (gsAdminReviewSpeciesProposal)', antwort: T.ki('NEIN'), halt: /ai-proxy/, server: /fn_admin_review_species_proposal/, nach: 300,
            vor: function () { window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = T.machTuer('dialog', true); window._gsAdminPropQueue = [{ id: 'prop-ki-2', name: 'GEHEIM-A-Art', latin: 'Bellis perennis', data: { photo_url: 'data:image/jpeg;base64,' + T.jpeg() } }]; },
            lauf: function () { return gsAdminReviewSpeciesProposal('prop-ki-2', true); },
            bis: async function () { for (var i = 0; i < 150 && !T.tuer.dialog; i++) { await T.warte(30); while (T.offen.length) T.frei(this.antwort); } return !!T.tuer.dialog; },
            weiter: function () { T.tuer.dialog(); },
            ok: function (x) { return x.alsA >= 1; } },
          // Das Foto liegt im eigenen Speicher und wird erst geholt (rohes fetch, ohne Konto) — ein
          // Wechsel in diesem await liesse beide Fragen an die KI als B losgehen, und mit zweimal JA
          // gaebe B das Foto frei.
          { name: 'Foto-Beitrag, Wechsel beim Laden des Fotos (_gsVerifySpeciesImage)', antwort: T.ki('JA'), server: /fn_admin_review_species_image/, nach: 300,
            halt: /storage[/]v1[/]object[/]public[/]species-images/,
            vor: function () { window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = function () { T.toasts.push('Rueckfrage'); return Promise.resolve(true); }; window._gsAdminImgQueue = [{ id: 'simg-ki-3', url: SB_URL_DEFAULT + '/storage/v1/object/public/species-images/geheim-a.jpg', species_id: DB[0].id }]; },
            lauf: function () { return gsAdminReviewSpeciesImage('simg-ki-3', true); },
            bis: function () { return T.warteAuf(1); }, weiter: function () { T.halten = null; T.freiBild(); },
            ok: function (x) { return x.kiAlsA >= 2 && x.alsA >= 1; } },
        ];
        return T.wegeTuer(wege);
      });
      const f = kiUrteilTuer(r);
      if (Object.keys(r).length !== 9) f.push('nur ' + Object.keys(r).length + ' von 9 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '9 Wege: ohne Wechsel fragt A und speichert bzw. gibt frei · Wechsel davor/danach: keine Frage als B, nichts bei B, keine Freigabe als B' };
    },
  },
  {
    name: 'KI f · Datei lesen und verkleinern VOR der KI (Planer-Fotos, Zwilling, Doktor, Baumplaner): ein Wechsel in diesem await schickt die Fotos von A nicht als B an die KI',
    // Diese Wege merken sich die Person erst NACH dem Lesen der Datei (FileReader, gsCompressImage) —
    // oder gar nicht. Der Fall haelt genau dort an: der erste FileReader bzw. das Verkleinern liest
    // erst, wenn der Fall es freigibt.
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const plan = { summary: 'ERGEBNIS-A-Plan', plants: [] };
        const klein = { b64: T.jpeg(), mt: 'image/jpeg' };
        const wege = [
          { name: 'Flaechen-Foto, Wechsel beim Verkleinern (gsPPcapturePhoto)', antwort: T.ki('{"width_m":3.5,"length_m":4.2,"description":"ERGEBNIS-A","confidence":80}'),
            vor: function () { window.gsCompressImage = T.machTuer('klein', klein); document.getElementById('pp-photo-analysis').innerHTML = ''; T.dateiFeld = null; gsPPcapturePhoto(); },
            lauf: function () { return T.dateiFeld.onchange({ target: { files: [T.datei()] } }); },
            bis: function () { return T.warteTuer('klein'); }, weiter: function () { T.tuer.klein(); },
            ok: function (x) { return x.kiAlsA >= 1; } },
          { name: 'Boden-Foto, Wechsel beim Verkleinern (gsPPcaptureSoil)', antwort: T.ki('{"type":"loam","typeLabel":"ERGEBNIS-A","moisture":"normal","ph":"neutral"}'),
            vor: function () { window.gsCompressImage = T.machTuer('klein', klein); document.getElementById('pp-soil-analysis').innerHTML = ''; T.dateiFeld = null; gsPPcaptureSoil(); },
            lauf: function () { return T.dateiFeld.onchange({ target: { files: [T.datei()] } }); },
            bis: function () { return T.warteTuer('klein'); }, weiter: function () { T.tuer.klein(); },
            ok: function (x) { return x.kiAlsA >= 1; } },
          { name: 'Garten-Zwilling, Wechsel beim Lesen der Datei (gsTwinOnPhoto)', nach: 1200,
            antwort: T.ki(JSON.stringify({ bed: { width_m: 3, length_m: 4 }, plants: [{ name: 'ERGEBNIS-A-Tomate', x_m: 1, y_m: 1, w_m: 0.5, h_m: 0.5, ix: 0.5, iy: 0.5, confidence: 0.9 }], beds: [], zones: [] })),
            vor: function () { localStorage.removeItem('gs_garden_twin'); T.leserTuer(); },
            lauf: function () { return gsTwinOnPhoto({ target: { files: [T.datei()] } }); },
            bis: function () { return T.warteLeser(); }, weiter: function () { T.leserFrei(); },
            ok: function (x) { return x.kiAlsA >= 1 && x.zwillingA; } },
          { name: 'Pflanzendoktor, Wechsel beim Lesen der Datei (gsDoctorRun)', antwort: T.ki('ERGEBNIS-A Mehltau'), nach: 300,
            vor: function () { T.kasten('gs-doctor-out').innerHTML = ''; T.leserTuer(); },
            lauf: function () { return gsDoctorRun(T.datei()); },
            bis: function () { return T.warteLeser(); }, weiter: function () { T.leserFrei(); },
            ok: function (x) { return x.kiAlsA >= 1 && x.speicher.indexOf('gs_doctor_history') >= 0; },
            messe: function () { var k = document.getElementById('gs-doctor-out'); return { warum: (_gsPerson() === T.B && k && /ERGEBNIS-A|Analysiere|gewechselt/.test(k.textContent)) ? 'Doktor-Fenster fuer B: „' + k.textContent.slice(0, 60) + '"' : null }; } },
          { name: 'Baumplaner, Wechsel beim Verkleinern (tpResizeImg)', antwort: T.ki('{"plot_length_m":5,"plot_width_m":4,"note":"ERGEBNIS-A"}'), nach: 300,
            vor: function () { T.kasten('tp-photo-note').innerHTML = ''; window._gsTP.plot.len = 10; window._gsTP.analyzing = false; T.leserTuer(); },
            lauf: function () { T.dateiFeld = null; window._gsTPphoto(); var dt = new DataTransfer(); dt.items.add(T.datei()); T.dateiFeld.files = dt.files; T.dateiFeld.onchange(); },
            bis: function () { return T.warteLeser(); }, weiter: function () { T.leserFrei(); },
            ok: function (x) { return x.kiAlsA >= 1; },
            messe: function () { return { warum: (_gsPerson() === T.B && window._gsTP.plot.len === 5) ? 'die Masse von A stehen im Baumplaner von B' : null }; } },
        ];
        return T.wegeTuer(wege);
      });
      const f = kiUrteilTuer(r);
      if (Object.keys(r).length !== 5) f.push('nur ' + Object.keys(r).length + ' von 5 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '5 Wege: ohne Wechsel fragt A · Wechsel beim Lesen/Verkleinern: keine Frage als B, nichts bei B' };
    },
  },
  {
    name: 'KI d · Dialog, Toast, Fenster, Sprachausgabe: Foto-Beitrag und Arten-Vorschlag pruefen, Feedback-Triage, Sprachmodus, Agent, Foto-Vergleich — nach dem Wechsel fragt, meldet und spricht die App B nichts von A',
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const foto = 'data:image/jpeg;base64,' + T.jpeg();
        T.dialoge = []; T.gesprochen = [];
        window.gsConfirmModal = function (o) { T.dialoge.push((o && (o.title + ' ' + o.message)) || String(o)); return Promise.resolve(true); };
        window.gsVoiceSpeak = function (t) { T.gesprochen.push(String(t)); };
        window.gsIsAdmin = function () { return true; };
        // eine Spracherkennung, die nichts hoert, sondern sagt, was der Fall ihr gibt
        window.SpeechRecognition = function () { T.erkennung = this; };
        window.SpeechRecognition.prototype.start = function () {};
        window.SpeechRecognition.prototype.stop = function () {};
        const fb = function () { return [{ id: 'fb-ki-1', type: 'idea', title: 'GEHEIM-A-Idee-1', body: 'Bitte mehr Pilze zeigen', ts: new Date().toISOString(), ki_status: 'pending' },
                                         { id: 'fb-ki-2', type: 'bug', title: 'GEHEIM-A-Idee-2', body: 'Der Knopf klemmt manchmal', ts: new Date().toISOString(), ki_status: 'pending' }]; };
        const mitSchluessel = function () { window.getApiConfig = function () { return { provider: 'anthropic', key: 'sk-ant-pruef', source: 'global' }; }; };
        const ohneSchluessel = function () { window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; }; };
        const triage = T.ki('{"status":"accepted","priority":3,"effort":"low","category":"wissen","rationale":"ERGEBNIS-A","action":"y"}');
        const wege = [
          { name: 'Foto-Beitrag pruefen (_gsVerifySpeciesImage)', antwort: T.ki('JA'), nach: 300,
            vor: function () { ohneSchluessel(); T.dialoge.length = 0; var sp = DB[0]; window._gsAdminImgQueue = [{ id: 'simg-ki-1', url: foto, species_id: sp.id }]; },
            lauf: function () { return gsAdminReviewSpeciesImage('simg-ki-1', true); },
            ok: function (x) { return x.serverAlsA >= 1 && !x.dialoge.length; },
            server: /fn_admin_review_species_image/ },
          { name: 'Arten-Vorschlag pruefen (_gsVerifySpeciesImage)', antwort: T.ki('JA'), nach: 300,
            vor: function () { ohneSchluessel(); window._gsAdminPropQueue = [{ id: 'prop-ki-1', name: 'GEHEIM-A-Art', latin: 'Bellis perennis', data: { photo_url: foto } }]; },
            lauf: function () { return gsAdminReviewSpeciesProposal('prop-ki-1', true); },
            ok: function (x) { return x.serverAlsA >= 1 && !x.dialoge.length; },
            server: /fn_admin_review_species_proposal/ },
          { name: 'Feedback neu bewerten (gsReanalyzeFeedback)', antwort: triage, nach: 200,
            vor: function () { mitSchluessel(); var l = fb(); localStorage.setItem('ps_feedback', JSON.stringify(l)); feedbackItems = l; },
            lauf: function () { return gsReanalyzeFeedback('fb-ki-1'); },
            ok: function (x) { return x.toasts.some(function (t) { return /Neu bewertet/.test(t); }); } },
          { name: 'Feedback-Triage, Wechsel waehrend der KI (gsAutoTriageFeedbacks)', antwort: triage, nach: 900, zweite: true,
            vor: function () { mitSchluessel(); var l = fb(); localStorage.setItem('ps_feedback', JSON.stringify(l)); feedbackItems = l; window._gsTriageRunning = false; },
            lauf: function () { return gsAutoTriageFeedbacks(true); },
            ok: function (x) { return x.toasts.some(function (t) { return /bewertet/.test(t); }); } },
          // Die erste Bewertung kommt als A an; das Konto wechselt in der Pause danach, und B hat
          // eigenes Feedback geladen — die Schleife darf es nicht mit dem Konto von B weiter bewerten.
          { name: 'Feedback-Triage, Wechsel in der Pause (gsAutoTriageFeedbacks)', antwort: triage, nach: 1200,
            vor: function () { mitSchluessel(); var l = fb(); localStorage.setItem('ps_feedback', JSON.stringify(l)); feedbackItems = l; window._gsTriageRunning = false; },
            lauf: function () { return gsAutoTriageFeedbacks(true); },
            vorWechsel: function () { T.frei(triage); },
            nachWechsel: function () { feedbackItems = fb(); },
            ok: function (x) { return x.toasts.some(function (t) { return /bewertet/.test(t); }); } },
          { name: 'KI-Verbesserung, Wechsel waehrend der Gesamtanalyse (runKiImprove)', antwort: T.ki('ERGEBNIS-A {"status":"accepted","priority":3,"effort":"low","category":"wissen","rationale":"x","action":"y"}'), nach: 300, zweite: true,
            vor: function () { mitSchluessel(); var l = [fb()[0]]; localStorage.setItem('ps_feedback', JSON.stringify(l)); feedbackItems = l; window._gsTriageRunning = false; var st = document.getElementById('ki-improve-status'); if (st) st.textContent = ''; },
            lauf: function () { return runKiImprove(); },
            ok: function (x) { return /abgeschlossen/.test(x.fenster || ''); },
            fenster: function () { var st = document.getElementById('ki-improve-status'); return st ? st.textContent : ''; } },
          { name: 'Sprachmodus (gsVoiceProcess)', antwort: T.ki('ERGEBNIS-A: giess morgen frueh.'), nach: 200,
            vor: function () { ohneSchluessel(); T.gesprochen.length = 0; gsVoiceOpen(); },
            lauf: function () {
              gsVoiceStart(); var e = T.erkennung;
              e.onstart(); e.onresult({ results: [[{ transcript: 'GEHEIM-A-Frage: wie oft giessen' }]] });
              return e.onend();
            },
            ok: function (x) { return x.gesprochen.some(function (t) { return /ERGEBNIS-A/.test(t); }); },
            messe: function () { var s = window._gsVoiceState || {}; return (s.status === 'error' || /GEHEIM-A|gewechselt|erreichen/.test(s.transcript + ' ' + s.reply + ' ' + s.errorMsg)) ? { warum: 'Sprachmodus fuer B: ' + JSON.stringify({ status: s.status, transcript: s.transcript, reply: s.reply, fehler: s.errorMsg }).slice(0, 140) } : null; } },
          { name: 'Agent, Wechsel waehrend der KI (gsAgentRefinePlan)', antwort: T.ki('{"adjustments":["ERGEBNIS-A"],"alerts":[]}'), nach: 200,
            vor: function () { ohneSchluessel(); var m = document.getElementById('modal-agent'); if (m) m.remove(); window._gsPP.weather = { avgTemp14: 18, avgSunshine14: 6, totalPrecip14: 20 }; localStorage.setItem('gs_garden_plan_current', JSON.stringify({ plan: { summary: 'GEHEIM-A-Plan', plants: [] }, refinements: [] })); },
            lauf: function () { return gsAgentRefinePlan(); },
            ok: function (x) { return /Agent-Analyse/.test(x.fenster || ''); },
            fenster: function () { var m = document.getElementById('modal-agent'); return m ? m.textContent.replace(/\s+/g, ' ').slice(0, 90) : ''; } },
          { name: 'Foto-Vergleich, Wechsel waehrend der KI (gsPhotoDiffAnalyze)', antwort: T.ki('{"growth_pct":5,"summary":"ERGEBNIS-A","highlights":[],"concerns":[]}'), nach: 300,
            vor: function () { ohneSchluessel(); myPlants = [{ id: 'kip1', name: 'GEHEIM-A-Basilikum', tasks: {} }]; window._gsPhotoTimelineState = { plantId: 'kip1', photos: [{ photo: foto, ts: Date.now() - 864e6 }, { photo: foto, ts: Date.now() }], mode: 'compare', cmpA: 0, cmpB: 1 }; T.kasten('photo-timeline-modal').innerHTML = ''; },
            lauf: function () { return gsPhotoDiffAnalyze(); },
            ok: function (x) { return /ERGEBNIS-A/.test(x.fenster || ''); },
            fenster: function () { var m = document.getElementById('photo-timeline-modal'); return m ? m.textContent.replace(/\s+/g, ' ') : ''; } },
        ];
        const out = {};
        for (const w of wege) {
          out[w.name] = {};
          for (const mitWechsel of [false, true]) {
            if (_gsPerson() !== T.A) await T.alsA();
            T.dialoge.length = 0; T.gesprochen.length = 0;
            const n0 = T.log.length;
            T.halten = /ai-proxy/;
            w.vor();
            let p; try { p = Promise.resolve(w.lauf()); } catch (e) { p = Promise.reject(e); }
            p = p.catch(function (e) { return 'wurf:' + ((e && e.code) || e); });
            let da = await T.warteAuf(1);
            if (da && w.zweite) { T.frei(w.antwort); da = await T.warteAuf(1); }   // die erste Bewertung kommt als A an, die zweite haengt
            if (!da) { T.halten = null; out[w.name] = { fehlt: w.name + ': ging nie an die KI' }; break; }
            if (w.vorWechsel) { w.vorWechsel(); await T.warte(50); }
            if (mitWechsel) await T.wechsel(true);
            if (mitWechsel && w.nachWechsel) w.nachWechsel();
            T.toasts.length = 0; T.dialoge.length = 0; T.gesprochen.length = 0;
            T.frei(w.antwort);
            for (let k = 0; k < 6; k++) { await T.warte(80); while (T.offen.length) T.frei(w.antwort); }
            T.halten = null;
            await p; await T.warte(w.nach || 200);
            const x = { toasts: T.toasts.slice(), dialoge: T.dialoge.slice(), gesprochen: T.gesprochen.slice(), kiAlsB: T.kiAlsB(n0),
                        serverAlsA: w.server ? T.log.slice(n0).filter(function (e) { return e.wer === T.A && w.server.test(e.url); }).length : 0,
                        serverAlsB: w.server ? T.log.slice(n0).filter(function (e) { return e.wer === T.B && w.server.test(e.url); }).length : 0,
                        fenster: w.fenster ? w.fenster() : null, extra: w.messe ? w.messe() : null, speicher: T.speicherMit(/ERGEBNIS-A|GEHEIM-A/) };
            out[w.name][mitWechsel ? 'mit' : 'ohne'] = x;
            if (!mitWechsel) out[w.name].ohneOk = !!w.ok(x);
          }
        }
        return out;
      });
      const f = [];
      for (const n of Object.keys(r)) {
        const x = r[n];
        if (x.fehlt) { f.push(x.fehlt); continue; }
        if (!x.ohneOk) f.push(n + ': ohne Wechsel kein Ergebnis fuer A (' + JSON.stringify(x.ohne).slice(0, 200) + ') — der Fall misst dort nichts');
        const m = x.mit;
        if (m.dialoge.length) f.push(n + ': Rueckfrage an B „' + m.dialoge[0].slice(0, 90) + '"');
        if (m.toasts.length) f.push(n + ': Toast fuer B „' + m.toasts[0].slice(0, 80) + '"');
        if (m.gesprochen.length) f.push(n + ': Sprachausgabe fuer B „' + m.gesprochen[0].slice(0, 80) + '"');
        if (m.kiAlsB) f.push(n + ': ' + m.kiAlsB + '× KI-Anfrage mit dem Token von B');
        if (m.serverAlsB) f.push(n + ': ' + m.serverAlsB + '× an den Server mit dem Token von B');
        if (m.fenster && /ERGEBNIS-A|gewechselt|fehlgeschlagen|Fehler/.test(m.fenster)) f.push(n + ': Fenster fuer B „' + m.fenster.slice(0, 90) + '"');
        if (m.extra && m.extra.warum) f.push(n + ': ' + m.extra.warum);
        if (m.speicher.length) f.push(n + ': Merkmal von A im Speicher von B (' + m.speicher.join(', ') + ')');
      }
      if (Object.keys(r).length !== 9) f.push('nur ' + Object.keys(r).length + ' von 9 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '9 Wege: ohne Wechsel Ergebnis fuer A · mit Wechsel keine Rueckfrage, kein Toast, keine Sprachausgabe, kein Fenster, keine Frage als B' };
    },
  },
  {
    name: 'KI e · Geschwister: Server-Triage (gsRunServerTriage, sbFetch an feedback-triage) — nach dem Wechsel kein „❌ [object Object]" und kein Ergebnis von A fuer B',
    // Kein callAI, sondern die KI auf dem Server ueber sbFetch: das Tor liefert dort
    // { error: { code: 'person_gewechselt' } } — und dieser Weg machte aus einem error-OBJEKT
    // eine Meldung (new Error(objekt) → „[object Object]").
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        window.gsIsAdmin = function () { return true; };
        const wege = [
          { name: 'Server-Triage (gsRunServerTriage)', halt: /feedback-triage/,
            antwort: { analyzed: 1, items: [{ priority: 4, category: 'wissen', implementation_effort: 'low', summary: 'ERGEBNIS-A-Triage', rationale: 'x' }] },
            vor: function () { var st = document.getElementById('ki-improve-status'); st.textContent = ''; var rs = document.getElementById('ki-improve-result'); rs.innerHTML = ''; rs.style.display = 'none'; },
            lauf: function () { return gsRunServerTriage(); },
            box: function () { var st = document.getElementById('ki-improve-status'), rs = document.getElementById('ki-improve-result'); var d = document.createElement('div'); d.textContent = st.textContent + ' ' + rs.textContent; return d; },
            messe: function () { var b = document.getElementById('ki-run-server-btn'), st = document.getElementById('ki-improve-status'); return (b && b.disabled) ? { warum: 'der Knopf haengt' } : ((st && /object Object|Triage l|bewertet neueste/.test(st.textContent)) ? { warum: 'Status fuer B: „' + st.textContent + '"' } : null); } },
        ];
        return T.wege(wege);
      });
      const f = kiUrteil(r, Object.keys(r));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ohne Wechsel Ergebnis · mit Wechsel kein Status, kein Ergebnis, Knopf frei' };
    },
  },
  // ── Gegenpruefung ki-wege (19.11.2026): drei Wege, die die Reparatur nicht sah ──────────
  // (1) Der Scanner merkt sich die Person beim Start und fragt sie NACH der KI — aber zwischen
  //     Start und KI liegen zwei awaits (Bildguete, Farben). Wechselt das Konto dort, startet
  //     callVisionAI als B mit dem Foto von A (das Tor sieht eine Frage nicht, die erst danach losgeht).
  // (2) Der Sprachmodus merkt sich die Person erst in onend — die Frage ist da laengst gesprochen.
  //     Wechselt das Konto, waehrend er zuhoert, geht die Frage von A als B an die KI und wird B vorgelesen.
  // (3) Foto-Beitrag und Arten-Vorschlag pruefen: die Reparatur fragt die Person VOR der Freigabe
  //     (_gsAdmTun), nicht DANACH. Wechselt das Konto, waehrend die Freigabe unterwegs ist, liefert
  //     das Tor person_gewechselt, _gsAdmTun macht daraus „Fehlgeschlagen" — und B bekam den Toast.
  {
    name: 'KI g · Gegenpruefung: Scanner (Wechsel bei der Bildguete vor der KI), Sprachmodus (Wechsel beim Zuhoeren), Freigabe von Foto-Beitrag und Arten-Vorschlag (Wechsel waehrend der Freigabe) — nichts als B, nichts fuer B',
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        const foto = T.jpeg();
        const echt = { ki: window.gsKiVerfuegbar, pull: window.gsPullGlobalApiKey, qual: window.gsQualitaetMehrere, farben: window.gsBildFarbenVonB64 };
        const scanStubs = function () {
          window.gsKiVerfuegbar = echt.ki; window.gsPullGlobalApiKey = echt.pull; window.gsQualitaetMehrere = echt.qual; window.gsBildFarbenVonB64 = echt.farben;
          window.stopCamera = function () {}; window.gsScanStatusShow = function () {}; window.gsStopScanStatus = function () {}; window.gsAddToScanHistory = function () {};
          window._gsScanDHash = async function () { return 'hash-ki-g'; }; window._gsScanCacheGet = async function () { return null; }; window._gsScanCachePut = function () {};
          window.gsQueueOffline = async function () { return true; }; window._gsLastScanPayload = null;
        };
        // die KI beantwortet jede Frage, die Freigabe (RPC) bleibt haengen, bis der Fall sie loslaesst
        const bisRpc = function (rpc, antwort) {
          return async function () {
            for (var i = 0; i < 200; i++) {
              await T.warte(30);
              while (T.offen.length && /ai-proxy/.test(T.offen[0].e.url)) T.frei(antwort);
              if (T.offen.some(function (o) { return rpc.test(o.e.url); })) return true;
            }
            return false;
          };
        };
        const wege = [
          { name: 'Scanner, Wechsel bei der Bildguete vor der KI (analyzeImage)', nach: 400,
            antwort: T.ki(JSON.stringify({ name: 'ERGEBNIS-A-Scan', latin: 'Bellis perennis', confidence: 90, toxicity: 0, edible: true, alternatives: [] })),
            vor: function () { scanStubs(); window.gsQualitaetMehrere = T.machTuer('qual', null); },
            lauf: function () { return analyzeImage(foto, 'image/jpeg', '', null, { trotzdem: true }); },
            bis: function () { return T.warteTuer('qual'); }, weiter: function () { T.tuer.qual(); },
            ok: function (x) { return x.kiAlsA >= 1; } },
          // Ohne „Trotzdem": ein unlesbares Foto bekommt die Karte „schwer zu lesen", und das Foto liegt
          // fuer „Trotzdem bestimmen" bereit (window._gsQualB64) — nach dem Wechsel beides fuer B.
          { name: 'Scanner, Wechsel bei der Bildguete, Karte „schwer zu lesen" (analyzeImage)', nach: 300, antwort: T.ki('{}'),
            vor: function () { scanStubs(); window._gsQualB64 = null; var rd = document.getElementById('scan-result'); if (rd) rd.innerHTML = '';
              window.gsQualitaetMehrere = T.machTuer('qual', { messbar: true, blur: 2, light: 40, quality: 4, warnings: [], fotos: 1 }); },
            lauf: function () { return analyzeImage(foto, 'image/jpeg', '', null, {}); },
            bis: function () { return T.warteTuer('qual'); }, weiter: function () { T.tuer.qual(); },
            ok: function (x) { return !!(x.extra && x.extra.karte); },
            messe: function () { var rd = document.getElementById('scan-result'); var karte = !!(rd && /schwer zu lesen/.test(rd.textContent)); return { karte: karte, warum: (_gsPerson() === T.B && (karte || window._gsQualB64)) ? 'Karte „schwer zu lesen" fuer B' + (window._gsQualB64 ? ', das Foto von A liegt fuer „Trotzdem bestimmen" bereit' : '') : null }; } },
          { name: 'Scanner, Wechsel bei der Farbmessung vor der KI (analyzeImage)', nach: 400,
            antwort: T.ki(JSON.stringify({ name: 'ERGEBNIS-A-Scan', latin: 'Bellis perennis', confidence: 90, toxicity: 0, edible: true, alternatives: [] })),
            vor: function () { scanStubs(); window.gsQualitaetMehrere = async function () { return null; }; window.gsBildFarbenVonB64 = T.machTuer('farben', null); },
            lauf: function () { return analyzeImage(foto, 'image/jpeg', '', null, { trotzdem: true }); },
            bis: function () { return T.warteTuer('farben'); }, weiter: function () { T.tuer.farben(); },
            ok: function (x) { return x.kiAlsA >= 1; } },
          // Kurz nach der Anmeldung ist die KI manchmal noch nicht bekannt: der Scanner holt den
          // Schluessel einmal nach (gsPullGlobalApiKey). Das Tor beantwortet diese Frage nach einem
          // Wechsel mit person_gewechselt — und der Scanner zeigte B „KI gerade nicht erreichbar".
          { name: 'Scanner, Wechsel beim Nachholen des Schluessels (analyzeImage)', nach: 300, antwort: T.ki('{}'),
            vor: function () { scanStubs(); var rd = document.getElementById('scan-result'); if (rd) { rd.innerHTML = ''; rd.style.display = 'none'; }
              window.gsKiVerfuegbar = function () { return false; }; window.gsPullGlobalApiKey = T.machTuer('schluessel', null); },
            lauf: function () { return analyzeImage(foto, 'image/jpeg', '', null, { trotzdem: true }); },
            bis: function () { return T.warteTuer('schluessel'); }, weiter: function () { T.tuer.schluessel(); },
            ok: function (x) { return !!(x.extra && x.extra.karte); },
            messe: function () { var rd = document.getElementById('scan-result'); var karte = !!(rd && /nicht erreichbar|API-Key|Anmelden/.test(rd.textContent)); return { karte: karte, warum: (_gsPerson() === T.B && karte) ? 'Karte fuer B: „' + rd.textContent.replace(/\s+/g, ' ').slice(0, 60) + '"' : null }; } },
          { name: 'Foto-Beitrag, Wechsel waehrend der Freigabe (gsAdminReviewSpeciesImage)', antwort: T.ki('JA'), server: /fn_admin_review_species_image/, nach: 300,
            halt: /ai-proxy|fn_admin_review_species_image/,
            vor: function () { scanStubs(); window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = function () { T.toasts.push('Rueckfrage'); return Promise.resolve(true); }; window._gsAdminImgQueue = [{ id: 'simg-ki-g', url: 'data:image/jpeg;base64,' + foto, species_id: DB[0].id }]; },
            lauf: function () { return gsAdminReviewSpeciesImage('simg-ki-g', true); },
            bis: bisRpc(/fn_admin_review_species_image/, T.ki('JA')), weiter: function () {},
            ok: function (x) { return x.alsA >= 1 && x.toasts.some(function (t) { return /Freigegeben/.test(t); }); } },
          { name: 'Arten-Vorschlag, Wechsel waehrend der Freigabe (gsAdminReviewSpeciesProposal)', antwort: T.ki('JA'), server: /fn_admin_review_species_proposal/, nach: 300,
            halt: /ai-proxy|fn_admin_review_species_proposal/,
            vor: function () { window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = function () { T.toasts.push('Rueckfrage'); return Promise.resolve(true); }; window._gsAdminPropQueue = [{ id: 'prop-ki-g', name: 'GEHEIM-A-Art', latin: 'Bellis perennis', data: { photo_url: 'data:image/jpeg;base64,' + foto } }]; },
            lauf: function () { return gsAdminReviewSpeciesProposal('prop-ki-g', true); },
            bis: bisRpc(/fn_admin_review_species_proposal/, T.ki('JA')), weiter: function () {},
            ok: function (x) { return x.alsA >= 1 && x.toasts.some(function (t) { return /Arten-DB/.test(t); }); } },
          // Der Zwilling ist gespeichert; Fenster, Uebersicht und Toast kommen 900 ms spaeter aus einem
          // Zeitgeber — auch der ist ein await. Wechselt das Konto dazwischen, gehoert die Meldung A.
          { name: 'Garten-Zwilling, Wechsel nach dem Speichern (gsTwinRun, Zeitgeber)', nach: 1300, halt: /ai-proxy/,
            antwort: T.ki(JSON.stringify({ bed: { width_m: 3, length_m: 4 }, plants: [{ name: 'ERGEBNIS-A-Tomate', x_m: 1, y_m: 1, w_m: 0.5, h_m: 0.5, ix: 0.5, iy: 0.5, confidence: 0.9 }], beds: [], zones: [] })),
            vor: function () { scanStubs(); localStorage.removeItem('gs_garden_twin'); window.gsTwinShrink = T.machTuer('klein', null); },
            lauf: function () { return gsTwinRun(T.jpeg(), 'image/jpeg'); },
            bis: async function () { if (!(await T.warteAuf(1))) return false; T.halten = null; T.frei(this.antwort); if (!(await T.warteTuer('klein'))) return false; T.tuer.klein();
              for (var i = 0; i < 100 && !localStorage.getItem('gs_garden_twin'); i++) await T.warte(10); return !!localStorage.getItem('gs_garden_twin'); },
            weiter: function () {},
            ok: function (x) { return x.zwillingA && x.toasts.some(function (t) { return /digital|erkannt/.test(t); }); } },
          // Das Foto liegt im eigenen Speicher und ist inzwischen weg (404): _gsVerifySpeciesImage sagt
          // „nicht pruefbar" (null), BEVOR es nach der Person fragt — und B bekam die Rueckfrage
          // „Nicht geprüft … trotzdem freigeben?" zu einem Foto, das A pruefen liess.
          { name: 'Foto-Beitrag, Wechsel beim Laden, das Foto ist weg (gsAdminReviewSpeciesImage)', antwort: T.ki('JA'), server: /fn_admin_review_species_image/, nach: 300,
            halt: /storage[/]v1[/]object[/]public[/]species-images/,
            vor: function () { scanStubs(); window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = function () { T.toasts.push('Rueckfrage'); return Promise.resolve(true); }; window._gsAdminImgQueue = [{ id: 'simg-ki-g2', url: SB_URL_DEFAULT + '/storage/v1/object/public/species-images/geheim-a-weg.jpg', species_id: DB[0].id }]; },
            lauf: function () { return gsAdminReviewSpeciesImage('simg-ki-g2', true); },
            bis: function () { return T.warteAuf(1); }, weiter: function () { T.halten = null; T.frei({ message: 'Object not found' }, 404); },
            ok: function (x) { return x.alsA >= 1 && x.toasts.indexOf('Rueckfrage') >= 0; } },
          { name: 'Arten-Vorschlag, Wechsel beim Laden, das Foto ist weg (gsAdminReviewSpeciesProposal)', antwort: T.ki('JA'), server: /fn_admin_review_species_proposal/, nach: 300,
            halt: /storage[/]v1[/]object[/]public[/]species-images/,
            vor: function () { scanStubs(); window.gsIsAdmin = function () { return true; }; window.gsConfirmModal = function () { T.toasts.push('Rueckfrage'); return Promise.resolve(true); }; window._gsAdminPropQueue = [{ id: 'prop-ki-g2', name: 'GEHEIM-A-Art', latin: 'Bellis perennis', data: { photo_url: SB_URL_DEFAULT + '/storage/v1/object/public/species-images/geheim-a-weg2.jpg' } }]; },
            lauf: function () { return gsAdminReviewSpeciesProposal('prop-ki-g2', true); },
            bis: function () { return T.warteAuf(1); }, weiter: function () { T.halten = null; T.frei({ message: 'Object not found' }, 404); },
            ok: function (x) { return x.alsA >= 1 && x.toasts.indexOf('Rueckfrage') >= 0; } },
        ];
        const out = await T.wegeTuer(wege);
        // (2) Sprachmodus: eine Erkennung, die sagt, was der Fall ihr gibt; der Wechsel kommt zwischen
        //     dem Gesagten (onresult) und dem Ende des Zuhoerens (onend).
        T.gesprochen = [];
        window.gsVoiceSpeak = function (t) { T.gesprochen.push(String(t)); };
        window.SpeechRecognition = function () { T.erkennung = this; };
        window.SpeechRecognition.prototype.start = function () {};
        window.SpeechRecognition.prototype.stop = function () {};
        const stimme = { name: 'Sprachmodus, Wechsel beim Zuhoeren (gsVoiceStart)' };
        out[stimme.name] = {};
        for (const mitWechsel of [false, true]) {
          if (_gsPerson() !== T.A) await T.alsA();
          window.getApiConfig = function () { return { provider: 'anthropic', key: null, source: 'global' }; };
          T.gesprochen.length = 0; T.toasts.length = 0;
          const n0 = T.log.length;
          gsVoiceOpen(); gsVoiceStart();
          const e = T.erkennung;
          e.onstart(); e.onresult({ results: [[{ transcript: 'GEHEIM-A-Frage: wie oft giessen' }]] });
          if (mitWechsel) await T.wechsel(true);
          T.toasts.length = 0;
          T.halten = /ai-proxy/;
          const p = Promise.resolve(e.onend()).catch(function () {});
          await T.alleKi(T.ki('ERGEBNIS-A: giess morgen frueh.'), 8);
          T.halten = null;
          await p; await T.warte(200);
          const s = window._gsVoiceState || {};
          const x = { kiAlsB: T.kiAlsB(n0), kiAlsA: T.log.slice(n0).filter(function (q) { return q.wer === T.A && /ai-proxy/.test(q.url); }).length,
                      alsB: 0, alsA: 0, speicher: T.speicherMit(/ERGEBNIS-A|GEHEIM-A/), toasts: T.toasts.slice(),
                      extra: { warum: (mitWechsel && (T.gesprochen.length || /GEHEIM-A|ERGEBNIS-A/.test(s.transcript + ' ' + s.reply))) ? 'Sprachmodus fuer B: ' + JSON.stringify({ gesprochen: T.gesprochen, transcript: s.transcript, reply: s.reply }).slice(0, 140) : null } };
          try { gsVoiceClose(); } catch (_) {}
          out[stimme.name][mitWechsel ? 'mit' : 'ohne'] = x;
          if (!mitWechsel) out[stimme.name].ohneOk = x.kiAlsA >= 1 && T.gesprochen.some(function (t) { return /ERGEBNIS-A/.test(t); });
        }
        return out;
      });
      const f = kiUrteilTuer(r);
      if (Object.keys(r).length !== 10) f.push('nur ' + Object.keys(r).length + ' von 10 Wegen gefahren');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '10 Wege: ohne Wechsel fragt A (und gibt frei, und hoert die Antwort) · mit Wechsel keine Frage als B, kein Toast, nichts vorgelesen' };
    },
  },
  // ── Gegenpruefung ki-wege (19.11.2026): der Garten-Zwilling ueberlebt das Abmelden ──────
  // Beim Fall „Garten-Zwilling, Wechsel nach dem Speichern" (KI g) stand der Zwilling von A danach
  // im Speicher von B. gs_garden_twin steht in KEINER Liste von gsClearUserDataKeys — geschrieben
  // wird er ueber die Konstante GS_TWIN_KEY, die storage_check nicht als Schluessel erkennt (der
  // Fall sucht setItem('<schluessel>'). Er liegt NUR auf dem Geraet (markDirty('garden_twin') kennt
  // kein Abgleich): Loeschen beim Abmelden waere ein Datenverlust fuer A, Stehenlassen zeigt ihn B
  // — im Garten-Ueberblick, in der Liste mit Foto und im Kontext, den der Planer an die KI schickt.
  {
    name: 'KI h · Abmelden: der Garten-Zwilling von A (Foto, Pflanzen) ist fuer B nicht da — weder im Ueberblick noch im Planer-Kontext —, und fuer A nach der naechsten Anmeldung wieder',
    lauf: async (seite, h) => {
      const r = await kiFall(seite, h, async () => {
        const T = window.__tor;
        if (_gsPerson() !== T.A) await T.alsA();
        localStorage.removeItem('gs_garden_twin');
        const foto = 'data:image/jpeg;base64,' + T.jpeg();
        const roh = { bed: { width_m: 3, length_m: 4 }, plants: [{ name: 'GEHEIM-A-Tomate', x_m: 1, y_m: 1, w_m: 0.5, h_m: 0.5, ix: 0.5, iy: 0.5, confidence: 0.9 }], beds: [], zones: [] };
        const gespeichert = gsTwinSave(gsTwinNormalize(roh, foto));
        const sieht = function () {
          const t = gsTwinGet();
          let ueberblick = '';
          try { T.kasten('garden-overview'); gsRenderGardenOverview(); ueberblick = document.getElementById('garden-overview').textContent; } catch (e) { ueberblick = 'Fehler: ' + e.message; }
          let kontext = '';
          try { kontext = JSON.stringify(gsPPbuildUserContext().twin || null); } catch (e) { kontext = 'Fehler: ' + e.message; }
          return { zwilling: !!(t && t.plants && t.plants.some(function (p) { return /GEHEIM-A/.test(p.name); })), foto: !!(t && t.photo),
                   ueberblick: /GEHEIM-A|1 Pflanze|Pflanzen erkannt/.test(ueberblick) ? ueberblick.replace(/\s+/g, ' ').slice(0, 80) : '', kontext: /GEHEIM-A/.test(kontext) };
        };
        const a1 = sieht();
        await T.wechsel(true);
        const b = sieht();
        await T.alsA();
        const a2 = sieht();
        await T.wechsel(false);   // abgemeldet, niemand angemeldet
        const keiner = sieht();
        return { gespeichert: gespeichert, a1: a1, b: b, a2: a2, keiner: keiner, speicherB: !!localStorage.getItem('gs_garden_twin') };
      });
      const f = [];
      if (r.gespeichert !== true || !r.a1.zwilling || !r.a1.kontext) f.push('A sieht den eigenen Zwilling nicht (' + JSON.stringify(r.a1) + ') — der Fall misst dort nichts');
      if (r.b.zwilling) f.push('B sieht den Zwilling von A (gsTwinGet)' + (r.b.foto ? ' samt Gartenfoto' : ''));
      if (r.b.kontext) f.push('der Planer schickt den Zwilling von A im Kontext von B an die KI (gsPPbuildUserContext)');
      if (r.b.ueberblick) f.push('Garten-Ueberblick fuer B: „' + r.b.ueberblick + '"');
      if (r.keiner.zwilling) f.push('abgemeldet sieht jeder den Zwilling von A');
      if (!r.a2.zwilling) f.push('A hat den eigenen Zwilling nach der naechsten Anmeldung verloren (er liegt nur auf dem Geraet)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'A sieht den Zwilling · B und niemand sonst sieht ihn nicht, auch nicht im Planer-Kontext · A hat ihn nach der Anmeldung wieder' };
    },
  },
];

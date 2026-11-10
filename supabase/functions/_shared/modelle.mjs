// modelle.mjs — EINE Liste der Claude-Modelle, für alle Edge-Functions.
//
// Reines ESM ohne Typen, damit Deno (Edge-Functions) und Node (Prüfstand
// `modell_check`) dieselbe Datei laden — dasselbe Muster wie auth_vergleich.mjs.
//
// Anlass (10.11.2026, gemessen): neun Stellen in acht Edge-Functions nannten
// genau EIN Modell ohne Ausweichmöglichkeit (STATUS §2, „technische Schuld").
//   • `claude-sonnet-4-20250514` ist seit dem 15.06.2026 abgeschaltet — damit
//     waren plant-doctor-diagnose, garden-scan-analyze und plan-iterate live
//     tot, fünf Monate lang, ohne dass etwas meldete (`plant_doctor_history`
//     hat 0 Zeilen).
//   • `claude-sonnet-4-5` wird am 30.11.2026 abgeschaltet — der Vorgabewert von
//     ai-proxy, auf den er JEDES nicht freigegebene Modell still umschrieb.
//     `ai_usage`: 37 von 37 Aufrufen liefen darauf.
// Quelle der Daten: Anthropic, „Model deprecations" (gelesen am 10.11.2026).
//
// Regel: ein Modellname steht in KEINER Edge-Function als Zeichenkette. Wer die
// KI ruft, nennt eine ROLLE (`vision` oder `schnell`) und bekommt eine KETTE;
// antwortet Anthropic auf ein Modell mit „gibt es nicht", ist das nächste dran.
// Und bei der nächsten Abkündigung reicht ein Secret (`GS_MODEL_VISION`,
// `GS_MODEL_FAST` — ein Name oder eine Liste „a,b"), ohne neuen Quelltext.

export const MODELL_KETTEN = {
  // Bilder verstehen, Pläne rechnen, lange Antworten: Scanner, Pflanzendoktor,
  // Garten-Analyse, Lina.
  vision: ['claude-sonnet-5-5', 'claude-sonnet-5', 'claude-sonnet-4-6'],
  // Kurze, häufige Aufrufe: Pilz- und Schädlings-Vorprüfung, Übersetzung,
  // Quiz-Generator. Das bisherige Modell bleibt vorn, solange es antwortet —
  // ob das neuere Pilze gleich gut einordnet, hat hier niemand gemessen.
  schnell: ['claude-haiku-4-5-20251001', 'claude-haiku-5-5'],
};

// Abgeschaltet oder mit festem Abschalttermin. Ein Name von hier wird nie an
// Anthropic geschickt — auch dann nicht, wenn ein alter Client ihn verlangt
// oder er in einem Secret steht. Das Datum ist der Abschalttag (Anthropic).
export const MODELLE_ABGESCHALTET = {
  'claude-sonnet-4-5': '2026-11-30',
  'claude-sonnet-4-5-20250929': '2026-11-30',
  'claude-sonnet-4-20250514': '2026-06-15',
  'claude-opus-4-20250514': '2026-06-15',
  'claude-opus-4-1-20250805': '2026-08-05',
  'claude-3-7-sonnet-20250219': '2026-02-19',
  'claude-3-5-haiku-20241022': '2026-02-19',
  'claude-3-5-haiku-latest': '2026-02-19',
  'claude-3-5-sonnet-20241022': '2025-10-28',
  'claude-3-5-sonnet-20240620': '2025-10-28',
  'claude-3-5-sonnet-latest': '2025-10-28',
  'claude-3-haiku-20240307': '2026-04-20',
  'claude-3-opus-20240229': '2026-01-05',
};

function sauber(name) {
  return String(name == null ? '' : name).trim();
}

// Ist dieser Name einer, den wir an Anthropic schicken dürfen?
export function modellGueltig(name) {
  const n = sauber(name);
  return /^claude-[a-z0-9.-]{3,60}$/.test(n) && !Object.prototype.hasOwnProperty.call(MODELLE_ABGESCHALTET, n);
}

// Die Kette einer Rolle. `ueberschreibung` ist der Wert des Secrets (ein Name
// oder „a,b") und kommt VOR die eingebaute Kette; die eingebaute bleibt als
// Rückfall dahinter. Abgeschaltete und Dubletten fallen heraus. Nie leer.
export function modellKette(rolle, ueberschreibung) {
  const basis = MODELL_KETTEN[rolle] || MODELL_KETTEN.vision;
  const vorn = sauber(ueberschreibung).split(',').map(sauber).filter(Boolean);
  const kette = [];
  for (const m of vorn.concat(basis)) {
    if (modellGueltig(m) && kette.indexOf(m) < 0) kette.push(m);
  }
  return kette.length ? kette : basis.slice();
}

// Alle Namen, die ein CLIENT verlangen darf (ai-proxy): die Modelle beider
// Ketten plus die aus den Secrets. Teurere Modelle stehen in keiner Kette und
// lassen sich damit nicht erzwingen.
export function modelleErlaubt(ueberschreibungVision, ueberschreibungSchnell) {
  const alle = modellKette('vision', ueberschreibungVision).concat(modellKette('schnell', ueberschreibungSchnell));
  return alle.filter((m, i) => alle.indexOf(m) === i);
}

// Was tun mit dem Modell, das ein Client verlangt?
//   • erlaubt  → es steht vorn, dahinter der Rest der Kette SEINER Rolle
//   • sonst    → die Kette der Vorgabe-Rolle, und `ersetzt` sagt es mit Grund
// Nie still: wer ein anderes Modell bekommt als verlangt, kann es am Grund sehen.
export function modellFuerAnfrage(gewuenscht, rolle, ueberschreibungVision, ueberschreibungSchnell) {
  const w = sauber(gewuenscht);
  const kv = modellKette('vision', ueberschreibungVision);
  const ks = modellKette('schnell', ueberschreibungSchnell);
  const vorgabe = rolle === 'schnell' ? ks : kv;
  if (!w) return { kette: vorgabe.slice(), ersetzt: false, grund: 'kein Modell verlangt' };
  const heim = kv.indexOf(w) >= 0 ? kv : (ks.indexOf(w) >= 0 ? ks : null);
  if (heim) {
    return { kette: [w].concat(heim.filter((m) => m !== w)), ersetzt: false, grund: 'wie verlangt' };
  }
  const tot = Object.prototype.hasOwnProperty.call(MODELLE_ABGESCHALTET, w);
  return {
    kette: vorgabe.slice(),
    ersetzt: true,
    grund: tot ? ('abgeschaltet seit ' + MODELLE_ABGESCHALTET[w]) : 'nicht freigegeben',
  };
}

// Sagt Anthropic „dieses Modell gibt es nicht (mehr)"? Dann — und nur dann —
// lohnt das nächste. 404 `not_found_error` ist der dokumentierte Fall; manche
// Abschaltungen kommen als 400 mit dem Modellnamen im Text. Alles andere
// (401 Schlüssel, 429 Limit, 529 überlastet, 400 Anfrage falsch) ist KEIN
// Modellfehler: ein zweites Modell würde denselben Fehler nur teurer wiederholen.
export function istModellFehler(status, text) {
  const t = String(text == null ? '' : text).toLowerCase();
  if (status === 404) return t.indexOf('not_found_error') >= 0 || t.indexOf('model') >= 0;
  if (status === 400) return /model/.test(t) && /(not[ _]found|does not exist|deprecated|retired|no longer|invalid model|unknown model)/.test(t);
  return false;
}

// Geht die Kette durch. `ruf(modell)` liefert `{ status, text }` (oder wirft —
// ein Netzfehler ist kein Modellfehler und wird durchgereicht). Rückgabe:
// die letzte Antwort, das Modell, das sie gab, und die Versuche davor.
// `sagen(zeile)` bekommt je Rückfall einen Satz — die Edge-Function schreibt ihn
// ins Log; ein Rückfall, den niemand sieht, ist die Stille aus v33.41.
export async function mitModellRueckfall(kette, ruf, sagen) {
  const versuche = [];
  let letzte = null;
  for (let i = 0; i < kette.length; i++) {
    const modell = kette[i];
    letzte = await ruf(modell);
    if (!istModellFehler(letzte.status, letzte.text)) {
      return { status: letzte.status, text: letzte.text, modell, versuche };
    }
    versuche.push({ modell, status: letzte.status });
    if (typeof sagen === 'function') {
      sagen('KI-Rückfall: ' + modell + ' antwortet ' + letzte.status + (i + 1 < kette.length ? ' → ' + kette[i + 1] : ' → kein weiteres Modell'));
    }
  }
  return { status: letzte ? letzte.status : 0, text: letzte ? letzte.text : '', modell: kette[kette.length - 1] || '', versuche };
}

// Der eine Aufruf für Functions, die Anthropic selbst rufen (alles ausser
// ai-proxy): Rolle nennen, Rumpf OHNE `model` mitgeben, Antwort lesen.
// `fetchFn` und `sagen` sind stellbar, damit Node den Weg ohne Netz fährt.
export async function anthropicNachricht(opts) {
  const o = opts || {};
  const kette = modellKette(o.rolle, o.ueberschreibung);
  const fetchFn = o.fetchFn || fetch;
  const erg = await mitModellRueckfall(kette, async (modell) => {
    const r = await fetchFn('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': o.schluessel, 'anthropic-version': '2023-06-01' },
      // Die Kette entscheidet: ein `model` im Rumpf wird ueberschrieben, nie umgekehrt.
      body: JSON.stringify(Object.assign({}, o.rumpf || {}, { model: modell })),
      signal: o.signal,
    });
    return { status: r.status, text: await r.text() };
  }, o.sagen);
  let daten = null;
  try { daten = JSON.parse(erg.text); } catch (_) { daten = null; }
  return { ok: erg.status >= 200 && erg.status < 300, status: erg.status, text: erg.text, daten, modell: erg.modell, versuche: erg.versuche };
}

// Liest ein Secret, ohne dass das Modul Deno voraussetzt (Node faehrt den Pruefstand).
function umgebung(name) {
  try {
    // deno-lint-ignore no-explicit-any
    const d = globalThis.Deno;
    if (d && d.env && typeof d.env.get === 'function') return d.env.get(name) || '';
  } catch (_) { /* kein Zugriff → kein Secret */ }
  try {
    const p = globalThis.process;
    if (p && p.env) return p.env[name] || '';
  } catch (_) { /* dito */ }
  return '';
}

// Das Secret einer Rolle: GS_MODEL_VISION bzw. GS_MODEL_FAST (ein Name oder „a,b").
export function modellSecret(rolle) {
  return umgebung(rolle === 'schnell' ? 'GS_MODEL_FAST' : 'GS_MODEL_VISION');
}

// Ersatz für `fetch('https://api.anthropic.com/v1/messages', init)` an einer
// bestehenden Aufrufstelle: dieselbe `init`, nur ohne `model` im Rumpf — die
// Rolle bestimmt die Kette. Zurück kommt eine echte Response (ok · status ·
// json() · text() wie gewohnt); `gsModell` nennt das Modell, das geantwortet
// hat, `gsVersuche` die davor. Jeder Rückfall steht im Log der Function.
export async function anthropicFetch(rolle, init, opts) {
  const o = opts || {};
  const fetchFn = o.fetchFn || fetch;
  const start = init || {};
  let rumpf = {};
  try { rumpf = JSON.parse(String(start.body || '{}')); } catch (_) { rumpf = {}; }
  const kette = modellKette(rolle, o.ueberschreibung !== undefined ? o.ueberschreibung : modellSecret(rolle));
  const erg = await mitModellRueckfall(kette, async (modell) => {
    const r = await fetchFn('https://api.anthropic.com/v1/messages',
      Object.assign({}, start, { body: JSON.stringify(Object.assign({}, rumpf, { model: modell })) }));
    return { status: r.status, text: await r.text() };
  }, o.sagen || ((zeile) => console.warn(zeile)));
  const antwort = new Response(erg.text, { status: erg.status, headers: { 'Content-Type': 'application/json' } });
  antwort.gsModell = erg.modell;
  antwort.gsVersuche = erg.versuche;
  return antwort;
}

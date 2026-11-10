// modelle.mjs — EINE Liste der Claude-Modelle, für alle Edge-Functions.
//
// Reines ESM ohne Typen, damit Deno (Edge-Functions) und Node (Prüfstand
// `modell_check`) dieselbe Datei laden — dasselbe Muster wie auth_vergleich.mjs.
//
// Anlass (10.11.2026, gemessen): neun Edge-Functions nannten ihre Modelle als
// Zeichenkette — acht davon genau EINES, ohne Ausweichmöglichkeit, und ai-proxy
// eine Freigabeliste, in der sieben von acht Namen abgeschaltet sind oder es werden.
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
  // Vorn steht Sonnet 4.6 — der direkte Nachfolger des Modells, auf dem diese App
  // gebaut und abgestimmt wurde (4.5): es antwortet ohne vorgelagertes Nachdenken,
  // zählt Token wie bisher und liest Bilder in derselben Auflösung. Anthropic
  // schaltet es frühestens am 17.02.2027 ab; dann übernimmt Sonnet 5.5 von selbst,
  // mit den Einstellungen aus `modellZusatz`. Wer 5.5 vorher will (genauere
  // Bilder, dafür rund 2,5-mal so viele Bild-Token und mehr abgelehnte Anfragen):
  // Secret GS_MODEL_VISION=claude-sonnet-5-5 — ohne neuen Quelltext.
  vision: ['claude-sonnet-4-6', 'claude-sonnet-5-5', 'claude-sonnet-5'],
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

// Was tun mit dem Modell, das ein Client verlangt (ai-proxy)? Erlaubt sind die
// Modelle der zwei Ketten plus die aus den Secrets — teurere stehen in keiner
// Kette und lassen sich damit nicht erzwingen.
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

// ── Was ein Modell im Rumpf ZUSÄTZLICH braucht ──────────────────────────────
// Diese App ist für Modelle gebaut, die OHNE vorgelagertes Nachdenken antworten:
// ein Scan bittet um 900 Token und liest die Antwort als Text. Seit Claude
// Sonnet 5 denkt ein Modell von sich aus nach, wenn die Anfrage nichts dazu sagt.
// Das Nachdenken zählt gegen `max_tokens` (aus 900 Token JSON wird ein
// abgeschnittenes JSON), und die Antwort kann mit einem `thinking`-Block beginnen
// (`content[0].text` ist dann leer). Dazu zählt derselbe Text auf den neuen
// Modellen rund 30 % mehr Token. Ein Modellname allein ist also keine Umstellung.
// Quelle: Anthropic, „Migrating to Claude Sonnet 5.5" und „Claude Haiku 5.5
// migration guide" (gelesen am 10.11.2026):
//   Sonnet 5.5   denkt ohne Angabe · aus: thinking {type:'between_tools'} · 'disabled' → 400
//   Sonnet 5     denkt ohne Angabe · aus: thinking {type:'disabled'}
//   Haiku 5.5    denkt ohne Angabe · kein Aus-Schalter, gesteuert über output_config.effort
//   Sonnet 4.6, Haiku 4.5   denken ohne Angabe nicht, zählen Token wie bisher
const NEUER_TOKENIZER = 1.35;   // „about 30 percent more tokens" plus etwas Luft
const DENK_LUFT = 2048;         // Platz für ein Nachdenken, das sich nicht abschalten lässt

export function modellZusatz(modell) {
  const m = sauber(modell);
  if (/^claude-sonnet-5-5(-|$)/.test(m)) return { felder: { thinking: { type: 'between_tools' } }, faktor: NEUER_TOKENIZER, luft: 0 };
  if (/^claude-sonnet-5(-\d{8})?$/.test(m)) return { felder: { thinking: { type: 'disabled' } }, faktor: NEUER_TOKENIZER, luft: 0 };
  if (/^claude-haiku-5-5(-|$)/.test(m)) return { felder: { output_config: { effort: 'low' } }, faktor: NEUER_TOKENIZER, luft: DENK_LUFT };
  if (/^claude-(sonnet|haiku|opus)-4-/.test(m) || /^claude-3-/.test(m)) return { felder: {}, faktor: 1, luft: 0 };
  // Unbekannt (ein Name aus einem Secret, ein künftiges Modell): keine Einstellung
  // raten — aber mit dem Platz rechnen, den ein Modell braucht, das von sich aus denkt.
  return { felder: {}, faktor: NEUER_TOKENIZER, luft: DENK_LUFT };
}

// Der Rumpf, wie er an DIESES Modell geht: sein Zusatz, sein Token-Budget, sein Name.
// `ohneZusatz` ist der zweite Versuch, wenn das Modell die Angabe nicht annimmt —
// dann denkt es womöglich doch, und das Budget lässt Platz dafür.
export function rumpfFuerModell(rumpf, modell, ohneZusatz) {
  const z = modellZusatz(modell);
  const hatZusatz = Object.keys(z.felder).length > 0;
  const r = Object.assign({}, rumpf || {}, ohneZusatz ? {} : z.felder);
  const luft = (ohneZusatz && hatZusatz) ? Math.max(z.luft, DENK_LUFT) : z.luft;
  r.max_tokens = Math.ceil((Number(r.max_tokens) || 1024) * z.faktor) + luft;
  r.model = modell;                 // die Kette entscheidet — ein `model` im Rumpf verliert
  return r;
}

// Lehnt das Modell unsere Angabe zum Nachdenken ab? (Ein Name, den die Regel oben
// falsch einordnet, oder eine Einstellung, die Anthropic später umbenennt.)
export function istZusatzFehler(status, text) {
  return status === 400 && /thinking|output_config|effort|between_tools/i.test(String(text == null ? '' : text));
}

// Die Antwort ohne `thinking`-Blöcke. Diese App schickt sie nie zurück (keine
// Werkzeug-Schleife), und jeder Leser von `content[0].text` — auch eine ältere,
// noch nicht aktualisierte App — bekommt damit wieder den Text an erster Stelle.
// Gibt es nichts zu entfernen, bleibt die Antwort Byte für Byte, wie sie kam.
export function ohneDenkBloecke(text) {
  let d;
  try { d = JSON.parse(text); } catch (_) { return text; }
  if (!d || typeof d !== 'object' || !Array.isArray(d.content)) return text;
  const bleibt = d.content.filter((b) => !(b && (b.type === 'thinking' || b.type === 'redacted_thinking')));
  if (bleibt.length === d.content.length) return text;
  d.content = bleibt;
  return JSON.stringify(d);
}

// EIN Modell rufen. `sende(rumpf)` schickt den fertigen Rumpf und liefert
// `{ status, text }`. Nimmt das Modell die Angabe zum Nachdenken nicht an, geht
// derselbe Aufruf einmal ohne sie — mit einem Satz für das Log.
export async function rufeModell(modell, rumpf, sende, sagen) {
  let a = await sende(rumpfFuerModell(rumpf, modell, false));
  if (istZusatzFehler(a.status, a.text) && Object.keys(modellZusatz(modell).felder).length) {
    if (typeof sagen === 'function') sagen('KI-Einstellung abgelehnt: ' + modell + ' nimmt die Angabe zum Nachdenken nicht (400) → derselbe Aufruf ohne sie');
    a = await sende(rumpfFuerModell(rumpf, modell, true));
  }
  const gut = a.status >= 200 && a.status < 300;
  return { status: a.status, text: gut ? ohneDenkBloecke(a.text) : a.text };
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

// Liest ein Secret, ohne dass das Modul Deno voraussetzt (Node faehrt den Pruefstand).
function umgebung(name) {
  try {
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
// Rolle bestimmt die Kette, und jedes Modell bekommt seinen Zusatz und sein
// Token-Budget (`rufeModell`). Zurück kommt eine echte Response (ok · status ·
// json() · text() wie gewohnt) ohne `thinking`-Blöcke; `gsModell` nennt das
// Modell, das geantwortet hat, `gsVersuche` die davor. Jeder Rückfall steht im
// Log der Function.
export async function anthropicFetch(rolle, init, opts) {
  const o = opts || {};
  const fetchFn = o.fetchFn || fetch;
  const start = init || {};
  let rumpf = {};
  try { rumpf = JSON.parse(String(start.body || '{}')); } catch (_) { rumpf = {}; }
  const kette = modellKette(rolle, o.ueberschreibung !== undefined ? o.ueberschreibung : modellSecret(rolle));
  const sagen = o.sagen || ((zeile) => console.warn(zeile));
  const sende = async (fertig) => {
    const r = await fetchFn('https://api.anthropic.com/v1/messages', Object.assign({}, start, { body: JSON.stringify(fertig) }));
    return { status: r.status, text: await r.text() };
  };
  const erg = await mitModellRueckfall(kette, (modell) => rufeModell(modell, rumpf, sende, sagen), sagen);
  // Eine Response nimmt nur 200–599 an; alles andere wäre ein Fehler dieses Moduls, kein Erfolg.
  const status = (erg.status >= 200 && erg.status <= 599) ? erg.status : 502;
  const antwort = new Response(erg.text, { status, headers: { 'Content-Type': 'application/json' } });
  antwort.gsModell = erg.modell;
  antwort.gsVersuche = erg.versuche;
  return antwort;
}

// greenscan-audit — der Audit-Workflow aus v33.59 (STATUS (jb), docs/AUDIT-2026-11-11.md).
//
// Acht Blickwinkel, je ein Auditor (nur lesend) und ein Gegenpruefer, der jeden
// Fund zu WIDERLEGEN versucht. Am 11.11.2026 liefen fuenf davon (robust, escape,
// datum, edge, sw): 45 Funde, 31 bestaetigt, 14 teilweise, keiner widerlegt.
// Drei sind noch nie gelaufen: css, daten, android.
//
// Aufruf:  Workflow({ name: 'greenscan-audit', args: { linsen: ['css','daten','android'], scratch: '/tmp/gs-audit' } })
//   linsen  — welche Blickwinkel (Vorgabe: alle acht)
//   scratch — wohin die Agenten ihre Skripte und Funde schreiben (nie ins Repo;
//             in einer Cloud-Sitzung das Scratchpad-Verzeichnis der Sitzung)
//
// Zwei Lehren stecken in der Bauform: acht LOSE Agenten rissen zweimal am
// Nutzungslimit, bevor einer berichtet hatte — ein Workflow hat einen
// Zwischenspeicher je Agent (resumeFromRunId). Und jeder Auditor schreibt seine
// Funde ZUERST in eine Datei.
export const meta = {
  name: 'greenscan-audit',
  description: 'GreenScan: acht Audit-Blickwinkel (Speicher/Async, Escaping, Datum, Edge Functions, Auslieferung, CSS/HTML, Datenform, Android-Hülle), jeder Fund gegnerisch gegengeprüft',
  whenToUse: 'Breiter Fehler-Audit über GreenScan; nur lesend, liefert bestätigte Funde mit Beleg und Fix-Vorschlag. args.linsen wählt die Blickwinkel.',
  phases: [
    { title: 'Finden', detail: 'ein Auditor je Blickwinkel, nur lesend' },
    { title: 'Gegenprüfen', detail: 'ein Gegenprüfer je Blickwinkel versucht jeden Fund zu widerlegen' },
  ],
}

const S = (args && args.scratch) || '/tmp/gs-audit'

const FUND_SCHEMA = {
  type: 'object',
  properties: {
    funde: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titel: { type: 'string' },
          datei: { type: 'string' },
          zeile: { type: 'integer' },
          ausschnitt: { type: 'string' },
          szenario: { type: 'string' },
          schwere: { type: 'string', enum: ['hoch', 'mittel', 'gering'] },
          beleg: { type: 'string', enum: ['ausgefuehrt', 'gelesen', 'plausibel'] },
          fix: { type: 'string' },
        },
        required: ['titel', 'datei', 'zeile', 'szenario', 'schwere', 'beleg', 'fix'],
      },
    },
    zahlen: { type: 'string' },
    sauber: { type: 'array', items: { type: 'string' } },
  },
  required: ['funde'],
}

const URTEIL_SCHEMA = {
  type: 'object',
  properties: {
    urteile: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          urteil: { type: 'string', enum: ['bestaetigt', 'teilweise', 'widerlegt'] },
          begruendung: { type: 'string' },
          praeziser_fix: { type: 'string' },
        },
        required: ['index', 'urteil', 'begruendung'],
      },
    },
  },
  required: ['urteile'],
}

const REGELN = (key) => `
ARBEITSREGELN (verbindlich):
- Alle Pfade sind relativ zur Repo-Wurzel (dein Arbeitsverzeichnis).
- NUR LESEN. Im Repo nichts ändern, nichts committen, kein git-Befehl, der Zustand ändert. Eigene Skripte/Notizen ausschliesslich unter ${S}/agent/${key}/ (dort liegt evtl. Vorarbeit eines abgebrochenen früheren Laufs — ansehen und benutzen, wenn brauchbar).
- Kein Playwright/Chromium, nicht scripts/pruefstaende.sh, keine MCP-Aufrufe (keine Live-Datenbank), kein Netz. Kleine Node-Skripte sind erlaubt und erwünscht (Beleg durch Ausführen schlägt Beleg durch Lesen).
- Hilfen: „node scripts/statik_check.js" liest die App als Programm; seine Funktionen inlineSkripte/zeilentreu ziehen das Inline-JavaScript von index.html zeilentreu (GLEICHE Zeilennummern) — lege dir damit zuerst ${S}/app.js an. acorn + acorn-walk: /opt/node-tools/node_modules/ (falls vorhanden). ESLint: scripts/node_modules/eslint oder /opt/node22/lib/node_modules/eslint .
- „Ein Treffer ist ein Verdacht, kein Urteil": melde nur, was du am echten Codepfad bestätigt hast (zitierte Zeile + mindestens ein Aufrufer bzw. der Weg dorthin). Höchstens 10 Funde — die am besten belegten, schwerste zuerst.
- Nicht melden, was schon bekannt ist: lies zuerst STATUS.md Sektion 2 („Offene Punkte", zu finden mit grep -n '^## 2 ·' STATUS.md) und docs/AUDIT-2026-11-11.md.
- Halte dich knapp: höchstens etwa 45 Werkzeugaufrufe. Schreibe deine Funde fortlaufend nach ${S}/agent/${key}/funde.md (damit sie einen Abbruch überleben), dann gib die strukturierte Ausgabe zurück.
- Felder je Fund: titel · datei (repo-relativ) · zeile · ausschnitt (wörtlich, kurz) · szenario (was sieht wer wann Falsches) · schwere · beleg (ausgefuehrt/gelesen/plausibel) · fix (kleinster sinnvoller, als Code-Skizze). Dazu „zahlen" (deine Zählungen in einem Absatz) und „sauber" (was du geprüft und in Ordnung gefunden hast).
Sprache: Deutsch.`

const LINSEN = [
  {
    key: 'robust',
    prompt: `Du bist Code-Auditor für GreenScan (Monolith index.html, ~96'600 Zeilen Vanilla-JS). Suche zwei Fehlerklassen.

KLASSE 1 — „Ein kaputter Wert im Gerätespeicher legt die App lahm". Zustand liegt in localStorage (gs_*, ps_*). Ein Wert kann kaputt sein: abgeschnittenes JSON, alte Form (Objekt statt Array, String statt Objekt, null), von Sync/Backup überschrieben. Suche: (a) JSON.parse auf Speicherwerten OHNE try/catch, erreichbar beim START oder beim Öffnen eines Haupt-Tabs; (b) Form ungeprüft: .forEach/.map/.filter/.length/.push auf etwas, das null/Objekt/String sein kann (JSON.parse('null') ist null; \`x || []\` fängt {} nicht ab); (c) ein Rückfall, der Daten STILL ÜBERSCHREIBT (leere Liste nach Parse-Fehler, danach setItem). Beachte CLAUDE.md §3.5: localStorage.setItem ist umhüllt und wirft nie (gibt false zurück), getItem ebenfalls umhüllt; safeGetItem(key, fallback) parst mit try/catch — prüfe aber, ob es die FORM prüft.

KLASSE 2 — „async ohne Halt": (d) async-Funktion, deren Aufrufer das Ergebnis braucht, aber nicht abwartet (Promise ist immer truthy); (e) await in forEach-Callbacks; (f) roher fetch( (NICHT sbFetch — der wirft nie) mit .then ohne .catch, wo danach ein Ladezustand nie endet; (g) Knopf vor await deaktiviert, im Fehlerpfad nie wieder aktiviert (kein finally); (h) Wettlauf: ältere Antwort überschreibt neuere (Suche beim Tippen, Tab-Wechsel) ohne Anfrage-Zähler.

Vorgehen: erst zählen (acorn-walk: alle JSON.parse-Stellen, wie viele ohne umschliessendes try, wie viele lesen aus dem Speicher), dann nach Erreichbarkeit ordnen (Start > Tab > seltenes Fenster). Für die schwersten: Funktion herausschneiden und mit kaputtem Probewert ausführen (z.B. '{"a":' / 'null' / '{}' / '"text"').`,
  },
  {
    key: 'escape',
    prompt: `Du bist Sicherheits-Auditor (defensiv, eigene Codebasis des Auftraggebers) für GreenScan (Monolith index.html). Suche Stellen, an denen FREMDTEXT (Zeilen anderer Nutzer aus Supabase: Community-Posts, Kommentare, Marktplatz, Profile/Nutzernamen, Ranglisten, Gruppen, Nachrichten; notifications; KI-Ausgaben; URL/Hash-Parameter; Push-Nutzlasten; importierte Backups/Dateien) als CODE statt als Text im Dokument landet — und Stellen, an denen ein dynamischer Wert ein onclick="…"-Attribut syntaktisch zerbricht (Knopf tot, auch ohne Angriff; z.B. Name mit Apostroph).

Hausregeln: CLAUDE.md §3.6 (vier Helfer: escHtml/gsEscHtml/gsHTMLEscape für HTML-Text und Attribute · _gsOcStr für Werte in einfach zitierten JS-Strings in onclick — escHtml ALLEIN reicht dort nicht · gsSanitizeHtml für Fragmente · _gsSafeUrl/_gsSafeLink für Adressen). scripts/escape_check.js deckt schon Feed, Artendetail, Mitteilungs-Router, SW-Klick, Sanitizer, „Meine Funde" ab — Kopf lesen, nicht wiederholen.

Vorgehen: (1) Skript (acorn-walk über app.js): alle Zuweisungen an innerHTML/outerHTML/insertAdjacentHTML/document.write mit dynamischen Teilen; je Teil: geht er durch einen Helfer, ist er Zahl/Konstante? Zähle gesamt · gesichert · ungesichert. (2) Die ungesicherten nach HERKUNFT ordnen — das ist die eigentliche Arbeit: (a) eigene Konstante/Artenliste DB (vertrauenswürdig) · (b) eigene Eingabe auf dem eigenen Gerät (gering) · (c) FREMD (hoch). (3) Gesondert onclick/onchange/onerror-Bauformen mit dynamischem Wert in einem JS-String ohne _gsOcStr. (4) href/src aus fremder Hand ohne _gsSafeUrl/_gsSafeLink, window.open(fremd), location = fremd, eval/new Function/setTimeout('string') mit dynamischem Inhalt. (5) Für die schwersten Funde der Klasse (c): Wert RÜCKWÄRTS bis zur Quelle (Tabelle/Spalte, wer darf schreiben) und VORWÄRTS bis ins Dokument verfolgen, beide Enden zitieren, konkreten Probewert nennen (z.B. <img src=x onerror="window.__pwned=1"> oder ');alert(1);//).`,
  },
  {
    key: 'datum',
    prompt: `Du bist Code-Auditor für GreenScan (Monolith index.html). Suche systematisch die Fehlerklasse „Tag/Datum falsch gerechnet". Nutzer sitzen in der Schweiz (UTC+1/+2): zwischen 00:00 und 02:00 Ortszeit ist new Date().toISOString().slice(0,10) der GESTRIGE Tag. Zweimal wurde die Klasse einzeln gefunden (Backup-Tag v33.26, Quiz-Countdown v33.27).

Vorgehen: (1) Zähle und liste ALLE Stellen: toISOString().slice(0,10) / .split('T')[0] / .substr · toISOString().slice(0,7) · getUTC* · Date.UTC · new Date('YYYY-MM-DD') (wird als UTC-Mitternacht gelesen) · Tagesdifferenzen per /864e5 bzw. 86400000 (Sommerzeit: ein Tag hat 23 oder 25 h → Math.floor/round-Fehler am 29.03.2026 und 25.10.2026) · Wochen-/KW-Rechnung · Monatsgrenzen · Jahreswechsel. (2) Ordne jede Stelle ein: (a) bewusst UTC und richtig (der Quiz-Tag dqDayKey() ist ABSICHTLICH UTC, CLAUDE.md §3.3; Zeitstempel für die Datenbank; Dateinamen) · (b) lokal gemeint, aber UTC gerechnet → FEHLER · (c) unklar. Lokale Helfer, die richtig sind: _gsDayKey, gsLocale, dqNaechsteFrage — Stellen, die sie benutzen, sind sauber. (3) Für jede Stelle (b): umschliessende Funktion und Aufrufer lesen, konkretes Szenario mit Uhrzeit (Serie reisst? Tageslimit doppelt? Tagebuch am falschen Tag? Erinnerung einen Tag zu spät?). Die schwersten 3–5 durch Ausführen belegen: Funktion herausschneiden, mit TZ=Europe/Zurich node und gestellter Uhr (z.B. 2026-07-15T23:30:00Z = 01:30 Ortszeit am 16.) laufen lassen. In „zahlen": Stellen je Muster und Verteilung (a)/(b)/(c).`,
  },
  {
    key: 'edge',
    prompt: `Du bist Code-Auditor für GreenScan. Prüfe die Supabase Edge Functions unter supabase/functions/ (Deno/TypeScript, ~40 Verzeichnisse plus _shared/) auf echte Fehler und unsaubere Programmierung.

Blickwinkel: (1) Supabase-Client-Antworten, bei denen error wegdestrukturiert oder nie gelesen wird (const { data } = await sb.from(...)) — besonders wo danach gesendet, gelöscht, abgerechnet oder Erfolg gemeldet wird (Klasse aus v33.41). (2) Auth: jede Function, die schreibt oder Geld/KI-Kontingent kostet — prüft sie den Aufrufer (JWT/getUser, Service-Role, Cron-Secret)? Geheimnisvergleiche nur über _shared/auth_vergleich.mjs (nie ===, includes, startsWith). Admin-Prüfung nie per atob auf den Token oder E-Mail-Liste. (3) Stripe (stripe-webhook, create-checkout, stripe-checkout, customer-portal, stripe-portal …): Signaturprüfung, Idempotenz, Fehlerpfade, die 200 zurückgeben, obwohl nichts verbucht wurde; Beträge/Preis-IDs aus dem Client. (4) fetch zu externen Diensten ohne Zeitlimit/AbortController, req.json()/JSON.parse ohne try, fehlende Eingabeprüfung (Grösse, Typ), CORS * wo es nicht sein muss. (5) Geheimnisse/Privates im Quelltext (die Functions liegen im Web-Root und sind öffentlich lesbar). (6) Logik: falsche Bedingungen, Zeitzonen (UTC gegen Europe/Zurich), Schleifen, die bei einem Fehler alles abbrechen, doppelte Sendungen.

Bekannt und NICHT melden (STATUS §2): Modell-Rückfallketten in 8 Functions, nicht ausgelieferte Functions, book-ingest ohne Spiegel, drei Verzeichnisse ohne Auslieferung (daily-push, entitlements, push-test).`,
  },
  {
    key: 'sw',
    prompt: `Du bist Code-Auditor für GreenScan (statisch ausgeliefert von Cloudflare Pages UND Netlify, kein Build). Prüfe die Auslieferungs-Dateien: sw.js, manifest.json, _headers, _redirects, offline.html, install.html, privacy.html, robots.txt, sitemap.xml, sowie die Stellen in index.html, die den Service Worker registrieren/steuern (serviceWorker, SKIP_WAITING, _gsSwReady, SHELL_URLS).

Blickwinkel: (1) sw.js Zeile für Zeile: Antworten, die nicht geklont werden; respondWith mit möglichem undefined; gecachte Fehlerantworten (opaque/404/500); Race beim Aktivieren; push/notificationclick (swSafeUrl); jede URL in SHELL_URLS muss als Datei im Repo existieren (sonst scheitert cache.addAll und der ganze Install); der Teilen-Weg POST /teilen. Lies zuerst die Kopfkommentare — vieles ist bewusst so (Changelog-Archiv absichtlich NICHT in SHELL_URLS; Bild-Cache-Deckel ist ein Ziel, keine Schranke). (2) _headers: CSP gegen das, was index.html/install.html/offline.html/privacy.html WIRKLICH laden — Hosts, die der Code anspricht (fetch/src/href-Ziele, per Skript aus index.html ziehen) und die in der CSP FEHLEN (im Betrieb blockiert), und Hosts in der CSP, die niemand mehr benutzt; Pfad-Regeln, die sich überschreiben. (3) _redirects: Reihenfolge (erste Regel gewinnt), Regeln, die nie greifen, Schleifen, Ziele, die nicht existieren. (4) manifest.json: Icons existieren und haben die angegebene Grösse (PNG-Kopf mit einem Node-Skript lesen), share_target, shortcuts-URLs gegen das, was index.html beim Start liest (gsHandleShortcutUrl), id/scope/start_url. (5) offline.html/install.html/privacy.html: tote Links, Verweise auf fehlende Dateien, Inline-Skripte mit Fehlern (node --check auf extrahierte Skripte), veraltete Aussagen (richtig ist „3'136 Arten in 4'337 Einträgen"), fehlendes lang/Viewport/Canonical. (6) sitemap.xml/robots.txt: URLs existieren, Domain https://green-scan.ch/ (mit Bindestrich).`,
  },
  {
    key: 'css',
    prompt: `Du bist Code-Auditor für GreenScan (Monolith index.html; Hell- und Dunkelmodus über body.dark). Prüfe CSS und statisches HTML — rein statisch, mit Skripten. (1) CSS-Variablen, die nur hell definiert sind und für die eine body.dark-Überschreibung FEHLT, obwohl verwandte eine haben (nur Farben, die auf dunklem Grund sichtbar falsch wären). (2) <button> in <button>, <a> in <a>, <div> in <p>/<span> im statischen Markup; ungeschlossene/überzählige Tags (Stapel-Prüfung). (3) CSS-Syntax: Tippfehler in Eigenschaftsnamen (Namen, die genau EINMAL vorkommen), fehlende Einheiten, unbalancierte Klammern in <style>-Blöcken, identische Selektoren mit widersprüchlichen Deklarationen wenige Zeilen auseinander. (4) Klassen, die gesetzt werden und für die es KEINE Regel gibt (nur zählen + 15 Beispiele), und totes CSS (Summe in KB, die 15 grössten Blöcke). Schon gedeckt und NICHT wiederholen: undefinierte CSS-Variablen (statik_check S6), doppelte statische ids (0, gemessen 11.11.2026), Kontrast (contrast_check).`,
  },
  {
    key: 'daten',
    prompt: `Du bist Daten-Auditor für GreenScan. Prüfe die FORM der Datendateien (nicht die botanische Richtigkeit): data/plants.v1.js (Artenliste), data/releases.v1.js, und die grossen Daten-Literale in index.html (GS_RELEASES, GS_I18N_JS_STRINGS, WEEKLY_SEASONAL_FACTS, GS_QUIZ_FALLBACK_POOL, MENU_ITEMS, GS_NOTIF_ZIELE, Rezepte/Heilmittel, Kulturdaten). (1) Feld-Inventar der Artenliste: je Feld Anzahl und TYPEN (ein Feld, das meist Zahl und manchmal String ist — z.B. tox: "2" — ist ein Fehler, der Code vergleicht mit ===); fast gleiche Feldnamen; Felder mit 1–5 Trägern. (2) Wertebereiche: tox ausserhalb 0–5, edible nicht boolean, Monate ausserhalb 1–12, leere Strings, kaputte Kodierung (Ã¤, �), HTML-Reste. (3) Doppelte ids; identische Dubletten. (4) Widersprüche in sich: edible:true bei tox>=3; tox>=3 ohne warning; cat ausserhalb des bekannten Satzes. (5) GS_RELEASES + Archiv: Reihenfolge neu→alt, doppelte Versionen, Pflichtfelder, user_items als OBJEKTE. (6) GS_I18N_JS_STRINGS: doppelte Schlüssel im QUELLTEXT (der spätere gewinnt still — mit einem Parser lesen). (7) GS_QUIZ_FALLBACK_POOL: genau eine richtige Antwort, keine doppelten Optionen/Fragen. Bekannt und NICHT melden: 167 Dubletten-Gruppen mit widersprüchlicher Giftstufe (docs/arten-widersprueche.csv), 78 % ohne Farb-/Höhenangabe (docs/ARTEN-DATEN.md). Für jeden Fund prüfen, wie der CODE das Feld liest, und sagen, ob die Abweichung auf dem Bildschirm etwas bewirkt.`,
  },
  {
    key: 'android',
    prompt: `Du bist Code-Auditor für GreenScan. Prüfe die Android-Hülle unter android/ (reine android.webkit.WebView, Java ohne AndroidX, gegen android.jar API 23, targetSdk 34). Lies zuerst android/README.md und CLAUDE.md §4d/§4e (bewusste Entscheide: kein addJavascriptInterface; für den eigenen Ursprung nie null aus shouldInterceptRequest; Export-Kanal /__huelle/datei/…; Teilen-Fach Geteilt.java; die Rechnung liegt in Klassen ohne Android-Abhängigkeit). (1) Lebenszyklus und Fäden in MainActivity: WebView-Zugriffe ausserhalb des UI-Fadens, Lecks, onPause/onResume/onDestroy-Symmetrie, Zustand nach Drehung/Prozess-Neustart. (2) Berechtigungs- und Datei-Auswahl-Flüsse: wird JEDER Rückruf in JEDEM Zweig beantwortet? (3) Intent-Behandlung: ungeprüfte Extras, null. (4) shouldInterceptRequest/AssetServer/Pfade: Streams, die nie geschlossen werden, Ausnahmen, die nach aussen dringen. (5) Export.java/Geteilt.java: Grenzen, Überläufe, Nebenläufigkeit. (6) AndroidManifest.xml und build.sh: exported, Berechtigungen ohne Verwendung, allowBackup, Fehlerbehandlung im Skript. Du darfst Java-Dateien nach ${S}/agent/android/ kopieren und dort mit javac gegen /usr/lib/android-sdk/platforms/android-23/android.jar übersetzen bzw. kleine Fahrer ausführen — nicht android/build.sh im Repo und nicht scripts/apk_check.js.`,
  },
]


const WAHL = (args && Array.isArray(args.linsen) && args.linsen.length) ? LINSEN.filter((l) => args.linsen.indexOf(l.key) >= 0) : LINSEN
if (!WAHL.length) { log('keine der genannten Linsen ist bekannt: ' + JSON.stringify(args && args.linsen)); return { zusammen: [], ausgefallen: [] } }
log('Blickwinkel: ' + WAHL.map((l) => l.key).join(', '))
const ergebnisse = await pipeline(
  WAHL,
  (l) => agent(l.prompt + '\n' + REGELN(l.key), { label: 'finden:' + l.key, phase: 'Finden', schema: FUND_SCHEMA }),
  async (fund, l) => {
    const funde = (fund && fund.funde) || []
    if (!funde.length) { log(l.key + ': keine Funde gemeldet'); return { key: l.key, funde: [], urteile: [], zahlen: fund && fund.zahlen, sauber: fund && fund.sauber } }
    log(l.key + ': ' + funde.length + ' Funde → Gegenprüfung')
    const liste = funde.map((f, i) => '[' + i + '] ' + JSON.stringify(f)).join('\n')
    const v = await agent(
      `Du bist GEGENPRÜFER für einen Audit von GreenScan (Pfade relativ zur Repo-Wurzel, deinem Arbeitsverzeichnis). Ein Auditor (Blickwinkel „${l.key}") hat die folgenden Funde gemeldet. Deine Aufgabe: versuche JEDEN Fund zu WIDERLEGEN. Lies die zitierte Stelle selbst (Datei + Zeile; für index.html ggf. die zeilentreue JS-Extraktion ${S}/app.js), dann den Weg dorthin: Wer ruft die Funktion? Steht davor ein Schutz (try/catch, typeof, Helfer wie escHtml/_gsOcStr/gsSanitizeHtml/safeGetItem/_gsSchreibOk, eine Server-Prüfung, RLS)? Ist das Szenario wirklich erreichbar, mit welchem konkreten Wert? Wo es geht, belege durch Ausführen (Node-Mini-Fahrer unter ${S}/agent/${l.key}/gegen/ ; für Datumsfälle TZ=Europe/Zurich mit gestellter Uhr). Im Zweifel: „widerlegt". „teilweise" heisst: der Kern stimmt, aber Schwere, Szenario oder Fix sind falsch — sage dann, was stimmt.

Regeln: NUR LESEN im Repo (nichts ändern, kein zustandsändernder git-Befehl); kein Playwright/Chromium; nicht scripts/pruefstaende.sh; keine MCP-Aufrufe; kein Netz. Höchstens etwa 40 Werkzeugaufrufe. Sprache: Deutsch.

Je Fund ein Urteil: index (wie unten in eckigen Klammern) · urteil (bestaetigt/teilweise/widerlegt) · begruendung (mit Datei:Zeile, was du gelesen/ausgeführt hast) · praeziser_fix (nur bei bestaetigt/teilweise: der kleinste richtige Fix, und welcher Prüfstands-Fall ihn rot/grün zeigen würde).

FUNDE:
${liste}`,
      { label: 'gegen:' + l.key, phase: 'Gegenprüfen', schema: URTEIL_SCHEMA }
    )
    return { key: l.key, funde, urteile: (v && v.urteile) || [], zahlen: fund.zahlen, sauber: fund.sauber }
  }
)

const zusammen = ergebnisse.filter(Boolean).map((r) => {
  const mit = r.funde.map((f, i) => {
    const u = (r.urteile || []).find((x) => x.index === i)
    return Object.assign({}, f, { urteil: u ? u.urteil : 'ungeprueft', gegen: u ? u.begruendung : '', praeziser_fix: u ? u.praeziser_fix : '' })
  })
  return { blickwinkel: r.key, zahlen: r.zahlen, sauber: r.sauber, funde: mit }
})
const n = (k) => zusammen.reduce((a, r) => a + r.funde.filter((f) => f.urteil === k).length, 0)
log('bestätigt ' + n('bestaetigt') + ' · teilweise ' + n('teilweise') + ' · widerlegt ' + n('widerlegt') + ' · ungeprüft ' + n('ungeprueft'))
return { zusammen, ausgefallen: WAHL.filter((l, i) => !ergebnisse[i]).map((l) => l.key) }

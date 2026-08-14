# Security/Code-Audit v30.79 (2026-08-14)

> Scope: `index.html` (~82'000 Zeilen), gemäss `CLAUDE.md` §3.6 (Sicherheit) und
> `CODE_ROUTINE_MASTER.md` Weekly-Audit-Checkliste. Read-only Audit, keine
> Code-Änderungen in diesem Pass.

## Ergebnis-Übersicht

| Check | Ergebnis |
|---|---|
| XSS via `innerHTML` ohne `gsSafeHTML`/Escape | ✅ 0 gefunden (670 innerHTML-Sites geprüft) |
| Hardcoded Secrets/API-Keys | ✅ 0 gefunden |
| Direkte `fetch()` zu `api.anthropic.com` außerhalb `gsTestApiKey`/`callAI` | ⚠️ 2 gefunden |
| TODO/FIXME/XXX/HACK-Tags | ✅ 0 |
| Legacy "Plus"-Plan-Strings außerhalb Kommentaren | ✅ 0 (2 Treffer, beide in Kommentar/Changelog) |
| `z-index: 9999xx` Magic Numbers | ⚠️ 14 (Routine-Ziel: < 5) |
| `console.log` in Prod-Pfad | ✅ 70, alle durch `_gsConsoleCleanup` (Zeile 1616) stumm geschaltet |
| `==`/`!=` statt `===`/`!==` bei Auth/Rolle/Plan-Checks | ✅ 0 gefunden |

## Details

### ⚠️ callAI-Bypass (Medium, kein akuter Sicherheitsbug, aber Konventions-Verstoß)
CLAUDE.md §3.4 verlangt: Anthropic-Calls **immer** über `callAI()`/`callVisionAI()`,
Ausnahme nur `gsTestApiKey()` (Key-Validierung).

- `index.html:26162` — `gsEnrichSpeciesViaAI()` ruft direkt
  `fetch('https://api.anthropic.com/v1/messages', ...)`.
- `index.html:60854` — `_gsKeyHealthWalker(key, opts)` ruft ebenfalls direkt
  `fetch(...)` gegen die Anthropic-API (Key-Health-Check, aber nicht die
  offizielle `gsTestApiKey`-Funktion).

**Impact:** Kein direktes Sicherheitsrisiko (keine Secrets im Code, CSP erlaubt
den Host), aber diese zwei Call-Sites umgehen den zentralen `callAI()`-Layer
(Retry/Backoff/Model-Fallback/Brain-Persona-Injection) — Wartungsrisiko, kein
Fund von akuter Priorität.

**Empfehlung:** Bei Gelegenheit auf `callAI()` migrieren oder — falls
Key-Validierung tatsächlich der Zweck ist — in `gsTestApiKey()` konsolidieren.
Kein Hotfix nötig.

### ⚠️ z-index Magic Numbers (Low, Hygiene)
14 inline `z-index: 9999xxx`-Werte statt `var(--z-*)`-Token, u.a.
`index.html:1851, 14035, 14687, 19205, 27928, 31477, 32880, 56897, 57316,
74683, 75121, 76069`. Changelog (Zeile 65998) zeigt bereits einen früheren
Teil-Fix (94→82 Sites). Kein funktionaler Bug, reine Konsistenz-Baustelle.

### ✅ Keine Funde
XSS, hardcoded secrets, Auth/Rollen-Logikfehler (`==` vs `===`), TODO-Drift,
Legacy-Plan-Strings — alle sauber gegenüber den in CLAUDE.md/CODE_ROUTINE_MASTER.md
dokumentierten Standards.

## Fazit
Keine kritischen oder akuten Sicherheitslücken gefunden. Zwei offene
Follow-ups mit niedriger/mittlerer Priorität (callAI-Bypass, z-index-Tokens) —
kein Hotfix erforderlich, kein User-Impact.

# AI-Proxy aktivieren — Runbook (schließt den Anthropic-Kosten-Leak)

> **Stand (v30.38):** Fundament fertig + verifiziert. NUR der echte Anthropic-Durchlauf
> mit einer User-Session fehlt — das ist dein Preview-Test (Schritt 1). Danach mache
> ICH die Code-Schritte 2–3 auf dein „grün".

## Was schon steht (verifiziert)
- **Edge-Fn `ai-proxy` v2** live: hält den Key server-seitig (aus `app_settings.global_anthropic_api_key`),
  `verify_jwt=true`, Tier-Quota via `ai_usage`, Modell-Whitelist, max_tokens-Cap, Anthropic 1:1.
- **CORS** ✓ (`green-scan.ch` erlaubt, fremde Origin abgelehnt) · **Auth** ✓ (ohne JWT → 401) — server-seitig gecurlt.
- **Alle User-KI-Pfade geroutet:** `callAI` · `callVisionAI` · `sendScanChat` nutzen `_gsAiTarget` →
  Proxy, sobald `localStorage.gs_feat_aiproxy='1'` + globaler Key + eingeloggt. Sonst direkt (heute Default).
- Verbliebene Direkt-Fetches sind nur Key-Tests (müssen direkt bleiben) + totes `gsEnrichSpeciesViaAI`.

---

## Schritt 1 — PREVIEW-TEST (nur du; braucht eine echte Login-Session)
Am einfachsten direkt auf green-scan.ch in DEINEM Browser (betrifft nur dein Gerät):
1. Einloggen (Free-Account zum Testen ideal). DevTools öffnen → Konsole:
   `localStorage.setItem('gs_feat_aiproxy','1'); location.reload();`
2. **Scanner** (Foto bestimmen), **Lina** (Frage), **Pflanzendoktor**, **Scan-Chat** durchspielen.
   - DevTools → Network: jeder KI-Call muss **`POST …/functions/v1/ai-proxy` → 200** sein
     (NICHT `api.anthropic.com`). Ergebnisse müssen korrekt erscheinen (Parsing = identisch).
3. **Quota:** als Free-User >15 Calls am Tag → ab dem 16. **429** „Tageslimit erreicht". In Supabase
   `select count(*) from ai_usage where user_id='<deine-uid>' and day=current_date;` → zählt hoch.
4. **Pro/Lifetime darf NIE geblockt werden** — mit einem Pro-Account gegentesten (Limit 2000).
5. Wieder ausschalten: `localStorage.removeItem('gs_feat_aiproxy'); location.reload();`

**Wenn alles grün → sag mir „AI-Proxy grün".** Dann mache ich Schritt 2 + 3.

## Schritt 2 — Flag für alle aktivieren (ICH, auf dein grün)
Option A (einfach): `gs_feat_aiproxy` standardmäßig an (Frontend, v-Bump). Option B (sauberer,
server-steuerbar ohne Deploy): `_gsAiTarget` liest zusätzlich einen gecachten Server-Flag aus
`app_settings` (Boot-einmal), den du per DB an/aus schaltest. → Ich empfehle B (jederzeit revertbar ohne Deploy).

## Schritt 3 — Roh-Key-Distribution stoppen (ICH, NACH grünem Schritt 2)
Erst wenn der Proxy für alle läuft: `fn_get_global_api_key` gibt den Roh-Key nicht mehr an den Browser
(nur noch an Admin, für die Key-Tests). `getApiConfig`/`callAI`/`callVisionAI`/`sendScanChat`: im Proxy-Modus
kein `cfg.key` mehr verlangen (die `!key`-Guards + `source==='global'`-Erkennung anpassen, sodass das JWT reicht).
**Das schließt den Leak vollständig** (Key liegt dann nur noch server-seitig).

## Schritt 4 — Quota-Konsolidierung (optional, sauber)
Im Proxy-Modus ist die Client-Quota (`gsQuotaPeek`/`Consume` → `feature_usage`) redundant zur Proxy-Quota
(`ai_usage`). Entweder die Client-Peek im Proxy-Modus überspringen ODER den Proxy auf `feature_usage`/`fn_quota_*`
umstellen (konsistente Per-Feature-Limits). Produkt-Entscheidung: 15/Tag **total** (ai_usage) vs. per-Feature.

## Rollback (jederzeit)
- Flag aus (Option A: revert v-Bump / Option B: DB-Flag auf false) → sofort zurück auf Direkt-Pfad.
- Solange Schritt 3 nicht gemacht ist, ist der Direkt-Pfad voll funktionsfähig (Key noch verteilt).

## Reihenfolge-Sicherheit (wichtig)
Schritt 3 (Key-Stop) NUR nach grünem Schritt 2 (Flag an für alle) — sonst hätten Nutzer im Direkt-Pfad
keinen Key mehr → KI bricht. Genau diese Kopplung ist der Grund, warum nicht blind geflippt wird.

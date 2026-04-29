# entitlements — Server-seitige Berechtigungs-Quelle

Liefert dem Client eine konsolidierte Antwort:

```json
{
  "tier": "free",
  "scans_today": 3,
  "scans_limit": 5,
  "scans_remaining": 2,
  "can_scan": true,
  "ai_herbalist": false,
  "recipes_export": false,
  "offline_mode": false,
  "server_time": "2026-04-29T12:00:00Z"
}
```

## Warum?

Vorher: `gsAboCanUse('scan')` zählte aus `localStorage.gs_scans_<today>`.
User konnte das manipulieren → unbegrenzt scannen mit Free-Plan.
Jetzt: Server liest `v_user_entitlements` (Tier) + `ai_usage` (Verbrauch),
liefert authoritatives `can_scan`. Client cached 60s.

## Deploy

```bash
supabase functions deploy entitlements --no-verify-jwt
# Keine zusätzlichen Secrets nötig.
```

## TIER_LIMITS synchronisieren

Die TIER_LIMITS in `entitlements/index.ts` und `ai-proxy/index.ts` müssen
identisch sein, sonst gibt's Inkonsistenzen (Client zeigt „2 Scans übrig",
ai-proxy lehnt aber ab). Bei Anpassung beide Files updaten und beide
Functions neu deployen.

## Test

```bash
curl "https://vowbiueikwrauuceilhc.supabase.co/functions/v1/entitlements" \
  -H "Authorization: Bearer <USER-JWT>"
```

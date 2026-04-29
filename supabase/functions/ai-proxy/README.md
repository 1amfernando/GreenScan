# ai-proxy — Anthropic Claude Proxy (Supabase Edge Function)

Ersetzt den Bring-Your-Own-Key-Flow durch einen Server-seitigen Claude-Aufruf.
User benötigen keinen eigenen Anthropic-Key mehr — der Server hält den Key,
prüft Auth + Tier-Quota und forwarded den Request.

## Vorteile

- **Kein API-Key im Client**: alte Sicherheitsklasse erledigt.
- **Quota pro Tier**: free 5/Tag, plus 200/Tag, pro 2'000/Tag (anpassbar).
- **Modell-Whitelist**: Client kann keine teuren Modelle erzwingen.
- **Token-Cap**: max_tokens ≤ 4096 pro Call.
- **Telemetrie**: jeder Call landet anonymisiert in `ai_usage` (für
  Kostencontrolling im Supabase-Dashboard).

## Setup (einmalig)

### 1 · Supabase CLI installieren
```bash
brew install supabase/tap/supabase   # macOS
# oder npm i -g supabase
supabase --version
```

### 2 · Repo verlinken
```bash
cd <repo-root>
supabase link --project-ref vowbiueikwrauuceilhc
```

### 3 · Migration ausspielen
```bash
supabase db push
# Wendet supabase/migrations/20260429_ai_usage.sql an.
```

### 4 · Anthropic-Key als Secret hinterlegen
```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-XXXXXXX
```

`SUPABASE_URL` und `SUPABASE_ANON_KEY` sind als Edge-Function-Defaults
vorhanden, brauchen kein Secret.

### 5 · Function deployen
```bash
supabase functions deploy ai-proxy --no-verify-jwt
# --no-verify-jwt, weil wir das JWT selbst lesen + an Supabase weitergeben.
```

### 6 · Testen
```bash
curl -X POST "https://vowbiueikwrauuceilhc.supabase.co/functions/v1/ai-proxy" \
  -H "Authorization: Bearer <USER-JWT>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hallo"}],"max_tokens":50}'
```

Erwartete Response: ein gewöhnliches Anthropic-`messages`-Response-JSON.

### 7 · Client umschalten

In der App existieren zwei Pfade:

**(a) BYO-Key** (Default, Bestandskunden behalten):
- User trägt seinen `sk-ant-…`-Key in Settings ein.
- `callAI` ruft `https://api.anthropic.com/v1/messages` direkt.

**(b) Proxy** (neu, opt-in):
- Admin setzt `localStorage.gs_use_proxy = '1'` (oder Setting-UI).
- `callAI` ruft `<SUPABASE>/functions/v1/ai-proxy` mit dem Supabase-JWT.
- User muss eingeloggt sein.

Der Client-Switch ist als Feature-Flag in `index.html` integriert
(siehe `getApiConfig` und `callAI`).

## Tier-Limits anpassen

In `index.ts` → `TIER_LIMITS`:

```ts
const TIER_LIMITS: Record<string, number> = {
  free: 5,
  plus: 200,
  pro: 2000,
  lifetime: 2000,
};
```

Nach Anpassung: `supabase functions deploy ai-proxy`.

## Kosten-Monitoring

Die `ai_usage`-Tabelle erfasst pro Call: `tokens_in`, `tokens_out`, `model`,
`day`. Für ein Tages-Dashboard:

```sql
select day, model, count(*), sum(tokens_in), sum(tokens_out)
from ai_usage
where day >= current_date - interval '7 days'
group by day, model
order by day desc;
```

## Sicherheits-Hinweise

- `--no-verify-jwt`: JWT wird **innerhalb** der Function via
  `supa.auth.getUser()` validiert — RLS-tauglich.
- CORS ist offen (`*`). Wenn du strenger willst, ersetze in `CORS`
  durch `https://greenscan.ch`.
- `ANTHROPIC_API_KEY` ist nur im Edge-Worker zugänglich, nie im Client.
- Bei Modell-Hardcoding: Client kann keine Modelle wählen, die nicht in
  `ALLOWED_MODELS` stehen. Schutz vor Cost-Explosion.

## Rollback

Falls die Function Probleme macht:
```bash
supabase functions delete ai-proxy
```
Der Client fällt automatisch auf BYO-Key zurück (`gs_use_proxy = '0'`).

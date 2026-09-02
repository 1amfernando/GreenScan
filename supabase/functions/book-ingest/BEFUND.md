# `book-ingest` — dokumentiert, NICHT gespiegelt (Stand 02.09.2026, v32.19)

**Ausgeliefert:** `status: ACTIVE`, `version: 9`, `verify_jwt: true`,
zuletzt geändert 29.04.2026, `ezbr_sha256` `611bb9da…`.

## Warum hier kein `index.ts` liegt

Die laufende Fassung hat rund **250 sehr dichte Zeilen** (einzeilige
Hilfsfunktionen, viele eingebettete Zeichenketten mit Maskierungen). Ich habe
sie gelesen, aber ich schreibe sie nicht von Hand ab: eine Abschrift, die ich
„wortgetreu" nenne und die es an einer Stelle nicht ist, wäre schlechter als
gar keine — sie sähe aus wie eine Quelle und wäre keine.

Die vier anderen fehlenden Spiegel (`key-health-check`, `send-receipt`,
`plan-iterate`, `feedback-triage`, `marketplace-publish`) liegen als
wortgetreue Abbilder daneben; die waren kurz genug, um dafür geradezustehen.

## So kommt man an den Quelltext

Über die Supabase-Verwaltungsschnittstelle:
`get_edge_function(project_id, 'book-ingest')` — oder im Dashboard unter
Edge Functions. Wer ihn zieht, legt ihn bitte hier ab und löscht diese Datei.

## Was beim Lesen aufgefallen ist

**Diese Funktion macht es richtig — als einzige.** Sie hat eine
Modell-Rückfallkette:

```ts
const CLAUDE_MODELS = [
  Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-3-5-sonnet-20241022",
];
```

Und sie geht sie wirklich durch: bei `404` auf ein Modell versucht sie das
nächste (`if (res.status === 404) { lastErr = …; continue; }`), und erst wenn
alle scheitern, meldet sie `No working Claude model`.

Die anderen KI-Funktionen haben genau **einen** fest verdrahteten Namen ohne
Rückfall — siehe `STATUS.md` (2026-09-02, df). Wer das dort nachrüstet, hat
hier die Vorlage.

## Zugang

`requireExpertOrAdmin` prüft `profiles.is_expert`, `is_admin` **oder**
`role = 'admin'` — drei Wege, und alle drei existieren in der Tabelle.
Kein Befund.

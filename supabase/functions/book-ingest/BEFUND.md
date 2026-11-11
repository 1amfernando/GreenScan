# `book-ingest` — dokumentiert, NICHT gespiegelt (nachgeprüft 03.09.2026, v32.41)

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
Edge Functions.

### Nachgeprüft am 03.09.2026 (v32.41) — und bewusst NICHT abgelegt

Ich habe den Quelltext über die Verwaltungsschnittstelle gezogen und
gelesen. Der ausgelieferte Stand ist **unverändert**: `version: 9`,
`status: ACTIVE`, `verify_jwt: true`, `ezbr_sha256` `611bb9da…`, zuletzt
geändert 29.04.2026. Die Angaben oben stimmen also weiterhin.

Abgelegt habe ich ihn trotzdem nicht, und der Grund ist ein anderer als
oben — nicht die Länge, sondern die **Nachweisbarkeit**:

> Eine Abschrift ist nur dann eine Quelle, wenn sich MASCHINELL zeigen
> lässt, dass sie mit dem Original übereinstimmt.

Der Text kommt hier als Antwort eines Werkzeugs an; es gibt von hier aus
keinen Weg, ihn ohne meine Hand in eine Datei zu bringen und danach
Byte für Byte gegen das Original zu halten. Der `ezbr_sha256` hilft nicht:
das ist der Hash des gebauten Bündels, nicht der Datei.

Und es geht nicht um eine theoretische Möglichkeit. In dieser Datei stehen
genau die Stellen, an denen eine Abschrift lautlos kippt:

```ts
.replace(/[\u0300-\u036f]/g, "")   // Unicode-Bereich im regulären Ausdruck
```

sowie ein rund 40 Zeilen langer Prompt mit eingebettetem JSON, in dem
Anführungszeichen, Backslashes und `\n` mehrfach verschachtelt sind. Ein
falsches Zeichen dort fällt beim Lesen nicht auf — und wer die Datei später
ausliefert, hätte eine Funktion, die anders arbeitet als die, die im Repo
steht.

**Wer sie ablegt, sollte es mit `supabase functions download book-ingest`
tun** (schreibt die Datei direkt, ohne Abschrift) und diese Datei danach
löschen.

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

Am 03.09.2026 noch einmal am gezogenen Quelltext bestätigt: die Kette steht
unverändert, und der `continue` bei `404` ebenfalls.

## Zugang

`requireExpertOrAdmin` prüft `profiles.is_expert`, `is_admin` **oder**
`role = 'admin'` — drei Wege, und alle drei existieren in der Tabelle.
Kein Befund. (03.09.2026 am Quelltext bestätigt.)

## Schnittstelle — damit die Doku auch ohne Quelltext trägt

Vier Aktionen, alle über `POST` mit `action` im Rumpf oder als
Abfrageparameter; jede verlangt Experte oder Admin:

| Aktion | Was sie tut | Schreibt nach |
|---|---|---|
| `start` | legt einen Import-Auftrag an (Titel Pflicht) | `book_ingest_jobs` |
| `extract` | eine Seite Text → Claude → fünf Arten von Fundstücken | `book_ocr_pages`, `book_species_candidates`, `recipes`, `remedies`, `folk_lore`, `garden_techniques` |
| `merge` | einen Arten-Kandidaten einzeln annehmen oder ablehnen | `species`, `book_species_candidates` |
| `auto_approve` | alle Kandidaten über einer Konfidenzschwelle (Vorgabe 0,85) | dieselben |

Die Zusammenführung läuft über einen `slug`. Seit v7 trägt er bei Rezepten,
Heilmitteln, Folklore und Techniken einen **Unterscheidungs-Anhang** aus einem
zweiten Datenpunkt (erste Zutat, Beschwerde, Region, Kurzbeschreibung) —
sonst würden alle Einträge mit einem allgemeinen Titel wie „Tee"
zusammenfallen. Arten werden über den **lateinischen Namen** zusammengeführt,
nicht über den Slug.

Ein bestehender Eintrag wird beim Zusammenführen **nicht überschrieben**: es
kommt nur eine Quelle dazu, und leere Felder werden gefüllt. Das ist die
richtige Richtung — eine spätere, schlechtere Angabe kann eine frühere,
bessere nicht verdrängen.

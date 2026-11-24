# Die Warteschlange — der Stand der Merge-Reihe an EINER Stelle

> Geführt vom Koordinator (Sitzung `session_011L7GJ9e18Pj3fP3Ly3tNXq`). Gelesen wird sie **ohne PR**:
> `git fetch origin claude/quirky-ritchie-7fkc3f && git show FETCH_HEAD:docs/WARTESCHLANGE.md`
> Jede Sitzung liest sie vor dem Bump und vor jedem „fertig"-Bericht. Eine Nachricht des
> Koordinators ersetzt sie nicht — widerspricht eine Nachricht der Datei, gilt die jüngere
> `Stand:`-Zeile.

**Stand:** 24.11.2026, 14:27 UTC · `main` = `1649859` (**v33.69**, #338) · letzte Änderung: Reihe auf „gestapelt" umgestellt.

## 1 · Warum es schneller wird

Gemessen am 24.11.: eine CI dauert 37 Minuten (13:15 → 13:52), und bisher begann die nächste
Sitzung erst NACH dem Merge der vorigen mit Einziehen, Nummer und Suite. Fünf PRs hintereinander
waren damit rund fünf Stunden. Die Wartezeit steckt nicht in der Arbeit, sondern im Hintereinander.

**Neue Regel: gestapelt, mit paralleler CI.**

1. Die Reihe steht in §2. Sobald der Vorgänger seinen Kopf **gepusht** hat (auch vor seinem Merge), holt der
   Nachfolger `origin/<Vorgänger-Branch>` — nicht `main` — und mergt ihn in den eigenen Branch
   (`git config rerere.enabled true`; `git merge-tree --write-tree HEAD origin/<Vorgänger>` zeigt vorher,
   was kollidiert). Dann Nummer und Kennung der eigenen Zeile, pushen, den Kopf melden.
2. Der Koordinator öffnet für JEDEN Kopf einen PR gegen `main`. Die CI läuft für alle **gleichzeitig**.
3. Gemergt wird in der Reihenfolge von §2 (Squash). Ein Nachfolger braucht **keine zweite CI**, wenn nach dem
   Merge des Vorgängers gilt: `git merge-tree --write-tree origin/main origin/<Kopf>` liefert denselben Baum wie
   `git rev-parse origin/<Kopf>^{tree}` — dann ist der Inhalt, der in `main` landet, byte-gleich mit dem, den die CI
   gesehen hat. Sonst läuft die CI neu.
4. Scheitert die CI eines Vorgängers, **stehen die Nachfolger still**, bis er grün ist oder aus der Reihe genommen
   wird (dann stapeln sie neu). Wer einen schon gestapelten Kopf ändert, meldet es sofort — jeder Nachfolger muss
   neu einziehen.
5. **Lokal läuft nach dem Bump nur:** die berührten Prüfstände + `robust_check` + `austausch_check`
   (CLAUDE.md §7.1: NACH dem Bump, ein Bump kann einen Prüfstand rot machen). Die volle Suite fährt die CI am PR.
   Zweimal dasselbe kostete pro PR 30–40 Minuten.
6. **Der Bump ist ein Skript**, keine Handarbeit: `GS_VERSION`, `meta app-version`, `sw.js VERSION`, `GS_RELEASES`
   (+ Archiv-Umzug auf 20), STATUS-Kopf, §1 und Kennung. Wer es einmal gebaut hat, gibt es dem Nachfolger.
7. Fernando-Pflichten bleiben unverändert (docs/AGENTEN-NETZ.md §4): keine Migration, keine Edge-Function,
   nichts an `.github/`, `_headers`, `_redirects`, `supabase/` ohne ihn.

## 2 · Die Reihe

| Nr | Sitzung | Branch | Version | STATUS-Kennung | Zustand |
|---|---|---|---|---|---|
| 1 | Hauptfunktionen (Pilz · Wissen · Lina 9) | `claude/happy-thompson-24l4uu` | v33.70 | (jr) Pilz · (js) Wissen · (jt) Lina 9 | **PR #343 offen** (Kopf `90863cd`, CI seit 14:25) — Audit stapelt darauf; Folge-Commits nur nach Absprache |
| 2 | Audit | `ccr-dce5a17c-2xzhvi` | v33.71 | (ju) | stapelt auf `90863cd` (Nr. 1) — jetzt dran |
| 3 | KI-Modelle (nur App-Teil) | `claude/blissful-mayer-6fosgo` | v33.72 | (jv) | stapelt auf 2; der Proxy-Teil gehört Fernando |
| 4 | Sicherheit (Speicher · Sync · Backend) | `ccr-5e705a36-jveaak` | v33.73 | (jw) | Entwurf zuerst (Abstimmung), danach stapeln; Restnaht XP aus #338 gehört hierher |
| 5 | Hauptfunktionen · Scanner 12 „Mit Bildern vergleichen" | eigener Branch ab v33.70 (nicht auf dem Kopf von Nr. 1) | v33.74 | (jx) | fertig lokal (7 Fälle grün, 9 Gegenproben rot); gepusht erst nach dem v33.70-Push |
| – | Lina · Einblick (#340) | `claude/lina-einblick-011L7` | nächste freie | nächste freie | **wartet auf Fernando:** die Datenschutz-Freigabe („Standard AN, Wortlaut") ist nicht belegt, die Sitzung ist vom Koordinator nicht erreichbar (untrusted device) |
| – | Brett (#341) | `ccr-b63433a4-d1xgyg` | – | nach (jw) | enthält `.github/workflows/*` und `docs/AGENTEN-NETZ.md` → Fernando; der Werkzeug-Teil kommt als eigener, kleiner PR |

## 3 · Gemergt (neueste zuerst)

| main | Version | Was |
|---|---|---|
| `1649859` | v33.69 | #338 Gelöscht bleibt gelöscht (Löschmarken, `_gsStateMischen`, `gsXpBootSync`, `_gsProfilNachlesen`) |
| `428d78f` | – | #339 Brett-Befund 0df5 (Stripe-Zahlungsweg, nur Doku) |
| `115d389` | v33.68 | #337 Eine Antwort nach dem Abmelden landet nie im nächsten Konto |
| `0485b2d` | v33.67 | #336 Scanner 4 — Scan abbrechen |

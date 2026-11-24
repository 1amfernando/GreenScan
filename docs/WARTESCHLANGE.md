# Die Warteschlange — der Stand der Merge-Reihe an EINER Stelle

> Geführt vom Koordinator (Sitzung `session_011L7GJ9e18Pj3fP3Ly3tNXq`). Gelesen wird sie **ohne PR**:
> `git fetch origin claude/quirky-ritchie-7fkc3f && git show FETCH_HEAD:docs/WARTESCHLANGE.md`
> Jede Sitzung liest sie vor dem Bump und vor jedem „fertig"-Bericht. Eine Nachricht des
> Koordinators ersetzt sie nicht — widerspricht eine Nachricht der Datei, gilt die jüngere
> `Stand:`-Zeile.

**Stand:** 24.11.2026, 19:14 UTC · `main` = `378138c` (**v33.77**, #351 Sicherheit Register) · #352 Hauptfunktionen v33.78 Scanner 14 `dcfb1d2` (CI seit ca. 18:58, fertig ca. 19:37; Test-Merge unterscheidet sich nur um Audits sechs Dateien) → Merge-Commit bei grün · danach Lina 11 neu v33.79 (kg, lokal `cb2a237`; Push als Fast-Forward direkt nach dem Merge von #352; Hold-out des Koordinators parallel zur CI; Merge nur bei „Regressionen 0“) · Sicherheit Scheibe 5 (ruhiger Pull) v33.80 (ki), baut lokal · Brett-Branch (kh).

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
| 1 | Hauptfunktionen (Pilz · Wissen · Lina 9) | `claude/happy-thompson-24l4uu` | **v33.71** | (js) · (jt) · (ju) | **GEMERGT** als `7ca6a19` (#343) |
| 2 | Audit | `ccr-dce5a17c-2xzhvi` | **v33.72** | (jv) | **GEMERGT** als Merge-Commit `06daf91` (#344; CI auf 440f9e5 grün, Baum identisch) |
| 3 | KI-Modelle (nur App-Teil) | `claude/blissful-mayer-6fosgo` | **v33.73** | (jw) | **GEMERGT** als Merge-Commit `bbb5b26` (#346; CI auf 24dd782 grün, Baum identisch); der Proxy-Teil gehört Fernando (FUER-FERNANDO §33) |
| 4 | Hauptfunktionen · Lina · Einblick ehrlich + Scanner 12 + Pilz-Verwechsler (EIN Kopf) | `claude/happy-thompson-24l4uu` | v33.74 | (jx) · (jy) · (jz) · (ka) | **GEMERGT** als Merge-Commit `52a2b93` (#347; CI auf 5844cf6 grün, Baum identisch; zwei Leserfunde vor dem Merge behoben) |
| 5 | Sicherheit (Speicher · Sync · Backend) | `ccr-5e705a36-jveaak` | v33.75 | (kb) | **GEMERGT** als Merge-Commit `1d1019b` (#349; CI auf 255665c grün, Baum identisch); offene Frage für Fernando: Brett e247 (Offline-Foto live im Speicher?) |
| 6 | Hauptfunktionen · Suche 11 (kc) — (kd) zurückgenommen | `claude/happy-thompson-24l4uu` | v33.76 | (kc) | **GEMERGT** als Merge-Commit `ab9ad0f` (#350; CI auf `74baeb6` grün; Lina 11 vor dem Merge zurückgenommen: elf Rückschritte, Leserbefund) |
| 8 | Hauptfunktionen · Scanner 14 (ke) | `claude/happy-thompson-24l4uu` | v33.78 | (ke) | PR **#352**, Kopf **`dcfb1d2`** (auf `a8d5bff` gestapelt; Baum = Test-Merge gegen #351 `f07892f`; Test-Merge gegen main unterscheidet sich nur um Audits sechs Dateien), CI läuft; Merge nach #351 |
| 9 | Sicherheit · Scheibe 3 (Register GS_SPEICHER) | `ccr-5e705a36-jveaak` | v33.77 | (kf) | **GEMERGT** als Merge-Commit `378138c` (#351; CI auf `a8d5bff` grün; Test-Merge unterschied sich nur um Audits sechs Dateien) |
| 10 | Hauptfunktionen · Lina 11 neu (kg) | `claude/happy-thompson-24l4uu` | v33.79 | (kg) | Orakel = Basis `255665c` über alle DB-Namen in zwei Satzformen + Mehrzahl/Genitiv, „nur Basis warnt“ leer; die elf Leser-Sätze als Fälle; jede Heuristik einzeln mit Gegenprobe; Hold-out des Koordinators vor dem Merge |
| 11 | Sicherheit · Scheibe 5 (ruhiger Pull) | `ccr-5e705a36-jveaak` | v33.80 | (ki) | baut lokal auf frischem main; Push erst auf Signal mit der SHA des Vorgängers |
| 7 | Audit · Prüfstände (kein Bump) | `ccr-dce5a17c-2xzhvi` | – | (jv) Nachtrag | **GEMERGT** als Merge-Commit `577850e` (#348; CI auf `6cb8879` grün, Baum identisch) |
| – | Brett (#341) | `ccr-b63433a4-d1xgyg` | – | **(kh)** (nicht (ke): die ist Scanner 14) | enthält `.github/workflows/*` und `docs/AGENTEN-NETZ.md` → Fernando; der Werkzeug-Teil kommt als eigener PR; Kennung vor dem Merge neu rechnen |

**Lehre vom 24.11., 14:50 UTC:** eine Sitzung, die der Koordinator nicht erreicht (Cowork-Sitzung „Linas Wünsche", `untrusted device`), kann sich selbst mergen und die Reihe verschieben. Darum gilt vor JEDEM Merge: `git fetch origin main` und nachsehen, ob `main` noch der Stand ist, auf dem der PR gebaut wurde — sonst zuerst umnummerieren lassen. Die CI auf einem überholten Kopf gilt nicht.

**Vor dem Öffnen eines PRs und vor jedem Push: `git merge-tree --write-tree origin/main <Kopf>` darf KEINEN Konflikt melden.** Hat der Kopf gegen `main` Konflikte, baut GitHub keinen Test-Merge und startet KEINE CI (so bei #346 am 24.11.: 0 Läufe, erst nach `update_pull_request_branch` kam einer). Der Koordinator zieht `main` dann per GitHub in den Kopf, wenn der Baum danach identisch bleibt.

**Merge-Methode für gestapelte PRs: MERGE-COMMIT, nicht Squash** (seit 24.11., 15:50). Ein Squash zerreisst die Vorfahren: der Nachfolger, der auf dem Kopf des Vorgängers steht, sieht danach vier Buchführungs-Konflikte und braucht einen Extra-Push (so bei #343 → #344). Mit einem Merge-Commit enthält `main` den Kopf des Vorgängers samt Geschichte; der Nachfolger merged ohne Konflikt und ohne neuen Lauf.

## 3 · Gemergt (neueste zuerst)

| main | Version | Was |
|---|---|---|
| `378138c` | v33.77 | #351 Sicherheit — Ein Register für alles, was zwischen den Geräten reist (SPEICHER-V2 Scheibe 3; MERGE-COMMIT; CI auf a8d5bff grün) |
| `ab9ad0f` | v33.76 | #350 Hauptfunktionen — Suche 11: Pflanze anlegen auch mit Tippfehlern, und mit der Giftstufe der Art (MERGE-COMMIT; CI auf 74baeb6 grün; Test-Merge unterschied sich nur um Audits sechs Dateien, Kombination lokal gefahren; Lina 11 vor dem Merge zurückgenommen) |
| `577850e` | – | #348 Audit — eine Seite für Fernando, und ein rotes Tor sagt in der CI, wo (MERGE-COMMIT; CI auf 6cb8879 grün, Baum identisch; kein Bump) |
| `1d1019b` | v33.75 | #349 Sicherheit — Track, Pflegeverlauf und das Tagebuch-Foto ohne Empfang (MERGE-COMMIT; CI auf 255665c grün, Baum identisch) |
| `52a2b93` | v33.74 | #347 Hauptfunktionen — Pilz-Verwechsler beim Namen, Bildvergleich, Lina-Einblick ehrlich, zwei Abmelde-Funde (MERGE-COMMIT; CI auf 5844cf6 grün, Baum identisch; drei unabhängige Leser fanden vor dem Merge zwei echte Mängel — Bindestrich-Slugs im Pilz-Register, falscher „Lina bekommt nur deine Frage“-Satz —, beide behoben) |
| `bbb5b26` | v33.73 | #346 KI-Modelle — eine Modellwahl je Verwendung (MERGE-COMMIT; CI auf 24dd782 grün, Baum identisch mit dem PR-Kopf) |
| `06daf91` | v33.72 | #344 Audit — der grosse Durchgang (MERGE-COMMIT; CI auf 440f9e5 grün, Baum identisch mit dem PR-Kopf 9ac3f5e) |
| `7ca6a19` | v33.71 | #343 Pilz-Scanner · Wissen-Tab · Lina 9 (Hauptfunktionen) |
| `8a2f16e` | v33.70 | #340 Lina · Einblick (selbst gemergt von der Cowork-Sitzung „Linas Wünsche“; Nachprüfung als Kommentar auf dem PR) |
| `1649859` | v33.69 | #338 Gelöscht bleibt gelöscht (Löschmarken, `_gsStateMischen`, `gsXpBootSync`, `_gsProfilNachlesen`) |
| `428d78f` | – | #339 Brett-Befund 0df5 (Stripe-Zahlungsweg, nur Doku) |
| `115d389` | v33.68 | #337 Eine Antwort nach dem Abmelden landet nie im nächsten Konto |
| `0485b2d` | v33.67 | #336 Scanner 4 — Scan abbrechen |

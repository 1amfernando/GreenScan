# Speicher, Abgleich und Backend-Naht — nächste Generation (Entwurf)

> Entwurf vom 24.11.2026, Stand `a1cf98b` (v33.69). Auftrag (Fernando): „mehr Effizienz, mehr
> Meilensteine, Backend verbessern; Speicherorte, Verdrahtungen und alles dazu brauchen ein
> Next-Gen-Update." **Gebaut ist Scheibe 1** (Stand unten in §3); alles andere ist Entwurf. Grundlage sind zwei lesende Karten des
> Quelltexts; nichts wurde im Browser oder gegen den Server gemessen. Was ich selbst nachgezählt
> habe, ist mit ✔ markiert, alles andere ist gelesen und braucht zuerst einen roten Prüfstandsfall.

## 1 · Was die Messung zeigt

| Frage | Zahl |
|---|---|
| Schlüssel im Gerätespeicher | 223, mit 351 Schreibstellen; 74 Schlüssel haben mehr als einen Schreiber |
| Stellen, an denen man EINEN neuen reisenden Schlüssel von Hand eintragen muss | **9** (eine Liste: bis zu 13) |
| Felder im state-Blob, die bei zwei Geräten als Ganzes ersetzt werden | 40, mit EINEM Merker „ungesendet" für alle |
| Supabase-Anfragen in den ersten 9 Sekunden nach dem Start | rund 35, etwa 8 davon doppelt |
| Anfragen des Dauer-Abgleichs (alle 2 Minuten und bei jedem Fokus) | 11–12, drei ganze Blobs, rund 330 je sichtbarer Stunde |
| Anteil der Kommentare an der Übertragung von `index.html` | 26 % (490 KB von 1,88 MB gzip) |
| Mindestdauer des Start-Bildschirms, unabhängig vom Gerät | 2,7 s, reine Zeitgeber |

Die neun Handgriffe je Schlüssel sind die Ursache der schwersten Funde: jede Sitzung, die einen
Schlüssel anlegt, vergisst mit einiger Wahrscheinlichkeit eine Stelle. So geschehen bei
`gs_reminder_prefs`, `gs_dq_training`, `gs_kal_filter` — und, neu gefunden, bei den Geräten.

## 2 · Leitidee

**Ein Schlüssel, ein Eintrag.** Ein Speicher-Register beschreibt je reisendem Schlüssel: in
welchem Blob er reist, unter welchem Feldnamen, nach welcher Regel zwei Geräte zusammengeführt
werden, welcher Deckel gilt, und ob er beim Abmelden geht. Es kommt in zwei Schritten, nie als
Umbau in einem Zug:

1. **Erst Deklaration und Prüfung.** Das Register trägt die Regel ein, die HEUTE gilt; ein
   Prüfstandsfall hält Hinweg, Rückweg, Backup und Abmelde-Listen dagegen. Kein Verhalten ändert
   sich. Das allein hätte die Geräte-Lücke gefunden.
2. **Dann je Feld eine bessere Regel**, einzeln, jede mit einem Fall, der vorher rot ist. v33.68
   hat gezeigt, warum: „je Eintrag zusammenführen" ohne Löschmarke holte Gelöschtes zurück.

## 3 · Die Scheiben

Eine Scheibe ist ein PR und eine Version. Reihenfolge: Datenverlust → falsche Aussage → Kosten → Wartung.

| # | Scheibe | Was sich ändert | Fall zuerst (rot gegen heute) | Grösse |
|---|---|---|---|---|
| 1 | **Was aufgezeichnet wird, bleibt** — *gebaut am 24.11.2026* | Ein gespeicherter GPS-Track wird für den Abgleich vorgemerkt (vorher ersetzte der nächste Abgleich die Liste durch die der Cloud — nachgestellt). Eigene Rezepte und Heilmittel tragen ihr Konto: das nächste Konto sieht sie nicht, sein Backup nimmt sie nicht mit, gelöscht werden sie nicht. XP aus einem Offline-Fenster wird beim Nachlesen des Profils nicht doppelt gebucht (Befund des Koordinators zu v33.69). Neue Prüfung „Kein Rückweg ohne Hinweg". **Geräte und Regeln reisen bewusst noch NICHT** — als ganze Liste ersetzte ein Gerät die Geräte des anderen; sie kommen mit Scheibe 4. | `sync_check` H13 (Track), H12 (XP, Cloud 1210 statt 1220), „Kein Rückweg ohne Hinweg" · `sicherheit_check` 98_schluss_e (eigene Rezepte) — H12, H13 und der Rezept-Fall gegen v33.69 rot | klein |
| 2 | **Der Pflegeverlauf verliert nichts und wächst nicht endlos** | Ein Deckel für alle drei Schreiber des Verlaufs, nach Zeit sortiert (heute wirft die nächste Notiz ab 200 Einträgen die NEUESTEN Abhak-Einträge hinaus). Ein Tagebuch-Foto ohne Empfang geht in die Foto-Warteschlange statt als Base64 in die Pflanzenliste. | `kalender_check`: 205 Abhak-Einträge, eine Notiz, der jüngste steht noch da · `sync_check`: im Pflanzen-Blob steht kein `data:image` | klein |
| 3 | **Das Register, erste Stufe** | `GS_SPEICHER`: die 49 Blob-Schlüssel plus die zwei Geräte-Schlüssel mit Blob, Feld, heutiger Regel, Deckel, geht/bleibt. Nur Deklaration und Prüfung in beide Richtungen. | `sync_check` „Register": ein eingetragener Schlüssel ohne Hinweg oder ohne Rückweg ist rot (Gegenprobe mit einem erfundenen Schlüssel) | mittel |
| 4 | **Zwei Geräte, je Feld** | Tagebuch, Friedhof und Saatgut werden je Eintrag zusammengeführt (Stempel und Löschmarke wie Pflanzen). Im state-Blob bekommen die additiven Felder (Erfolge, Quiz-Archiv, Lernkarten) eine eigene Regel statt „der ganze Blob gewinnt". Favoriten erst mit Löschmarke. Geräte und Sensor-Regeln reisen ab hier — je Eintrag nach Id, das Wetter-Gerät höchstens einmal. | `sync_check` „Zwei Geräte": A setzt offline einen Favoriten, B erwirbt einen Erfolg — nach beiden Abgleichen steht beides auf beiden | gross, in zwei PRs |
| 5 | **Ruhiger Abgleich** | Der 2-Minuten-Pull holt nur die drei Zeitstempel und lädt einen Blob erst, wenn er neuer ist. Tagebuch, Ernte, Scans, Rolle und Einstellungen nur bei Anmeldung und nach längerer Abwesenheit. Der Start holt jede Tabelle einmal; vier Anfragen ins Leere entfallen. | `sync_check` „Ruhiger Pull": zweiter Pull ohne Änderung stellt höchstens 3 Anfragen · neuer Fall „Start zählt" hält die Zahl der Start-Anfragen als Deckel | mittel |
| 6 | **Garten-Versand einmal statt dreifach** | Die Warteschlange ersetzt nach Tabelle und Id und reiht nur geänderte Zeilen ein (heute: 3 Gärten und 40 Pflanzungen = 43 Anfragen je Änderung, plus der ganze Blob). Die vier Plan-Wege schreiben über `gsCloudSync` statt die ganze Zeile selbst — das schliesst auch Brett `3dee`. | `sync_check`: eine Pflanzung ändern → genau 1 Upsert · nach „Plan speichern" genau ein Schreiber auf `user_gardens` | mittel |
| 7 | **Start ohne Wartezimmer** | Der Start-Bildschirm endet, sobald die Artenliste da ist, statt nach 2,7 s Zeitgebern; Schritte ohne Wirkung entfallen. Ein Taktgeber pausiert die rund 14 Dauer-Zeitgeber im verborgenen Tab. | `perf_check` bekommt die Spalte „bedienbar" · `robust_check`: jedes Start-Intervall erklärt, ob es verborgen läuft | klein |
| 8 | **Ein Backup, das alles enthält** | Die Export-Datei entsteht aus demselben Bauer wie das Cloud-Backup (heute fehlen ihr Tagebuch, Ernte, Saatgut, Pläne, Fundorte und Favoriten). | `backup_check`: jede Liste aus `GS_LISTEN_EINGANG` steht in der Datei | mittel |
| 9 | **Weniger übertragen** | Rezepte und Heilmittel (376 KB) in eine eigene Datei, im Offline-Vorrat. Erzähl-Kommentare aus `index.html` nach `docs/` — das ist der grösste Hebel (ein Viertel jeder Auslieferung), aber auch der riskanteste Eingriff. | `offline_check`: Rezepte ohne Netz weiter da · `robust_check` „Kommentar-Deckel" | gross, eigene Entscheidung |

### Scheibe 1 — was sie nach zwei Gegenprüfungen enthält, und ihre Grenzen

Zwei Prüfungen haben den ersten Stand der Scheibe korrigiert (ein Gegenprüfer am Diff, eine Lese-Prüfung des
Koordinators an v33.69). Eingebaut, je mit einem Fall, der vorher rot war (`sync_check` H12–H14,
`sicherheit_check` 98_schluss_e):

- **XP:** der Puffer ist `max(Puffer, lokal − Cloud)` — die Differenz allein verlor XP, sobald ein zweites
  Gerät die Cloud inzwischen erhöht hatte. Der Puffer geht beim Abmelden nicht ans nächste Konto.
- **Rezepte:** ein eigenes Rezept wird beim ANLEGEN gestempelt. Bestand ohne Stempel wird **nicht** geraten
  zugeschrieben; er bleibt sichtbar wie bisher, bis das eigene Cloud-Backup ihn als Besitz belegt
  (`gsSnapshotRestore` stempelt, was es zurückbringt). Verborgene Einträge stehen im Speicher vorn, damit die
  eigenen nach dem Wiederanmelden oben bleiben, und überleben „Alle Daten löschen" eines anderen Kontos.
- **Löschmarken:** sie gelten auch im Zweig ohne ungesendete Änderungen und gegen lokale Einträge, nicht für
  `gp_`-Pläne (deren Löschen muss wiederholbar bleiben), und eine Wiederherstellung nimmt sie zurück. Ein Track
  wird nach seinem Beginn gelöscht, nicht nach seiner Stelle in der Liste.

Bewusst offen (steht auf dem Brett bzw. in Scheibe 4):

- Ein schon abgeglichenes Gerät mit ungesendetem state überschreibt weiter, was ein anderes Gerät eintrug.
- Nach einer Track-Aufzeichnung gilt der ganze Garten-Bereich als ungesendet; ein älterer offener Plan
  (`current`) gewinnt dann gegen den neueren der Cloud.
- App-Stände vor v33.69 kennen die zwei neuen Marken-Listen nicht und lassen sie beim Schreiben fallen; das
  Gerät, das gelöscht hat, schreibt sie beim nächsten Abgleich wieder hinein.

Nicht in meinem Bereich, aber gefunden: vier Vollflächen-Fenster (gespeicherte Pläne,
Baum-Planer, Track-Detail, Avatar-Auswahl) hängen an keinem gemeinsamen Weg — Android-Zurück
sieht sie nicht. Das geht als Befund aufs Brett.

## 4 · Backend

Im Repo lässt sich das meiste ohne Server-Änderung bauen (Scheiben 1–9). Drei Dinge brauchen dich:

- **Die fünf Migrationen `20261110_*`** sind fertig und nicht angewandt (FUER-FERNANDO §30). Eine
  hat eine Frist: der XP-Deckel im Quiz, 31.12.2026.
- **Ein Start-Bündel** (`fn_start_buendel`): eine Abfrage statt rund 14 kleiner beim Start. Lohnt
  erst nach Scheibe 5 und braucht eine Migration; ohne sie fällt die App auf die heutigen
  Einzelwege zurück.
- **Das Backend-Inventar** (`docs/backend-inventar.json`) ist vom 02.09. und 83 Tage alt. Es
  nachzuziehen braucht zwei lesende Abfragen an der Live-Datenbank.

## 5 · Bewusst nicht

- Die 351 Schreibstellen auf ein Schreib-Tor umstellen — ein Sweep über den Monolithen, kein Gewinn vor Scheibe 3.
- Die drei Blobs in Supabase in Tabellen je Liste aufteilen — braucht Migrationen und bricht alte App-Stände.
- Eine Build-Pipeline, um Kommentare beim Ausliefern zu entfernen — widerspricht „kein Build, kein npm".

## 6 · Was du entscheidest

1. **Reihenfolge:** einverstanden mit 1 → 2 → 3, oder soll der ruhige Abgleich (5, spart am meisten Datenvolumen) vorgezogen werden?
2. **Hand-Messwerte:** sie liegen nur auf dem Gerät und gehen beim Abmelden. Sollen sie ein Zuhause in der Cloud bekommen?
3. **Kommentare umziehen (Scheibe 9):** ja oder nein — ein Viertel weniger Übertragung gegen einen grossen Eingriff.
4. **Tempo oder Kosten:** eine Scheibe nach der anderen mit kleiner Gegenprüfung (sparsam), oder mehrere parallel mit grossen Agenten-Runden (schneller, teurer).

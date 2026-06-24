# GreenScan → Android-APK / Google Play (TWA) — Anleitung für Fernando

> Die App ist eine PWA und kann ohne Code-Umbau als **echte Android-App (APK/AAB)**
> über eine **Trusted Web Activity (TWA)** verpackt werden. manifest.json + _headers
> sind bereits TWA-tauglich. Der **einzige Blocker** sind die Platzhalter-Fingerprints
> in `.well-known/assetlinks.json` — die kennt man erst **nach** dem Signieren, daher
> muss die Reihenfolge eingehalten werden.
>
> Stand 22.06.2026 · Package-Name (fest): **ch.greenscan.app** · Domain: green-scan.ch

---

## Voraussetzungen (einmalig)
- **Google Play Developer Account** (einmalig ~25 USD): https://play.google.com/console
- Kein Mac/Android-Studio nötig, wenn du **PWABuilder** nimmst (Web-UI).

## Schritt 1 — APK/AAB bauen (einfachster Weg: PWABuilder)
1. https://www.pwabuilder.com öffnen → `https://green-scan.ch` eingeben → **Start**.
2. „Package for Stores" → **Android**.
3. **Package-ID exakt `ch.greenscan.app`** setzen (MUSS so heissen — steht fest in assetlinks.json).
4. Herunterladen: du bekommst ein **`.aab`** (für Play Store) + ein **`.apk`** (zum Direkt-Testen) + einen **`signing.keystore`** + ein **`assetlinks.json`**-Snippet.
5. **WICHTIG: den Signing-Keystore + das Passwort sicher aufbewahren** — Verlust = keine App-Updates mehr möglich.

*(Alternative für Profis: Bubblewrap CLI — `npx @bubblewrap/cli init --manifest https://green-scan.ch/manifest.json` dann `bubblewrap build`.)*

## Schritt 2 — Den SHA-256-Fingerprint holen
- **PWABuilder zeigt ihn dir direkt** in der heruntergeladenen `assetlinks.json` (Feld `sha256_cert_fingerprints`). Das ist der einfachste Fall.
- **ODER aus der Play Console** (wenn du Play-App-Signing nutzt): App → *Test und Veröffentlichung* → *App-Integrität* → *Play-App-Signatur* → SHA-256 des **App-Signaturzertifikats** kopieren (Format `AB:CD:EF:…`).
- Hast du einen separaten Upload-Key: dessen Fingerprint zusätzlich via `keytool -list -v -keystore <pfad>`.

## Schritt 3 — assetlinks.json im Repo aktualisieren (→ Claude/Cowork erledigt das)
In `.well-known/assetlinks.json` die zwei Platzhalter
`REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` und
`REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT` durch die echten SHA-256-Werte ersetzen.
→ **Schick mir den/die Fingerprint(s), dann trage ich sie ein, committe + deploye.**
(Wenn nur ein Play-Managed-Fingerprint existiert: beide Einträge mit demselben Wert
füllen oder den zweiten entfernen.)

## Schritt 4 — Verknüpfung verifizieren
Nach dem Deploy diese URL aufrufen — muss ein „verified" Statement mit `ch.greenscan.app` zeigen:
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://green-scan.ch&relation=delegate_permission/common.handle_all_urls
```
Auf dem Android-Gerät die TWA installieren → **keine Browser-Adressleiste sichtbar = Verknüpfung ok**.
(Chrome cached Asset-Links bis ~24 h — ggf. etwas Geduld.)

## Schritt 5 — Direkt testen oder in den Play Store
- **Nur testen:** die `.apk` aufs Android-Gerät kopieren + installieren (Quelle „unbekannte Apps" erlauben).
- **Play Store:** `.aab` in der Play Console → *Interner Test* hochladen → nach Smoke-Test (Kamera-, Standort-, Push-Prompt prüfen) → *Produktion* promoten.
- **Data-Safety-Formular** ausfüllen: Kamera (Scanner), Standort (Wetter/Regional-Pilze), Benachrichtigungen (Reminder). Screenshots + IARC-Einstufung ergänzen.

## Hinweise
- Reine WebView-Wrapper können von Google abgelehnt werden — eine **TWA mit echtem PWA-Funktionsumfang** (Offline, Push, Scanner) ist i.d.R. unkritisch.
- **iOS:** Es gibt keine „APK". Dort ist die PWA per Safari → „Zum Home-Bildschirm" die native-ähnliche Lösung; ein echter App-Store-Build bräuchte einen Mac + Xcode-Wrapper (separater Aufwand, optional später).
- Nach jedem App-Update musst du NICHTS neu bauen — die TWA lädt immer die aktuelle green-scan.ch (PWA-Updates kommen automatisch).

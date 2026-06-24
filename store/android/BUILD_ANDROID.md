# GreenScan → Android-APK / Play Store (TWA via Bubblewrap)

Diese Konfiguration (`twa-manifest.json`) baut die App als **Trusted Web Activity** —
eine echte Android-App, die green-scan.ch ohne Browser-Leiste lädt. Package: **ch.greenscan.app**.

> **Zwei Wege.** Der **PWABuilder-Weg** (Web-UI, kein Setup) ist am schnellsten — siehe
> `../STORE_SUBMISSION_GUIDE.md`. Der **Bubblewrap-Weg** hier ist reproduzierbar +
> versioniert (die Config lebt im Repo), ideal für wiederholte Releases.

## Voraussetzungen (einmalig)
- **Node 18+** (hast du), **JDK 17**, **Android SDK**. Bubblewrap kann JDK+SDK selbst holen:
  ```bash
  npm i -g @bubblewrap/cli
  bubblewrap doctor      # prüft/installiert JDK 17 + Android SDK
  ```

## Build
Im Ordner `store/android/` (hier liegt die fertige `twa-manifest.json`):

```bash
cd store/android
# Erst-Mal: Android-Projekt aus twa-manifest.json generieren
bubblewrap update           # liest twa-manifest.json → erzeugt/aktualisiert das Projekt
# Bauen + signieren
bubblewrap build
```
- Beim **ersten** `bubblewrap build` fragt es nach einem **Signing-Key**. Lass Bubblewrap
  einen neuen anlegen (Pfad `./android-signing.keystore`, Alias `greenscan-upload` —
  exakt wie in der Config). **Keystore + Passwort sicher sichern** — Verlust = keine
  Updates mehr möglich.
- Ergebnis: **`app-release-signed.apk`** (zum Direkt-Testen auf dem Gerät) +
  **`app-release-bundle.aab`** (für den Play Store).

## Den SHA-256-Fingerprint holen (Pflicht für die Domain-Verknüpfung)
```bash
keytool -list -v -keystore android-signing.keystore -alias greenscan-upload | grep "SHA256:"
```
→ **Diesen Wert an Claude/Cowork geben.** Wir tragen ihn in
`/.well-known/assetlinks.json` ein (ersetzt die Platzhalter) und deployen. Erst dann
verschwindet die Browser-Adressleiste in der installierten App.

Wenn du **Play App Signing** nutzt (empfohlen): zusätzlich den SHA-256 des
*App-Signaturzertifikats* aus der Play Console (App → Test & Veröffentlichung →
App-Integrität → Play-App-Signatur) — den brauchen wir auch in assetlinks.json.

## Verknüpfung prüfen (nach assetlinks-Deploy)
```
https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://green-scan.ch&relation=delegate_permission/common.handle_all_urls
```
Muss ein „verified" Statement mit `ch.greenscan.app` zeigen. Auf dem Gerät:
installierte App ohne Adressleiste = ok (Chrome cached bis ~24 h).

## Versionierung
`twa-manifest.json` hat `appVersionName: "30.31"` + `appVersionCode: 303100`.
Bei jedem neuen Play-Upload muss `appVersionCode` STEIGEN — `bubblewrap update`
erhöht ihn automatisch, oder manuell hochsetzen (Schema major*10000+minor*100).

## Play-Store-Einreichung
`.aab` in der Play Console → interner Test → nach Smoke-Test (Kamera/Standort/Push-
Prompts) → Produktion. Data-Safety-Formular: Kamera (Scanner), Standort (Wetter/
Regional-Pilze), Benachrichtigungen (Erinnerungen). Screenshots liegen in `../../icons/`.

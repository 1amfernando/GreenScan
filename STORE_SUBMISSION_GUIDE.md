# GreenScan → App Stores — Übersicht (Android + Apple)

Die App ist eine PWA. Alles für eine **echte App** ist im Repo vorbereitet; übrig bleiben
nur die unvermeidbar manuellen Schritte (Signing-Key, Store-Accounts, Xcode-Build).

| Plattform | Weg | Aufwand | Status |
|---|---|---|---|
| **iPhone/iPad (sofort)** | PWA → Home-Bildschirm (Safari → Teilen) | 0 — funktioniert jetzt | ✅ fertig |
| **Android-APK / Play Store** | TWA via Bubblewrap **oder** PWABuilder | ~15–30 Min | ⏳ Build + Fingerprint durch dich |
| **Apple App Store** | Capacitor-Wrapper + Xcode | groß (Mac + $99/J + Review) | ⏳ Scaffold liegt bereit |

Detail-Anleitungen:
- **Android:** [`store/android/BUILD_ANDROID.md`](store/android/BUILD_ANDROID.md) (+ fertige `store/android/twa-manifest.json`)
- **Apple/iOS:** [`store/ios/BUILD_IOS.md`](store/ios/BUILD_IOS.md) (+ `store/ios/capacitor.config.json` + `package.json`)

---

## Schnellster Android-Weg (kein Setup): PWABuilder
1. [pwabuilder.com](https://www.pwabuilder.com) → `https://green-scan.ch` → **Android**.
2. Package-ID exakt **`ch.greenscan.app`** (steht so in assetlinks.json).
3. Download: `.aab` (Play Store) + `.apk` (Direkt-Test) + `signing.keystore` + Fingerprint.
4. **Signing-Keystore + Passwort sicher sichern** (Verlust = keine Updates mehr).

## Reproduzierbarer Android-Weg: Bubblewrap
`store/android/twa-manifest.json` ist fertig konfiguriert → siehe `store/android/BUILD_ANDROID.md`.

## Der EINE Schritt, den ich danach übernehme
Beide Wege geben dir einen **SHA-256-Fingerprint**. **Schick ihn mir** — ich ersetze die
Platzhalter in `.well-known/assetlinks.json`
(`REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT` /
`REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT`) und deploye. Erst danach läuft die
Android-App ohne Browser-Adressleiste (Domain-Verknüpfung verifiziert via
digitalassetlinks).

---

## Apple — kurz
- **Jetzt nutzbar:** PWA auf den Home-Bildschirm (Vollbild, Splash, Push iOS 16.4+). Alle
  `<head>`-Tags + 11 Splash-Screens + manifest sind gesetzt.
- **App Store:** braucht Mac + Xcode + Apple Developer ($99/J). Scaffold + Schritte in
  `store/ios/BUILD_IOS.md`. ⚠️ Apple lehnt reine WebView-Wrapper oft ab (Regel 4.2) — die
  App sollte nativen Mehrwert bieten (native Push/Kamera/Offline-Bundle).

## Assets (schon vorhanden in `icons/`)
- Android adaptive: `icon-maskable-512.png` · Android/Web: `icon-192/512.png`
- **Apple App Store Marketing-Icon: `icon-1024.png`** (1024×1024, opak, kein Alpha — Apple-konform)
- iOS Home-Icon: `apple-touch-icon.png` · 11× `apple-splash-*` · Shortcuts · Screenshots

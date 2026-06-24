# GreenScan auf Apple / iOS

Es gibt KEINE „APK" für iOS. Zwei Wege:

## Weg 1 — PWA auf den Home-Bildschirm (sofort, kostenlos, EMPFOHLEN) ✅
Schon **vollständig fertig** — kein Build, kein Account nötig:
- Safari → green-scan.ch → Teilen → „Zum Home-Bildschirm".
- Läuft dann im Vollbild als App-Icon (Edelweiss), mit Splash-Screen, offline-fähig,
  Push (iOS 16.4+). Die `<head>`-Tags (`apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`, 11×
  `apple-touch-startup-image`) + das manifest sind alle gesetzt.
- **Das ist für die allermeisten iPhone-Nutzer die beste Lösung.** Empfiehl es in der App.

## Weg 2 — Echter App-Store-Eintrag (Capacitor-Wrapper)
Braucht zwingend (kann ich NICHT automatisieren):
- **Mac mit Xcode**, **Apple Developer Program** ($99/Jahr), CocoaPods.

> ⚠️ **Apple-Review-Hürde 4.2 („minimum functionality"):** Eine reine Website-im-WebView
> wird oft abgelehnt. Damit der Build durchgeht, sollte die App echten nativen Mehrwert
> bieten (native Push via APNs, native Kamera, Offline-Bundle, Widgets). Plane das ein —
> der Wrapper unten ist der START, nicht das fertige Produkt.

### Schritte
Im Ordner `store/ios/` (hier liegen `capacitor.config.json` + `package.json`):
```bash
cd store/ios
npm install
npm run init:www        # legt einen www/-Stub an (Capacitor braucht webDir)
npx cap add ios         # erzeugt das native Xcode-Projekt
npx cap sync ios
npx cap open ios        # öffnet Xcode
```
In Xcode: Team/Signing setzen (Bundle-ID `ch.greenscan.app`), App-Icon aus
`../../icons/icon-1024` (1024×1024 — ggf. aus icon-512 hochskalieren/neu rendern lassen),
auf echtem Gerät testen, dann Archive → App Store Connect hochladen.

`capacitor.config.json` lädt aktuell die **Live-PWA** (`server.url = https://green-scan.ch`).
Das ist der schnellste Start. Für eine review-sichere App: stattdessen die App **bündeln**
(www/ mit index.html + assets/ + icons/ füllen, `server.url` entfernen) und native
Capacitor-Plugins (@capacitor/camera, @capacitor/push-notifications, @capacitor/geolocation)
einbauen, damit die App nativen Mehrwert hat.

### App Store Connect — Metadaten
Bundle-ID `ch.greenscan.app` · Name „GreenScan" · Datenschutz-Nutzung deklarieren:
Kamera (Scanner), Standort (Wetter/Regional-Pilze), Mitteilungen (Erinnerungen).
Screenshots: `../../icons/screenshot-*` bzw. frische 6.7"/6.5"-Screens.

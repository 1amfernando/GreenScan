# TYPEOF-ALIAS-AUDIT v28.04 (Block D) — Hard-Lesson #9 Fishing

> Erstellt 03.06.2026. Systematischer Cross-Check aller `typeof gsXxx === 'function'`-Guards gegen die echten Funktions-Definitionen. Ziel: silent-Alias-Bugs (Aufruf eines Namens, der nie definiert wurde → Branch läuft jahrelang lautlos ins Leere).

## Methode
```
typeof-Guards (gs*/_gs*/sb*/dq*):  189 eindeutige Symbole
Definierte Funktionen/Zuweisungen: 1315 eindeutige Symbole
→ comm -23 (called-but-not-defined): 6 Kandidaten
```

## Ergebnis: 0 NEUE silent Bugs

Die 6 nicht-gematchten Kandidaten sind alle **harmlose defensive Fallbacks** — in jeder Stelle wird eine ECHTE Funktion zuerst probiert; der nicht-existierende Name ist nur ein optionaler Fallback-Zweig, der korrekt übersprungen wird.

| Symbol | Stelle | Verdikt |
|---|---|---|
| `gsStartCamera` | Kamera-Start-Kette Z.~65940: `tryStartCamera()` → `initCameraStream()` → **gsStartCamera** → `initCamera()` → getUserMedia | ✅ harmlos — `tryStartCamera` (definiert) greift zuerst; Fallback nie erreicht |
| `gsOpenAuthModal` | Z.~58740: `if (openLoginModal) openLoginModal(); else if (gsOpenAuthModal) …` | ✅ harmlos — `openLoginModal` (definiert Z.61715) greift immer |
| `gsLoadGardenWeather` | `gsBroadcastLocationChange` | ✅ harmlos — echter Name `gsLoadGardenWeatherAlerts` wurde v27.03 ergänzt (läuft); + `loadGardenWeather`/`renderGardenWeatherBanner` als Geschwister |
| `gsLoadFarmWeather` | `gsBroadcastLocationChange` | ✅ harmlos — optionaler Broadcast-Hook, typeof-guarded, skip |
| `gsMapRefreshUserLocation` | `gsBroadcastLocationChange` (2×) | ✅ harmlos — optionaler Broadcast-Hook, skip |
| `gsPPloadWeather` | Garten-Planer-Wetter-Preload, typeof-guarded | ✅ harmlos — optionaler Preload, skip (Planer holt Wetter anderweitig) |

## Bereits gefixte echte Aliases (frühere Takes)
- **v27.03:** `gsHTMLEscape` (als Alias dokumentiert, NIE definiert → 8+ Sites nahmen Fallback) → `window.gsHTMLEscape` definiert. · `gsLoadGardenWeather`→`gsLoadGardenWeatherAlerts` im Location-Broadcaster ergänzt (Wetter-Alerts refreshten nie bei Standort-Wechsel).
- **v28.02:** `gsPrefsPush`-Pfad (v26.69-Alias) re-verifiziert ok.

## Fazit
Nach 3 Audit-Pässen (v27.03, v28.02, v28.04) ist die `typeof`-Guard-Landschaft **sauber** — keine offenen silent-Alias-Bugs. Die 6 verbleibenden sind bewusste defensive Fallback-Ketten (kein Bug). Bewusst NICHT entfernt: das Entfernen toter Fallback-Zweige hat marginalen Nutzen bei kleinem Risiko an funktionierendem Code → belassen.

> **VERALTET ab v33.49 — was die Auslieferung angeht.**
>
> Dieses Dokument beschreibt eine **TWA** (Chrome-Huelle, laedt green-scan.ch
> aus dem Netz, braucht zwei Fingerabdruecke aus der Play Console). Gemessen am
> 17.09.2026 ist der Weg aus dieser Umgebung **gar nicht baubar**:
> `dl.google.com` ist gesperrt (403, dieselbe Klasse wie green-scan.ch selbst),
> damit kein Google Maven, damit kein AndroidX, damit weder Bubblewrap noch
> Capacitor. Und er beantwortet Fernandos Auftrag nicht: eine TWA ohne
> gueltige Fingerabdruecke zeigt die Adressleiste — also genau die Webseite in
> einer Huelle.
>
> **Gebaut ist seit v33.49 etwas anderes:** `android/` — eine nackte
> `android.webkit.WebView`, die die App AUS DEM PAKET unter dem echten Ursprung
> `https://green-scan.ch` ausliefert. Offline ab dem ersten Start, nie eine
> Adressleiste, keine Fingerabdruecke noetig. Anleitung: **`android/README.md`**.
> Pruefstand: **`scripts/apk_check.js`** (28 Faelle).
>
> **Was hier gueltig bleibt** und deshalb nicht geloescht wurde: der
> Zurueck-Knopf (§ dazu unten — `gsZurueck`, `GS_VOLLBILD_OVERLAYS`,
> `gsLaeuftAlsApp`), die Risikotabelle (Bezahlen, zwei Auslieferungen,
> Datenschutz-Erklaerung) und der Play-Store-Weg selbst: der Paketname
> `ch.greenscan.app` und `.well-known/assetlinks.json` sind derselbe, eine
> TWA bleibt also spaeter moeglich, NEBEN dem Paket.

# GreenScan als Android-App — Stand, Handgriffe, Risiken

> **Kurz:** GreenScan wird als **TWA** (Trusted Web Activity) zur Android-App —
> dieselbe PWA, in einer Android-Hülle, ohne zweite Codebasis. Der Code ist seit
> **v33.43** so weit; was fehlt, ist **ein Handgriff von Fernando** (zwei
> Fingerabdrücke) und **eine Entscheidung** (Bezahlen in der Play-App).
>
> Prüfstand: `node scripts/android_check.js` — neun Fragen, eine davon steht
> bewusst auf „offen", solange die Fingerabdrücke Platzhalter sind.

---

## 1 · Was eine TWA ist — und was sie nicht ist

Eine TWA ist ein Android-Paket, das **nichts weiter tut, als `green-scan.ch` im
Vollbild zu zeigen** — ohne Adressleiste, mit eigenem Symbol im App-Drawer, aus
dem Play Store installierbar. Es gibt keine zweite Codebasis: was hier im Repo
liegt, ist die App.

Damit Android die Adressleiste weglässt, muss es **nachweisen** können, dass
App und Website zusammengehören. Das ist der einzige Zweck von
`.well-known/assetlinks.json`.

**Was eine TWA nicht mitbringt:** nichts an der App wird dadurch anders —
ausser einer Sache, und die ist die teuerste.

## 2 · Der Zurück-Knopf (seit v33.43 gelöst)

**Gemessen an v33.42:** null Treffer auf `history.pushState`, `popstate` und
`history.back` in der ganzen Datei. Der Android-Zurück-Knopf und die
Wischgeste sprechen mit der Browser-History — und in die schrieb die App
nichts. Wer ein Fenster offen hatte und zurück drückte, **schloss die ganze
App**. Rund vierzig Fenster, elf Tabs. Im Browser fällt das nicht auf, weil es
den Knopf dort nicht gibt.

Seit v33.43:

| Baustein | Was er tut |
|---|---|
| `gsZurueck()` | **Die eine Regel.** Nimmt die OBERSTE Schicht ab — über drei Familien hinweg (dynamische Dialoge · gestapelte `.modal-overlay` · Vollbild-Fenster), danach den Tab. Gibt `overlay` · `modal` · `vollbild` · `tab` · `app` zurück. |
| `popstate` + Escape | **Zwei Auslöser, eine Regel.** Escape schloss bis v33.42 zwei Schichten in einem Druck; jetzt ist ein Druck eine Schicht. |
| `_gsHistSync()` | Genau **ein** Verlaufs-Eintrag, solange es etwas zu schliessen gibt — und er wird zurückgenommen, wenn jemand per X schliesst. Sonst wächst der Stapel bei jedem Öffnen, und jeder überzählige Eintrag ist ein Druck ins Leere. |
| `GS_VOLLBILD_OVERLAYS` | Die acht Vollbild-Fenster, die nicht über `openModal` laufen (Tagesquiz, „Üben", Rangliste, Scan-Verlauf, Wetter, Lichtmesser ×2, Kalibrierung). **Escape erreichte bis v33.42 keines davon.** `gs-onboarding` steht mit Grund in `GS_VOLLBILD_OHNE_ZURUECK`. |

**Die Liste ist die Prüfung:** `android_check` zählt die Vollbild-Fenster im
HTML und verlangt, dass jedes entweder ein `.modal-overlay` ist, in der Liste
steht, oder mit Grund ausgenommen ist.

## 3 · Ein Prädikat für „läuft als App"

Es gab **zwei** Rechnungen, und nur die des Install-Banners kannte die
Android-Hülle (`document.referrer` beginnt dort mit `android-app://`). Seit
v33.43 gibt es `gsLaeuftAlsApp()`; `gsIsStandalonePWA()` ruft sie, der
Install-Banner und der Druck-Rückfall ebenso.

## 4 · Was Fernando tun muss

### 4.1 · Die zwei Fingerabdrücke (blockiert alles andere)

`.well-known/assetlinks.json` liegt im Repo und ist vollständig — **bis auf die
Fingerabdrücke**:

```json
"sha256_cert_fingerprints": [
  "REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT",
  "REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT"
]
```

Beide stehen in der **Play Console** unter *Setup → App-Integrität → App
signing*: einer für den Play-App-Signing-Schlüssel, einer für den
Upload-Schlüssel. Format: 32 Hex-Paare mit Doppelpunkten
(`AB:CD:…`). Ohne sie zeigt Android in der App die Adressleiste — die App sieht
dann aus wie ein Browser-Fenster.

Der Paketname im Repo ist **`ch.greenscan.app`**. Wer ihn in der Play Console
anders wählt, ändert ihn auch hier.

### 4.2 · Das Paket bauen

Es gibt keinen Build-Schritt im Repo und soll auch keinen geben. Das Paket
entsteht ausserhalb, aus dem Manifest:

```
npx @bubblewrap/cli init --manifest https://green-scan.ch/manifest.json
npx @bubblewrap/cli build
```

Bubblewrap liest `manifest.json` (Name, Symbole, `theme_color`,
`background_color`, `start_url`) — die stehen alle schon richtig da.

## 5 · Risiken, die vor dem Einreichen zu klären sind

| Risiko | Warum es zählt | Was zu tun ist |
|---|---|---|
| **Bezahlen** | GreenScan verkauft Pro/Lifetime über **Stripe**. Googles Zahlungsrichtlinie verlangt für digitale Güter in Play-Apps grundsätzlich **Play Billing**. Eine TWA, die Stripe öffnet, kann bei der Prüfung abgelehnt werden. | **Vor dem Einreichen** die aktuelle Richtlinie lesen und entscheiden: Play Billing einbauen, die Bezahlfunktion in der Android-App ausblenden (`gsLaeuftAlsApp()` steht dafür bereit), oder die App ohne Bezahlung einreichen. Das ist eine Geschäftsentscheidung, keine Code-Frage. |
| **Zwei Auslieferungen** | Die App liegt zusätzlich auf Netlify (`green-scanswitzerland`). Wer die PWA von dort installiert, bekommt eine **eigene** Instanz mit **eigenem** localStorage. | Die TWA zeigt `green-scan.ch`. Für Support-Fälle („meine Pflanzen sind weg") bleibt die Doppelauslieferung die erste Frage — siehe `CLAUDE.md` §2.1. |
| **Datenschutz-Erklärung** | Der Play Store verlangt eine öffentlich erreichbare Adresse. | Die Erklärung steht in der App (Footer-Modal), aber **nicht unter einer eigenen URL**. Vor dem Einreichen eine solche Seite anlegen. |
| **Kamera und Standort** | Die TWA erbt die Berechtigungen des Browsers, fragt sie aber im App-Kontext. | Nichts zu tun — beide Wege sind in der App schon mit Begründung vor der Abfrage gebaut. |

## 6 · Was NICHT anders wird

- **Updates.** Eine TWA lädt bei jedem Start die Website. Das „Update ohne
  Klick" aus v33.25 gilt dort genauso — ein neues Deployment ist beim nächsten
  Start da, ohne Play-Store-Update. Ein neues **APK** braucht es nur, wenn sich
  Name, Symbol oder Paketname ändern.
- **Offline.** Der Service Worker arbeitet in der Hülle wie im Browser
  (`offline_check`).
- **Push.** Dieselbe Web-Push-Kette; die Hülle reicht die Benachrichtigungen
  an Android durch.

## 7 · Was dieser Prüfstand NICHT sagt

Hier läuft keine Android-Hülle. `android_check` misst die **Rechnung** — was
die App auf ein `popstate` hin tut — nicht, wie sich ein echtes Gerät verhält.
Und er kann die Fingerabdrücke nicht beschaffen: solange dort Platzhalter
stehen, meldet er „offen" mit Grund, nicht rot. **Eine Zahl ohne Messung wäre
schlimmer als ein offener Punkt.**

# GreenScan als Android-App

Dieses Verzeichnis baut aus GreenScan eine **APK** — eine Android-App zum
Herunterladen und Installieren, ohne Play Store.

```bash
bash android/build.sh                 # Probier-Paket (Wegwerf-Schluessel)
bash android/build.sh --release       # das Paket zum Verteilen (dein Schluessel)
```

Das Ergebnis liegt in `android/build/greenscan-v33.49.apk`.

---

## Was drin ist — und was das aendert

Die App ist **dieselbe `index.html`**. Kein zweiter Quelltext, keine zweite
Wahrheit. Der Unterschied ist, **wo die Dateien liegen**:

| | Webseite / PWA | Android-Paket |
|---|---|---|
| Woher kommt die App? | beim ersten Besuch aus dem Netz | **aus dem Paket** |
| Ohne Empfang beim ersten Start? | leer | **laeuft** |
| Adressleiste? | im Browser ja | **nie** |
| Ursprung | `https://green-scan.ch` | **`https://green-scan.ch`** |

Die letzte Zeile ist der Kern. Die Huelle liefert die Dateien unter dem
**echten** Ursprung aus (`WebViewClient.shouldInterceptRequest`). Deshalb
verhaelt sich drinnen alles wie im Browser: Supabase antwortet auf dieselbe
CORS-Anfrage, die Anmeldung kehrt an dieselbe Adresse zurueck, Stripe sieht
denselben Absender, und die CSP aus `_headers` gilt auch hier — die liest die
Huelle aus der mitgelieferten Datei und setzt sie selbst, sonst liefe die App
im Paket **ohne** Content-Security-Policy und niemand wuerde es merken.

**Am Backend ist nichts zu aendern.** Kein CORS-Eintrag, keine
Redirect-URL, keine Migration.

> **Derselbe Ursprung heisst NICHT dieselben Daten.** Eine WebView hat ihren
> eigenen Speicher, getrennt von Chrome — auch bei gleichem Ursprung. Wer die
> App installiert, findet sie erst einmal leer und meldet sich an; dann holt
> der Abgleich Pflanzen, Gaerten und Einstellungen aus der Cloud. Der gleiche
> Ursprung sorgt dafuer, dass der Speicher der App ueber Updates hinweg
> **derselbe bleibt** und dass am Server nichts anzupassen ist — nicht dafuer,
> dass Browser und App sich einen Speicher teilen. (Dieselbe Support-Frage wie
> bei der zweiten Auslieferung auf Netlify, `CLAUDE.md` §2.1.)

### Sechs Dinge sind anders

Sie stehen in der App in `GS_HUELLE_ANDERS` und auf dem Bildschirm unter
*Einstellungen › Ueber GreenScan*. Jedes hat einen Grund, und jedes wird
gesagt statt verschluckt:

1. **Kein Service Worker.** Das Paket IST der Zwischenspeicher.
2. **Noch keine Push-Nachrichten.** Push haengt am Service Worker.
3. **Updates kommen als neue Datei.** Eine neue Fassung ist eine neue APK.
4. **Export fragt nach dem Speicherort** (seit v33.53). Backup, GPX, CSV,
   Archiv und das 3D-Foto gehen an den Android-Dialog „Speichern unter" —
   statt still im Download-Ordner zu landen. Wer den Dialog schliesst, liest
   „Nicht gespeichert".
5. **Drucken ueber Android** (seit v33.53). Gartenplan und Giess-Zettel gehen
   an den Druckdialog von Android, mit „Als PDF speichern". Ein zweites
   Fenster oeffnet die App dafuer nicht.
6. **Bezahlen im Browser.** Stripe oeffnet im Browser des Telefons.

---

## Was DU tun musst (einmal)

### 1 · Einen Schluessel anlegen — und aufheben

```bash
keytool -genkeypair -v \
  -keystore ~/greenscan-release.keystore \
  -alias greenscan -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=GreenScan, O=GreenScan, L=Zuerich, C=CH"
```

> **Der Schluessel ist unersetzlich.** Android laesst ein Update nur mit
> **derselben** Signatur zu. Verlierst du ihn, kann niemand mehr eine neue
> Fassung ueber die alte installieren — jeder muesste deinstallieren, und die
> Daten der App waeren weg. Lege ihn an zwei Orten ab, die nicht derselbe
> Ort sind. **Er gehoert nicht ins Repo**; `apk_check` Fall R7 prueft das.

### 2 · Damit bauen

```bash
GS_APK_KS=~/greenscan-release.keystore \
GS_APK_KS_PASS='…' \
GS_APK_ALIAS=greenscan \
bash android/build.sh --release
```

### 3 · Zum Herunterladen hinlegen

Die Datei nach `store/` legen und auf `green-scan.ch` verlinken (z. B.
`green-scan.ch/app`). Wer sie auf dem Telefon oeffnet, muss einmal
*„Aus dieser Quelle installieren"* erlauben — das ist bei jeder App so, die
nicht aus dem Play Store kommt.

**Sag die Pruefsumme dazu.** Der Bau schreibt den SHA-256 der Signatur in den
Bericht; wer misstrauisch ist, kann so pruefen, dass die Datei von dir ist.

---

## Was das mit dem Play Store zu tun hat

Nichts — und das ist Absicht. `docs/ANDROID-APK.md` beschreibt den Weg ueber
eine **TWA** in den Play Store. Der bleibt moeglich (der Paketname
`ch.greenscan.app` und `.well-known/assetlinks.json` sind derselbe), braucht
aber die zwei Fingerabdruecke aus der Play Console und stellt die
Zahlungsfrage neu (Play Billing statt Stripe).

Dieses Paket hier braucht **keinen** Fingerabdruck, **keine** Play Console und
**keine** Google-Freigabe. Es ist der Weg, den du wolltest: eine Datei aus dem
Internet.

---

## Bauen ohne dl.google.com

Gemessen am 17.09.2026: `dl.google.com` ist aus der Claude-Cloud gesperrt
(`403`, dieselbe Sperre wie fuer `green-scan.ch` selbst). Damit gibt es dort
kein Google Maven, kein AndroidX — und deshalb **weder Bubblewrap/TWA noch
Capacitor**, denn beide haengen an AndroidX. Die Huelle kommt ohne aus:
reines `android.webkit.WebView`, uebersetzt gegen `android.jar` aus dem
Ubuntu-Archiv.

```bash
apt-get install -y android-sdk-build-tools android-sdk-platform-23 \
                   dalvik-exchange default-jdk unzip
```

`targetSdk` ist **34** (im Manifest), uebersetzt wird gegen **API 23**. Das ist
kein Widerspruch: `targetSdk` ist eine Zahl im Manifest, keine
Bauabhaengigkeit, und die Huelle ruft ausschliesslich Methoden, die es seit
API 23 gibt. Notwendig ist es, weil Android 14 die Installation unter
targetSdk 23 verweigert und Android 15 unter 24.

---

## Die Grenze, und sie steht auch im Pruefstand

**Hier laeuft kein Android.** `apk_check` prueft den BAU (das Paket wird
wirklich gebaut und aufgemacht), die RECHNUNG (`Pfade.java` wird uebersetzt
und ausgefuehrt) und die ENTSCHEIDUNG der App — **nicht**, wie sich ein Telefon
verhaelt. Der erste Start auf einem echten Geraet ist dein Handgriff, und es
ist der einzige, der die restlichen Fragen beantwortet.

Worauf beim ersten Start zu achten ist:

- **Startet die App ohne Netz?** (Flugmodus an, dann oeffnen.) Das ist die
  Frage, fuer die das ganze Paket gebaut ist.
- **Geht die Kamera im Scanner?** (Berechtigung wird beim ersten Scan gefragt.)
- **Der Zurueck-Knopf:** ein Druck schliesst EIN Fenster, nicht die App.
- **Sind deine Pflanzen da?** Nein — das Paket ist eine eigene Installation mit
  eigenem Speicher. Anmelden, dann holt der Abgleich alles aus der Cloud.
- **Speichern und Drucken** (seit v33.53): ein Backup ueber „Speichern unter"
  ablegen, einmal abbrechen (dann „Nicht gespeichert", keine Datei), einen
  Plan als PDF drucken. Die Schritte stehen in `docs/FUER-FERNANDO.md` §26.

---

## Export und Drucken — ohne Bruecke (seit v33.53)

Eine nackte WebView kann eine Datei aus dem Arbeitsspeicher nicht ablegen
(`blob:` erreicht nicht einmal einen DownloadListener), und `window.print()`
tut dort nichts. Der uebliche Ausweg waere `addJavascriptInterface` — den gibt
es hier bewusst nicht (`apk_check` R2). Statt dessen:

```
Seite                                   Huelle (Export.java · AssetServer · MainActivity)
gsDateiSpeichern / gsDrucken
  fetch /__huelle/datei/start   ──►   Riegel pruefen, Spool-Datei anlegen, Schluessel k
  fetch /__huelle/datei/teil×n  ──►   in Reihenfolge anhaengen (mit k)
  fetch /__huelle/datei/fertig  ──►   „Speichern unter" (ACTION_CREATE_DOCUMENT)
                                      oder Druckdialog (DruckAnsicht)
gsHuelleDateiErgebnis(id, z)    ◄──   evaluateJavascript(Export.rueckruf(id, z))
```

- **Die Rechnung liegt in `Export.java`** (kein Android, wie `Pfade.java`):
  Namen saeubern, geschlossener Typen-Katalog, Teile einsammeln, drei Zustaende
  (frei · sammeln · wartet), Deckel 32 MB (Drucken 8 MB). `apk_check`
  uebersetzt sie gegen `android.jar` 23 und faehrt sie aus.
- **Vier Riegel und ein Schluessel**, weil `shouldInterceptRequest` JEDE
  Anfrage sieht: nur GET, nie eine Navigation, nur mit der Kopfzeile
  `X-GS-Huelle`, nur vom eigenen Ursprung — und `teil`/`fertig` brauchen den
  Schluessel aus der `start`-Antwort, die nur lesen kann, wer sie mit `fetch`
  gestellt hat.
- **Was auf einem Telefon schiefgehen kann, ist abgefangen:** die Teile liegen
  in einer Spool-Datei (stirbt der Prozess bei offenem Dialog, wird ein leer
  angelegtes Dokument wieder geloescht), geschrieben wird mit `"wt"` und im
  Hintergrund, ein Dialog nur, wenn die App vorne ist.
- **Keine neue Berechtigung.** „Speichern unter" und Drucken brauchen keine.

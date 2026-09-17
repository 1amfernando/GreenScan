#!/usr/bin/env bash
# GreenScan · Android-Paket bauen.
#
# Aufruf:
#   bash android/build.sh                 → Entwicklungs-Paket (eigener Wegwerf-Schluessel)
#   GS_APK_KS=... GS_APK_KS_PASS=... GS_APK_ALIAS=... bash android/build.sh --release
#
# Was hier NICHT passiert: ein Schluessel wird nie ins Repo geschrieben. Der
# Schluessel, mit dem die verteilte App signiert ist, gehoert Fernando und nur
# ihm — wer ihn verliert, kann kein Update mehr ausliefern, das sich ueber die
# alte App installiert (Android laesst nur dieselbe Signatur zu).
set -euo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HIER/.." && pwd)"
BAU="$HIER/build"
RELEASE=0
[ "${1:-}" = "--release" ] && RELEASE=1

# ---------------------------------------------------------------- Werkzeuge
: "${ANDROID_JAR:=/usr/lib/android-sdk/platforms/android-23/android.jar}"
fehlt=""
for w in javac aapt zipalign apksigner keytool; do
  command -v "$w" >/dev/null 2>&1 || fehlt="$fehlt $w"
done
command -v dalvik-exchange >/dev/null 2>&1 || command -v d8 >/dev/null 2>&1 || fehlt="$fehlt d8/dalvik-exchange"
[ -f "$ANDROID_JAR" ] || fehlt="$fehlt android.jar"
if [ -n "$fehlt" ]; then
  echo "FEHLT:$fehlt" >&2
  echo "Auf Debian/Ubuntu:  apt-get install -y android-sdk-build-tools android-sdk-platform-23 dalvik-exchange default-jdk" >&2
  exit 2
fi
DEXER="$(command -v d8 || command -v dalvik-exchange)"

# ---------------------------------------------------------------- Version
# EINE Quelle: GS_VERSION in index.html. Alles andere wird daraus geschrieben.
VERSION="$(grep -oE "var GS_VERSION *= *'[^']+'" "$REPO/index.html" | head -1 | grep -oE "v?[0-9]+\.[0-9]+")"
[ -n "$VERSION" ] || { echo "GS_VERSION in index.html nicht gefunden" >&2; exit 2; }
VERSION="${VERSION#v}"
MAJOR="${VERSION%%.*}"; MINOR="${VERSION##*.}"
# 33.49 -> 33049. Monoton, solange MINOR unter 1000 bleibt.
VERSION_CODE=$(( 10#$MAJOR * 1000 + 10#$MINOR ))
echo "== GreenScan v$VERSION (versionCode $VERSION_CODE) =="

rm -rf "$BAU"; mkdir -p "$BAU/assets/www" "$BAU/classes" "$BAU/src" "$BAU/out"

# ---------------------------------------------------------------- Dateien ins Paket
# DIE LISTE IST DAS PAKET. Was hier fehlt, fehlt der App ohne Empfang — und
# `apk_check.js` haelt sie gegen das, was index.html und sw.js wirklich laden.
DATEIEN=(
  index.html
  offline.html
  privacy.html
  manifest.json
  _headers
  sw.js
  data/plants.v1.js
  data/releases.v1.js
  assets/leaflet.css
  assets/leaflet.js
  assets/three.min.js
  favicon-16.png
  favicon-32.png
  favicon.ico
  apple-touch-icon.png
)
for f in "${DATEIEN[@]}"; do
  [ -f "$REPO/$f" ] || { echo "Datei fehlt im Repo: $f" >&2; exit 2; }
  mkdir -p "$BAU/assets/www/$(dirname "$f")"
  cp "$REPO/$f" "$BAU/assets/www/$f"
done
# Ganze Verzeichnisse: Symbole und die Leaflet-Bilder (die CSS laedt sie nach).
for d in icons assets/icons assets/leaflet-images; do
  [ -d "$REPO/$d" ] || continue
  mkdir -p "$BAU/assets/www/$d"
  cp -r "$REPO/$d/." "$BAU/assets/www/$d/"
done

PAKET_MB="$(du -sm "$BAU/assets/www" | cut -f1)"
echo "-- Paketinhalt: $(find "$BAU/assets/www" -type f | wc -l) Dateien, ${PAKET_MB} MB roh"

# ---------------------------------------------------------------- Quellen
cp -r "$HIER/src/." "$BAU/src/"
cat > "$BAU/src/ch/greenscan/app/BuildInfo.java" <<EOF
package ch.greenscan.app;

/**
 * Die Version der App — EINE Zahl, und sie kommt aus {@code GS_VERSION} in
 * {@code index.html}. Diese Datei schreibt {@code android/build.sh} bei jedem
 * Bau neu; von Hand geaendert wird sie nie.
 */
final class BuildInfo {
  static final String VERSION = "$VERSION";
  private BuildInfo() {}
}
EOF

sed -e "s/android:versionCode=\"1\"/android:versionCode=\"$VERSION_CODE\"/" \
    -e "s/android:versionName=\"0.0\"/android:versionName=\"$VERSION\"/" \
    "$HIER/AndroidManifest.xml" > "$BAU/AndroidManifest.xml"

# ---------------------------------------------------------------- Uebersetzen
echo "-- javac"
aapt package -f -m -J "$BAU/src" -M "$BAU/AndroidManifest.xml" -S "$HIER/res" -I "$ANDROID_JAR"
javac -source 8 -target 8 -nowarn -encoding UTF-8 \
      -bootclasspath "$ANDROID_JAR" -d "$BAU/classes" \
      $(find "$BAU/src" -name '*.java') 2>&1 \
  | grep -vE "bootstrap class path|source value 8|target value 8|are deprecated|^Note:|^1 warning|^[0-9]+ warnings|Picked up JAVA_TOOL_OPTIONS" || true
[ -n "$(find "$BAU/classes" -name '*.class')" ] || { echo "javac hat nichts erzeugt" >&2; exit 1; }

echo "-- dex"
if [ "$(basename "$DEXER")" = "d8" ]; then
  "$DEXER" --lib "$ANDROID_JAR" --output "$BAU/out" $(find "$BAU/classes" -name '*.class')
else
  "$DEXER" --dex --output="$BAU/out/classes.dex" "$BAU/classes" 2>&1 | grep -v "Picked up JAVA_TOOL_OPTIONS" || true
fi
[ -f "$BAU/out/classes.dex" ] || { echo "kein classes.dex" >&2; exit 1; }

# ---------------------------------------------------------------- Packen
echo "-- packen"
aapt package -f -M "$BAU/AndroidManifest.xml" -S "$HIER/res" -A "$BAU/assets" \
     -I "$ANDROID_JAR" -F "$BAU/out/unsigned.apk"
( cd "$BAU/out" && aapt add -f unsigned.apk classes.dex >/dev/null )

# ---------------------------------------------------------------- Signieren
if [ "$RELEASE" = "1" ]; then
  : "${GS_APK_KS:?--release braucht GS_APK_KS (Pfad zum Schluesselspeicher)}"
  : "${GS_APK_KS_PASS:?--release braucht GS_APK_KS_PASS}"
  : "${GS_APK_ALIAS:?--release braucht GS_APK_ALIAS}"
  KS="$GS_APK_KS"; KSPASS="$GS_APK_KS_PASS"; ALIAS="$GS_APK_ALIAS"
  NAME="greenscan-v$VERSION.apk"
else
  KS="$HIER/.keystore-dev/dev.keystore"; KSPASS="greenscan-dev"; ALIAS="dev"
  if [ ! -f "$KS" ]; then
    mkdir -p "$(dirname "$KS")"
    keytool -genkeypair -keystore "$KS" -storepass "$KSPASS" -keypass "$KSPASS" \
      -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=GreenScan Entwicklung, O=GreenScan, C=CH" 2>&1 | grep -v "Picked up" || true
  fi
  NAME="greenscan-ENTWICKLUNG-v$VERSION.apk"
fi

zipalign -f 4 "$BAU/out/unsigned.apk" "$BAU/out/aligned.apk"
apksigner sign --ks "$KS" --ks-pass "pass:$KSPASS" --key-pass "pass:$KSPASS" \
  --ks-key-alias "$ALIAS" --out "$BAU/$NAME" "$BAU/out/aligned.apk" 2>&1 \
  | grep -v "Picked up JAVA_TOOL_OPTIONS" || true
apksigner verify "$BAU/$NAME" >/dev/null 2>&1 || { echo "Signatur nicht gueltig" >&2; exit 1; }

FP="$(apksigner verify --print-certs "$BAU/$NAME" 2>/dev/null | grep -m1 'SHA-256 digest' | sed 's/.*: //')"
echo
echo "== FERTIG =="
echo "   $BAU/$NAME  ($(du -h "$BAU/$NAME" | cut -f1))"
echo "   SHA-256 der Signatur: $FP"
if [ "$RELEASE" != "1" ]; then
  echo
  echo "   ACHTUNG: Entwicklungs-Schluessel. Dieses Paket ist zum Ausprobieren."
  echo "   Wer es verteilt und SPAETER auf einen eigenen Schluessel wechselt,"
  echo "   zwingt jeden Nutzer zur Neuinstallation — Android laesst ein Update"
  echo "   nur mit DERSELBEN Signatur zu, und die Daten der App sind dann weg."
  echo "   Fuer die Verteilung: einmal einen eigenen Schluessel anlegen"
  echo "   (android/README.md) und mit --release bauen."
fi

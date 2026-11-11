#!/usr/bin/env bash
# pruefstaende.sh — alle Pruefstaende nacheinander, ein Bericht, ein Exit-Code.
#
#   bash scripts/pruefstaende.sh            # alles
#   bash scripts/pruefstaende.sh schnell    # ohne die vier langsamen (contrast, einstellungen, offline, sensor)
#
# Playwright: $GS_PW (Pfad zum playwright-Modul) — in CI scripts/node_modules/playwright,
# in der Claude-Cloud /opt/node22/lib/node_modules/playwright (Vorgabe in den Pruefstaenden).
# Android (apk_check): aapt/apksigner/zipalign/dalvik-exchange + android.jar (Ubuntu-Archiv, NICHT dl.google.com).
# Postgres (quiz_check, schluessel_check, nutzung_check, backup_check, quiz_gen_check): $GS_PG_URL, sonst 127.0.0.1:54329 (scripts/_pg_local.sh).
# Ohne Postgres melden diese beiden „nicht pruefbar" (Exit 2) — hier gilt das als Warnung, nicht als rot.
set -u
cd "$(dirname "$0")/.."
ROT=0; WARN=0; N=0
run() {
  local name="$1"; shift
  N=$((N+1))
  echo "##### $name"
  local aus; aus=$(mktemp)
  "$@" > "$aus" 2>&1
  local rc=$?
  tail -${TAILN:-6} "$aus"
  # v33.53: bei Rot auch die ROTE Zeile zeigen, nicht nur das Ende. Sonst
  # meldet CI „rot: 1" und niemand sieht, welcher Fall — die Zeile stand
  # irgendwo weiter oben, und hier liefen nur die letzten sechs durch.
  if [ "$rc" != 0 ] && [ "$rc" != 2 ]; then
    awk '/^[[:space:]]*(!!|✗|FAIL)/ || (/^[[:space:]]*ROT[[:space:]]/ && !/:[[:space:]]+0$/) { print; if ((getline z) > 0) print z }' "$aus" | head -40 | sed 's/^/  | /'
  fi
  rm -f "$aus"
  if [ "$rc" = 2 ]; then WARN=$((WARN+1)); echo "EXIT=2 (nicht pruefbar)"; elif [ "$rc" != 0 ]; then ROT=$((ROT+1)); echo "EXIT=$rc  <<< ROT"; else echo "EXIT=0"; fi
}
SCHNELL=${1:-}
TAILN=10 run render       node scripts/render_check.js
run wiring       node scripts/wiring_check.js
run a11y         node scripts/a11y_check.js
run touch        node scripts/touch_check.js
run i18n         node scripts/i18n_check.js
run versprechen  node scripts/versprechen_check.js
run storage      node scripts/storage_check.js
run speicher     node scripts/speicher_check.js
run backend      node scripts/backend_check.js
run save         node scripts/save_check.js
run sync         node scripts/sync_check.js
run data         node scripts/data_check.js
# v32.94: `perf_check` lief hier NICHT mit — die Kopfzeile sagte „alles",
# gefahren wurden 30 von 31. Wer das las, hielt die Startzeit fuer abgedeckt.
# Er kostet 27 s und endet IMMER mit 0 (er misst und urteilt nicht), kann den
# Lauf also nicht rot faerben. Die Zahlen schwanken zwischen Laeufen — deshalb
# ist er ein BERICHT, kein Tor; genau so gehoert er hierher.
TAILN=8 run perf  node scripts/perf_check.js
run field        python3 scripts/field_check.py
run planer       node scripts/planer_check.js
run scan         node scripts/scan_check.js
# v33.58: zeigt ein Rezept auf die gemeinte Art und nie auf eine giftige? (reines Node, keine Seite)
run rezept       node scripts/rezept_link_check.js
# v33.58: antwortet die KI noch, wenn Anthropic ein Modell abschaltet? Rechnung + der ECHTE Handler
# von ai-proxy in Node + Quelltext (kein Modellname in einer Edge-Function). Reines Node.
run modell       node scripts/modell_check.js
run ingest       node scripts/ingest_check.js
run sensor_push  node scripts/sensor_push_check.js
run kalender     node scripts/kalender_check.js
run naht         node scripts/naht_check.js
run loeschung    node scripts/loeschung_check.js
run kamera       node scripts/kamera_check.js
run tour         node scripts/tour_check.js
run escape       node scripts/escape_check.js
run robust       node scripts/robust_check.js
run quiz         node scripts/quiz_check.js
run schluessel   node scripts/schluessel_check.js
run nutzung      node scripts/nutzung_check.js
run backup       node scripts/backup_check.js
run quizgen      node scripts/quiz_gen_check.js
run nutzersicht  node scripts/nutzersicht_check.js
run admin        node scripts/admin_check.js
run android      node scripts/android_check.js
# v33.49: baut das Android-Paket wirklich (~40 s) und sieht darin nach.
# Ohne die Android-Werkzeuge: „nicht pruefbar" (Exit 2), nie gruen.
run apk          node scripts/apk_check.js
run risiko       node scripts/risiko_check.js
# v33.59: drei Pruefstaende aus der Sicherheitspruefung vom 10.11.2026. Jeder laedt seine
# Faelle aus einem eigenen Verzeichnis (Dateien mit `_` am Anfang sind Helfer, keine Faelle).
#   sicherheit — kommt Fremdes als Text an? (Playwright, scripts/sicherheit/)
#   edge       — was rechnen die Edge-Functions? (Node, ohne Deno; scripts/edge/)
#   rls        — haelt die Datenbank, was die App ihr glaubt? (lokales Postgres, scripts/rls/;
#                ohne Postgres „nicht pruefbar", Exit 2 — nie gruen)
run sicherheit   node scripts/sicherheit_check.js
run edge         node scripts/edge_check.js
run rls          node scripts/rls_check.js
#   scanfoto   — zeigt die App ein privates Foto nur signiert? (Playwright + lokales Postgres, seit v33.6x)
run scanfoto     node scripts/scan_foto_check.js
# Das Brett, an dem sich die KI-Sitzungen austauschen (docs/austausch/README.md):
# stimmt, was eine Sitzung der naechsten hinterlaesst? Braucht nur Node und git.
run austausch    node scripts/austausch_check.js
if [ "$SCHNELL" != "schnell" ]; then
  TAILN=12 run contrast   node scripts/contrast_check.js
  TAILN=14 run einstellungen node scripts/einstellungen_check.js
  run offline      node scripts/offline_check.js
  run sensor       node scripts/sensor_check.js
fi
echo "##### FERTIG — $N Pruefstaende · rot: $ROT · nicht pruefbar: $WARN"
[ "$ROT" = 0 ]

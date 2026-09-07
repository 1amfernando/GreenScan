#!/usr/bin/env bash
# pruefstaende.sh — alle Pruefstaende nacheinander, ein Bericht, ein Exit-Code.
#
#   bash scripts/pruefstaende.sh            # alles
#   bash scripts/pruefstaende.sh schnell    # ohne die vier langsamen (contrast, einstellungen, offline, sensor)
#
# Playwright: $GS_PW (Pfad zum playwright-Modul) — in CI scripts/node_modules/playwright,
# in der Claude-Cloud /opt/node22/lib/node_modules/playwright (Vorgabe in den Pruefstaenden).
# Postgres (quiz_check, schluessel_check): $GS_PG_URL, sonst 127.0.0.1:54329 (scripts/_pg_local.sh).
# Ohne Postgres melden diese beiden „nicht pruefbar" (Exit 2) — hier gilt das als Warnung, nicht als rot.
set -u
cd "$(dirname "$0")/.."
ROT=0; WARN=0; N=0
run() {
  local name="$1"; shift
  N=$((N+1))
  echo "##### $name"
  "$@" 2>&1 | tail -${TAILN:-6}
  local rc=${PIPESTATUS[0]}
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
run field        python3 scripts/field_check.py
run planer       node scripts/planer_check.js
run scan         node scripts/scan_check.js
run ingest       node scripts/ingest_check.js
run sensor_push  node scripts/sensor_push_check.js
run kalender     node scripts/kalender_check.js
run naht         node scripts/naht_check.js
run kamera       node scripts/kamera_check.js
run tour         node scripts/tour_check.js
run escape       node scripts/escape_check.js
run robust       node scripts/robust_check.js
run quiz         node scripts/quiz_check.js
run schluessel   node scripts/schluessel_check.js
run nutzersicht  node scripts/nutzersicht_check.js
if [ "$SCHNELL" != "schnell" ]; then
  TAILN=12 run contrast   node scripts/contrast_check.js
  TAILN=14 run einstellungen node scripts/einstellungen_check.js
  run offline      node scripts/offline_check.js
  run sensor       node scripts/sensor_check.js
fi
echo "##### FERTIG — $N Pruefstaende · rot: $ROT · nicht pruefbar: $WARN"
[ "$ROT" = 0 ]

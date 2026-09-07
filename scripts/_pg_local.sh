#!/usr/bin/env bash
# _pg_local.sh — ein Wegwerf-Postgres fuer Pruefstaende, die SQL wirklich
# ausfuehren wollen (quiz_check.js). Kein Bezug zur Produktivdatenbank.
#
#   bash scripts/_pg_local.sh start    # initdb (einmal) + starten, Port 54329, nur 127.0.0.1
#   bash scripts/_pg_local.sh stop
#   bash scripts/_pg_local.sh status
#
# Braucht ein installiertes Postgres 16 (Debian/Ubuntu: /usr/lib/postgresql/16).
# Laeuft als Nutzer `postgres`, wenn das Skript als root aufgerufen wird —
# initdb verweigert root. Der Cluster liegt unter $GS_PG_DIR (Vorgabe:
# /var/lib/postgresql/gs_pruefstand). Die Pruefstaende verbinden ueber
# $GS_PG_URL (Vorgabe: postgresql://postgres@127.0.0.1:54329/postgres).
set -u
BIN="${GS_PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="${GS_PG_DIR:-/var/lib/postgresql/gs_pruefstand}"
PORT="${GS_PG_PORT:-54329}"
if [ -z "$BIN" ] || [ ! -x "$BIN/pg_ctl" ]; then echo "kein Postgres gefunden (GS_PG_BIN setzen)"; exit 2; fi
als() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
case "${1:-status}" in
  start)
    if [ ! -f "$DIR/PG_VERSION" ]; then
      als "mkdir -p '$DIR' && '$BIN/initdb' -D '$DIR' -A trust -U postgres >/dev/null" || exit 1
    fi
    als "'$BIN/pg_ctl' -D '$DIR' -o \"-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=''\" -l '$DIR.log' start" >/dev/null || exit 1
    echo "laeuft: postgresql://postgres@127.0.0.1:$PORT/postgres" ;;
  stop)   als "'$BIN/pg_ctl' -D '$DIR' stop -m fast" >/dev/null 2>&1; echo "gestoppt" ;;
  status) als "'$BIN/pg_ctl' -D '$DIR' status" ;;
  *) echo "start | stop | status"; exit 2 ;;
esac

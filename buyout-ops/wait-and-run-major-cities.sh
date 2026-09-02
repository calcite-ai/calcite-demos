#!/usr/bin/env bash
# Incremental major-cities overnight: append bulks as they land, scan+pipeline at end
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=/tmp/buyout-major-cities-coordinator.log
BULKS=(
  buyout-ops/seeds/koumuten_major_cities_bulk_hokkaido_tohoku.csv
  buyout-ops/seeds/koumuten_major_cities_bulk_hokkaido_tohoku_expand.csv
  buyout-ops/seeds/koumuten_major_cities_bulk_kanto_outer.csv
  buyout-ops/seeds/koumuten_major_cities_bulk_chubu.csv
  buyout-ops/seeds/koumuten_major_cities_bulk_kansai.csv
  buyout-ops/seeds/koumuten_major_cities_bulk_west.csv
)
CHAMBER_BULKS=(
  buyout-ops/seeds/koumuten_major_cities_chamber_hokkaido_tohoku.csv
  buyout-ops/seeds/koumuten_major_cities_chamber_chubu.csv
  buyout-ops/seeds/koumuten_major_cities_chamber_kansai.csv
  buyout-ops/seeds/koumuten_major_cities_chamber_west.csv
)
echo "coordinator v2 (max-per-city) start $(date -Iseconds)" | tee "$LOG"

APPENDED=()
for i in $(seq 1 180); do
  for f in "${BULKS[@]}"; do
    if [ -f "$f" ] && [ "$(wc -l < "$f" | tr -d ' ')" -gt 1 ]; then
      key=$(basename "$f")
      if [[ " ${APPENDED[*]:-} " != *" $key "* ]]; then
        node buyout-ops/append-major-cities-maps.mjs "$f" | tee -a "$LOG" || true
        APPENDED+=("$key")
      fi
    fi
  done
  for f in "${CHAMBER_BULKS[@]}"; do
    if [ -f "$f" ] && [ "$(wc -l < "$f" | tr -d ' ')" -gt 1 ]; then
      key=$(basename "$f")
      if [[ " ${APPENDED[*]:-} " != *" $key "* ]]; then
        node buyout-ops/append-major-cities-chamber.mjs "$f" | tee -a "$LOG" || true
        APPENDED+=("$key")
      fi
    fi
  done
  ready=${#APPENDED[@]}
  echo "poll $i: appended $ready bulks" | tee -a "$LOG"
  # All map/chamber bulks are usually landed within 30 min; don't wait for a fixed count of 8
  if [ "$i" -ge 30 ]; then break; fi
  sleep 60
done

bash buyout-ops/run-major-cities-overnight.sh 2>&1 | tee -a "$LOG"
echo "coordinator v2 done $(date -Iseconds)" | tee -a "$LOG"

#!/usr/bin/env bash
# Overnight: merge major-city maps seeds → scan → pipeline
set -euo pipefail
cd "$(dirname "$0")/.."
LOG=/tmp/buyout-major-cities-overnight.log
echo "=== start $(date -Iseconds) ===" | tee "$LOG"

node buyout-ops/build-major-cities-assoc.mjs | tee -a "$LOG"
node buyout-ops/merge-seed-files.mjs | tee -a "$LOG"
node buyout-ops/major-cities-maps-coverage.mjs | tee -a "$LOG"

PENDING=$(node -e "
import fs from 'fs';
import { parseCsv } from './buyout-ops/csv-util.mjs';
const seeds=parseCsv(fs.readFileSync('buyout-ops/seeds/koumuten_urls.csv','utf8')).rows;
const scan=parseCsv(fs.readFileSync('buyout-ops/prospect_pipeline/scan_results.csv','utf8')).rows;
const norm=u=>(u||'').trim().toLowerCase().replace(/\\/\$/,'');
const scanned=new Set(scan.map(r=>norm(r.url)));
const maps=parseCsv(fs.readFileSync('buyout-ops/seeds/koumuten_major_cities_maps.csv','utf8')).rows;
const mapSet=new Set(maps.map(r=>norm(r.url)));
console.log(seeds.filter(s=>mapSet.has(norm(s.url))&&!scanned.has(norm(s.url))).length);
")
echo "pending major-cities scan: $PENDING" | tee -a "$LOG"

if [ "$PENDING" -gt 0 ]; then
  caffeinate -i node buyout-ops/prospect-scan-batch.mjs --sleep-ms 2000 2>&1 | tee -a "$LOG"
fi

node buyout-ops/run-campaign-pipeline.mjs --skip-scan 2>&1 | tee -a "$LOG"
node buyout-ops/prepare-review-sheet.mjs 2>&1 | tee -a "$LOG"
node buyout-ops/major-cities-maps-coverage.mjs | tee -a "$LOG"
echo "=== done $(date -Iseconds) ===" | tee -a "$LOG"

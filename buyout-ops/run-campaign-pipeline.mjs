#!/usr/bin/env node
/**
 * キャンペーン振り分けパイプライン（merge → enrich → split → buyout review）
 *
 * Usage:
 *   node buyout-ops/run-campaign-pipeline.mjs
 *   node buyout-ops/run-campaign-pipeline.mjs --scan   # 未スキャン種URLも夜間バッチ
 *   node buyout-ops/run-campaign-pipeline.mjs --scan --sleep-ms 1200
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function run(label, script, extraArgs = []) {
  console.log(`\n>>> ${label}`);
  const r = spawnSync("node", [path.join(__dirname, script), ...extraArgs], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) {
    console.error(`FAIL ${script} exit=${r.status}`);
    process.exit(r.status || 1);
  }
}

const sleepMs = arg("sleep-ms", "1200");

run("merge seeds", "merge-seed-files.mjs");

if (process.argv.includes("--scan")) {
  run("prospect scan", "prospect-scan-batch.mjs", ["--sleep-ms", sleepMs]);
}

run("campaign enrich (inside)", "enrich-scan-campaign.mjs", ["--sleep-ms", sleepMs]);
run("split tracks", "split-scan-tracks.mjs");
run("buyout review sheet", "prepare-review-sheet.mjs");

console.log("\n=== pipeline done ===");
console.log("Buyout: prospect_pipeline/review_queue.csv → owner_ok=y → import-review-approvals.mjs");
console.log("Inside: prospect_pipeline/inside_sales_review_queue.csv → owner_campaign + owner_ok=y → import-inside-approvals.mjs");

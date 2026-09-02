#!/usr/bin/env node
/**
 * Summarize demo click log (downloaded from calcite-mail.jp).
 *
 * Usage:
 *   node buyout-ops/demo-click-report.mjs
 *   node buyout-ops/demo-click-report.mjs --file path/to/demo-clicks.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const file =
  arg("file") ||
  path.join(__dirname, "outreach-domain-site/demo/_data/demo-clicks.csv");

if (!fs.existsSync(file)) {
  console.log(`No log yet: ${file}`);
  console.log("ConoHa から demo/_data/demo-clicks.csv をダウンロードして再実行");
  process.exit(0);
}

const text = fs.readFileSync(file, "utf8");
const { rows } = parseCsv(text);
const counts = new Map();
for (const r of rows) {
  const p = r.path || r.key;
  if (!p || p === "path") continue;
  counts.set(p, (counts.get(p) || 0) + 1);
}

const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
console.log(`=== demo clicks (${rows.length} events) ===`);
for (const [p, n] of sorted) console.log(`${n}\t${p}`);
if (!sorted.length) console.log("(none)");

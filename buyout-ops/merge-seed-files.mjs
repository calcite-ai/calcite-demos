#!/usr/bin/env node
/**
 * Merge seed CSV files into seeds/koumuten_urls.csv (dedupe by url).
 * Usage: node buyout-ops/merge-seed-files.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const outPath = path.join(seedsDir, "koumuten_urls.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const files = fs
  .readdirSync(seedsDir)
  .filter(
    (f) =>
      f.endsWith(".csv") &&
      f !== "koumuten_urls.csv" &&
      f !== "koumuten_kanto_municipalities.csv" &&
      f !== "koumuten_major_cities_master.csv"
  )
  .map((f) => path.join(seedsDir, f));

let rows = [];
if (fs.existsSync(outPath)) {
  rows = parseCsv(fs.readFileSync(outPath, "utf8")).rows;
}

const seen = new Set(rows.map((r) => r.url));
let added = 0;

for (const file of files) {
  const { rows: extra } = parseCsv(fs.readFileSync(file, "utf8"));
  for (const r of extra) {
    if (!r.url?.startsWith("http") || seen.has(r.url)) continue;
    seen.add(r.url);
    rows.push({
      company: r.company,
      url: r.url,
      prefecture: r.prefecture || "",
      source: r.source || path.basename(file, ".csv"),
    });
    added++;
  }
}

fs.writeFileSync(outPath, serializeCsv(HEADER, rows) + "\n");
console.log(`RESULT merged ${added} new → ${outPath} (total ${rows.length})`);

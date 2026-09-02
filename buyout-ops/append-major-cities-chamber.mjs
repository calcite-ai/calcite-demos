#!/usr/bin/env node
/**
 * Append verified chamber/assoc rows to koumuten_major_cities_chamber.csv
 * Usage: node buyout-ops/append-major-cities-chamber.mjs path/to/bulk.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "seeds", "koumuten_major_cities_chamber.csv");
const urlsPath = path.join(__dirname, "seeds", "koumuten_urls.csv");
const assocPath = path.join(__dirname, "seeds", "koumuten_major_cities_assoc.csv");
const HEADER = ["company", "url", "prefecture", "source"];

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

const existing = new Set();
for (const p of [outPath, urlsPath, assocPath, path.join(__dirname, "seeds", "koumuten_major_cities_maps.csv")]) {
  if (!fs.existsSync(p)) continue;
  for (const r of parseCsv(fs.readFileSync(p, "utf8")).rows) {
    if (r.url) existing.add(norm(r.url));
  }
}

const rows = fs.existsSync(outPath)
  ? parseCsv(fs.readFileSync(outPath, "utf8")).rows
  : [];
const seen = new Set(rows.map((r) => norm(r.url)));
const bulkPath = process.argv[2];
if (!bulkPath) {
  console.error("Usage: node append-major-cities-chamber.mjs <bulk.csv>");
  process.exit(1);
}
let added = 0;
for (const r of parseCsv(fs.readFileSync(bulkPath, "utf8")).rows) {
  const url = (r.url || "").trim();
  if (!url.startsWith("http")) continue;
  const nu = norm(url);
  if (seen.has(nu) || existing.has(nu)) continue;
  rows.push({
    company: r.company,
    url,
    prefecture: r.prefecture || "",
    source: r.source || "chamber_member",
  });
  seen.add(nu);
  added++;
}
fs.writeFileSync(outPath, serializeCsv(HEADER, rows) + "\n");
console.log(`RESULT added ${added} total ${rows.length}`);

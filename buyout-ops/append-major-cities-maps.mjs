#!/usr/bin/env node
/**
 * Append verified bulk rows to koumuten_major_cities_maps.csv
 * Usage: node buyout-ops/append-major-cities-maps.mjs path/to/bulk.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const mapsPath = path.join(seedsDir, "koumuten_major_cities_maps.csv");
const urlsPath = path.join(seedsDir, "koumuten_urls.csv");
const HEADER = ["company", "url", "prefecture", "source"];

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

const existing = new Set();
for (const p of [mapsPath, urlsPath, path.join(seedsDir, "koumuten_kanto_maps.csv")]) {
  if (!fs.existsSync(p)) continue;
  for (const r of parseCsv(fs.readFileSync(p, "utf8")).rows) {
    if (r.url) existing.add(norm(r.url));
  }
}

const maps = parseCsv(fs.readFileSync(mapsPath, "utf8")).rows;
const seen = new Set(maps.map((r) => norm(r.url)));
const bulkPath = process.argv[2];
if (!bulkPath) {
  console.error("Usage: node append-major-cities-maps.mjs <bulk.csv>");
  process.exit(1);
}
const bulk = parseCsv(fs.readFileSync(bulkPath, "utf8")).rows;
let added = 0;
for (const r of bulk) {
  const url = (r.url || "").trim();
  if (!url.startsWith("http")) continue;
  const nu = norm(url);
  if (seen.has(nu) || existing.has(nu)) continue;
  maps.push({
    company: r.company,
    url,
    prefecture: r.prefecture || "",
    source: r.source || "maps_research",
  });
  seen.add(nu);
  added++;
}
fs.writeFileSync(mapsPath, serializeCsv(HEADER, maps) + "\n");
console.log(`RESULT added ${added} total ${maps.length}`);

#!/usr/bin/env node
/**
 * Build seed URL list from buyout-ops/sales_prospects.csv (工務店・メール未確認).
 *
 * Usage:
 *   node buyout-ops/extract-seeds-from-prospects.mjs
 *   node buyout-ops/extract-seeds-from-prospects.mjs --merge   # append new rows only
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const merge = process.argv.includes("--merge");
const prospectsPath = path.join(__dirname, "sales_prospects.csv");
const outPath = path.join(__dirname, "seeds", "koumuten_urls.csv");

const KOUMUTEN =
  /工務|工務店|建設会社|総合建設|建築(?!士)|工房|リフォーム|解体|型枠|塗装|屋根/i;
const NOT_KOUMUTEN = /税理士|会計|葬儀|司法|行政|士業|整骨|鍼灸/i;

function isKoumutenIndustry(industry) {
  const t = industry || "";
  if (NOT_KOUMUTEN.test(t)) return false;
  return KOUMUTEN.test(t);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQ = false;
    for (const c of line) {
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    const o = {};
    headers.forEach((h, i) => {
      o[h.trim()] = (cols[i] ?? "").trim();
    });
    return o;
  });
}

const rows = parseCsv(fs.readFileSync(prospectsPath, "utf8"));
const seeds = rows
  .filter((r) => isKoumutenIndustry(r["業種"]))
  .filter((r) => (r["HP URL"] || "").startsWith("http"))
  .filter((r) => !/^除外/.test(r["ランク"] || ""))
  .map((r) => ({
    company: r["社名"],
    url: r["HP URL"],
    prefecture: (r["エリア"] || "").replace(/市.*$/, "").slice(0, 20),
    source: "sales_prospects",
  }));

let existing = new Set();
if (merge && fs.existsSync(outPath)) {
  const old = parseCsv(fs.readFileSync(outPath, "utf8"));
  for (const r of old) existing.add(r.url);
}

const header = "company,url,prefecture,source\n";
let out = merge && fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : header;
if (!out.endsWith("\n")) out += "\n";

let added = 0;
for (const s of seeds) {
  if (merge && existing.has(s.url)) continue;
  out += `${s.company},${s.url},${s.prefecture},${s.source}\n`;
  added++;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log(`RESULT ${added} seeds → ${outPath} (total lines ~${out.split("\n").length - 1})`);

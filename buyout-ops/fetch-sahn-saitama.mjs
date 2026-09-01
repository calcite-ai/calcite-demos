#!/usr/bin/env node
/**
 * 埼玉県住まいづくり協議会 — リフォーム登録事業者一覧 (page_id=148)
 * → seeds/koumuten_saitama_sahn.csv
 *
 * Usage: node buyout-ops/fetch-sahn-saitama.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIST_URL = "https://www.sahn.jp/?page_id=148";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; CalciteBuyoutSeed/1.0)" };

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRows(html) {
  const rows = [];
  const seen = new Set();
  const skipHost =
    /sahn\.jp|facebook|twitter|instagram|youtube|google|maps\.|w3\.org|w\.org|line\.me|pref\.saitama\.lg\.jp|saitama-anshin/i;

  for (const m of html.matchAll(
    /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*(?:target="_blank"[^>]*)?>([\s\S]*?)<\/a>/gi
  )) {
    const url = m[1].replace(/&amp;/g, "&");
    const company = decodeHtml(m[2].replace(/<[^>]+>/g, ""));
    if (!company || !/^https?:\/\//.test(url)) continue;
    if (skipHost.test(url)) continue;
    if (!/株式会社|有限会社|合同会社|工務|建設|ホーム|住宅|建築|リフォーム|工房|店|組/i.test(company)) {
      continue;
    }
    const key = url.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ company, url, prefecture: "埼玉", source: "sahn_reform_member" });
  }

  return rows;
}

async function main() {
  const res = await fetch(LIST_URL, {
    headers: UA,
    redirect: "follow",
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    console.error(`FAIL HTTP ${res.status} ${LIST_URL}`);
    process.exit(1);
  }
  const html = await res.text();
  const rows = extractRows(html);
  const outPath = path.join(__dirname, "seeds/koumuten_saitama_sahn.csv");
  fs.writeFileSync(outPath, serializeCsv(["company", "url", "prefecture", "source"], rows) + "\n");
  console.log(`RESULT ${rows.length} rows → ${outPath}`);
  for (const r of rows.slice(0, 8)) console.log(" ", r.company, r.url);
  process.exit(rows.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

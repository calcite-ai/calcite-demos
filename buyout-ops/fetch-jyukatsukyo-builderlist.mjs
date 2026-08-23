#!/usr/bin/env node
/**
 * 住活協 builderlist ページから 社名+公式URL を抽出 → seeds/koumuten_jyukatsukyo_live.csv
 *
 * Usage:
 *   node buyout-ops/fetch-jyukatsukyo-builderlist.mjs --pages 50 --sleep-ms 1500
 *   node buyout-ops/fetch-jyukatsukyo-builderlist.mjs --pref 東京都
 *
 * 2026-08-23: builderlist/?pref= および /page/N/ が 404 の場合あり。
 * そのときは seeds/koumuten_jyukatsukyo_pref_cache.csv（手動/cache）を使う。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "seeds", "koumuten_jyukatsukyo_live.csv");
const BASE = "https://www.jyukatsukyo.or.jp/builderlist/";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sleepMs = Number(arg("sleep-ms", "1500"));
const maxPages = Number(arg("pages", "0")) || Infinity;
const pref = arg("pref", "");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseBlocks(html) {
  const rows = [];
  const blockRe = /\|\s*社名\s*\|\s*([^|]+)\s*\|[\s\S]*?\|\s*住所\s*\|\s*([^|]+)\s*\|[\s\S]*?\|\s*URL\s*\|\s*([^|]*)\s*\|/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const company = m[1].trim();
    const address = m[2].trim();
    let url = m[3].trim();
    if (url && !url.startsWith("http")) url = "";
    const prefMatch = address.match(/(...??[都道府県])/);
    rows.push({
      company,
      url,
      prefecture: prefMatch ? prefMatch[1] : "",
      source: "jyukatsukyo_live",
    });
  }
  return rows;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CalciteProspect/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) return { ok: false, status: res.status, html: "" };
  return { ok: true, status: res.status, html: await res.text() };
}

async function main() {
  const seen = new Set();
  const all = [];

  const urls = [];
  if (pref) {
    urls.push(`${BASE}?pref=${encodeURIComponent(pref)}`);
    for (let p = 2; p <= maxPages; p++) {
      urls.push(`${BASE}?pref=${encodeURIComponent(pref)}&page=${p}`);
    }
  } else {
    for (let p = 1; p <= maxPages; p++) {
      urls.push(p === 1 ? BASE : `${BASE}page/${p}/`);
    }
  }

  for (const url of urls) {
    process.stdout.write(`fetch ${url} … `);
    const { ok, status, html } = await fetchHtml(url);
    if (!ok) {
      console.log(`HTTP ${status}`);
      if (status === 404 && all.length === 0) continue;
      break;
    }
    const rows = parseBlocks(html).filter((r) => r.url?.startsWith("http"));
    let added = 0;
    for (const r of rows) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      all.push(r);
      added++;
    }
    console.log(`+${added} (total ${all.length})`);
    if (!added && !html.includes("社名")) break;
    if (sleepMs > 0) await sleep(sleepMs);
  }

  if (!all.length) {
    console.log("RESULT none — builderlist 取得0。pref_cache CSV を使用");
    process.exit(2);
  }

  fs.writeFileSync(
    outPath,
    serializeCsv(["company", "url", "prefecture", "source"], all) + "\n"
  );
  console.log(`RESULT ${all.length} → ${outPath}`);
  console.log("Next: node buyout-ops/merge-seed-files.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

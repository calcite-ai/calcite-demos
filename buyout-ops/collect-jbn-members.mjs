#!/usr/bin/env node
/**
 * JBN・全国工務店協会 正会員検索から 社名+公式URL+都道府県 を抽出。
 * 47都道府県が area_01〜area_47 に対応するため、地域まんべんなくの種集めに使える。
 *
 * 一覧: /about/search/result/?cat_member=member_01&cat_area=area_NN （page/N/ でページ送り）
 * 詳細: /member/memberXXXXXXXX/ の hidden input（value_company_name / _url / _address1…）
 *
 * Usage:
 *   node buyout-ops/collect-jbn-members.mjs --regions 北海道,四国,中国 --cap 25
 *   node buyout-ops/collect-jbn-members.mjs --areas 01,34,35 --out seeds/koumuten_jbn_x.csv
 *   node buyout-ops/collect-jbn-members.mjs --regions 四国 --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const BASE = "https://www.jbn-support.jp";
const SEARCH = `${BASE}/about/search/`;
const UA = "Mozilla/5.0 (compatible; CalciteProspect/1.0)";
const HEADER = ["company", "url", "prefecture", "source"];

/** 地域 → 都道府県（種のまんべんなさを測る単位。region-analysis と同じ区分） */
const REGIONS = {
  北海道: ["北海道"],
  東北: ["青森", "岩手", "宮城", "秋田", "山形", "福島"],
  関東: ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"],
  甲信越北陸: ["新潟", "富山", "石川", "福井", "山梨", "長野"],
  東海: ["岐阜", "静岡", "愛知", "三重"],
  関西: ["滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"],
  中国: ["鳥取", "島根", "岡山", "広島", "山口"],
  四国: ["徳島", "香川", "愛媛", "高知"],
  九州沖縄: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿児島", "沖縄"],
};

/** ポータル・SNS・地図サイトは公式HPではないので種にしない */
const SKIP_HOST =
  /suumo|homes\.co|athome|ekiten|kensetumap|b-mall|biz-mall|google|facebook|twitter|instagram|youtube|ameblo|jimdo(free)?\.com$|wixsite|line\.me|jbn-support/i;

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const sleepMs = Number(arg("sleep-ms", "1200"));
const capPerPref = Number(arg("cap", "25"));
const dryRun = hasFlag("dry-run");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

async function fetchText(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      redirect: "follow",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

/** 既存の全 seed ファイルの URL（重複追加を防ぐ） */
function loadExisting() {
  const set = new Set();
  for (const f of fs.readdirSync(seedsDir)) {
    if (!f.endsWith(".csv")) continue;
    try {
      for (const r of parseCsv(fs.readFileSync(path.join(seedsDir, f), "utf8")).rows) {
        if (r.url) set.add(norm(r.url));
      }
    } catch {
      /* skip unreadable */
    }
  }
  return set;
}

/** 検索ページから area コード → 都道府県 を実物から読む（推測しない） */
async function loadAreaMap() {
  const html = await fetchText(SEARCH);
  const map = new Map();
  const re =
    /href="\/about\/search\/result\/\?cat_member=member_01&(?:amp;)?cat_area=area_(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const label = m[2].replace(/<[^>]+>/g, "").trim();
    if (label) map.set(m[1], label);
  }
  return map;
}

/** 一覧ページから会員詳細URLを集める（ページ送りは空になるまで） */
async function listMemberUrls(area) {
  const found = [];
  const seen = new Set();
  for (let page = 1; page <= 30; page++) {
    const url =
      page === 1
        ? `${BASE}/about/search/result/?cat_member=member_01&cat_area=area_${area}`
        : `${BASE}/about/search/result/page/${page}/?cat_member=member_01&cat_area=area_${area}`;
    const html = await fetchText(url);
    if (!html) break;
    let added = 0;
    for (const m of html.matchAll(/href="(https:\/\/www\.jbn-support\.jp\/member\/member\d+\/)"/g)) {
      if (seen.has(m[1])) continue;
      seen.add(m[1]);
      found.push(m[1]);
      added++;
    }
    if (!added) break;
    await sleep(sleepMs);
  }
  return found;
}

/** 詳細ページの hidden input から転記（無い項目は空のまま。埋めない） */
function parseMember(html) {
  const val = (id) =>
    html.match(new RegExp(`id="value_${id}"\\s+value="([^"]*)"`))?.[1]?.trim() || "";
  const company = val("company_name");
  const url = val("company_url");
  const pref = val("company_address1");
  if (!company || !url.startsWith("http")) return null;
  return { company, url, prefecture: pref };
}

async function main() {
  const areaMap = await loadAreaMap();
  if (!areaMap.size) {
    console.error("FAIL area map 取得0 — 検索ページの構造が変わった可能性");
    process.exit(2);
  }
  const prefToArea = new Map([...areaMap].map(([a, p]) => [p, a]));

  let areas = [];
  const areasArg = arg("areas", "");
  const regionsArg = arg("regions", "");
  if (areasArg) {
    areas = areasArg.split(",").map((s) => s.trim().padStart(2, "0"));
  } else if (regionsArg) {
    for (const reg of regionsArg.split(",").map((s) => s.trim())) {
      const prefs = REGIONS[reg];
      if (!prefs) {
        console.error(`FAIL unknown region ${reg} (${Object.keys(REGIONS).join("/")})`);
        process.exit(2);
      }
      for (const p of prefs) {
        const a = prefToArea.get(p);
        if (a) areas.push(a);
        else console.error(`WARN ${reg}/${p} は JBN 検索に無し`);
      }
    }
  } else {
    console.error("Usage: --regions 四国,中国 | --areas 01,34");
    process.exit(2);
  }
  areas = [...new Set(areas)];

  const existing = loadExisting();
  const out = [];
  const seen = new Set();
  const stats = {};

  for (const area of areas) {
    const label = areaMap.get(area) || area;
    const memberUrls = await listMemberUrls(area);
    const s = { members: memberUrls.length, noUrl: 0, portal: 0, dupe: 0, added: 0 };
    for (const mu of memberUrls) {
      if (s.added >= capPerPref) break;
      const html = await fetchText(mu);
      await sleep(sleepMs);
      const rec = html ? parseMember(html) : null;
      if (!rec) {
        s.noUrl++;
        continue;
      }
      if (SKIP_HOST.test(rec.url)) {
        s.portal++;
        continue;
      }
      const nu = norm(rec.url);
      if (seen.has(nu) || existing.has(nu)) {
        s.dupe++;
        continue;
      }
      seen.add(nu);
      s.added++;
      out.push({ ...rec, source: "jbn_member" });
    }
    stats[label] = s;
    console.log(
      `${label} (area_${area}): 会員 ${s.members} / 新規 ${s.added} / 既知 ${s.dupe} / URL無 ${s.noUrl} / ポータル ${s.portal}`
    );
  }

  console.log(`\nRESULT ${out.length} new rows`);
  if (dryRun) {
    console.log("(dry-run: 書き込みなし)");
    return;
  }
  const outArg = arg("out", "seeds/koumuten_jbn_members.csv");
  const outPath = path.isAbsolute(outArg) ? outArg : path.join(__dirname, outArg);
  fs.writeFileSync(outPath, serializeCsv(HEADER, out) + "\n");
  console.log(`→ ${outPath}`);
  console.log("Next: node buyout-ops/merge-seed-files.mjs");
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * Build + curl-verify koumuten_major_cities_chamber_hokkaido_tohoku.csv
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const outPath = path.join(seedsDir, "koumuten_major_cities_chamber_hokkaido_tohoku.csv");
const urlsPath = path.join(seedsDir, "koumuten_urls.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const SKIP_HOSTS = ["kensetumap.com", "ekiten.jp", "b-mall.ne.jp", "googletagmanager.com"];
const LIMITS = {
  札幌市: 10,
  仙台市: 10,
  青森市: 6,
  盛岡市: 6,
  秋田市: 6,
  山形市: 6,
  福島市: 6,
  水戸市: 6,
  宇都宮市: 6,
  前橋市: 6,
};

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function isSkip(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return SKIP_HOSTS.some((s) => h === s || h.endsWith("." + s));
  } catch {
    return true;
  }
}

function curlOk(url) {
  try {
    const code = execSync(
      `curl -sI -L --max-time 15 -o /dev/null -w "%{http_code}" ${JSON.stringify(url)}`,
      { encoding: "utf8" }
    ).trim();
    return code === "200";
  } catch {
    return false;
  }
}

const existing = new Set();
for (const f of fs.readdirSync(seedsDir)) {
  if (!f.endsWith(".csv")) continue;
  try {
    for (const r of parseCsv(fs.readFileSync(path.join(seedsDir, f), "utf8")).rows) {
      if (r.url) existing.add(norm(r.url));
    }
  } catch {
    /* skip */
  }
}

/** @type {{company:string,url:string,prefecture:string,source:string,priority:number}[]} */
const CANDIDATES = [];

function add(company, url, prefecture, source, priority = 1) {
  if (!url?.startsWith("http") || isSkip(url)) return;
  CANDIDATES.push({ company, url: url.trim(), prefecture, source, priority });
}

// --- Source 1: 札幌商工会議所 住まいの相談窓口 (chamber) ---
const SAPPORO_IDS = [
  643, 704, 762, 725, 651, 578, 592, 610, 619, 696, 767, 786, 860, 886, 928, 976, 990,
  1028, 1064, 1154, 1167, 1176, 1212, 1224, 1225, 1241, 1256, 1258, 1270, 1287, 248, 249,
  254, 257, 321, 326, 329, 371, 385, 414, 425, 457, 539,
];
for (const id of SAPPORO_IDS) {
  try {
    const html = execSync(
      `curl -sL --max-time 12 ${JSON.stringify(`https://www.sapporo-cci.or.jp/sumai-sodan/corporate/${id}/`)}`,
      { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 }
    );
    const name = html.match(/<dt>企業名<\/dt><dd>([^<]+)/)?.[1]?.trim();
    const url = html.match(/<dt>ホームページ<\/dt><dd><a href="([^"]+)"/)?.[1]?.trim();
    if (name && url) add(name, url, "札幌市", "chamber_sapporo_sumai", 0);
  } catch {
    /* skip */
  }
}

// --- Source 1: 宇都宮商工会議所 建設部会リンク (chamber) ---
const UTSU_CHAMBER = [
  ["（株）石川建築社", "https://ishikawa-k.com/", "宇都宮市"],
  ["（株）イーハウス・アーキ・コラボレーション", "http://www.e-house.gr.jp/", "宇都宮市"],
  ["（株）板橋工業", "http://itabashi-kogyo.jp/", "宇都宮市"],
  ["（株）壱建", "http://www.ichiken.biz/", "宇都宮市"],
  ["岩村建設（株）", "http://www.iwamura-net.com/", "宇都宮市"],
  ["（株）エスホーム", "http://www.shome.co.jp/", "宇都宮市"],
  ["（株）エバーグリーン", "http://www.evergreen.sc/", "宇都宮市"],
  ["（株）オースタム", "http://www.oustam.com/", "宇都宮市"],
  ["門目建設", "http://www.fp-kadonome.com/", "宇都宮市"],
  ["（株）カナメ", "http://www.caname.net/", "宇都宮市"],
  ["（株）菊地組", "http://www.k-group.co.jp/", "宇都宮市"],
  ["キョウセイ（株）", "http://www.kyousei-home.co.jp/", "宇都宮市"],
  ["（株）木の花ホーム", "http://www.konohanahome.com/", "宇都宮市"],
  ["（有）興國工業", "http://koukoku-k.co.jp/", "宇都宮市"],
  ["櫻住建", "https://sakura-juken.site/", "宇都宮市"],
  ["上陽工業（株）", "http://www.joyokogyo.com/", "宇都宮市"],
  ["（株）菅野建築", "http://www.suganoac.co.jp/", "宇都宮市"],
  ["（株）住まいる工務店", "http://www.sumairu.biz/", "宇都宮市"],
  ["千勝工業（株）", "http://sensho-kogyo.com/", "宇都宮市"],
  ["（株）泰和工業", "http://www.taikoryokka.com/", "宇都宮市"],
  ["（株）タイネクト", "https://tie-nect.com/", "宇都宮市"],
  ["（株）テクノホーム", "http://www.technohome.co.jp/", "宇都宮市"],
  ["中村土建（株）", "http://www.nakamuradoken.co.jp/", "宇都宮市"],
  ["日豊工業（株）", "http://nippo-kogyo.net/", "宇都宮市"],
  ["ネクスト工務店㈱", "https://next-const.secret.jp/wordpress/", "宇都宮市"],
  ["（株）ハッピーハウジング", "http://www.happyhousing.co.jp/", "宇都宮市"],
  ["（株）増渕組", "http://www.masubuchigumi.com/", "宇都宮市"],
  ["（株）みどり", "http://www.midori-k.co.jp/", "宇都宮市"],
  ["（有）森田工務店", "http://www.morita-komuten.com/", "宇都宮市"],
  ["（株）裕新総業", "http://www.yushin-sogyo.co.jp/", "宇都宮市"],
  ["（株）ワット", "http://www.watt-home.co.jp/", "宇都宮市"],
  ["薄井工務店", "https://www.u-41.co.jp/", "宇都宮市"],
  ["石井工務店", "http://www.ishiikomuten.jp/", "宇都宮市"],
  ["栃木建築社", "https://www.d-made.net/", "宇都宮市"],
  ["栃木ハウス", "https://www.tochigi-house.com/", "宇都宮市"],
  ["丸和住宅", "https://maruwa-net.jp/", "宇都宮市"],
  ["いえものがたり株式会社", "https://iemono.co.jp/", "宇都宮市"],
  ["小堀建設", "https://www.kbr.co.jp/", "宇都宮市"],
  ["むぎくら", "https://www.mugikura.co.jp/", "宇都宮市"],
];
for (const [c, u, p] of UTSU_CHAMBER) add(c, u, p, "chamber_utsunomiya_kensetsu", 0);

// --- Source 2: 水戸商工会議所 建設部会 (chamber) + 水戸建設業協会 ---
const MITO_CHAMBER = [
  ["株式会社ノーブルホーム", "https://www.noblehome.co.jp/", "水戸市"],
  ["ファーストステージ一級建築士事務所", "https://firststage.biz/", "水戸市"],
  ["家づくりナイスホームズ", "https://www.nice-homes.co.jp/", "水戸市"],
  ["株式会社大須賀工務店", "https://www.osukerhome.co.jp/", "水戸市"],
  ["オフィスエイト株式会社", "https://office8.org/", "水戸市"],
  ["ピーチ・ハウス", "https://www.peach-house.co.jp/", "水戸市"],
  ["株式会社ロゴスホーム", "https://www.logos-home.co.jp/", "水戸市"],
  ["株式会社啓幸カンパニー", "https://www.keikou-company.co.jp/", "水戸市"],
  ["株式会社木匠舎", "https://www.mokousha.co.jp/", "水戸市"],
  ["株式会社イレブンハウス", "https://www.elevenhouse.co.jp/", "水戸市"],
  ["株式会社棟匠", "http://www.kk-tosho.co.jp/", "水戸市"],
  ["株式会社西山工務店", "http://www.nishiyama-koumuten.com/", "水戸市"],
  ["昭和建設株式会社", "http://www.showa-kensetsu-mito.com/", "水戸市"],
  ["株式会社関根工務店", "http://www.sekine-koumuten.com/", "水戸市"],
  ["株式会社根本工務店", "http://www.nemoto-koumuten.com/", "水戸市"],
  ["株式会社田村工務店", "http://www.tamurakoumuten.com/", "水戸市"],
  ["平和建設株式会社", "http://www.heiwa-kensetsu-mito.com/", "水戸市"],
  ["株式会社イサカホーム", "http://www.isaka-home.co.jp/", "水戸市"],
  ["アイワ建設株式会社", "http://aiwakensetsu.com/", "水戸市"],
  ["とみた建築工房", "http://www.studio-depot.net/", "水戸市"],
  ["グリーンマーケット株式会社", "http://green-market.net/", "水戸市"],
];
for (const [c, u, p] of MITO_CHAMBER) add(c, u, p, "chamber_mito_kensetsu", 0);

// --- Source 1: 前橋商工会議所 / 群馬 (chamber) ---
const MAEBASHI_CHAMBER = [
  ["株式会社篠田工務店", "https://www.shinodakoumuten.jp/", "前橋市"],
  ["株式会社大成住建", "https://www.taisei-juuken.co.jp/", "前橋市"],
  ["株式会社樋口工務店", "https://k-higuchi.com/", "前橋市"],
  ["斉藤林業", "https://www.saitobayashi.co.jp/", "前橋市"],
  ["ウッドプラン", "https://www.woodplan.co.jp/", "前橋市"],
  ["長建産業", "https://www.nagataken.co.jp/", "前橋市"],
  ["小野建設", "https://www.ono-k.co.jp/", "前橋市"],
  ["マルキ", "https://www.maruki-home.co.jp/", "前橋市"],
  ["コンクスハウジング", "https://www.conqs.co.jp/", "前橋市"],
  ["株式会社広瀬住宅計画", "http://hirose-sc.com/", "前橋市"],
  ["有限会社安松託建", "http://www.yasumatsu.co.jp", "前橋市"],
  ["鵜川興業株式会社", "http://www.ugawakougyou.co.jp/", "前橋市"],
  ["富士工営株式会社", "http://www.fujikohei.jp/", "前橋市"],
];
for (const [c, u, p] of MAEBASHI_CHAMBER) add(c, u, p, "chamber_maebashi", 0);

// --- Source 3: jyukatsukyo batches ---
const JYUKA_FILES = [
  "koumuten_jyukatsukyo_batch2.csv",
  "koumuten_jyukatsukyo_batch3.csv",
  "koumuten_jyukatsukyo_batch4.csv",
  "koumuten_jyukatsukyo_ibaraki_fukushima2.csv",
  "koumuten_jyukatsukyo_kanto2.csv",
  "koumuten_jyukatsukyo_tohoku2.csv",
];
const CITY_MAP = {
  札幌: "札幌市",
  青森: "青森市",
  盛岡: "盛岡市",
  仙台: "仙台市",
  秋田: "秋田市",
  山形: "山形市",
  福島: "福島市",
  水戸: "水戸市",
  宇都宮: "宇都宮市",
  前橋: "前橋市",
};
for (const file of JYUKA_FILES) {
  const fp = path.join(seedsDir, file);
  if (!fs.existsSync(fp)) continue;
  for (const r of parseCsv(fs.readFileSync(fp, "utf8")).rows) {
    const city = CITY_MAP[r.prefecture?.trim()];
    if (!city || !r.url?.startsWith("http")) continue;
    add(r.company, r.url, city, r.source || "jyukatsukyo", 2);
  }
}
// jyukatsukyo_hokkaido from urls cache
for (const r of parseCsv(fs.readFileSync(urlsPath, "utf8")).rows) {
  if (!r.source?.includes("jyukatsukyo_hokkaido")) continue;
  if (r.prefecture === "札幌") add(r.company, r.url, "札幌市", "jyukatsukyo_hokkaido", 2);
}

// --- Extra chamber/officers for Tohoku shicho ---
const TOHOKU_EXTRA = [
  // 青森 - 青森商工会議所建設部会役員等
  ["株式会社今工務所", "http://www.kon-koum.co.jp/", "青森市", "chamber_aomori"],
  ["株式会社鷹架工務店", "https://www.takahoko.net/", "青森市", "chamber_aomori"],
  ["株式会社横山建設", "https://yokoyamakensetu.jp/", "青森市", "chamber_aomori"],
  // 盛岡 jyukatsukyo
  ["株式会社マルユーホーム", "http://maruyuuhome.co.jp/", "盛岡市", "jyukatsukyo_iwate"],
  ["有限会社平建設", "http://www3.ocn.ne.jp/~taira/", "盛岡市", "jyukatsukyo_iwate"],
  ["株式会社鈴正", "http://suzumasa.cc/", "盛岡市", "jyukatsukyo_iwate"],
  // 仙台 jyukatsukyo + chamber
  ["株式会社仙臺屋", "https://www.sendaiya1000.com/", "仙台市", "jyukatsukyo_miyagi"],
  ["株式会社佐善工務店", "http://www.sazen.co.jp/", "仙台市", "jyukatsukyo_miyagi3"],
  ["浦山建設株式会社", "http://web.fp-group.gr.jp/uk/", "仙台市", "jyukatsukyo_miyagi3"],
  // 秋田 jyukatsukyo
  ["有限会社大建", "http://www.daiken1.com/", "秋田市", "jyukatsukyo_akita"],
  ["北嶋洋一建築設計", "http://www.kitazima-kenchiku.com", "秋田市", "jyukatsukyo_akita"],
  ["インデュアホーム秋田茂木建設株式会社", "http://eh-akita.com", "秋田市", "jyukatsukyo_akita"],
  ["株式会社森川建築事務所", "http://morikawa-ie.com", "秋田市", "jyukatsukyo_akita"],
  // 山形 jyukatsukyo
  ["株式会社須藤建設", "http://www.suto-k.co.jp", "山形市", "jyukatsukyo_yamagata"],
  ["有限会社武田建築", "http://web.fp-group.gr.jp/takeda/", "山形市", "jyukatsukyo_yamagata"],
  ["株式会社ハート・コーポレーション", "http://heart-co.com/", "山形市", "jyukatsukyo_yamagata"],
  ["株式会社鎌田工務店", "http://kamata.to/", "山形市", "jyukatsukyo_yamagata"],
  ["有限会社松田宅建センター", "http://matsuda-takken.jp", "山形市", "jyukatsukyo_yamagata"],
  ["株式会社加藤建築", "https://kato-arc-storage.jp/", "山形市", "jyukatsukyo_yamagata"],
  // 福島 jyukatsukyo (city-level)
  ["株式会社永野ハウス", "http://www.hkr.co.jp/naganohouse/", "福島市", "jyukatsukyo_fukushima"],
];
for (const [c, u, p, s] of TOHOKU_EXTRA) add(c, u, p, s, 1);

// --- Verify + dedupe per city ---
const seen = new Set();
const byCity = {};
const out = [];

CANDIDATES.sort((a, b) => a.priority - b.priority || a.company.localeCompare(b.company, "ja"));

for (const c of CANDIDATES) {
  const nu = norm(c.url);
  if (seen.has(nu) || existing.has(nu)) continue;
  const limit = LIMITS[c.prefecture] || 6;
  byCity[c.prefecture] = byCity[c.prefecture] || 0;
  if (byCity[c.prefecture] >= limit) continue;
  process.stdout.write(`verify ${c.prefecture} ${c.company.slice(0, 20)}… `);
  if (!curlOk(c.url)) {
    console.log("FAIL");
    continue;
  }
  console.log("OK");
  seen.add(nu);
  byCity[c.prefecture]++;
  out.push({
    company: c.company,
    url: c.url,
    prefecture: c.prefecture,
    source: c.source,
  });
}

fs.writeFileSync(outPath, serializeCsv(HEADER, out) + "\n");

const bySource = {};
for (const r of out) bySource[r.source] = (bySource[r.source] || 0) + 1;
console.log(`\nRESULT ${out.length} verified → ${outPath}`);
console.log("by city:", byCity);
console.log("by source:", bySource);

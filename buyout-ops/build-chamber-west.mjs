#!/usr/bin/env node
/**
 * Phase2 west: 商工会議所・商工会 + 住活協/FBN → koumuten_major_cities_chamber_west.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const outPath = path.join(seedsDir, "koumuten_major_cities_chamber_west.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const WEST_CITIES = [
  "鳥取市", "松江市", "岡山市", "広島市", "山口市", "徳島市", "高松市", "松山市",
  "高知市", "福岡市", "北九州市", "佐賀市", "長崎市", "熊本市", "大分市",
  "宮崎市", "鹿児島市", "那覇市",
];

const SEIREI = new Set(["岡山市", "広島市", "福岡市", "北九州市", "熊本市"]);
const MAX_PER_CITY = (city) => (SEIREI.has(city) ? 15 : 8);

const PORTAL_HOSTS = [
  "suumo.jp", "homes.co.jp", "tateruya.jp", "kensetumap.com", "ekiten.jp",
  "ai-koumuten.co.jp", "sekisuihouse.co.jp", "tamahome.jp",
];

const FUKUOKA_CITY_AREAS = new Set([
  "福岡", "博多", "中央", "城南", "早良", "西区", "東区", "南区", "那珂川", "春日",
  "大野城", "筑紫野", "粕屋", "久山", "朝倉", "筑後", "宮若",
]);
const KITAKYUSHU_AREAS = new Set(["北九州", "小倉", "八幡", "門司", "若松", "戸畑"]);

const KITAKYUSHU_FBN = new Set([
  "大楠建業", "岩本工務店", "吉田工務店", "安岡工務店", "山﨑建設", "山崎建設",
  "光栄建設", "六花", "西江ハウジング", "ナカジマ建設", "Rin建築", "伊都住建",
  "眞鍋建設", "梁", "ハゼモト建設", "今村工務店", "CRATCH", "サン建築工房",
]);

const KITAKYUSHU_URL_RE =
  /okusu\.jp|iwamotokomuten|ysd-k\.jp|yoiie-yasuoka|yamasaki-1972|tnk-koei|rokka-sumika|nishie-housing|n-techno\.net|rin-k\.co\.jp|manabe-k\.com|tohsei-k\.bz|hazemoto-k|cratch\.co\.jp|imamura-k\.co\.jp/i;

function norm(u) {
  return String(u || "").trim().toLowerCase().replace(/\/$/, "");
}

function isPortal(url) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "");
    return PORTAL_HOSTS.some((p) => h === p || h.endsWith("." + p));
  } catch {
    return true;
  }
}

function mapCity(locality, company = "", url = "") {
  const loc = String(locality || "").trim();
  const co = String(company || "");
  if (KITAKYUSHU_URL_RE.test(url)) return "北九州市";
  if (KITAKYUSHU_FBN.has(co) || co.includes("北九州") || co.includes("小倉") || co.includes("八幡")) {
    return "北九州市";
  }
  if (LOCALITY_TO_CITY[loc]) return LOCALITY_TO_CITY[loc];
  const stripped = loc.replace(/市$/, "");
  if (LOCALITY_TO_CITY[stripped]) return LOCALITY_TO_CITY[stripped];
  if (FUKUOKA_CITY_AREAS.has(loc) || FUKUOKA_CITY_AREAS.has(stripped)) return "福岡市";
  if (KITAKYUSHU_AREAS.has(loc) || KITAKYUSHU_AREAS.has(stripped)) return "北九州市";
  if (loc.includes("北九州")) return "北九州市";
  if (loc.includes("福岡")) return "福岡市";
  return null;
}

const LOCALITY_TO_CITY = {
  鳥取: "鳥取市", 鳥取市: "鳥取市",
  松江: "松江市", 松江市: "松江市",
  岡山: "岡山市", 岡山市: "岡山市",
  広島: "広島市", 広島市: "広島市",
  山口: "山口市", 山口市: "山口市",
  徳島: "徳島市", 徳島市: "徳島市",
  高松: "高松市", 高松市: "高松市",
  松山: "松山市", 松山市: "松山市",
  高知: "高知市", 高知市: "高知市",
  福岡: "福岡市", 福岡市: "福岡市",
  北九州: "北九州市", 北九州市: "北九州市",
  佐賀: "佐賀市", 佐賀市: "佐賀市",
  長崎: "長崎市", 長崎市: "長崎市",
  熊本: "熊本市", 熊本市: "熊本市",
  大分: "大分市", 大分市: "大分市",
  宮崎: "宮崎市", 宮崎市: "宮崎市",
  鹿児島: "鹿児島市", 鹿児島市: "鹿児島市",
  那覇: "那覇市", 那覇市: "那覇市",
};

async function verifyUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "calcite-seed-verify/1.0" },
    });
    if ([405, 403, 501].includes(res.status)) {
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: ctrl.signal,
        headers: { "User-Agent": "calcite-seed-verify/1.0" },
      });
    }
    return res.status >= 200 && res.status < 400;
  } catch {
    if (url.startsWith("https://")) {
      try {
        const res = await fetch(url.replace(/^https:\/\//, "http://"), {
          method: "HEAD",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "User-Agent": "calcite-seed-verify/1.0" },
        });
        return res.status >= 200 && res.status < 400;
      } catch {
        return false;
      }
    }
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** [company, url, city, source] */
const CHAMBER_MANUAL = [
  // 鳥取市 YEG
  ["株式会社千代田工務店", "http://www.chiyodanoie.com/", "鳥取市", "chamber_tottori_yeg"],
  ["株式会社懸樋工務店", "https://www.kakehi-const.co.jp/", "鳥取市", "chamber_tottori_yeg"],
  ["田中工業株式会社", "http://www.tanaka-kougyou.jp/", "鳥取市", "chamber_tottori_yeg"],
  ["株式会社白兎設計事務所", "http://www.hakutosekkei.jp/", "鳥取市", "chamber_tottori_yeg"],
  ["有限会社杉内", "http://www.sugiuchi.co.jp/", "鳥取市", "chamber_tottori_yeg"],
  ["有限会社エスジーシステム", "http://www.sg3.jp/", "鳥取市", "chamber_tottori_yeg"],
  ["大和建設株式会社", "http://www.daiwa-kensetsu.co.jp/", "鳥取市", "chamber_tottori_officer"],
  // 松江市
  ["梶野工務店", "https://www.kajinokoumuten.com/", "松江市", "chamber_shimane"],
  ["松江土建株式会社", "http://www.picolle.biz/", "松江市", "jyukatsukyo_shimane"],
  ["ハウジング・スタッフ株式会社", "http://www.housing-staff.co.jp/", "松江市", "jyukatsukyo_shimane"],
  // 岡山市
  ["株式会社近藤建設興業", "http://www.kondo-kk.com", "岡山市", "jyukatsukyo_okayama"],
  ["株式会社北屋建設", "http://www.tombo-kitaya.co.jp/", "岡山市", "jyukatsukyo_okayama"],
  ["株式会社タウンハウス", "http://www.1townhouse.com", "岡山市", "jyukatsukyo_okayama"],
  ["株式会社コムハウジング", "http://www.comhousing.com", "岡山市", "jyukatsukyo_okayama"],
  ["有限会社まきび住建", "http://www.makibi.co.jp", "岡山市", "jyukatsukyo_okayama"],
  ["山佐産業株式会社", "http://www.okayamajuuken.co.jp", "岡山市", "jyukatsukyo_okayama"],
  ["橋本興産株式会社", "http://www.hashimotokousan.co.jp", "岡山市", "jyukatsukyo_okayama"],
  ["岡山ハウス工業株式会社", "http://www.ii-ie.net/okayamahouse", "岡山市", "jyukatsukyo_okayama2"],
  ["有限会社鞠子建設", "http://www.mariko.co.jp/", "岡山市", "jyukatsukyo_okayama2"],
  // 広島市 chamber/YEG
  ["株式会社紅菱住建", "http://www.koryojk.co.jp/", "広島市", "chamber_hiroshima_yeg"],
  ["錦建設株式会社", "http://str-nishiki.co.jp/", "広島市", "chamber_hiroshima_yeg"],
  ["下岸建設株式会社", "http://www.shimokishi.co.jp/", "広島市", "chamber_hiroshima_yeg"],
  ["株式会社ハウスワン", "http://houseone.net/", "広島市", "chamber_hiroshima_yeg"],
  ["株式会社住宅デザイン研究所", "http://www.jdknet.jp/", "広島市", "chamber_hiroshima_yeg"],
  ["株式会社福永建設工業", "http://www.fukunaga-kensetsu.co.jp/", "広島市", "chamber_hiroshima_yeg"],
  ["株式会社ゴジョウ", "https://gojyou.co.jp", "広島市", "jyukatsukyo_hiroshima"],
  ["株式会社Cozy", "https://www.k-cozy.co.jp/", "広島市", "jyukatsukyo_hiroshima"],
  // 山口市
  ["third.gear.builders株式会社", "https://third-gear-builders.jp/", "山口市", "jyukatsukyo_yamaguchi"],
  ["株式会社田村ビルズ", "http://www.tamura-kenzai.co.jp/", "山口市", "jyukatsukyo_yamaguchi"],
  ["髙山産業株式会社", "https://takayama-ind.co.jp/", "山口市", "jyukatsukyo_yamaguchi"],
  // 徳島市
  ["株式会社ナイスリフォーム", "http://www.nice-reform.jp/", "徳島市", "jyukatsukyo_tokushima"],
  // 高松市
  ["株式会社 LIFE WORK", "https://lifework-architect.com/", "高松市", "jyukatsukyo_kagawa"],
  ["株式会社マリモハウス", "http://www.yurick.co.jp/", "高松市", "jyukatsukyo_kagawa"],
  ["株式会社意匠計画Horigami", "https://ishou-h.com/", "高松市", "jyukatsukyo_kagawa"],
  // 松山市 chamber
  ["株式会社二宮工務店", "http://www.ninomiya-k.co.jp/", "松山市", "chamber_matsuyama_yeg"],
  ["株式会社成武建設", "http://www.naritake-k.co.jp/", "松山市", "chamber_matsuyama_yeg"],
  // 高知市
  ["家工房猪野工務店", "https://www.1-ino.co.jp/", "高知市", "jyukatsukyo_kochi"],
  ["株式会社岸之上工務店", "https://www.kishinoue.co.jp/", "高知市", "chamber_kochi_cci"],
  ["西陽建設株式会社", "http://www.saiyo-kensetsu.co.jp/", "高知市", "chamber_kochi_yeg"],
  // 佐賀市
  ["エムハウス株式会社", "http://emhouse.jp/", "佐賀市", "jyukatsukyo_saga2"],
  ["くが工務店", "https://kugakoumuten.com/", "佐賀市", "chamber_saga"],
  ["株式会社遠江工務店", "https://toonoe-koumuten.jp/", "佐賀市", "chamber_saga"],
  // 熊本市
  ["幸保工務店", "https://www.yukiyasu.co.jp/", "熊本市", "jyukatsukyo_kumamoto"],
  ["立石工務店", "https://tateishi-con.co.jp/", "熊本市", "jyukatsukyo_kumamoto"],
  ["株式会社志水工務店", "https://www.shimizu-koumuten.jp/", "熊本市", "chamber_kumamoto"],
  ["株式会社智建", "http://www9.plala.or.jp/chiken/", "熊本市", "jyukatsukyo_kumamoto"],
  ["有限会社川﨑木工", "http://www.homestylezen.com/", "熊本市", "jyukatsukyo_kumamoto"],
  ["株式会社幸住研", "http://www.miyuki-juken.net/", "熊本市", "jyukatsukyo_kumamoto"],
  // 大分市
  ["有限会社木香", "http://mocca-house.com/", "大分市", "jyukatsukyo_oita"],
  // 長崎市
  ["株式会社嶋田工務店", "https://www.shimada-koumuten.net/", "長崎市", "chamber_nagasaki"],
  // 宮崎市
  ["中武建設株式会社", "http://www.nakatake.co.jp/", "宮崎市", "jyukatsukyo_miyazaki"],
  // 鹿児島市
  ["株式会社相塲工務店", "https://aiba-koumuten.jp/", "鹿児島市", "chamber_kagoshima"],
  ["増田工務店", "https://maruhey.jp/", "鹿児島市", "chamber_kagoshima"],
  // 那覇市
  ["株式会社三二六工務店", "https://www.326koumuten.com/", "那覇市", "chamber_naha_yeg"],
  ["株式会社esデザイン", "https://esdesign.co.jp/", "那覇市", "chamber_naha_yeg"],
  ["嶋建設", "https://www.shimakensetsu.co.jp/", "那覇市", "chamber_naha"],
  ["株式会社井上工務店", "https://inoue-ca.com/", "那覇市", "chamber_naha"],
];

const SEED_FILES = [
  "koumuten_jyukatsukyo_okayama.csv",
  "koumuten_jyukatsukyo_batch2.csv",
  "koumuten_jyukatsukyo_batch5.csv",
  "koumuten_jyukatsukyo_pref_cache.csv",
  "koumuten_expand_kansai_kyushu_aichi.csv",
  "koumuten_fukuoka_fbn.csv",
];

const ASSOC_RE = /jyukatsukyo|chamber|fbn|商工/i;

function loadSeedCandidates() {
  const out = [];
  for (const file of SEED_FILES) {
    const p = path.join(seedsDir, file);
    if (!fs.existsSync(p)) continue;
    for (const r of parseCsv(fs.readFileSync(p, "utf8")).rows) {
      if (!r.url?.startsWith("http")) continue;
      const src = `${r.source || ""} ${file}`;
      if (!ASSOC_RE.test(src)) continue;
      const city = mapCity(r.prefecture, r.company, r.url);
      if (!city || !WEST_CITIES.includes(city)) continue;
      out.push({
        company: r.company,
        url: r.url.trim(),
        prefecture: city,
        source: r.source || file.replace(".csv", ""),
      });
    }
  }
  for (const [company, url, city, source] of CHAMBER_MANUAL) {
    out.push({ company, url, prefecture: city, source });
  }
  return out;
}

async function main() {
  const raw = loadSeedCandidates();
  const seen = new Set();
  const verified = [];
  const stats = { ok: 0, fail: 0, dupe: 0, portal: 0 };

  for (const row of raw) {
    const nu = norm(row.url);
    if (seen.has(nu)) { stats.dupe++; continue; }
    seen.add(nu);
    if (isPortal(row.url)) { stats.portal++; continue; }

    process.stderr.write(`verify ${row.prefecture} ${row.url} ... `);
    const ok = await verifyUrl(row.url);
    if (ok) {
      verified.push(row);
      stats.ok++;
      process.stderr.write("OK\n");
    } else {
      stats.fail++;
      process.stderr.write("FAIL\n");
    }
  }

  const perCity = {};
  const outRows = [];
  for (const city of WEST_CITIES) perCity[city] = 0;

  for (const row of verified) {
    const max = MAX_PER_CITY(row.prefecture);
    if (perCity[row.prefecture] >= max) continue;
    outRows.push(row);
    perCity[row.prefecture]++;
  }

  fs.writeFileSync(outPath, serializeCsv(HEADER, outRows) + "\n");

  const bySource = {};
  for (const r of outRows) bySource[r.source] = (bySource[r.source] || 0) + 1;

  console.log(JSON.stringify({ stats, perCity, bySource, total: outRows.length, outPath }, null, 2));
}

main();

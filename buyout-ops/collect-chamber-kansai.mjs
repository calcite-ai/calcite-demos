#!/usr/bin/env node
/**
 * Collect Phase2 Kansai chamber/assoc 工務店 URLs → koumuten_major_cities_chamber_kansai.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "seeds", "koumuten_major_cities_chamber_kansai.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const LIMITS = {
  seirei: 15,
  shicho: 8,
};
const CITY_TIER = {
  大津市: "shicho",
  京都市: "seirei",
  大阪市: "seirei",
  堺市: "seirei",
  神戸市: "seirei",
  奈良市: "shicho",
  和歌山市: "shicho",
};

const SKIP_HOST =
  /kensetumap|ekiten|tabelog|hotpepper|suumo|homes\.co|athome|biz-mall|b-mall|google|facebook|twitter|instagram|youtube|pref\.|city\.|go\.jp\/[^/]*search/i;

function norm(u) {
  return String(u || "")
    .trim()
    .toLowerCase()
    .replace(/\/$/, "");
}

function loadExisting() {
  const set = new Set();
  for (const f of [
    "koumuten_urls.csv",
    "koumuten_major_cities_maps.csv",
    "koumuten_major_cities_assoc.csv",
    "koumuten_major_cities_chamber.csv",
  ]) {
    const p = path.join(__dirname, "seeds", f);
    if (!fs.existsSync(p)) continue;
    for (const r of parseCsv(fs.readFileSync(p, "utf8")).rows) {
      if (r.url) set.add(norm(r.url));
    }
  }
  return set;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CalciteProspect/1.0)" },
    redirect: "follow",
  });
  if (!res.ok) return "";
  return res.text();
}

async function verifyUrl(url) {
  if (!url?.startsWith("http")) return false;
  if (SKIP_HOST.test(url)) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CalciteProspect/1.0)" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status >= 200 && res.status < 400) return true;
    const res2 = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CalciteProspect/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    return res2.status >= 200 && res2.status < 400;
  } catch {
    return false;
  }
}

function parseSakaiChamber(html) {
  const rows = [];
  for (const m of html.matchAll(
    /<a href="(https?:\/\/[^"]+)"[^>]*>([^<]*(?:工務|建設|建築|ハウス)[^<]*)<\/a>/gi
  )) {
    const url = m[1];
    const company = m[2].trim();
    if (/sakaicci|sakai-kenkyo|facebook|line\.me/i.test(url)) continue;
    rows.push({ company, url, prefecture: "堺市", source: "chamber_sakai_member" });
  }
  return rows;
}

function parseKyotoKyokenkyo(html) {
  const rows = [];
  for (const block of html.split(/<h[34][^>]*>/)) {
    const nameM = block.match(/^([^<]+)/);
    if (!nameM) continue;
    const company = nameM[1].replace(/\s+/g, "").trim();
    if (!/(工務|建設|建築)/.test(company)) continue;
    const urlM = block.match(/href="(https?:\/\/[^"]+)"/);
    if (!urlM || /kyokenkyo|pref\.kyoto|googletagmanager/i.test(urlM[1])) continue;
    rows.push({ company, url: urlM[1], prefecture: "京都市", source: "chamber_kyoto_kyokenkyo" });
  }
  return rows;
}

function parseHyogoKinotakumi(html) {
  const rows = [];
  const kobe = html.match(/（神戸地区）[\s\S]*?<\/table>/);
  if (!kobe) return rows;
  for (const m of kobe[0].matchAll(
    /<a href="(https?:\/\/[^"]+)"[^>]*>([^<（]+).*?神戸市([^<|]+)/gs
  )) {
    rows.push({
      company: m[2].trim(),
      url: m[1],
      prefecture: "神戸市",
      source: "mokujukyo_hyogo",
    });
  }
  return rows;
}

function parseNaraYeg(html) {
  const rows = [];
  for (const m of html.matchAll(
    /<a href="(https?:\/\/[^"]+)"[^>]*>([^<]*(?:工務|建設|建築)[^<]*)<span>/gi
  )) {
    rows.push({
      company: m[2].trim(),
      url: m[1],
      prefecture: "奈良市",
      source: "chamber_nara_yeg",
    });
  }
  return rows;
}

async function parseBmallDetail(url, city, source) {
  const html = await fetchText(url);
  if (!html) return null;
  const nameM = html.match(/<h1[^>]*>([^<]+)/);
  const urlM = html.match(/\bURL\s+(https?:\/\/[^\s<]+)/i);
  const addrM = html.match(/大阪府大阪市[^<]*/);
  if (!nameM || !urlM) return null;
  if (city === "大阪市" && addrM && !addrM[0].includes("大阪市")) return null;
  const company = nameM[1].trim();
  if (!/(工務|建設|建築)/.test(company)) return null;
  return { company, url: urlM[1], prefecture: city, source };
}

const STATIC = [
  { company: "瀬津工務店", url: "https://setsu.co.jp/", prefecture: "大津市", source: "chamber_otsu_research" },
  { company: "桜井工務店", url: "https://c-sakurai.jp/", prefecture: "大津市", source: "chamber_otsu_research" },
  { company: "有限会社大彦", url: "https://www.daihiko-koumuten.jp/", prefecture: "大津市", source: "chamber_otsu_research" },
  { company: "うらさわ工務店", url: "https://www.urasawa-koumuten.com/", prefecture: "大津市", source: "chamber_otsu_research" },
  { company: "株式会社関工務店", url: "https://www.sekikoumuten.com/", prefecture: "和歌山市", source: "chamber_wakayama_research" },
  { company: "稲田建設", url: "http://inada-k.co.jp/", prefecture: "奈良市", source: "chamber_nara_kenchikushi" },
  { company: "坂本工務店", url: "http://www.sakamoto-koumuten.com/", prefecture: "奈良市", source: "chamber_nara_kenchikushi" },
  { company: "株式会社石井工務店", url: "http://www.ishii-builder.co.jp/", prefecture: "大阪市", source: "chamber_osaka_research" },
  { company: "株式会社大都工務店", url: "http://www.daitokoumuten.co.jp/", prefecture: "大阪市", source: "chamber_osaka_bmall" },
  { company: "株式会社野上工務店", url: "http://www.nogami-koumuten.co.jp/", prefecture: "大阪市", source: "chamber_osaka_bmall" },
  { company: "森野工務店", url: "http://morinokoumuten.jp/", prefecture: "和歌山市", source: "chamber_wakayama_pref" },
  { company: "アーキテクトSUN-DO", url: "http://www.architectsun-do.com/", prefecture: "和歌山市", source: "chamber_wakayama_pref" },
  { company: "株式会社菅原工務店", url: "http://www.sugawara-k.co.jp/", prefecture: "和歌山市", source: "chamber_wakayama_pref" },
  { company: "株式会社高垣工務店", url: "http://www.takagaki-koumuten.com/", prefecture: "和歌山市", source: "chamber_wakayama_pref" },
  { company: "協和建築", url: "http://www.kyowa-arc.co.jp/", prefecture: "奈良市", source: "chamber_nara_yeg" },
  { company: "関口建設", url: "https://sekiguchi-co.jp/", prefecture: "和歌山市", source: "chamber_wakayama_research" },
  { company: "南出建設株式会社", url: "https://minamide-build.jp/", prefecture: "和歌山市", source: "chamber_wakayama_research" },
  { company: "揚田工務店", url: "https://ageta-koumuten.jp/", prefecture: "和歌山市", source: "chamber_wakayama_research" },
];

const BMALL_DETAILS = [
  "https://www.b-mall.ne.jp/CompanyDetail-GQbqCQdtJWkx.html",
  "https://www.b-mall.ne.jp/CompanyDetail-KYbqCQcxKWjq.html",
  "https://www.b-mall.ne.jp/CompanyDetail-JQbqCQbrKTdt.html",
  "https://www.b-mall.ne.jp/CompanyDetail-JQbqCQbsKVju.html",
  "https://www.b-mall.ne.jp/CompanyDetail-EZbqCQjwEZcx.html",
  "https://www.b-mall.ne.jp/CompanyDetail-GQbqCQbsGXgw.html",
  "https://www.b-mall.ne.jp/CompanyDetail-EZbqCQjzLWfx.html",
];

async function main() {
  const existing = loadExisting();
  const raw = [...STATIC];

  const [sakai, kyoto, hyogo, nara] = await Promise.all([
    fetchText("http://sakaicci.or.jp/hp/kensetsu/"),
    fetchText("https://www.kyokenkyo.or.jp/member/kyoto/"),
    fetchText("https://web.pref.hyogo.lg.jp/nk14/kinotakumi_tourokuseido.html"),
    fetchText("https://www.nara-yeg.jp/member.html"),
  ]);
  raw.push(...parseSakaiChamber(sakai));
  raw.push(...parseKyotoKyokenkyo(kyoto));
  raw.push(...parseHyogoKinotakumi(hyogo));
  raw.push(...parseNaraYeg(nara));

  for (const u of BMALL_DETAILS) {
    const r = await parseBmallDetail(u, "大阪市", "chamber_osaka_bmall");
    if (r) raw.push(r);
  }

  const seen = new Set();
  const verified = [];
  for (const r of raw) {
    const key = norm(r.url);
    if (!key || seen.has(key) || existing.has(key)) continue;
    if (SKIP_HOST.test(r.url)) continue;
    process.stdout.write(`verify ${r.prefecture} ${r.company} … `);
    const ok = await verifyUrl(r.url);
    console.log(ok ? "OK" : "FAIL");
    if (!ok) continue;
    seen.add(key);
    verified.push(r);
  }

  const byCity = {};
  const out = [];
  for (const city of Object.keys(CITY_TIER)) {
    const limit = LIMITS[CITY_TIER[city]];
    const cityRows = verified.filter((r) => r.prefecture === city);
    const picked = cityRows.slice(0, limit);
    byCity[city] = picked.length;
    out.push(...picked);
  }

  fs.writeFileSync(outPath, serializeCsv(HEADER, out) + "\n");
  console.log(`\nRESULT ${out.length} rows → ${outPath}`);
  console.log("by city:", byCity);
  const bySource = {};
  for (const r of out) bySource[r.source] = (bySource[r.source] || 0) + 1;
  console.log("by source:", bySource);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

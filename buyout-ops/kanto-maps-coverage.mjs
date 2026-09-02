#!/usr/bin/env node
/**
 * 首都圏 Maps 収集の市区町村カバレッジを表示。
 * Usage: node buyout-ops/kanto-maps-coverage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");

function norm(s) {
  return String(s || "")
    .trim()
    .replace(/(都|道|府|県)$/g, "")
    .replace(/ヶ/g, "ケ")
    .replace(/\s+/g, "");
}

function matchMunicipality(prefField, muniRow) {
  const p = norm(prefField);
  const mp = norm(muniRow.pref);
  const m = norm(muniRow.municipality);
  if (!p.includes(norm(muniRow.pref).replace(/東京都|神奈川|千葉|埼玉/, "")) && p !== m) {
    // prefField may be city name only
  }
  const pf = norm(prefField);
  if (pf === m || pf.startsWith(m.replace(/市$|区$|町$|村$/, "")) || m.startsWith(pf.replace(/市$|区$|町$|村$/, ""))) {
    return true;
  }
  // 横浜 vs 横浜市, 世田谷 vs 世田谷区
  const strip = (x) => x.replace(/市$|区$|町$|村$/, "");
  if (strip(pf) === strip(m)) return true;
  if (pf.includes(strip(m)) || strip(m).includes(strip(pf))) return true;
  // さいたま / 大宮 / 浦和 → さいたま市
  const saitamaAliases = ["大宮", "浦和", "与野", "岩槻", "南区", "北区", "西区", "中区", "緑区", "桜区", "見沼区", "大宮区", "浦和区", "岩槻区"];
  if (muniRow.municipality === "さいたま市" && saitamaAliases.some((a) => pf.includes(a))) return true;
  if (muniRow.municipality === "横浜市" && pf === "横浜") return true;
  if (muniRow.municipality === "川崎市" && pf === "川崎") return true;
  if (muniRow.municipality === "千葉市" && pf === "千葉") return true;
  if (muniRow.municipality === "相模原市" && pf === "相模原") return true;
  return false;
}

function main() {
  const munis = parseCsv(fs.readFileSync(path.join(seedsDir, "koumuten_kanto_municipalities.csv"), "utf8")).rows;
  const maps = parseCsv(fs.readFileSync(path.join(seedsDir, "koumuten_kanto_maps.csv"), "utf8")).rows;

  const covered = new Map();
  for (const row of maps) {
    for (const m of munis) {
      if (matchMunicipality(row.prefecture, m)) {
        covered.set(`${m.pref}\t${m.municipality}`, (covered.get(`${m.pref}\t${m.municipality}`) || 0) + 1);
      }
    }
  }

  const missing = [];
  for (const m of munis) {
    const k = `${m.pref}\t${m.municipality}`;
    if (!covered.has(k)) missing.push(m);
  }

  const byPref = {};
  for (const m of missing) {
    byPref[m.pref] = (byPref[m.pref] || 0) + 1;
  }

  console.log(`=== kanto-maps-coverage ${new Date().toISOString().slice(0, 10)} ===`);
  console.log(`市区町村: ${munis.length} / Maps seed: ${maps.length} / カバー: ${munis.length - missing.length} / 未カバー: ${missing.length}`);
  console.log("未カバー内訳:", byPref);
  console.log("\n未カバー一覧:");
  for (const m of missing) {
    console.log(`  ${m.pref}\t${m.municipality}`);
  }
}

main();

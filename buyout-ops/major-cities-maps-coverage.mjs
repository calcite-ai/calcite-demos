#!/usr/bin/env node
/**
 * 主要都市 Maps 収集のカバレッジ（政令市+県庁所在地マスタ）。
 * Usage: node buyout-ops/major-cities-maps-coverage.mjs
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

function stripSuffix(x) {
  return x.replace(/市$|区$|町$|村$/, "");
}

function matchCity(prefField, cityRow) {
  const pf = norm(prefField);
  const c = norm(cityRow.city);
  if (cityRow.city === "23区+都下") return false;
  if (pf === c || stripSuffix(pf) === stripSuffix(c)) return true;
  if (pf.includes(stripSuffix(c)) || stripSuffix(c).includes(stripSuffix(pf))) return true;
  const aliases = {
    横浜市: ["横浜"],
    川崎市: ["川崎"],
    相模原市: ["相模原"],
    さいたま市: ["さいたま", "大宮", "浦和"],
    千葉市: ["千葉"],
    名古屋市: ["名古屋"],
    京都市: ["京都"],
    大阪市: ["大阪"],
    神戸市: ["神戸"],
    北九州市: ["北九州"],
    福岡市: ["福岡"],
  };
  const a = aliases[cityRow.city];
  if (a && a.some((x) => pf.includes(x) || x.includes(stripSuffix(pf)))) return true;
  return false;
}

function main() {
  const cities = parseCsv(
    fs.readFileSync(path.join(seedsDir, "koumuten_major_cities_master.csv"), "utf8")
  ).rows;
  const maps = parseCsv(
    fs.readFileSync(path.join(seedsDir, "koumuten_major_cities_maps.csv"), "utf8")
  ).rows;
  const kantoMaps = parseCsv(
    fs.readFileSync(path.join(seedsDir, "koumuten_kanto_maps.csv"), "utf8")
  ).rows;

  const allMaps = [...maps, ...kantoMaps];
  const target = cities.filter((c) => c.kanto_phase1 !== "y" || c.city === "23区+都下");

  const covered = new Map();
  for (const row of allMaps) {
    for (const c of cities) {
      if (matchCity(row.prefecture, c)) {
        covered.set(`${c.pref}\t${c.city}`, (covered.get(`${c.pref}\t${c.city}`) || 0) + 1);
      }
    }
  }

  const missing = [];
  for (const c of target) {
    if (c.city === "23区+都下") {
      if (covered.has(`${c.pref}\t${c.city}`) || kantoMaps.length > 200) {
        covered.set(`${c.pref}\t${c.city}`, kantoMaps.length);
      } else missing.push(c);
      continue;
    }
    const k = `${c.pref}\t${c.city}`;
    if (!covered.has(k)) missing.push(c);
  }

  const phase2 = target.filter((c) => c.kanto_phase1 !== "y");
  const phase2Missing = missing.filter((c) => c.kanto_phase1 !== "y");

  const perCity = [];
  for (const c of phase2) {
    const k = `${c.pref}\t${c.city}`;
    const n = covered.get(k) || 0;
    const target = c.tier === "seirei" ? 10 : 5;
    if (n < target) perCity.push({ ...c, n, target });
  }
  perCity.sort((a, b) => a.n - b.n || a.city.localeCompare(b.city, "ja"));

  console.log(`=== major-cities-maps-coverage ${new Date().toISOString().slice(0, 10)} ===`);
  console.log(
    `マスタ: ${cities.length} / Phase2対象: ${phase2.length} / Maps seed: ${maps.length} / カバー: ${phase2.length - phase2Missing.length} / 未カバー: ${phase2Missing.length}`
  );
  console.log(`目標: 政令市≥10社・県庁所在地≥5社/都市（首都圏同等の深掘り）`);
  console.log(`首都圏Phase1: kanto_maps ${kantoMaps.length}行（203市区町村済）`);
  if (perCity.length) {
    console.log(`\n目標未達（件数/目標）:`);
    for (const c of perCity.slice(0, 25)) {
      console.log(`  ${c.pref}\t${c.city}\t${c.n}/${c.target}`);
    }
    if (perCity.length > 25) console.log(`  …他 ${perCity.length - 25} 都市`);
  }
}

main();

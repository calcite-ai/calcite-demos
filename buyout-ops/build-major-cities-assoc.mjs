#!/usr/bin/env node
/**
 * Phase2 主要都市向け: 既存 seed から協会・商工会系を抽出 → koumuten_major_cities_assoc.csv
 * Usage: node buyout-ops/build-major-cities-assoc.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, serializeCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedsDir = path.join(__dirname, "seeds");
const masterPath = path.join(seedsDir, "koumuten_major_cities_master.csv");
const outPath = path.join(seedsDir, "koumuten_major_cities_assoc.csv");
const HEADER = ["company", "url", "prefecture", "source"];

const ASSOC_RE =
  /jyukatsukyo|chamber|jkk_r|kanakyo|cwbn|zenmokukyo|mokujukyo|fbn|sahn|kengiken|商工|協会|assoc|tbn|takuminokai|reform_member/i;

const SKIP_FILES = new Set([
  "koumuten_urls.csv",
  "koumuten_kanto_municipalities.csv",
  "koumuten_major_cities_master.csv",
  "koumuten_major_cities_maps.csv",
  "koumuten_major_cities_assoc.csv",
]);

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
  if (a && a.some((x) => pf.includes(x))) return true;
  return false;
}

function matchPref(prefField, cityRow) {
  const pf = norm(prefField);
  const mp = norm(cityRow.pref);
  if (pf.includes(mp) || mp.includes(pf)) return true;
  return matchCity(prefField, cityRow);
}

function main() {
  const cities = parseCsv(fs.readFileSync(masterPath, "utf8")).rows.filter(
    (c) => c.kanto_phase1 !== "y"
  );
  const seen = new Set();
  const out = [];

  for (const file of fs.readdirSync(seedsDir).filter((f) => f.endsWith(".csv"))) {
    if (SKIP_FILES.has(file)) continue;
    const { rows } = parseCsv(fs.readFileSync(path.join(seedsDir, file), "utf8"));
    for (const r of rows) {
      if (!r.url?.startsWith("http")) continue;
      const src = `${r.source || ""} ${file}`;
      if (!ASSOC_RE.test(src)) continue;
      const hit = cities.some((c) => matchPref(r.prefecture, c) || matchCity(r.prefecture, c));
      if (!hit) continue;
      const key = r.url.trim().toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        company: r.company,
        url: r.url.trim(),
        prefecture: r.prefecture || "",
        source: r.source || file.replace(".csv", ""),
      });
    }
  }

  fs.writeFileSync(outPath, serializeCsv(HEADER, out) + "\n");
  const bySource = {};
  for (const r of out) bySource[r.source] = (bySource[r.source] || 0) + 1;
  console.log(`RESULT ${out.length} assoc rows → ${outPath}`);
  console.log("by source:", bySource);
}

main();

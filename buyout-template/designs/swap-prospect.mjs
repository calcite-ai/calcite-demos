#!/usr/bin/env node
/**
 * Copy inventory skin(s) and swap company fields for outreach.
 *
 * Usage:
 *   node designs/swap-prospect.mjs \
 *     --skins e-taisei \
 *     --name "株式会社サンプル" \
 *     --tag "地域の〇〇を支えます" \
 *     --tel "03-1234-5678" \
 *     --email "info@sample.example" \
 *     --address "〒150-0001 東京都渋谷区サンプル1-2-3" \
 *     --slug sample-co
 *
 * Output: designs/_prospects/<slug>/<skin>/
 * Preview: http://127.0.0.1:8765/designs/_prospects/<slug>/
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// 営業デモでは先方サイトから画像を拾わない（在庫 Unsplash / AI 素材のみ）
// サイト改善のポイントはデモ本文に埋め込まない（メール本文のみ）

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

/** 標準は E案のみ。F や A〜D は明示指定時のみ */
const skins = arg("skins", "e-taisei")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const name = arg("name");
const tag = arg("tag", "地域の家づくりを、まっすぐ。");
const tel = arg("tel", "03-0000-0000");
const email = arg("email", "info@example.com");
const address = arg("address", "〒100-0001 東京都千代田区サンプル1-2-3");
const slug = arg("slug", "prospect");
const siteUrl = arg("site-url", arg("site_url", "")); // 監査メモ用。先方画像取得には使わない（禁止）
void siteUrl;

if (!name) {
  console.error("Required: --name");
  process.exit(1);
}

const telHref = `tel:${tel.replace(/[^0-9+]/g, "")}`;
const outRoot = path.join(__dirname, "_prospects", slug);

/** D Signboard hero is `アオイ<br />工房` — plain `アオイ工房` replace misses it. */
function heroHtml(companyName) {
  const m = companyName.match(/^(株式会社|有限会社)?(.+?)(工務店|建設|事務所|会館|祭典)$/);
  if (m) return `${m[1] || ""}${m[2]}<br />${m[3]}`;
  return companyName;
}

function brandMark(companyName) {
  const short = companyName.replace(/^(株式会社|有限会社)/, "");
  return short.charAt(0) || "工";
}

function englishSubtitle(companyName) {
  const short = companyName.replace(/^(株式会社|有限会社)/, "").replace(/[株式会社有限会社]/g, "");
  if (!short) return "LOCAL BUILDER Inc.";
  const slug = short.replace(/[^\u3040-\u30ff\u4e00-\u9fafA-Za-z]/g, "").toUpperCase();
  return `${slug.slice(0, 24)} Inc.`;
}

const replacements = [
  // Line-broken hero first (before plain アオイ工房)
  ["アオイ<br />工房", heroHtml(name)],
  ["アオイ<br/>工房", heroHtml(name)],
  ["アオイ<br>工房", heroHtml(name)],
  ["アオイ工房", name],
  ["AOI KOUBO Inc.", englishSubtitle(name)],
  ["青", brandMark(name)],
  ["地域の家づくりを、まっすぐ。", tag],
  ["地域の仕事を、丁寧に。", tag],
  ["新築・改修・総合建設", "新築・改修"],
  ["03-0000-0000", tel],
  ["tel:0300000000", telHref],
  ["info@example.com", email],
  ["〒100-0001 東京都千代田区サンプル1-2-3", address],
  ["〒100-0001<br />東京都千代田区サンプル1-2-3", address],
];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    // 動画の中間素材はデモ公開に不要（Pages肥大化防止）
    if (
      entry.name === "node_modules" ||
      entry.name.startsWith(".") ||
      entry.name === "clips" ||
      entry.name === "out"
    ) {
      continue;
    }
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

// Shared photos once per prospect（在庫のみ。先方サイト画像の取得は禁止）
copyDir(path.join(__dirname, "shared"), path.join(outRoot, "shared"));

for (const skin of skins) {
  const src = path.join(__dirname, skin);
  if (!fs.existsSync(src)) {
    console.error("Unknown skin:", skin);
    process.exit(1);
  }
  const dest = path.join(outRoot, skin);
  copyDir(src, dest);

  walk(dest, (file) => {
    if (!/\.(html|css|js|md)$/i.test(file)) return;
    let text = fs.readFileSync(file, "utf8");
    for (const [a, b] of replacements) text = text.split(a).join(b);

    const rel = path.relative(dest, path.dirname(file));
    const depth = rel === "" ? 0 : rel.split(path.sep).length;
    const sharedPrefix = depth === 0 ? "../shared/images" : "../../shared/images";

    text = text
      .replace(/(\.\.\/)+shared\/images/g, sharedPrefix)
      // Outreach demos: no back-link to chooser (recipients open skin URLs from email)
      .replace(/<p class="picker">[\s\S]*?<\/p>\s*/g, "");

    fs.writeFileSync(file, text);
  });

  console.log("ready", dest);
}

const labels = {
  "a-sumi": "A案 Sumi Editorial",
  "b-atelier": "B案 Cool Atelier",
  "c-daylight": "C案 Neighborhood Daylight",
  "c-refresh": "C案 Refresh（刷新レイアウト）",
  "d-signboard": "D案 Bold Signboard",
  "e-taisei": "E案 Taisei Corporate",
  "f-sanyu": "F案 Sanyu Editorial",
};

const index = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${name} — デモ${skins.length > 1 ? `案${skins.length}つ` : ""}</title>
  <style>
    body { margin: 0; font-family: "Hiragino Sans", sans-serif; background: #111; color: #eee; line-height: 1.65; }
    main { width: min(640px, 100% - 2rem); margin: 2.5rem auto; }
    h1 { font-size: 1.25rem; }
    p { color: #bbb; }
    a {
      display: block; margin: 0.75rem 0; padding: 1rem 1.1rem;
      border: 1px solid #333; border-radius: 8px; color: #fff; text-decoration: none; background: #1a1a1a;
    }
    a:hover { border-color: #666; }
    .note { font-size: 0.85rem; color: #888; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <main>
    <h1>${name}</h1>
    <p>社内プレビュー用です。先方にはメール記載の URL を直接開いてもらいます。</p>
    ${skins.map((s) => `<a href="${s}/">${labels[s] || s}</a>`).join("\n    ")}
    <p class="note">写真・文言はイメージです。ご購入後に御社情報へ差し替えます。</p>
  </main>
</body>
</html>
`;
fs.writeFileSync(path.join(outRoot, "index.html"), index);
console.log("\nOpen: designs/_prospects/" + slug + "/");
console.log("URL:  http://127.0.0.1:8765/designs/_prospects/" + slug + "/");

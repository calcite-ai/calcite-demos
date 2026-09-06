#!/usr/bin/env node
/**
 * Copy a swapped prospect from designs/_prospects/<slug>
 * into repo-root buyout-prospects/<slug> for GitHub Pages.
 *
 * Usage: node publish-prospect.mjs --slug sample-co
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { publicDemoUrl } from "../../buyout-ops/canonical-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const slug = arg("slug");
if (!slug) {
  console.error("Required: --slug");
  process.exit(1);
}

const src = path.join(__dirname, "_prospects", slug);
/**
 * 公開先。E案1本運用になったのでスキン階層は畳み、URLから内部名を消す。
 *   旧: buyout-prospects/{slug}/{skin}/   （送信済みリンクのため残す・触らない）
 *   新: works/{slug}/
 * 「buyout-prospects（買い取り見込み客）」も「e-taisei（着想元の企業名）」も
 * 受信者に見えていた。2026-09-07 以降の新規はこちら。
 */
const PUBLISH_ROOT = process.env.BUYOUT_PUBLISH_ROOT || "works";
const dest = path.join(__dirname, "..", "..", PUBLISH_ROOT, slug);

if (!fs.existsSync(src)) {
  console.error("Missing _prospects/" + slug + " — run swap-prospect.mjs first");
  process.exit(1);
}

const contentGate = spawnSync(
  process.execPath,
  [
    path.join(__dirname, "..", "..", "buyout-ops", "verify-demo-content.mjs"),
    "--dir",
    src,
    "--slug",
    slug,
    "--skip-site",
    "--skip-email",
  ],
  { stdio: "inherit" }
);
if (contentGate.status !== 0) {
  console.error("publish aborted — verify-demo-content FAIL");
  process.exit(contentGate.status || 1);
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

fs.rmSync(dest, { recursive: true, force: true });
copyDir(src, dest);

/** 単一スキンなら {slug}/{skin}/* を {slug}/* へ引き上げる（shared は据え置き） */
function flattenSingleSkin(root) {
  const dirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name);
  if (dirs.length !== 1) return null;
  const skin = dirs[0];
  const from = path.join(root, skin);
  for (const entry of fs.readdirSync(from)) {
    fs.rmSync(path.join(root, entry), { recursive: true, force: true });
    fs.renameSync(path.join(from, entry), path.join(root, entry));
  }
  fs.rmSync(from, { recursive: true, force: true });
  // 1階層上がったので ../../shared → ../shared
  walk(root, (file) => {
    if (!/\.(html|css|js)$/i.test(file)) return;
    const depth = path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean).length;
    const prefix = depth === 0 ? "shared" : "../".repeat(depth) + "shared";
    fs.writeFileSync(
      file,
      fs.readFileSync(file, "utf8").replace(/(\.\.\/)+shared/g, prefix)
    );
  });
  return skin;
}

const flattened = flattenSingleSkin(dest);

const robots =
  '<meta name="robots" content="noindex,nofollow" />\n  <meta name="googlebot" content="noindex,nofollow" />';

function stripPicker(html) {
  return html.replace(/<p class="picker">[\s\S]*?<\/p>\s*/g, "");
}

walk(dest, (file) => {
  if (!file.endsWith(".html")) return;
  let html = fs.readFileSync(file, "utf8");
  html = stripPicker(html);
  if (!/name=["']robots["']/i.test(html)) {
    if (html.includes("</head>")) {
      html = html.replace("</head>", `  ${robots}\n</head>`);
    } else if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>\n  ${robots}`);
    }
  }
  fs.writeFileSync(file, html);
});

// Chooser index is for local preview only — do not publish to Pages
// 畳んだ場合の index.html はデモ本体なので消さない。
// 旧構造（複数スキン）のときだけ、スキン選択の中間ページを削除する。
if (!flattened) {
  const publishedIndex = path.join(dest, "index.html");
  if (fs.existsSync(publishedIndex)) {
    fs.unlinkSync(publishedIndex);
    console.log("removed published chooser index.html");
  }
}

const base = `https://calcite-ai.github.io/calcite-demos/${PUBLISH_ROOT}/${slug}`;

console.log("published", dest);
if (flattened) {
  // スキン階層なし。この URL をそのまま CSV の demo_url_a に入れる
  console.log("demo_url_a", `${base}/`);
} else {
  const skins = fs
    .readdirSync(dest, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name !== "shared")
    .map((e) => e.name);
  console.log("index ", base + "/");
  for (const s of skins) console.log("skin  ", `${base}/${s}/`);
}

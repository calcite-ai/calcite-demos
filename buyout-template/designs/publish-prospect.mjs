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
const dest = path.join(__dirname, "..", "..", "buyout-prospects", slug);

if (!fs.existsSync(src)) {
  console.error("Missing _prospects/" + slug + " — run swap-prospect.mjs first");
  process.exit(1);
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
const publishedIndex = path.join(dest, "index.html");
if (fs.existsSync(publishedIndex)) {
  fs.unlinkSync(publishedIndex);
  console.log("removed published chooser index.html");
}

const base = `https://calcite-ai.github.io/calcite-demos/buyout-prospects/${slug}`;
const skins = fs
  .readdirSync(dest, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "shared")
  .map((e) => e.name);

console.log("published", dest);
console.log("index ", base + "/");
for (const s of skins) console.log("skin  ", `${base}/${s}/`);

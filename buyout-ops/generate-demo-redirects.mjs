#!/usr/bin/env node
/**
 * Generate static redirect pages for short demo URLs on calcite-mail.jp.
 *
 *   https://www.calcite-mail.jp/demo/{slug}/{skin}/
 *     → https://calcite-ai.github.io/calcite-demos/buyout-prospects/{slug}/{skin}/
 *
 * Usage:
 *   node buyout-ops/generate-demo-redirects.mjs
 *   node buyout-ops/generate-demo-redirects.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { GITHUB_DEMO_ORIGIN, parseDemoSkinPath, withTrailingSlash } from "./canonical-url.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const outRoot = path.join(root, "buyout-ops/outreach-domain-site/demo");
const dryRun = process.argv.includes("--dry-run");

function redirectHtml(target) {
  const t = withTrailingSlash(target);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${t}">
  <link rel="canonical" href="${t}">
  <meta name="robots" content="noindex,nofollow">
  <title>デモへ移動中</title>
</head>
<body>
  <p><a href="${t}">デモを開く</a></p>
</body>
</html>
`;
}

const targets = new Map();
const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
for (const row of rows) {
  for (const col of ["demo_url_a", "demo_url_b"]) {
    const parts = parseDemoSkinPath(row[col]);
    if (!parts) continue;
    const key = `${parts.slug}/${parts.skin}`;
    const dest = withTrailingSlash(
      `${GITHUB_DEMO_ORIGIN}/buyout-prospects/${parts.slug}/${parts.skin}`
    );
    targets.set(key, dest);
  }
}

// Also scan published buyout-prospects folders
const prospectsDir = path.join(root, "buyout-prospects");
if (fs.existsSync(prospectsDir)) {
  for (const slug of fs.readdirSync(prospectsDir, { withFileTypes: true })) {
    if (!slug.isDirectory() || slug.name.startsWith(".")) continue;
    const skinDir = path.join(prospectsDir, slug.name);
    for (const skin of fs.readdirSync(skinDir, { withFileTypes: true })) {
      if (!skin.isDirectory() || skin.name === "shared") continue;
      const key = `${slug.name}/${skin.name}`;
      const dest = withTrailingSlash(
        `${GITHUB_DEMO_ORIGIN}/buyout-prospects/${slug.name}/${skin.name}`
      );
      targets.set(key, dest);
    }
  }
}

let written = 0;
for (const [key, dest] of targets) {
  const file = path.join(outRoot, key, "index.html");
  const html = redirectHtml(dest);
  if (dryRun) {
    console.log("would write", file, "→", dest);
    continue;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written += 1;
}

console.log(
  dryRun
    ? `RESULT dry-run ${targets.size} redirect(s)`
    : `RESULT wrote ${written} redirect(s) → ${outRoot}`
);

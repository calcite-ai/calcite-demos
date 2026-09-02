#!/usr/bin/env node
/**
 * Generate demo redirect pages on calcite-mail.jp (short URL + click log).
 *
 *   https://www.calcite-mail.jp/demo/{slug}/{skin}/
 *     → logs click to demo/_data/demo-clicks.csv
 *     → 302 to GitHub Pages demo
 *
 * Calcite HP (calcite-ai.jp) is NOT in this path — no click log there.
 * SendGrid click tracking stays OFF (no wrapper URLs on any link).
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

function redirectPhp({ slug, skin, dest }) {
  const t = withTrailingSlash(dest);
  const key = `${slug}/${skin}`;
  return `<?php
declare(strict_types=1);
$dest = ${JSON.stringify(t)};
$key = ${JSON.stringify(key)};
$logDir = dirname(__DIR__, 2) . '/_data';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
$log = $logDir . '/demo-clicks.csv';
$ua = str_replace(["\\n", "\\r", ','], ' ', $_SERVER['HTTP_USER_AGENT'] ?? '');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$line = date('c') . ',' . $key . ',' . $ip . ',' . $ua . "\\n";
file_put_contents($log, $line, FILE_APPEND | LOCK_EX);
header('Location: ' . $dest, true, 302);
exit;
`;
}

function redirectHtml(target) {
  const t = withTrailingSlash(target);
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0;url=${t}">
  <meta name="robots" content="noindex,nofollow">
  <title>デモへ移動中</title>
</head>
<body><p><a href="${t}">デモを開く</a></p></body>
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
    targets.set(key, { ...parts, dest });
  }
}

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
      targets.set(key, { slug: slug.name, skin: skin.name, dest });
    }
  }
}

if (!dryRun) {
  const dataDir = path.join(outRoot, "_data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, ".htaccess"),
    "# deny web access to click log\nRequire all denied\n"
  );
  if (!fs.existsSync(path.join(dataDir, "demo-clicks.csv"))) {
    fs.writeFileSync(path.join(dataDir, "demo-clicks.csv"), "at,path,ip,user_agent\n");
  }
  // Prefer PHP redirect (click log) over HTML meta-refresh fallback
  fs.writeFileSync(
    path.join(outRoot, ".htaccess"),
    "DirectoryIndex index.php index.html\n"
  );
}

let written = 0;
for (const [, { slug, skin, dest }] of targets) {
  const dir = path.join(outRoot, slug, skin);
  const phpFile = path.join(dir, "index.php");
  const htmlFile = path.join(dir, "index.html");
  if (dryRun) {
    console.log("would write", phpFile, "→", dest);
    continue;
  }
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(phpFile, redirectPhp({ slug, skin, dest }));
  fs.writeFileSync(htmlFile, redirectHtml(dest));
  written += 1;
}

console.log(
  dryRun
    ? `RESULT dry-run ${targets.size} redirect(s)`
    : `RESULT wrote ${written} redirect(s) (index.php + html fallback) → ${outRoot}`
);

#!/usr/bin/env node
/**
 * Copy c-refresh skin to each buyout-prospects/<slug>/ using company data
 * from an existing skin (c-daylight > b-atelier > d-signboard).
 * Also patches b-atelier index + styles with Site review band when present.
 *
 * Usage: node buyout-ops/rollout-c-refresh.mjs [--slug takasu-koumuten]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { buildAuditDemoCopy, injectAuditIntoHtml } from "./audit-demo-copy.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "buyout-template/designs/c-refresh");
const bAtelierTemplateRoot = path.join(repoRoot, "buyout-template/designs/b-atelier");
const prospectsRoot = path.join(repoRoot, "buyout-prospects");
const leadsPath = path.join(repoRoot, "buyout-ops/demo_buyout_leads.csv");
const sourceSkins = ["c-daylight", "b-atelier", "d-signboard"];

function loadLeadByCompany(name) {
  if (!fs.existsSync(leadsPath)) return null;
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return rows.find((r) => r.company === name) || null;
}

const templatePlaceholders = {
  name: "アオイ工房",
  tag: "地域の家づくりを、まっすぐ。",
  telHref: "tel:0300000000",
  telDisplay: "03-0000-0000",
  email: "info@example.com",
  address: "〒100-0001 東京都千代田区サンプル1-2-3",
  areaLabel: "地域密着",
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : "";
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
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

function findSourceIndex(slugDir) {
  for (const skin of sourceSkins) {
    const p = path.join(slugDir, skin, "index.html");
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function extractCompany(html) {
  const name =
    html.match(/class="brand__name">([^<]+)/)?.[1]?.trim() ||
    html.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim() ||
    "サンプル工務店";
  const tag =
    html.match(/class="brand__tag">([^<]+)/)?.[1]?.trim() ||
    "地域の家づくりを、まっすぐ。";
  const telHref = html.match(/href="(tel:[^"]+)"/)?.[1] || "tel:0300000000";
  const telDisplay =
    html.match(/TEL[:：]?\s*([0-9\-]+)/)?.[1] ||
    html.match(/>(0[0-9\-]{9,})</)?.[1] ||
    "03-0000-0000";
  const email = html.match(/mailto:([^"?]+)/)?.[1]?.trim() || "info@example.com";
  const address =
    html.match(/(〒[0-9\-]+[^<\n]+)/)?.[1]?.trim() ||
    "〒100-0001 東京都千代田区サンプル1-2-3";
  const areaMatch = address.match(/(?:都|道|府|県)([^0-9]{1,12}?[市区町村])/);
  const areaLabel = areaMatch?.[1] || "地域密着";
  return { name, tag, telHref, telDisplay, email, address, areaLabel };
}

function swapCompany(text, from, to) {
  const pairs = [
    [from.name, to.name],
    [from.tag, to.tag],
    [`${from.areaLabel} · 新築 / リフォーム / 増改築`, `${to.areaLabel} · 新築 / リフォーム / 増改築`],
    [from.telDisplay, to.telDisplay],
    [from.telHref, to.telHref],
    [from.email, to.email],
    [from.address, to.address],
  ];
  let out = text;
  for (const [a, b] of pairs) {
    if (a && a !== b) out = out.split(a).join(b);
  }
  return out;
}

const AUDIT_BAND_HTML = `  <section class="narrow hp-audit" aria-label="御社サイトを拝見したうえでの改善イメージ">
    <div class="rule"></div>
    <p class="section-kicker">Site review</p>
    <h2>御社のサイトを拝見し、改善イメージを反映しました</h2>
    <p class="body hp-audit__lede">__AUDIT_LEDE__</p>
    <ul class="hp-audit__list">
      __AUDIT_FIXES_LI__
    </ul>
    <p class="hp-audit__note">※写真・事例はイメージです。御社の実績・文言に差し替え可能です。</p>
  </section>`;

function patchBAatelier(slugDir, company, auditCopy) {
  const indexPath = path.join(slugDir, "b-atelier", "index.html");
  const stylesPath = path.join(slugDir, "b-atelier", "styles.css");
  if (!fs.existsSync(indexPath)) return false;

  let html = fs.readFileSync(indexPath, "utf8");
  if (!html.includes("hp-audit")) {
    html = html.replace(
      /(<section class="split-hero">[\s\S]*?<\/section>)/,
      `$1\n\n${AUDIT_BAND_HTML}\n`
    );
  }
  html = injectAuditIntoHtml(html, auditCopy);
  fs.writeFileSync(indexPath, html);

  if (fs.existsSync(path.join(bAtelierTemplateRoot, "styles.css"))) {
    fs.copyFileSync(path.join(bAtelierTemplateRoot, "styles.css"), stylesPath);
  }
  return true;
}

function normalizeTemplate(dir) {
  walk(dir, (file) => {
    if (!/\.(html|css|js)$/i.test(file)) return;
    let text = fs.readFileSync(file, "utf8");
    text = text.replace(/<p class="picker">[\s\S]*?<\/p>\s*/g, "");
    text = text.replace(/data-skin="g-hp"/g, 'data-skin="c-refresh"');
    text = text.replace(/刷新レイアウト（既存配色）/g, "C Refresh");
    fs.writeFileSync(file, text);
  });
}

if (!fs.existsSync(templateRoot)) {
  console.error("Missing template:", templateRoot);
  process.exit(1);
}

const onlySlug = arg("slug");
const slugs = onlySlug
  ? [onlySlug]
  : fs.readdirSync(prospectsRoot).filter((name) => {
      if (name.startsWith(".")) return false;
      return fs.statSync(path.join(prospectsRoot, name)).isDirectory();
    });

normalizeTemplate(templateRoot);

const seed = findSourceIndex(path.join(prospectsRoot, "takasu-koumuten"));
if (seed) {
  const takasu = extractCompany(fs.readFileSync(seed, "utf8"));
  walk(templateRoot, (file) => {
    if (!/\.(html|css|js)$/i.test(file)) return;
    let text = fs.readFileSync(file, "utf8");
    text = swapCompany(text, takasu, templatePlaceholders);
    fs.writeFileSync(file, text);
  });
}

for (const slug of slugs.sort()) {
  const slugDir = path.join(prospectsRoot, slug);
  const sourceIndex = findSourceIndex(slugDir);
  if (!sourceIndex) {
    console.warn("skip", slug, "(no source skin)");
    continue;
  }

  const company = extractCompany(fs.readFileSync(sourceIndex, "utf8"));
  const lead = loadLeadByCompany(company.name);
  const auditCopy = buildAuditDemoCopy({
    defects: "",
    pay_signals: lead?.pay_signals || "",
    audit_notes: lead?.audit_notes || "",
    company: company.name,
  });
  const dest = path.join(slugDir, "c-refresh");
  fs.rmSync(dest, { recursive: true, force: true });
  copyDir(templateRoot, dest);

  walk(dest, (file) => {
    if (!/\.(html|css|js)$/i.test(file)) return;
    const rel = path.relative(dest, path.dirname(file));
    const depth = rel === "" ? 0 : rel.split(path.sep).length;
    const sharedPrefix = depth === 0 ? "../shared/images" : "../../shared/images";
    let text = fs.readFileSync(file, "utf8");
    text = swapCompany(text, templatePlaceholders, company);
    text = text.replace(/(\.\.\/)+shared\/images/g, sharedPrefix);
    text = injectAuditIntoHtml(text, auditCopy);
    fs.writeFileSync(file, text);
  });

  fs.rmSync(path.join(slugDir, "g-hp"), { recursive: true, force: true });
  console.log("c-refresh", slug, "←", path.basename(path.dirname(sourceIndex)), company.name);

  if (patchBAatelier(slugDir, company, auditCopy)) {
    console.log("b-atelier audit", slug, company.name);
  }
}

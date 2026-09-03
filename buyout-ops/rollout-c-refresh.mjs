#!/usr/bin/env node
/**
 * Copy c-refresh + b-atelier skins to buyout-prospects/<slug>/ with company swap,
 * サイト改善のポイント band, human strength line. 画像は在庫のみ（先方サイト取得禁止）。
 *
 * Usage:
 *   node buyout-ops/rollout-c-refresh.mjs [--slug takasu-koumuten]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";
import { buildAuditDemoCopy, injectAuditIntoHtml } from "./audit-demo-copy.mjs";
import { prospectImageReplacements } from "./prospect-site-images.mjs";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateRoot = path.join(repoRoot, "buyout-template/designs/c-refresh");
const bAtelierTemplateRoot = path.join(repoRoot, "buyout-template/designs/b-atelier");
const sharedTemplateRoot = path.join(repoRoot, "buyout-template/designs/shared");
const prospectsRoot = path.join(repoRoot, "buyout-prospects");
const leadsPath = path.join(repoRoot, "buyout-ops/demo_buyout_leads.csv");
const sourceSkins = ["c-daylight", "b-atelier", "d-signboard", "c-refresh", "e-taisei", "f-sanyu"];

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

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function loadLeadByCompany(name) {
  if (!fs.existsSync(leadsPath)) return null;
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return rows.find((r) => r.company === name) || null;
}

function loadLeadBySlug(slug) {
  if (!fs.existsSync(leadsPath)) return null;
  const { rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
  return (
    rows.find((r) => {
      const a = String(r.demo_url_a || "");
      const b = String(r.demo_url_b || "");
      return a.includes(`/buyout-prospects/${slug}/`) || b.includes(`/buyout-prospects/${slug}/`);
    }) || null
  );
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

function applyImageReplacements(text, imageReplacements) {
  let out = text;
  for (const [a, b] of imageReplacements) out = out.split(a).join(b);
  return out;
}

function applySkinDir({ skinDest, auditCopy, company, imageReplacements, injectAuditAll = false }) {
  walk(skinDest, (file) => {
    if (!/\.(html|css|js)$/i.test(file)) return;
    const rel = path.relative(skinDest, path.dirname(file));
    const depth = rel === "" ? 0 : rel.split(path.sep).length;
    const sharedPrefix = depth === 0 ? "../shared/images" : "../../shared/images";
    let text = fs.readFileSync(file, "utf8");
    text = swapCompany(text, templatePlaceholders, company);
    text = text.replace(/(\.\.\/)+shared\/images/g, sharedPrefix);
    text = applyImageReplacements(text, imageReplacements);
    text = text.replace(/<p class="picker">[\s\S]*?<\/p>\s*/g, "");
    if (file.endsWith(".html") && (injectAuditAll || path.basename(file) === "index.html")) {
      text = injectAuditIntoHtml(text, auditCopy);
    }
    fs.writeFileSync(file, text);
  });
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

function ensureSharedImages(slugDir, imageReplacements) {
  const sharedDir = path.join(slugDir, "shared", "images");
  if (!fs.existsSync(sharedDir)) {
    copyDir(path.join(sharedTemplateRoot, "images"), sharedDir);
  }
  return sharedDir;
}

async function refreshSlug(slug) {
  const slugDir = path.join(prospectsRoot, slug);
  const sourceIndex = findSourceIndex(slugDir);
  if (!sourceIndex) {
    console.warn("skip", slug, "(no source skin)");
    return;
  }

  const company = extractCompany(fs.readFileSync(sourceIndex, "utf8"));
  const lead = loadLeadByCompany(company.name) || loadLeadBySlug(slug);
  const auditCopy = buildAuditDemoCopy({
    defects: "",
    pay_signals: lead?.pay_signals || "",
    audit_notes: lead?.audit_notes || "",
    company: company.name,
  });

  const imagesDir = ensureSharedImages(slugDir, []);
  // 先方サイトからの画像取得は禁止（在庫のみ）
  const imageReplacements = prospectImageReplacements(imagesDir, {});

  const cDest = path.join(slugDir, "c-refresh");
  fs.rmSync(cDest, { recursive: true, force: true });
  copyDir(templateRoot, cDest);
  applySkinDir({ skinDest: cDest, auditCopy, company, imageReplacements, injectAuditAll: false });

  const bDest = path.join(slugDir, "b-atelier");
  if (fs.existsSync(bAtelierTemplateRoot)) {
    fs.rmSync(bDest, { recursive: true, force: true });
    copyDir(bAtelierTemplateRoot, bDest);
    applySkinDir({ skinDest: bDest, auditCopy, company, imageReplacements, injectAuditAll: false });
  }

  fs.rmSync(path.join(slugDir, "g-hp"), { recursive: true, force: true });
  console.log("refreshed", slug, company.name);
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
  await refreshSlug(slug);
}

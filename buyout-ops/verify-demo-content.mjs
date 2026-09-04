#!/usr/bin/env node
/**
 * デモ本文の誤りゲート（上野レビュー以降の正本）。
 * Exit 0 = 機械チェック PASS。非0 = 公開・送付禁止。
 *
 * 機械では拾えない事実照合（代表・許可・事業見出し）は FACT として出す。
 * エージェントは FACT を先方HPで潰してから「最終OK」と言う。
 *
 * Usage:
 *   node buyout-ops/verify-demo-content.mjs --slug ueno-kenchiku
 *   node buyout-ops/verify-demo-content.mjs --from-csv --company "有限会社上野建築事務所"
 *   node buyout-ops/verify-demo-content.mjs --dir buyout-template/designs/_prospects/ueno-kenchiku
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

/** 社内メモ・捏造・空欄の誤った言い回し */
const FORBIDDEN = [
  { id: "C1", re: /転記|転載/, why: "作業メモ（先方に見せない）" },
  { id: "C1", re: /現行ホームページ|現行HP|現行サイト/, why: "作業メモ" },
  { id: "C1", re: /本番納品/, why: "作業メモ" },
  { id: "C1", re: /公開ページに/, why: "作業メモ" },
  { id: "C1", re: /本ページはデモ|フォーム（デモ）|送信する（デモ）|福利厚生・制度（デモ）/, why: "デモ表記" },
  { id: "C1", re: /（デモ）/, why: "デモ表記（捏造値の印）" },
  { id: "C1", re: /地図は準備中/, why: "空欄はご購入後の約束にする" },
  { id: "C1", re: /写真はイメージです/, why: "写真がない枠では使わない。ご購入後に差し替え" },
  { id: "C2", re: /アオイ工房|アオイ<br\s*\/?\s*>工房/, why: "サンプル屋号の残存" },
  { id: "C2", re: /千代田区サンプル|03-0000-0000|info@example\.com/, why: "サンプル連絡先の残存" },
  { id: "C2", re: /サンプル駅/, why: "架空アクセス" },
  { id: "C2", re: /高木 太郎|佐木 太郎|黒木 太郎|ネ木 太郎/, why: "架空代表名" },
  { id: "C2", re: /第000000号/, why: "架空許可番号" },
  { id: "C3", re: /class="picker"|デモ案一覧|社内プレビュー用/, why: "社内chooserが公開面に残っている" },
  { id: "C4", re: /prospect-(hero|photo)/i, why: "先方サイト画像の参照は禁止" },
];

const FACT_LINES = [
  "会社情報の代表・設立・許可・住所・TELが、先方HPの会社案内と一致している（無い項目は載せない）",
  "事業の見出しが、先方HPのメニューと矛盾していない",
  "施工写真を先方サイトから使っていない（在庫素材＋ご購入後差し替え）",
  "主要ページを幅〜390pxで確認した",
];

function walkHtml(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, fn);
    else if (e.name.endsWith(".html")) fn(p);
  }
}

function isChooser(file, html) {
  return path.basename(file) === "index.html" && /社内プレビュー用です/.test(html);
}

function listProspectDirs() {
  const roots = [
    path.join(repoRoot, "buyout-template", "designs", "_prospects"),
    path.join(repoRoot, "buyout-prospects"),
  ];
  const out = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const slug of fs.readdirSync(root)) {
      const dir = path.join(root, slug);
      if (fs.statSync(dir).isDirectory()) out.push({ slug, dir, local: root.includes("_prospects") });
    }
  }
  return out;
}

function findDirByName(name) {
  if (!name) return "";
  const compact = name.replace(/\s+/g, "");
  const hits = [];
  for (const { slug, dir, local } of listProspectDirs()) {
    const about = path.join(dir, "e-taisei", "about", "index.html");
    const home = path.join(dir, "e-taisei", "index.html");
    const file = fs.existsSync(about) ? about : home;
    if (!fs.existsSync(file)) continue;
    const plain = fs.readFileSync(file, "utf8").replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    if (plain.includes(compact)) hits.push({ slug, dir, local });
  }
  const localHit = hits.find((h) => h.local);
  return (localHit || hits[0] || {}).dir || "";
}

function resolveDir(slug, explicitDir, name) {
  if (explicitDir) {
    const abs = path.isAbsolute(explicitDir) ? explicitDir : path.join(repoRoot, explicitDir);
    if (!fs.existsSync(abs)) throw new Error(`dir がない: ${abs}`);
    return abs;
  }
  if (slug) {
    const local = path.join(repoRoot, "buyout-template", "designs", "_prospects", slug);
    const published = path.join(repoRoot, "buyout-prospects", slug);
    if (fs.existsSync(local)) return local;
    if (fs.existsSync(published)) return published;
  }
  const byName = findDirByName(name);
  if (byName) return byName;
  throw new Error(`_prospects も buyout-prospects も無い: ${slug || name || "?"}`);
}

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function collectPhones(html) {
  const out = new Set();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const d = digits(m[1]);
    if (d.length >= 10) out.add(d);
  }
  for (const m of html.matchAll(/0\d{1,4}-\d{1,4}-\d{3,4}/g)) {
    const d = digits(m[0]);
    if (d.length >= 10) out.add(d);
  }
  return [...out];
}

export function scanDemoHtml(dir) {
  const fails = [];
  const warns = [];
  const phones = new Set();
  let fileCount = 0;

  walkHtml(dir, (file) => {
    const html = fs.readFileSync(file, "utf8");
    if (isChooser(file, html)) return;
    fileCount += 1;
    const rel = path.relative(repoRoot, file);
    for (const { id, re, why } of FORBIDDEN) {
      if (re.test(html)) {
        const hit = html.match(re)?.[0] || re.source;
        fails.push(`${id} ${rel}: ${why} — 「${hit}」`);
      }
    }
    for (const d of collectPhones(html)) phones.add(d);
  });

  if (!fileCount) fails.push("C0 HTML が1つもない");
  return { fails, warns, phones: [...phones], fileCount };
}

async function fetchOfficial(url) {
  if (!url) return { ok: false, reason: "site_url なし" };
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "CalciteBuyoutContentVerify/1.0" },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function verifyDemoContent({ dir, name, email, siteUrl, skipSite, skipEmail }) {
  const { fails, warns, phones, fileCount } = scanDemoHtml(dir);

  if (name) {
    const about = path.join(dir, "e-taisei", "about", "index.html");
    const home = path.join(dir, "e-taisei", "index.html");
    const target = fs.existsSync(about) ? about : home;
    if (fs.existsSync(target)) {
      const plain = fs.readFileSync(target, "utf8").replace(/<[^>]+>/g, "").replace(/\s+/g, "");
      const compactName = name.replace(/\s+/g, "");
      if (compactName && !plain.includes(compactName)) {
        fails.push(`C5 社名「${name}」が ${path.relative(repoRoot, target)} にない`);
      }
    }
  }

  if (email && !skipEmail) {
    const joined = [];
    walkHtml(dir, (file) => {
      const html = fs.readFileSync(file, "utf8");
      if (!isChooser(file, html)) joined.push(html);
    });
    const blob = joined.join("\n");
    if (email && !blob.includes(email)) {
      warns.push(`C6 CSVのメール ${email} がデモHTMLにない（掲載しない運用なら可）`);
    }
  }

  if (!skipSite && siteUrl) {
    const official = await fetchOfficial(siteUrl);
    if (!official.ok) {
      warns.push(`C7 先方HPを取得できない（${official.reason || official.status}）: ${siteUrl} — 手で照合する`);
    } else {
      const officialPhones = collectPhones(official.text);
      const officialDigits = official.text.replace(/\D/g, "");
      for (const p of phones) {
        if (p === "0300000000") continue;
        if (!officialDigits.includes(p) && !officialPhones.includes(p)) {
          warns.push(
            `C7 デモのTEL ${p} が先方トップHTMLに見つからない — 会社案内ページと手で照合する`
          );
        }
      }
    }
  }

  return { fails, warns, phones, fileCount };
}

async function main() {
  const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
  let slug = arg("slug");
  let name = arg("name");
  let email = arg("email");
  let siteUrl = arg("site-url") || arg("site_url");
  let dir = arg("dir");

  if (hasFlag("from-csv")) {
    const company = arg("company");
    if (!company) {
      console.error("Need --company with --from-csv");
      process.exit(2);
    }
    const { rows } = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const row = rows.find((r) => (r.company || "").includes(company));
    if (!row) {
      console.error(`CSVに社名がない: ${company}`);
      process.exit(2);
    }
    name = row.company;
    email = row.email;
    siteUrl = row.site_url;
    const m = String(row.demo_url_a || "").match(/buyout-prospects\/([^/]+)\//);
    slug = slug || m?.[1] || "";
  }

  let resolved;
  try {
    resolved = resolveDir(slug, dir, name);
  } catch (e) {
    console.error("FAIL C0", e.message);
    process.exit(1);
  }

  console.log(`=== 本文ゲート ${name || slug} ===`);
  console.log(`dir ${path.relative(repoRoot, resolved)}`);

  const { fails, warns, fileCount } = await verifyDemoContent({
    dir: resolved,
    name,
    email,
    siteUrl,
    skipSite: hasFlag("skip-site"),
    skipEmail: hasFlag("skip-email"),
  });

  console.log(`files ${fileCount}`);
  for (const w of warns) console.log("WARN", w);
  for (const line of FACT_LINES) console.log("FACT", line);

  if (fails.length) {
    for (const f of fails) console.log("FAIL", f);
    console.log("RESULT FAIL — 公開・送付しない。FACTも先方HPで潰す");
    process.exit(1);
  }

  console.log("RESULT PASS — 機械チェックOK。FACT未確認なら最終OKにしない");
  process.exit(0);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(2);
  });
}

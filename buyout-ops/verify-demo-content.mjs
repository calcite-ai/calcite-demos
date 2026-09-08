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
  // 2026-09-08: 括弧なしの地の文「このデモでは」「デモ雛形」等が
  // 上記の限定パターンをすり抜けて送信済み9社で見つかった。
  // 「デモ」という語自体が先方向けページに出ること自体が事故なので、
  // 表記の形に関わらず全部拾う。
  { id: "C1", re: /デモ/, why: "「デモ」という語が先方向けページに残っている（内部呼称）" },
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
  // works/ = 新（スキン階層なし）、buyout-prospects/ = 旧（送信済み）
  const roots = [
    path.join(repoRoot, "buyout-template", "designs", "_prospects"),
    path.join(repoRoot, "works"),
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
    const candidates = [
      path.join(repoRoot, "buyout-template", "designs", "_prospects", slug),
      path.join(repoRoot, "works", slug),
      path.join(repoRoot, "buyout-prospects", slug),
    ];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  }
  const byName = findDirByName(name);
  if (byName) return byName;
  throw new Error(`_prospects も works も buyout-prospects も無い: ${slug || name || "?"}`);
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

/**
 * e-taisei雛形は「事業内容」を複数ページ（トップのカード=h3 / servicesページ=h2）
 * に重複して出す。見出しを個別に差し替えたとき、片方のタグだけ直って
 * もう片方が雛形の仮見出しのまま残る事故があった（2026-09-08 小畑工務店）。
 * 両ページ共通の英字ラベル（ARCHITECTURE/RENOVATION）を手がかりに、
 * 同じブロックの見出しがページ間で食い違っていないかを機械チェックする。
 */
const SERVICE_MARKERS = ["ARCHITECTURE", "RENOVATION"];

/** 雛形によって見出し→ラベルの順（トップ）/ラベル→見出しの順（servicesページ）が
 * 逆なので、窓の中の最初の一致ではなく「マーカーに最も近い見出し」を採る。 */
function extractHeadingNear(html, idx) {
  const radius = 300;
  const window = html.slice(Math.max(0, idx - radius), idx + radius);
  const windowStart = Math.max(0, idx - radius);
  let best = null;
  let bestDist = Infinity;
  for (const m of window.matchAll(/<h[23]>([^<]+)<\/h[23]>/g)) {
    const headingIdx = windowStart + m.index;
    const dist = Math.abs(headingIdx - idx);
    if (dist < bestDist) {
      bestDist = dist;
      best = m[1].trim();
    }
  }
  return best;
}

function checkServiceHeadingConsistency(dir) {
  const byMarker = new Map(); // marker -> Map(heading -> files[])
  walkHtml(dir, (file) => {
    const html = fs.readFileSync(file, "utf8");
    if (isChooser(file, html)) return;
    const rel = path.relative(repoRoot, file);
    for (const marker of SERVICE_MARKERS) {
      let idx = html.indexOf(marker);
      while (idx !== -1) {
        const heading = extractHeadingNear(html, idx);
        if (heading) {
          const map = byMarker.get(marker) || new Map();
          const files = map.get(heading) || [];
          if (!files.includes(rel)) files.push(rel);
          map.set(heading, files);
          byMarker.set(marker, map);
        }
        idx = html.indexOf(marker, idx + marker.length);
      }
    }
  });
  const fails = [];
  for (const [marker, map] of byMarker) {
    if (map.size > 1) {
      const detail = [...map.entries()].map(([t, files]) => `「${t}」(${files.join(", ")})`).join(" ≠ ");
      fails.push(`C8 事業見出しがページ間で不一致（${marker}）: ${detail}`);
    }
  }
  return fails;
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
  fails.push(...checkServiceHeadingConsistency(dir));
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
    // demo_url_a が既に公開URL（works/ or buyout-prospects/）を指しているなら、
    // それが「実際に送った」内容の一次ソース。resolveDir の候補順（_prospects優先）
    // だと、公開後も残った古いローカル作業コピー（_prospects）を誤って優先して
    // しまう（2026-09-08 中村工務店・村上工務店で実際に発生：公開済みの修正が
    // 反映されず、掃除されていない旧 _prospects の「写真はイメージです」等を
    // 検査していた）。URL からルートが特定できるときは dir を直接指定する。
    const worksMatch = String(row.demo_url_a || "").match(/\/works\/([^/?#]+)/);
    const prospectsMatch = String(row.demo_url_a || "").match(/buyout-prospects\/([^/]+)\//);
    if (!dir && worksMatch) dir = path.join(repoRoot, "works", worksMatch[1]);
    else if (!dir && prospectsMatch) dir = path.join(repoRoot, "buyout-prospects", prospectsMatch[1]);
    slug = slug || worksMatch?.[1] || prospectsMatch?.[1] || "";
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

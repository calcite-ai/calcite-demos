#!/usr/bin/env node
/**
 * Pre-send gate for buyout outreach demos.
 * Exit 0 = PASS (ok to send). Non-zero = FAIL (do not send).
 *
 * Usage:
 *   node buyout-ops/verify-before-send.mjs --slug fukuzawa-koumuten --name "株式会社福澤工務店"
 *   node buyout-ops/verify-before-send.mjs --from-csv --company "株式会社福澤工務店"
 *   node buyout-ops/verify-before-send.mjs --from-csv --queued
 *
 * Always run verify-ops-pack.mjs first in automation (template + repo hygiene).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { ACTIVE_VERTICAL, isActiveVertical, rowVertical, verticalLabel } from "./vertical-config.mjs";
import { matchPriorOutreach } from "./prior-outreach.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const SEND_PRICE = "66000";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function runOpsPack() {
  const r = spawnSync(process.execPath, [path.join(__dirname, "verify-ops-pack.mjs")], {
    stdio: "inherit",
  });
  return r.status === 0;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = [];
  let cur = "";
  let inQ = false;
  const row0 = lines[0];
  for (let i = 0; i < row0.length; i++) {
    const c = row0[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === "," && !inQ) {
      headers.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  headers.push(cur);

  const rows = [];
  for (let li = 1; li < lines.length; li++) {
    const cols = [];
    cur = "";
    inQ = false;
    const line = lines[li];
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === "," && !inQ) {
        cols.push(cur);
        cur = "";
        continue;
      }
      cur += c;
    }
    cols.push(cur);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function skinFromUrl(url) {
  const m = String(url).match(/buyout-prospects\/[^/]+\/([^/]+)\/?$/);
  return m ? m[1] : "";
}

function slugFromUrl(url) {
  const m = String(url).match(/buyout-prospects\/([^/]+)\//);
  return m ? m[1] : "";
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "CalciteBuyoutVerify/1.0" },
  });
  const text = await res.text();
  return { status: res.status, finalUrl: res.url, text };
}

async function verifyProspect({ name, email, urlA, urlB, slug, quotedPrice, status, vertical, pay_signals, audit_notes }) {
  const fails = [];
  const warns = [];
  const row = { company: name, vertical, pay_signals, audit_notes };

  const prior = matchPriorOutreach({ company: name, email });
  if (prior.blocked && status !== "sent") {
    fails.push(
      `V12 過去営業済み（${prior.row.sent_via} ${prior.row.sent_date}）— prior_outreach_blocklist.csv`
    );
  }

  if (!urlA || !urlB) fails.push("V1 CSVに demo_url_a / demo_url_b がない");
  if (!name) fails.push("V3 社名がない");

  if ((status === "queued" || status === "built") && quotedPrice && quotedPrice !== SEND_PRICE) {
    fails.push(`V9 新規送信対象の quoted_price=${quotedPrice}（${SEND_PRICE} 必須）`);
  }

  if ((status === "queued" || status === "built") && !isActiveVertical(row)) {
    fails.push(
      `V11 送信対象が現行vertical=${ACTIVE_VERTICAL}(${verticalLabel(ACTIVE_VERTICAL)})外: ${verticalLabel(rowVertical(row))}`
    );
  }

  const derivedSlug = slug || slugFromUrl(urlA) || slugFromUrl(urlB);
  if (derivedSlug) {
    const local = path.join(repoRoot, "buyout-prospects", derivedSlug);
    if (!fs.existsSync(local)) fails.push(`V5 ローカルに buyout-prospects/${derivedSlug} がない`);
    const chooser = path.join(local, "index.html");
    if (fs.existsSync(chooser)) {
      fails.push(`V10 buyout-prospects/${derivedSlug}/index.html が残っている（中間ページ禁止）`);
    }
  } else {
    fails.push("V5 slug を URL から特定できない");
  }

  const skinsCsv = [];
  for (const [label, url] of [
    ["A", urlA],
    ["B", urlB],
  ]) {
    if (!url) continue;
    const skin = skinFromUrl(url);
    if (skin) skinsCsv.push(skin);
    try {
      const { status, text } = await fetchText(url);
      if (status !== 200) {
        fails.push(`V1 ${label} HTTP ${status}: ${url}`);
        continue;
      }
      if (/アオイ工房|アオイ<br\s*\/?\s*>工房|アオイ/.test(text)) {
        fails.push(`V2 ${label} にサンプル屋号「アオイ」が残っている: ${url}`);
      }
      if (/03-0000-0000|info@example\.com|東京都千代田区サンプル/.test(text)) {
        fails.push(`V2 ${label} にサンプル連絡先が残っている: ${url}`);
      }
      if (/55,000|50,000|55000|50000/.test(text)) {
        fails.push(`V6 ${label} に旧価格（55,000/50,000）が残っている: ${url}`);
      }
      if (/class="picker"|デモ案一覧|← 在庫一覧/.test(text)) {
        fails.push(`V7 ${label} にデモ案一覧への戻りリンクが残っている: ${url}`);
      }
      // Name may be split across <br /> — strip tags for membership check
      const plain = text.replace(/<[^>]+>/g, "");
      const compactName = name.replace(/\s+/g, "");
      const compactPlain = plain.replace(/\s+/g, "");
      if (compactName && !compactPlain.includes(compactName)) {
        // allow split: 株式会社福澤 + 工務店
        const parts = name.match(/^(株式会社|有限会社)?(.+?)(工務店|建設|事務所|会館|祭典)$/);
        const okSplit =
          parts &&
          compactPlain.includes((parts[1] || "") + parts[2]) &&
          compactPlain.includes(parts[3]);
        if (!okSplit) fails.push(`V3 ${label} トップHTMLに社名「${name}」が見つからない`);
      }
    } catch (e) {
      fails.push(`V1 ${label} 取得失敗: ${url} (${e.message})`);
    }
  }

  if (skinsCsv.length === 2 && skinsCsv[0] === skinsCsv[1]) {
    warns.push("A/B の skin が同一（意図的なら可）");
  }

  // V8: local initial template (verify-ops-pack also checks all templates)
  const initialTpl = path.join(__dirname, "templates", "email_demo_buyout_1_initial.txt");
  if (fs.existsSync(initialTpl)) {
    const tpl = fs.readFileSync(initialTpl, "utf8");
    const body = tpl.split("\n\n").slice(1).join("\n\n");
    if (/55,000|50,000|55000|50000/.test(body)) {
      fails.push("V8 初回メールテンプレに旧価格（55,000/50,000）が残っている");
    }
    if (!/66,000|66000/.test(body)) {
      fails.push("V8 初回メールテンプレに現行価格66,000がない");
    }
  }

  return { fails, warns, slug: derivedSlug };
}

async function main() {
  const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
  let targets = [];

  if (hasFlag("from-csv")) {
    const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
    const company = arg("company");
    if (hasFlag("queued")) {
      targets = rows.filter(
        (r) =>
          (r.status === "queued" || r.status === "built") &&
          String(r.do_not_contact).toLowerCase() !== "true"
      );
    } else if (company) {
      targets = rows.filter((r) => (r.company || "").includes(company));
    } else {
      console.error("Need --company or --queued with --from-csv");
      process.exit(2);
    }
    targets = targets.map((r) => ({
      name: r.company,
      email: r.email,
      urlA: r.demo_url_a,
      urlB: r.demo_url_b,
      slug: slugFromUrl(r.demo_url_a),
      status: r.status,
      quotedPrice: String(r.quoted_price || "").trim(),
      vertical: r.vertical,
      pay_signals: r.pay_signals,
      audit_notes: r.audit_notes,
    }));
  } else {
    targets = [
      {
        name: arg("name"),
        urlA: arg("url-a"),
        urlB: arg("url-b"),
        slug: arg("slug"),
      },
    ];
    if (!targets[0].urlA || !targets[0].urlB) {
      // derive from slug + default skins if provided via --skins
      const slug = arg("slug");
      const skins = arg("skins", "d-signboard,b-atelier")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (slug && skins.length >= 2) {
        const base = `https://calcite-ai.github.io/calcite-demos/buyout-prospects/${slug}`;
        targets[0].urlA = `${base}/${skins[0]}/`;
        targets[0].urlB = `${base}/${skins[1]}/`;
      }
    }
  }

  if (!targets.length) {
    console.error("No targets");
    process.exit(2);
  }

  if (!runOpsPack()) {
    console.error("RESULT FAIL — verify-ops-pack failed (fix templates/repo before send)");
    process.exit(1);
  }

  let anyFail = false;
  for (const t of targets) {
    console.log(`\n=== ${t.name || t.slug} ===`);
    const { fails, warns, slug } = await verifyProspect(t);
    for (const w of warns) console.log("WARN", w);
    if (fails.length) {
      anyFail = true;
      for (const f of fails) console.log("FAIL", f);
      console.log("RESULT FAIL — do not send");
    } else {
      console.log(`RESULT PASS — ok to send (${slug})`);
    }
  }

  process.exit(anyFail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});

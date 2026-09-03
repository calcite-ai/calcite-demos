#!/usr/bin/env node
/**
 * Repo-level buyout ops gate (templates, publish hygiene, no chooser indexes).
 * Run in CI and before daily send batch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isAlreadyOutreached } from "./outreach-guard.mjs";
import { ACTIVE_VERTICAL, isActiveVertical, verticalLabel } from "./vertical-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const CURRENT_PRICE = "66,000";

/** GitHub API raw（CDN遅延で旧テンプレを読む事故を避ける） */
const REMOTE_TEMPLATE_URL =
  "https://api.github.com/repos/calcite-ai/calcite-demos/contents/buyout-ops/templates/email_demo_buyout_1_initial.txt?ref=main";

const fails = [];

function checkTemplate(file, label) {
  const p = path.join(__dirname, "templates", file);
  if (!fs.existsSync(p)) {
    fails.push(`O1 ${label} がない: ${file}`);
    return;
  }
  const body = fs.readFileSync(p, "utf8").split("\n\n").slice(1).join("\n\n");
  if (/55,000|50,000|55000|50000/.test(body)) {
    fails.push(`O2 ${label} に旧価格が残っている`);
  }
  if (file.includes("1_initial") || file.includes("2_checkout")) {
    if (!/66,000|66000/.test(body)) {
      fails.push(`O2 ${label} に現行価格66,000がない`);
    }
  }
  if (/https:\/\/(?!www\.)calcite-ai\.jp/.test(body)) {
    fails.push(`O12 ${label} の公式URLが apex（wwwなし）。https://www.calcite-ai.jp/ を使う`);
  }
  if (/google\.com\/url/i.test(body)) {
    fails.push(`O12 ${label} に google.com/url がある（直接の最終URLを書く）`);
  }
}

function walkProspects(fn) {
  const root = path.join(repoRoot, "buyout-prospects");
  if (!fs.existsSync(root)) return;
  for (const slug of fs.readdirSync(root)) {
    const dir = path.join(root, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    fn(slug, dir);
  }
}

checkTemplate("email_demo_buyout_1_initial.txt", "初回メール");
checkTemplate("email_demo_buyout_2_checkout.txt", "決済メール");
checkTemplate("email_demo_buyout_5_followup.txt", "フォロー");

walkProspects((slug, dir) => {
  const chooser = path.join(dir, "index.html");
  if (fs.existsSync(chooser)) {
    fails.push(`O3 buyout-prospects/${slug}/index.html が残っている（中間ページ禁止）`);
  }
  function walkHtml(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkHtml(p);
      else if (e.name.endsWith(".html")) {
        const html = fs.readFileSync(p, "utf8");
        if (/class="picker"|デモ案一覧/.test(html)) {
          fails.push(`O4 ${path.relative(repoRoot, p)} に picker/デモ案一覧が残っている`);
        }
        if (/55,000|50,000/.test(html)) {
          fails.push(`O5 ${path.relative(repoRoot, p)} に旧価格表記が残っている`);
        }
      }
    }
  }
  walkHtml(dir);
  const bAbout = path.join(dir, "b-atelier", "about", "index.html");
  const bContact = path.join(dir, "b-atelier", "contact", "index.html");
  if (fs.existsSync(path.join(dir, "b-atelier", "index.html"))) {
    if (!fs.existsSync(bAbout) || !fs.existsSync(bContact)) {
      fails.push(`O16 buyout-prospects/${slug}/b-atelier に about/contact がありません`);
    }
  }
  const imgDir = path.join(dir, "shared", "images");
  function walkHtmlForImages(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walkHtmlForImages(p);
      else if (e.name.endsWith(".html")) {
        const html = fs.readFileSync(p, "utf8");
        if (/prospect-(hero|photo)/i.test(html)) {
          fails.push(
            `O17 ${path.relative(repoRoot, p)} — 先方サイトから拾った画像参照は禁止（在庫 Unsplash/AI のみ）`
          );
        }
      }
    }
  }
  walkHtmlForImages(dir);
  if (fs.existsSync(imgDir)) {
    for (const f of fs.readdirSync(imgDir)) {
      if (/^prospect-(hero|photo)/i.test(f)) {
        fails.push(
          `O17 buyout-prospects/${slug}/shared/images/${f} — 先方サイト画像ファイルは禁止（削除して在庫画像に戻す）`
        );
      }
    }
  }
});

const csvPath = path.join(__dirname, "demo_buyout_leads.csv");
const insideCsvPath = path.join(__dirname, "inside_sales_poc_leads.csv");

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
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
    for (const c of lines[li]) {
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

if (fs.existsSync(csvPath)) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (!rows.length || !("quoted_price" in rows[0])) {
    fails.push("O6 CSVに quoted_price 列がない");
  } else {
    for (const row of rows) {
      const status = row.status || "";
      const qp = String(row.quoted_price || "").trim();
      if ((status === "queued" || status === "built") && qp && qp !== "66000") {
        fails.push(`O7 queued/built の ${row.company} が quoted_price=${qp}（66000必須）`);
      }
      const notes = row.notes || "";
      if (notes.includes("旧価格55k") && qp !== "55000") {
        fails.push(`O9 ${row.company} は旧価格コホートだが quoted_price=${qp || "(empty)"}`);
      }
      if ((status === "queued" || status === "built") && !isActiveVertical(row)) {
        fails.push(
          `O11 queued/built の ${row.company} が vertical 外（現行=${ACTIVE_VERTICAL}のみ送信可）`
        );
      }
      const skin = row.skin_pair || "";
      if (skin.includes(",")) {
        for (const s of skin.split(",").map((x) => x.trim()).filter(Boolean)) {
          const inA = (row.demo_url_a || "").includes(`/${s}/`);
          const inB = (row.demo_url_b || "").includes(`/${s}/`);
          if (!inA && !inB) {
            fails.push(`O10 ${row.company} の skin_pair "${s}" が demo URL と一致しない（CSV列ズレ疑い）`);
          }
        }
      }
    }
  }
}

if (fs.existsSync(insideCsvPath)) {
  const insideRows = parseCsv(fs.readFileSync(insideCsvPath, "utf8"));
  for (const row of insideRows) {
    if (String(row.status || "").trim() !== "approved") continue;
    if (isAlreadyOutreached(row)) {
      fails.push(
        `O18 inside ${row.company} が status=approved だが送信済み証拠あり（sent_at/初回送信/terminal）— 再送事故防止のため status を sent/opt_out に戻す`
      );
    }
  }
}

async function checkRemoteTemplate() {
  // Actions では checkout 済み — O1/O2 と同内容。API 403（未認証）で gates が赤くなるのを防ぐ。
  if (process.env.GITHUB_ACTIONS === "true") {
    return;
  }

  const headers = {
    Accept: "application/vnd.github.raw",
    "User-Agent": "CalciteBuyoutVerify/1.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const res = await fetch(REMOTE_TEMPLATE_URL, { headers });
    if (!res.ok) {
      fails.push(`O8 GitHub上の初回テンプレ取得失敗 HTTP ${res.status}`);
      return;
    }
    const tpl = await res.text();
    const body = tpl.split("\n\n").slice(1).join("\n\n");
    if (/55,000|50,000/.test(body)) {
      fails.push("O8 GitHub main の初回テンプレに旧価格が残っている");
    }
    if (!/66,000|66000/.test(body)) {
      fails.push(`O8 GitHub main の初回テンプレに ${CURRENT_PRICE} がない`);
    }
    if (/https:\/\/(?!www\.)calcite-ai\.jp/.test(body)) {
      fails.push("O8 GitHub main の初回テンプレが apex URL（www 必須）");
    }
    if (/google\.com\/url/i.test(body)) {
      fails.push("O8 GitHub main の初回テンプレに google.com/url がある");
    }
  } catch (e) {
    fails.push(`O8 GitHub上の初回テンプレ取得失敗: ${e.message}`);
  }
}

await checkRemoteTemplate();

if (fails.length) {
  for (const f of fails) console.error("FAIL", f);
  console.error("RESULT FAIL — buyout ops pack not ready");
  process.exit(1);
}

console.log("RESULT PASS — buyout ops pack ok");
process.exit(0);

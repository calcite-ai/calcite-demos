#!/usr/bin/env node
/**
 * 登録URLが「現行の公式サイト」かを web 検索で確認する。
 *
 * 2026-09-07: ＫＡＺ空間企画に、廃止済みの旧サイト(kaz-kuukan.com)を診断した
 * メールを送った。新公式(kaz-plan.com)は HTTPS も viewport も対応済みで、
 * 指摘3点のうち2点が的外れだった。旧サイトは 200 を返し、社名・住所・TEL も
 * 一致するため C0 を通過してしまう。
 *
 * 更新日やコピーライト年では判定できない（星野工務店は Last-Modified 2016 だが
 * 現行、ＫＡＺ旧は 2018 で廃止）。別ドメインの公式があるかは検索でしか分からない。
 *
 * Usage:
 *   node buyout-ops/verify-official-site.mjs --company "社名" --url "https://..." --where "市区町村"
 *   node buyout-ops/verify-official-site.mjs --all            # approved + 未承認をまとめて
 *   node buyout-ops/verify-official-site.mjs --all --out /tmp/official.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d = "") => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : d;
};
const MODEL = process.env.BUYOUT_EXTRACT_MODEL || "claude-sonnet-5";
const client = new Anthropic();

const SCHEMA = {
  type: "object",
  properties: {
    verdict: {
      type: "string",
      enum: ["current", "superseded", "unknown"],
      description:
        "current=登録URLが現行公式 / superseded=別ドメインに現行公式がある / unknown=判断できない",
    },
    official_url: { type: "string", description: "現行公式のURL。superseded のときだけ埋める。無ければ空文字" },
    evidence: { type: "string", description: "そう判断した根拠を1文で。検索で見つけた事実のみ" },
  },
  required: ["verdict", "official_url", "evidence"],
  additionalProperties: false,
};

export async function checkOne({ company, url, where }) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          `会社名: ${company}`,
          where ? `所在地: ${where}` : "",
          `登録URL: ${url}`,
          "",
          "この会社の「現行の公式ホームページ」が、登録URLとは別のドメインに存在しないかを web 検索で確認してください。",
          "",
          "判定ルール:",
          "- 登録URLがその会社の現行公式なら current",
          "- 同じ会社の公式サイトが別ドメインにあり、登録URLが旧サイト/放置サイトなら superseded",
          "- 検索しても確認できなければ unknown（推測で superseded にしない）",
          "",
          "注意:",
          "- 同名の別会社と混同しない。所在地・電話番号・代表者名で同一性を確認すること",
          "- ポータルサイト（SUUMO・ホームズ・iタウンページ等）の掲載ページは公式サイトではない",
          "- 登録URLがサブページ(/company.html 等)でも、同一ドメインなら current",
        ].filter(Boolean).join("\n"),
      },
    ],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const searches = res.usage?.server_tool_use?.web_search_requests ?? 0;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { verdict: "unknown", official_url: "", evidence: `パース失敗: ${text.slice(0, 120)}` };
  }
  return { ...parsed, searches, usage: res.usage };
}

function loadTargets() {
  const root = path.join(__dirname, "..");
  const leads = parseCsv(fs.readFileSync(path.join(__dirname, "demo_buyout_leads.csv"), "utf8")).rows
    .filter((r) => r.status === "approved" && String(r.do_not_contact).toLowerCase() !== "true")
    .map((r) => ({ src: "approved", seq: r.approval_seq, company: r.company, url: r.site_url, where: "" }));
  const qp = path.join(__dirname, "prospect_pipeline", "review_queue.csv");
  const queue = fs.existsSync(qp)
    ? parseCsv(fs.readFileSync(qp, "utf8")).rows
        .filter((r) => r.company && !String(r.owner_ok || "").trim())
        .map((r) => ({ src: "pending", seq: r.approval_seq, company: r.company, url: r.url, where: "" }))
    : [];
  return [...leads, ...queue];
}

const one = arg("company");
if (one) {
  const r = await checkOne({ company: one, url: arg("url"), where: arg("where") });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.verdict === "superseded" ? 1 : 0);
}

if (process.argv.includes("--all")) {
  const targets = loadTargets();
  const out = [];
  let searches = 0, inTok = 0, outTok = 0;
  console.error(`対象 ${targets.length} 件`);
  for (const t of targets) {
    try {
      const r = await checkOne(t);
      out.push({ ...t, ...r, usage: undefined });
      searches += r.searches;
      inTok += r.usage?.input_tokens ?? 0;
      outTok += r.usage?.output_tokens ?? 0;
      process.stderr.write(r.verdict === "superseded" ? "!" : r.verdict === "unknown" ? "?" : ".");
    } catch (e) {
      out.push({ ...t, verdict: "error", official_url: "", evidence: String(e.message || e) });
      process.stderr.write("E");
    }
    await new Promise((s) => setTimeout(s, 400));
  }
  const dest = arg("out", "/tmp/official.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  const cost = (searches / 1000) * 10 + (inTok / 1e6) * 3 + (outTok / 1e6) * 15;
  console.error(`\n検索 ${searches} 回 / in ${inTok} out ${outTok} tok / 概算 $${cost.toFixed(2)}`);
  console.error(`→ ${dest}`);
}

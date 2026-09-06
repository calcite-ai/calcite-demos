#!/usr/bin/env node
/**
 * ANTHROPIC_API_KEY の疎通確認。
 *
 * キーの失効は静かに起きる（2026-09-06: Gmail の refresh_token が
 * 3週間切れたまま誰も気づかなかった）。デモ制作が動かないとき、
 * 「キーが死んだ」のか「コードが壊れた」のかを最初に切り分ける。
 *
 * Usage: node buyout-ops/api-smoke.mjs
 * Exit 0 = 疎通OK / 1 = 要対応
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.BUYOUT_EXTRACT_MODEL || "claude-sonnet-5";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FAIL ANTHROPIC_API_KEY が未設定");
  console.error("  ローカル: export ANTHROPIC_API_KEY=...");
  console.error("  Actions : gh secret set ANTHROPIC_API_KEY");
  process.exit(1);
}

const client = new Anthropic();
const started = Date.now();

try {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 64,
    // 疎通確認に推論は要らない。thinking は Sonnet 5 では既定でONなので明示的に切る
    thinking: { type: "disabled" },
    output_config: { effort: "low" },
    messages: [{ role: "user", content: "OK とだけ返してください。" }],
  });

  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  console.log(`model        ${res.model}`);
  console.log(`stop_reason  ${res.stop_reason}`);
  console.log(`tokens       in=${res.usage.input_tokens} out=${res.usage.output_tokens}`);
  console.log(`latency      ${Date.now() - started}ms`);
  console.log(`response     ${JSON.stringify(text)}`);

  if (res.stop_reason === "refusal") {
    console.error("\nFAIL 拒否された（安全性分類器）。疎通自体は成立している");
    process.exit(1);
  }
  console.log("\nRESULT OK — API キーは有効");
  process.exit(0);
} catch (err) {
  const status = err?.status ?? "-";
  console.error(`FAIL ${err?.name || "Error"} (HTTP ${status}): ${err?.message || err}`);
  if (status === 401) console.error("  → キーが無効か失効。console.anthropic.com で再発行し gh secret set");
  else if (status === 403) console.error("  → キーにこのモデルの権限がない");
  else if (status === 404) console.error(`  → モデルID "${MODEL}" が不正`);
  else if (status === 429) console.error("  → レート制限。時間をおいて再試行");
  else if (status >= 500) console.error("  → Anthropic 側の一時障害。再試行で解消する見込み");
  process.exit(1);
}

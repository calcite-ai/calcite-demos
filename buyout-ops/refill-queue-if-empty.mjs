#!/usr/bin/env node
/**
 * 9:00 JST refill orchestrator for Cursor Automation.
 * 1) Check send queue
 * 2) If empty, promote ready paused (demo URLs exist)
 * 3) If still empty, print hunter suggestions for agent to qualify 1 company
 *
 * Usage: node buyout-ops/refill-queue-if-empty.mjs
 * Exit 0 = sendable queue exists (or was refilled). Exit 3 = agent must hunt today.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function run(script, args = []) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    stdio: "inherit",
  });
  return r.status ?? 1;
}

console.log("=== refill-queue-if-empty ===\n");

const status = run("queue-status.mjs");
if (status === 0) {
  console.log("\nRESULT ok — send queue has targets (skip hunter)");
  process.exit(0);
}

console.log("\nQueue empty → try promote paused…");
run("promote-paused.mjs", ["--apply"]);

const status2 = run("queue-status.mjs");
if (status2 === 0) {
  console.log("\nRESULT ok — promoted paused row to queued");
  process.exit(0);
}

console.log("\nStill empty → hunter suggestions:");
run("hunter-suggest.mjs", ["--limit", "5"]);
console.log(
  "\nRESULT hunt — エージェントが1社を G0〜G5 通過 → デモ公開 → CSV queued にして push"
);
console.log("参照: demo_buyout_hunter.md / demo_buyout_publish.md");
process.exit(3);

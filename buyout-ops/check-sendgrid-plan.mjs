#!/usr/bin/env node
/**
 * Check SendGrid account plan (trial/free vs paid).
 * Exit 0 = OK (paid or before warn date).
 * Exit 2 = still free on/after warn date (needs Essentials upgrade).
 *
 * Env: SENDGRID_API_KEY
 * Optional: SENDGRID_UPGRADE_WARN_FROM=2026-10-15 (JST date YYYY-MM-DD)
 *
 * Usage:
 *   node buyout-ops/check-sendgrid-plan.mjs
 *   node buyout-ops/check-sendgrid-plan.mjs --json
 */
const WARN_FROM = process.env.SENDGRID_UPGRADE_WARN_FROM || "2026-10-15";
const DEADLINE = "2026-10-29";
const jsonOut = process.argv.includes("--json");

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const key = process.env.SENDGRID_API_KEY;
if (!key) {
  console.error("FAIL missing SENDGRID_API_KEY");
  process.exit(1);
}

const res = await fetch("https://api.sendgrid.com/v3/user/account", {
  headers: { Authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error(`FAIL account HTTP ${res.status}`);
  process.exit(1);
}
const account = await res.json();
const creditsRes = await fetch("https://api.sendgrid.com/v3/user/credits", {
  headers: { Authorization: `Bearer ${key}` },
});
const credits = creditsRes.ok ? await creditsRes.json() : null;

const today = jstToday();
const type = String(account.type || "").toLowerCase();
const isFree = type === "free" || type === "";
const pastWarn = today >= WARN_FROM;
const pastDeadline = today >= DEADLINE;
const needsUpgrade = isFree && pastWarn;

const payload = {
  today_jst: today,
  warn_from: WARN_FROM,
  deadline: DEADLINE,
  account_type: account.type,
  reputation: account.reputation,
  is_free: isFree,
  needs_upgrade: needsUpgrade,
  past_deadline: pastDeadline,
  credits,
};

if (jsonOut) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log(`today_jst=${today}`);
  console.log(`account_type=${account.type}`);
  console.log(`is_free=${isFree}`);
  console.log(`needs_upgrade=${needsUpgrade}`);
  if (credits) {
    console.log(
      `credits remain=${credits.remain}/${credits.total} used=${credits.used} hard=${credits.is_hard_limit}`
    );
  }
  if (needsUpgrade) {
    console.log(
      `ACTION: Upgrade Email API to Essentials before ${DEADLINE} (see demo_buyout_sendgrid_prep.md)`
    );
  }
}

process.exit(needsUpgrade ? 2 : 0);

#!/usr/bin/env node
/**
 * Send buyout initial outreach as text/plain via ConoHa SMTP.
 * Never use htmlBody — avoids google.com/url wrapping.
 *
 * Env (GitHub Actions secrets):
 *   BUYOUT_SMTP_USER  hello@calcite-ai.jp
 *   BUYOUT_SMTP_PASS  ConoHa mailbox password
 *   BUYOUT_SMTP_HOST  mail1004.conoha.ne.jp
 *   BUYOUT_SMTP_PORT  465
 *
 * Usage:
 *   node buyout-ops/send-outreach-smtp.mjs --company "村上工務店"
 *   node buyout-ops/send-outreach-smtp.mjs --company "…" --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { parseCsv } from "./csv-util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`FAIL missing env ${name}`);
    process.exit(1);
  }
  return v;
}

function renderEmail(company) {
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "render-outreach-email.mjs"), "--company", company],
    { encoding: "utf8", cwd: root }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  const t = r.stdout;
  const m = t.match(/===SUBJECT===\n([\s\S]*?)\n===BODY===\n([\s\S]*?)\n===SEND===/);
  if (!m) {
    console.error("FAIL could not parse render-outreach-email output");
    process.exit(1);
  }
  const subject = m[1].trim();
  const body = m[2].replace(/\n+$/, "") + "\n";
  if (/google\.com\/url/i.test(subject + body)) {
    console.error("FAIL rendered body contains google.com/url");
    process.exit(1);
  }
  if (!/66,000円/.test(body)) {
    console.error("FAIL body missing 66,000円");
    process.exit(1);
  }
  return { subject, body };
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const { subject, body } = renderEmail(company);

const { rows } = parseCsv(fs.readFileSync(path.join(__dirname, "demo_buyout_leads.csv"), "utf8"));
const row = rows.find((r) => r.company === company);
if (!row?.email) {
  console.error(`FAIL no email for ${company}`);
  process.exit(1);
}

const fromUser = requireEnv("BUYOUT_SMTP_USER");
const pass = requireEnv("BUYOUT_SMTP_PASS");
const host = process.env.BUYOUT_SMTP_HOST || "mail1004.conoha.ne.jp";
const port = Number(process.env.BUYOUT_SMTP_PORT || "465");

console.log(`to=${row.email}`);
console.log(`from=${fromUser}`);
console.log(`subject=${subject}`);
console.log(`host=${host} port=${port}`);
console.log(`mime=text/plain htmlBody=none`);

if (dryRun) {
  console.log("RESULT dry-run — not sent");
  process.exit(0);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: { user: fromUser, pass },
});

const info = await transporter.sendMail({
  from: `"カルサイト 日野 研太" <${fromUser}>`,
  to: row.email,
  subject,
  text: body,
});

const id = info.messageId || info.response || "";
console.log(`RESULT sent messageId=${id}`);
console.log(`SMTP_MESSAGE_ID=${id}`);

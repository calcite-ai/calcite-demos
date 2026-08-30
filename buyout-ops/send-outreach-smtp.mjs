#!/usr/bin/env node
/**
 * Send buyout initial outreach as text/plain.
 * Never use htmlBody — avoids google.com/url wrapping.
 *
 * Providers (BUYOUT_MAIL_PROVIDER):
 *   conoha   (default) — ConoHa SMTP
 *   sendgrid — smtp.sendgrid.net (user=apikey, pass=SENDGRID_API_KEY)
 *   ※ SENDGRID_API_KEY があっても provider 未指定なら conoha のまま（誤切替防止）
 *
 * Env:
 *   BUYOUT_SMTP_USER   From address (and ConoHa mailbox user)
 *   BUYOUT_SMTP_PASS   ConoHa pass (IMAP / conoha SMTP). Keep even on SendGrid.
 *   BUYOUT_SMTP_HOST   mail1004… (conoha) / smtp.sendgrid.net (optional override)
 *   BUYOUT_SMTP_PORT   465
 *   SENDGRID_API_KEY   required when provider=sendgrid
 *   BUYOUT_BCC         optional (default kenta.hino1106@gmail.com)
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
import { resolveTransport } from "./mail-transport.mjs";
import { classifySmtpError, exitCodeForKind } from "./smtp-error-kind.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const DEFAULT_BCC = "kenta.hino1106@gmail.com";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
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

const transport = resolveTransport();
const bcc = String(process.env.BUYOUT_BCC || DEFAULT_BCC).trim();

console.log(`provider=${transport.provider}`);
console.log(`to=${row.email}`);
console.log(`bcc=${bcc || "(none)"}`);
console.log(`from=${transport.fromUser}`);
console.log(`subject=${subject}`);
console.log(`host=${transport.host} port=${transport.port}`);
console.log(`mime=text/plain htmlBody=none`);

if (dryRun) {
  console.log("RESULT dry-run — not sent");
  process.exit(0);
}

const transporter = nodemailer.createTransport({
  host: transport.host,
  port: transport.port,
  secure: transport.port === 465,
  auth: { user: transport.user, pass: transport.pass },
});

try {
  const mail = {
    from: `"カルサイト 日野 研太" <${transport.fromUser}>`,
    to: row.email,
    subject,
    text: body,
  };
  if (bcc) mail.bcc = bcc;

  const info = await transporter.sendMail(mail);

  const id = info.messageId || info.response || "";
  console.log(`RESULT sent messageId=${id}`);
  console.log(`SMTP_MESSAGE_ID=${id}`);
} catch (err) {
  const kind = classifySmtpError(err);
  console.error(`FAIL_KIND=${kind}`);
  console.error(err?.response || err?.message || err);
  process.exit(exitCodeForKind(kind));
}

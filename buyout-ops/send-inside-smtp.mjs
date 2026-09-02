#!/usr/bin/env node
/**
 * Send inside-sales initial outreach as text/plain.
 *
 * Usage:
 *   node buyout-ops/send-inside-smtp.mjs --company "アドバン株式会社"
 *   node buyout-ops/send-inside-smtp.mjs --company "…" --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { resolveTransport } from "./mail-transport.mjs";
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";
import { classifySmtpError, exitCodeForKind } from "./smtp-error-kind.mjs";
import { jstDateString } from "./send-quota.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const leadsPath = path.join(__dirname, "inside_sales_poc_leads.csv");
const DEFAULT_BCC = "kenta.hino1106@gmail.com";

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function renderEmail(company) {
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "render-inside-email.mjs"), "--company", company],
    { encoding: "utf8", cwd: root }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  const t = r.stdout;
  const m = t.match(/===SUBJECT===\n([\s\S]*?)\n===BODY===\n([\s\S]*?)\n===SEND===/);
  if (!m) {
    console.error("FAIL could not parse render-inside-email output");
    process.exit(1);
  }
  return { subject: m[1].trim(), body: m[2].replace(/\n+$/, "") + "\n" };
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const { subject, body } = renderEmail(company);

const { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const idx = rows.findIndex((r) => r.company === company);
if (idx < 0 || !rows[idx].email) {
  console.error(`FAIL no email for ${company}`);
  process.exit(1);
}

if (dryRun) {
  console.log(`track=inside dry-run`);
  console.log(`to=${rows[idx].email}`);
  console.log(`subject=${subject}`);
  console.log("RESULT dry-run — not sent");
  process.exit(0);
}

const transport = resolveTransport();
const bcc = String(process.env.BUYOUT_BCC || DEFAULT_BCC).trim();

console.log(`track=inside provider=${transport.provider}`);
console.log(`to=${rows[idx].email}`);
console.log(`bcc=${bcc || "(none)"}`);
console.log(`from=${transport.fromUser}`);
console.log(`subject=${subject}`);

const transporter = nodemailer.createTransport({
  host: transport.host,
  port: transport.port,
  secure: transport.port === 465,
  auth: { user: transport.user, pass: transport.pass },
});

try {
  const mail = {
    from: `"カルサイト 日野 研太" <${transport.fromUser}>`,
    to: rows[idx].email,
    subject,
    text: body,
    headers: sendgridSmtpHeaders(),
  };
  if (bcc) mail.bcc = bcc;

  const info = await transporter.sendMail(mail);
  const id = info.messageId || info.response || "";
  const today = jstDateString();
  let hdrs = headers;
  if (!hdrs.includes("sent_at")) hdrs = [...hdrs, "sent_at"];
  rows[idx].status = "sent";
  rows[idx].sent_at = today;
  rows[idx].notes = `${rows[idx].notes || ""} / 初回送信 ${today} SMTP ${id}`.trim();
  fs.writeFileSync(
    leadsPath,
    serializeCsv(hdrs, rows, {
      alwaysQuoteHeaders: ["site_url", "email", "campaign_evidence", "notes"],
    }) + "\n"
  );
  console.log(`RESULT sent messageId=${id}`);
  console.log(`SMTP_MESSAGE_ID=${id}`);
} catch (err) {
  const kind = classifySmtpError(err);
  console.error(`FAIL_KIND=${kind}`);
  console.error(err?.response || err?.message || err);
  process.exit(exitCodeForKind(kind));
}

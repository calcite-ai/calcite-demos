#!/usr/bin/env node
/**
 * Send buyout follow-up (2nd touch, unreplied) as multipart (text/plain + text/html).
 * 既存リード（status=sent）宛。新しいデモは作らない。
 *
 * Usage:
 *   node buyout-ops/send-followup-smtp.mjs --company "村上工務店"
 *   node buyout-ops/send-followup-smtp.mjs --company "…" --dry-run
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { parseCsv } from "./csv-util.mjs";
import { resolveTransport } from "./mail-transport.mjs";
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";
import { sendArchiveCopy, archiveRecipient } from "./archive-copy.mjs";
import { classifySmtpError, exitCodeForKind } from "./smtp-error-kind.mjs";
import { appendReceipt, hasSentTo } from "./send-receipts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function renderEmail(company) {
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "render-followup-email.mjs"), "--company", company],
    { encoding: "utf8", cwd: root }
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    process.exit(r.status || 1);
  }
  const t = r.stdout;
  const m = t.match(
    /===SUBJECT===\n([\s\S]*?)\n===BODY===\n([\s\S]*?)\n===HTML===\n([\s\S]*?)\n===SEND===/
  );
  if (!m) {
    console.error("FAIL could not parse render-followup-email output");
    process.exit(1);
  }
  const subject = m[1].trim();
  const body = m[2].replace(/\n+$/, "") + "\n";
  const html = m[3].replace(/\n+$/, "") + "\n";
  if (/google\.com\/url/i.test(subject + body + html)) {
    console.error("FAIL rendered body contains google.com/url");
    process.exit(1);
  }
  if (!/66,000円/.test(body)) {
    console.error("FAIL body missing 66,000円");
    process.exit(1);
  }
  if (
    !/calcite-ai\.github\.io\/calcite-demos\/(buyout-prospects|works)\//i.test(body)
  ) {
    console.error("FAIL body missing GitHub Pages demo URL");
    process.exit(1);
  }
  return { subject, body, html };
}

const company = arg("company");
if (!company) {
  console.error("Required: --company");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");

const { rows } = parseCsv(fs.readFileSync(path.join(__dirname, "demo_buyout_leads.csv"), "utf8"));
const row = rows.find((r) => r.company === company);
if (!row?.email) {
  console.error(`FAIL no email for ${company}`);
  process.exit(1);
}
if (row.status !== "sent") {
  console.error(`FAIL not status=sent: ${company} (status=${row.status})`);
  process.exit(1);
}
if (row.reply_at) {
  console.error(`FAIL already replied — no follow-up: ${company}`);
  process.exit(1);
}
if (row.followup_sent_at) {
  console.error(`FAIL follow-up already sent ${row.followup_sent_at}: ${company}`);
  process.exit(1);
}
if (String(row.quoted_price).trim() === "55000") {
  console.error(`FAIL legacy 55k cohort — no 66k follow-up: ${company}`);
  process.exit(1);
}

const { subject, body, html } = renderEmail(company);

const transport = resolveTransport();
const archiveTo = archiveRecipient();

console.log(`provider=${transport.provider}`);
console.log(`to=${row.email}`);
console.log(`archive=${archiveTo || "(none)"} (追跡なしの別送)`);
console.log(`from=${transport.fromUser}`);
console.log(`subject=${subject}`);
console.log(`host=${transport.host} port=${transport.port}`);
console.log(`mime=multipart/alternative text+html`);

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
    html,
    headers: sendgridSmtpHeaders(),
  };

  const info = await transporter.sendMail(mail);

  const id = info.messageId || info.response || "";
  appendReceipt({ company, email: row.email, messageId: id, track: "buyout_followup" });
  console.log(`RESULT sent messageId=${id}`);
  console.log(`SMTP_MESSAGE_ID=${id}`);

  const arch = await sendArchiveCopy(transporter, {
    from: mail.from, to: row.email, subject, text: body, html,
  });
  if (arch.error) console.warn(`WARN 控えの送信に失敗（本文は送信済み）: ${arch.error}`);
  else if (arch.skipped) console.log(`控え: skip (${arch.skipped})`);
  else console.log(`控え送信 messageId=${arch.messageId}`);
} catch (err) {
  const kind = classifySmtpError(err);
  console.error(`FAIL_KIND=${kind}`);
  console.error(err?.response || err?.message || err);
  process.exit(exitCodeForKind(kind));
}

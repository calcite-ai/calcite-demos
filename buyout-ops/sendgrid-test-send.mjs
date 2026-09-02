#!/usr/bin/env node
/**
 * One-off SendGrid path test (not outreach to prospects).
 * Loads demos/secrets/sendgrid.env (+ optional buyout-smtp From).
 *
 * Usage:
 *   node buyout-ops/sendgrid-test-send.mjs
 *   node buyout-ops/sendgrid-test-send.mjs --to kennta80@yahoo.co.jp
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nodemailer from "nodemailer";
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretsDir = path.join(__dirname, "..", "secrets");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(path.join(secretsDir, "sendgrid.env"));
loadEnvFile(path.join(secretsDir, "buyout-smtp.env"));

function arg(name, fallback = "") {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const to = arg("to", "kennta80@yahoo.co.jp");
const bcc = process.env.BUYOUT_BCC || "kenta.hino1106@gmail.com";
const fromUser = process.env.SENDGRID_FROM || process.env.BUYOUT_SMTP_USER || "hello@calcite-mail.jp";
const apiKey = process.env.SENDGRID_API_KEY;
if (!apiKey) {
  console.error("FAIL missing SENDGRID_API_KEY in secrets/sendgrid.env");
  process.exit(1);
}

const host = "smtp.sendgrid.net";
const port = 465;

console.log(`provider=sendgrid`);
console.log(`from=${fromUser}`);
console.log(`to=${to}`);
console.log(`bcc=${bcc}`);
console.log(`host=${host} port=${port}`);

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: true,
  auth: { user: "apikey", pass: apiKey },
});

const subject = "[テスト] SendGrid + calcite-mail.jp 疎通確認";
const text = `これは SendGrid SMTP 経由のテスト送信です。

From: ${fromUser}
To: ${to}
BCC: ${bcc}

9/11 本番切替前の経路確認用です。問題なければ無視してください。

カルサイト
日野 研太
`;

try {
  const info = await transporter.sendMail({
    from: `"カルサイト 日野 研太" <${fromUser}>`,
    to,
    bcc,
    subject,
    text,
    headers: sendgridSmtpHeaders(),
  });
  console.log(`RESULT sent messageId=${info.messageId || info.response || "unknown"}`);
} catch (err) {
  console.error(`FAIL ${err?.response || err?.message || err}`);
  process.exit(1);
}

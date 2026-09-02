#!/usr/bin/env node
/**
 * Poll ConoHa IMAP for replies to buyout outreach, classify, and auto-handle.
 *
 * - Purchase (A/B/buy) + quoted_price!=55000 → SMTP checkout reply (text/plain)
 * - Legacy 55000 → escalate file only (no 66k checkout)
 * - opt_out / bounce → update CSV
 * - question/custom/other → escalate for human/agent
 *
 * Env: BUYOUT_SMTP_USER / BUYOUT_SMTP_PASS — ConoHa mailbox (IMAP always)
 *      BUYOUT_MAIL_PROVIDER / SENDGRID_API_KEY — outbound (see mail-transport.mjs)
 *      BUYOUT_IMAP_HOST (optional, default ConoHa mail host)
 *      BUYOUT_IMAP_PORT (optional, default 993)
 *
 * Usage:
 *   node buyout-ops/inbox-process.mjs
 *   node buyout-ops/inbox-process.mjs --dry-run
 *   node buyout-ops/inbox-process.mjs --since-days 14
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { parseCsv, serializeCsv } from "./csv-util.mjs";
import { resolveTransport } from "./mail-transport.mjs";
import { sendgridSmtpHeaders } from "./sendgrid-smtp-headers.mjs";
import { METRICS_COLUMNS } from "./metrics-columns.mjs";
import { jstDateString } from "./send-quota.mjs";
import { classifyBounceText, bounceAllowsFailover } from "./smtp-error-kind.mjs";
import {
  classifyReplyBody,
  isPurchaseIntent,
  selectedDemoLabel,
} from "./classify-reply.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsPath = path.join(__dirname, "demo_buyout_leads.csv");
const statePath = path.join(__dirname, "metrics", "inbox-processed.json");
const escalatePath = path.join(__dirname, "metrics", "inbox-escalate.md");
const checkoutTplPath = path.join(__dirname, "templates", "email_demo_buyout_2_checkout.txt");
const CHECKOUT_URL = "https://buy.stripe.com/aFa3cw803gDA7WP5oKbwk01";

const dryRun = process.argv.includes("--dry-run");
const sinceDays = Number(
  (() => {
    const i = process.argv.indexOf("--since-days");
    return i >= 0 ? process.argv[i + 1] : "21";
  })()
);

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`FAIL missing env ${name}`);
    process.exit(1);
  }
  return v;
}

function loadState() {
  if (!fs.existsSync(statePath)) return { ids: {} };
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return { ids: {} };
  }
}

function saveState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}

function appendEscalate(block) {
  fs.mkdirSync(path.dirname(escalatePath), { recursive: true });
  const prev = fs.existsSync(escalatePath) ? fs.readFileSync(escalatePath, "utf8") : "# Inbox escalate\n\n";
  fs.writeFileSync(escalatePath, prev + block + "\n");
}

function ensureMetrics(headers, row) {
  let hdrs = headers;
  for (const col of METRICS_COLUMNS) {
    if (!hdrs.includes(col)) hdrs = [...hdrs, col];
    if (row[col] == null) row[col] = "";
  }
  return hdrs;
}

function renderCheckout(subjectIn) {
  let tpl = fs.readFileSync(checkoutTplPath, "utf8");
  const start = tpl.indexOf("件名：");
  tpl = start >= 0 ? tpl.slice(start) : tpl;
  const cut = tpl.search(/\n# -----/);
  if (cut >= 0) tpl = tpl.slice(0, cut);
  const subjLine = tpl.split("\n")[0];
  const body = tpl.split("\n").slice(1).join("\n").replace(/^\n+/, "");
  const subject = subjLine
    .replace(/^件名：/, "")
    .trim()
    .replace("{前回の件名}", subjectIn.replace(/^Re:\s*/i, "").trim());
  return {
    subject: subject.startsWith("Re:") ? subject : `Re: ${subjectIn.replace(/^Re:\s*/i, "")}`,
    body: body
      .replaceAll("{担当者名}", "ご担当者")
      .replace(/https:\/\/buy\.stripe\.com\/[^\s]+/g, CHECKOUT_URL)
      .trim() + "\n",
  };
}

function extractText(source) {
  const s = String(source || "");
  // Prefer text/plain part roughly
  const plain = s.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\nContent-Type:|$)/i);
  let body = plain ? plain[1] : s;
  body = body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return body.slice(0, 20000);
}

/** Prefer DSN Final-Recipient lines — never match any random address in the bounce body. */
function bounceRecipientHits(bodyText, emailSet) {
  const hits = [];
  const push = (raw) => {
    const e = String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/^<|>$/g, "");
    if (emailSet.has(e) && !hits.includes(e)) hits.push(e);
  };
  const structured =
    bodyText.matchAll(
      /(?:Final-Recipient|Original-Recipient|X-Failed-Recipients):\s*(?:rfc822;\s*)?<?([\w.+-]+@[\w.-]+\.\w+)>?/gi
    ) || [];
  for (const m of structured) push(m[1]);
  if (hits.length) return hits;

  for (const line of bodyText.split(/\r?\n/)) {
    if (
      !/550|551|552|553|5\.1\.1|5\.2\.1|5\.2\.2|mailbox full|user unknown|undeliverable|permanent failure|配信でき|届きません/i.test(
        line
      )
    ) {
      continue;
    }
    for (const em of line.match(/[\w.+-]+@[\w.-]+\.\w+/g) || []) push(em);
  }
  return hits;
}

const user = requireEnv("BUYOUT_SMTP_USER");
const pass = requireEnv("BUYOUT_SMTP_PASS");
const imapHost = process.env.BUYOUT_IMAP_HOST || "mail1004.conoha.ne.jp";
const imapPort = Number(process.env.BUYOUT_IMAP_PORT || "993");
const outbound = resolveTransport();

let { headers, rows } = parseCsv(fs.readFileSync(leadsPath, "utf8"));
const byEmail = new Map();
for (const row of rows) {
  const em = String(row.email || "")
    .trim()
    .toLowerCase();
  if (em) byEmail.set(em, row);
}

const state = loadState();
const since = new Date(Date.now() - sinceDays * 864e5);
let touched = false;
const actions = [];

const client = new ImapFlow({
  host: imapHost,
  port: imapPort,
  secure: true,
  auth: { user, pass },
  logger: false,
});

try {
  await client.connect();
} catch (e) {
  const authFail =
    e?.authenticationFailed ||
    /AUTHENTICATIONFAILED/i.test(String(e?.response || e?.responseText || e?.message || ""));
  if (authFail) {
    appendEscalate(
      [
        `## ${jstDateString()} IMAP AUTH failed`,
        `- host: ${imapHost}:${imapPort}`,
        `- user: ${user}`,
        `- action: GitHub secret \`BUYOUT_SMTP_PASS\` を ConoHa メール箱パスワードに更新（SendGrid APIキーに置換しない）`,
        "",
      ].join("\n")
    );
    console.log(
      "RESULT skip — IMAP authentication failed (update BUYOUT_SMTP_PASS; not a SendGrid API key)"
    );
    process.exit(0);
  }
  throw e;
}
const lock = await client.getMailboxLock("INBOX");
try {
  const uids = await client.search({ since }, { uid: true });
  for (const uid of uids) {
    const key = `uid:${uid}`;
    if (state.ids[key]) continue;

    const msg = await client.fetchOne(
      uid,
      { source: true, envelope: true, uid: true },
      { uid: true }
    );
    if (!msg) continue;

    const fromAddr = (msg.envelope?.from?.[0]?.address || "").toLowerCase();
    const subject = msg.envelope?.subject || "";
    const messageId = msg.envelope?.messageId || key;
    const bodyText = extractText(msg.source?.toString("utf8") || "");

    // Bounce / DSN
    if (/mailer-daemon|postmaster|mail delivery|undelivered/i.test(fromAddr + subject)) {
      const hits = bounceRecipientHits(bodyText, byEmail);
      for (const hit of hits) {
        const row = byEmail.get(hit);
        headers = ensureMetrics(headers, row);
        const bounceKind = classifyBounceText(bodyText);
        const already = Boolean(row.bounce_at) || row.status === "paused";
        if (already) {
          // Do not re-trigger same-day failover every 2h
          actions.push({
            type: "bounce_already",
            company: row.company,
            email: hit,
            bounce_type: row.bounce_type || bounceKind,
            failover: false,
          });
          continue;
        }
        row.bounce_at = jstDateString();
        row.bounce_type = bounceKind;
        row.status = "paused";
        // Free today's quota: successful-send counter only counts status=sent
        row.notes = `${row.notes || ""} / IMAP bounce ${jstDateString()} kind=${bounceKind}`.trim();
        const doFailover = bounceAllowsFailover(bounceKind);
        actions.push({
          type: "bounce",
          company: row.company,
          email: hit,
          bounce_type: bounceKind,
          failover: doFailover,
        });
        if (bounceKind === "spam") {
          appendEscalate(
            [
              `## ${jstDateString()} bounce spam-like — ${row.company}`,
              `- email: ${hit}`,
              `- action: paused; do NOT auto-failover blast`,
              "",
            ].join("\n")
          );
        }
        touched = true;
      }
      state.ids[key] = { at: jstDateString(), kind: "bounce_scan", messageId, hits };
      if (!dryRun) {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
      continue;
    }

    if (!byEmail.has(fromAddr)) {
      state.ids[key] = { at: jstDateString(), kind: "ignored_unknown", from: fromAddr };
      continue;
    }

    const row = byEmail.get(fromAddr);
    if (row.status !== "sent" && row.status !== "paused") {
      // only process outreach we marked sent (or paused after bounce attempt)
      if (!row.sent_at && row.status !== "sent") {
        state.ids[key] = { at: jstDateString(), kind: "ignored_not_sent" };
        continue;
      }
    }

    const replyType = classifyReplyBody(bodyText);
    headers = ensureMetrics(headers, row);
    actions.push({
      type: "reply",
      company: row.company,
      email: fromAddr,
      replyType,
      subject,
    });

    row.reply_type = replyType;
    row.reply_at = row.reply_at || jstDateString();
    row.reply_class = replyType;
    row.notes = `${row.notes || ""} / IMAP reply=${replyType} ${jstDateString()}`.trim();
    touched = true;

    if (replyType === "opt_out") {
      row.do_not_contact = "true";
      row.status = "paused";
    } else if (isPurchaseIntent(replyType)) {
      const demo = selectedDemoLabel(replyType);
      if (demo) row.notes = `${row.notes} / selected_demo=${demo}`;

      if (String(row.quoted_price) === "55000") {
        appendEscalate(
          [
            `## ${jstDateString()} LEGACY 55k purchase — ${row.company}`,
            `- email: ${fromAddr}`,
            `- reply_type: ${replyType}`,
            `- subject: ${subject}`,
            `- action: owner must handle 55k checkout (do NOT send 66k)`,
            "",
          ].join("\n")
        );
        actions.push({ type: "escalate_legacy", company: row.company });
      } else if (row.checkout_status === "checkout_sent") {
        actions.push({ type: "skip_checkout_already_sent", company: row.company });
      } else {
        const mail = renderCheckout(subject);
        if (/google\.com\/url/i.test(mail.body)) {
          console.error("FAIL checkout body wrapped");
          process.exit(1);
        }
        if (dryRun) {
          actions.push({ type: "dry_checkout", company: row.company, to: fromAddr });
        } else {
          const transporter = nodemailer.createTransport({
            host: outbound.host,
            port: outbound.port,
            secure: outbound.port === 465,
            auth: { user: outbound.user, pass: outbound.pass },
          });
          await transporter.sendMail({
            from: `"カルサイト 日野 研太" <${outbound.fromUser}>`,
            to: fromAddr,
            bcc: process.env.BUYOUT_BCC || "kenta.hino1106@gmail.com",
            subject: mail.subject,
            text: mail.body,
            inReplyTo: messageId,
            references: messageId,
            headers: sendgridSmtpHeaders(),
          });
          row.checkout_status = "checkout_sent";
          row.notes = `${row.notes} / checkout_sent ${jstDateString()}`;
          actions.push({ type: "checkout_sent", company: row.company, to: fromAddr });
        }
      }
    } else {
      appendEscalate(
        [
          `## ${jstDateString()} needs human — ${row.company}`,
          `- email: ${fromAddr}`,
          `- reply_type: ${replyType}`,
          `- subject: ${subject}`,
          `- snippet: ${bodyText.replace(/\s+/g, " ").slice(0, 240)}`,
          "",
        ].join("\n")
      );
      actions.push({ type: "escalate", company: row.company, replyType });
    }

    state.ids[key] = {
      at: jstDateString(),
      kind: replyType,
      company: row.company,
      messageId,
    };
    if (!dryRun) {
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    }
  }
} finally {
  lock.release();
  await client.logout();
}

if (touched && !dryRun) {
  fs.writeFileSync(leadsPath, serializeCsv(headers, rows) + "\n");
}
if (!dryRun) saveState(state);

const bounceFailover = actions.some((a) => a.type === "bounce" && a.failover);
console.log(JSON.stringify({ dryRun, actions, count: actions.length, bounceFailover }, null, 2));
console.log(`RESULT ok — processed actions=${actions.length} bounceFailover=${bounceFailover ? 1 : 0}`);
console.log(`BOUNCE_FAILOVER=${bounceFailover ? 1 : 0}`);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `bounce_failover=${bounceFailover ? 1 : 0}\n`
  );
}
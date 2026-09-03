#!/usr/bin/env node
/**
 * 宛先メールボックスの実在確認（MX 解決 + SMTP RCPT TO プローブ）。
 *
 * 由来: 2026-09-03 黒田工務店 kurota-koumuten@hb.tp1.jp / 鐵舟 m.koga@tessyu.jp が
 *       いずれも 550 5.1.1 User Unknown で即ハードバウンス。ドメインは実在するので
 *       campaign-score.mjs の isValidPublicEmail（記入例アドレス除去）では防げない。
 *
 * DATA は絶対に送らない = このプローブでメールが1通も配送されないこと。
 *   接続 → EHLO → MAIL FROM → RCPT TO → (ランダム宛でもう1回 RCPT) → QUIT
 *
 * 判定は3値。宛先を捨てるのは「明確な恒久拒否」だけに限る。
 *   ok      … RCPT が 2xx で、かつ catch-all ではない
 *   dead    … 5.1.1 / user unknown 系の恒久拒否、または NXDOMAIN
 *   unknown … タイムアウト / 25番ブロック / 4xx グレイリスト / catch-all / 判別不能な5xx
 *
 * 限界（重要・過信禁止）:
 *   - catch-all(accept-all) サーバは存在しない宛先でも 2xx を返す。ランダムな
 *     ローカルパートを追加プローブして検知するが、検知できたら ok ではなく unknown。
 *   - 送信元IPの評価で RCPT 前に切られるサーバがある（住宅IP・クラウドIP）。
 *   - GitHub Actions ランナー（Azure）は outbound 25 が塞がれているので常に unknown。
 *   - よって unknown を dead 扱いにしてはいけない。unknown は「送ってよい」。
 *
 * Usage:
 *   node buyout-ops/verify-recipient.mjs --email info@example.co.jp
 *   node buyout-ops/verify-recipient.mjs --email a@x.jp --email b@y.jp --json
 *
 * Env:
 *   SKIP_RECIPIENT_PROBE=1    プローブ無効（CI / オフライン）
 *   FORCE_RECIPIENT_PROBE=1   GitHub Actions でも強行（通常不要）
 *   RECIPIENT_PROBE_TIMEOUT_MS / RECIPIENT_PROBE_FROM / RECIPIENT_PROBE_HELO
 */
import dns from "node:dns/promises";
import net from "node:net";
import { fileURLToPath } from "node:url";

export const PROBE_MAIL_FROM = process.env.RECIPIENT_PROBE_FROM || "hello@calcite-mail.jp";
export const PROBE_HELO = process.env.RECIPIENT_PROBE_HELO || "calcite-mail.jp";
export const PROBE_TIMEOUT_MS = Number(process.env.RECIPIENT_PROBE_TIMEOUT_MS || 10000);

/** 恒久拒否のうち「その宛先が無い」と読めるもの */
const USER_UNKNOWN = new RegExp(
  [
    "5\\.1\\.1",
    "5\\.1\\.10",
    "5\\.4\\.1",
    "user unknown",
    "unknown user",
    "user not found",
    "no such user",
    "no such recipient",
    "no such address",
    "does not exist",
    "doesn't exist",
    "not exist",
    "mailbox unavailable",
    "mailbox is unavailable",
    "mailbox not found",
    "no mailbox",
    "invalid recipient",
    "invalid mailbox",
    "recipient address rejected",
    "recipient not found",
    "address unknown",
    "unrouteable address",
    "存在しません",
    "見つかりません",
  ].join("|"),
  "i"
);

/** 5xx でも「宛先が無い」以外の理由。dead にしてはいけない */
const NOT_USER_UNKNOWN = new RegExp(
  [
    "5\\.7\\.",
    "spam",
    "blacklist",
    "blocklist",
    "blocked",
    "reputation",
    "rbl",
    "dnsbl",
    "spamhaus",
    "policy",
    "relay",
    "spf",
    "dkim",
    "dmarc",
    "greylist",
    "grey-list",
    "rate limit",
    "too many",
    "try again",
    "temporar",
    "authentication",
  ].join("|"),
  "i"
);

/** GitHub Actions（Azure）は outbound 25 が塞がれているため既定でプローブしない */
export function isRecipientProbeEnabled() {
  if (process.env.FORCE_RECIPIENT_PROBE === "1") return true;
  if (process.env.SKIP_RECIPIENT_PROBE === "1") return false;
  if (process.env.GITHUB_ACTIONS === "true") return false;
  return true;
}

export function probeSkipReason() {
  if (process.env.FORCE_RECIPIENT_PROBE === "1") return "";
  if (process.env.SKIP_RECIPIENT_PROBE === "1") return "SKIP_RECIPIENT_PROBE=1";
  if (process.env.GITHUB_ACTIONS === "true") return "GitHub Actions は outbound 25 が塞がれている";
  return "";
}

function randomLocalPart() {
  return `calcite-probe-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/**
 * 1本の SMTP セッションで複数の RCPT TO を試す。DATA は送らない。
 * 解決値は必ず返る（reject しない）。
 */
function smtpRcptSession(host, recipients, { timeoutMs = PROBE_TIMEOUT_MS, port = 25 } = {}) {
  return new Promise((resolve) => {
    const result = { host, connected: false, error: null, greeting: null, rcpt: [] };
    let buffer = "";
    let waiter = null;
    let settled = false;
    let socket;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error && !result.error) result.error = error;
      clearTimeout(timer);
      if (waiter) {
        const w = waiter;
        waiter = null;
        w.reject(new Error(result.error || "closed"));
      }
      try {
        socket?.destroy();
      } catch {
        /* noop */
      }
      resolve(result);
    };

    const timer = setTimeout(() => finish("timeout"), timeoutMs);

    function tryFlush() {
      if (!waiter) return;
      const lines = buffer.split(/\r?\n/);
      for (let i = 0; i < lines.length - 1; i++) {
        // 最終行は "250 text"（3桁 + 半角スペース）。"250-text" は継続行
        if (!/^\d{3}(?: |$)/.test(lines[i])) continue;
        const reply = {
          code: Number(lines[i].slice(0, 3)),
          text: lines
            .slice(0, i + 1)
            .join(" ")
            .replace(/\s+/g, " ")
            .trim(),
        };
        buffer = lines.slice(i + 1).join("\r\n");
        const w = waiter;
        waiter = null;
        w.resolve(reply);
        return;
      }
    }

    const readReply = () =>
      new Promise((resolve2, reject2) => {
        waiter = { resolve: resolve2, reject: reject2 };
        tryFlush();
      });

    const command = async (line) => {
      socket.write(`${line}\r\n`);
      return readReply();
    };

    try {
      socket = net.createConnection({ host, port });
    } catch (e) {
      finish(e?.code || e?.message || "connect_failed");
      return;
    }

    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => finish("timeout"));
    socket.on("error", (e) => finish(e?.code || e?.message || "socket_error"));
    socket.on("close", () => finish(null));
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      tryFlush();
    });

    socket.on("connect", async () => {
      result.connected = true;
      try {
        const greeting = await readReply();
        result.greeting = greeting;
        if (greeting.code !== 220) {
          finish(`greeting_${greeting.code}`);
          return;
        }
        let hello = await command(`EHLO ${PROBE_HELO}`);
        if (hello.code !== 250) hello = await command(`HELO ${PROBE_HELO}`);
        result.hello = hello;
        if (hello.code !== 250) {
          finish(`helo_${hello.code}`);
          return;
        }
        const mailFrom = await command(`MAIL FROM:<${PROBE_MAIL_FROM}>`);
        result.mailFrom = mailFrom;
        if (mailFrom.code >= 300) {
          finish(`mailfrom_${mailFrom.code}`);
          return;
        }
        for (const address of recipients) {
          const reply = await command(`RCPT TO:<${address}>`);
          result.rcpt.push({ address, code: reply.code, text: reply.text });
        }
        // DATA は送らない。ここで必ず切る
        socket.write("QUIT\r\n");
        finish(null);
      } catch (e) {
        finish(e?.message || "io_error");
      }
    });
  });
}

/** RCPT 応答1件 → accepted / rejected / ambiguous */
function classifyRcpt(reply) {
  if (!reply) return { verdict: "ambiguous", why: "no_reply" };
  const { code, text } = reply;
  if (code === 250 || code === 251) return { verdict: "accepted", why: `${code}` };
  if (code === 252) return { verdict: "ambiguous", why: "252 cannot verify" };
  if (code >= 400 && code < 500) return { verdict: "ambiguous", why: `${code} temporary` };
  if (code >= 500) {
    if (NOT_USER_UNKNOWN.test(text)) return { verdict: "ambiguous", why: `${code} policy/blocked` };
    if (USER_UNKNOWN.test(text)) return { verdict: "rejected", why: `${code} user-unknown` };
    return { verdict: "ambiguous", why: `${code} unclassified` };
  }
  return { verdict: "ambiguous", why: `${code}` };
}

async function resolveMailHosts(domain) {
  try {
    const mx = await dns.resolveMx(domain);
    const hosts = mx
      .filter((m) => m.exchange && m.exchange !== ".")
      .sort((a, b) => a.priority - b.priority)
      .map((m) => m.exchange);
    if (hosts.length) return { hosts, source: "mx" };
  } catch (e) {
    if (e.code !== "ENODATA" && e.code !== "ENOTFOUND") {
      return { hosts: [], source: "mx_error", error: e.code || e.message };
    }
  }
  // MX 無し → RFC5321 の implicit MX（A/AAAA）にフォールバック
  try {
    const a = await dns.resolve4(domain);
    if (a.length) return { hosts: [domain], source: "a" };
  } catch (e) {
    if (e.code === "ENOTFOUND" || e.code === "NXDOMAIN") {
      return { hosts: [], source: "nxdomain" };
    }
    return { hosts: [], source: "a_error", error: e.code || e.message };
  }
  return { hosts: [], source: "no_host" };
}

/**
 * 1宛先を検証する。
 * @returns {Promise<{email,domain,state:"ok"|"dead"|"unknown"|"skipped",reason,detail,mx,catch_all,elapsed_ms}>}
 */
export async function verifyRecipient(email, opts = {}) {
  const started = Date.now();
  const address = String(email || "").trim();
  const domain = address.split("@")[1]?.toLowerCase() || "";
  const timeoutMs = opts.timeoutMs ?? PROBE_TIMEOUT_MS;
  const maxHosts = opts.maxHosts ?? 2;
  const done = (state, reason, extra = {}) => ({
    email: address,
    domain,
    state,
    reason,
    detail: "",
    mx: "",
    catch_all: null,
    elapsed_ms: Date.now() - started,
    ...extra,
  });

  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(address)) {
    return done("unknown", "invalid_syntax", { detail: "V16 側で弾く想定" });
  }
  if (opts.force !== true && !isRecipientProbeEnabled()) {
    return done("skipped", "probe_disabled", { detail: probeSkipReason() });
  }

  const { hosts, source, error } = await resolveMailHosts(domain);
  if (source === "nxdomain") {
    return done("dead", "nxdomain", { detail: "MX も A も無い（ドメイン自体が引けない）" });
  }
  if (!hosts.length) {
    return done("unknown", "dns_failed", { detail: `${source} ${error || ""}`.trim() });
  }

  const probeAddress = `${randomLocalPart()}@${domain}`;
  let last = null;
  for (const host of hosts.slice(0, maxHosts)) {
    const session = await smtpRcptSession(host, [address, probeAddress], { timeoutMs });
    last = session;
    if (!session.rcpt.length) continue;

    const target = classifyRcpt(session.rcpt[0]);
    const control = session.rcpt[1] ? classifyRcpt(session.rcpt[1]) : null;
    const catchAll = control ? control.verdict === "accepted" : null;
    const detail = session.rcpt[0].text.slice(0, 160);

    if (target.verdict === "accepted") {
      if (catchAll === true) {
        return done("unknown", "catch_all", {
          detail: `accept-all ドメイン（ランダム宛も 2xx）: ${detail}`,
          mx: host,
          catch_all: true,
        });
      }
      return done("ok", "rcpt_accepted", { detail, mx: host, catch_all: catchAll });
    }
    if (target.verdict === "rejected") {
      return done("dead", "rcpt_rejected", { detail, mx: host, catch_all: catchAll });
    }
    return done("unknown", target.why, { detail, mx: host, catch_all: catchAll });
  }

  return done("unknown", `no_rcpt_result`, {
    detail: last?.error ? `${last.host}: ${last.error}` : hosts[0],
    mx: hosts[0],
  });
}

/**
 * 複数宛先をまとめて検証する。
 * 同一ドメインは必ず逐次＋小休止（1台のメールサーバを連打しない）。
 * 別ドメイン同士だけ concurrency 本まで並列に走らせる。
 */
export async function verifyRecipients(emails, opts = {}) {
  const delayMs = opts.delayMs ?? 1200;
  const concurrency = Math.max(1, opts.concurrency ?? 1);
  const onResult = opts.onResult || (() => {});
  const total = emails.length;

  const byDomain = new Map();
  for (const email of emails) {
    const d = String(email || "").split("@")[1]?.toLowerCase() || "";
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d).push(email);
  }
  const domainQueues = [...byDomain.values()];

  const results = [];
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < domainQueues.length) {
      const queue = domainQueues[cursor++];
      for (let i = 0; i < queue.length; i++) {
        const r = await verifyRecipient(queue[i], opts);
        results.push(r);
        onResult(r, ++done, total);
        if (i < queue.length - 1 && delayMs > 0) {
          await new Promise((res) => setTimeout(res, delayMs));
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, domainQueues.length) }, worker));
  return results;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const emails = [];
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--email") emails.push(process.argv[i + 1]);
  }
  if (!emails.length) {
    console.error("Usage: node buyout-ops/verify-recipient.mjs --email a@b.jp [--email c@d.jp] [--json]");
    process.exit(2);
  }
  const results = await verifyRecipients(emails, { force: true });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(
        `${r.state.toUpperCase()} ${r.email} (${r.reason}) mx=${r.mx || "-"} catch_all=${r.catch_all} ${r.detail}`
      );
    }
  }
  process.exit(results.some((r) => r.state === "dead") ? 1 : 0);
}

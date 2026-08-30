/**
 * G1 (需要・粗) 機械判定 — Hunter §5「新しすぎ除外」と audit_notes 最低要件。
 * C0（別公式）は人手。本モジュールは再発防止（石川型）用。
 */
const UA = { "User-Agent": "Mozilla/5.0 (compatible; CalciteBuyoutG1/1.0)" };
const RECENT_YEAR = 2023;

export function httpToHttps(url) {
  return String(url || "").replace(/^http:\/\//i, "https://");
}

export function originFromUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return String(url || "").replace(/\/$/, "");
  }
}

export async function fetchSiteSignals(url) {
  let lastErr;
  // Actions runner からの一時不通対策（マゴメ 2026-08-29 fetch failed）
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, {
        headers: UA,
        redirect: "follow",
        signal: AbortSignal.timeout(25000),
      });
      const html = await res.text();
      const finalUrl = res.url;
      const years = [...html.matchAll(/20[0-9]{2}/g)]
        .map((m) => +m[0])
        .filter((y) => y >= 2000 && y <= 2030);
      return {
        status: res.status,
        finalUrl,
        html,
        finalHttps: finalUrl.startsWith("https://"),
        hasViewport: /name=["']viewport["']/i.test(html),
        telCount: [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].length,
        maxYear: years.length ? Math.max(...years) : null,
      };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr || new Error("fetch failed");
}

async function trySignals(url) {
  try {
    const s = await fetchSiteSignals(url);
    if (s.status === 200) return s;
  } catch {
    /* cert error / connection refused = https 未対応の可能性 */
  }
  return null;
}

/**
 * Hunter C1（リスト収集時）: 種が http でも https を試し、通れば SSL未整備にしない。
 * Chrome の自動 https 上げは Node では起きないので、こちらで明示する。
 */
export async function probeHttpsAvailable(seedUrl) {
  const seed = String(seedUrl || "").trim();
  if (!seed.startsWith("http")) {
    return { ok: false, home: null, origin: seed };
  }

  const httpsSeed = httpToHttps(seed);
  const httpsHome = await trySignals(httpsSeed);
  if (httpsHome?.finalHttps) {
    return { ok: true, home: httpsHome, origin: originFromUrl(httpsHome.finalUrl) };
  }

  const httpSeed = /^https:/i.test(seed) ? seed.replace(/^https:\/\//i, "http://") : seed;
  const httpHome = await trySignals(httpSeed);
  if (httpHome?.finalHttps) {
    return { ok: true, home: httpHome, origin: originFromUrl(httpHome.finalUrl) };
  }
  if (httpHome) {
    const httpsAfter = await trySignals(httpToHttps(httpHome.finalUrl));
    if (httpsAfter?.finalHttps) {
      return { ok: true, home: httpsAfter, origin: originFromUrl(httpsAfter.finalUrl) };
    }
    return { ok: false, home: httpHome, origin: originFromUrl(httpHome.finalUrl) };
  }

  if (httpsHome) {
    return {
      ok: Boolean(httpsHome.finalHttps),
      home: httpsHome,
      origin: originFromUrl(httpsHome.finalUrl),
    };
  }
  return { ok: false, home: null, origin: originFromUrl(seed) };
}

/** Hunter §5 / スコア −5: モダンCMSで導線も良い */
export function evaluateModernExclusion(signals) {
  const { finalHttps, hasViewport, telCount, maxYear } = signals;
  if (finalHttps && hasViewport && telCount >= 1 && maxYear != null && maxYear >= RECENT_YEAR) {
    return {
      exclude: true,
      code: "MODERN_SITE",
      message: `G1除外: HTTPS+viewport+tel:+HTML更新${maxYear}≥${RECENT_YEAR}（サイト新し・導線整備済）`,
    };
  }
  return { exclude: false };
}

/** sales_prospects.csv のメタデータ除外 */
export function evaluateProspectListMeta(row) {
  const rank = (row["ランク"] || "").trim();
  const hp = `${row["HP有無"] || ""} ${row["HP状態(詳細)"] || ""}`;
  const note = `${row["備考"] || ""}`;
  if (rank === "除外" || rank.startsWith("除外")) {
    return { exclude: true, code: "RANK_EXCLUDED", message: "ランク=除外" };
  }
  if (/モダン|正常|比較的モダン|現行|新しすぎ/.test(hp)) {
    return { exclude: true, code: "HP_MODERN", message: `HP状態がモダン/正常 (${hp.trim().slice(0, 48)})` };
  }
  if (/見送り|対象外|buyout見送り|G1不合格/.test(note)) {
    return { exclude: true, code: "NOTE_PASS", message: "備考で見送り/対象外" };
  }
  return { exclude: false };
}

/** demo_buyout_leads.csv audit_notes の最低要件 */
export function evaluateAuditNotes(audit_notes) {
  const text = audit_notes || "";
  if (/G1不合格|G1見送り|サイト新し/.test(text)) {
    return { fail: true, code: "AUDIT_G1_FAIL", message: "audit_notes に G1不合格/見送り" };
  }
  const roughLine = text.match(/粗:[^\n]*/)?.[0] || "";
  const defectCount = [...roughLine.matchAll(/\(\d+\)/g)].length;
  if (defectCount < 2) {
    return {
      fail: true,
      code: "AUDIT_DEFECTS",
      message: `audit_notes の粗が${defectCount}点（2点以上必須）`,
    };
  }
  return { fail: false, defectCount };
}

export async function evaluateSiteG1(siteUrl) {
  if (!siteUrl?.startsWith("http")) {
    return { pass: false, fails: ["site_url が http(s) でない"], signals: null };
  }
  let signals;
  try {
    signals = await fetchSiteSignals(siteUrl);
  } catch (e) {
    return { pass: false, fails: [`サイト取得失敗: ${e.message}`], signals: null };
  }
  if (signals.status !== 200) {
    return { pass: false, fails: [`サイト HTTP ${signals.status}`], signals };
  }
  const modern = evaluateModernExclusion(signals);
  if (modern.exclude) {
    return { pass: false, fails: [modern.message], code: modern.code, signals };
  }
  return { pass: true, signals, fails: [] };
}

/** 機械検出できる粗（C1/C2/C3/C4 の一部）。2点以上で G1 候補 */
export function detectMachineDefects(signals) {
  const defects = [];
  if (!signals.finalHttps) defects.push("SSL未整備");
  if (!signals.hasViewport) defects.push("viewportなし");
  if (signals.telCount === 0) defects.push("tel:なし");
  if (signals.maxYear != null && signals.maxYear < 2020) {
    defects.push(`更新停止感(HTML内${signals.maxYear}止)`);
  }
  return defects;
}

export function formatRoughAudit(defects) {
  if (defects.length < 2) return "";
  const parts = defects.slice(0, 3).map((d, i) => `(${i + 1})${d}`);
  return `粗:${parts.join(";")}`;
}

/** 公開メール抽出（推測禁止: HTML に載っているもののみ） */
export function extractPublicEmails(html) {
  const raw = [
    ...html.matchAll(/mailto:([^\s"'?>]+)/gi),
    ...html.matchAll(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g),
  ].map((m) => (m[1] || m[0]).replace(/^mailto:/i, "").trim().toLowerCase());
  const bad =
    /example|exsample|sample@|test@|dummy@|wixpress|sentry|wordpress\.com|aaa@bbb|aaa\.jp|your@|xxx@|email@email\.me|info@email\.jp|you@company\.com|abcde@fghijk\.com|@[^@]*\.(png|jpg|jpeg|gif|webp|svg|ico)(?:\?|$)/i;
  return [...new Set(raw.filter((e) => e.includes("@") && !bad.test(e) && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)))];
}

const CONTACT_PATHS = [
  "",
  "/contact/",
  "/contact",
  "/inquiry/",
  "/inquiry",
  "/company/",
  "/company.html",
  "/about/",
  "/toiawase/",
  "/form/",
  "/gaiyou/",
  "/gaiyou.html",
  "/profile/",
  "/corporate/",
  "/access/",
  "/outline.html",
];

export async function fetchSiteWithContacts(baseUrl) {
  const probe = await probeHttpsAvailable(baseUrl);
  const origins = [];
  const pushOrigin = (o) => {
    const n = String(o || "")
      .replace(/\/index\.html?$/i, "")
      .replace(/\/$/, "");
    if (n && !origins.includes(n)) origins.push(n);
  };
  pushOrigin(probe.origin);
  pushOrigin(originFromUrl(baseUrl));
  if (probe.ok) pushOrigin(httpToHttps(originFromUrl(baseUrl)));

  let bestSignals = probe.home;
  let emails = bestSignals ? extractPublicEmails(bestSignals.html) : [];
  let fetchedFrom = bestSignals?.finalUrl || baseUrl;
  const seen = new Set(bestSignals ? [fetchedFrom, `${probe.origin}/`] : []);

  for (const origin of origins) {
    if (emails.length) break;
    for (const p of CONTACT_PATHS) {
      const url = p ? `${origin}${p}` : `${origin}/`;
      if (seen.has(url)) continue;
      seen.add(url);
      try {
        const signals = await fetchSiteSignals(url);
        if (signals.status !== 200) continue;
        const found = extractPublicEmails(signals.html);
        if (found.length) emails = [...new Set([...emails, ...found])];
        if (!bestSignals || found.length) {
          bestSignals = signals;
          fetchedFrom = url;
        }
        if (emails.length && p === "") break;
      } catch {
        /* skip path */
      }
    }
    if (emails.length) break;
  }

  if (bestSignals && probe.ok) {
    bestSignals = { ...bestSignals, finalHttps: true };
  }

  return { signals: bestSignals, emails, fetchedFrom, httpsOk: probe.ok };
}

/** queued/built 行の総合 G1（サイト再取得 + audit_notes） */
export async function evaluateLeadG1({ site_url, audit_notes, status, asQueued = false }) {
  const fails = [];
  const effective = asQueued ? "queued" : status;
  if (effective === "queued" || effective === "built") {
    const audit = evaluateAuditNotes(audit_notes);
    if (audit.fail) fails.push(audit.message);
    if (site_url) {
      const site = await evaluateSiteG1(site_url);
      if (!site.pass) fails.push(...site.fails);
    } else {
      fails.push("site_url が空（G1再確認不可）");
    }
  }
  return { pass: fails.length === 0, fails };
}

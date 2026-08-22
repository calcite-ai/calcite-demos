/**
 * G1 (需要・粗) 機械判定 — Hunter §5「新しすぎ除外」と audit_notes 最低要件。
 * C0（別公式）は人手。本モジュールは再発防止（石川型）用。
 */
const UA = { "User-Agent": "Mozilla/5.0 (compatible; CalciteBuyoutG1/1.0)" };
const RECENT_YEAR = 2023;

export async function fetchSiteSignals(url) {
  const res = await fetch(url, { headers: UA, redirect: "follow" });
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

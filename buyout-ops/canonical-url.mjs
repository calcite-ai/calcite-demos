/** Direct https URLs for outreach. Gmail の google.com/url は本文に書かない。 */

export const CALCITE_SITE = "https://www.calcite-ai.jp/";
/** コールド営業・inside 送信専用（From / 署名 Mail）。Web は CALCITE_SITE のまま。 */
export const OUTREACH_MAIL = "hello@calcite-mail.jp";

/** GitHub Pages 正本（CSV・verify 用） */
export const GITHUB_DEMO_ORIGIN =
  process.env.BUYOUT_DEMO_GITHUB_ORIGIN || "https://calcite-ai.github.io/calcite-demos";

/** メール本文用の短いデモ URL（calcite-mail.jp 静的リダイレクト） */
export const DEMO_SHORT_BASE =
  process.env.BUYOUT_DEMO_SHORT_BASE || "https://www.calcite-mail.jp/demo";

const DEMO_PATH_RE = /buyout-prospects\/([^/?#]+)\/([^/?#]+)/i;

export function parseDemoSkinPath(url) {
  const m = String(url || "").match(DEMO_PATH_RE);
  if (!m) return null;
  return { slug: m[1], skin: m[2] };
}

/** メールに載せる短いデモ URL（slug/skin を抽出して calcite-mail.jp へ） */
export function publicDemoUrl(url, label = "demo") {
  const stored = assertDirectHttpsUrl(url, label);
  const parts = parseDemoSkinPath(stored);
  if (!parts) return withTrailingSlash(stored);
  return withTrailingSlash(`${DEMO_SHORT_BASE}/${parts.slug}/${parts.skin}`);
}

export function unwrapGmailRedirect(url) {
  const s = String(url || "").trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    if ((u.hostname === "www.google.com" || u.hostname === "google.com") && u.pathname === "/url") {
      const q = u.searchParams.get("q");
      if (q) return unwrapGmailRedirect(q);
    }
  } catch {
    /* fall through */
  }
  const m = s.match(/[?&]q=(https?[^&\s]+)/i);
  if (m) {
    try {
      return unwrapGmailRedirect(decodeURIComponent(m[1]));
    } catch {
      return m[1];
    }
  }
  return s;
}

export function assertDirectHttpsUrl(url, label = "url") {
  const s = unwrapGmailRedirect(url);
  if (/google\.com\/url/i.test(String(url || "")) || /google\.com\/url/i.test(s)) {
    throw new Error(`${label} に google.com/url が入っている。最終URLを直接書く`);
  }
  if (!/^https:\/\//i.test(s)) {
    throw new Error(`${label} は https:// で始める: ${s}`);
  }
  return s;
}

/** Path URLs (デモ) は末尾 / を付けて GitHub Pages の 301 を避ける */
export function withTrailingSlash(url) {
  const s = String(url || "").trim();
  if (!s || /[?#]/.test(s)) return s;
  return s.endsWith("/") ? s : `${s}/`;
}

export function canonicalDemoUrl(url, label = "demo") {
  return withTrailingSlash(assertDirectHttpsUrl(url, label));
}

export function canonicalCalciteSite() {
  return CALCITE_SITE;
}

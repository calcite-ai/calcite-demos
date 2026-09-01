/**
 * 御社サイトから写真1〜2枚を取得し、デモ shared/images/ に保存する。
 * 推測画像は使わない。取得失敗時は在庫ストックのまま。
 */
import fs from "node:fs";
import path from "node:path";

const SKIP_RE =
  /logo|icon|button|banner|spacer|pixel|analytics|facebook|twitter|blank|noimage|header|footer|arrow|sns|social|map|qr|gif|svg/i;
const MIN_BYTES = 6000;
const MAX_BYTES = 8 * 1024 * 1024;

function extFromContentType(ct) {
  const t = String(ct || "").toLowerCase();
  if (t.includes("png")) return ".png";
  if (t.includes("webp")) return ".webp";
  if (t.includes("jpeg") || t.includes("jpg")) return ".jpg";
  return "";
}

function extFromUrl(url) {
  const m = String(url).match(/\.(jpe?g|png|webp)(?:[?#]|$)/i);
  return m ? `.${m[1].toLowerCase().replace("jpeg", "jpg")}` : "";
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return "";
  }
}

function extractImageUrls(html, pageUrl) {
  const urls = [];
  const push = (href) => {
    const u = resolveUrl(pageUrl, href);
    if (!u || !/^https?:\/\//i.test(u)) return;
    if (/\.(gif|svg)(?:[?#]|$)/i.test(u)) return;
    if (SKIP_RE.test(u)) return;
    urls.push(u);
  };

  for (const m of String(html).matchAll(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/gi)) {
    push(m[1]);
  }
  for (const m of String(html).matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    push(m[1]);
  }

  return [...new Set(urls)];
}

async function downloadImage(url, destPath, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "CalciteBuyoutDemo/1.0" },
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!/image\//i.test(ct) && !/\.(jpe?g|png|webp)(?:[?#]|$)/i.test(url)) return false;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) return false;

    let ext = extFromUrl(url) || extFromContentType(ct) || ".jpg";
    const finalPath = destPath.replace(/\.[a-z]+$/i, ext);
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });
    fs.writeFileSync(finalPath, buf);
    return finalPath;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {{ hero: string|null, photo2: string|null }} 保存したファイル名（shared/images 直下）
 */
export async function fetchProspectSiteImages(siteUrl, outImagesDir, { maxImages = 2 } = {}) {
  if (!siteUrl) return { hero: null, photo2: null };

  let html = "";
  let pageUrl = siteUrl;
  try {
    const res = await fetch(siteUrl, {
      redirect: "follow",
      headers: { "User-Agent": "CalciteBuyoutDemo/1.0" },
    });
    if (!res.ok) return { hero: null, photo2: null };
    html = await res.text();
    pageUrl = res.url;
  } catch {
    return { hero: null, photo2: null };
  }

  const candidates = extractImageUrls(html, pageUrl);
  const saved = [];

  for (const url of candidates) {
    if (saved.length >= maxImages) break;
    const baseName = saved.length === 0 ? "prospect-hero" : "prospect-photo-2";
    const dest = path.join(outImagesDir, `${baseName}.jpg`);
    const written = await downloadImage(url, dest);
    if (written) saved.push(path.basename(written));
  }

  return {
    hero: saved[0] || null,
    photo2: saved[1] || null,
  };
}

/** HTML/CSS 内の在庫写真ファイル名を御社サイト写真へ差し替え */
export function prospectImageReplacements(imagesDir, { hero, photo2 } = {}) {
  const reps = [];
  if (hero && fs.existsSync(path.join(imagesDir, hero))) {
    for (const stock of ["hero-dark.jpg", "hero-atelier.jpg", "hero-street.jpg"]) {
      reps.push([stock, hero]);
    }
    reps.push(["gallery-1.jpg", hero]);
  }
  if (photo2 && fs.existsSync(path.join(imagesDir, photo2))) {
    reps.push(["gallery-2.jpg", photo2]);
  }
  return reps;
}

/**
 * @deprecated 営業デモでは先方サイトから画像を拾わない（著作権・印象リスク）。
 * swap-prospect / 9:00 Automation は在庫 Unsplash・AI素材のみ使う。
 * このモジュールはレガシー互換のため残すが、新規呼び出し禁止・取得は常に no-op。
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 先方サイト画像の取得は禁止。常に空を返す。
 * @returns {{ hero: null, photo2: null }}
 */
export async function fetchProspectSiteImages() {
  console.warn(
    "WARN fetchProspectSiteImages: 営業デモでは先方サイト画像の取得は禁止（在庫素材のみ）。呼び出しを無視します。"
  );
  return { hero: null, photo2: null };
}

/** 差し替えなし（在庫ファイル名のまま） */
export function prospectImageReplacements(_imagesDir, _picked = {}) {
  return [];
}

/** 公開デモに先方スクレイプ画像が残っていないか（ゲート用） */
export function listForbiddenProspectImageFiles(imagesDir) {
  if (!fs.existsSync(imagesDir)) return [];
  return fs
    .readdirSync(imagesDir)
    .filter((f) => /^prospect-(hero|photo)/i.test(f));
}

/** path helper for tests */
export function prospectImagesDir(slugDir) {
  return path.join(slugDir, "shared", "images");
}

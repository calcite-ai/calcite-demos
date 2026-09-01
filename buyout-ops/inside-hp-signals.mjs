/**
 * hp_improve 用シグナル検出・観察文生成（事実ベース。推測で足さない）。
 */

export function defectTokens(defects) {
  return String(defects || "")
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** HTML / signals から hp_improve evidence トークンを追加 */
export function enrichHpImproveEvidence(defects = "", { html = "", signals = null } = {}) {
  const evidence = [];
  const tokens = defectTokens(defects);

  for (const d of tokens) {
    if (/tel/i.test(d)) evidence.push("tel:なし");
    else if (/更新停止/i.test(d)) evidence.push(d);
    else if (/viewport/i.test(d)) evidence.push("viewportなし");
    else if (/SSL|https未/i.test(d)) evidence.push("SSL未整備");
    else evidence.push(d);
  }

  const text = String(html || "");
  if (/one-page|onepage/i.test(text)) evidence.push("ワンページ構成");
  if (signals?.finalHttps && /href=["']http:\/\//i.test(text)) {
    evidence.push("httpsサイト内http混在");
  }
  if (/SemiColonWeb|Canvas Logo|one-page-menu/i.test(text)) {
    evidence.push("テンプレート残骸");
  }
  if (/<li><a[^>]*><div>(Home|About|Works|Services|Contact)<\/div>/i.test(text)) {
    evidence.push("英語メニュー");
  }

  return [...new Set(evidence)];
}

const OBSERVATION_BY_TOKEN = {
  "tel:なし": () =>
    "電話番号は記載がありますが、タップして発信できる形式（tel:）になっておらず、外出先からの連絡が一手間かかりやすい",
  ワンページ構成: () =>
    "実績・会社概要・問い合わせが1ページに集約されており、「公共工事の実績」「会社としての体制」など、目的別に判断しづらい",
  httpsサイト内http混在: () =>
    "httpsのページ内に、httpのままのリンク（お問い合わせ先など）があり、環境によっては警告や違和感につながりやすい",
  テンプレート残骸: () =>
    "テンプレート由来の表記や構成の名残があり、自社サイトとしての完成度がやや損なわれやすい",
  英語メニュー: () =>
    "メニューが英語表記のままで、初見の発注者には「どこに何があるか」を探す負担が残りやすい",
  viewportなし: () =>
    "スマホ表示用の設定が弱く、画面幅によっては読みづらい・操作しづらい印象になりやすい",
  SSL未整備: () =>
    "https未対応のページがあり、初めて訪れた方が不安に感じて離脱しやすい",
};

function staleYearFromEvidence(evidence) {
  const m = String(evidence).match(/HTML内(\d{4})止/);
  return m ? m[1] : "";
}

export function hpImproveObservationLines(evidence = "") {
  const parts = String(evidence || "")
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = [];

  for (const p of parts) {
    if (lines.length >= 3) break;
    if (p === "tel:なし" && !lines.some((l) => l.includes("tel:"))) {
      lines.push(OBSERVATION_BY_TOKEN["tel:なし"]());
      continue;
    }
    if (/更新停止/i.test(p)) {
      const y = staleYearFromEvidence(p);
      lines.push(
        y
          ? `フッターやサイト上の表記が${y}年付近のままで、サイト全体の更新感と印象がずれやすい`
          : "更新が止まっている印象が残り、いまも積極的に受注しているか判断しづらい"
      );
      continue;
    }
    const key = Object.keys(OBSERVATION_BY_TOKEN).find((k) => p.includes(k) || p === k);
    if (key && !lines.includes(OBSERVATION_BY_TOKEN[key]())) {
      lines.push(OBSERVATION_BY_TOKEN[key]());
    }
  }

  while (lines.length < 3) {
    const fallbacks = [
      "会社概要・実績・問い合わせの優先順位が分かりにくく、短時間の閲覧では強みまで辿り着きにくい",
      "スマホで「電話したい」「会社概要を見たい」と思ったとき、次の行動が一手間増えやすい",
    ];
    const next = fallbacks[lines.length - 1] || fallbacks[0];
    if (!lines.includes(next)) lines.push(next);
    else break;
  }

  return lines.slice(0, 3).map((t, i) => `${["①", "②", "③"][i]} ${t}`);
}

export function hpImproveStrengthLine(evidence = "") {
  const e = String(evidence || "");
  if (/ISO|9001/i.test(e)) {
    return "ISO9001の取得や公共施設・集合住宅など、総合建設としての実績は十分に伝わる内容";
  }
  if (/資本金|創業|一級|許可|公共/i.test(e)) {
    return "法人としての沿革・許可・事業内容は伝わる";
  }
  return "事業内容や地域での施工実績は伝わる";
}

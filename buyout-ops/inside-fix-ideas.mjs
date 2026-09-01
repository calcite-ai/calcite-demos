/**
 * inside 初回メール用 — 観察（evidence）に対応する「具体策」「進め方」「信頼の一言」。
 * 事実ベースの evidence から選ぶ。推測で足さない。
 */

function staleRecruitYear(evidence) {
  const m = String(evidence || "").match(/採用ページ更新古い\((\d{4})\)/);
  return m ? m[1] : "";
}

function evidenceParts(evidence) {
  return String(evidence || "")
    .split(/;\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickUnique(lines, max) {
  const out = [];
  for (const line of lines) {
    if (!line || out.includes(line)) continue;
    out.push(line);
    if (out.length >= max) break;
  }
  return out;
}

const RECRUIT_FIX = {
  "採用ページ更新古い": (y) =>
    `採用ページの冒頭に「現在募集中の職種」と最終更新日（${y ? y + "年以降に更新" : "直近の更新"}）を置き、いま採用しているかが3秒で分かるようにする`,
  採用URL: () =>
    "各職種から、電話または応募フォームへ1タップで飛べるカード型の一覧に整理する（施工実績ページはそのまま活かす）",
  採用キーワード: () =>
    "働くイメージが伝わる写真・1日の流れ・募集要項の要点を、スマホで読める長さにまとめ直す",
  "採用リンクあり": () =>
    "メニューの採用ページの中身を、応募者が迷わない構成（職種一覧→詳細→応募）に組み替える",
};

const AIOPS_FIX = {
  FAX表記: () =>
    "Webフォームの送信内容を、社内で共有しやすい形（住所・工事種別・希望時期など項目をそろえる）に整理する",
  PDF資料: () =>
    "よくある問い合わせへの回答を、PDF差し替えではなくページ上で更新しやすい短文に分ける",
  "問合せ・見積導線": () =>
    "問い合わせ受付後の確認・返信に使える返信たたき台（初回返信・見積依頼・エリア外のお断り）を用意する",
  "見積・対応エリア訴求": () =>
    "対応エリアと無料見積の案内を、フォーム入力時点で自己判断できるよう項目化し、電話確認の手間を減らす",
  "HP整備済": () =>
    "問い合わせ内容の受付メモの型（いつ・誰が・何を返したか）をつくり、担当者が変わっても引き継げるようにする",
  "HP導線おおむね整備": () =>
    "メール・電話・FAXで入ってきた内容を、同じフォーマットで社内共有できるよう整理する",
};

const HPIMPROVE_FIX = {
  "tel:なし": () =>
    "スマホからワンタップで発信できる電話番号リンクを、トップと会社概要の両方に置く",
  ワンページ構成: () =>
    "実績・会社概要・問い合わせを、目的別に短いページに分け、初見の発注者が探さずに判断できるようにする",
  httpsサイト内http混在: () =>
    "お問い合わせ先や資料リンクをhttpsに統一し、環境による警告や違和感をなくす",
  テンプレート残骸: () =>
    "テンプレート由来の表記や未使用ブロックを整理し、自社の許可番号・実績・体制が前面に出る構成にする",
  英語メニュー: () =>
    "メニューと見出しを日本語にそろえ、公共工事の発注者が迷わず会社概要・実績にたどり着けるようにする",
  viewportなし: () =>
    "スマホ幅で文字サイズと余白を調整し、現場からサイトを開いても読みやすい表示にする",
  SSL未整備: () =>
    "httpsを整備し、初めて訪れた発注者が安心して問い合わせできる状態にする",
};

function matchFix(map, part, evidence) {
  for (const [key, fn] of Object.entries(map)) {
    if (!part.includes(key)) continue;
    if (key === "採用ページ更新古い") return fn(staleRecruitYear(evidence));
    if (/更新停止/i.test(part)) {
      const y = part.match(/HTML内(\d{4})止/)?.[1];
      return y
        ? `フッターや表記の年号をいまの活動と揃え、${y}年止まりの印象を解消する`
        : "更新が止まっている印象をなくすため、許可番号・実績・会社概要の見せ方をいまの体制に合わせて整理する";
    }
    return fn();
  }
  return "";
}

/** @returns {string[]} ・なしの本文行（最大3） */
export function fixIdeaLines(campaign, evidence) {
  const parts = evidenceParts(evidence);
  const map =
    campaign === "recruit" ? RECRUIT_FIX : campaign === "ai_ops" ? AIOPS_FIX : HPIMPROVE_FIX;
  const candidates = parts.map((p) => matchFix(map, p, evidence)).filter(Boolean);

  const fallbacks = {
    recruit: [
      "施工実績ページはそのままに、採用ページだけ「募集中かどうか」が一目で分かる構成に整える",
      "応募フォームまでの導線を短くし、スマホからでも応募しやすい形にする",
    ],
    ai_ops: [
      "問い合わせ受付後の確認・返信に使える型（たたき台・共有フォーマット）をつくる",
      "電話・FAX・Webの内容を、社内で同じ形にそろえて引き継ぎやすくする",
    ],
    hp_improve: [
      "発注者がスマホで短時間見たときに、許可・実績・連絡先が一続きで伝わる会社概要に整理する",
      "いまのサイトの強みは残し、信頼に関わる導線と表記だけを優先的に直す",
    ],
  };

  return pickUnique([...candidates, ...fallbacks[campaign]], 3);
}

/** @returns {string[]} 進め方（3行） */
export function approachSteps(campaign) {
  const scope =
    campaign === "recruit"
      ? "採用ページ"
      : campaign === "ai_ops"
        ? "問い合わせ受付まわり"
        : "会社概要・連絡導線";
  return [
    `① 15分ほどお電話またはメールで、いま困っていることと優先度をお伺いします（${scope}中心）`,
    `② お伺いした内容をもとに、御社向けの改善イメージ（構成案・文面の方向性）を1つお送りします`,
    "③ ご納得いただけた範囲だけ着手します。全体の作り直しは別のご相談です",
  ];
}

/** 頼みたいと思わせる一言（キャンペーン共通ベース） */
export function trustParagraph(campaign) {
  const focus =
    campaign === "recruit"
      ? "採用ページだけ"
      : campaign === "ai_ops"
        ? "問い合わせ以降の業務"
        : "発注者目線の見せ方";
  return (
    `工務店・建設会社様のサイトを事前に拝見したうえでご連絡しており、\n` +
    `いきなり全ページの作り直しを勧めることはありません。\n` +
    `まずは${focus}について状況をお聞きし、必要な範囲だけ具体的にお伝えします。`
  );
}

/** テンプレ用: ・付き箇条書きブロック */
export function formatBulletBlock(lines) {
  return lines.map((l) => `・${l}`).join("\n");
}

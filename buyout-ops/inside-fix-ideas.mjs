/**
 * inside 初回メール用 — 観察（evidence）に対応する「提案＋効果」。
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

function pickUnique(items, max, keyFn) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item) continue;
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** @typedef {{ proposal: string, effect: string }} FixIdea */

const RECRUIT_FIX = {
  "採用ページ更新古い": (_y) => ({
    proposal: "採用ページ冒頭に「現在募集中の職種」と最終更新日を置く",
    effect: "応募検討中の方が「いま動いている採用か」をすぐ判断でき、途中離脱を減らしやすくなります",
  }),
  採用URL: () => ({
    proposal: "各職種から電話または応募フォームへ1タップで飛べる一覧にする",
    effect: "興味を持った瞬間に応募・問い合わせへ進みやすくなります",
  }),
  採用キーワード: () => ({
    proposal: "働くイメージ（写真・1日の流れ・募集要項の要点）を、スマホで読める長さにまとめる",
    effect: "施工実績ページはそのまま活かしつつ、応募判断に必要な情報だけを補えます",
  }),
  "採用リンクあり": () => ({
    proposal: "メニューの採用ページを、職種一覧→詳細→応募の流れで迷いにくい構成に組み替える",
    effect: "応募検討中の方が次に何をすればよいか分かりやすくなります",
  }),
};

const AIOPS_FIX = {
  FAX表記: () => ({
    proposal: "Webフォームの送信内容を、社内で共有しやすい項目（住所・工事種別・希望時期など）にそろえる",
    effect: "電話・FAXとWebの問い合わせを同じ型で扱え、確認の手間を減らしやすくなります",
  }),
  PDF資料: () => ({
    proposal: "よくある問い合わせへの回答を、PDF差し替えではなくページ上で更新しやすい短文に分ける",
    effect: "内容変更のたびに資料を作り直す負担を減らせます",
  }),
  "問合せ・見積導線": () => ({
    proposal: "受付後の初回返信・見積依頼・エリア外お断りなど、返信たたき台を用意する",
    effect: "問い合わせごとの文面作成を短くし、返信漏れを防ぎやすくなります",
  }),
  "見積・対応エリア訴求": () => ({
    proposal: "対応エリアと無料見積の案内を、フォーム入力時点で自己判断できるよう項目化する",
    effect: "電話でのエリア確認の往復を減らしやすくなります",
  }),
  "HP整備済": () => ({
    proposal: "問い合わせ内容の受付メモの型（いつ・誰が・何を返したか）をつくる",
    effect: "担当者が変わっても引き継ぎやすくなります",
  }),
  "HP導線おおむね整備": () => ({
    proposal: "メール・電話・FAXで入ってきた内容を、同じフォーマットで社内共有できるよう整理する",
    effect: "チャネルが分かれても、対応状況を追いやすくなります",
  }),
};

const HPIMPROVE_FIX = {
  "tel:なし": () => ({
    proposal: "スマホからワンタップで発信できる電話番号リンクを、トップと会社概要の両方に置く",
    effect: "外出先からでもすぐ連絡でき、問い合わせの取りこぼしを減らしやすくなります",
  }),
  ワンページ構成: () => ({
    proposal: "実績・会社概要・問い合わせを、目的別に短いページに分ける",
    effect: "初見の発注者が探さずに判断しやすくなります",
  }),
  httpsサイト内http混在: () => ({
    proposal: "お問い合わせ先や資料リンクをhttpsに統一する",
    effect: "環境による警告や違和感をなくし、安心して連絡してもらいやすくなります",
  }),
  テンプレート残骸: () => ({
    proposal: "テンプレート由来の表記や未使用ブロックを整理し、許可番号・実績・体制が前面に出る構成にする",
    effect: "自社サイトとしての信頼感が伝わりやすくなります",
  }),
  英語メニュー: () => ({
    proposal: "メニューと見出しを日本語にそろえ、会社概要・実績へ迷わずたどり着けるようにする",
    effect: "公共工事の発注者など、初見の方が目的の情報に早く到達できます",
  }),
  viewportなし: () => ({
    proposal: "スマホ幅で文字サイズと余白を調整し、現場から開いても読みやすい表示にする",
    effect: "短時間の閲覧でも内容が伝わりやすくなります",
  }),
  SSL未整備: () => ({
    proposal: "httpsを整備し、初めて訪れた発注者が安心して問い合わせできる状態にする",
    effect: "ブラウザ警告による離脱を減らしやすくなります",
  }),
};

function matchFix(map, part, evidence) {
  for (const [key, fn] of Object.entries(map)) {
    if (!part.includes(key)) continue;
    if (key === "採用ページ更新古い") return fn(staleRecruitYear(evidence));
    if (/更新停止/i.test(part)) {
      const y = part.match(/HTML内(\d{4})止/)?.[1];
      return y
        ? {
            proposal: `フッターや表記の年号をいまの活動と揃え、${y}年止まりの印象を解消する`,
            effect: "いまも稼働している会社だと伝わりやすくなります",
          }
        : {
            proposal: "許可番号・実績・会社概要の見せ方を、いまの体制に合わせて整理する",
            effect: "更新が止まっている印象を和らげ、問い合わせしやすくなります",
          };
    }
    return fn();
  }
  return null;
}

/** @returns {FixIdea[]} */
export function fixIdeaLines(campaign, evidence) {
  const parts = evidenceParts(evidence);
  const map =
    campaign === "recruit" ? RECRUIT_FIX : campaign === "ai_ops" ? AIOPS_FIX : HPIMPROVE_FIX;
  const candidates = parts.map((p) => matchFix(map, p, evidence)).filter(Boolean);

  /** @type {FixIdea[]} */
  const fallbacks = {
    recruit: [
      {
        proposal: "施工実績ページはそのままに、採用ページだけ「募集中かどうか」が一目で分かる構成にする",
        effect: "応募検討中の方が迷わず次の行動に進みやすくなります",
      },
      {
        proposal: "応募フォームまでの導線を短くし、スマホからでも応募しやすい形にする",
        effect: "興味を持った瞬間の取りこぼしを減らしやすくなります",
      },
    ],
    ai_ops: [
      {
        proposal: "問い合わせ受付後の確認・返信に使える型（たたき台・共有フォーマット）をつくる",
        effect: "毎回の文面作成と引き継ぎの負担を減らせます",
      },
      {
        proposal: "電話・FAX・Webの内容を、社内で同じ形にそろえる",
        effect: "対応漏れや確認の往復を減らしやすくなります",
      },
    ],
    hp_improve: [
      {
        proposal: "発注者がスマホで短時間見たときに、許可・実績・連絡先が一続きで伝わる会社概要に整理する",
        effect: "比較検討の初期段階で「もう少し詳しく見よう」と思ってもらいやすくなります",
      },
      {
        proposal: "いまのサイトの強みは残し、信頼に関わる導線と表記だけを優先的に直す",
        effect: "全面作り直しなしで、伝わり方だけ整えられます",
      },
    ],
  };

  return pickUnique([...candidates, ...fallbacks[campaign]], 3, (x) => x.proposal);
}

/** @deprecated テンプレから外した。後方互換のため残す */
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

/** @deprecated テンプレから外した。後方互換のため残す */
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

/** テンプレ用: 提案＋効果の箇条書き */
export function formatBulletBlock(ideas) {
  return ideas
    .map((idea) => {
      if (typeof idea === "string") return `・${idea}`;
      return `・${idea.proposal}\n　→ ${idea.effect}`;
    })
    .join("\n");
}

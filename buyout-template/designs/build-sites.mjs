#!/usr/bin/env node
/**
 * Builds 5-page HTML for each inventory skin (A–D).
 * Run: node designs/build-sites.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const COMPANY = {
  name: "アオイ工房",
  tag: "地域の家づくりを、まっすぐ。",
  tel: "03-0000-0000",
  telHref: "tel:0300000000",
  email: "info@example.com",
  address: "〒100-0001 東京都千代田区サンプル1-2-3",
  hours: "平日 9:00–18:00",
  holiday: "土日祝",
};

/** 工務店向けデモの中身（見た目は骨格、刺さる文言はここ） */
const COPY = {
  metaDesc: "新築・リフォーム・増改築。地域の家づくりを、相談から引き渡し後まで。",
  heroSupport: "新築も、リフォームも、増改築も。<br />地域の工務店として、最後まで伴走します。",
  lead:
    "住まいの相談から現場、引き渡し後の小さな修繕まで。地域で長く仕事をしてきた工務店として、無理のない計画と丁寧な施工を大切にしています。",
  leadLong:
    "大手ハウスメーカーのように全国一律の仕様ではなく、土地の条件・家族の暮らし・予算のバランスを見ながら、その家に合う進め方を一緒に考えます。小さな修繕のご相談も歓迎です。まずは現地の状況を伺い、無理のない計画からご提案します。",
  scope: "新築・リフォーム・増改築を中心に、住まいと店舗の工事に対応します。",
  aboutTitle: "この町で、家づくりを続けています",
  aboutExtra:
    "工事は「建てて終わり」ではありません。住み始めてからの不具合、季節ごとのメンテナンス、将来の増改築まで、近所の工務店として長くお付き合いできる関係を大切にしています。初めての方も、これまでの工事で他社とやり取りしたことがある方も、現状を伺ったうえで最適な進め方をご案内します。",
  aboutPoints: [
    {
      title: "地域密着の自社施工",
      body: "遠方の大手ではなく、近くの職人と現場で進めます。相談から完工まで顔が見える体制です。",
    },
    {
      title: "見積りと工程がわかりやすい",
      body: "何にいくらかかるのか、いつ何をするのかを先に共有します。納得してから着工します。",
    },
    {
      title: "住み始めてからも相談できる",
      body: "引き渡しがゴールではありません。不具合や追加の相談にも、近所の工務店として応じます。",
    },
  ],
  services: [
    {
      title: "新築・注文住宅",
      body: "土地探しのご相談から設計・施工まで。家族の暮らしに合わせた家づくりを進めます。",
      detail:
        "間取りの打ち合わせ、構造・断熱の方針、建材の選定まで、現場を知っている工務店として実務ベースでご提案します。予算の上限を共有いただければ、優先順位をつけて現実的なプランに落とします。",
      bullets: ["土地探し・敷地条件の整理", "間取り・仕様のご提案", "施工管理から引き渡しまで"],
      img: "gallery-1.jpg",
      alt: "住宅・建築のイメージ",
    },
    {
      title: "リフォーム・リノベーション",
      body: "水まわり・内装・間取り変更まで。いまの家を、これからの暮らしに合わせて整えます。",
      detail:
        "キッチン・浴室などの部分改修から、スケルトンに近い大規模改修まで対応します。暮らしながらの工事か、仮住まいが必要かなど、生活への影響も事前にお伝えします。",
      bullets: ["水まわり・内装の部分改修", "間取り変更・耐震補強のご相談", "店舗・事務所の内装改修"],
      img: "hero-shop.jpg",
      alt: "住まいの改修イメージ",
    },
    {
      title: "増改築・修繕",
      body: "増築、外壁・屋根、雨漏りや小さな修繕まで。現場を見たうえで最適な進め方をご提案します。",
      detail:
        "雨漏り・外壁の傷み・屋根の劣化など、放置すると大きくなる不具合は早めの現地確認が安心です。増築やサンルーム、収納の追加など、暮らしの変化に合わせた改修もご相談ください。",
      bullets: ["増築・減築のご相談", "外壁・屋根・雨漏り対応", "建具・水栓など小さな修繕"],
      img: "gallery-2.jpg",
      alt: "現場・施工のイメージ",
    },
  ],
  flow: [
    { title: "ご相談", body: "ご要望・予算・期限を伺います。お電話でもメールでも構いません。" },
    { title: "現地確認", body: "必要に応じて現地を拝見し、制約や工事範囲を整理します。" },
    { title: "お見積り", body: "工事内容と費用の目安、おおまかな工程をお伝えします。" },
    { title: "ご契約・着工", body: "内容に納得いただいたうえで契約し、工程に沿って施工します。" },
    { title: "引き渡し・アフター", body: "完工確認のうえお引き渡し。その後の相談にも対応します。" },
  ],
  faqs: [
    {
      q: "小さな修繕でも頼めますか？",
      a: "はい。水栓の交換や建具の調整など、小さな工事も受け付けています。内容によっては出張費のみのご案内になる場合もありますので、まずはお気軽にご相談ください。",
    },
    {
      q: "見積りだけでも大丈夫ですか？",
      a: "大丈夫です。現地確認が必要な場合はその旨をお伝えしたうえで、費用の目安をご案内します。無理な営業はしません。",
    },
    {
      q: "新築とリフォーム、どちらも対応していますか？",
      a: "はい。新築・注文住宅、リフォーム・リノベーション、増改築・修繕まで幅広く対応しています。規模やご予算に合わせて進め方をご提案します。",
    },
    {
      q: "工事中の生活はどうなりますか？",
      a: "部分改修は住みながらの工事が多いです。大規模な場合は仮住まいの要否も含めて、事前に工程と生活への影響をお伝えします。",
    },
  ],
  areaTitle: "対応エリア",
  areaBody:
    "事務所のある市区町村を中心に、近隣エリアへ伺います。遠方のご相談も内容によっては対応できる場合がありますので、まずは所在地とご要望をお知らせください。買い取り後は御社の実エリア表記に差し替えます。",
  businessLine: "新築・リフォーム・増改築、および住宅・店舗の修繕",
  galleryNote: "写真はイメージです。買い取り後は御社の施工写真へ差し替えできます。",
  ctaTitle: "家の相談から、まずはお電話を",
  ctaLead: "新築・リフォーム・修繕のご相談を受け付けています。お急ぎの方はお電話がスムーズです。",
  contactHero: "新築・リフォームのご相談",
  contactLead:
    "工事の種類・ご希望の時期・ご予算の目安がわかると、スムーズにご案内できます。わからない点があっても構いません。現状を伺いながら整理します。",
  contactPrep: [
    "ご相談内容（新築／リフォーム／修繕など）",
    "物件の所在地（市区町村まででも可）",
    "ご希望の時期・おおよその予算感",
    "連絡のつきやすい時間帯",
  ],
  contactReply: "営業時間内のご連絡には、原則翌営業日までに返信します。お急ぎの方はお電話ください。",
  servicesHero: "家づくりとリフォームのメニュー",
  servicesLead:
    "新築から小さな修繕まで、住まいと店舗の工事に対応します。メニューにない内容も、現場を見たうえで可否と進め方をお伝えします。",
  aboutHero: "地域の工務店として",
};

const IMG = "../shared/images"; // from skin root pages use shared; subpages need ../../shared

const skins = [
  {
    id: "a-sumi",
    label: "A Sumi Editorial",
    font: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap",
  },
  {
    id: "b-atelier",
    label: "B Cool Atelier",
    font: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+JP:wght@300;400;500;600&display=swap",
  },
  {
    id: "c-daylight",
    label: "C Neighborhood Daylight",
    font: "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap",
  },
  {
    id: "d-signboard",
    label: "D Bold Signboard",
    font: "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&display=swap",
  },
];

function img(base, file) {
  return `${base}/${file}`;
}

function shell({ skin, title, desc, depth, current, body }) {
  const prefix = depth === 0 ? "" : "../";
  const shared = depth === 0 ? "../shared/images" : "../../shared/images";
  const css = `${prefix}styles.css`;
  const js = `${prefix}site.js`;
  const home = `${prefix}index.html`;
  const services = `${prefix}services/index.html`;
  const about = `${prefix}about/index.html`;
  const contact = `${prefix}contact/index.html`;
  const privacy = `${prefix}privacy/index.html`;

  const nav = (page) => {
    const items = [
      ["ホーム", home, "home"],
      ["サービス", services, "services"],
      ["会社概要", about, "about"],
      ["お問い合わせ", contact, "contact"],
    ];
    return items
      .map(([label, href, key]) => {
        const cur = key === page ? ' aria-current="page"' : "";
        const cta = key === "contact" ? ' class="nav__cta"' : "";
        return `<a href="${href}"${cta}${cur}>${label}</a>`;
      })
      .join("\n        ");
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
  <meta name="description" content="${desc}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${skin.font}" rel="stylesheet" />
  <link rel="stylesheet" href="${css}" />
</head>
<body data-skin="${skin.id}">
  <p class="picker"><a href="${prefix}../">← 在庫一覧</a> · ${skin.label}</p>
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="${home}">
        <span class="brand__name">${COMPANY.name}</span>
        <span class="brand__tag">${COMPANY.tag}</span>
      </a>
      <nav class="nav" aria-label="メインメニュー">
        ${nav(current)}
      </nav>
      <button class="menu-btn" type="button" aria-label="メニュー" data-menu-toggle>
        <span></span><span></span><span></span>
      </button>
    </div>
    <div class="wrap mobile-nav" data-mobile-nav>
      <a href="${home}">ホーム</a>
      <a href="${services}">サービス</a>
      <a href="${about}">会社概要</a>
      <a href="${contact}">お問い合わせ</a>
      <a href="${privacy}">プライバシーポリシー</a>
    </div>
  </header>
${body.replaceAll("__SHARED__", shared)}
  <footer class="site-footer">
    <div class="wrap site-footer__grid">
      <div>
        <strong>${COMPANY.name}</strong>
        <p>${COMPANY.address}<br />TEL: ${COMPANY.tel}</p>
      </div>
      <div>
        <p>営業時間: ${COMPANY.hours}<br />定休日: ${COMPANY.holiday}</p>
      </div>
      <div>
        <p><a href="${privacy}">プライバシーポリシー</a><br /><a href="mailto:${COMPANY.email}">${COMPANY.email}</a></p>
      </div>
    </div>
  </footer>
  <nav class="bottom-bar" aria-label="スマートフォン用連絡">
    <a href="${COMPANY.telHref}">電話する</a>
    <a href="mailto:${COMPANY.email}">メール</a>
  </nav>
  <script src="${js}"></script>
</body>
</html>
`;
}


function flowListHtml() {
  return COPY.flow
    .map(
      (step, i) =>
        `<li><em>${String(i + 1).padStart(2, "0")}</em><div><h3>${step.title}</h3><p>${step.body}</p></div></li>`
    )
    .join("\n");
}

function faqListHtml() {
  return COPY.faqs
    .map(
      (item) =>
        `<details class="faq-item"><summary>${item.q}</summary><p>${item.a}</p></details>`
    )
    .join("\n");
}

function prepListHtml() {
  return COPY.contactPrep.map((item) => `<li>${item}</li>`).join("\n");
}

function serviceBulletsHtml(svc) {
  return `<ul class="svc-bullets">${svc.bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`;
}

function volumeHomeExtras(skinId) {
  if (skinId === "a-sumi") {
    return `
  <section class="block" id="flow">
    <p class="num">04</p>
    <h2>ご依頼の流れ</h2>
    <p class="prose">相談から引き渡しまで、おおまかな流れです。規模によって期間は変わります。</p>
    <ol class="stack flow-list">${flowListHtml()}</ol>
  </section>

  <section class="block" id="faq">
    <p class="num">05</p>
    <h2>よくあるご質問</h2>
    <div class="faq-list">${faqListHtml()}</div>
  </section>

  <section class="block" id="area">
    <p class="num">06</p>
    <h2>${COPY.areaTitle}</h2>
    <p class="prose">${COPY.areaBody}</p>
  </section>
`;
  }

  if (skinId === "b-atelier") {
    return `
  <section class="narrow" id="flow">
    <div class="rule"></div>
    <p class="section-kicker">Flow</p>
    <h2>ご依頼の流れ</h2>
    <p class="body">相談から引き渡しまで、おおまかな流れです。規模によって期間は変わります。</p>
    <ol class="points flow-list">${flowListHtml()}</ol>
  </section>

  <section class="narrow" id="faq">
    <div class="rule"></div>
    <p class="section-kicker">FAQ</p>
    <h2>よくあるご質問</h2>
    <div class="faq-list">${faqListHtml()}</div>
  </section>

  <section class="narrow" id="area">
    <div class="rule"></div>
    <p class="section-kicker">Area</p>
    <h2>${COPY.areaTitle}</h2>
    <p class="body">${COPY.areaBody}</p>
  </section>
`;
  }

  if (skinId === "c-daylight") {
    return `
  <section class="intro" id="flow">
    <h2>ご依頼の流れ</h2>
    <p>相談から引き渡しまで、おおまかな流れです。</p>
    <ol class="flow-list flow-list--plain">${flowListHtml()}</ol>
  </section>

  <section class="intro" id="faq">
    <h2>よくあるご質問</h2>
    <div class="faq-list">${faqListHtml()}</div>
  </section>

  <section class="intro" id="area">
    <h2>${COPY.areaTitle}</h2>
    <p>${COPY.areaBody}</p>
  </section>
`;
  }

  // d-signboard
  return `
  <hr class="thick" />

  <section class="chunk" id="flow">
    <h2>ご依頼の流れ</h2>
    <p class="lead">相談から引き渡しまで、おおまかな流れです。規模によって期間は変わります。</p>
    <ol class="dense flow-list">${flowListHtml()}</ol>
  </section>

  <hr class="thick" />

  <section class="chunk" id="faq">
    <h2>よくあるご質問</h2>
    <div class="faq-list">${faqListHtml()}</div>
  </section>

  <hr class="thick" />

  <section class="chunk" id="area">
    <h2>${COPY.areaTitle}</h2>
    <p class="lead">${COPY.areaBody}</p>
  </section>
`;
}

function homeBody(skinId) {
  const heroes = {
    "a-sumi": "hero-dark.jpg",
    "b-atelier": "hero-atelier.jpg",
    "c-daylight": "hero-dark.jpg",
    "d-signboard": "gallery-1.jpg",
  };
  const hero = heroes[skinId];
  const [p1, p2, p3] = COPY.aboutPoints;
  const [s1, s2, s3] = COPY.services;

  if (skinId === "a-sumi") {
    return `
  <section class="hero hero--photo">
    <img class="hero__img" src="__SHARED__/${hero}" alt="建築・現場のイメージ写真" width="1600" height="900" />
    <div class="hero__veil"></div>
    <div class="wrap hero__copy">
      <p class="hero__meta">地域密着の工務店</p>
      <h1>${COMPANY.name}</h1>
      <p class="hero__line">${COPY.heroSupport}</p>
      <div class="hero__actions">
        <a class="btn btn--primary" href="${COMPANY.telHref}">電話で相談する</a>
        <a class="btn btn--ghost" href="contact/index.html">お問い合わせ</a>
      </div>
    </div>
  </section>

  <section class="block" id="about">
    <p class="num">01</p>
    <h2>この町で、<br />家づくりを続けています</h2>
    <p class="prose">${COPY.lead}</p>
    <p class="prose">${COPY.leadLong}</p>
    <div class="photo-pair">
      <figure><img src="__SHARED__/work-tools.jpg" alt="道具・作業のイメージ" width="1200" height="712" loading="lazy" /><figcaption>現場の道具</figcaption></figure>
      <figure><img src="__SHARED__/work-hands.jpg" alt="手仕事のイメージ" width="1200" height="800" loading="lazy" /><figcaption>手仕事の仕上がり</figcaption></figure>
    </div>
    <ul class="manifesto">
      <li><strong>${p1.title}</strong><span>${p1.body}</span></li>
      <li><strong>${p2.title}</strong><span>${p2.body}</span></li>
      <li><strong>${p3.title}</strong><span>${p3.body}</span></li>
    </ul>
  </section>

  <section class="block block--invert" id="services">
    <p class="num">02</p>
    <h2>主な工事メニュー</h2>
    <ol class="stack">
      <li><em>01</em><div><h3>${s1.title}</h3><p>${s1.body}</p></div></li>
      <li><em>02</em><div><h3>${s2.title}</h3><p>${s2.body}</p></div></li>
      <li><em>03</em><div><h3>${s3.title}</h3><p>${s3.body}</p></div></li>
    </ol>
    <p class="more"><a class="btn btn--ghost" href="services/index.html">サービス一覧へ</a></p>
  </section>

  <section class="block">
    <p class="num">03</p>
    <h2>施工のイメージ</h2>
    <p class="prose">${COPY.galleryNote}</p>
    <div class="gallery">
      <img src="__SHARED__/gallery-1.jpg" alt="建築イメージ" width="1000" height="667" loading="lazy" />
      <img src="__SHARED__/gallery-2.jpg" alt="現場イメージ" width="1000" height="662" loading="lazy" />
      <img src="__SHARED__/work-tools.jpg" alt="道具イメージ" width="1200" height="712" loading="lazy" />
    </div>
  </section>

${volumeHomeExtras("a-sumi")}
  <section class="strip" id="contact">
    <h2>${COPY.ctaTitle}</h2>
    <p>${COPY.ctaLead}</p>
    <div class="strip__actions">
      <a class="btn btn--primary" href="${COMPANY.telHref}">${COMPANY.tel}</a>
      <a class="btn btn--ghost" href="contact/index.html">お問い合わせ</a>
    </div>
  </section>
`;
  }

  if (skinId === "b-atelier") {
    return `
  <section class="split-hero">
    <div class="split-hero__text">
      <p class="eyebrow">地域密着の工務店</p>
      <h1>地域の家づくりを、<br />まっすぐ。</h1>
      <p class="lede">${COPY.scope}</p>
      <div class="actions">
        <a class="btn btn--primary" href="${COMPANY.telHref}">電話で相談</a>
        <a class="link" href="contact/index.html">お問い合わせ →</a>
      </div>
    </div>
    <div class="split-hero__media">
      <img src="__SHARED__/${hero}" alt="住まい・建築のイメージ" width="1000" height="667" />
    </div>
  </section>

  <section class="narrow" id="about">
    <div class="rule"></div>
    <p class="section-kicker">About</p>
    <h2>${COPY.aboutTitle}</h2>
    <p class="body">${COPY.lead}</p>
    <p class="body">${COPY.leadLong}</p>
    <ol class="points">
      <li><span>01</span><div><strong>${p1.title}</strong><p>${p1.body}</p></div></li>
      <li><span>02</span><div><strong>${p2.title}</strong><p>${p2.body}</p></div></li>
      <li><span>03</span><div><strong>${p3.title}</strong><p>${p3.body}</p></div></li>
    </ol>
  </section>

  <section class="narrow" id="services">
    <div class="rule"></div>
    <p class="section-kicker">Works</p>
    <h2>主な工事メニュー</h2>
    <div class="service-rows">
      <article><h3>${s1.title}</h3><p>${s1.body}</p></article>
      <article><h3>${s2.title}</h3><p>${s2.body}</p></article>
      <article><h3>${s3.title}</h3><p>${s3.body}</p></article>
    </div>
    <p class="more"><a class="btn btn--primary" href="services/index.html">サービス詳細</a></p>
  </section>

  <section class="narrow">
    <div class="rule"></div>
    <p class="section-kicker">Gallery</p>
    <h2>施工のイメージ</h2>
    <p class="body">${COPY.galleryNote}</p>
    <div class="gallery gallery--3">
      <img src="__SHARED__/gallery-1.jpg" alt="建築イメージ" width="1000" height="667" loading="lazy" />
      <img src="__SHARED__/gallery-2.jpg" alt="現場イメージ" width="1000" height="662" loading="lazy" />
      <img src="__SHARED__/work-hands.jpg" alt="手仕事のイメージ" width="1200" height="800" loading="lazy" />
    </div>
  </section>

${volumeHomeExtras("b-atelier")}
  <section class="contact-band" id="contact">
    <div class="contact-band__inner">
      <h2>${COPY.ctaTitle}</h2>
      <p>${COPY.ctaLead}</p>
      <a class="btn btn--primary" href="${COMPANY.telHref}">${COMPANY.tel}</a>
    </div>
  </section>
`;
  }

  if (skinId === "c-daylight") {
    return `
  <section class="photo-hero">
    <img class="photo-hero__img" src="__SHARED__/${hero}" alt="住まい・建築のイメージ写真" width="1600" height="1068" />
    <div class="photo-hero__content">
      <h1>${COMPANY.name}</h1>
      <p>${COPY.heroSupport}</p>
      <a class="btn btn--primary" href="${COMPANY.telHref}">電話で相談する</a>
    </div>
  </section>

  <section class="intro" id="about">
    <h2>この町で、<br />家づくりを続けています</h2>
    <p>${COPY.lead}</p>
    <p>${COPY.leadLong}</p>
  </section>

  <section class="mag" id="services">
    <article class="mag__row">
      <img class="mag__pic" src="__SHARED__/${s1.img}" alt="${s1.alt}" width="1000" height="667" loading="lazy" />
      <div class="mag__text">
        <h3>${s1.title}</h3>
        <p>${s1.body}</p>
      </div>
    </article>
    <article class="mag__row mag__row--flip">
      <img class="mag__pic" src="__SHARED__/${s2.img}" alt="${s2.alt}" width="1600" height="1067" loading="lazy" />
      <div class="mag__text">
        <h3>${s2.title}</h3>
        <p>${s2.body}</p>
      </div>
    </article>
    <article class="mag__row">
      <img class="mag__pic" src="__SHARED__/${s3.img}" alt="${s3.alt}" width="1000" height="662" loading="lazy" />
      <div class="mag__text">
        <h3>${s3.title}</h3>
        <p>${s3.body}</p>
      </div>
    </article>
  </section>

${volumeHomeExtras("c-daylight")}
  <section class="soft-cta" id="contact">
    <h2>${COPY.ctaTitle}</h2>
    <p>${COPY.ctaLead}</p>
    <div class="soft-cta__row">
      <a class="btn btn--primary" href="${COMPANY.telHref}">${COMPANY.tel}</a>
      <a class="btn btn--ghost" href="contact/index.html">お問い合わせ</a>
    </div>
  </section>
`;
  }

  // d-signboard（在庫スキン・営業デフォルトは B+C）
  return `
  <section class="board">
    <p class="board__place">地域密着</p>
    <h1>アオイ<br />工房</h1>
    <div class="board__rule"></div>
    <p class="board__tag">${COMPANY.tag}</p>
    <div class="board__actions">
      <a class="btn btn--primary" href="${COMPANY.telHref}">電話で相談する</a>
      <a class="btn btn--outline" href="contact/index.html">お問い合わせ</a>
    </div>
  </section>

  <section class="board-photo">
    <img src="__SHARED__/${hero}" alt="住まい・建築のイメージ" width="1000" height="667" />
  </section>

  <section class="chunk" id="about">
    <h2>この町で、<br />家づくりを続けています</h2>
    <p class="lead">${COPY.lead}</p>
    <p class="lead">${COPY.leadLong}</p>
    <ul class="dense">
      <li><b>01</b><span><strong>${p1.title}</strong> — ${p1.body}</span></li>
      <li><b>02</b><span><strong>${p2.title}</strong> — ${p2.body}</span></li>
      <li><b>03</b><span><strong>${p3.title}</strong> — ${p3.body}</span></li>
    </ul>
  </section>

  <hr class="thick" />

  <section class="chunk" id="services">
    <h2>主な工事メニュー</h2>
    <div class="cols">
      <div><h3>${s1.title}</h3><p>${s1.body}</p></div>
      <div><h3>${s2.title}</h3><p>${s2.body}</p></div>
      <div><h3>${s3.title}</h3><p>${s3.body}</p></div>
    </div>
    <p class="more"><a class="btn btn--outline" href="services/index.html">サービス一覧</a></p>
  </section>

  <section class="chunk">
    <h2>施工のイメージ</h2>
    <p class="lead">${COPY.galleryNote}</p>
    <div class="gallery gallery--3">
      <img src="__SHARED__/work-tools.jpg" alt="道具イメージ" width="1200" height="712" loading="lazy" />
      <img src="__SHARED__/gallery-2.jpg" alt="現場イメージ" width="1000" height="662" loading="lazy" />
      <img src="__SHARED__/work-hands.jpg" alt="作業イメージ" width="1200" height="800" loading="lazy" />
    </div>
  </section>

${volumeHomeExtras("d-signboard")}
  <section class="block-cta" id="contact">
    <h2>${COPY.ctaTitle}</h2>
    <p>${COPY.ctaLead}</p>
    <a class="btn btn--accent" href="${COMPANY.telHref}">${COMPANY.tel}</a>
  </section>
`;
}

function pageHero(title, lead) {
  return `
  <section class="page-hero">
    <div class="wrap">
      <h1>${title}</h1>
      <p>${lead}</p>
    </div>
  </section>`;
}

function aboutBody() {
  const [p1, p2, p3] = COPY.aboutPoints;
  return `
${pageHero("会社概要", COPY.aboutHero)}
  <section class="block-page">
    <div class="wrap prose-page">
      <div class="about-photo">
        <img src="__SHARED__/work-desk.jpg" alt="住まい・建築のイメージ" width="1600" height="1067" loading="lazy" />
      </div>
      <p>${COPY.lead}</p>
      <p>${COPY.leadLong}</p>
      <p>${COPY.aboutExtra}</p>
      <h2 class="subhead">大切にしていること</h2>
      <ul class="dense about-points">
        <li><b>01</b><span><strong>${p1.title}</strong> — ${p1.body}</span></li>
        <li><b>02</b><span><strong>${p2.title}</strong> — ${p2.body}</span></li>
        <li><b>03</b><span><strong>${p3.title}</strong> — ${p3.body}</span></li>
      </ul>
      <h2 class="subhead">会社情報</h2>
      <dl class="spec">
        <div><dt>屋号</dt><dd>${COMPANY.name}</dd></div>
        <div><dt>所在地</dt><dd>${COMPANY.address}</dd></div>
        <div><dt>電話</dt><dd><a href="${COMPANY.telHref}">${COMPANY.tel}</a></dd></div>
        <div><dt>メール</dt><dd><a href="mailto:${COMPANY.email}">${COMPANY.email}</a></dd></div>
        <div><dt>営業時間</dt><dd>${COMPANY.hours}（定休日: ${COMPANY.holiday}）</dd></div>
        <div><dt>事業内容</dt><dd>${COPY.businessLine}</dd></div>
        <div><dt>対応エリア</dt><dd>事務所周辺および近隣エリア（詳細はお問い合わせください）</dd></div>
      </dl>
      <h2 class="subhead">${COPY.areaTitle}</h2>
      <p>${COPY.areaBody}</p>
      <p class="muted">写真・沿革・代表名・許可番号などは、買い取り後の素材提出で差し替えます。</p>
    </div>
  </section>`;
}

function servicesBody() {
  const [s1, s2, s3] = COPY.services;
  const card = (s) => `
        <article class="svc-card">
          <img src="__SHARED__/${s.img}" alt="${s.alt}" width="1000" height="667" loading="lazy" />
          <h2>${s.title}</h2>
          <p>${s.body}</p>
          <p>${s.detail}</p>
          ${serviceBulletsHtml(s)}
        </article>`;
  return `
${pageHero("サービス", COPY.servicesHero)}
  <section class="block-page">
    <div class="wrap">
      <p class="page-lead">${COPY.servicesLead}</p>
      <div class="svc-grid svc-grid--stack">
        ${card(s1)}
        ${card(s2)}
        ${card(s3)}
      </div>
      <h2 class="subhead">ご依頼の流れ</h2>
      <p class="page-lead">相談から引き渡しまで、おおまかな流れです。</p>
      <ol class="dense flow-list">${flowListHtml()}</ol>
      <h2 class="subhead">よくあるご質問</h2>
      <div class="faq-list">${faqListHtml()}</div>
      <div class="strip strip--page">
        <h2>${COPY.ctaTitle}</h2>
        <p>${COPY.ctaLead}</p>
        <a class="btn btn--primary" href="../contact/index.html">お問い合わせへ</a>
      </div>
    </div>
  </section>`;
}

function contactBody() {
  return `
${pageHero("お問い合わせ", COPY.contactHero)}
  <section class="block-page">
    <div class="wrap">
      <p class="page-lead">${COPY.contactLead}</p>
      <div class="contact-layout">
        <div class="contact-card">
          <h2>電話</h2>
          <p><a class="tel-lg" href="${COMPANY.telHref}">${COMPANY.tel}</a></p>
          <p class="muted">受付: ${COMPANY.hours}（定休日: ${COMPANY.holiday}）</p>
          <a class="btn btn--primary" href="${COMPANY.telHref}">電話をかける</a>
        </div>
        <div class="contact-card">
          <h2>メール</h2>
          <p><a href="mailto:${COMPANY.email}">${COMPANY.email}</a></p>
          <p class="muted">${COPY.contactReply}</p>
          <a class="btn btn--ghost" href="mailto:${COMPANY.email}">メールを送る</a>
        </div>
      </div>
      <h2 class="subhead">お問い合わせのときにあると助かる情報</h2>
      <ul class="check-list">${prepListHtml()}</ul>
      <h2 class="subhead">所在地・対応エリア</h2>
      <p class="page-lead">${COMPANY.address}</p>
      <p class="page-lead">${COPY.areaBody}</p>
      <div class="strip strip--page">
        <h2>${COPY.ctaTitle}</h2>
        <a class="btn btn--primary" href="${COMPANY.telHref}">${COMPANY.tel}</a>
      </div>
    </div>
  </section>`;
}

function privacyBody() {
  return `
${pageHero("プライバシーポリシー", "個人情報の取り扱いについて")}
  <section class="block-page">
    <div class="wrap prose-page">
      <p>${COMPANY.name}（以下「当社」）は、お問い合わせ等で取得する個人情報を、ご本人への連絡・見積対応の目的で利用します。</p>
      <p>法令に基づく場合を除き、ご本人の同意なく第三者へ提供しません。開示・訂正・削除のご請求は、お問い合わせ窓口までご連絡ください。</p>
      <p>連絡先: <a href="mailto:${COMPANY.email}">${COMPANY.email}</a> / ${COMPANY.tel}</p>
      <p class="muted">本文はデモ雛形です。買い取り後に御社名へ差し替えます。</p>
    </div>
  </section>`;
}

const siteJs = `(() => {
  const btn = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  if (!btn || !nav) return;
  btn.addEventListener("click", () => nav.classList.toggle("is-open"));
})();
`;

for (const skin of skins) {
  const dir = path.join(root, skin.id);
  for (const sub of ["", "about", "services", "contact", "privacy"]) {
    const d = sub ? path.join(dir, sub) : dir;
    fs.mkdirSync(d, { recursive: true });
  }
  fs.writeFileSync(path.join(dir, "site.js"), siteJs);

  const pages = [
    {
      file: "index.html",
      depth: 0,
      current: "home",
      title: `${COMPANY.name}｜${skin.label}`,
      desc: `${COMPANY.name}。${COPY.metaDesc}`,
      body: homeBody(skin.id),
    },
    {
      file: "about/index.html",
      depth: 1,
      current: "about",
      title: `会社概要｜${COMPANY.name}`,
      desc: `${COMPANY.name}の会社概要。`,
      body: aboutBody(),
    },
    {
      file: "services/index.html",
      depth: 1,
      current: "services",
      title: `サービス｜${COMPANY.name}`,
      desc: `${COMPANY.name}のサービス案内。`,
      body: servicesBody(),
    },
    {
      file: "contact/index.html",
      depth: 1,
      current: "contact",
      title: `お問い合わせ｜${COMPANY.name}`,
      desc: `${COMPANY.name}へのお問い合わせ。`,
      body: contactBody(),
    },
    {
      file: "privacy/index.html",
      depth: 1,
      current: "privacy",
      title: `プライバシーポリシー｜${COMPANY.name}`,
      desc: `個人情報の取り扱い。`,
      body: privacyBody(),
    },
  ];

  for (const p of pages) {
    const html = shell({
      skin,
      title: p.title,
      desc: p.desc,
      depth: p.depth,
      current: p.current,
      body: p.body,
    });
    fs.writeFileSync(path.join(dir, p.file), html);
  }
  console.log("built", skin.id);
}

console.log("done");

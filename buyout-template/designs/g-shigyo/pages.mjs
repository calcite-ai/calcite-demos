/**
 * G Shigyo — 士業向けデモのページ生成（swap-shigyo.mjs から呼ぶ）。
 * 写真は使わない。載せるのは先方HPで確認できた事実だけ。空欄は「ご購入後」の約束にする。
 */

const FONT =
  "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;600&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap";

export function esc(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const SLOT_SERVICE = "詳しい対応範囲は、ご購入後のヒアリングのうえ反映します。";

/**
 * ctx: { name, credentials[], lead, tel, email, address, hours, services[], rows[[label,value]], area }
 * depth: 0 = トップ、1 = 下層（../ を付ける）
 */
function shell(ctx, { depth, title, desc, current, body, heroBlock }) {
  const p = depth === 0 ? "" : "../";
  const telHref = `tel:${ctx.tel.replace(/[^0-9+]/g, "")}`;
  const link = (key, label) =>
    `<a href="${p}${key}/index.html"${current === key ? ' aria-current="page"' : ""}>${label}</a>`;
  const hoursLine = ctx.hours ? `<p>${esc(ctx.hours)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${FONT}" rel="stylesheet" />
  <link rel="stylesheet" href="${p}styles.css" />
  <meta name="robots" content="noindex,nofollow" />
</head>
<body>
  <header class="site-header">
    <div class="wrap site-header__inner">
      <a class="brand" href="${p}index.html">${esc(ctx.name)}</a>
      <nav class="nav" aria-label="メインメニュー">
        ${link("about", "事務所概要")}
        ${link("services", "業務案内")}
        <a href="${p}contact/index.html" class="nav__cta"${current === "contact" ? ' aria-current="page"' : ""}>お問い合わせ</a>
      </nav>
      <button class="menu-btn" type="button" aria-label="メニュー" data-menu-toggle><span></span><span></span><span></span></button>
    </div>
    <div class="wrap mobile-nav" data-mobile-nav>
      <a href="${p}index.html">ホーム</a>
      <a href="${p}about/index.html">事務所概要</a>
      <a href="${p}services/index.html">業務案内</a>
      <a href="${p}contact/index.html">お問い合わせ</a>
      <a href="${p}privacy/index.html">プライバシーポリシー</a>
    </div>
  </header>
  <main>
${heroBlock || ""}${body}
  </main>
  <footer class="site-footer">
    <div class="wrap site-footer__grid">
      <div>
        <strong>${esc(ctx.name)}</strong>
        <p>${esc(ctx.address)}</p>
        <p>TEL <a href="${telHref}">${esc(ctx.tel)}</a></p>
      </div>
      <div>
        <p><a href="${p}about/index.html">事務所概要</a><br />
        <a href="${p}services/index.html">業務案内</a><br />
        <a href="${p}contact/index.html">お問い合わせ</a></p>
      </div>
      <div>
        ${hoursLine}
        <p><a href="${p}privacy/index.html">プライバシーポリシー</a></p>
      </div>
    </div>
    <div class="wrap site-footer__copy">© All Rights Reserved ${esc(ctx.name)}</div>
  </footer>
  <nav class="bottom-bar" aria-label="スマートフォン用連絡">
    <a href="${telHref}">電話する</a>
    <a href="${p}contact/index.html">お問い合わせ</a>
  </nav>
  <script src="${p}site.js"></script>
</body>
</html>
`;
}

function pageHero(en, h1, lead) {
  return `    <section class="page-hero">
      <div class="wrap">
        <p class="sec-head__en">${en}</p>
        <h1>${h1}</h1>${lead ? `\n        <p class="page-hero__lead">${lead}</p>` : ""}
      </div>
    </section>
`;
}

function infoTable(ctx) {
  const telHref = `tel:${ctx.tel.replace(/[^0-9+]/g, "")}`;
  const rows = [
    ["事務所名", esc(ctx.name)],
    ...ctx.rows.map(([k, v]) => [esc(k), esc(v)]),
    ["所在地", esc(ctx.address)],
    ["電話", `<a href="${telHref}">${esc(ctx.tel)}</a>`],
  ];
  if (ctx.email) rows.push(["メール", `<a href="mailto:${esc(ctx.email)}">${esc(ctx.email)}</a>`]);
  if (ctx.hours) rows.push(["営業時間", esc(ctx.hours)]);
  rows.push(["業務内容", ctx.services.map(esc).join("、")]);
  return `<table class="info-table">
          ${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("\n          ")}
        </table>`;
}

export function renderSite(ctx) {
  const credLine = ctx.credentials.join("・");
  const metaDesc = `${ctx.name}。${credLine ? credLine + "。" : ""}${ctx.services.slice(0, 3).join("・")}。`;
  const svcList = ctx.services
    .map((s) => `<li><a href="services/index.html">${esc(s)}</a></li>`)
    .join("\n          ");
  const chips = ctx.credentials.length
    ? `\n      <ul class="chips" aria-label="資格">${ctx.credentials.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
    : "";
  const lead = ctx.lead ? `\n      <p class="hero__lead">${esc(ctx.lead)}</p>` : "";
  const telHref = `tel:${ctx.tel.replace(/[^0-9+]/g, "")}`;

  const home = shell(ctx, {
    depth: 0,
    title: ctx.name,
    desc: metaDesc,
    current: "home",
    heroBlock: `    <section class="hero">
    <div class="wrap">
      <div class="hero__rule" aria-hidden="true"></div>
      <h1>${esc(ctx.name)}</h1>${chips}${lead}
      <div class="hero__cta">
        <a class="btn" href="${telHref}">電話で相談する</a>
        <a class="btn btn--ghost" href="contact/index.html">お問い合わせフォーム</a>
      </div>
    </div>
  </section>
`,
    body: `
    <section class="section" id="services">
      <div class="wrap">
        <div class="sec-head">
          <p class="sec-head__en">Services</p>
          <h2>業務案内</h2>
        </div>
        <ul class="svc-list">
          ${svcList}
        </ul>
        <p class="slot-note">詳しい対応範囲は、ご購入後のヒアリングのうえ反映します。</p>
      </div>
    </section>

    <section class="section section--alt" id="office">
      <div class="wrap">
        <div class="sec-head">
          <p class="sec-head__en">Office</p>
          <h2>事務所概要</h2>
        </div>
        ${infoTable(ctx)}
        <p class="more"><a href="about/index.html">事務所概要を見る →</a></p>
      </div>
    </section>

    <section class="section" id="news">
      <div class="wrap">
        <div class="sec-head">
          <p class="sec-head__en">News</p>
          <h2>お知らせ</h2>
        </div>
        <p class="slot">お知らせを掲載します。</p>
      </div>
    </section>

    <section class="contact-band" id="contact">
      <div class="wrap">
        <h3>お問い合わせ</h3>
        <p>ご相談は、お電話またはフォームからお願いいたします。</p>
        <a class="btn" href="contact/index.html">お問い合わせフォーム</a>
      </div>
    </section>`,
  });

  const about = shell(ctx, {
    depth: 1,
    title: `事務所概要｜${ctx.name}`,
    desc: metaDesc,
    current: "about",
    heroBlock: pageHero("About", "事務所概要", esc(ctx.name)),
    body: `
    <section class="page-body">
      <div class="wrap">
        <h2>ごあいさつ</h2>
        <p class="slot">ご購入後、ヒアリングのうえ反映します。</p>

        <h2>事務所情報</h2>
        ${infoTable(ctx)}

        <h2>アクセス</h2>
        <p>${esc(ctx.address)}</p>
        <p class="form-note">ご購入後、埋め込みマップを設置します。</p>
      </div>
    </section>`,
  });

  const services = shell(ctx, {
    depth: 1,
    title: `業務案内｜${ctx.name}`,
    desc: metaDesc,
    current: "services",
    heroBlock: pageHero("Services", "業務案内", `${esc(ctx.services.join("、"))}をご案内します。`),
    body: `
    <section class="page-body">
      <div class="wrap">
        ${ctx.services
          .map(
            (s) => `<article class="svc-block">
          <h2>${esc(s)}</h2>
          <p class="form-note">${SLOT_SERVICE}</p>
        </article>`
          )
          .join("\n        ")}
      </div>
    </section>`,
  });

  const contact = shell(ctx, {
    depth: 1,
    title: `お問い合わせ｜${ctx.name}`,
    desc: metaDesc,
    current: "contact",
    heroBlock: pageHero("Contact", "お問い合わせ", "ご相談は、お電話または下記フォームよりお願いいたします。"),
    body: `
    <section class="page-body">
      <div class="wrap">
        <div class="contact-card">
          <h2>お電話</h2>
          <p class="tel"><a href="${telHref}">${esc(ctx.tel)}</a></p>
          <p class="note">${ctx.hours ? esc(ctx.hours) : "営業時間はご購入後に反映します"}</p>
        </div>

        <h2>お問い合わせフォーム</h2>
        <form class="form-mock" action="#" method="post" onsubmit="return false;">
          <label for="c-name">お名前</label>
          <input id="c-name" name="name" type="text" autocomplete="name" />
          <label for="c-tel">電話番号</label>
          <input id="c-tel" name="tel" type="tel" autocomplete="tel" />
          <label for="c-email">メールアドレス</label>
          <input id="c-email" name="email" type="email" autocomplete="email" />
          <label for="c-type">お問い合わせ種別</label>
          <select id="c-type" name="type">
            <option>ご相談</option>
            <option>費用について</option>
            <option>その他</option>
          </select>
          <label for="c-body">お問い合わせ内容</label>
          <textarea id="c-body" name="body"></textarea>
          <button class="btn" type="submit">送信する</button>
        </form>
        <p class="form-note">※フォームはイメージです。ご連絡はお電話でお願いいたします。</p>
      </div>
    </section>`,
  });

  const privacy = shell(ctx, {
    depth: 1,
    title: `プライバシーポリシー｜${ctx.name}`,
    desc: metaDesc,
    current: "privacy",
    heroBlock: pageHero("Privacy Policy", "プライバシーポリシー", ""),
    body: `
    <section class="page-body">
      <div class="wrap">
        <p>${esc(ctx.name)}（以下「当事務所」）は、「個人情報の保護に関する法律」その他関連法令を遵守し、以下に示す定めに従い個人情報の保護に努めます。</p>

        <h2>１、個人情報の収集と利用</h2>
        <p>当事務所は、適法かつ公正な方法により個人情報を収集するとともに、利用目的を明示し、その達成に必要な範囲内において利用します。</p>
        <p>お問い合わせ、ご相談、ご依頼に際し、次の情報を取得することがあります。</p>
        <ul>
          <li>氏名、住所、電話番号、メールアドレス</li>
          <li>ご相談内容、ご依頼に関する情報</li>
          <li>その他、業務の遂行に必要な情報</li>
        </ul>
        <p>取得した個人情報は、次の目的で利用します。</p>
        <ul>
          <li>お問い合わせへの回答、資料の送付</li>
          <li>ご相談への対応、ご依頼に関する業務の遂行</li>
          <li>法令に基づく対応</li>
        </ul>

        <h2>２、個人情報の管理及び保護</h2>
        <p>当事務所は個人情報の管理を厳重に行い、不正アクセス、紛失、破壊、改ざん、漏えいを防ぐための適切な措置を講じます。</p>

        <h2>３、個人情報の第三者への提供</h2>
        <p>当事務所は、法令に定める場合を除き、本人の同意を得ずに個人情報を第三者に提供しません。</p>

        <h2>４、個人情報に関する対応</h2>
        <p>当事務所が管理する個人情報について、本人から開示・訂正・利用停止・消去等の請求があった場合は、法令に基づき、適正な範囲において速やかに対応します。ご請求は下記窓口までご連絡ください。</p>

        <h2>５、Cookie・外部サービス</h2>
        <p>本サイトでは、表示に必要な範囲でCookieを使用する場合があります。字体の表示のため Google Fonts を利用しており、その過程でIPアドレス等が当該事業者に送信されることがあります。広告配信および第三者のアクセス解析は、現時点では利用していません。地図の埋め込みなど、新たな外部サービスを導入する場合は、本ポリシーを更新します。</p>

        <h2>６、お問い合わせ窓口</h2>
        <p>本ポリシーおよび個人情報の取扱いに関するお問い合わせは、次の窓口までお願いいたします。</p>
        <p>${esc(ctx.name)}<br />
        ${esc(ctx.address)}<br />
        TEL <a href="${telHref}">${esc(ctx.tel)}</a>${ctx.email ? `<br />\n        メール <a href="mailto:${esc(ctx.email)}">${esc(ctx.email)}</a>` : ""}</p>

        <h2>７、改定</h2>
        <p>本ポリシーの内容は、法令の改正や業務内容の変更に応じて見直すことがあります。重要な変更がある場合は、本ページにてお知らせします。</p>
      </div>
    </section>`,
  });

  return {
    "index.html": home,
    "about/index.html": about,
    "services/index.html": services,
    "contact/index.html": contact,
    "privacy/index.html": privacy,
  };
}

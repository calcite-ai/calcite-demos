/** GitHub Pages 等の base path 付きURLを返す */
export function withBase(path: string): string {
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('tel:') ||
    path.startsWith('mailto:') ||
    path.startsWith('#')
  ) {
    return path;
  }
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const site = {
  name: '一般社団法人 終活コンシェルジュ',
  shortName: '終活コンシェルジュ',
  titleTemplate: (page: string) => `${page} | 終活コンシェルジュ`,
  description:
    '高齢者の身元保証・死後事務・生活支援まで、窓口ひとつでサポートする終活の総合相談窓口です。',
  url: 'https://calcite-ai.github.io/calcite-demos/shukatsu-demo',
  locale: 'ja_JP',
  phone: '03-6276-8097',
  phoneFree: '0120-108-251',
  fax: '03-6276-8125',
  email: 'info@shukatsu.or.jp',
  address: {
    region: '東京都',
    locality: '新宿区',
    street: '西新宿3丁目13-11-201号',
    full: '東京都新宿区西新宿3丁目13-11-201号',
  },
  representative: '斉藤 由麗',
  ogImage: '/images/og/og-default.jpg',
  logo: '/images/logo/logo.png',
  logoDisplay: '/images/logo/終活コンシェルジュ_ロゴ.png',
} as const;

/** 絶対URL（site.url は base path 込み）。先頭 `/` でも origin 直下に飛ばない */
export function absUrl(path = '/'): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = site.url.replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const navItems = [
  { href: '/about/', label: '私たちについて' },
  { href: '/service/', label: 'サービス' },
  { href: '/cases/', label: '解決事例' },
  { href: '/flow/', label: 'ご契約の流れ' },
  { href: '/activity/', label: '活動実績' },
  { href: '/faq/', label: 'FAQ' },
  { href: '/columns/', label: 'コラム' },
  { href: '/company/', label: '会社概要' },
  { href: '/contact/', label: 'お問い合わせ' },
] as const;

export const audiencePages = [
  {
    slug: 'family',
    label: 'ご家族向け',
    href: '/for/family/',
    lead: '遠方に住むご家族でも、安心の窓口をひとつに。',
  },
  {
    slug: 'community-support',
    label: '地域包括支援センター向け',
    href: '/for/community-support/',
    lead: '身寄りのない高齢者支援の連携先として。',
  },
  {
    slug: 'care-manager',
    label: 'ケアマネジャー向け',
    href: '/for/care-manager/',
    lead: '入所・入院時の身元保証の受け皿に。',
  },
  {
    slug: 'hospital-msw',
    label: '病院MSW向け',
    href: '/for/hospital-msw/',
    lead: '退院調整・緊急時の身元引受を支援。',
  },
  {
    slug: 'nursing-home',
    label: '老人ホーム向け',
    href: '/for/nursing-home/',
    lead: '入居時保証・緊急連絡先の課題を解消。',
  },
  {
    slug: 'referral',
    label: '紹介会社向け',
    href: '/for/referral/',
    lead: '施設紹介と身元保証の連携をスムーズに。',
  },
] as const;

export const services = [
  {
    id: 'sasae',
    name: '身元保証「ささえ」',
    summary: '入院・施設入所時の連帯保証と身柄引受。預託金不要のプランです。',
    image: '/images/photos/sasae.jpg',
    href: '/service/#sasae',
  },
  {
    id: 'otomo',
    name: '生活支援「おとも」',
    summary: '診察同席、買い物、外出同伴など、日常の支えとなる支援です。',
    image: '/images/photos/otomo.jpg',
    href: '/service/#otomo',
  },
  {
    id: 'mukae',
    name: '死後事務「むかえ」',
    summary: '葬儀・喪主代行、埋葬、遺品整理、役所手続きまで。',
    image: '/images/photos/mukae.jpg',
    href: '/service/#mukae',
  },
] as const;

export const worries = [
  '入院や施設入所の身元保証人が見つからない',
  '家族はいるが遠方で、日常の支えを頼めない',
  '亡くなったあとの手続きを誰かに任せたい',
  '専門家ごとに窓口が分かれていて疲れる',
  'ケアマネ・MSWとして相談できる先がほしい',
] as const;

export const flowSteps = [
  {
    step: 1,
    title: 'ご相談受付',
    body: 'ご本人・ご家族、または専門職の方からお話を伺い、面談日程を調整します。',
    image: '/images/photos/consult.jpg',
  },
  {
    step: 2,
    title: 'ご面談',
    body: 'ご本人と直接お話しし、必要な支援を明確にしてご提案します。ご希望の場所へ伺います。',
    image: '/images/photos/meeting.jpg',
  },
  {
    step: 3,
    title: 'ご契約',
    body: '内容にご納得いただけましたら契約を締結。読み合わせにはご家族や事業者様の同席をお願いしています。',
    image: '/images/photos/contract.jpg',
  },
  {
    step: 4,
    title: 'サービス開始',
    body: 'ここから有料サービスが始まります。生涯にわたって必要な支援を行います。',
    image: '/images/photos/start.jpg',
  },
] as const;

export const companyProfile = {
  greeting: `現代の日本において、相続問題が「争族」問題になることは少なくありません。介護や葬儀・埋葬の方法など、ご家族はもちろん、ご自身でもどうしてよいかわからないことが多々ございます。これらの問題の大半は事前の準備不足によって起こっています。

核家族化が進み、近所付き合いが希薄な現代では高齢者の独居率が増え、孤独死などの社会問題にもつながっています。相続、施設入居と不動産の処分、身元保証、葬儀——相談窓口は統合されておらず、すべてを解決しようと思えば大変な労力が必要です。

私たちが考える終活とは、これらの問題のリスク管理と解決の手段です。終活コンシェルジュが唯一の窓口となることで煩わしさを取り除き、充実したシニアライフを支えていきたいと考えています。`,
  business: [
    '高齢者等終身サポート事業',
    '身元保証業務',
    '死後事務委任業務',
    '介護施設等への紹介業務',
    '各種イベント・セミナーの企画運営',
    '終活に関する講師派遣',
    'シニア層の意識調査',
    'シニア層へのマーケティング支援及びシニアリクルート',
  ],
  history: [
    { year: '2012年', text: '社団設立。シニア向けセミナー及び各種専門職による相談事業を開始' },
    { year: '2014年', text: '身元保証サービス、施設紹介及びシニアマーケティング事業を開始。高島平なんでも相談室開設' },
    { year: '2016年', text: '新宿区へ本店移転' },
    { year: '2017年', text: '預託金無しの身元保証サービスを開始' },
  ],
} as const;

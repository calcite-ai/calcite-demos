export type Topic = {
  date: string; // YYYY-MM-DD
  title: string;
  href?: string;
  external?: boolean;
};

/**
 * トップページ「TOPICS」用。新しい順に並べる。
 * 追加するときは先頭に1件足すだけでOK。
 */
export const topics: Topic[] = [
  {
    date: '2026-07-16',
    title: 'コラムを公開しました（身元保証・ガイドライン解説）',
    href: '/columns/',
  },
  {
    date: '2026-06-19',
    title: '羽鳥慎一モーニングショーにて紹介されました',
  },
  {
    date: '2026-06-01',
    title: '高齢者等終身サポート事業者ガイドラインへの取組みを公開',
    href: '/guideline/',
  },
];

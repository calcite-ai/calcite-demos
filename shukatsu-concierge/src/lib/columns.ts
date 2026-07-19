import { getCollection, type CollectionEntry } from 'astro:content';

/** 表示名 → URLスラッグ（英数字推奨） */
const CATEGORY_SLUGS: Record<string, string> = {
  ニュース: 'news',
  身元保証: 'mimoto-hosho',
  '制度・安心': 'seido-anshin',
  '制度・ガイドライン': 'seido-guideline',
  制度改正: 'seido-kaisei',
  終活の基礎: 'shukatsu-basics',
};

export type ColumnPost = CollectionEntry<'columns'>;

export function categoryToSlug(category: string): string {
  if (CATEGORY_SLUGS[category]) return CATEGORY_SLUGS[category];
  return category
    .trim()
    .toLowerCase()
    .replace(/[・\s／/]+/g, '-')
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'misc';
}

export function slugToCategory(slug: string, categories: string[]): string | undefined {
  const fromMap = Object.entries(CATEGORY_SLUGS).find(([, s]) => s === slug)?.[0];
  if (fromMap && categories.includes(fromMap)) return fromMap;
  return categories.find((name) => categoryToSlug(name) === slug);
}

export async function getPublishedColumns(): Promise<ColumnPost[]> {
  return (await getCollection('columns', ({ data }) => data.status === 'published')).sort(
    (a, b) => b.data.published_date.valueOf() - a.data.published_date.valueOf(),
  );
}

export function getCategoryStats(posts: ColumnPost[]): { name: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    counts.set(post.data.category, (counts.get(post.data.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: categoryToSlug(name), count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export function filterByCategory(posts: ColumnPost[], category: string): ColumnPost[] {
  return posts.filter((post) => post.data.category === category);
}

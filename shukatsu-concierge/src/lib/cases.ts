import { getCollection, type CollectionEntry } from 'astro:content';
import { categoryToSlug, slugToCategory } from './columns';

export type CasePost = CollectionEntry<'cases'>;

export { categoryToSlug, slugToCategory };

export async function getPublishedCases(): Promise<CasePost[]> {
  return (await getCollection('cases', ({ data }) => data.status === 'published')).sort(
    (a, b) => b.data.published_date.valueOf() - a.data.published_date.valueOf(),
  );
}

export function getCaseCategoryStats(posts: CasePost[]): { name: string; slug: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    counts.set(post.data.category, (counts.get(post.data.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, slug: categoryToSlug(name), count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
}

export function filterCasesByCategory(posts: CasePost[], category: string): CasePost[] {
  return posts.filter((post) => post.data.category === category);
}

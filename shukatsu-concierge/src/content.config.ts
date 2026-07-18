import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const columns = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/columns' }),
  schema: z.object({
    title: z.string(),
    meta_description: z.string(),
    category: z.string(),
    published_date: z.coerce.date(),
    status: z.enum(['draft', 'review', 'published']),
    ai_generated: z.boolean().optional().default(false),
    needs_review: z.boolean().optional().default(false),
    og_image: z.string().optional(),
    source_url: z.string().url().optional(),
  }),
});

const cases = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    meta_description: z.string(),
    category: z.enum(['相続', '身元保証', '死後事務', '生活支援', 'その他']),
    status: z.enum(['draft', 'review', 'published']).default('published'),
    source: z.enum(['地域包括', '居宅介護', '病院MSW', '本人・家族', 'その他']),
    published_date: z.coerce.date(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/faq' }),
  schema: z.object({
    question: z.string(),
    category: z.string(),
    order: z.number().default(0),
    status: z.enum(['draft', 'review', 'published']).default('published'),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    meta_description: z.string(),
    published_date: z.coerce.date(),
    status: z.enum(['draft', 'review', 'published']).default('published'),
  }),
});

export const collections = { columns, cases, faq, guides };

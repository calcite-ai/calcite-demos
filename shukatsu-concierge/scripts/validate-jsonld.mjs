#!/usr/bin/env node
/**
 * Build output JSON-LD validator (Google Rich Results oriented)
 * Usage: npm run build && npm run validate:jsonld
 */
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve('dist');
const errors = [];
const report = [];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name === 'index.html') out.push(p);
  }
  return out;
}

function extractJsonLd(html) {
  const re = /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  const items = [];
  let m;
  while ((m = re.exec(html))) {
    try {
      items.push(JSON.parse(m[1]));
    } catch (e) {
      errors.push(`Invalid JSON-LD parse: ${e.message}`);
    }
  }
  return items;
}

function typesOf(obj) {
  const t = obj['@type'];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function requireFields(label, obj, fields) {
  for (const f of fields) {
    const parts = f.split('.');
    let cur = obj;
    for (const part of parts) {
      if (cur == null || !(part in cur)) {
        errors.push(`${label}: missing required field "${f}"`);
        return;
      }
      cur = cur[part];
    }
    if (cur === '' || cur == null || (Array.isArray(cur) && cur.length === 0)) {
      errors.push(`${label}: empty required field "${f}"`);
    }
  }
}

const pages = walk(DIST);
let faqPages = 0;
let articlePages = 0;
let orgPages = 0;
let breadcrumbPages = 0;

for (const page of pages) {
  const rel = path.relative(DIST, page);
  const html = fs.readFileSync(page, 'utf8');
  const blocks = extractJsonLd(html);
  const pageTypes = new Set();

  const desc = html.match(/<meta name="description" content="([^"]*)"/);
  if (!desc || !desc[1].trim()) errors.push(`${rel}: missing meta description`);
  if (!html.includes('og:title')) errors.push(`${rel}: missing og:title`);
  if (html.includes('content="https://calcite-ai.github.io/images/')) {
    errors.push(`${rel}: og/twitter image missing site base path`);
  }

  for (const block of blocks) {
    for (const t of typesOf(block)) pageTypes.add(t);
    const dumped = JSON.stringify(block);
    if (
      dumped.includes('https://calcite-ai.github.io/') &&
      !dumped.includes('/calcite-demos/shukatsu-demo/') &&
      /https:\/\/calcite-ai\.github\.io\/(?!calcite-demos)/.test(dumped)
    ) {
      errors.push(`${rel}: JSON-LD URL missing site base path`);
    }

    if (typesOf(block).includes('Organization') || typesOf(block).includes('NGO')) {
      orgPages++;
      requireFields(`${rel} Organization`, block, ['name', 'url', 'logo']);
    }
    if (typesOf(block).includes('FAQPage')) {
      faqPages++;
      requireFields(`${rel} FAQPage`, block, ['mainEntity']);
      if (!Array.isArray(block.mainEntity) || block.mainEntity.length < 1) {
        errors.push(`${rel} FAQPage: mainEntity must have >= 1 Question`);
      } else {
        for (const [i, q] of block.mainEntity.entries()) {
          requireFields(`${rel} FAQPage Q${i}`, q, ['name', 'acceptedAnswer.text']);
        }
      }
    }
    if (typesOf(block).includes('Article')) {
      articlePages++;
      requireFields(`${rel} Article`, block, [
        'headline',
        'image',
        'datePublished',
        'author',
        'publisher',
      ]);
      if (!(block.publisher && block.publisher.logo)) {
        errors.push(`${rel} Article: publisher.logo required for Article rich results`);
      }
    }
    if (typesOf(block).includes('BreadcrumbList')) {
      breadcrumbPages++;
      requireFields(`${rel} BreadcrumbList`, block, ['itemListElement']);
    }
  }

  report.push({ rel, types: [...pageTypes], count: blocks.length });
}

console.log('=== JSON-LD Validation Report ===');
console.log(`Pages scanned: ${pages.length}`);
console.log(`Organization/NGO blocks: ${orgPages}`);
console.log(`FAQPage: ${faqPages}`);
console.log(`Article: ${articlePages}`);
console.log(`BreadcrumbList: ${breadcrumbPages}`);
console.log('');

if (faqPages < 1) errors.push('No FAQPage found');
if (articlePages < 1) errors.push('No Article found');
if (orgPages < 1) errors.push('No Organization found');

for (const r of report.filter((x) => x.count > 0)) {
  console.log(`✓ ${r.rel} → ${r.types.join(', ') || '(untyped)'} (${r.count})`);
}

if (errors.length) {
  console.log('\nErrors:');
  errors.forEach((e) => console.log('  ✗', e));
  process.exit(1);
}

console.log('\nAll Google-oriented required checks passed.');

const snippetsDir = path.resolve('tmp/rich-results-snippets');
fs.mkdirSync(snippetsDir, { recursive: true });
const targets = {
  home: 'index.html',
  faq: 'faq/index.html',
  article: 'columns/guarantor-basics/index.html',
  guide: 'guides/seinengoiken/index.html',
  case: 'cases/hospital-identity/index.html',
};
for (const [name, rel] of Object.entries(targets)) {
  const full = path.join(DIST, rel);
  if (!fs.existsSync(full)) {
    errors.push(`Snippet target missing: ${rel}`);
    continue;
  }
  const html = fs.readFileSync(full, 'utf8');
  const blocks = extractJsonLd(html);
  const snippet = `<!doctype html><html lang="ja"><head>
<meta charset="utf-8" />
<title>${name}</title>
${blocks.map((b) => `<script type="application/ld+json">${JSON.stringify(b)}</script>`).join('\n')}
</head><body><h1>${name} structured data snippet</h1></body></html>`;
  fs.writeFileSync(path.join(snippetsDir, `${name}.html`), snippet);
}
console.log(`Snippets written to ${snippetsDir}`);

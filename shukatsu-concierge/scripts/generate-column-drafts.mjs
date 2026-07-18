#!/usr/bin/env node
/**
 * コラム自動下書き生成スクリプト（プロトタイプ）
 *
 * 流れ:
 *  1. 公式・報道ソース候補を収集（seed + 任意の追加URL）
 *  2. Claude API で Markdown 下書きを生成
 *  3. status: draft / ai_generated: true / needs_review: true で保存
 *
 * 使い方:
 *   ANTHROPIC_API_KEY=... npm run generate:drafts
 *   ANTHROPIC_API_KEY=... npm run generate:drafts -- --count=3
 *
 * 重要:
 *   - draft / review はビルドに出ない
 *   - 相続・成年後見・死後事務の断定表現は避け、要確認を明示
 *   - 本番 cron は正式決定後に Actions schedule を有効化
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src/content/columns');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
const API_URL = 'https://api.anthropic.com/v1/messages';

const args = process.argv.slice(2);
const countArg = args.find((a) => a.startsWith('--count='));
const COUNT = Math.min(5, Math.max(1, Number(countArg?.split('=')[1] || process.env.DRAFT_COUNT || 3)));
const DRY = args.includes('--dry-run');

/** 収集シード（一次ソース優先。デモでも公式URLを必ず残す） */
const SOURCE_SEEDS = [
  {
    id: 'guideline-caa',
    category: '制度・ガイドライン',
    titleHint: '高齢者等終身サポート事業者ガイドラインの見方',
    url: 'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_037',
    note: '消費者庁: ガイドライン・チェックリスト公開ページ',
  },
  {
    id: 'guideline-moj',
    category: '制度・ガイドライン',
    titleHint: '法務省が示す終身サポート事業者ガイドライン',
    url: 'https://www.moj.go.jp/MINJI/minji07_00358.html',
    note: '法務省: ガイドライン案内',
  },
  {
    id: 'shakaihukushi-2026',
    category: '制度改正',
    titleHint: '身寄りのない高齢者支援と改正社会福祉法',
    url: 'https://fukushishimbun.com/seiji/45595',
    note: '福祉新聞: 改正社会福祉法成立の報道（二次情報・要一次確認）',
  },
  {
    id: 'nikkei-miyori',
    category: '制度改正',
    titleHint: '入院・葬儀を福祉の対象に広がる身寄りなし支援',
    url: 'https://www.nikkei.com/article/DGXZQOUA104MY0Q6A610C2000000/',
    note: '日経: 改正法成立の報道（二次情報・要一次確認）',
  },
  {
    id: 'aftercare-basics',
    category: '死後事務',
    titleHint: '死後事務委任で決めておくと安心なこと',
    url: 'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_037/assets/consumer_policy_cms102_240618_03.pdf',
    note: '消費者庁: ガイドライン主なポイントPDF',
  },
];

function slugify(input) {
  const base = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `ai-draft-${stamp}-${base || 'column'}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function fetchSourceSnippet(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShukatsuConciergeDraftBot/0.1; +https://shukatsu.or.jp)',
        Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const status = res.status;
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok) return { url, status, excerpt: '', error: `HTTP ${status}` };
    if (ctype.includes('pdf')) {
      return { url, status, excerpt: '（PDF資料。本文抽出はスキップ。タイトル・公開元を一次確認すること）', contentType: ctype };
    }
    const text = await res.text();
    const stripped = text
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { url, status, excerpt: stripped.slice(0, 1200), contentType: ctype };
  } catch (e) {
    return { url, status: 0, excerpt: '', error: String(e.message || e) };
  }
}

async function collectTopics(n) {
  // カテゴリが偏らないようラウンドロビン
  const picked = [];
  for (let i = 0; i < n; i++) {
    picked.push(SOURCE_SEEDS[i % SOURCE_SEEDS.length]);
  }
  // 同一seedが重複したら次のseedへずらす
  const unique = [];
  const used = new Set();
  for (let i = 0; unique.length < n && i < SOURCE_SEEDS.length * 2; i++) {
    const s = SOURCE_SEEDS[i % SOURCE_SEEDS.length];
    if (used.has(s.id)) continue;
    used.add(s.id);
    unique.push(s);
  }
  const topics = [];
  for (const seed of unique.slice(0, n)) {
    const fetched = await fetchSourceSnippet(seed.url);
    topics.push({ ...seed, fetched });
  }
  return topics;
}

function buildPrompt(topic) {
  return `あなたは終活・高齢者支援のコーポレートサイト用コラムの下書き担当です。
以下の条件を厳守し、日本語Markdown本文のみを出力してください（frontmatterは出力しない）。

【絶対条件】
- 断定しすぎない。未確認の数値・日付・法解釈は「要確認」と明記
- 法律・制度の最終判断は専門家確認が必要である旨を本文冒頭に書く
- 善悪ジャッジや煽り表現は禁止
- 出典URLを本文末尾に「参考（要確認）」として列挙
- 見出しは ## / ### のみ
- 本文はおおよそ1200〜1800字
- 読者はご家族・ケアマネ・地域包括職員を想定

【テーマ案】
${topic.titleHint}

【カテゴリ】
${topic.category}

【収集メモ】
${topic.note}

【取得ソース】
URL: ${topic.url}
HTTP: ${topic.fetched?.status ?? 'n/a'}
抜粋: ${topic.fetched?.excerpt || topic.fetched?.error || 'なし'}

【構成】
1. 冒頭の注意書き（AI下書き・要確認）
2. この話題が今重要な理由
3. わかっていること / まだ確認が必要なこと
4. ご本人・ご家族・専門職が今できること
5. 参考リンク
`;
}

async function callClaude(apiKey, prompt) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API error ${res.status}: ${body.slice(0, 500)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n')
    .trim();
  if (!text) throw new Error('Empty Claude response');
  return text;
}

function toFrontmatter(topic, body) {
  const title = `【AI生成・要確認】${topic.titleHint}`;
  const meta = `${topic.titleHint}について整理した自動下書きです。公開前に必ず人間が事実確認してください。`;
  const slug = slugify(topic.id);
  const fm = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `meta_description: ${JSON.stringify(meta)}`,
    `category: ${JSON.stringify(topic.category)}`,
    `published_date: ${todayISO()}`,
    'status: draft',
    'ai_generated: true',
    'needs_review: true',
    `source_url: ${JSON.stringify(topic.url)}`,
    '---',
    '',
    '> **AI生成・要確認**: 本記事は自動下書きです。制度・料金・手続きの断定は禁止。担当者が一次ソースを確認し、`status: published` に変更するまで公開されません。',
    '',
    body.trim(),
    '',
    '---',
    '',
    `収集メモ: ${topic.note}`,
    `収集時HTTP: ${topic.fetched?.status ?? 'n/a'}`,
    '',
  ].join('\n');
  return { slug, content: fm, title };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY が未設定です。.env か環境変数を設定してください。');
    process.exit(1);
  }

  console.log(`[generate-column-drafts] count=${COUNT} model=${MODEL} dry=${DRY}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const topics = await collectTopics(COUNT);
  console.log('[collect] topics:');
  for (const t of topics) {
    console.log(`  - ${t.id}: ${t.url} (HTTP ${t.fetched?.status ?? 'err'})`);
  }

  const written = [];
  for (const topic of topics) {
    process.stdout.write(`[generate] ${topic.id} ... `);
    const body = await callClaude(apiKey, buildPrompt(topic));
    const { slug, content, title } = toFrontmatter(topic, body);
    const file = path.join(OUT_DIR, `${slug}.md`);
    if (DRY) {
      console.log(`dry-run (${content.length} chars)`);
    } else {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`wrote ${path.relative(ROOT, file)}`);
      written.push({ file: path.relative(ROOT, file), title, status: 'draft' });
    }
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    count: written.length,
    items: written,
    note: 'draftのみ。publishedへの変更は人間レビュー後。',
  };
  const manifestPath = path.join(ROOT, 'tmp/draft-generation-manifest.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[done] ${written.length} drafts. manifest: tmp/draft-generation-manifest.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

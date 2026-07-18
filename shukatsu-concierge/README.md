# 終活コンシェルジュ サイトリニューアル試作

一般社団法人終活コンシェルジュ（https://shukatsu.or.jp/）のコーポレートサイトリニューアル提案用デモ。

## 場所

`~/claude/02_hp-sales/demos/shukatsu-concierge/`（カルサイト HP制作）

## 技術

- Astro 7 + Tailwind CSS v4 + MDX
- Content Collections（columns / cases / faq / guides）
- JSON-LD（Organization / FAQPage / Article）
- sitemap + robots.txt
- Vercel 想定

## 開発

```bash
cd ~/claude/02_hp-sales/demos/shukatsu-concierge
npm install
npm run dev
npm run build
npm run validate:jsonld
npm run generate:drafts
```

詳細: `docs/GEO-structured-data.md`

## 進行

1. ✅ 現行サイト調査
2. ✅ 雛形・ディレクトリ構成
3. ✅ 全ページ実装（本ステップ）
4. ✅ 構造化データ実装＋ローカル検証（Google URLテストはVercel後）
5. ✅ 自動下書きスクリプト本実装（draft 3件生成済み）
6. ⬜ Vercel プレビュー

パイプライン詳細: [`docs/column-draft-pipeline.md`](docs/column-draft-pipeline.md)

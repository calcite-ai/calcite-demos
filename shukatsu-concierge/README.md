# 終活コンシェルジュ サイトリニューアル

一般社団法人終活コンシェルジュ（https://shukatsu.or.jp/）のコーポレートサイト。**本番公開済み**。

公開用 Astro デモ（`shukatsu-demo`）は削除済み。以降の変更は WordPress テーマ／プラグインを本番へ FTP 反映する。

## 場所

`~/claude/02_hp-sales/demos/shukatsu-concierge/`（カルサイト HP制作）

## 本番

- URL: https://shukatsu.or.jp/
- テーマ: `wordpress/themes/shukatsu/`
- プラグイン: `wordpress/plugins/shukatsu-content/`

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
npm run generate:drafts          # コラム下書き（既定 dry-run / モック。--wp で WP投入）
```

詳細:
- 構造化データ: `docs/GEO-structured-data.md`
- コラム半自動: [`docs/column-draft-pipeline.md`](docs/column-draft-pipeline.md)
- Secrets / 接続: [`docs/content-ops-secrets.md`](docs/content-ops-secrets.md)
- キー到着前: [`docs/pre-api-key-week.md`](docs/pre-api-key-week.md)
- Phase3 接続: [`docs/phase3-connect-checklist.md`](docs/phase3-connect-checklist.md)
- WP下書きユーザー: [`docs/wp-draft-user-setup.md`](docs/wp-draft-user-setup.md)
- 将来の private ops: [`ops/README.md`](ops/README.md)

## 進行

1. ✅ 現行サイト調査
2. ✅ 雛形・ディレクトリ構成
3. ✅ 全ページ実装（本ステップ）
4. ✅ 構造化データ実装＋ローカル検証（Google URLテストはVercel後）
5. ✅ コラム・事例半自動の骨格（dry-run / WP REST / 事例AIボタン）。キー投入は Phase3
6. ⬜ Vercel プレビュー（任意）
7. ⬜ Phase3: 会社APIキー・WP App Password 接続 → cron 有効化

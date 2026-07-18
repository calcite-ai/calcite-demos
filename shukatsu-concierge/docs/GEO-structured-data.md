# GEO / 構造化データ（Step 4）

## 実装済み JSON-LD

| タイプ | 配置 | Googleリッチリザルト候補 |
|---|---|---|
| Organization + NGO | `/` | ナレッジパネル系（Organization） |
| WebSite | `/` | （補助） |
| ProfessionalService | `/` | （ローカル/サービス補助） |
| FAQPage | `/faq/` | **FAQ リッチリザルト** |
| Article | `/columns/*` `/guides/*` `/cases/*` | **記事リッチリザルト** |
| BreadcrumbList | 主要ページ | **パンくずリッチリザルト** |

## ローカル検証

```bash
cd ~/claude/02_hp-sales/demos/shukatsu-concierge
npm run build
npm run validate:jsonld
```

`tmp/rich-results-snippets/*.html` にコードスニペット用HTMLが出力されます。

## Google リッチリザルトテスト（本番確認手順）

公開URLがまだないため、現状は次のどちらかで確認します。

### A. コード入力（今すぐ）

1. https://search.google.com/test/rich-results を開く
2. 「コード」タブを選択
3. `tmp/rich-results-snippets/faq.html` や `article.html` の内容を貼り付けてテスト
4. FAQ / 記事 / パンくずが「有効」になることを確認

### B. URL入力（Step 6 Vercel後）

プレビューURL発行後、以下をテスト:

- `{PREVIEW}/`
- `{PREVIEW}/faq/`
- `{PREVIEW}/columns/hello-column/`
- `{PREVIEW}/guides/seinengoiken/`

## 注意

- リッチリザルトの表示保証はない（資格があっても必ず出るわけではない）
- 制度解説・FAQの文言はデモ。本番前に人間確認必須
- ロゴはスキーマ用に ASCII パス `/images/logo/logo.png` を使用

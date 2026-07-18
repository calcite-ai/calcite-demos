# GEO / 構造化データ

## 実装済み JSON-LD

| タイプ | 配置 | 目的 |
|---|---|---|
| Organization + NGO | `/` `/company/` | エンティティ（社名・所在地・連絡先・設立2012） |
| WebSite | `/` | サイト識別 |
| ProfessionalService | `/` | サービス事業体 |
| OfferCatalog / Service | `/service/` | ささえ・おとも・むかえ |
| FAQPage | `/faq/` `/service/` `/for/*` | 回答エンジン向けQ&A（ページごとに `@id` 分離） |
| HowTo | `/flow/` | 契約までの4ステップ |
| AboutPage | `/about/` | 団体定義ページ |
| ContactPage | `/contact/` | 問い合わせエンティティ |
| ItemList | `/cases/` `/columns/` `/activity/` | 一覧の機械可読化 |
| Article | `/columns/*` `/guides/*` `/cases/*` | 記事 |
| BreadcrumbList | 主要ページ | パンくず |

## ページ構成のGEO作法

各主要ページは冒頭に「このページの要点」（AnswerLead）を置き、AIが引用しやすい一文定義を先に出します。

- 活動実績: 要約数字 → 直近2年詳細 → 年別アーカイブ（全公開実績）
- 対象者別: 定義 → 課題 → 支援 → ページ固有FAQ
- 会社概要: NAP + 設立年を本文と JSON-LD の両方に

## 検証

```bash
npm run build
npm run validate:jsonld
```

リッチリザルトテスト: https://search.google.com/test/rich-results  
公開URL例: `https://calcite-ai.github.io/calcite-demos/shukatsu-demo/`

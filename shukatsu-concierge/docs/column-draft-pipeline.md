# コラム自動下書きパイプライン（Step 5）

## 運用

1. スクリプトが公式・報道URLを収集
2. Claude API で Markdown 下書きを生成
3. `status: draft` / `ai_generated: true` / `needs_review: true` で保存
4. 担当者が一次ソース確認 → `published` に変更して公開

## ローカル実行

```bash
cd ~/claude/02_hp-sales/demos/shukatsu-concierge
cp .env.example .env   # ANTHROPIC_API_KEY を設定
npm run generate:drafts
# 件数指定
npm run generate:drafts -- --count=3
```

## 安全装置

| 仕組み | 内容 |
|---|---|
| status=draft | ビルド出力されない |
| AI生成・要確認 | frontmatter + 本文冒頭に明示 |
| 断定抑制プロンプト | 制度・数値の断定を禁止 |
| Actions schedule | コメントアウト（正式決定後） |

## GitHub Actions

- `workflow_dispatch` のみ（手動）
- Secret: `ANTHROPIC_API_KEY`
- 生成後に PR 作成（peter-evans/create-pull-request）

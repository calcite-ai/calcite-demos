# 終活コンシェルジュ リニューアル（本番運用）

カルサイト HP制作カテゴリ。本番サイト運用用。

## ルール

- 実在の相談事例・個人情報は使わない（ダミーのみ）
- 相続・成年後見・死後事務は誤情報リスクが高い。AI下書きは必ず要確認表示、人間承認なしに published にしない
- 画像は自社所有が明らかなもののみ使用（Fotolia / iStock / PIXTA は不使用）
- 代表理事の顔写真は現行サイトに無し → 提供があるまでプレースホルダ
- 段階実行: 各 Step 完了後に確認を取ってから次へ
- **最終チェック時はスマホ表示も必ず確認する**（幅〜390px想定。表の横スクロール強制・文字切れ・余白の偏り・タップ不能をブラウザ／スクショで見る。実機の触り心地確認はオーナー側）
- **git push はしない**（`calcite-demos` への公開は不要。本番反映は FTP。push はオーナー指示時のみ）

## 参照

- 本番: https://shukatsu.or.jp/
- プロンプト元: ~/Downloads/claude_code_prompt.md
- コラム・解決事例の SEO/GEO 執筆: [`docs/seo-geo-writing.md`](docs/seo-geo-writing.md) / [`.cursor/rules/seo-geo-content.mdc`](.cursor/rules/seo-geo-content.mdc)

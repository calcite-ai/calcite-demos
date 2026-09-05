# calcite-demos — 作業ルール

`buyout-ops/` が買い取り営業オペの正本。手順の詳細は各docへ。
ここには**破ると事故になるもの**だけを置く。

## 1. 本文ゲート（publish / queued / 送付の前に必ず）

順番は固定。

1. `node buyout-ops/verify-demo-content.mjs --from-csv --company "<社名>"`
2. 出力の **FACT を先方HPで照合**（代表・許可・事業見出し）
3. 主要ページを幅 **〜390px** で確認
4. 送付するなら `node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>"`

- `RESULT FAIL` のまま **publish / queued / 送付しない**
- **機械 PASS だけでは最終OKにしない。** FACT未確認なら止める
- **先方HPから画像を拾わない**（在庫 Unsplash / AI素材のみ）

対象: `buyout-ops/**` `buyout-template/**` `buyout-prospects/**`

### 本文の禁止表現

「転記」「現行HP」「デモ」「本番納品」「写真はイメージです（写真なし）」は使わない。
空欄は「ご購入後に差し替え／ヒアリング／埋め込みマップ」と書く。

## 2. git push

- **`calcite-demos` への commit / push は、オーナーが明示したときだけ。**
  対話セッションでは push 前に必ず確認する。
- 例外: 9:00 のデモ制作フロー（`buyout-ops/demo_buyout_daily_schedule.md`）は
  **main 直 push が既定**。Pages は main 反映後しか 200 にならないため、
  **Draft PR で止めない**（2026-08-25/26 PR#6 未マージで Pages 404 → 送信不可）。
- 小さな見た目修正のたびに Pages へ push しない
- `shukatsu-concierge/` は**別プロダクト**。本番反映は **FTP**（オーナー確認後）。
  ここから push しない

## 3. 最終チェックはスマホ必須

デモ・クライアントHPの「最終OK」前に、幅 **〜390px**（iPhone相当）で主要ページを見る。

- 表が横スクロール強制になっていないか（必要ならカード化）
- 文字切れ・はみ出し・極端な余白の偏り
- ボタン・リンクがタップしやすいか
- 画像・ヒーローが画面を塞いでいないか

エージェントはブラウザ／スクショでのビューポート確認まで担当。
**実機の触り心地はオーナー確認**（従来どおり）。

由来: 終活コンシェルジュ・デモの活動実績ページがスマホで表が見づらかった件。

## 4. 現行の運用前提（2026-09-05 時点）

- **デモは E案1本**（`--skins e-taisei`）。`demo_url_b` は空。
  F案・旧 A〜D は明示指定時のみ
- 送信対象は **工務店（`vertical=koumuten`）のみ**。税理士・葬儀は queued にしない
- 価格は **66,000円**。それ以外で送らない。
  `quoted_price=55000` の3社へ決済メールを送らない
- 当日の通数は `buyout-ops/send-quota.csv` に従う
- オーナー未承認の `hunter-suggest` で queued を増やさない

## 主要ドキュメント

| doc | 内容 |
|---|---|
| `buyout-ops/README.md` | スクリプト一覧 |
| `buyout-ops/demo_buyout_daily_schedule.md` | 9:00 / 10:00 の手順 |
| `buyout-ops/demo_buyout_autorun.md` | 自動営業オペ全体 |
| `buyout-ops/demo_buyout_hunter.md` | G0〜G5 / C0〜C5 |
| `buyout-ops/demo_buyout_pre_send_checklist.md` | 送信前チェック |
| `buyout-ops/demo_buyout_incidents.md` | 過去の事故と再発防止 |

---

出自: `02_hp-sales/.cursor/rules/*.mdc`（Cursor用）から移植。
Cursor を併用する間は両方を更新すること。

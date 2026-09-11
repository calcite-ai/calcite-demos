# calcite-demos — 作業ルール

`buyout-ops/` が買い取り営業オペの正本。手順の詳細は各docへ。
ここには**破ると事故になるもの**だけを置く。

## 1. 本文ゲート（publish / queued / 送付の前に必ず）

順番は固定。

1. `node buyout-ops/verify-demo-content.mjs --from-csv --company "<社名>"`
2. 出力の **FACT を先方HPで照合**（代表・許可・事業見出し）
3. 主要ページを幅 **〜390px** で確認
4. `node buyout-ops/render-outreach-email.mjs --company "<社名>"` で**実際に送信されるメール本文をプレビュー**する
5. 独立エージェント（`subagent_type: deep-reasoning`）に **デモHPとメール本文プレビューの両方**を照合させる（2026-09-11〜。送信は無人自動実行のため、人・エージェントが本文を見られるのはここだけ）
6. 送付するなら `node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>"`

- `RESULT FAIL` のまま **publish / queued / 送付しない**
- **機械 PASS だけでは最終OKにしない。** FACT未確認なら止める
- **先方HPから画像を拾わない**（在庫 Unsplash / AI素材のみ）
- 詳細な手順は `buyout-ops/prompts/demo-build-0900.md` が正本

対象: `buyout-ops/**` `buyout-template/**` `buyout-prospects/**`

### 本文の禁止表現

「転記」「現行HP」「デモ」「本番納品」「写真はイメージです（写真なし）」は使わない。
空欄は「ご購入後に差し替え／ヒアリング／埋め込みマップ」と書く。

## 2. 権限（2026-09-07 オーナー指示で変更）

営業リストにはチェック機関（§1 のゲート群 + CI + watchdog）があるため、
**日々の営業オペはオーナーの都度承認なしで進めてよい。**

エージェントが自分で判断してよいこと:

- `review_queue.csv` の `owner_ok` を立てる／外す（ゲート通過が前提）
- デモ制作・publish・queued・送信（`send-quota.csv` の通数内）
- リードの `paused` 化・注記追加・欠陥修正
- `calcite-demos` への commit / push（営業オペ関連）

**オーナーに聞くこと**（ゲートが見ない領域。ここは機械では判定できない）:

1. **金が動く / 増える** — 価格変更、プラン変更、API費用が普段の桁を超える実行
2. **通数を増やす** — `send-quota.csv` の上限そのものを上げるとき
3. **売り方を変える** — メール文面の訴求変更、新しい型の投入、件名の方針変更
4. **対象を広げる** — 新しい業種、インサイド等の別トラック起動、paused の一括復活
5. **永久除外** — `prior_outreach_blocklist.csv` への追加（取り消せない）
6. **法務** — 特定電子メール法まわりの記載変更
7. **ゲートは PASS だが事実が怪しいとき** — 会社の同定ミス疑い、監査の指摘が
   実物と食い違う、送る前提そのものが崩れている（例: 板橋建設）

ゲートは機械的で、**「この指摘は事実か」「この会社で合っているか」は見ない。**
だから §1 の FACT 照合は省略しない。過去にタイセイホーム（別会社）と
三ツワ（B2B工場・工務店ではない）はここで止めた。

### push の作法

- 例外: 9:00 のデモ制作フロー（`buyout-ops/demo_buyout_daily_schedule.md`）は
  **main 直 push が既定**。Pages は main 反映後しか 200 にならないため、
  **Draft PR で止めない**（2026-08-25/26 PR#6 未マージで Pages 404 → 送信不可）。
- 小さな見た目修正のたびに Pages へ push しない
- `shukatsu-concierge/` は**別プロダクト**。本番反映は **FTP**（オーナー確認後）。
  ここから push しない
- **`demo_buyout_leads.csv` / `buyout-prospects/**` / `works/**` への push を
  数十秒〜数分の間隔で連続させない。** `buyout-daily-send.yml` は push トリガで
  起動し、concurrency で直列化はされるが、2本目が1本目のmark-sent commitより
  前のスナップショットで枠計算を始めると二重送信・枠超過送信が起きる
  （2026-09-04 佐藤工務店・2026-09-10 中武建設/マゴメ工務店で発生。
   2026-09-10 に送信直前 `git fetch && reset --hard origin/main` を追加したが、
   それでも複数社のデモ制作は**まとめて1回のpushにする**のが一番安全）

## 2.5 外（claude.ai/code・別マシン）から作業するとき

**このセッションは文脈ゼロで始まる。** まずこの順に読む。

1. `buyout-ops/STATUS.md` — **現況メモ。まずこれ**（数字・未着手・直近の発見）
2. `CLAUDE.md`（このファイル）
3. `buyout-ops/prompts/demo-build-0900.md` — 9:00 デモ制作の**正本プロンプト**
4. `buyout-ops/demo_buyout_daily_schedule.md` — 当日の手順
5. `git log --oneline -20` — 直近の判断はコミットメッセージに書いてある

### 手元（Mac）と外で違うこと

| | Mac | 外（クラウド） |
|---|---|---|
| SMTP認証情報 | 無い（Actions のみ） | 無い |
| `ANTHROPIC_API_KEY` | `~/.env` にある → ローカル実行可 | **無い** → Actions 経由のみ |
| デモのビルド・publish | できる | **できる**（リポジトリ内で完結） |

- **メール送信をローカルから叩かない。** 認証情報が無いので失敗する。
  送信は `works/**` か `demo_buyout_leads.csv` を **main に push すれば自動発火**する
  （`buyout-daily-send.yml` の push トリガ）。手動なら
  `gh workflow run buyout-daily-send.yml`。
- **モデルを使う検証**（サイト現況・抽出）は外からは Actions 経由。
  `gh workflow run buyout-official-site-check.yml`
- **SendGrid の数字**を見るなら `gh workflow run buyout-sendgrid-status.yml`
- 営業時間ガード（9-18時 JST）は Actions 側で効く。時間外は skip して次の cron で再試行。

### 外から触らない方がいいもの

- `shukatsu-concierge/` — 本番反映が FTP で、リポジトリからは出せない
- 実機でのスマホ確認（§3）— これはオーナーの手元が要る

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
- `hunter-suggest` の提案を queued にする前に §1 のゲートと FACT 照合を通す
  （2026-09-07 以前は「オーナー未承認では増やさない」だった）

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

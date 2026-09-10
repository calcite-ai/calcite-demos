# デモ買い取り — 再発防止（インシデント記録）

> 同種ミスを二度起こさないための記録とゲート一覧。

## 2026-09-10: 藤川建設 — 登録URLが孤立した旧ページ（verify-official-site.mjsの故障が原因で未然に防げず）

### 起きたこと

`demo_buyout_leads.csv` の `site_url` が `https://fujikawakensetu.com/gaiyou.html` になっていたが、
このページは2014年で更新停止し、**現行サイトのどこからもリンクされていない孤立ページ**だった。
現行は `https://fujikawakensetu.com/company/` で、以下が違っていた:

| 項目 | 孤立ページ（gaiyou.html） | 現行（company/） |
|---|---|---|
| viewport | 無し | **あり**（`width=device-width...`） |
| 建設業許可 | 般18-49132 | **般03-第049132号**（5年更新で番号が変わっていた） |
| 従業員数 | 2人 | 行ごと削除（先方が非公開にした） |
| メール掲載 | `mailto:` 平文 | スパム対策で画像化（意図的） |

deep-reasoning サブエージェントが孤立ページの事実を使ってデモを制作・publishした後、
独立レビュー（別の deep-reasoning サブエージェント）が「先方の現行サイトを見ると
筆頭の訴求（スマホ非対応）が成立しない」と気づいて FAIL 判定にした。

### 根本原因

`buyout-ops/prompts/demo-build-0900.md` の「★登録URLが現行の公式サイトかを確認する」手順が
`verify-official-site.mjs` を呼ぶ設計だが、このスクリプトは `ANTHROPIC_API_KEY` 未設定で
ローカルでは**常にエラー終了する**（2026-09-05頃から既知の未解決事項）。今回は手動WebSearch＋
ブラウザでの現地確認を省略して孤立ページだけを信じたため、機械チェックが無い状態を
人手でも補えなかった。2026-08-23石川工務店・2026-09-07 ＫＡＺ空間企画に続く
「登録URLが最新の公式サイトでない」系の3件目。

### 対応

- `demo_buyout_leads.csv`: 藤川建設を `status=paused` に戻し、notes に現行URLと差分を記載
  （デモ自体は `works/fujikawa-kensetsu/` に残っているが未送信・未queued）
- 送るかどうか・訴求の組み替えはオーナー判断待ち

### 恒久対策（未解決・要対応）

- **`verify-official-site.mjs` の `ANTHROPIC_API_KEY` を直すか、この手順自体を廃止して
  「実HPを自分でブラウザで開いて確認する」を明文化必須の手順にする。** 現状はローカルでも
  Actions 経由でも実質使えない状態が続いている。次にこの種の見落としが起きる前に決める

---

## 2026-09-10: 中武建設/マゴメ工務店へフォロー2重送信・笠原工務店/城南組が枠超過送信（2026-09-04と同型の再発）

### 起きたこと

エージェント（Claude Code）が短時間に連続で push した（swap-prospect.mjsのバグ修正 → 山﨑建設デモの追加、共に `buyout-ops/**` `works/**` 配下）ことで `buyout-daily-send.yml` が2本連続で起動した。

| # | 内容 |
|---|---|
| 1 | 1本目のrunが 高柳組・松本建設（初回）、中武建設・マゴメ工務店（フォロー）を送信し、CSVをmark-sent commit・push成功 |
| 2 | 2本目のrunは concurrency で1本目のあとに開始されたが、checkoutしたローカルの `demo_buyout_leads.csv`（枠計算に使う）が1本目のpush前の古いスナップショットのままだった |
| 3 | 2本目は「同一アドレスへの再送」はV18で正しく防いだ（高柳組・松本建設はスキップ）が、**枠が余っていると誤認**し、笠原工務店・城南組へ追加で初回送信、中武建設・マゴメ工務店へ**2通目のフォロー**を送信 |
| 4 | 2本目自身のmark-sent commitはpushでコンフリクトし8回リトライ後にjob失敗。**笠原工務店・城南組の送信実績がCSV/receiptsのどこにも記録されず**、翌日また送信される寸前だった |

2026-09-04（有限会社佐藤工務店）と**根本原因が同一**。当時の恒久対策（receipt即時追記・Actionsキャッシュ・push8回リトライ）は「記録の取りこぼしを減らす」層であって、**枠計算そのものを最新化する層が無かった**ため再発した。

### 恒久対策（今回追加した層）

| 層 | 内容 |
|---|---|
| **fetch** | `buyout-daily-send.yml` に「送信直前に `git fetch && git reset --hard origin/main`」を追加。checkoutが古くても送信直前に必ず最新化する |
| **事後復旧** | 笠原工務店・城南組をCSV上 `status=sent` に、4件の実送信（笠原・城南組・フォロー2通）を `send-receipts.jsonl` に手動で追記し、実態と記録を一致させた |
| **運用** | エージェント側の教訓として `CLAUDE.md`「push の作法」に、`demo_buyout_leads.csv`/`buyout-prospects/**`/`works/**` への連続pushを避ける旨を明記 |

先方へのお詫びメールは不要（オーナー判断・2026-09-10）。

---

## 2026-09-04: 有限会社佐藤工務店へ同一本文を2通送信

### 起きたこと

| # | 時刻 (JST) | 経路 | messageId |
|---|---|---|---|
| 1 | 09:12 | push「Queue 有限会社佐藤工務店」が `buyout-daily-send.yml` を起動 | `<d505583d-c006-513d-168b-d70fbcfa25f4@calcite-mail.jp>` |
| 2 | 14:17 | スケジュール catch-up | `<34380283-362d-83dd-307b-05d4b594a4f5@calcite-mail.jp>` |

1通目のあと workflow は CSV を `sent` にして commit したが、同時刻の「Queue 高嶋材木店」push で `main` が進んでおり **`git push` が non-fast-forward で失敗**。CSV は origin 上 `queued` のまま残った。14:17 はそれを未送信と見て再送した。宛先は `info@bluemoon-s.com`。本文は同一（デモURLも同じ）。

concurrency はジョブ実行を直列化していたが、**SMTP成功後の mark-sent が origin に乗らなければ次枠が再送する**。`remaining_today` も CSV の `sent_at` 依存なので、1通目は枠消費に数えられなかった。

### 恒久対策

| 層 | 内容 |
|---|---|
| **receipt** | SMTP 成功直後に `send-receipts.jsonl` へ追記。CSV の status が遅れても同一アドレスは再送しない（V18 / `isAlreadyOutreached` / `send-outreach-smtp`） |
| **cache** | Actions cache に `.send-receipts-cache.jsonl` を残す。mark-sent push が落ちても次ランが復元できる |
| **push** | mark-sent は `git pull --rebase` を最大8回リトライ。それでも失敗なら job を FAIL（メールは送済み・receipt で再送阻止） |

先方へのお詫びメールはオーナー判断。自動では送らない。

---

## 2026-09-03: 当日2通が2通ともハードバウンス（送信前の宛先実在確認なし）

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | buyout 黒田工務店 `kurota-koumuten@hb.tp1.jp` → `550 5.1.1 User Unknown` | 当日 buyout 1/1 が不達 |
| 2 | inside 鐵舟株式会社 `m.koga@tessyu.jp` → 同じくハードバウンス | 当日 inside 1/1 が不達 |
| 3 | **当日 2通 / ハードバウンス 2通 = バウンス率 100%** | 続けると SendGrid のドメイン評価が落ちる（トライアル 〜2026-10-29） |

ドメインは実在し、アドレスも公開HTMLから拾った本物の表記。受信箱だけが消滅していたため、
記入例アドレスを弾く `isValidPublicEmail`（V16）では原理的に防げない。

### 恒久対策

| 層 | 内容 |
|---|---|
| **モジュール** | `verify-recipient.mjs` — MX 解決 → SMTP `RCPT TO` プローブ。`DATA` は送らないので配送は発生しない |
| **送信前** | `verify-before-send.mjs` **V17**（queued/built のみ）。`dead`→FAIL／`unknown`→警告で通す／`ok`→PASS |
| **棚卸し** | `audit-recipients.mjs` — 既存リードを一括検証し、dead だけ送信プールから外す |
| **事後** | `sync-sendgrid-bounces.mjs`（前節）は継続。V17 は事前、こちらは事後で二重化 |

### 3値判定と限界（過信禁止）

- `dead` は **明確な恒久拒否だけ**。`5.1.1` / user unknown 系の 5xx、または MX も A も無い NXDOMAIN。
- `unknown` は **送ってよい**。25番ブロック・タイムアウト・4xx グレイリスト・catch-all・判別不能な 5xx。
- catch-all はランダムなローカルパートを同時に `RCPT` して検知する。検知したら `ok` ではなく `unknown`。
- 5xx でも spam / policy / relay / 5.7.x は宛先不在ではないので `unknown` に落とす。
- **オーナー環境は outbound 25 が Google 以外ほぼ落ちる**（ConoHa・ロリポップ・さくら等すべてタイムアウト）。
  GitHub Actions（Azure）も 25 は塞がれているため、`GITHUB_ACTIONS=true` では V17 を自動スキップして警告に降格する
  （日次送信を止めない）。つまり V17 が実際に効くのは **Google Workspace / Gmail 宛など一部だけ**。

### 棚卸し結果（2026-09-04 実施）

| トラック | 検査 | ok | dead | unknown |
|---|---|---|---|---|
| buyout（approved/queued/built） | 65 | 2 | 0 | 63 |
| inside（approved） | 150 | 17 | 5 | 128 |

dead 5件は inside 慣習どおり `status=opt_out` + `prior_outreach_blocklist.csv` 追記で送信プールから除外。
行は消さない（消すと再スキャンで同じアドレスが新規として復活するため）。

---

## 2026-09-03: SendGrid のバウンスが CSV に反映されない

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | 黒田工務店（`kurota-koumuten@hb.tp1.jp`）へ送信 → 即 `550 5.1.1 User Unknown` でハードバウンス | 宛先不通。CSV は `sent` のまま |
| 2 | SendGrid 送信では DSN が SendGrid の return-path に返るため、**ConoHa 受信箱に DSN が来ない** | IMAP を見る `inbox-process.mjs` はバウンス0件と判定 |
| 3 | 同日インサイドの鐵舟株式会社（`m.koga@tessyu.jp`）も同じくハードバウンス。誰も気づいていなかった | 当日 4通中 1通不通（bounce率が見えない） |

### 恒久対策

| 層 | 内容 |
|---|---|
| **同期** | `sync-sendgrid-bounces.mjs` を追加。SendGrid の抑制リストを CSV に反映（buyout→`paused`／inside→`opt_out`＋blocklist）。冪等 |
| **自動化** | `buyout-daily-send.yml` の送信後に実行し、`prior_outreach_blocklist.csv` も commit 対象に追加 |
| **列落ち** | `serializeCsv` は headers に無い列を黙って捨てるため、`setField` で警告を出す（`skippedFields`） |

~~未解決: 公開HTMLから拾ったアドレスでも**受信箱が消滅している**ことがある。送信前の宛先実在確認（MX＋SMTP RCPT 検証など）は未導入。~~
**解決（2026-09-04）**: `verify-recipient.mjs` + `verify-before-send.mjs` V17 を導入。前節参照。ただし 25番が塞がれた環境では `unknown` に落ちるため、事後同期（本節）は引き続き必須。

---

## 2026-09-03: skin_pair を存在しない列名に書いて黙って消えた

`demo_buyout_leads.csv` の列は `skin_pair` だが `skins` に代入したため、`serializeCsv` が黙って捨てて空のまま送信された（メール本文のURLは正しく、実害なし）。`verify-ops-pack.mjs` O10 に「queued/built で demo URL があるのに `skin_pair` が空なら FAIL」を追加。

---

## 2026-09-03: 再診行の「粗残:」を G1 判定が読めず送信ゲートで停止

`site-g1-eval.mjs` が `粗:` しか見ておらず、再診で書かれる `粗残:(1)(2)(3)` を0点と判定していた（該当3社が無言でブロック）。`粗(残置)?:` を許容するよう修正。

---

## 2026-09-03: フォーム記入例メールが承認キューに混入

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | スキャンが問い合わせフォームの**記入例アドレス**（`yourmail@sample.co.jp` / `aaa@bbb.jp` / `nishikawa@abcd.com` 等）を先方メールとして拾った | 買い取り5社・インサイド35社が実在しない宛先で `approved` に |
| 2 | `isValidPublicEmail` の除外パターンが `sample@` `your@` など**ローカル部だけ**を見ており、`@sample.co.jp` 等の**記入例ドメイン**を素通し | 検証をすり抜けた |
| 3 | `import-review-approvals.mjs` にメール検証が無く、`owner_ok=y` の一括承認でそのまま採用 | レビューの網も無し |

`sample.co.jp` `domain.com` `abc.com` 等は**実在する他人のドメイン**。送っていれば無関係の第三者への誤送信だった。

### 恒久対策

| 層 | 内容 |
|---|---|
| **判定** | `campaign-score.mjs` に `PLACEHOLDER_DOMAIN` / `PLACEHOLDER_LOCAL` を追加。記入例ドメインと `abc@` `yourname@` `t_yamada@` 等のローカル部を無効化 |
| **入口** | `prepare-review-sheet.mjs` が無効メールをレビューシートに載せない |
| **承認** | `import-review-approvals.mjs` が無効メールを SKIP |
| **送信前** | `verify-before-send.mjs` V16 で無効メールは FAIL |
| **データ** | 該当40行を削除、レビューキューは `owner_ok=n`（送信済み履歴は残す） |

---

## 2026-09-03: メール本文のデモURLを短縮URLに変えかけた（未送信で発見）

### 起きたこと

`outreach-domain-site/README.md` の冒頭に「メールには GitHub Pages ではなく `calcite-mail.jp/demo/{slug}/{skin}/` を載せる」という**旧方式の記述が残っており**、同じファイルの下部にある現行方針（GitHub Pages 直URL＋SendGrid 追跡）と矛盾していた。これを読んで `render-outreach-email.mjs` を短縮URLに変更。オーナー指摘で送信前に revert。

### 恒久対策

| 層 | 内容 |
|---|---|
| **docs** | README を現行方式のみに書き換え（旧方式は「やらないこと」として明記） |
| **コード** | `canonical-url.mjs` の `publicDemoUrl` に「メール本文に使わない」と明記 |
| **送信前** | `send-outreach-smtp.mjs` が本文に `calcite-mail.jp/demo/` を含む／GitHub Pages URL を含まない場合は FAIL |

---

## 2026-08-31: 10:00 Actions が未実行 — 営業メール0通

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | 8/31 10:00 JST 時点で `Buyout daily send` の schedule 実行が **0件**（GitHub API 確認） | 当日枠2通が未送信 |
| 2 | 過去4日の schedule も **01:00 UTC（10:00 JST）で一度も成功していない**。05:57〜12:18 UTC の1回/日のみ | 実質「午後 slot のみ」依存 |
| 3 | `origin/main` には田代・髙須が **queued + デモURLあり**（sendable=2）だったが送信 workflow が走らなかった | git 遅れではなく **未送信** |
| 4 | 8/30 夜〜8/31 未明に `buyout-daily-send.yml` を複数回変更（2通/日・SendGrid 配線） | public repo の schedule 不安定化要因の一つ |

### 根本原因

- **GitHub Actions schedule の信頼性**（public repo で 01:00 UTC がスキップされがち）
- **9:00 デモ push → 10:00 送信** の連携が schedule のみで、push トリガーがなかった

### 恒久対策

| 層 | 内容 |
|---|---|
| **workflow** | `buyout-daily-send.yml` に **push trigger**（`demo_buyout_leads.csv` / `buyout-prospects/**`）＋ 02–04 UTC バックアップ cron |
| **冪等** | `remaining_today=0` / sendable=0 なら skip（push 連鎖でも二重送信しない） |
| **運用** | 取りこぼし時は `workflow_dispatch` で手動実行 |

---

## 2026-08-25〜26: 9:00 が Draft PR で止まり 10:00 が送れない（連続）

### 起きたこと

| # | 日付 | 内容 | 影響 |
|---|---|---|---|
| 1 | 8/25 | 9:00 がビルドテクトを制作したが [PR #6](https://github.com/calcite-ai/calcite-demos/pull/6) で停止（main 未反映） | Pages 404 → 10:00 送信不可。夜に手動マージ＋送信 |
| 2 | 8/26 | 同経路で基工務店を [PR #7](https://github.com/calcite-ai/calcite-demos/pull/7)（Draft）に作成。本文に「マージして」と書きつつ PR のまま終了 | 再び `sendable=0`。夕方にマージ後も `user-gmail` `invalid_grant` で自動送信不可 |
| 3 | 8/25 夜 | docs に「Draft PR 禁止・main 直 push」を追記（`ed9e5f2`） | **リポジトリ内プロンプトだけでは足りない**。Automation UI / クラウド既定が PR 作成を優先 |

### 根本原因

- 10:00 の不具合ではなく、**9:00 の公開経路が `main` でない**こと
- Cursor Automation は変更を **Draft PR にする既定**があり、repo の禁止文より強い

### 恒久対策

| 層 | 内容 |
|---|---|
| **Automation UI** | 9:00「Demo buyout queue refill」(`3e92e8d0-9e28-11f1-a7d1-d6b4613131ce`) を開き、**PR を作らず main へ直接 commit/push** する設定・プロンプトにする（docs 更新だけでは再発する） |
| **エージェント** | exit 3 のあと `verify-before-send` が Pages 200 になるまで終了しない。PR URL を出したら失敗扱い |
| **10:00** | `sendable=0` のとき「9:00 が main 未反映かも」を notes / ログに残す |
| **送信** | buyout は `user-gmail` `send_email` + text/plain。`invalid_grant` なら送らず再認証（plugin-gmail で初回を送らない） |

---

## 2026-08-25: plugin-gmail 送信で再び「リダイレクトの警告」

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | ビルドテクト初回を `plugin-gmail-gmail` の `send_message` で送信 | MIME が `multipart/alternative`（text/html 付き）になった |
| 2 | 送信時点の text/plain 本文に既に `https://www.google.com/url?q=…` が入っていた | クリックで「リダイレクトの警告」 |

### 恒久対策

| 層 | 内容 |
|---|---|
| **送信経路** | buyout 初回は **`user-gmail` の `send_email` + `mimeType=text/plain` のみ**（`htmlBody` 禁止） |
| **禁止** | `plugin-gmail-gmail` / `send_message` で初回営業を送らない（URLラップする） |
| **確認** | 送信直後に RAW MIME を見て `google.com/url` と `text/html` が無いこと |

---

## 2026-08-24: メールリンクが「リダイレクトの警告」経由


### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | 送信本文に `https://www.google.com/url?q=…` が入った／Gmail閲覧でラップ | クリックすると「リダイレクトの警告」→もう一回タップ |
| 2 | 公式URLが `https://calcite-ai.jp`（wwwなし） | WordPressが `https://www.calcite-ai.jp/` へ301 → 警告が出やすい |
| 3 | デモURL末尾スラッシュ欠落 | GitHub Pages が 301 → 同上 |

### 恒久対策

| 層 | 内容 |
|---|---|
| **テンプレ** | `Web：https://www.calcite-ai.jp/`（apex禁止） |
| **送信** | `render-outreach-email.mjs` → **text/plain のみ**（htmlBody禁止） |
| **禁止** | 本文に `google.com/url` を貼らない（Gmail APIの取得結果をコピペしない） |
| **ゲート** | O12 / V8 / V14（apex・ラップURL・デモURLの301） |

---

## 2026-08-23: 新しいサイトへの buyout キュー投入（石川工務店）

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | [waraku-i.com](https://www.waraku-i.com/) を Hunter 対象に **queued** | HTTPS・viewport・tel:・2025更新 — buyout 訴求が刺さらない |
| 2 | G1 は docs 上必須だが **スクリプト未実装** | verify(V1〜V12)はデモ側のみ → PASS |
| 3 | `sendable=1` 優先で弱い粗を後付け | オーナー指摘まで気づかず |

### 恒久対策（必須ゲート）

| 層 | スクリプト | いつ |
|---|---|---|
| **Hunter前** | `verify-hunter-g1.mjs --prospect-company` | suggest 候補の queued 前 |
| **suggest** | `hunter-suggest.mjs`（G1 オン） | モダンサイトを候補から除外 |
| **昇格** | `promote-paused.mjs` 内 G1 | paused→queued |
| **送信前** | `verify-before-send.mjs` **V13** | サイト再取得 + audit_notes |
| **CI** | `verify-hunter-g1.mjs --from-csv --queued` | main に queued がある push |

### モダン除外ルール（機械）

`site-g1-eval.mjs`: **HTTPS + viewport + tel: + HTML内更新年≥2023** → G1 FAIL（Hunter§5）

---

## 2026-08-22: 旧価格送信 + デモ中間ページ

### 起きたこと

| # | 内容 | 影響 |
|---|---|---|
| 1 | v1.1（66,000円）テンプレが **main に未push** のまま Automation が送信 | 日南ほか3社に55,000円表記 |
| 2 | デモに **「← デモ案一覧」** と slug 直下の **選択ページ** が残存 | リンク先が中間画面経由に見える |

### 恒久対策（必須ゲート）

| 層 | スクリプト / ルール | いつ |
|---|---|---|
| **送信前** | `verify-ops-pack.mjs` → `verify-before-send.mjs` | 毎送信・Automation 直前 |
| **返信前** | `verify-inbox-reply.mjs` | checkout / followup を送る前 |
| **CI** | `.github/workflows/buyout-gates.yml` | main push / PR |
| **旧価格3社** | CSV `quoted_price=55000` + `demo_buyout_inbox.md` | 返信時66k決済禁止 |
| **公開** | `publish-prospect.mjs` が picker 削除 + index 非公開 | swap 後毎回 |

### Automation 手順（順番固定）

1. `git pull origin main`
2. テンプレ・デモを変えたら **先に commit & push**（送信より前）
3. `node buyout-ops/verify-ops-pack.mjs` → PASS
4. `node buyout-ops/verify-hunter-g1.mjs --from-csv --company "…"` → PASS（G1）
5. `node buyout-ops/verify-before-send.mjs --from-csv --company "…"` → PASS
6. 公開URLが **200** かつ picker なしを確認（V1/V7）
7. 送信 → CSV 更新 → push

**verify が FAIL なら送らない。** オーナー確認なし運用でもこのゲートは省略不可。

### チェック ID 早見

| ID | 防ぐミス |
|---|---|
| V6/O5 | 公開HTML・デモに旧価格 |
| V7/O4 | デモ案一覧・picker |
| V8/O2 | 初回メールテンプレ旧価格 |
| V9/O7 | queued が 66k 以外 |
| V10/O3 | 中間 index.html 残存 |
| O8 | GitHub main 上のテンプレが旧版 |
| I2 | 旧価格コホートへの66k checkout |
| V13 | G1 モダンサイト除外 / audit 粗不足 |
| V16 | フォーム記入例アドレス（`yourmail@sample.co.jp` など） |
| V17 | 宛先メールボックスが実在しない（`dead` のみ FAIL・`unknown` は警告） |

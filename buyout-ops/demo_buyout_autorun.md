# デモ買い取り — 自動営業オペ

> 2026-08-23 運用: **リスト承認は人間1回**（[`demo_buyout_owner_workflow.md`](./demo_buyout_owner_workflow.md)）。承認後の **送信は自動**（文面確認なし）。  
> 送信元: `hello@calcite-ai.jp`（ConoHa SMTP / GitHub Secrets `BUYOUT_SMTP_*`）  
> レート: **`send-quota.csv` の当日枠**（初期は1日1通。途中から行を足して通数変更）。スパム回避優先。  
> **Phase 1: 工務店（vertical=koumuten）のみ送信。** 税理士・葬儀は雛形完成まで送らない。  
> 稼働:  
> - **9:00 JST** Cursor Automation デモ制作 → [`demo_buyout_daily_schedule.md`](./demo_buyout_daily_schedule.md)（**main 直 push**）  
> - **10:00 JST** **GitHub Actions** [`buyout-daily-send.yml`](../.github/workflows/buyout-daily-send.yml) が残枠ぶん SMTP text/plain 送信  
> このフォルダ（`buyout-ops/`）が正本。

## PCスリープについて

| 方式 | Macスリープ | 備考 |
|---|---|---|
| **GitHub Actions（10:00 送信）** | **スリープOK** | 推奨。SMTP Secrets 必須 |
| **Cursor Automation（9:00 デモ）** | **スリープOK** | Draft PR 禁止・Open PR ツール削除 |
| セッション内ループ | しない方がよい | 予備 |

## エージェントへの指示（毎回）

0. **`git pull origin main`**
1. `node buyout-ops/queue-status.mjs` → **remaining_today=0 または sendable=0 なら送信せず終了**
2. このリポジトリの `buyout-ops/demo_buyout_leads.csv` を開く
3. `queue-status` の **next_send を残枠ぶん**、`approval_seq` 昇順に1社ずつ送る
4. Gmail で `to:{email} from:me` を再確認（過去送信があれば `paused`）
5. **送信直前:** G1の C0〜C2（正規サイト・HTTPS最終到達・tel:）を再確認。課題は audit_notes からのみ（`demo_buyout_audit_checklist.md` / `demo_buyout_hunter.md`）
6. デモ未公開なら `buyout-template/designs/swap-prospect.mjs` → `publish-prospect.mjs` → **buyout-prospects を main へ直接 push（Draft PR 禁止）**
7. **テンプレ・verify スクリプトを変えたら、送信より先に push**（2026-08-22 旧価格事故）
8. **公開URLが HTTP 200 になるまで送らない**（404のままURLを書かない。2026-08-21 福澤で再発。**2026-08-25/26: PR未マージで Pages 404 → 送信不可。9:00 は main 直 push 必須**）
9. **送信前ゲート必須（順番固定）:**  
   `node buyout-ops/verify-ops-pack.mjs`  
   `node buyout-ops/verify-hunter-g1.mjs --from-csv --company "<社名>"`（queued 行の G1 再確認）  
   `node buyout-ops/verify-before-send.mjs --from-csv --company "<社名>"`  
   どれか FAIL → **送らない**（[`demo_buyout_incidents.md`](./demo_buyout_incidents.md)）
10. `node buyout-ops/render-outreach-email.mjs --company "<社名>"` で本文を生成し、**その text/plain をそのまま送信**（確認不要）。From: hello@calcite-ai.jp  
    ※**htmlBody は渡さない**（Gmailが google.com/url に包むと「リダイレクトの警告」になる）  
    ※デモURLは CSV の demo_url_a/b と同一（末尾 `/` 必須。`google.com/url` を貼らない）  
    ※公式サイトは `https://www.calcite-ai.jp/`（apex `calcite-ai.jp` は www へ301するため警告が出る）  
    ※送信本文に **66,000円** が含まれることを目視1行確認（ゲート V8 の二重チェック）
11. CSV を `sent` に更新、notes に日付と message id。変更は commit & push
12. 1社送ったら CSV を push し、`node buyout-ops/send-quota.mjs` で **remaining=0 になるまで** 3〜11を繰り返す。残枠0で止まる

### 送れなかったときの差し替え（failover）

| 失敗種別 | 動き |
|---|---|
| 受信者エラー（mailbox full / user unknown 等） | その社を `paused` → **同日に次の sendable へ**（枠は成功通数のみ消費） |
| 遅延バウンス（IMAP） | 同上。inbox が `paused` にしたあと残枠があれば同ジョブで再送 |
| **スパム / 認証 / 不明** | **即停止**。次社へは送らない（リストを食い潰さない） |
| **国外IP制限（geo）** | **即停止**。ConoHa が Actions（米国IP）を拒否。`国外IP制限` を OFF にして再実行 |
| verify 失敗・一時エラー | その社はキューに残し、次社を試す |

上限: 1回の実行で試行は **残枠+2（最大5）**。当日枠（`send-quota.csv`）を超えて成功送信しない。  
→ スパム扱いで拒否されても **永遠には送らない**。

## 返信処理（Inbox）

- 返信分類・テンプレ対応: [`demo_buyout_inbox.md`](./demo_buyout_inbox.md)
- **旧価格コホート（新見・福澤・日南）:** `quoted_price=55000` → **66,000円決済メール禁止**。購入希望はオーナーへ。
- checkout / followup 送信前: `node buyout-ops/verify-inbox-reply.mjs --company "…" --template checkout`
## キュー優先

1. オーナー承認済 `queued`（**approval_seq 昇順**・デモURL入り）
2. レガシー `queued` / `built`（approval_seq なしは後ろ）
3. 9:00 が `approved` → デモ制作（**承認リスト外の Hunter 禁止**）

## 除外（再送しない）

- `do_not_contact=true` / `paused` / `sent`（フォロー待ちは別）
- **`prior_outreach_blocklist.csv` に載る先**（個人Gmail・hello@ 含む過去デモ営業済み。工務店・葬儀・士業すべて）
- Gmail に過去のデモ営業がある先（`hello@` のみ見ても **kenta.hino1106@gmail.com 送信は blocklist で補完**）
- 推測メール

過去営業の追加: Gmail 実績確認 → `prior_outreach_blocklist.csv` に1行追加 → `sales_prospects.csv` 備考に「営業メール送信済→buyout再送禁止」

## 送信キュー（2026-08-20 時点）

| 順 | 先 | 予定 |
|---|---|---|
| 済 | 新見工務店 | 2026-08-20 送信済 |
| SKIP | マキノ／ダンデ等 | 新公式あり（C0） |
| 1 | 福澤工務店 | qualified → クラウド実行でデモ公開→送信 |
| 2 | 日南工務店 | qualified → 同上 |
| 稼働 | Cursor Automation「Demo buyout daily send」 | **Active** / 毎日 10:00 JST / Gmail接続済 |
| 予備 | ローカルループ | **停止済**（二重送信防止 2026-08-20） |

診断ミス防止: [`demo_buyout_audit_checklist.md`](./demo_buyout_audit_checklist.md) / Hunter G1 C0〜C5。  
**送信前ゲート:** [`demo_buyout_pre_send_checklist.md`](./demo_buyout_pre_send_checklist.md) + `verify-before-send.mjs`

文面確認は不要（オーナー指示 2026-08-20）。

## フォロー

- 初回から4〜6日後・未返信のみ `email_demo_buyout_5_followup.txt`
- 1先あたりフォロー最大1通

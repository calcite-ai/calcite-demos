# デモ買い取り — 自動営業オペ（確認なし）

> 2026-08-20 オーナー指示: 文面確認なしで回す。  
> 送信元: `hello@calcite-ai.jp`  
> レート: **1日1通**（週最大5）。スパム回避優先。  
> 稼働: Cursor Automation（クラウド・毎日10:00 JST目安）を優先。ローカルループは予備。  
> このフォルダ（`buyout-ops/`）がクラウドエージェント用の正本。

## PCスリープについて

| 方式 | Macスリープ | 備考 |
|---|---|---|
| **Cursor Automation（クラウド）** | **スリープOK** | 推奨。PC不要で時刻実行 |
| セッション内ループ | しない方がよい | 予備。このチャットが生きている必要あり |

## エージェントへの指示（毎回）

1. このリポジトリの `buyout-ops/demo_buyout_leads.csv` を開く
2. `status=queued` の最古1件を取る（なければ Hunter で補充）
3. Gmail で `to:{email} from:me` を再確認（過去送信があれば `paused`）
4. **送信直前:** G1の C0〜C2（正規サイト・HTTPS最終到達・tel:）を再確認。課題は audit_notes からのみ（`demo_buyout_audit_checklist.md` / `demo_buyout_hunter.md`）
5. デモ未公開なら `buyout-template/designs/swap-prospect.mjs` → `publish-prospect.mjs` → **buyout-prospects のみ push**
6. `templates/email_demo_buyout_1_initial.txt` で送信（確認不要）。From: hello@calcite-ai.jp
7. CSV を `sent` に更新、notes に日付と message id。変更は commit & push
8. **今日分が終わったら止まる**（同日2通目は送らない）
## キュー優先

1. `queued`（デモURL入り）
2. `built`（公開済・未送信）
3. Hunter で新規 `qualified` → 制作

## 除外（再送しない）

- `do_not_contact=true` / `paused` / `sent`（フォロー待ちは別）
- Gmail に過去のデモ営業がある先
- 推測メール

## 送信キュー（2026-08-20 時点）

| 順 | 先 | 予定 |
|---|---|---|
| 済 | 新見工務店 | 2026-08-20 送信済 |
| SKIP | マキノ／ダンデ等 | 新公式あり（C0） |
| 1 | 福澤工務店 | qualified → デモ公開後に送信 |
| 2 | 日南工務店 | qualified → デモ公開後に送信 |
| 次 | Hunter補充 | 工務店・G1 C0〜C5通過のみ |

診断ミス防止: [`demo_buyout_audit_checklist.md`](./demo_buyout_audit_checklist.md) / Hunter G1 C0〜C5。

文面確認は不要（オーナー指示 2026-08-20）。

## フォロー

- 初回から4〜6日後・未返信のみ `email_demo_buyout_5_followup.txt`
- 1先あたりフォロー最大1通

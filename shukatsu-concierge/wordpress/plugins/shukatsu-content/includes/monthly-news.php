<?php
/**
 * ニュースコラム：毎月1日 10:00（サイトTZ）に情報収集→生成→自動公開
 *
 * 例外: 通常コラムは人間承認必須。ニュースカテゴリのみ自動 publish を許可。
 * 生成ルールは /ops/ コラム下書きと同じ（SEO/GEO・一次情報・断定抑制・Web検索）。
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

const SHUKATSU_MONTHLY_NEWS_HOOK = 'shukatsu_monthly_news_publish';
const SHUKATSU_MONTHLY_NEWS_OPTION_LAST = 'shukatsu_monthly_news_last_ym';
const SHUKATSU_MONTHLY_NEWS_OPTION_LOG = 'shukatsu_monthly_news_last_log';
const SHUKATSU_MONTHLY_NEWS_OPTION_TOKEN = 'shukatsu_monthly_news_cron_token';

add_action('init', 'shukatsu_monthly_news_ensure_schedule', 30);
add_action(SHUKATSU_MONTHLY_NEWS_HOOK, 'shukatsu_monthly_news_run');
add_action('rest_api_init', 'shukatsu_monthly_news_register_rest');
add_action('admin_post_shukatsu_monthly_news_run_now', 'shukatsu_monthly_news_admin_run_now');

/**
 * 次の「毎月1日 10:00」（wp_timezone）を単発スケジュール。
 */
function shukatsu_monthly_news_ensure_schedule(): void {
	if (wp_next_scheduled(SHUKATSU_MONTHLY_NEWS_HOOK)) {
		return;
	}
	$ts = shukatsu_monthly_news_next_timestamp();
	if ($ts > 0) {
		wp_schedule_single_event($ts, SHUKATSU_MONTHLY_NEWS_HOOK);
	}
}

/**
 * @return int Unix timestamp（サイトTZの次の1日10:00）
 */
function shukatsu_monthly_news_next_timestamp(): int {
	try {
		$tz  = wp_timezone();
		$now = new DateTimeImmutable('now', $tz);
		$candidate = $now->modify('first day of this month')->setTime(10, 0, 0);
		if ($candidate <= $now) {
			$candidate = $now->modify('first day of next month')->setTime(10, 0, 0);
		}
		return $candidate->getTimestamp();
	} catch (Exception $e) {
		return time() + MONTH_IN_SECONDS;
	}
}

function shukatsu_monthly_news_reschedule(): void {
	$existing = wp_next_scheduled(SHUKATSU_MONTHLY_NEWS_HOOK);
	if ($existing) {
		wp_unschedule_event($existing, SHUKATSU_MONTHLY_NEWS_HOOK);
	}
	$ts = shukatsu_monthly_news_next_timestamp();
	if ($ts > 0) {
		wp_schedule_single_event($ts, SHUKATSU_MONTHLY_NEWS_HOOK);
	}
}

function shukatsu_monthly_news_cron_token(): string {
	if (defined('SHUKATSU_NEWS_CRON_TOKEN') && is_string(SHUKATSU_NEWS_CRON_TOKEN) && SHUKATSU_NEWS_CRON_TOKEN !== '') {
		return trim(SHUKATSU_NEWS_CRON_TOKEN);
	}
	$token = (string) get_option(SHUKATSU_MONTHLY_NEWS_OPTION_TOKEN, '');
	if ($token === '') {
		$token = wp_generate_password(32, false, false);
		update_option(SHUKATSU_MONTHLY_NEWS_OPTION_TOKEN, $token, false);
	}
	return $token;
}

function shukatsu_monthly_news_register_rest(): void {
	register_rest_route('shukatsu/v1', '/monthly-news/run', [
		'methods'             => 'POST',
		'callback'            => 'shukatsu_monthly_news_rest_run',
		'permission_callback' => 'shukatsu_monthly_news_rest_permission',
	]);
}

/**
 * @param WP_REST_Request $request
 */
function shukatsu_monthly_news_rest_permission($request): bool {
	$expected = shukatsu_monthly_news_cron_token();
	if ($expected === '') {
		return false;
	}
	$header = trim((string) $request->get_header('x-shukatsu-cron-token'));
	$query  = trim((string) $request->get_param('token'));
	$got    = $header !== '' ? $header : $query;
	return $got !== '' && hash_equals($expected, $got);
}

/**
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function shukatsu_monthly_news_rest_run($request) {
	$force = (bool) $request->get_param('force');
	$result = shukatsu_monthly_news_run($force);
	$status = !empty($result['ok']) ? 200 : 500;
	return new WP_REST_Response($result, $status);
}

function shukatsu_monthly_news_admin_run_now(): void {
	if (!current_user_can('manage_options')) {
		wp_die('Forbidden', 403);
	}
	check_admin_referer('shukatsu_monthly_news_run_now');
	$force = !empty($_GET['force']);
	$result = shukatsu_monthly_news_run($force);
	$msg = !empty($result['message']) ? (string) $result['message'] : '実行しました';
	wp_safe_redirect(add_query_arg([
		'page'                => 'shukatsu-content',
		'shukatsu_news_flash' => rawurlencode($msg),
	], admin_url('options-general.php')));
	exit;
}

/**
 * @param bool $force 同月の二重実行を許可
 * @return array{ok:bool,message:string,post_id?:int,status?:string,skipped?:bool}
 */
function shukatsu_monthly_news_run(bool $force = false): array {
	$ym = wp_date('Y-m');
	$last = (string) get_option(SHUKATSU_MONTHLY_NEWS_OPTION_LAST, '');
	if (!$force && $last === $ym) {
		$log = [
			'ok'      => true,
			'skipped' => true,
			'message' => "今月（{$ym}）はすでにニュース自動公開を実行済みです。",
			'at'      => wp_date('c'),
		];
		update_option(SHUKATSU_MONTHLY_NEWS_OPTION_LOG, $log, false);
		shukatsu_monthly_news_reschedule();
		return $log;
	}

	if (shukatsu_ops_claude_api_key() === '') {
		$log = [
			'ok'      => false,
			'message' => 'Anthropic APIキー未設定のためニュース自動公開をスキップしました。',
			'at'      => wp_date('c'),
		];
		update_option(SHUKATSU_MONTHLY_NEWS_OPTION_LOG, $log, false);
		shukatsu_monthly_news_reschedule();
		return $log;
	}

	$result = shukatsu_monthly_news_compose_and_publish();
	$result['at'] = wp_date('c');
	$result['ym'] = $ym;

	if (!empty($result['ok']) && empty($result['skipped'])) {
		update_option(SHUKATSU_MONTHLY_NEWS_OPTION_LAST, $ym, false);
	}
	update_option(SHUKATSU_MONTHLY_NEWS_OPTION_LOG, $result, false);
	shukatsu_monthly_news_reschedule();

	return $result;
}

/**
 * ニュースカテゴリで1本生成。critical 以外は publish。
 *
 * @return array{ok:bool,message:string,post_id?:int,status?:string,verdict?:string}
 */
function shukatsu_monthly_news_compose_and_publish(): array {
	$tree = shukatsu_ops_column_topic_tree();
	$cat  = $tree['news'] ?? null;
	if (!$cat) {
		return ['ok' => false, 'message' => 'ニュースカテゴリ定義が見つかりません。'];
	}

	$topic_keys = ['guideline', 'survey', 'law-change'];
	$month = (int) wp_date('n');
	$topic_key = $topic_keys[($month - 1) % count($topic_keys)];
	$topic = $cat['children'][ $topic_key ] ?? reset($cat['children']);
	if (!$topic) {
		return ['ok' => false, 'message' => 'ニューステーマ定義が見つかりません。'];
	}

	$chars = (int) (shukatsu_ops_column_length_presets()['standard']['chars'] ?? 1500);
	$seeds = is_array($topic['seeds'] ?? null) ? $topic['seeds'] : [];
	// ニュース全体のシードも候補に足す
	foreach ($cat['children'] as $child) {
		if (!empty($child['seeds']) && is_array($child['seeds'])) {
			$seeds = array_merge($seeds, $child['seeds']);
		}
	}
	$seeds = array_values(array_unique($seeds));
	$seed_text = $seeds ? implode("\n", $seeds) : '（指定なし）';
	$today = wp_date('Y-m-d');
	$month_label = wp_date('Y年n月');

	$compose_prompt = <<<PROMPT
あなたは終活・身元保証サイト「終活コンシェルジュ」の**ニュースコラム**担当です。
必ず web_search で「いま時点（{$today}）の最新の公的情報・公式発表・報道」を調べてから書いてください。
制度改正・金額・手続きの変更があるテーマは、古い知識だけで書かないこと。

【今月の枠】
- 公開枠: {$month_label}のニュース整理（月1本）
- カテゴリ: {$cat['label']}
- テーマ候補のねらい: {$topic['label']} — {$topic['angle']}
- 本文目安: 約{$chars}字（タグ除く本文）

【執筆ルール（コラムと同じ・SEO/GEO）】
- 冒頭1〜2文で結論（検索・AIが引用しやすい）
- 「この記事で分かること」を箇条書き3〜5
- 見出しは検索意図の言い切り（h2）
- 一次情報（公式URL・公表日・調査名）を1つ以上。無いなら断定しない
- 制度・数値は原典確認。未確認は「〜とされる」「要確認」
- 個人情報・実在事例は出さない
- 煽り・他社誹謗・未検証の比較優位は禁止
- 団体の対応範囲・相談の進め方を1段落入れる
- 末尾に相談につながる一文（具体URLは付けない）

【優先ソース候補】
{$seed_text}

調査後、公開用の JSON オブジェクトだけ出力してください（説明文・コードフェンス不要）。

出力スキーマ:
{
  "title": "タイトル（40字前後。【ニュース】接頭辞は任意。煽り禁止）",
  "meta_description": "80〜120字の完結した文。結論先出し",
  "content": "本文HTML（冒頭結論・この記事で分かること・h2構成）",
  "source_urls": ["根拠にしたURL", "..."],
  "research_notes": "検索で得た要点の短いメモ（担当者向け・公開しない）",
  "news_summary": "今月取り上げたニュースを1文で"
}
PROMPT;

	$used_web_search = true;
	$compose_res = shukatsu_ops_claude_request([
		'max_tokens'  => 5000,
		'temperature' => 0.25,
		'tools'       => [shukatsu_ops_claude_web_search_tool()],
		'messages'    => [['role' => 'user', 'content' => $compose_prompt]],
	], 180);

	if (is_wp_error($compose_res)) {
		$used_web_search = false;
		$compose_res = shukatsu_ops_claude_request([
			'max_tokens'  => 4500,
			'temperature' => 0.3,
			'messages'    => [[
				'role'    => 'user',
				'content' => $compose_prompt . "\n\n※この環境ではWeb検索が使えません。指定ソースと一般知識の範囲で、断定を避けて書いてください。",
			]],
		], 150);
		if (is_wp_error($compose_res)) {
			return ['ok' => false, 'message' => '生成エラー: ' . $compose_res->get_error_message()];
		}
	}

	$parsed = shukatsu_ops_claude_parse_json_object(shukatsu_ops_claude_extract_text($compose_res));
	if (!is_array($parsed)) {
		return ['ok' => false, 'message' => '生成結果の解析に失敗しました。'];
	}

	$title = trim((string) ($parsed['title'] ?? ''));
	$meta = trim((string) ($parsed['meta_description'] ?? ''));
	$content = trim((string) ($parsed['content'] ?? ''));
	$research_notes = trim((string) ($parsed['research_notes'] ?? ''));
	$citation_urls = shukatsu_ops_claude_extract_citation_urls($compose_res);
	$source_urls = shukatsu_ops_normalize_urls(array_merge(
		(array) ($parsed['source_urls'] ?? []),
		$citation_urls,
		$seeds,
		shukatsu_ops_extract_urls_from_text($content)
	));

	if ($title === '' || $content === '') {
		return ['ok' => false, 'message' => 'タイトルまたは本文が空でした。'];
	}
	if (function_exists('shukatsu_content_clip_meta_description')) {
		$meta = shukatsu_content_clip_meta_description($meta !== '' ? $meta : $title);
	}

	// 再チェック
	$sources_for_review = $source_urls ? implode("\n", $source_urls) : '（なし）';
	$review_prompt = <<<PROMPT
あなたは終活サイトの公開前ファクトチェッカーです。下書きを厳しく点検し、JSONだけ返してください。
今日の日付: {$today}
可能なら web_search で最新の公的情報と突き合わせてください。

【テーマ】ニュース / {$topic['label']}
【タイトル】{$title}
【メタ】{$meta}
【本文HTML】
{$content}

【記載ソース】
{$sources_for_review}

【生成時メモ】
{$research_notes}

出力スキーマ:
{
  "verdict": "ok" | "needs_fix" | "critical",
  "summary": "担当者向けの短い総評",
  "issues": [{"severity":"high|medium|low","location":"該当箇所","detail":"問題","suggestion":"直し方"}],
  "checked_claims": [{"claim":"主張","status":"supported|unsupported|uncertain","note":"根拠メモ"}],
  "source_gaps": ["根拠が弱い点"]
}

判定目安:
- critical: 誤った制度説明・危険な断定・個人情報っぽい記述
- needs_fix: 古い可能性・曖昧・ソース不足
- ok: 大きな問題は見当たらない
PROMPT;

	$review = [
		'verdict'         => 'needs_fix',
		'summary'         => 'AI再チェックを実行できませんでした。',
		'issues'          => [],
		'checked_claims'  => [],
		'source_gaps'     => [],
		'used_web_search' => $used_web_search,
	];

	$review_res = shukatsu_ops_claude_request([
		'max_tokens'  => 2500,
		'temperature' => 0.1,
		'tools'       => [shukatsu_ops_claude_web_search_tool()],
		'messages'    => [['role' => 'user', 'content' => $review_prompt]],
	], 150);
	if (is_wp_error($review_res)) {
		$review_res = shukatsu_ops_claude_request([
			'max_tokens'  => 2200,
			'temperature' => 0.1,
			'messages'    => [['role' => 'user', 'content' => $review_prompt . "\n\n※Web検索なしで点検してください。"]],
		], 120);
	}
	if (!is_wp_error($review_res)) {
		$review_parsed = shukatsu_ops_claude_parse_json_object(shukatsu_ops_claude_extract_text($review_res));
		if (is_array($review_parsed)) {
			$verdict = (string) ($review_parsed['verdict'] ?? 'needs_fix');
			if (!in_array($verdict, ['ok', 'needs_fix', 'critical'], true)) {
				$verdict = 'needs_fix';
			}
			$review = [
				'verdict'         => $verdict,
				'summary'         => (string) ($review_parsed['summary'] ?? ''),
				'issues'          => is_array($review_parsed['issues'] ?? null) ? $review_parsed['issues'] : [],
				'checked_claims'  => is_array($review_parsed['checked_claims'] ?? null) ? $review_parsed['checked_claims'] : [],
				'source_gaps'     => is_array($review_parsed['source_gaps'] ?? null) ? $review_parsed['source_gaps'] : [],
				'used_web_search' => $used_web_search,
			];
			$more_urls = shukatsu_ops_claude_extract_citation_urls($review_res);
			if ($more_urls) {
				$source_urls = shukatsu_ops_normalize_urls(array_merge($source_urls, $more_urls));
			}
		}
	}

	$verdict = (string) ($review['verdict'] ?? 'needs_fix');
	$publish = ($verdict !== 'critical');

	$notice = '<p><em>本記事は公的情報・報道をもとに自動整理したニュース解説です。制度・手続きの最終判断は専門家にご確認ください。</em></p>';
	if (!str_contains($content, '自動整理したニュース')) {
		$content = $notice . "\n" . $content;
	}

	$author_id = shukatsu_monthly_news_author_id();
	$post_id = wp_insert_post([
		'post_type'    => 'shukatsu_column',
		'post_status'  => $publish ? 'publish' : 'draft',
		'post_title'   => $title,
		'post_content' => $content,
		'post_excerpt' => $meta,
		'post_author'  => $author_id,
	], true);

	if (is_wp_error($post_id)) {
		return ['ok' => false, 'message' => $post_id->get_error_message()];
	}
	$post_id = (int) $post_id;

	shukatsu_ops_set_meta($post_id, 'meta_description', $meta);
	shukatsu_ops_set_meta($post_id, 'ai_generated', 1);
	shukatsu_ops_set_meta($post_id, 'needs_review', $publish ? 0 : 1);
	shukatsu_ops_set_meta($post_id, 'target_length', 'standard');
	shukatsu_ops_set_meta($post_id, 'topic_category_key', 'news');
	shukatsu_ops_set_meta($post_id, 'topic_key', $topic_key);
	shukatsu_ops_set_meta($post_id, 'monthly_auto_news', 1);
	shukatsu_ops_set_ai_meta($post_id, 'ai_research_notes', $research_notes);
	shukatsu_ops_set_ai_meta($post_id, 'ai_review_json', wp_json_encode($review, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
	shukatsu_ops_set_ai_meta($post_id, 'ai_review_acked', $publish ? 1 : 0);
	shukatsu_ops_save_column_source_urls($post_id, $source_urls);

	$wp_cat_name = (string) ($cat['wp_category'] ?? 'ニュース');
	$term = get_term_by('name', $wp_cat_name, 'column_category');
	if ($term && !is_wp_error($term)) {
		wp_set_object_terms($post_id, [(int) $term->term_id], 'column_category');
	}

	$status = $publish ? 'publish' : 'draft';
	$msg = $publish
		? "ニュースコラムを公開しました（#{$post_id} / 判定: {$verdict}）。"
		: "重大指摘（critical）のため下書き保存のみ（#{$post_id}）。人間確認が必要です。";

	return [
		'ok'      => true,
		'message' => $msg,
		'post_id' => $post_id,
		'status'  => $status,
		'verdict' => $verdict,
		'link'    => get_permalink($post_id) ?: '',
	];
}

function shukatsu_monthly_news_author_id(): int {
	if (defined('SHUKATSU_NEWS_AUTHOR_ID') && (int) SHUKATSU_NEWS_AUTHOR_ID > 0) {
		return (int) SHUKATSU_NEWS_AUTHOR_ID;
	}
	$admins = get_users([
		'role'   => 'administrator',
		'number' => 1,
		'fields' => ['ID'],
	]);
	if ($admins) {
		return (int) $admins[0]->ID;
	}
	return 1;
}

<?php
/**
 * クライアント向け更新ツール `/ops/`
 * WordPress管理画面を見せず、コラム・事例の確認・公開を行う。
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('init', 'shukatsu_ops_register_rewrites');
add_filter('query_vars', 'shukatsu_ops_query_vars');
add_action('template_redirect', 'shukatsu_ops_template_redirect', 0);
add_action('admin_post_nopriv_shukatsu_ops_login', 'shukatsu_ops_handle_login');
add_action('admin_post_shukatsu_ops_login', 'shukatsu_ops_handle_login');

/** /ops/ では管理バーを出さない（ヘッダー操作の邪魔になる） */
add_filter('show_admin_bar', static function ($show) {
	if (get_query_var('shukatsu_ops')) {
		return false;
	}
	$request = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
	if (preg_match('#^/ops(/|$)#', (string) wp_parse_url($request, PHP_URL_PATH))) {
		return false;
	}
	return $show;
});

function shukatsu_ops_register_rewrites(): void {
	add_rewrite_rule('^ops/?$', 'index.php?shukatsu_ops=home', 'top');
	add_rewrite_rule('^ops/login/?$', 'index.php?shukatsu_ops=login', 'top');
	add_rewrite_rule('^ops/logout/?$', 'index.php?shukatsu_ops=logout', 'top');
	add_rewrite_rule('^ops/columns/?$', 'index.php?shukatsu_ops=columns', 'top');
	add_rewrite_rule('^ops/columns/new/?$', 'index.php?shukatsu_ops=column_new', 'top');
	add_rewrite_rule('^ops/columns/([0-9]+)/?$', 'index.php?shukatsu_ops=column_edit&shukatsu_ops_id=$matches[1]', 'top');
	add_rewrite_rule('^ops/cases/?$', 'index.php?shukatsu_ops=cases', 'top');
	add_rewrite_rule('^ops/cases/new/?$', 'index.php?shukatsu_ops=case_edit', 'top');
	add_rewrite_rule('^ops/cases/([0-9]+)/?$', 'index.php?shukatsu_ops=case_edit&shukatsu_ops_id=$matches[1]', 'top');
	add_rewrite_rule('^ops/topics/?$', 'index.php?shukatsu_ops=topics', 'top');
	add_rewrite_rule('^ops/topics/new/?$', 'index.php?shukatsu_ops=topic_edit', 'top');
	add_rewrite_rule('^ops/topics/([0-9]+)/?$', 'index.php?shukatsu_ops=topic_edit&shukatsu_ops_id=$matches[1]', 'top');
	add_rewrite_rule('^ops/dancing/?$', 'index.php?shukatsu_ops=dancing', 'top');
	add_rewrite_rule('^ops/dancing/new/?$', 'index.php?shukatsu_ops=dance_edit', 'top');
	add_rewrite_rule('^ops/dancing/([0-9]+)/?$', 'index.php?shukatsu_ops=dance_edit&shukatsu_ops_id=$matches[1]', 'top');
}

/** @param list<string> $vars */
function shukatsu_ops_query_vars(array $vars): array {
	$vars[] = 'shukatsu_ops';
	$vars[] = 'shukatsu_ops_id';
	return $vars;
}

function shukatsu_ops_url(string $path = ''): string {
	$path = ltrim($path, '/');
	return home_url('/ops/' . ($path !== '' ? $path . '/' : ''));
}

function shukatsu_ops_can_use(): bool {
	return is_user_logged_in() && current_user_can('edit_posts');
}

/**
 * /ops/ はログイン状態で中身が変わる。nginx が未ログインの 302 をキャッシュすると
 * ログイン後もログイン画面へ飛ばされる（→ログイン済みならホームへ）ため、全応答でキャッシュ禁止。
 */
function shukatsu_ops_nocache(): void {
	nocache_headers();
	if (!headers_sent()) {
		header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0, private', true);
		header('Pragma: no-cache', true);
		header('Expires: Wed, 11 Jan 1984 05:00:00 GMT', true);
		header('Vary: Cookie', true);
	}
}

function shukatsu_ops_template_redirect(): void {
	$page = get_query_var('shukatsu_ops');
	if (!$page) {
		return;
	}

	// リダイレクトも含め、先にキャッシュ禁止（未ログイン 302 の nginx HIT 対策）
	shukatsu_ops_nocache();

	if ($page === 'logout') {
		wp_logout();
		wp_safe_redirect(shukatsu_ops_url('login'));
		exit;
	}

	if ($page === 'login') {
		if (shukatsu_ops_can_use()) {
			wp_safe_redirect(shukatsu_ops_url());
			exit;
		}
		status_header(200);
		require SHUKATSU_CONTENT_DIR . 'ops/template.php';
		exit;
	}

	if (!is_user_logged_in()) {
		wp_safe_redirect(shukatsu_ops_url('login'));
		exit;
	}

	if (!current_user_can('edit_posts')) {
		status_header(403);
		$GLOBALS['shukatsu_ops_error'] = 'このアカウントでは更新ツールを利用できません。管理者に連絡してください。';
		$page = 'forbidden';
		$GLOBALS['shukatsu_ops_page'] = $page;
		require SHUKATSU_CONTENT_DIR . 'ops/template.php';
		exit;
	}

	status_header(200);
	$GLOBALS['shukatsu_ops_page'] = $page;
	$GLOBALS['shukatsu_ops_id'] = (int) get_query_var('shukatsu_ops_id');
	require SHUKATSU_CONTENT_DIR . 'ops/template.php';
	exit;
}

function shukatsu_ops_handle_login(): void {
	$nonce = isset($_POST['_wpnonce']) ? sanitize_text_field(wp_unslash((string) $_POST['_wpnonce'])) : '';
	if (!wp_verify_nonce($nonce, 'shukatsu_ops_login')) {
		wp_safe_redirect(add_query_arg('err', 'nonce', shukatsu_ops_url('login')));
		exit;
	}

	$user_login = isset($_POST['log']) ? sanitize_text_field(wp_unslash((string) $_POST['log'])) : '';
	$password = isset($_POST['pwd']) ? (string) wp_unslash($_POST['pwd']) : '';
	$remember = !empty($_POST['rememberme']);

	if (is_email($user_login)) {
		$by_email = get_user_by('email', $user_login);
		if ($by_email) {
			$user_login = $by_email->user_login;
		}
	}

	$result = wp_signon([
		'user_login'    => $user_login,
		'user_password' => $password,
		'remember'      => $remember,
	], is_ssl());

	if (is_wp_error($result)) {
		wp_safe_redirect(add_query_arg('err', 'auth', shukatsu_ops_url('login')));
		exit;
	}

	wp_safe_redirect(shukatsu_ops_url());
	exit;
}

/**
 * @return list<array{id:int,title:string,status:string,modified:string,flags:list<string>,edit_url:string}>
 */
function shukatsu_ops_list_posts(string $post_type, int $limit = 50): array {
	$q = new WP_Query([
		'post_type'      => $post_type,
		'post_status'    => ['draft', 'pending', 'publish', 'future'],
		'posts_per_page' => $limit,
		'orderby'        => 'modified',
		'order'          => 'DESC',
		'no_found_rows'  => true,
	]);
	$rows = [];
	foreach ($q->posts as $post) {
		$flags = [];
		if (shukatsu_ops_get_bool($post->ID, 'needs_review')) {
			$flags[] = '要確認';
		}
		if (shukatsu_ops_get_bool($post->ID, 'ai_generated')) {
			$flags[] = 'AI下書き';
		}
		if ($post_type === 'shukatsu_case' && !shukatsu_ops_get_bool($post->ID, 'case_anonymized')) {
			$flags[] = '匿名化未';
		}
		if ($post_type === 'shukatsu_topic' && shukatsu_ops_get_bool($post->ID, 'topic_pin')) {
			$flags[] = '固定';
		}
		if ($post_type === 'shukatsu_dance') {
			$df = shukatsu_ops_get_dance_fields((int) $post->ID);
			if ($df['cancelled']) {
				$flags[] = '中止';
			}
		}
		$status_label = [
			'draft'   => '下書き',
			'pending' => '承認待ち',
			'publish' => '公開中',
			'future'  => '予約',
		][ $post->post_status ] ?? $post->post_status;

		$rows[] = [
			'id'       => (int) $post->ID,
			'title'    => $post->post_title !== '' ? $post->post_title : '（無題）',
			'status'   => $status_label,
			'raw_status' => $post->post_status,
			'modified' => $post_type === 'shukatsu_topic'
				? (string) (shukatsu_ops_get_meta($post->ID, 'topic_date') ?: get_post_modified_time('Y-m-d', false, $post))
				: get_post_modified_time('Y-m-d H:i', false, $post),
			'flags'    => $flags,
			'edit_url' => match ($post_type) {
				'shukatsu_column' => shukatsu_ops_url('columns/' . $post->ID),
				'shukatsu_case'   => shukatsu_ops_url('cases/' . $post->ID),
				'shukatsu_topic'  => shukatsu_ops_url('topics/' . $post->ID),
				'shukatsu_dance'  => shukatsu_ops_url('dancing/' . $post->ID),
				default           => shukatsu_ops_url(),
			},
		];
	}
	return $rows;
}

function shukatsu_ops_get_bool(int $post_id, string $key): bool {
	if (function_exists('get_field')) {
		return (bool) get_field($key, $post_id);
	}
	$raw = get_post_meta($post_id, $key, true);
	return $raw === '1' || $raw === 1 || $raw === true;
}

function shukatsu_ops_get_meta(int $post_id, string $key): mixed {
	if (function_exists('get_field')) {
		return get_field($key, $post_id);
	}
	return get_post_meta($post_id, $key, true);
}

function shukatsu_ops_set_meta(int $post_id, string $key, mixed $value): void {
	if (function_exists('update_field')) {
		update_field($key, $value, $post_id);
		return;
	}
	update_post_meta($post_id, $key, $value);
}

/**
 * /ops/ AIパイプライン用メタ（ACF未定義でも確実に保存）
 */
function shukatsu_ops_set_ai_meta(int $post_id, string $key, mixed $value): void {
	update_post_meta($post_id, $key, $value);
}

function shukatsu_ops_get_ai_meta(int $post_id, string $key, mixed $default = '') {
	$v = get_post_meta($post_id, $key, true);
	if ($v === '' || $v === null) {
		return $default;
	}
	return $v;
}

/**
 * トピックスのリンク先URLを正規化（相対パス可）。
 */
function shukatsu_ops_normalize_topic_href(string $url): string {
	$url = trim($url);
	if ($url === '') {
		return '';
	}
	if (preg_match('#^https?://#i', $url)) {
		return esc_url_raw($url);
	}
	if (str_starts_with($url, '/')) {
		return esc_url_raw(home_url($url));
	}
	return esc_url_raw($url);
}

/**
 * @return array{date:string,link_type:string,internal_url:string,external_url:string,pin:bool}
 */
function shukatsu_ops_get_topic_fields(int $post_id): array {
	$date = (string) (shukatsu_ops_get_meta($post_id, 'topic_date') ?: '');
	if ($date === '' && $post_id > 0) {
		$date = get_the_date('Y-m-d', $post_id) ?: wp_date('Y-m-d');
	}
	$link_type = (string) (shukatsu_ops_get_meta($post_id, 'topic_link_type') ?: 'none');
	if (!in_array($link_type, ['none', 'internal', 'external'], true)) {
		$link_type = 'none';
	}
	$internal = (string) (shukatsu_ops_get_meta($post_id, 'topic_internal_url') ?: '');
	// page_link が ID で返る場合がある
	if ($internal !== '' && ctype_digit($internal)) {
		$permalink = get_permalink((int) $internal);
		$internal = $permalink ? (string) $permalink : '';
	}
	$external = (string) (shukatsu_ops_get_meta($post_id, 'topic_external_url') ?: '');

	return [
		'date'          => $date !== '' ? $date : wp_date('Y-m-d'),
		'link_type'     => $link_type,
		'internal_url'  => $internal,
		'external_url'  => $external,
		'pin'           => shukatsu_ops_get_bool($post_id, 'topic_pin'),
	];
}

/** @return list<WP_Term> */
function shukatsu_ops_terms(string $taxonomy): array {
	$terms = get_terms([
		'taxonomy'   => $taxonomy,
		'hide_empty' => false,
	]);
	if (!is_array($terms)) {
		return [];
	}
	// 同名タームが複数ある場合は先頭（通常は古い方）だけ出す
	$unique = [];
	foreach ($terms as $term) {
		$name = (string) $term->name;
		if (!isset($unique[ $name ])) {
			$unique[ $name ] = $term;
		}
	}
	return array_values($unique);
}

/**
 * コラム本文の文字数目安（編集画面の選択用）
 *
 * @return array<string, array{label:string,chars:int,minutes:string,volume:string}>
 */
function shukatsu_ops_column_length_presets(): array {
	return [
		'short' => [
			'label'   => '短い',
			'chars'   => 800,
			'minutes' => '約2分',
			'volume'  => 'スマホでさっと読める短文。見出しは2つ前後。',
		],
		'standard' => [
			'label'   => '標準',
			'chars'   => 1500,
			'minutes' => '約4分',
			'volume'  => '通常のコラム量。見出し2〜3、具体例を1つ入れられる。',
		],
		'long' => [
			'label'   => 'やや長め',
			'chars'   => 2500,
			'minutes' => '約6〜7分',
			'volume'  => '解説寄り。見出し3〜4、比較や手順まで書ける。',
		],
		'deep' => [
			'label'   => '長め',
			'chars'   => 3500,
			'minutes' => '約9分',
			'volume'  => 'じっくり解説。ガイドライン解説など深掘り向け。',
		],
	];
}

/**
 * URLリストを正規化（重複除去・空行除去）
 *
 * @param list<string>|string $urls
 * @return list<string>
 */
function shukatsu_ops_normalize_urls($urls): array {
	if (is_string($urls)) {
		$urls = preg_split('/\r\n|\r|\n/', $urls) ?: [];
	}
	if (!is_array($urls)) {
		return [];
	}
	$out = [];
	$seen = [];
	foreach ($urls as $url) {
		$url = trim((string) $url);
		if ($url === '' || !preg_match('#^https?://#i', $url)) {
			continue;
		}
		$key = untrailingslashit(strtolower($url));
		if (isset($seen[ $key ])) {
			continue;
		}
		$seen[ $key ] = true;
		$out[] = esc_url_raw($url);
	}
	return $out;
}

/** HTML / テキストから http(s) リンクを抽出 */
function shukatsu_ops_extract_urls_from_text(string $text): array {
	$found = [];
	if (preg_match_all('#https?://[^\s<>"\'\)\]\}]+#u', $text, $m)) {
		foreach ($m[0] as $url) {
			$url = rtrim($url, '.,;:。、）)」』]');
			$found[] = $url;
		}
	}
	return shukatsu_ops_normalize_urls($found);
}

/**
 * コラムに保存された「記事生成に使用したリンク」
 *
 * @return list<string>
 */
function shukatsu_ops_get_column_source_urls(int $post_id): array {
	if ($post_id <= 0) {
		return [];
	}
	$multi = shukatsu_ops_get_meta($post_id, 'source_urls');
	$urls = [];
	if (is_string($multi) && $multi !== '') {
		$urls = shukatsu_ops_normalize_urls($multi);
	} elseif (is_array($multi)) {
		$urls = shukatsu_ops_normalize_urls($multi);
	}
	if (!$urls) {
		$single = (string) (shukatsu_ops_get_meta($post_id, 'source_url') ?: '');
		$urls = shukatsu_ops_normalize_urls($single);
	}
	return $urls;
}

/** @param list<string> $urls */
function shukatsu_ops_save_column_source_urls(int $post_id, array $urls): void {
	$urls = shukatsu_ops_normalize_urls($urls);
	$text = implode("\n", $urls);
	shukatsu_ops_set_meta($post_id, 'source_urls', $text);
	// 既存パイプライン互換: 先頭を source_url にも残す
	shukatsu_ops_set_meta($post_id, 'source_url', $urls[0] ?? '');
}

function shukatsu_ops_enqueue_assets(): void {
	$ver = SHUKATSU_CONTENT_VERSION;
	$base = trailingslashit(plugins_url('ops/assets', SHUKATSU_CONTENT_FILE));

	wp_enqueue_style('shukatsu-ops', $base . 'ops.css', [], $ver);
	wp_enqueue_script('shukatsu-ops', $base . 'ops.js', [], $ver, true);
	wp_localize_script('shukatsu-ops', 'shukatsuOps', [
		'ajaxUrl' => admin_url('admin-ajax.php'),
		'nonce'   => wp_create_nonce('shukatsu_ops'),
		'aiNonce' => wp_create_nonce('shukatsu_case_ai_draft'),
		'urls'    => [
			'home'    => shukatsu_ops_url(),
			'columns' => shukatsu_ops_url('columns'),
			'cases'   => shukatsu_ops_url('cases'),
			'topics'  => shukatsu_ops_url('topics'),
			'dancing' => shukatsu_ops_url('dancing'),
		],
		'lengthPresets' => shukatsu_ops_column_length_presets(),
		'topicTree'     => shukatsu_ops_column_topic_tree(),
	]);
}

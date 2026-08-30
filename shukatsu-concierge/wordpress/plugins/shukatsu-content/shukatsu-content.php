<?php
/**
 * Plugin Name: 終活コンシェルジュ Content Kit
 * Description: トピックス・解決事例・コラム（＋FAQ・制度解説）のCPT/タクソノミー登録。事例AI下書き生成。ACFは acf-json を使用。
 * Version: 0.7.12
 * Author: Calcite / 日野研太
 * Text Domain: shukatsu-content
 *
 * 使い方:
 * 1. wp-content/plugins/shukatsu-content/ に配置して有効化
 * 2. ACF JSON 同期
 * 3. 事例AI: wp-config に SHUKATSU_ANTHROPIC_API_KEY（docs/content-ops-secrets.md）
 * 4. キー到着前の検証: 設定 → 終活コンテンツ でモックON、または SHUKATSU_AI_ALLOW_MOCK
 * 5. クライアント更新ツール: /ops/ （編集者以上でログイン）
 * 6. ニュース月次自動公開: 毎月1日10:00（サイトTZ）。詳細は docs/monthly-news-auto.md
 */

if (!defined('ABSPATH')) {
	exit;
}

define('SHUKATSU_CONTENT_VERSION', '0.7.12');
define('SHUKATSU_CONTENT_FILE', __FILE__);
define('SHUKATSU_CONTENT_DIR', plugin_dir_path(__FILE__));

require_once SHUKATSU_CONTENT_DIR . 'includes/post-types.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/taxonomies.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/admin.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/publish-guards.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/case-ai-draft.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/settings.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/ops-topics.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/ops-claude.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/ops-app.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/ops-dance.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/ops-ajax.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/monthly-news.php';

add_filter('acf/settings/load_json', static function (array $paths): array {
	foreach ([SHUKATSU_CONTENT_DIR . 'acf-json', WP_CONTENT_DIR . '/themes/shukatsu/acf-json'] as $dir) {
		if (is_dir($dir)) {
			$paths[] = $dir;
		}
	}
	return $paths;
});

add_action('init', 'shukatsu_content_register_taxonomies', 5);
add_action('init', 'shukatsu_content_register_post_types', 10);
add_action('init', 'shukatsu_content_ensure_default_terms', 20);

register_activation_hook(__FILE__, function () {
	shukatsu_content_register_taxonomies();
	shukatsu_content_register_post_types();
	shukatsu_ops_register_rewrites();
	flush_rewrite_rules();
	if (function_exists('shukatsu_monthly_news_cron_token')) {
		shukatsu_monthly_news_cron_token();
	}
	if (function_exists('shukatsu_monthly_news_ensure_schedule')) {
		shukatsu_monthly_news_ensure_schedule();
	}
});

/**
 * プラグイン更新後に /ops/ のリライトを一度だけ張り直す
 * （wp-admin に入らなくても init で反映）
 */
add_action('init', static function (): void {
	$ver = get_option('shukatsu_content_rewrite_ver');
	if ($ver === SHUKATSU_CONTENT_VERSION) {
		return;
	}
	shukatsu_ops_register_rewrites();
	flush_rewrite_rules(false);
	update_option('shukatsu_content_rewrite_ver', SHUKATSU_CONTENT_VERSION);
}, 99);

add_action('admin_init', static function (): void {
	$ver = get_option('shukatsu_content_rewrite_ver');
	if ($ver === SHUKATSU_CONTENT_VERSION) {
		return;
	}
	shukatsu_ops_register_rewrites();
	flush_rewrite_rules(false);
	update_option('shukatsu_content_rewrite_ver', SHUKATSU_CONTENT_VERSION);
});

register_deactivation_hook(__FILE__, function () {
	if (defined('SHUKATSU_MONTHLY_NEWS_HOOK')) {
		$ts = wp_next_scheduled(SHUKATSU_MONTHLY_NEWS_HOOK);
		if ($ts) {
			wp_unschedule_event($ts, SHUKATSU_MONTHLY_NEWS_HOOK);
		}
	}
	flush_rewrite_rules();
});

<?php
/**
 * Plugin Name: 終活コンシェルジュ Content Kit
 * Description: トピックス・解決事例・コラム（＋FAQ・制度解説）のCPT/タクソノミー登録。ACFフィールドは acf-json をインポートして使用。
 * Version: 0.1.0
 * Author: Calcite / 日野研太
 * Text Domain: shukatsu-content
 *
 * 使い方（ログイン後）:
 * 1. このフォルダを wp-content/plugins/shukatsu-content/ に配置
 * 2. プラグインを有効化
 * 3. ACF Pro（または無料版＋JSON同期）で wordpress/acf-json/ をインポート
 * 4. 設定 → パーマリンク で「変更を保存」
 */

if (!defined('ABSPATH')) {
	exit;
}

define('SHUKATSU_CONTENT_VERSION', '0.1.0');
define('SHUKATSU_CONTENT_DIR', plugin_dir_path(__FILE__));

require_once SHUKATSU_CONTENT_DIR . 'includes/post-types.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/taxonomies.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/admin.php';
require_once SHUKATSU_CONTENT_DIR . 'includes/publish-guards.php';

add_action('init', 'shukatsu_content_register_taxonomies', 5);
add_action('init', 'shukatsu_content_register_post_types', 10);
add_action('init', 'shukatsu_content_ensure_default_terms', 20);

register_activation_hook(__FILE__, function () {
	shukatsu_content_register_taxonomies();
	shukatsu_content_register_post_types();
	flush_rewrite_rules();
});

register_deactivation_hook(__FILE__, function () {
	flush_rewrite_rules();
});

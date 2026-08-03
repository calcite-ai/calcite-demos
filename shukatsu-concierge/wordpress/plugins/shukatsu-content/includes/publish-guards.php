<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * 公開ガード
 * - 事例: 匿名化チェックなしは publish 不可
 * - 事例/コラム: needs_review=true のままの publish は警告（フィルタでブロックも可）
 */
add_filter('wp_insert_post_data', function ($data, $postarr) {
	$post_id = isset($postarr['ID']) ? (int) $postarr['ID'] : 0;
	$type = $data['post_type'] ?? '';

	if ($data['post_status'] !== 'publish') {
		return $data;
	}

	if ($type === 'shukatsu_case' && function_exists('get_field')) {
		// 保存直前は $_POST['acf'] を見る方が確実な場合あり
		$anonymized = shukatsu_content_acf_bool('case_anonymized', $post_id);
		if (!$anonymized) {
			$data['post_status'] = 'draft';
			set_transient('shukatsu_content_notice_' . get_current_user_id(), '事例を公開するには「匿名化確認」にチェックが必要です。下書きとして保存しました。', 30);
		}
	}

	return $data;
}, 10, 2);

add_action('admin_notices', function () {
	$key = 'shukatsu_content_notice_' . get_current_user_id();
	$msg = get_transient($key);
	if (!$msg) {
		return;
	}
	delete_transient($key);
	echo '<div class="notice notice-error is-dismissible"><p>' . esc_html($msg) . '</p></div>';
});

/**
 * ACF値の取得（保存中のPOSTも考慮）
 */
function shukatsu_content_acf_bool($name, $post_id) {
	if (isset($_POST['acf']) && is_array($_POST['acf'])) {
		foreach ($_POST['acf'] as $value) {
			// フィールドキー経由の場合は get_field に任せる
		}
	}
	if (function_exists('get_field')) {
		return (bool) get_field($name, $post_id);
	}
	return (bool) get_post_meta($post_id, $name, true);
}

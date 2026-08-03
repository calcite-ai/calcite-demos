<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * 管理画面の一覧に「要確認」「匿名化」列を追加
 */
add_filter('manage_shukatsu_case_posts_columns', function ($cols) {
	$cols['shukatsu_flags'] = '確認';
	return $cols;
});

add_filter('manage_shukatsu_column_posts_columns', function ($cols) {
	$cols['shukatsu_flags'] = '確認';
	return $cols;
});

add_action('manage_shukatsu_case_posts_custom_column', 'shukatsu_content_render_flag_column', 10, 2);
add_action('manage_shukatsu_column_posts_custom_column', 'shukatsu_content_render_flag_column', 10, 2);

function shukatsu_content_render_flag_column($column, $post_id) {
	if ($column !== 'shukatsu_flags') {
		return;
	}
	$bits = [];
	if (function_exists('get_field')) {
		if (get_field('needs_review', $post_id)) {
			$bits[] = '<span style="color:#b32d2e;font-weight:700;">要確認</span>';
		}
		if (get_post_type($post_id) === 'shukatsu_case') {
			$bits[] = get_field('case_anonymized', $post_id)
				? '<span style="color:#00a32a;">匿名化済</span>'
				: '<span style="color:#dba617;">匿名化未</span>';
		}
		if (get_field('ai_generated', $post_id)) {
			$bits[] = 'AI下書き';
		}
	} else {
		$bits[] = '（ACF未導入）';
	}
	echo $bits ? implode(' / ', $bits) : '—';
}

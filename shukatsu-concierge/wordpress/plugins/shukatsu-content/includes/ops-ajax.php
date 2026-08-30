<?php
/**
 * /ops/ AJAX: 保存・公開
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

add_action('wp_ajax_shukatsu_ops_save_column', 'shukatsu_ops_ajax_save_column');
add_action('wp_ajax_shukatsu_ops_save_case', 'shukatsu_ops_ajax_save_case');
add_action('wp_ajax_shukatsu_ops_publish_column', 'shukatsu_ops_ajax_publish_column');
add_action('wp_ajax_shukatsu_ops_publish_case', 'shukatsu_ops_ajax_publish_case');
add_action('wp_ajax_shukatsu_ops_assist_column', 'shukatsu_ops_ajax_assist_column');
add_action('wp_ajax_shukatsu_ops_delete_column', 'shukatsu_ops_ajax_delete_column');
add_action('wp_ajax_shukatsu_ops_delete_case', 'shukatsu_ops_ajax_delete_case');
add_action('wp_ajax_shukatsu_ops_save_topic', 'shukatsu_ops_ajax_save_topic');
add_action('wp_ajax_shukatsu_ops_publish_topic', 'shukatsu_ops_ajax_publish_topic');
add_action('wp_ajax_shukatsu_ops_delete_topic', 'shukatsu_ops_ajax_delete_topic');
add_action('wp_ajax_shukatsu_ops_save_dance', 'shukatsu_ops_ajax_save_dance');
add_action('wp_ajax_shukatsu_ops_publish_dance', 'shukatsu_ops_ajax_publish_dance');
add_action('wp_ajax_shukatsu_ops_delete_dance', 'shukatsu_ops_ajax_delete_dance');

function shukatsu_ops_ajax_require_user(): void {
	if (!current_user_can('edit_posts')) {
		wp_send_json_error(['message' => '権限がありません。'], 403);
	}
	$nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash((string) $_POST['nonce'])) : '';
	if (!wp_verify_nonce($nonce, 'shukatsu_ops')) {
		wp_send_json_error(['message' => '不正なリクエストです。再読み込みしてください。'], 403);
	}
}

function shukatsu_ops_ajax_save_column(): void {
	shukatsu_ops_ajax_require_user();

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash((string) $_POST['title'])) : '';
	$content = isset($_POST['content']) ? wp_kses_post(wp_unslash((string) $_POST['content'])) : '';
	$meta_description = isset($_POST['meta_description']) ? sanitize_textarea_field(wp_unslash((string) $_POST['meta_description'])) : '';
	$source_urls_raw = isset($_POST['source_urls']) ? (string) wp_unslash($_POST['source_urls']) : '';
	// 旧フィールド名互換
	if ($source_urls_raw === '' && isset($_POST['source_url'])) {
		$source_urls_raw = (string) wp_unslash($_POST['source_url']);
	}
	$needs_review = !empty($_POST['needs_review']);
	$category_ids = isset($_POST['column_category']) ? array_map('intval', (array) $_POST['column_category']) : [];
	$target_length = isset($_POST['target_length']) ? sanitize_key((string) wp_unslash($_POST['target_length'])) : 'standard';
	$presets = shukatsu_ops_column_length_presets();
	if (!isset($presets[ $target_length ])) {
		$target_length = 'standard';
	}

	if ($title === '') {
		wp_send_json_error(['message' => 'タイトルを入力してください。']);
	}

	$payload = [
		'post_type'    => 'shukatsu_column',
		'post_title'   => $title,
		'post_content' => $content,
		'post_status'  => 'draft',
	];

	if ($post_id > 0) {
		$post = get_post($post_id);
		if (!$post || $post->post_type !== 'shukatsu_column') {
			wp_send_json_error(['message' => 'コラムが見つかりません。'], 404);
		}
		if (!current_user_can('edit_post', $post_id)) {
			wp_send_json_error(['message' => '編集権限がありません。'], 403);
		}
		$payload['ID'] = $post_id;
		$payload['post_status'] = $post->post_status === 'publish' ? 'publish' : 'draft';
		$result = wp_update_post($payload, true);
	} else {
		if (!current_user_can('publish_posts') && !current_user_can('edit_posts')) {
			wp_send_json_error(['message' => '作成権限がありません。'], 403);
		}
		$result = wp_insert_post($payload, true);
	}

	if (is_wp_error($result)) {
		wp_send_json_error(['message' => $result->get_error_message()]);
	}
	$post_id = (int) $result;

	shukatsu_ops_set_meta($post_id, 'meta_description', $meta_description);
	shukatsu_ops_save_column_source_urls($post_id, shukatsu_ops_normalize_urls($source_urls_raw));
	shukatsu_ops_set_meta($post_id, 'needs_review', $needs_review ? 1 : 0);
	shukatsu_ops_set_meta($post_id, 'target_length', $target_length);

	if ($category_ids) {
		wp_set_object_terms($post_id, $category_ids, 'column_category');
	}

	wp_send_json_success([
		'message'  => '保存しました。',
		'post_id'  => $post_id,
		'edit_url' => shukatsu_ops_url('columns/' . $post_id),
	]);
}

function shukatsu_ops_ajax_publish_column(): void {
	shukatsu_ops_ajax_require_user();
	if (!current_user_can('publish_posts')) {
		wp_send_json_error(['message' => '公開する権限がありません。管理者に依頼してください。'], 403);
	}

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$post = get_post($post_id);
	if (!$post || $post->post_type !== 'shukatsu_column') {
		wp_send_json_error(['message' => 'コラムが見つかりません。'], 404);
	}
	if (!current_user_can('edit_post', $post_id)) {
		wp_send_json_error(['message' => '編集権限がありません。'], 403);
	}

	// 人間チェック完了が必須（要確認ONのままでは公開不可）
	if (shukatsu_ops_get_bool($post_id, 'needs_review')) {
		wp_send_json_error(['message' => '「まだ確認が必要（要確認）」にチェックが付いたままです。内容を確認し、チェックを外してから公開してください。']);
	}

	$review_raw = shukatsu_ops_get_ai_meta($post_id, 'ai_review_json', '');
	$has_review = is_string($review_raw) ? ($review_raw !== '') : !empty($review_raw);
	if ($has_review && empty($_POST['ai_review_ack'])) {
		wp_send_json_error(['message' => 'AI再チェック結果を確認したうえで、「AIチェック結果を確認した」にチェックを入れてから公開してください。']);
	}

	$result = wp_update_post([
		'ID'          => $post_id,
		'post_status' => 'publish',
	], true);

	if (is_wp_error($result)) {
		wp_send_json_error(['message' => $result->get_error_message()]);
	}

	if ($has_review) {
		shukatsu_ops_set_ai_meta($post_id, 'ai_review_acked', 1);
	}

	wp_send_json_success([
		'message'    => '公開しました。',
		'post_id'    => $post_id,
		'public_url' => get_permalink($post_id),
	]);
}

function shukatsu_ops_ajax_save_case(): void {
	shukatsu_ops_ajax_require_user();

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash((string) $_POST['title'])) : '';
	$content = isset($_POST['content']) ? wp_kses_post(wp_unslash((string) $_POST['content'])) : '';

	$fields = [
		'case_audience'   => isset($_POST['case_audience']) ? sanitize_text_field(wp_unslash((string) $_POST['case_audience'])) : '',
		'case_age_band'   => isset($_POST['case_age_band']) ? sanitize_text_field(wp_unslash((string) $_POST['case_age_band'])) : '',
		'case_family'     => isset($_POST['case_family']) ? sanitize_text_field(wp_unslash((string) $_POST['case_family'])) : '',
		'case_period'     => isset($_POST['case_period']) ? sanitize_text_field(wp_unslash((string) $_POST['case_period'])) : '',
		'case_result'     => isset($_POST['case_result']) ? sanitize_text_field(wp_unslash((string) $_POST['case_result'])) : '',
		'case_background' => isset($_POST['case_background']) ? sanitize_textarea_field(wp_unslash((string) $_POST['case_background'])) : '',
		'case_point_note' => isset($_POST['case_point_note']) ? sanitize_textarea_field(wp_unslash((string) $_POST['case_point_note'])) : '',
	];
	$actions = isset($_POST['case_actions']) ? array_map('sanitize_text_field', array_map('wp_unslash', (array) $_POST['case_actions'])) : [];
	$category_ids = isset($_POST['case_category']) ? array_map('intval', (array) $_POST['case_category']) : [];
	$anonymized = !empty($_POST['case_anonymized']);
	$needs_review = !empty($_POST['needs_review']);
	$meta_description = isset($_POST['meta_description']) ? sanitize_textarea_field(wp_unslash((string) $_POST['meta_description'])) : '';

	if ($title === '') {
		$title = '（仮）新しい解決事例';
	}

	$payload = [
		'post_type'    => 'shukatsu_case',
		'post_title'   => $title,
		'post_content' => $content,
		'post_status'  => 'draft',
	];

	if ($post_id > 0) {
		$post = get_post($post_id);
		if (!$post || $post->post_type !== 'shukatsu_case') {
			wp_send_json_error(['message' => '事例が見つかりません。'], 404);
		}
		if (!current_user_can('edit_post', $post_id)) {
			wp_send_json_error(['message' => '編集権限がありません。'], 403);
		}
		$payload['ID'] = $post_id;
		$payload['post_status'] = $post->post_status === 'publish' ? 'publish' : 'draft';
		$result = wp_update_post($payload, true);
	} else {
		$result = wp_insert_post($payload, true);
	}

	if (is_wp_error($result)) {
		wp_send_json_error(['message' => $result->get_error_message()]);
	}
	$post_id = (int) $result;

	foreach ($fields as $key => $value) {
		shukatsu_ops_set_meta($post_id, $key, $value);
	}
	shukatsu_ops_set_meta($post_id, 'case_actions', $actions);
	shukatsu_ops_set_meta($post_id, 'case_anonymized', $anonymized ? 1 : 0);
	shukatsu_ops_set_meta($post_id, 'needs_review', $needs_review ? 1 : 0);
	shukatsu_ops_set_meta($post_id, 'meta_description', $meta_description);

	if ($category_ids) {
		wp_set_object_terms($post_id, $category_ids, 'case_category');
	} else {
		wp_set_object_terms($post_id, [], 'case_category');
	}

	wp_send_json_success([
		'message'  => '保存しました。',
		'post_id'  => $post_id,
		'edit_url' => shukatsu_ops_url('cases/' . $post_id),
	]);
}

function shukatsu_ops_ajax_publish_case(): void {
	shukatsu_ops_ajax_require_user();
	if (!current_user_can('publish_posts')) {
		wp_send_json_error(['message' => '公開する権限がありません。管理者に依頼してください。'], 403);
	}

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$post = get_post($post_id);
	if (!$post || $post->post_type !== 'shukatsu_case') {
		wp_send_json_error(['message' => '事例が見つかりません。'], 404);
	}
	if (!current_user_can('edit_post', $post_id)) {
		wp_send_json_error(['message' => '編集権限がありません。'], 403);
	}

	if (!shukatsu_ops_get_bool($post_id, 'case_anonymized')) {
		wp_send_json_error(['message' => '公開するには「匿名化確認」にチェックを入れて保存してください。']);
	}
	if (trim((string) $post->post_content) === '') {
		wp_send_json_error(['message' => '本文が空です。先にAI下書きを生成するか、本文を書いて保存してください。']);
	}

	shukatsu_ops_set_meta($post_id, 'needs_review', 0);

	$result = wp_update_post([
		'ID'          => $post_id,
		'post_status' => 'publish',
	], true);

	if (is_wp_error($result)) {
		wp_send_json_error(['message' => $result->get_error_message()]);
	}

	// ガードで draft に戻されていないか確認
	$fresh = get_post($post_id);
	if (!$fresh || $fresh->post_status !== 'publish') {
		wp_send_json_error(['message' => '公開できませんでした。匿名化確認を見直してください。']);
	}

	wp_send_json_success([
		'message'    => '公開しました。',
		'post_id'    => $post_id,
		'public_url' => get_permalink($post_id),
	]);
}

/**
 * @param 'shukatsu_column'|'shukatsu_case' $post_type
 */
function shukatsu_ops_ajax_trash_post(string $post_type, string $list_path): void {
	shukatsu_ops_ajax_require_user();

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$post = get_post($post_id);
	if (!$post || $post->post_type !== $post_type) {
		wp_send_json_error(['message' => '対象が見つかりません。'], 404);
	}
	if (!current_user_can('delete_post', $post_id)) {
		wp_send_json_error(['message' => '削除する権限がありません。'], 403);
	}

	$result = wp_trash_post($post_id);
	if (!$result) {
		wp_send_json_error(['message' => '削除に失敗しました。']);
	}

	wp_send_json_success([
		'message'   => '削除しました（ゴミ箱へ移しました）。',
		'list_url'  => shukatsu_ops_url($list_path),
	]);
}

function shukatsu_ops_ajax_delete_column(): void {
	shukatsu_ops_ajax_trash_post('shukatsu_column', 'columns');
}

function shukatsu_ops_ajax_delete_case(): void {
	shukatsu_ops_ajax_trash_post('shukatsu_case', 'cases');
}

function shukatsu_ops_ajax_delete_topic(): void {
	shukatsu_ops_ajax_trash_post('shukatsu_topic', 'topics');
}

function shukatsu_ops_ajax_delete_dance(): void {
	shukatsu_ops_ajax_trash_post('shukatsu_dance', 'dancing');
}

/**
 * @return int|WP_Error
 */
function shukatsu_ops_save_dance_from_request(bool $as_publish = false) {
	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash((string) $_POST['title'])) : '';
	$date = isset($_POST['dance_date']) ? sanitize_text_field(wp_unslash((string) $_POST['dance_date'])) : '';
	$start = isset($_POST['dance_start_time']) ? sanitize_text_field(wp_unslash((string) $_POST['dance_start_time'])) : '';
	$end = isset($_POST['dance_end_time']) ? sanitize_text_field(wp_unslash((string) $_POST['dance_end_time'])) : '';
	$venue = isset($_POST['dance_venue']) ? sanitize_text_field(wp_unslash((string) $_POST['dance_venue'])) : '';
	$venue_detail = isset($_POST['dance_venue_detail']) ? sanitize_text_field(wp_unslash((string) $_POST['dance_venue_detail'])) : '';
	$kind = isset($_POST['dance_kind']) ? sanitize_key((string) wp_unslash($_POST['dance_kind'])) : 'lesson';
	$note = isset($_POST['dance_note']) ? sanitize_textarea_field(wp_unslash((string) $_POST['dance_note'])) : '';
	$cancelled = !empty($_POST['dance_cancelled']);

	if ($title === '') {
		return new WP_Error('no_title', 'タイトルを入力してください。');
	}
	if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
		return new WP_Error('bad_date', '開催日を正しく入力してください。');
	}
	if ($venue === '') {
		return new WP_Error('no_venue', '会場を入力してください。');
	}
	if (!isset(shukatsu_ops_dance_kind_labels()[ $kind ])) {
		$kind = 'lesson';
	}
	if ($start !== '' && !preg_match('/^\d{2}:\d{2}$/', $start)) {
		return new WP_Error('bad_time', '開始時刻の形式が正しくありません。');
	}
	if ($end !== '' && !preg_match('/^\d{2}:\d{2}$/', $end)) {
		return new WP_Error('bad_time', '終了時刻の形式が正しくありません。');
	}

	$payload = [
		'post_type'    => 'shukatsu_dance',
		'post_title'   => $title,
		'post_content' => '',
		'post_status'  => $as_publish ? 'publish' : 'draft',
		// 開催日は meta（dance_date）のみ。post_date に未来日を入れると WP が future（予約）になりサイトに出ない。
	];

	if ($post_id > 0) {
		$post = get_post($post_id);
		if (!$post || $post->post_type !== 'shukatsu_dance') {
			return new WP_Error('not_found', '日程が見つかりません。');
		}
		if (!current_user_can('edit_post', $post_id)) {
			return new WP_Error('forbidden', '編集権限がありません。');
		}
		$payload['ID'] = $post_id;
		if (!$as_publish) {
			$payload['post_status'] = in_array($post->post_status, ['publish', 'future'], true) ? 'publish' : 'draft';
		}
		$result = wp_update_post($payload, true);
	} else {
		if (!current_user_can('edit_posts')) {
			return new WP_Error('forbidden', '作成権限がありません。');
		}
		$result = wp_insert_post($payload, true);
	}

	if (is_wp_error($result)) {
		return $result;
	}
	$post_id = (int) $result;

	// 既存の「予約」投稿を公開に戻す（開催日≠投稿日）
	if ($as_publish || (isset($post) && in_array($post->post_status, ['publish', 'future'], true))) {
		$fresh = get_post($post_id);
		if ($fresh && $fresh->post_status === 'future') {
			wp_update_post([
				'ID'            => $post_id,
				'post_status'   => 'publish',
				'post_date'     => current_time('mysql'),
				'post_date_gmt' => current_time('mysql', 1),
			]);
		}
	}

	shukatsu_ops_set_ai_meta($post_id, 'dance_date', $date);
	shukatsu_ops_set_ai_meta($post_id, 'dance_start_time', $start);
	shukatsu_ops_set_ai_meta($post_id, 'dance_end_time', $end);
	shukatsu_ops_set_ai_meta($post_id, 'dance_venue', $venue);
	shukatsu_ops_set_ai_meta($post_id, 'dance_venue_detail', $venue_detail);
	shukatsu_ops_set_ai_meta($post_id, 'dance_kind', $kind);
	shukatsu_ops_set_ai_meta($post_id, 'dance_note', $note);
	shukatsu_ops_set_ai_meta($post_id, 'dance_cancelled', $cancelled ? 1 : 0);

	return $post_id;
}

function shukatsu_ops_ajax_save_dance(): void {
	shukatsu_ops_ajax_require_user();
	$result = shukatsu_ops_save_dance_from_request(false);
	if (is_wp_error($result)) {
		$code = $result->get_error_code() === 'forbidden' ? 403 : 400;
		wp_send_json_error(['message' => $result->get_error_message()], $code);
	}
	wp_send_json_success([
		'message'  => '保存しました。',
		'post_id'  => (int) $result,
		'edit_url' => shukatsu_ops_url('dancing/' . (int) $result),
	]);
}

function shukatsu_ops_ajax_publish_dance(): void {
	shukatsu_ops_ajax_require_user();
	if (!current_user_can('publish_posts')) {
		wp_send_json_error(['message' => '公開する権限がありません。管理者に依頼してください。'], 403);
	}
	$result = shukatsu_ops_save_dance_from_request(true);
	if (is_wp_error($result)) {
		$code = $result->get_error_code() === 'forbidden' ? 403 : 400;
		wp_send_json_error(['message' => $result->get_error_message()], $code);
	}
	wp_send_json_success([
		'message'  => '公開しました。トップと踊活ページに表示されます。',
		'post_id'  => (int) $result,
		'edit_url' => shukatsu_ops_url('dancing/' . (int) $result),
	]);
}

/**
 * トピックスの共通フィールド保存。
 *
 * @return int|WP_Error post_id
 */
function shukatsu_ops_save_topic_from_request(bool $as_publish = false) {
	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash((string) $_POST['title'])) : '';
	$topic_date = isset($_POST['topic_date']) ? sanitize_text_field(wp_unslash((string) $_POST['topic_date'])) : '';
	$link_type = isset($_POST['topic_link_type']) ? sanitize_key((string) wp_unslash($_POST['topic_link_type'])) : 'none';
	$link_url = isset($_POST['topic_link_url']) ? (string) wp_unslash($_POST['topic_link_url']) : '';
	$pin = !empty($_POST['topic_pin']);
	$category_ids = isset($_POST['topic_category']) ? array_map('intval', (array) $_POST['topic_category']) : [];

	if ($title === '') {
		return new WP_Error('no_title', '見出しを入力してください。');
	}
	if ($topic_date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $topic_date)) {
		return new WP_Error('bad_date', '表示日を正しく入力してください。');
	}
	if (!in_array($link_type, ['none', 'internal', 'external'], true)) {
		$link_type = 'none';
	}

	$href = shukatsu_ops_normalize_topic_href($link_url);
	if ($link_type !== 'none' && $href === '') {
		return new WP_Error('no_url', 'リンク先URLを入力してください。');
	}
	if ($link_type === 'none') {
		$href = '';
	}

	$payload = [
		'post_type'    => 'shukatsu_topic',
		'post_title'   => $title,
		'post_content' => '',
		'post_status'  => $as_publish ? 'publish' : 'draft',
		'post_date'    => $topic_date . ' 12:00:00',
	];

	if ($post_id > 0) {
		$post = get_post($post_id);
		if (!$post || $post->post_type !== 'shukatsu_topic') {
			return new WP_Error('not_found', 'トピックスが見つかりません。');
		}
		if (!current_user_can('edit_post', $post_id)) {
			return new WP_Error('forbidden', '編集権限がありません。');
		}
		$payload['ID'] = $post_id;
		if (!$as_publish) {
			$payload['post_status'] = $post->post_status === 'publish' ? 'publish' : 'draft';
		}
		$result = wp_update_post($payload, true);
	} else {
		if (!current_user_can('edit_posts')) {
			return new WP_Error('forbidden', '作成権限がありません。');
		}
		$result = wp_insert_post($payload, true);
	}

	if (is_wp_error($result)) {
		return $result;
	}
	$post_id = (int) $result;

	shukatsu_ops_set_meta($post_id, 'topic_date', $topic_date);
	shukatsu_ops_set_meta($post_id, 'topic_link_type', $link_type);
	shukatsu_ops_set_meta($post_id, 'topic_pin', $pin ? 1 : 0);
	// page_link は URL 文字列でも動くよう post_meta にも確実に残す
	if ($link_type === 'internal') {
		shukatsu_ops_set_meta($post_id, 'topic_internal_url', $href);
		update_post_meta($post_id, 'topic_internal_url', $href);
		shukatsu_ops_set_meta($post_id, 'topic_external_url', '');
		update_post_meta($post_id, 'topic_external_url', '');
	} elseif ($link_type === 'external') {
		shukatsu_ops_set_meta($post_id, 'topic_external_url', $href);
		update_post_meta($post_id, 'topic_external_url', $href);
		shukatsu_ops_set_meta($post_id, 'topic_internal_url', '');
		update_post_meta($post_id, 'topic_internal_url', '');
	} else {
		shukatsu_ops_set_meta($post_id, 'topic_internal_url', '');
		shukatsu_ops_set_meta($post_id, 'topic_external_url', '');
		update_post_meta($post_id, 'topic_internal_url', '');
		update_post_meta($post_id, 'topic_external_url', '');
	}

	if ($category_ids) {
		wp_set_object_terms($post_id, $category_ids, 'topic_category');
	} else {
		wp_set_object_terms($post_id, [], 'topic_category');
	}

	return $post_id;
}

function shukatsu_ops_ajax_save_topic(): void {
	shukatsu_ops_ajax_require_user();
	$result = shukatsu_ops_save_topic_from_request(false);
	if (is_wp_error($result)) {
		$code = $result->get_error_code() === 'forbidden' ? 403 : 400;
		wp_send_json_error(['message' => $result->get_error_message()], $code);
	}
	wp_send_json_success([
		'message'  => '保存しました。',
		'post_id'  => (int) $result,
		'edit_url' => shukatsu_ops_url('topics/' . (int) $result),
	]);
}

function shukatsu_ops_ajax_publish_topic(): void {
	shukatsu_ops_ajax_require_user();
	if (!current_user_can('publish_posts')) {
		wp_send_json_error(['message' => '公開する権限がありません。管理者に依頼してください。'], 403);
	}
	$result = shukatsu_ops_save_topic_from_request(true);
	if (is_wp_error($result)) {
		$code = $result->get_error_code() === 'forbidden' ? 403 : 400;
		wp_send_json_error(['message' => $result->get_error_message()], $code);
	}
	wp_send_json_success([
		'message'    => '公開しました。トップの TOPICS に反映されます。',
		'post_id'    => (int) $result,
		'edit_url'   => shukatsu_ops_url('topics/' . (int) $result),
		'public_url' => home_url('/'),
	]);
}

add_action('wp_ajax_shukatsu_ops_compose_column', 'shukatsu_ops_ajax_compose_column');

function shukatsu_ops_ajax_compose_column(): void {
	shukatsu_ops_ajax_require_user();

	$category_key = isset($_POST['category_key']) ? sanitize_key((string) wp_unslash($_POST['category_key'])) : '';
	$topic_key = isset($_POST['topic_key']) ? sanitize_key((string) wp_unslash($_POST['topic_key'])) : '';
	$note = isset($_POST['note']) ? sanitize_textarea_field(wp_unslash((string) $_POST['note'])) : '';
	$target_length = isset($_POST['target_length']) ? sanitize_key((string) wp_unslash($_POST['target_length'])) : 'standard';
	$presets = shukatsu_ops_column_length_presets();
	if (!isset($presets[ $target_length ])) {
		$target_length = 'standard';
	}

	$resolved = shukatsu_ops_resolve_topic($category_key, $topic_key);
	if (!$resolved) {
		wp_send_json_error(['message' => 'カテゴリまたはテーマの選択が不正です。']);
	}

	if ($topic_key === 'other' && $note === '') {
		wp_send_json_error(['message' => '「その他」のときは「伝えたいこと」の入力が必須です。']);
	}

	if (shukatsu_ops_claude_api_key() === '') {
		wp_send_json_error(['message' => 'APIキーが未設定のため下書きを作成できません。管理者に連絡してください。']);
	}

	$cat = $resolved['category'];
	$topic = $resolved['topic'];
	$chars = (int) $presets[ $target_length ]['chars'];
	$seeds = is_array($topic['seeds'] ?? null) ? $topic['seeds'] : [];
	$seed_text = $seeds ? implode("\n", $seeds) : '（指定なし）';
	$note_line = $note !== '' ? $note : '（特になし）';
	$today = wp_date('Y-m-d');
	$other_rule = $topic_key === 'other'
		? "- 「その他」指定です。担当者メモ（伝えたいこと）を主題の中心にしてください。メモと無関係な一般論だけで埋めないこと\n"
		: '';

	$compose_prompt = <<<PROMPT
あなたは終活・身元保証サイト「終活コンシェルジュ」のコラム下書き担当です。
必ず web_search で「いま時点（{$today}）の最新の公的情報・公式発表」を調べてから書いてください。
制度改正・金額・手続きの変更があるテーマは、古い知識だけで書かないこと。

【選択内容】
- カテゴリ: {$cat['label']}
- テーマ: {$topic['label']}
- ねらい: {$topic['angle']}
- 本文目安: 約{$chars}字（タグ除く本文）
- 担当者メモ: {$note_line}
{$other_rule}
【優先して当たる公式・一次ソース候補】
{$seed_text}

調査後、公開前確認用の下書きを JSON オブジェクトだけ出力してください（説明文・コードフェンス不要）。

出力スキーマ:
{
  "title": "タイトル（40字前後。接頭辞不要）",
  "meta_description": "80〜120字の完結した文",
  "content": "本文HTML",
  "source_urls": ["根拠にしたURL", "..."],
  "research_notes": "検索で得た要点の短いメモ（担当者向け・公開しない）"
}

条件:
- 制度・数値・医療判断を断定しすぎない。不確かな点は本文で「要確認」と書く
- 冒頭で結論、h2を適切に使う
- 個人情報・実在事例は出さない
- source_urls には実際に根拠にしたURLを入れる（seeds＋検索で見つけた公式ページを優先）
- 末尾に相談につながる一文（具体URLは付けない）
PROMPT;

	$used_web_search = true;
	$compose_body = [
		'max_tokens'  => 5000,
		'temperature' => 0.25,
		'tools'       => [shukatsu_ops_claude_web_search_tool()],
		'messages'    => [['role' => 'user', 'content' => $compose_prompt]],
	];

	$compose_res = shukatsu_ops_claude_request($compose_body, 180);
	if (is_wp_error($compose_res)) {
		// Web検索が使えない環境ではフォールバック
		$used_web_search = false;
		$fallback_prompt = $compose_prompt . "\n\n※この環境ではWeb検索が使えません。指定ソースと一般知識の範囲で、断定を避けて書いてください。";
		$compose_res = shukatsu_ops_claude_request([
			'max_tokens'  => 4500,
			'temperature' => 0.3,
			'messages'    => [['role' => 'user', 'content' => $fallback_prompt]],
		], 150);
		if (is_wp_error($compose_res)) {
			wp_send_json_error(['message' => '生成エラー: ' . $compose_res->get_error_message()]);
		}
	}

	$parsed = shukatsu_ops_claude_parse_json_object(shukatsu_ops_claude_extract_text($compose_res));
	if (!is_array($parsed)) {
		wp_send_json_error(['message' => '生成結果の解析に失敗しました。もう一度お試しください。']);
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
		wp_send_json_error(['message' => 'タイトルまたは本文が空でした。もう一度お試しください。']);
	}
	if (function_exists('shukatsu_content_clip_meta_description')) {
		$meta = shukatsu_content_clip_meta_description($meta !== '' ? $meta : $title);
	}

	// --- AI再チェック（第二パス） ---
	$sources_for_review = $source_urls ? implode("\n", $source_urls) : '（なし）';
	$review_prompt = <<<PROMPT
あなたは終活サイトの公開前ファクトチェッカーです。下書きを厳しく点検し、JSONだけ返してください。
今日の日付: {$today}
可能なら web_search で最新の公的情報と突き合わせてください。

【テーマ】{$cat['label']} / {$topic['label']}
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
- ok: 大きな問題は見当たらない（それでも人間確認は必須）
PROMPT;

	$review = [
		'verdict'         => 'needs_fix',
		'summary'         => 'AI再チェックを実行できませんでした。担当者が本文とソースを必ず確認してください。',
		'issues'          => [],
		'checked_claims'  => [],
		'source_gaps'     => [],
		'used_web_search' => $used_web_search,
	];

	$review_body = [
		'max_tokens'  => 2500,
		'temperature' => 0.1,
		'tools'       => [shukatsu_ops_claude_web_search_tool()],
		'messages'    => [['role' => 'user', 'content' => $review_prompt]],
	];
	$review_res = shukatsu_ops_claude_request($review_body, 150);
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

	$post_id = wp_insert_post([
		'post_type'    => 'shukatsu_column',
		'post_status'  => 'draft',
		'post_title'   => $title,
		'post_content' => $content,
		'post_author'  => get_current_user_id(),
	], true);

	if (is_wp_error($post_id)) {
		wp_send_json_error(['message' => $post_id->get_error_message()]);
	}
	$post_id = (int) $post_id;

	shukatsu_ops_set_meta($post_id, 'meta_description', $meta);
	shukatsu_ops_set_meta($post_id, 'ai_generated', 1);
	shukatsu_ops_set_meta($post_id, 'needs_review', 1);
	shukatsu_ops_set_meta($post_id, 'target_length', $target_length);
	shukatsu_ops_set_meta($post_id, 'topic_category_key', $category_key);
	shukatsu_ops_set_meta($post_id, 'topic_key', $topic_key);
	shukatsu_ops_set_ai_meta($post_id, 'ai_research_notes', $research_notes);
	shukatsu_ops_set_ai_meta($post_id, 'ai_review_json', wp_json_encode($review, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
	shukatsu_ops_set_ai_meta($post_id, 'ai_review_acked', 0);
	shukatsu_ops_set_ai_meta($post_id, 'ai_assist_log', []);
	shukatsu_ops_save_column_source_urls($post_id, $source_urls);

	$wp_cat_name = (string) ($cat['wp_category'] ?? '');
	if ($wp_cat_name !== '') {
		$term = get_term_by('name', $wp_cat_name, 'column_category');
		if ($term && !is_wp_error($term)) {
			wp_set_object_terms($post_id, [(int) $term->term_id], 'column_category');
		}
	}

	$verdict_ja = [
		'ok'          => 'おおむね問題なし',
		'needs_fix' => '修正・確認推奨',
		'critical'    => '公開前に要対応',
	];
	$v = $verdict_ja[ $review['verdict'] ] ?? $review['verdict'];

	wp_send_json_success([
		'message'  => '下書きを作成し、AI再チェックまで完了しました（判定: ' . $v . '）。人間が確認してください。',
		'post_id'  => $post_id,
		'edit_url' => shukatsu_ops_url('columns/' . $post_id),
		'review'   => $review,
	]);
}

function shukatsu_ops_ajax_assist_column(): void {
	shukatsu_ops_ajax_require_user();

	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$mode = isset($_POST['mode']) ? sanitize_key((string) wp_unslash($_POST['mode'])) : 'ask';
	$message = isset($_POST['message']) ? sanitize_textarea_field(wp_unslash((string) $_POST['message'])) : '';
	if (!in_array($mode, ['ask', 'revise'], true)) {
		$mode = 'ask';
	}
	if ($message === '') {
		wp_send_json_error(['message' => '内容を入力してください。']);
	}

	$post = get_post($post_id);
	if (!$post || $post->post_type !== 'shukatsu_column') {
		wp_send_json_error(['message' => 'コラムが見つかりません。'], 404);
	}
	if (!current_user_can('edit_post', $post_id)) {
		wp_send_json_error(['message' => '編集権限がありません。'], 403);
	}
	if (shukatsu_ops_claude_api_key() === '') {
		wp_send_json_error(['message' => 'APIキーが未設定です。']);
	}

	// フォーム上の最新内容を優先（未保存の編集も反映）
	$title = isset($_POST['title']) ? sanitize_text_field(wp_unslash((string) $_POST['title'])) : $post->post_title;
	$content = isset($_POST['content']) ? wp_kses_post(wp_unslash((string) $_POST['content'])) : $post->post_content;
	$meta = isset($_POST['meta_description'])
		? sanitize_textarea_field(wp_unslash((string) $_POST['meta_description']))
		: (string) (shukatsu_ops_get_meta($post_id, 'meta_description') ?: '');
	$source_urls_raw = isset($_POST['source_urls']) ? (string) wp_unslash($_POST['source_urls']) : '';
	$source_urls = $source_urls_raw !== ''
		? shukatsu_ops_normalize_urls($source_urls_raw)
		: shukatsu_ops_get_column_source_urls($post_id);
	$sources_text = $source_urls ? implode("\n", $source_urls) : '（なし）';
	$review_json = (string) shukatsu_ops_get_ai_meta($post_id, 'ai_review_json', '');
	$today = wp_date('Y-m-d');

	if ($mode === 'revise') {
		$prompt = <<<PROMPT
あなたは終活サイトの編集アシスタントです。担当者の修正依頼に従い、記事を直してください。
必要なら web_search で最新情報を確認してください（今日: {$today}）。
最終出力は JSON オブジェクトのみ。

【現在のタイトル】{$title}
【現在のメタ】{$meta}
【現在の本文HTML】
{$content}

【ソース】
{$sources_text}

【AI再チェックメモ（参考）】
{$review_json}

【担当者の修正依頼】
{$message}

出力:
{
  "reply": "何をどう直したかの短い説明（日本語）",
  "title": "修正後タイトル",
  "meta_description": "修正後メタ",
  "content": "修正後本文HTML",
  "source_urls": ["追加・更新したURLがあれば"]
}

条件: 依頼されていない箇所はなるべく変えない。制度の断定は避け、不確かな点は要確認。個人情報は出さない。
PROMPT;
	} else {
		$prompt = <<<PROMPT
あなたは終活サイトの編集アシスタントです。担当者の質問に日本語で答えてください。
記事のわかりにくい点・制度の意味・直し方の提案など。必要なら web_search で最新情報を確認（今日: {$today}）。
答えは JSON のみ。

【タイトル】{$title}
【本文HTML】
{$content}

【ソース】
{$sources_text}

【AI再チェックメモ】
{$review_json}

【質問】
{$message}

出力:
{
  "reply": "回答本文。わかりやすく。断定しすぎない。必要なら「要確認」と書く。"
}
PROMPT;
	}

	$req = shukatsu_ops_claude_request([
		'max_tokens'  => $mode === 'revise' ? 5000 : 1800,
		'temperature' => 0.2,
		'tools'       => [shukatsu_ops_claude_web_search_tool()],
		'messages'    => [['role' => 'user', 'content' => $prompt]],
	], 180);

	if (is_wp_error($req)) {
		$req = shukatsu_ops_claude_request([
			'max_tokens'  => $mode === 'revise' ? 4500 : 1600,
			'temperature' => 0.2,
			'messages'    => [['role' => 'user', 'content' => $prompt . "\n\n※Web検索なしで回答してください。"]],
		], 150);
	}
	if (is_wp_error($req)) {
		wp_send_json_error(['message' => 'AI応答エラー: ' . $req->get_error_message()]);
	}

	$parsed = shukatsu_ops_claude_parse_json_object(shukatsu_ops_claude_extract_text($req));
	if (!is_array($parsed) || trim((string) ($parsed['reply'] ?? '')) === '') {
		wp_send_json_error(['message' => 'AI応答の解析に失敗しました。もう一度お試しください。']);
	}

	$reply = trim((string) $parsed['reply']);
	$out = [
		'reply' => $reply,
		'mode'  => $mode,
	];

	if ($mode === 'revise') {
		$new_title = trim((string) ($parsed['title'] ?? ''));
		$new_meta = trim((string) ($parsed['meta_description'] ?? ''));
		$new_content = trim((string) ($parsed['content'] ?? ''));
		if ($new_title !== '') {
			$out['title'] = $new_title;
		}
		if ($new_meta !== '') {
			$out['meta_description'] = $new_meta;
		}
		if ($new_content !== '') {
			$out['content'] = $new_content;
		}
		$extra_urls = shukatsu_ops_normalize_urls(array_merge(
			(array) ($parsed['source_urls'] ?? []),
			shukatsu_ops_claude_extract_citation_urls($req)
		));
		if ($extra_urls) {
			$merged = shukatsu_ops_normalize_urls(array_merge($source_urls, $extra_urls));
			$out['source_urls'] = implode("\n", $merged);
		}
	}

	$log = shukatsu_ops_get_ai_meta($post_id, 'ai_assist_log', []);
	if (!is_array($log)) {
		$log = [];
	}
	$log[] = [
		'mode'    => $mode,
		'message' => $message,
		'reply'   => $reply,
		'at'      => wp_date('Y-m-d H:i'),
	];
	if (count($log) > 30) {
		$log = array_slice($log, -30);
	}
	shukatsu_ops_set_ai_meta($post_id, 'ai_assist_log', $log);
	// 修正・質問したら再確認が必要
	shukatsu_ops_set_meta($post_id, 'needs_review', 1);
	shukatsu_ops_set_ai_meta($post_id, 'ai_review_acked', 0);

	$out['log_html'] = shukatsu_ops_format_assist_log_html($log);
	$out['message'] = $mode === 'revise'
		? '修正案を反映しました。内容を確認して「下書き保存」してください。'
		: '回答しました。';

	wp_send_json_success($out);
}

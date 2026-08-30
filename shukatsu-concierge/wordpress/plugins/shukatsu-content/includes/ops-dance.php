<?php
/**
 * 踊活スケジュール（ops管理用）。公開データはトップ／踊活ページに表示される。
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * 会場の候補（自由入力可。確定後に差し替え）
 *
 * @return list<string>
 */
function shukatsu_ops_dance_venue_presets(): array {
	return [
		'みなとパーク芝浦 スポーツセンター',
		'みなとパーク芝浦 リーブラホール',
		'カルッツかわさき',
		'その他・手入力',
	];
}

/**
 * @return array{lesson:string,party:string,other:string}
 */
function shukatsu_ops_dance_kind_labels(): array {
	return [
		'lesson' => 'レッスン（踊活会）',
		'party'  => 'ダンスホール／パーティ',
		'other'  => 'その他',
	];
}

/**
 * @return array{
 *   date:string,
 *   start_time:string,
 *   end_time:string,
 *   venue:string,
 *   venue_detail:string,
 *   kind:string,
 *   note:string,
 *   cancelled:bool
 * }
 */
function shukatsu_ops_get_dance_fields(int $post_id): array {
	$date = (string) shukatsu_ops_get_ai_meta($post_id, 'dance_date', '');
	if ($date === '' && $post_id > 0) {
		$date = get_the_date('Y-m-d', $post_id) ?: wp_date('Y-m-d');
	}
	$kind = (string) shukatsu_ops_get_ai_meta($post_id, 'dance_kind', 'lesson');
	if (!isset(shukatsu_ops_dance_kind_labels()[ $kind ])) {
		$kind = 'lesson';
	}

	return [
		'date'          => $date !== '' ? $date : wp_date('Y-m-d'),
		'start_time'    => (string) shukatsu_ops_get_ai_meta($post_id, 'dance_start_time', ''),
		'end_time'      => (string) shukatsu_ops_get_ai_meta($post_id, 'dance_end_time', ''),
		'venue'         => (string) shukatsu_ops_get_ai_meta($post_id, 'dance_venue', ''),
		'venue_detail'  => (string) shukatsu_ops_get_ai_meta($post_id, 'dance_venue_detail', ''),
		'kind'          => $kind,
		'note'          => (string) shukatsu_ops_get_ai_meta($post_id, 'dance_note', ''),
		'cancelled'     => (bool) shukatsu_ops_get_ai_meta($post_id, 'dance_cancelled', 0),
	];
}

/**
 * 過去の予定から日付以外をコピーするための候補
 *
 * @return list<array{
 *   id:int,
 *   label:string,
 *   title:string,
 *   kind:string,
 *   start_time:string,
 *   end_time:string,
 *   venue:string,
 *   venue_detail:string,
 *   note:string
 * }>
 */
function shukatsu_ops_dance_paste_templates(int $exclude_id = 0, int $limit = 40): array {
	$q = new WP_Query([
		'post_type'      => 'shukatsu_dance',
		'post_status'    => ['draft', 'pending', 'publish', 'future'],
		'posts_per_page' => $limit + ($exclude_id > 0 ? 5 : 0),
		'meta_key'       => 'dance_date',
		'orderby'        => 'meta_value',
		'order'          => 'DESC',
		'no_found_rows'  => true,
	]);
	$kinds = shukatsu_ops_dance_kind_labels();
	$out = [];
	foreach ($q->posts as $post) {
		$id = (int) $post->ID;
		if ($exclude_id > 0 && $id === $exclude_id) {
			continue;
		}
		$fields = shukatsu_ops_get_dance_fields($id);
		$title = $post->post_title !== '' ? $post->post_title : '（無題）';
		$kind_label = $kinds[ $fields['kind'] ] ?? $fields['kind'];
		$parts = [ $fields['date'], $title ];
		if ($fields['venue'] !== '') {
			$parts[] = $fields['venue'];
		}
		$parts[] = $kind_label;
		$out[] = [
			'id'           => $id,
			'label'        => implode(' ／ ', $parts),
			'title'        => $title,
			'kind'         => $fields['kind'],
			'start_time'   => $fields['start_time'],
			'end_time'     => $fields['end_time'],
			'venue'        => $fields['venue'],
			'venue_detail' => $fields['venue_detail'],
			'note'         => $fields['note'],
		];
		if (count($out) >= $limit) {
			break;
		}
	}
	return $out;
}

/**
 * @return list<array{id:int,title:string,status:string,modified:string,flags:list<string>,edit_url:string}>
 */
function shukatsu_ops_list_dance_posts(int $limit = 80): array {
	$q = new WP_Query([
		'post_type'      => 'shukatsu_dance',
		'post_status'    => ['draft', 'pending', 'publish', 'future'],
		'posts_per_page' => $limit,
		'meta_key'       => 'dance_date',
		'orderby'        => 'meta_value',
		'order'          => 'DESC',
		'no_found_rows'  => true,
	]);
	// meta_key が無い投稿も拾う
	if (!$q->posts) {
		return shukatsu_ops_list_posts('shukatsu_dance', $limit);
	}

	$rows = [];
	$kinds = shukatsu_ops_dance_kind_labels();
	foreach ($q->posts as $post) {
		$fields = shukatsu_ops_get_dance_fields((int) $post->ID);
		$flags = [];
		if ($fields['cancelled']) {
			$flags[] = '中止';
		}
		if (isset($kinds[ $fields['kind'] ])) {
			$flags[] = $kinds[ $fields['kind'] ];
		}
		$status_label = [
			'draft'   => '下書き',
			'pending' => '承認待ち',
			'publish' => '公開中',
			'future'  => '予約',
		][ $post->post_status ] ?? $post->post_status;

		$when = $fields['date'];
		if ($fields['start_time'] !== '') {
			$when .= ' ' . $fields['start_time'];
			if ($fields['end_time'] !== '') {
				$when .= '–' . $fields['end_time'];
			}
		}

		$rows[] = [
			'id'         => (int) $post->ID,
			'title'      => $post->post_title !== '' ? $post->post_title : '（無題）',
			'status'     => $status_label,
			'raw_status' => $post->post_status,
			'modified'   => $when . ($fields['venue'] !== '' ? ' / ' . $fields['venue'] : ''),
			'flags'      => $flags,
			'edit_url'   => shukatsu_ops_url('dancing/' . $post->ID),
		];
	}
	return $rows;
}

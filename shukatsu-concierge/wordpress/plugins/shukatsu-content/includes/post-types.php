<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * CPT登録
 */
function shukatsu_content_register_post_types() {
	$common = [
		'public'             => true,
		'show_in_rest'       => true,
		'has_archive'        => true,
		'show_in_menu'       => true,
		'menu_position'      => 20,
		'capability_type'    => 'post',
		'map_meta_cap'       => true,
	];

	register_post_type('shukatsu_topic', array_merge($common, [
		'labels' => shukatsu_content_labels('トピックス', 'トピックス', false),
		'has_archive' => false,
		'publicly_queryable' => false, // 個別ページ不要。トップ一覧用
		'rewrite' => false,
		'menu_icon' => 'dashicons-megaphone',
		'supports' => ['title', 'revisions'],
	]));

	register_post_type('shukatsu_case', array_merge($common, [
		'labels' => shukatsu_content_labels('解決事例', '解決事例', true),
		'rewrite' => ['slug' => 'cases', 'with_front' => false],
		'menu_icon' => 'dashicons-portfolio',
		'supports' => ['title', 'editor', 'excerpt', 'revisions', 'thumbnail'],
	]));

	register_post_type('shukatsu_column', array_merge($common, [
		'labels' => shukatsu_content_labels('コラム', 'コラム', true),
		'rewrite' => ['slug' => 'columns', 'with_front' => false],
		'menu_icon' => 'dashicons-welcome-write-blog',
		'supports' => ['title', 'editor', 'excerpt', 'revisions', 'thumbnail', 'author'],
	]));

	register_post_type('shukatsu_faq', array_merge($common, [
		'labels' => shukatsu_content_labels('FAQ', 'FAQ', true),
		'rewrite' => ['slug' => 'faq-items', 'with_front' => false],
		'menu_icon' => 'dashicons-editor-help',
		'supports' => ['title', 'editor', 'revisions', 'page-attributes'],
	]));

	register_post_type('shukatsu_guide', array_merge($common, [
		'labels' => shukatsu_content_labels('制度解説', '制度解説', true),
		'rewrite' => ['slug' => 'guides', 'with_front' => false],
		'menu_icon' => 'dashicons-book-alt',
		'supports' => ['title', 'editor', 'excerpt', 'revisions', 'thumbnail'],
	]));
}

/**
 * @param string $singular 単数ラベル
 * @param string $plural   複数ラベル
 * @param bool   $has_item 「〜を追加」系を詳細に出すか
 */
function shukatsu_content_labels($singular, $plural, $has_item = true) {
	return [
		'name'               => $plural,
		'singular_name'      => $singular,
		'menu_name'          => $plural,
		'name_admin_bar'     => $singular,
		'add_new'            => '新規追加',
		'add_new_item'       => $singular . 'を追加',
		'new_item'           => '新しい' . $singular,
		'edit_item'          => $singular . 'を編集',
		'view_item'          => $singular . 'を表示',
		'all_items'          => $plural . '一覧',
		'search_items'       => $plural . 'を検索',
		'not_found'          => $plural . 'は見つかりませんでした',
		'not_found_in_trash' => 'ゴミ箱に' . $plural . 'はありません',
	];
}

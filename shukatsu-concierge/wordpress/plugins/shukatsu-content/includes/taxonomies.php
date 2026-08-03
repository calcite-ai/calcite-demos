<?php
if (!defined('ABSPATH')) {
	exit;
}

/**
 * タクソノミー登録
 */
function shukatsu_content_register_taxonomies() {
	register_taxonomy('case_category', ['shukatsu_case'], [
		'labels' => shukatsu_content_tax_labels('事例カテゴリ', '事例カテゴリ'),
		'public' => true,
		'show_in_rest' => true,
		'hierarchical' => false,
		'rewrite' => ['slug' => 'cases/category', 'with_front' => false],
	]);

	register_taxonomy('column_category', ['shukatsu_column'], [
		'labels' => shukatsu_content_tax_labels('コラムカテゴリ', 'コラムカテゴリ'),
		'public' => true,
		'show_in_rest' => true,
		'hierarchical' => false,
		'rewrite' => ['slug' => 'columns/category', 'with_front' => false],
	]);

	register_taxonomy('faq_category', ['shukatsu_faq'], [
		'labels' => shukatsu_content_tax_labels('FAQカテゴリ', 'FAQカテゴリ'),
		'public' => true,
		'show_in_rest' => true,
		'hierarchical' => false,
		'rewrite' => ['slug' => 'faq/category', 'with_front' => false],
	]);

	register_taxonomy('topic_category', ['shukatsu_topic'], [
		'labels' => shukatsu_content_tax_labels('トピックスカテゴリ', 'トピックスカテゴリ'),
		'public' => false,
		'show_ui' => true,
		'show_in_rest' => true,
		'hierarchical' => false,
		'rewrite' => false,
	]);
}

function shukatsu_content_tax_labels($singular, $plural) {
	return [
		'name'          => $plural,
		'singular_name' => $singular,
		'search_items'  => $plural . 'を検索',
		'all_items'     => 'すべて',
		'edit_item'     => $singular . 'を編集',
		'update_item'   => $singular . 'を更新',
		'add_new_item'  => $singular . 'を追加',
		'new_item_name' => '新しい' . $singular,
		'menu_name'     => $plural,
	];
}

function shukatsu_content_ensure_default_terms() {
	$terms = [
		'case_category' => [
			'身元保証',
			'入院保証',
			'老人ホーム入居',
			'成年後見',
			'死後事務',
			'相続',
			'生活保護',
			'認知症対応',
		],
		'column_category' => [
			'ニュース',
			'身元保証',
			'制度・安心',
			'終活の基礎',
			'その他',
		],
		'faq_category' => [
			'サービス',
			'料金',
			'契約',
			'専門職向け',
		],
		'topic_category' => [
			'メディア',
			'お知らせ',
			'更新情報',
			'その他',
		],
	];

	foreach ($terms as $taxonomy => $names) {
		if (!taxonomy_exists($taxonomy)) {
			continue;
		}
		foreach ($names as $name) {
			if (!term_exists($name, $taxonomy)) {
				wp_insert_term($name, $taxonomy);
			}
		}
	}
}

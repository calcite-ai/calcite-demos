<?php
/**
 * コラム作成：テーマツリー（担当者が選ぶ用）
 *
 * 運用: 週次自動投稿ではなく、担当者が週1〜2回 /ops/ でテーマを選んで下書き生成。
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * @return array<string, array{
 *   label:string,
 *   blurb:string,
 *   wp_category:string,
 *   children:array<string, array{label:string,blurb:string,angle:string,seeds:list<string>}>
 * }>
 */
function shukatsu_ops_column_topic_tree(): array {
	$tree = [
		'news' => [
			'label'       => 'ニュース・制度の動き',
			'blurb'       => '行政の発表や制度改正を、現場向けに短く整理する',
			'wp_category' => 'ニュース',
			'children'    => [
				'guideline' => [
					'label' => 'ガイドライン・事業者指針',
					'blurb' => '終身サポート事業者ガイドラインなどの見方',
					'angle' => 'ガイドラインの要点と、事業者・家族が確認すべきチェック項目を解説する',
					'seeds' => [
						'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_037',
						'https://www.moj.go.jp/MINJI/minji07_00358.html',
					],
				],
				'survey' => [
					'label' => '調査・実態データの読み方',
					'blurb' => '総務省調査など、数字の意味を噛み砕く',
					'angle' => '公的調査の結果を、身元保証・身寄りなし支援の現場目線で整理する',
					'seeds' => [
						'https://www.soumu.go.jp/menu_news/s-news/hyouka_230807000167327.html',
					],
				],
				'law-change' => [
					'label' => '法改正・福祉制度の動き',
					'blurb' => '身寄りなし支援や福祉関連の制度変更',
					'angle' => '制度改正が入院・施設・地域支援にどう影響しうるかを、断定しすぎず解説する',
					'seeds' => [],
				],
			],
		],
		'guarantor' => [
			'label'       => '身元保証の基礎',
			'blurb'       => 'そもそも何が必要か、どう選ぶかを説明する',
			'wp_category' => '身元保証',
			'children'    => [
				'when-needed' => [
					'label' => '保証人が必要になるとき',
					'blurb' => '入院・施設で求められる場面の整理',
					'angle' => 'どんな場面で身元保証人・緊急連絡先が求められやすいかを、場面別に整理する',
					'seeds' => [],
				],
				'how-to-choose' => [
					'label' => '身元保証会社の選び方',
					'blurb' => '料金・解約・説明の確認ポイント',
					'angle' => 'ガイドラインを踏まえ、比較検討で見るべき料金・解約・サービス範囲を解説する',
					'seeds' => [
						'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_037',
					],
				],
				'no-deposit' => [
					'label' => '預託金・料金の見方',
					'blurb' => '費用の内訳と注意点',
					'angle' => '預託金の有無や月額・都度費用の見方、契約前に確認したい点を整理する',
					'seeds' => [],
				],
				'vs-seinen' => [
					'label' => '成年後見との違い',
					'blurb' => '役割の違いを表で分かりやすく',
					'angle' => '身元保証・死後事務と成年後見の役割の違いを、選び方の判断材料として整理する（制度断定は避ける）',
					'seeds' => [],
				],
			],
		],
		'hospital' => [
			'label'       => '入院・病院まわり',
			'blurb'       => '入院時の保証・退院調整の困りごと',
			'wp_category' => '身元保証',
			'children'    => [
				'no-guarantor' => [
					'label' => '入院で保証人がいないとき',
					'blurb' => '本人・家族が取りうる進め方',
					'angle' => '入院時に保証人が見つからないときの相談の進め方と、早めに整えるとよいことを解説する',
					'seeds' => [],
				],
				'discharge' => [
					'label' => '退院調整と緊急連絡先',
					'blurb' => '受け皿と連絡体制の整え方',
					'angle' => '退院調整で止まりやすい点と、緊急連絡先・身元保証の役割分担を整理する',
					'seeds' => [],
				],
				'msw' => [
					'label' => '病院MSWとの連携',
					'blurb' => '専門職がつなぎやすいポイント',
					'angle' => '病院MSWが身元保証・生活支援につなぐときの確認事項と連携の型を解説する',
					'seeds' => [],
				],
			],
		],
		'facility' => [
			'label'       => '介護施設まわり',
			'blurb'       => '入所時の保証・施設側の説明',
			'wp_category' => '身元保証',
			'children'    => [
				'admission' => [
					'label' => '施設入所と連帯保証・緊急連絡',
					'blurb' => '求められやすい内容の整理',
					'angle' => '介護施設入所で連帯保証や緊急連絡先が求められる理由と、現場での整え方を解説する',
					'seeds' => [],
				],
				'staff-explain' => [
					'label' => '施設職員が説明しやすいポイント',
					'blurb' => 'ご本人・家族への伝え方',
					'angle' => '施設職員が家族・本人に身元保証の必要性を説明するときの要点を整理する',
					'seeds' => [],
				],
			],
		],
		'family' => [
			'label'       => 'ご本人・ご家族の備え',
			'blurb'       => '遠方介護や話し合いのきっかけ',
			'wp_category' => '終活の基礎',
			'children'    => [
				'far-family' => [
					'label' => '遠方から親を支えるとき',
					'blurb' => '役割分担と連絡体制',
					'angle' => '遠方家族が身元保証や生活支援を検討するときの役割分担と進め方を解説する',
					'seeds' => [],
				],
				'talk-start' => [
					'label' => '終活・身元保証を話し合うきっかけ',
					'blurb' => '家族会議の入口になる話題',
					'angle' => '家族が終活や身元保証の話を始めにくい理由と、話し合いの入口になる視点を整理する',
					'seeds' => [],
				],
			],
		],
		'pro' => [
			'label'       => '専門職・紹介会社向け',
			'blurb'       => 'つなぎ方・確認事項の実務メモ',
			'wp_category' => '制度・安心',
			'children'    => [
				'care-manager' => [
					'label' => 'ケアマネ・地域包括からのつなぎ方',
					'blurb' => '相談経路と情報共有',
					'angle' => 'ケアマネジャーや地域包括支援センターが身元保証サービスにつなぐときの確認事項を実務向けに整理する',
					'seeds' => [],
				],
				'referral' => [
					'label' => '紹介会社が確認すべきこと',
					'blurb' => '比較・説明のチェックリスト',
					'angle' => '紹介会社が事業者を案内する前に確認したい料金・範囲・ガイドライン対応をチェックリスト化する',
					'seeds' => [
						'https://www.caa.go.jp/policies/policy/consumer_policy/caution/caution_037',
					],
				],
			],
		],
	];

	// どのカテゴリにも「その他」を末尾追加（伝えたいことが必須）
	$other = [
		'label' => 'その他',
		'blurb' => '上にないテーマ。伝えたいことを書いてください',
		'angle' => '担当者が「伝えたいこと」に書いた内容を主題に、カテゴリの文脈で解説する',
		'seeds' => [],
	];
	foreach ($tree as $cat_key => $cat) {
		$tree[ $cat_key ]['children']['other'] = $other;
	}

	return $tree;
}

/** @return array{category:array<string,mixed>,topic:array<string,mixed>}|null */
function shukatsu_ops_resolve_topic(string $category_key, string $topic_key): ?array {
	$tree = shukatsu_ops_column_topic_tree();
	if (!isset($tree[ $category_key ]['children'][ $topic_key ])) {
		return null;
	}
	return [
		'category' => $tree[ $category_key ],
		'topic'    => $tree[ $category_key ]['children'][ $topic_key ],
		'category_key' => $category_key,
		'topic_key' => $topic_key,
	];
}

/**
 * タイトルからテーマを推定するキーワード（長い語を優先）
 *
 * @return array<string, array<string, list<string>>>
 */
function shukatsu_ops_column_topic_keywords(): array {
	return [
		'news' => [
			'guideline'  => ['事業者指針', 'ガイドライン', '終身サポート事業者'],
			'survey'     => ['総務省', '実態データ', '全国調査', '調査'],
			'law-change' => ['法改正', '制度改正'],
		],
		'guarantor' => [
			'vs-seinen'     => ['成年後見'],
			'no-deposit'    => ['預託金', '預託', '料金の見方'],
			'how-to-choose' => ['選び方', '会社選び', '比較'],
			'when-needed'   => ['必要になる', 'どんなとき', '保証人が必要'],
		],
		'hospital' => [
			'msw'           => ['MSW', 'ソーシャルワーカー'],
			'discharge'     => ['退院調整', '退院'],
			'no-guarantor'  => ['保証人がいない', '保証人不在'],
		],
		'facility' => [
			'staff-explain' => ['施設職員', '説明しやすい'],
			'admission'     => ['施設入所', '介護施設', '連帯保証'],
		],
		'family' => [
			'far-family' => ['遠方'],
			'talk-start' => ['話し合う', 'きっかけ', '家族会議'],
		],
		'pro' => [
			'care-manager' => ['ケアマネ', '地域包括'],
			'referral'     => ['紹介会社'],
		],
	];
}

/**
 * @param list<string> $wp_cats
 * @return array{category:string,topic:string}|null
 */
function shukatsu_ops_infer_column_topic(string $title, array $wp_cats): ?array {
	$tree = shukatsu_ops_column_topic_tree();
	$keywords = shukatsu_ops_column_topic_keywords();
	$wp_to_cat = [];
	foreach ($tree as $cat_key => $cat) {
		$wp_name = (string) ($cat['wp_category'] ?? '');
		if ($wp_name !== '' && !isset($wp_to_cat[ $wp_name ])) {
			$wp_to_cat[ $wp_name ] = $cat_key;
		}
	}

	$best = null;
	$best_len = 0;
	foreach ($keywords as $cat_key => $topics) {
		foreach ($topics as $topic_key => $words) {
			if (!isset($tree[ $cat_key ]['children'][ $topic_key ])) {
				continue;
			}
			foreach ($words as $word) {
				if ($word === '' || !str_contains($title, $word)) {
					continue;
				}
				$len = mb_strlen($word);
				$wp_bonus = 0;
				$wp_name = (string) ($tree[ $cat_key ]['wp_category'] ?? '');
				if ($wp_name !== '' && in_array($wp_name, $wp_cats, true)) {
					$wp_bonus = 10;
				}
				$score = $len + $wp_bonus;
				if ($best === null || $score > $best_len) {
					$best = ['category' => $cat_key, 'topic' => $topic_key];
					$best_len = $score;
				}
			}
		}
	}
	if ($best) {
		return $best;
	}

	foreach ($wp_cats as $wp_name) {
		if (isset($wp_to_cat[ $wp_name ]) && isset($tree[ $wp_to_cat[ $wp_name ] ]['children']['other'])) {
			return ['category' => $wp_to_cat[ $wp_name ], 'topic' => 'other'];
		}
	}
	return null;
}

/**
 * 公開中コラムの件数（新規作成画面の目安）。1記事は1カテゴリ・1テーマにだけ数える。
 *
 * @return array{
 *   total:int,
 *   categories:array<string,int>,
 *   topics:array<string,array<string,int>>
 * }
 */
function shukatsu_ops_column_publish_counts(): array {
	$tree = shukatsu_ops_column_topic_tree();
	$categories = [];
	$topics = [];
	foreach ($tree as $cat_key => $cat) {
		$categories[ $cat_key ] = 0;
		$topics[ $cat_key ] = [];
		foreach (array_keys($cat['children']) as $topic_key) {
			$topics[ $cat_key ][ $topic_key ] = 0;
		}
	}

	$q = new WP_Query([
		'post_type'              => 'shukatsu_column',
		'post_status'            => 'publish',
		'posts_per_page'         => -1,
		'fields'                 => 'ids',
		'no_found_rows'          => true,
		'update_post_meta_cache' => true,
		'update_post_term_cache' => true,
	]);

	foreach ($q->posts as $post_id) {
		$post_id = (int) $post_id;
		$terms = get_the_terms($post_id, 'column_category');
		$wp_cats = [];
		if (is_array($terms)) {
			foreach ($terms as $term) {
				$wp_cats[] = (string) $term->name;
			}
		}

		$cat_key = (string) get_post_meta($post_id, 'topic_category_key', true);
		$topic_key = (string) get_post_meta($post_id, 'topic_key', true);
		if ($cat_key === '' || !isset($categories[ $cat_key ]) || $topic_key === '' || !isset($topics[ $cat_key ][ $topic_key ])) {
			$title = (string) get_the_title($post_id);
			$inferred = shukatsu_ops_infer_column_topic($title, $wp_cats);
			if (!$inferred) {
				continue;
			}
			$cat_key = $inferred['category'];
			$topic_key = $inferred['topic'];
		}

		$categories[ $cat_key ]++;
		$topics[ $cat_key ][ $topic_key ]++;
	}

	return [
		'total'      => count($q->posts),
		'categories' => $categories,
		'topics'     => $topics,
	];
}

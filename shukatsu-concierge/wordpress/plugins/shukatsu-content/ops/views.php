<?php
/**
 * /ops/ 画面本体
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

/**
 * @param WP_User $user
 */
function shukatsu_ops_render_app(string $page, int $ops_id, $user): void {
	?>
	<div class="ops-app" id="ops-app" data-page="<?php echo esc_attr($page); ?>" data-id="<?php echo (int) $ops_id; ?>">
		<header class="ops-header">
			<div class="ops-header__brand">
				<a href="<?php echo esc_url(shukatsu_ops_url()); ?>">更新ツール</a>
				<span class="ops-header__sub">終活コンシェルジュ</span>
			</div>
			<nav class="ops-nav">
				<a href="<?php echo esc_url(shukatsu_ops_url()); ?>" class="<?php echo $page === 'home' ? 'is-active' : ''; ?>">ホーム</a>
				<a href="<?php echo esc_url(shukatsu_ops_url('topics')); ?>" class="<?php echo str_starts_with($page, 'topic') ? 'is-active' : ''; ?>">トピックス</a>
				<a href="<?php echo esc_url(shukatsu_ops_url('dancing')); ?>" class="<?php echo str_starts_with($page, 'danc') ? 'is-active' : ''; ?>">踊活日程</a>
				<a href="<?php echo esc_url(shukatsu_ops_url('columns')); ?>" class="<?php echo str_starts_with($page, 'column') ? 'is-active' : ''; ?>">コラム</a>
				<a href="<?php echo esc_url(shukatsu_ops_url('cases')); ?>" class="<?php echo str_starts_with($page, 'case') ? 'is-active' : ''; ?>">解決事例</a>
			</nav>
			<div class="ops-header__user">
				<span><?php echo esc_html($user->display_name ?: $user->user_login); ?></span>
				<a href="<?php echo esc_url(shukatsu_ops_url('logout')); ?>">ログアウト</a>
			</div>
		</header>
		<main class="ops-main">
			<div id="ops-toast" class="ops-toast" hidden></div>
			<?php
			if ($page === 'forbidden') {
				echo '<section class="ops-panel"><h1>利用できません</h1><p>' . esc_html($GLOBALS['shukatsu_ops_error'] ?? '権限がありません。') . '</p></section>';
			} elseif ($page === 'home') {
				shukatsu_ops_view_home();
			} elseif ($page === 'columns') {
				shukatsu_ops_view_columns_list();
			} elseif ($page === 'column_new') {
				shukatsu_ops_view_column_new();
			} elseif ($page === 'column_edit') {
				shukatsu_ops_view_column_edit($ops_id);
			} elseif ($page === 'cases') {
				shukatsu_ops_view_cases_list();
			} elseif ($page === 'case_edit') {
				shukatsu_ops_view_case_edit($ops_id);
			} elseif ($page === 'topics') {
				shukatsu_ops_view_topics_list();
			} elseif ($page === 'topic_edit') {
				shukatsu_ops_view_topic_edit($ops_id);
			} elseif ($page === 'dancing') {
				shukatsu_ops_view_dancing_list();
			} elseif ($page === 'dance_edit') {
				shukatsu_ops_view_dance_edit($ops_id);
			} else {
				echo '<section class="ops-panel"><h1>ページが見つかりません</h1></section>';
			}
			?>
		</main>
	</div>
	<?php
}

function shukatsu_ops_view_home(): void {
	$sections = [
		[
			'title' => 'トピックス',
			'desc'  => 'トップページの「TOPICS」欄。メディア掲載やお知らせなど、短い一行の情報向けです。',
			'actions' => [
				['href' => 'topics/new', 'label' => '新しく書く', 'primary' => true, 'hint' => '見出し・日付・リンクを入力して公開'],
				['href' => 'topics', 'label' => '一覧を見る', 'primary' => false, 'hint' => '修正・削除・固定の変更'],
			],
		],
		[
			'title' => '踊活の日程',
			'desc'  => 'レッスンやダンスホールの予定。公開するとトップと踊活ページに表示されます。',
			'actions' => [
				['href' => 'dancing/new', 'label' => '日程を追加', 'primary' => true, 'hint' => '日付・時間・会場を登録'],
				['href' => 'dancing', 'label' => '一覧を見る', 'primary' => false, 'hint' => '修正・中止・削除'],
			],
		],
		[
			'title' => 'コラム',
			'desc'  => '終活の読み物記事。テーマを選んで下書きを作り、内容を確認してから公開します。',
			'actions' => [
				['href' => 'columns/new', 'label' => '新しく書く', 'primary' => true, 'hint' => 'カテゴリ → テーマ → AI下書き'],
				['href' => 'columns', 'label' => '一覧を見る', 'primary' => false, 'hint' => '要確認の修正・公開'],
			],
		],
		[
			'title' => '解決事例',
			'desc'  => '相談の流れを匿名化した事例。項目入力 → 文章作成 → 確認して公開、の順です。',
			'actions' => [
				['href' => 'cases/new', 'label' => '新しく書く', 'primary' => true, 'hint' => '項目を入力して文章を作成'],
				['href' => 'cases', 'label' => '一覧を見る', 'primary' => false, 'hint' => '確認・公開・削除'],
			],
		],
	];
	?>
	<section class="ops-panel ops-home">
		<h1>ホーム</h1>
		<p class="ops-lead">更新したい種類を選んでください。各カテゴリは「新しく書く」と「一覧」があります。</p>
		<div class="ops-home-sections">
			<?php foreach ($sections as $section) : ?>
				<section class="ops-home-section">
					<header class="ops-home-section__head">
						<h2><?php echo esc_html($section['title']); ?></h2>
						<p><?php echo esc_html($section['desc']); ?></p>
					</header>
					<div class="ops-home-section__actions">
						<?php foreach ($section['actions'] as $action) : ?>
							<a class="ops-home-action<?php echo !empty($action['primary']) ? ' ops-home-action--primary' : ''; ?>" href="<?php echo esc_url(shukatsu_ops_url($action['href'])); ?>">
								<strong><?php echo esc_html($action['label']); ?></strong>
								<span><?php echo esc_html($action['hint']); ?></span>
							</a>
						<?php endforeach; ?>
					</div>
				</section>
			<?php endforeach; ?>
		</div>
	</section>
	<?php
}

function shukatsu_ops_view_columns_list(): void {
	$rows = shukatsu_ops_list_posts('shukatsu_column');
	$published = 0;
	$drafts = 0;
	foreach ($rows as $row) {
		if (($row['raw_status'] ?? '') === 'publish') {
			$published++;
		} else {
			$drafts++;
		}
	}
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1>コラム</h1>
				<p class="ops-lead">テーマを選んで下書きを作り、内容を確認してから公開します。公開 <?php echo (int) $published; ?>件 · 下書き <?php echo (int) $drafts; ?>件</p>
			</div>
			<a class="ops-btn ops-btn--primary" href="<?php echo esc_url(shukatsu_ops_url('columns/new')); ?>">新しいコラムを書く</a>
		</div>
		<?php shukatsu_ops_render_table($rows); ?>
	</section>
	<?php
}

function shukatsu_ops_view_column_new(): void {
	$tree = shukatsu_ops_column_topic_tree();
	$presets = shukatsu_ops_column_length_presets();
	$counts = shukatsu_ops_column_publish_counts();
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1>新しいコラムを書く</h1>
				<p class="ops-lead">まず大きなカテゴリを選び、次に具体的なテーマを選んでください。件数はサイト公開中のコラムです（1記事は1か所にだけ数えます）。</p>
			</div>
			<a class="ops-btn" href="<?php echo esc_url(shukatsu_ops_url('columns')); ?>">一覧へ戻る</a>
		</div>

		<form id="ops-compose-form" class="ops-form">
			<div class="ops-compose-step">
				<h2 class="ops-compose-step__title">1. カテゴリ <span class="ops-count-total">公開 <?php echo (int) $counts['total']; ?>件</span></h2>
				<div class="ops-topic-grid" id="ops-cat-grid">
					<?php foreach ($tree as $cat_key => $cat) : ?>
						<?php $n = (int) ($counts['categories'][ $cat_key ] ?? 0); ?>
						<label class="ops-topic-card">
							<input type="radio" name="category_key" value="<?php echo esc_attr($cat_key); ?>" required>
							<span class="ops-topic-card__label"><?php echo esc_html($cat['label']); ?></span>
							<span class="ops-topic-card__blurb"><?php echo esc_html($cat['blurb']); ?></span>
							<span class="ops-topic-card__count">公開 <?php echo $n; ?>件</span>
						</label>
					<?php endforeach; ?>
				</div>
			</div>

			<div class="ops-compose-step" id="ops-topic-step" hidden>
				<h2 class="ops-compose-step__title" id="ops-topic-step-title">2. テーマ（詳細）</h2>
				<p class="ops-hint" id="ops-topic-step-summary" hidden></p>
				<div class="ops-topic-grid" id="ops-topic-grid"></div>
			</div>

			<div class="ops-compose-step" id="ops-option-step" hidden>
				<h2 class="ops-compose-step__title">3. 長さと補足</h2>
				<label>本文の長さ（目安）</label>
				<div class="ops-length">
					<?php foreach ($presets as $key => $preset) : ?>
						<label class="ops-length__card">
							<input type="radio" name="target_length" value="<?php echo esc_attr($key); ?>" <?php checked($key, 'standard'); ?>>
							<span class="ops-length__label"><?php echo esc_html($preset['label']); ?></span>
							<span class="ops-length__chars">約<?php echo (int) $preset['chars']; ?>字</span>
							<span class="ops-length__meta">読む目安 <?php echo esc_html($preset['minutes']); ?></span>
							<span class="ops-length__volume"><?php echo esc_html($preset['volume']); ?></span>
						</label>
					<?php endforeach; ?>
				</div>

				<label for="ops-compose-note" id="ops-compose-note-label">伝えたいこと（任意）</label>
				<textarea id="ops-compose-note" name="note" rows="3" placeholder="例：遠方家族向けに、連絡体制の話を厚めにしたい"></textarea>
				<p class="ops-hint" id="ops-compose-note-hint" hidden>「その他」を選んだときは必須です。書きたい内容・読者・強調したい点を具体的に書いてください。</p>

				<div class="ops-actions">
					<button type="button" class="ops-btn ops-btn--primary" data-ops-action="compose-column">下書きを作る</button>
				</div>
				<ol class="ops-steps">
					<li>最新情報をWeb検索しながら下書きを生成</li>
					<li>AIが記事を再チェック（誤情報・要確認の洗い出し）</li>
					<li>担当者が編集画面で確認・修正</li>
					<li>必要ならAIに修正依頼・質問 → 確認後に公開</li>
				</ol>
				<p class="ops-hint">自動公開はしません。生成には1〜2分かかることがあります。</p>
			</div>
		</form>
	</section>
	<script type="application/json" id="ops-topic-tree-json"><?php echo wp_json_encode($tree, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
	<script type="application/json" id="ops-column-counts-json"><?php echo wp_json_encode($counts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
	<?php
}

function shukatsu_ops_view_topics_list(): void {
	$rows = shukatsu_ops_list_posts('shukatsu_topic');
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1>トピックス</h1>
				<p class="ops-lead">トップページの TOPICS に出すお知らせです。コラム・事例の公開分は自動でも出ます。メディア掲載などはここに手入力します。</p>
			</div>
			<a class="ops-btn ops-btn--primary" href="<?php echo esc_url(shukatsu_ops_url('topics/new')); ?>">新しいトピックス</a>
		</div>
		<?php shukatsu_ops_render_table($rows); ?>
	</section>
	<?php
}

function shukatsu_ops_view_topic_edit(int $ops_id): void {
	$post = $ops_id ? get_post($ops_id) : null;
	if ($ops_id && (!$post || $post->post_type !== 'shukatsu_topic')) {
		echo '<section class="ops-panel"><h1>見つかりません</h1></section>';
		return;
	}
	$title = $post ? $post->post_title : '';
	$fields = shukatsu_ops_get_topic_fields($ops_id ?: 0);
	$status = $post ? $post->post_status : 'draft';
	$cat_selected = $ops_id ? wp_list_pluck(wp_get_post_terms($ops_id, 'topic_category'), 'term_id') : [];
	$link_url = $fields['link_type'] === 'external' ? $fields['external_url'] : $fields['internal_url'];
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1><?php echo $ops_id ? 'トピックスを編集' : '新しいトピックス'; ?></h1>
				<p class="ops-lead">
					状態: <strong><?php echo esc_html($status === 'publish' ? '公開中' : '下書き'); ?></strong>
					<?php if ($fields['pin']) : ?> · <span class="ops-flag ops-flag--warn">固定</span><?php endif; ?>
				</p>
			</div>
			<a class="ops-btn" href="<?php echo esc_url(shukatsu_ops_url('topics')); ?>">一覧へ戻る</a>
		</div>

		<form id="ops-topic-form" class="ops-form" data-post-id="<?php echo (int) $ops_id; ?>">
			<label for="ops-topic-title">見出し（1行）</label>
			<input id="ops-topic-title" type="text" name="title" required maxlength="120" value="<?php echo esc_attr($title); ?>" placeholder="例：メディアに掲載されました">

			<label for="ops-topic-date">表示日</label>
			<input id="ops-topic-date" type="date" name="topic_date" required value="<?php echo esc_attr($fields['date']); ?>">

			<label>カテゴリ（任意）</label>
			<div class="ops-checkgrid">
				<?php foreach (shukatsu_ops_terms('topic_category') as $term) : ?>
					<label class="ops-check"><input type="checkbox" name="topic_category[]" value="<?php echo (int) $term->term_id; ?>" <?php checked(in_array($term->term_id, $cat_selected, true)); ?>> <?php echo esc_html($term->name); ?></label>
				<?php endforeach; ?>
			</div>

			<label>リンク</label>
			<div class="ops-assist-modes" role="radiogroup" aria-label="リンク種類">
				<label class="ops-check"><input type="radio" name="topic_link_type" value="none" <?php checked($fields['link_type'], 'none'); ?>> なし</label>
				<label class="ops-check"><input type="radio" name="topic_link_type" value="internal" <?php checked($fields['link_type'], 'internal'); ?>> サイト内ページ</label>
				<label class="ops-check"><input type="radio" name="topic_link_type" value="external" <?php checked($fields['link_type'], 'external'); ?>> 外部URL</label>
			</div>
			<div id="ops-topic-link-wrap" <?php echo $fields['link_type'] === 'none' ? 'hidden' : ''; ?>>
				<label for="ops-topic-link-url">リンク先URL</label>
				<input id="ops-topic-link-url" type="text" name="topic_link_url" value="<?php echo esc_attr($link_url); ?>" placeholder="https://shukatsu.or.jp/... または /columns/...">
				<p class="ops-hint">サイト内はフルURLでも「/columns/」のようなパスでも可。外部は https:// から入力。</p>
			</div>

			<label class="ops-check"><input type="checkbox" name="topic_pin" value="1" <?php checked($fields['pin']); ?>> トップに固定（一覧の先頭に寄せる）</label>

			<div class="ops-actions">
				<button type="button" class="ops-btn ops-btn--primary" data-ops-action="save-topic">下書き保存</button>
				<button type="button" class="ops-btn ops-btn--publish" data-ops-action="publish-topic">公開する</button>
				<?php if ($ops_id) : ?>
					<?php if ($status === 'publish') : ?>
						<a class="ops-btn" href="<?php echo esc_url(home_url('/')); ?>" target="_blank" rel="noopener">トップで確認</a>
					<?php endif; ?>
					<button type="button" class="ops-btn ops-btn--danger" data-ops-action="delete-topic">削除する</button>
				<?php endif; ?>
			</div>
			<p class="ops-hint">公開するとトップの TOPICS に反映されます。承認フローはありません。日付・固有名詞・URLは公開前に必ず確認してください。</p>
		</form>
	</section>
	<?php
}

function shukatsu_ops_view_dancing_list(): void {
	$rows = shukatsu_ops_list_dance_posts();
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1>踊活の日程</h1>
				<p class="ops-lead">レッスン・ダンスホールなどの予定を登録します。公開するとトップと踊活ページに表示されます。</p>
			</div>
			<a class="ops-btn ops-btn--primary" href="<?php echo esc_url(shukatsu_ops_url('dancing/new')); ?>">新しい日程</a>
		</div>
		<?php shukatsu_ops_render_table($rows); ?>
	</section>
	<?php
}

function shukatsu_ops_view_dance_edit(int $ops_id): void {
	$post = $ops_id ? get_post($ops_id) : null;
	if ($ops_id && (!$post || $post->post_type !== 'shukatsu_dance')) {
		echo '<section class="ops-panel"><h1>見つかりません</h1></section>';
		return;
	}
	$title = $post ? $post->post_title : '';
	$fields = shukatsu_ops_get_dance_fields($ops_id ?: 0);
	$status = $post ? $post->post_status : 'draft';
	$kinds = shukatsu_ops_dance_kind_labels();
	$presets = shukatsu_ops_dance_venue_presets();
	$paste_templates = shukatsu_ops_dance_paste_templates($ops_id ?: 0);
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1><?php echo $ops_id ? '日程を編集' : '新しい日程'; ?></h1>
				<p class="ops-lead">
					状態: <strong><?php echo esc_html($status === 'publish' ? '公開中（データ準備）' : '下書き'); ?></strong>
					<?php if ($fields['cancelled']) : ?> · <span class="ops-flag ops-flag--warn">中止</span><?php endif; ?>
				</p>
			</div>
			<a class="ops-btn" href="<?php echo esc_url(shukatsu_ops_url('dancing')); ?>">一覧へ戻る</a>
		</div>

		<form id="ops-dance-form" class="ops-form" data-post-id="<?php echo (int) $ops_id; ?>">
			<?php if ($paste_templates) : ?>
				<div class="ops-dance-paste" id="ops-dance-paste">
					<label for="ops-dance-paste-select">過去の予定からコピー</label>
					<div class="ops-dance-paste__row">
						<select id="ops-dance-paste-select">
							<option value="">選択してください</option>
							<?php foreach ($paste_templates as $tpl) : ?>
								<option value="<?php echo (int) $tpl['id']; ?>"><?php echo esc_html($tpl['label']); ?></option>
							<?php endforeach; ?>
						</select>
						<button type="button" class="ops-btn" id="ops-dance-paste-btn">日付以外を貼り付け</button>
					</div>
					<p class="ops-hint">タイトル・種類・時間・会場・メモをコピーします。開催日と「中止」はそのまま残します。</p>
					<script type="application/json" id="ops-dance-paste-data"><?php echo wp_json_encode($paste_templates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?></script>
				</div>
			<?php endif; ?>

			<label for="ops-dance-title">タイトル</label>
			<input id="ops-dance-title" type="text" name="title" required maxlength="120" value="<?php echo esc_attr($title); ?>" placeholder="例：高島平踊活会／初級と中級">

			<label>種類</label>
			<div class="ops-assist-modes" role="radiogroup" aria-label="種類">
				<?php foreach ($kinds as $key => $label) : ?>
					<label class="ops-check"><input type="radio" name="dance_kind" value="<?php echo esc_attr($key); ?>" <?php checked($fields['kind'], $key); ?>> <?php echo esc_html($label); ?></label>
				<?php endforeach; ?>
			</div>

			<div class="ops-grid-2">
				<div>
					<label for="ops-dance-date">開催日</label>
					<input id="ops-dance-date" type="date" name="dance_date" required value="<?php echo esc_attr($fields['date']); ?>">
				</div>
				<div>
					<label>時間</label>
					<div class="ops-grid-2" style="gap:8px;">
						<input type="time" name="dance_start_time" value="<?php echo esc_attr($fields['start_time']); ?>" aria-label="開始時刻">
						<input type="time" name="dance_end_time" value="<?php echo esc_attr($fields['end_time']); ?>" aria-label="終了時刻">
					</div>
				</div>
			</div>

			<label for="ops-dance-venue">会場</label>
			<input id="ops-dance-venue" type="text" name="dance_venue" list="ops-dance-venue-list" required value="<?php echo esc_attr($fields['venue']); ?>" placeholder="例：みなとパーク芝浦 スポーツセンター">
			<datalist id="ops-dance-venue-list">
				<?php foreach ($presets as $preset) : ?>
					<option value="<?php echo esc_attr($preset); ?>"></option>
				<?php endforeach; ?>
			</datalist>

			<label for="ops-dance-venue-detail">会場の補足（住所・部屋名など・任意）</label>
			<input id="ops-dance-venue-detail" type="text" name="dance_venue_detail" value="<?php echo esc_attr($fields['venue_detail']); ?>" placeholder="例：大ホール／確認中のため空欄でも可">

			<label for="ops-dance-note">メモ（任意）</label>
			<textarea id="ops-dance-note" name="dance_note" rows="3" placeholder="例：予約制、更衣室あり、中止時の連絡先など"><?php echo esc_textarea($fields['note']); ?></textarea>

			<label class="ops-check"><input type="checkbox" name="dance_cancelled" value="1" <?php checked($fields['cancelled']); ?>> この回は中止</label>

			<div class="ops-actions">
				<button type="button" class="ops-btn ops-btn--primary" data-ops-action="save-dance">下書き保存</button>
				<button type="button" class="ops-btn ops-btn--publish" data-ops-action="publish-dance">公開する</button>
				<?php if ($ops_id) : ?>
					<button type="button" class="ops-btn ops-btn--danger" data-ops-action="delete-dance">削除する</button>
				<?php endif; ?>
			</div>
			<p class="ops-hint">いまは更新ツール内でのデータ準備です。ホームページ／踊活ページへの表示は、会場・日程の確認後に接続します。</p>
		</form>
	</section>
	<?php
}

function shukatsu_ops_view_cases_list(): void {
	$rows = shukatsu_ops_list_posts('shukatsu_case');
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1>解決事例</h1>
				<p class="ops-lead">項目を入力して保存 → 「文章を作る」→ 内容を確認して公開、の順です。</p>
			</div>
			<a class="ops-btn ops-btn--primary" href="<?php echo esc_url(shukatsu_ops_url('cases/new')); ?>">新しい事例</a>
		</div>
		<?php shukatsu_ops_render_table($rows); ?>
	</section>
	<?php
}

function shukatsu_ops_view_column_edit(int $ops_id): void {
	$post = $ops_id ? get_post($ops_id) : null;
	if ($ops_id && (!$post || $post->post_type !== 'shukatsu_column')) {
		echo '<section class="ops-panel"><h1>見つかりません</h1></section>';
		return;
	}
	$title = $post ? $post->post_title : '';
	$content = $post ? $post->post_content : '';
	$meta_description = (string) (shukatsu_ops_get_meta($ops_id ?: 0, 'meta_description') ?: '');
	$source_urls = shukatsu_ops_get_column_source_urls($ops_id ?: 0);
	// 保存済みが空なら本文内リンクを初期候補に（確認用）
	if (!$source_urls && $content !== '') {
		$source_urls = shukatsu_ops_extract_urls_from_text($content);
	}
	$source_urls_text = implode("\n", $source_urls);
	$needs_review = $ops_id ? shukatsu_ops_get_bool($ops_id, 'needs_review') : true;
	$ai = $ops_id ? shukatsu_ops_get_bool($ops_id, 'ai_generated') : false;
	$selected = $ops_id ? wp_list_pluck(wp_get_post_terms($ops_id, 'column_category'), 'term_id') : [];
	$status = $post ? $post->post_status : 'draft';
	$presets = shukatsu_ops_column_length_presets();
	$target_length = (string) (shukatsu_ops_get_meta($ops_id ?: 0, 'target_length') ?: 'standard');
	if (!isset($presets[ $target_length ])) {
		$target_length = 'standard';
	}

	$review = null;
	$review_json = $ops_id ? (string) shukatsu_ops_get_ai_meta($ops_id, 'ai_review_json', '') : '';
	if ($review_json !== '') {
		$decoded = json_decode($review_json, true);
		if (is_array($decoded)) {
			$review = $decoded;
		}
	}
	$assist_log = $ops_id ? shukatsu_ops_get_ai_meta($ops_id, 'ai_assist_log', []) : [];
	if (!is_array($assist_log)) {
		$assist_log = [];
	}
	$research_notes = $ops_id ? (string) shukatsu_ops_get_ai_meta($ops_id, 'ai_research_notes', '') : '';
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1><?php echo $ops_id ? 'コラムを編集' : '新しいコラム'; ?></h1>
				<p class="ops-lead">
					状態: <strong><?php echo esc_html($status === 'publish' ? '公開中' : '下書き'); ?></strong>
					<?php if ($ai) : ?> · AI下書き<?php endif; ?>
					<?php if ($needs_review) : ?> · <span class="ops-flag ops-flag--warn">要確認</span><?php endif; ?>
				</p>
			</div>
			<a class="ops-btn" href="<?php echo esc_url(shukatsu_ops_url('columns')); ?>">一覧へ戻る</a>
		</div>

		<?php if ($review) : ?>
			<div class="ops-review-wrap" id="ops-ai-review">
				<?php echo shukatsu_ops_format_ai_review_html($review); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped inside helper ?>
				<?php if ($research_notes !== '') : ?>
					<details class="ops-details">
						<summary>生成時の調査メモ（非公開）</summary>
						<p><?php echo esc_html($research_notes); ?></p>
					</details>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<form id="ops-column-form" class="ops-form" data-post-id="<?php echo (int) $ops_id; ?>">
			<label>タイトル</label>
			<input type="text" name="title" required value="<?php echo esc_attr($title); ?>">

			<label>カテゴリ</label>
			<div class="ops-checkgrid">
				<?php foreach (shukatsu_ops_terms('column_category') as $term) : ?>
					<label class="ops-check"><input type="checkbox" name="column_category[]" value="<?php echo (int) $term->term_id; ?>" <?php checked(in_array($term->term_id, $selected, true)); ?>> <?php echo esc_html($term->name); ?></label>
				<?php endforeach; ?>
			</div>

			<label>本文の長さ（目安）</label>
			<div class="ops-length" id="ops-length-presets" data-selected="<?php echo esc_attr($target_length); ?>">
				<?php foreach ($presets as $key => $preset) : ?>
					<label class="ops-length__card">
						<input type="radio" name="target_length" value="<?php echo esc_attr($key); ?>" <?php checked($target_length, $key); ?>>
						<span class="ops-length__label"><?php echo esc_html($preset['label']); ?></span>
						<span class="ops-length__chars">約<?php echo (int) $preset['chars']; ?>字</span>
						<span class="ops-length__meta">読む目安 <?php echo esc_html($preset['minutes']); ?></span>
						<span class="ops-length__volume"><?php echo esc_html($preset['volume']); ?></span>
					</label>
				<?php endforeach; ?>
			</div>
			<div class="ops-length-status" id="ops-length-status" aria-live="polite"></div>

			<label>本文</label>
			<?php shukatsu_ops_render_content_editor($content, 'ops-column-content'); ?>
			<p class="ops-hint">サイトに出るのと同じ見た目です。文章を直すときは、このまま打ち替えてください。</p>

			<label>検索用の短い説明</label>
			<textarea name="meta_description" rows="2"><?php echo esc_textarea($meta_description); ?></textarea>

			<label>記事生成に使用したリンク</label>
			<p class="ops-hint" style="margin-top:0;">公式サイト・報道・PDFなど、この記事の根拠にしたURLです。1行に1つ。担当者はここで全部開けて確認できます。</p>
			<textarea name="source_urls" id="ops-source-urls" rows="4" placeholder="https://www.example.go.jp/...&#10;https://www.example.go.jp/.../file.pdf"><?php echo esc_textarea($source_urls_text); ?></textarea>
			<div class="ops-actions" style="margin-top:10px;">
				<button type="button" class="ops-btn" id="ops-import-body-links">本文からリンクを取り込む</button>
			</div>
			<div class="ops-source-list" id="ops-source-list" aria-live="polite"></div>

			<label class="ops-check"><input type="checkbox" name="needs_review" value="1" <?php checked($needs_review); ?>> まだ確認が必要（要確認）※チェック中は公開できません</label>
			<?php if ($review) : ?>
				<label class="ops-check ops-check--important"><input type="checkbox" name="ai_review_ack" value="1"> AIチェック結果を確認した（公開時に必須）</label>
			<?php endif; ?>

			<div class="ops-actions">
				<button type="button" class="ops-btn ops-btn--primary" data-ops-action="save-column">下書き保存</button>
				<?php if ($ops_id) : ?>
					<button type="button" class="ops-btn ops-btn--publish" data-ops-action="publish-column">公開する</button>
					<?php if ($status === 'publish') : ?>
						<a class="ops-btn" href="<?php echo esc_url((string) get_permalink($ops_id)); ?>" target="_blank" rel="noopener">サイトで見る</a>
					<?php endif; ?>
					<button type="button" class="ops-btn ops-btn--danger" data-ops-action="delete-column">削除する</button>
				<?php endif; ?>
			</div>
		</form>

		<?php if ($ops_id) : ?>
			<section class="ops-assist" id="ops-assist-panel">
				<h2>AIに依頼・質問</h2>
				<p class="ops-lead">わかりにくい箇所の説明を聞いたり、直し方を依頼できます。修正案は上のフォームに入ります（保存は別途）。</p>
				<div id="ops-assist-log">
					<?php echo shukatsu_ops_format_assist_log_html($assist_log); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
				</div>
				<div class="ops-assist-form">
					<div class="ops-assist-modes" role="radiogroup" aria-label="依頼の種類">
						<label class="ops-check"><input type="radio" name="assist_mode" value="revise" checked> 修正を依頼</label>
						<label class="ops-check"><input type="radio" name="assist_mode" value="ask"> 質問する</label>
					</div>
					<label for="ops-assist-message">内容</label>
					<textarea id="ops-assist-message" rows="12" placeholder="例（修正）: 2つ目の見出しの金額表記を最新にして&#10;例（質問）: 「死後事務」と「成年後見」の違いをこの記事ではどう書けばよい？"></textarea>
					<div class="ops-actions">
						<button type="button" class="ops-btn ops-btn--primary" id="ops-assist-submit">AIに送る</button>
					</div>
					<p class="ops-hint">送信後は「要確認」が再びONになります。反映内容を読んでから保存・公開してください。</p>
				</div>
			</section>
		<?php endif; ?>
	</section>
	<?php
}

function shukatsu_ops_view_case_edit(int $ops_id): void {
	$post = $ops_id ? get_post($ops_id) : null;
	if ($ops_id && (!$post || $post->post_type !== 'shukatsu_case')) {
		echo '<section class="ops-panel"><h1>見つかりません</h1></section>';
		return;
	}
	$g = static function (string $key) use ($ops_id) {
		return $ops_id ? shukatsu_ops_get_meta($ops_id, $key) : '';
	};
	$actions_selected = $g('case_actions');
	if (!is_array($actions_selected)) {
		$actions_selected = $actions_selected ? [$actions_selected] : [];
	}
	$cat_selected = $ops_id ? wp_list_pluck(wp_get_post_terms($ops_id, 'case_category'), 'term_id') : [];
	$needs_review = $ops_id ? shukatsu_ops_get_bool($ops_id, 'needs_review') : true;
	$anonymized = $ops_id ? shukatsu_ops_get_bool($ops_id, 'case_anonymized') : false;
	$ai = $ops_id ? shukatsu_ops_get_bool($ops_id, 'ai_generated') : false;
	$status = $post ? $post->post_status : 'draft';
	$action_choices = ['身元保証契約締結', '施設入居手続き代行', '緊急連絡先対応', '死後事務委任契約', '財産管理サポート', '成年後見制度利用支援'];
	?>
	<section class="ops-panel">
		<div class="ops-panel__head">
			<div>
				<h1><?php echo $ops_id ? '解決事例を編集' : '新しい解決事例'; ?></h1>
				<p class="ops-lead">
					状態: <strong><?php echo esc_html($status === 'publish' ? '公開中' : '下書き'); ?></strong>
					<?php if ($ai) : ?> · AI下書き<?php endif; ?>
					<?php if ($needs_review) : ?> · <span class="ops-flag ops-flag--warn">要確認</span><?php endif; ?>
				</p>
			</div>
			<a class="ops-btn" href="<?php echo esc_url(shukatsu_ops_url('cases')); ?>">一覧へ戻る</a>
		</div>

		<form id="ops-case-form" class="ops-form" data-post-id="<?php echo (int) $ops_id; ?>">
			<ol class="ops-steps">
				<li>下の項目を入力して「下書き保存」</li>
				<li>「文章を作る」で本文を生成</li>
				<li>本文を確認し「公開する」</li>
			</ol>

			<label>タイトル（任意・空欄ならAIが作成）</label>
			<?php
			$case_title = (string) ($post->post_title ?? '');
			if ($case_title === '（仮）新しい解決事例') {
				$case_title = '';
			}
			?>
			<input type="text" name="title" value="<?php echo esc_attr($case_title); ?>" placeholder="例：入院時の身元保証｜病院MSWからの相談" maxlength="120">

			<div class="ops-grid-2">
				<div>
					<label>相談者属性</label>
					<select name="case_audience">
						<option value="">選択してください</option>
						<?php foreach (['本人', 'ご家族', 'ケアマネジャー', '病院MSW', '地域包括支援センター', '介護施設', '紹介会社'] as $opt) : ?>
							<option value="<?php echo esc_attr($opt); ?>" <?php selected((string) $g('case_audience'), $opt); ?>><?php echo esc_html($opt); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div>
					<label>年代</label>
					<select name="case_age_band">
						<option value="">選択してください</option>
						<?php foreach (['60代', '70代', '80代', '90代以上'] as $opt) : ?>
							<option value="<?php echo esc_attr($opt); ?>" <?php selected((string) $g('case_age_band'), $opt); ?>><?php echo esc_html($opt); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div>
					<label>家族構成</label>
					<select name="case_family">
						<option value="">選択してください</option>
						<?php foreach (['独居', '配偶者あり', '子と同居', '子はいるが疎遠', '親族なし'] as $opt) : ?>
							<option value="<?php echo esc_attr($opt); ?>" <?php selected((string) $g('case_family'), $opt); ?>><?php echo esc_html($opt); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div>
					<label>対応にかかった期間</label>
					<select name="case_period">
						<option value="">選択してください</option>
						<?php foreach (['即日', '1週間以内', '1ヶ月以内', '3ヶ月以内', '3ヶ月以上'] as $opt) : ?>
							<option value="<?php echo esc_attr($opt); ?>" <?php selected((string) $g('case_period'), $opt); ?>><?php echo esc_html($opt); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
				<div>
					<label>結果ステータス</label>
					<select name="case_result">
						<option value="">選択してください</option>
						<?php foreach (['解決・契約継続中', '解決・支援終了', '他機関へ紹介', '継続対応中'] as $opt) : ?>
							<option value="<?php echo esc_attr($opt); ?>" <?php selected((string) $g('case_result'), $opt); ?>><?php echo esc_html($opt); ?></option>
						<?php endforeach; ?>
					</select>
				</div>
			</div>

			<label>相談カテゴリ（複数可）</label>
			<div class="ops-checkgrid">
				<?php foreach (shukatsu_ops_terms('case_category') as $term) : ?>
					<label class="ops-check"><input type="checkbox" name="case_category[]" value="<?php echo (int) $term->term_id; ?>" <?php checked(in_array($term->term_id, $cat_selected, true)); ?>> <?php echo esc_html($term->name); ?></label>
				<?php endforeach; ?>
			</div>

			<label>主な対応内容（複数可）</label>
			<div class="ops-checkgrid">
				<?php foreach ($action_choices as $opt) : ?>
					<label class="ops-check"><input type="checkbox" name="case_actions[]" value="<?php echo esc_attr($opt); ?>" <?php checked(in_array($opt, $actions_selected, true)); ?>> <?php echo esc_html($opt); ?></label>
				<?php endforeach; ?>
			</div>

			<label>相談の背景・きっかけ（1〜2文）</label>
			<textarea name="case_background" rows="3"><?php echo esc_textarea((string) $g('case_background')); ?></textarea>

			<label>対応のポイント・工夫した点（1〜2文）</label>
			<textarea name="case_point_note" rows="3"><?php echo esc_textarea((string) $g('case_point_note')); ?></textarea>

			<label class="ops-check ops-check--important"><input type="checkbox" name="case_anonymized" value="1" <?php checked($anonymized); ?>> 個人が特定できる情報を含めていない（匿名化確認）</label>
			<label class="ops-check"><input type="checkbox" name="needs_review" value="1" <?php checked($needs_review); ?>> まだ確認が必要（要確認）</label>

			<label>検索用の短い説明（任意・空欄ならAIが作成）</label>
			<textarea name="meta_description" rows="2" placeholder="検索結果に出す80〜120字程度の説明。空欄なら文章作成時にAIが書きます。"><?php echo esc_textarea((string) $g('meta_description')); ?></textarea>

			<label>本文（AI生成後に確認・修正）</label>
			<?php shukatsu_ops_render_content_editor((string) ($post->post_content ?? ''), 'ops-case-content'); ?>
			<p class="ops-hint">サイトに出るのと同じ見た目です。文章を直すときは、このまま打ち替えてください。</p>

			<div class="ops-actions">
				<button type="button" class="ops-btn ops-btn--primary" data-ops-action="save-case">下書き保存</button>
				<?php if ($ops_id) : ?>
					<button type="button" class="ops-btn" data-ops-action="ai-case">文章を作る（AI）</button>
					<button type="button" class="ops-btn ops-btn--publish" data-ops-action="publish-case">公開する</button>
					<?php if ($status === 'publish') : ?>
						<a class="ops-btn" href="<?php echo esc_url((string) get_permalink($ops_id)); ?>" target="_blank" rel="noopener">サイトで見る</a>
					<?php endif; ?>
					<button type="button" class="ops-btn ops-btn--danger" data-ops-action="delete-case">削除する</button>
				<?php endif; ?>
			</div>
			<p class="ops-hint">「文章を作る」の前に、必ず一度「下書き保存」してください。タイトル・検索用説明は空欄ならAIが作成し、入力済みならそのまま残します。</p>
		</form>
	</section>
	<?php
}

/**
 * 本文を公開ページに近いHTMLへ（タグなしなら段落化）
 */
function shukatsu_ops_prepare_content_html(string $content): string {
	$content = trim($content);
	if ($content === '') {
		return '';
	}
	if (!preg_match('/<(p|h[1-6]|ul|ol|li|table|blockquote|div)\b/i', $content)) {
		$content = wpautop($content);
	}
	return $content;
}

/**
 * コラム・事例の本文エディタ（公開ページと同じ見た目）
 */
function shukatsu_ops_render_content_editor(string $content, string $textarea_id): void {
	$html = shukatsu_ops_prepare_content_html($content);
	?>
	<div class="ops-visual" data-ops-visual>
		<div class="ops-visual__toolbar" role="toolbar" aria-label="本文の書式">
			<button type="button" class="ops-visual__btn" data-cmd="h2">見出し</button>
			<button type="button" class="ops-visual__btn" data-cmd="p">本文</button>
			<button type="button" class="ops-visual__btn" data-cmd="bold">太字</button>
			<button type="button" class="ops-visual__btn" data-cmd="ul">箇条書き</button>
			<button type="button" class="ops-visual__btn" data-cmd="link">リンク</button>
		</div>
		<div
			class="ops-visual__canvas<?php echo $html === '' ? ' is-empty' : ''; ?>"
			contenteditable="true"
			role="textbox"
			aria-multiline="true"
			data-placeholder="文章を作ると、ここにサイトと同じ見た目で本文が出ます。"
		><?php echo wp_kses_post($html); ?></div>
		<textarea name="content" id="<?php echo esc_attr($textarea_id); ?>" class="ops-content" hidden><?php echo esc_textarea($content); ?></textarea>
	</div>
	<?php
}

/** @param list<array<string,mixed>> $rows */
function shukatsu_ops_render_table(array $rows): void {
	if (!$rows) {
		echo '<p class="ops-empty">まだ記事がありません。「新しく作る」から追加できます。</p>';
		return;
	}
	echo '<div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>タイトル</th><th>状態</th><th>フラグ</th><th>更新</th><th></th></tr></thead><tbody>';
	foreach ($rows as $row) {
		$flags = $row['flags'] ? esc_html(implode(' / ', $row['flags'])) : '—';
		$edit = esc_url((string) $row['edit_url']);
		$title = esc_html((string) $row['title']);
		printf(
			'<tr class="ops-row-link"><td><a class="ops-title-link" href="%1$s">%2$s</a></td><td>%3$s</td><td>%4$s</td><td>%5$s</td><td><a class="ops-link" href="%1$s">開く</a></td></tr>',
			$edit,
			$title,
			esc_html((string) $row['status']),
			$flags,
			esc_html((string) $row['modified'])
		);
	}
	echo '</tbody></table></div>';
}

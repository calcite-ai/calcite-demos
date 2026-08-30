<?php
/**
 * 設定画面: キー到着前のモック検証トグル / 接続状態の表示
 */
if (!defined('ABSPATH')) {
	exit;
}

add_action('admin_menu', function () {
	add_options_page(
		'終活コンテンツ',
		'終活コンテンツ',
		'manage_options',
		'shukatsu-content',
		'shukatsu_content_render_settings_page'
	);
});

add_action('admin_init', function () {
	register_setting('shukatsu_content', 'shukatsu_ai_allow_mock', [
		'type'              => 'boolean',
		'sanitize_callback' => static function ($v) {
			return (bool) $v;
		},
		'default'           => false,
	]);
});

function shukatsu_content_render_settings_page() {
	if (!current_user_can('manage_options')) {
		return;
	}
	$has_const_key = defined('SHUKATSU_ANTHROPIC_API_KEY') && is_string(SHUKATSU_ANTHROPIC_API_KEY) && trim(SHUKATSU_ANTHROPIC_API_KEY) !== '';
	$has_opt_key = (string) get_option('shukatsu_anthropic_api_key', '') !== '';
	$allow_mock = shukatsu_content_allow_mock();
	$next_ts = function_exists('wp_next_scheduled') ? wp_next_scheduled(SHUKATSU_MONTHLY_NEWS_HOOK) : false;
	$last_ym = (string) get_option(SHUKATSU_MONTHLY_NEWS_OPTION_LAST, '');
	$last_log = get_option(SHUKATSU_MONTHLY_NEWS_OPTION_LOG, null);
	$cron_token = function_exists('shukatsu_monthly_news_cron_token') ? shukatsu_monthly_news_cron_token() : '';
	$flash = isset($_GET['shukatsu_news_flash']) ? sanitize_text_field(wp_unslash((string) $_GET['shukatsu_news_flash'])) : '';
	?>
	<div class="wrap">
		<h1>終活コンテンツ（半自動）</h1>
		<p>コラム・事例AI下書きと、ニュース月次自動公開の接続状態です。会社APIキー到着前はモック検証のみ有効にできます。</p>
		<?php if ($flash !== '') : ?>
			<div class="notice notice-info is-dismissible"><p><?php echo esc_html($flash); ?></p></div>
		<?php endif; ?>

		<table class="widefat striped" style="max-width:720px;margin:1rem 0;">
			<tbody>
				<tr>
					<th>Anthropic APIキー（wp-config 定数）</th>
					<td><?php echo $has_const_key ? '<span style="color:#00a32a;">設定済み</span>' : '<span style="color:#b32d2e;">未設定</span>'; ?></td>
				</tr>
				<tr>
					<th>モック検証</th>
					<td><?php echo $allow_mock ? '<span style="color:#dba617;">ON（キー無しでもモック本文可）</span>' : 'OFF'; ?></td>
				</tr>
				<tr>
					<th>自動公開（通常コラム・事例）</th>
					<td>禁止（常に draft → 人が公開）</td>
				</tr>
				<tr>
					<th>ニュース月次自動公開</th>
					<td>
						許可（カテゴリ「ニュース」のみ・毎月1日 10:00 サイトTZ）<br>
						次回: <?php echo $next_ts ? esc_html(wp_date('Y-m-d H:i', $next_ts)) : '未スケジュール'; ?><br>
						直近実行月: <?php echo $last_ym !== '' ? esc_html($last_ym) : 'なし'; ?>
						<?php if (is_array($last_log) && !empty($last_log['message'])) : ?>
							<br>ログ: <?php echo esc_html((string) $last_log['message']); ?>
						<?php endif; ?>
					</td>
				</tr>
			</tbody>
		</table>

		<form method="post" action="options.php">
			<?php settings_fields('shukatsu_content'); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row">キー到着前のモックを許可</th>
					<td>
						<label>
							<input type="checkbox" name="shukatsu_ai_allow_mock" value="1" <?php checked(get_option('shukatsu_ai_allow_mock'), true); ?> />
							事例編集画面で「モック下書きを挿入」を使えるようにする
						</label>
						<p class="description">会社キー投入後は必ずOFFにしてください。モック本文を公開しないこと。</p>
					</td>
				</tr>
			</table>
			<?php submit_button('変更を保存'); ?>
		</form>

		<h2>ニュース月次自動公開</h2>
		<p>生成ルールはコラムと同じ（Web検索・一次情報・断定抑制）。<strong>ニュースのみ</strong>自動で <code>publish</code> します。AI再チェックが <code>critical</code> のときは下書きのみ。</p>
		<p>
			<a class="button button-secondary" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=shukatsu_monthly_news_run_now'), 'shukatsu_monthly_news_run_now')); ?>">今すぐ1本生成・公開（テスト）</a>
			<a class="button" href="<?php echo esc_url(wp_nonce_url(admin_url('admin-post.php?action=shukatsu_monthly_news_run_now&force=1'), 'shukatsu_monthly_news_run_now')); ?>">強制再実行（同月でも可）</a>
		</p>
		<?php if ($cron_token !== '') : ?>
			<p class="description">外部トリガ用トークン（GitHub Actions 等）。ヘッダ <code>X-Shukatsu-Cron-Token</code> またはクエリ <code>token</code>。</p>
			<p><code style="word-break:break-all;"><?php echo esc_html($cron_token); ?></code></p>
			<p class="description">エンドポイント: <code>POST <?php echo esc_html(rest_url('shukatsu/v1/monthly-news/run')); ?></code></p>
		<?php endif; ?>

		<h2>キー到着後の手順</h2>
		<ol>
			<li><code>wp-config.php</code> に <code>define('SHUKATSU_ANTHROPIC_API_KEY', 'sk-ant-...');</code></li>
			<li>この画面のモックを OFF</li>
			<li>コラム用に下書き専用ユーザー + Application Password（<code>docs/wp-draft-user-setup.md</code>）</li>
			<li><code>docs/phase3-connect-checklist.md</code> を実行</li>
			<li>ニュース自動公開の外部トリガは <code>docs/monthly-news-auto.md</code></li>
		</ol>
		<?php if ($has_opt_key) : ?>
			<p class="description">※ options にキー残骸があります。定数へ移したら options の <code>shukatsu_anthropic_api_key</code> は削除してください。</p>
		<?php endif; ?>
	</div>
	<?php
}

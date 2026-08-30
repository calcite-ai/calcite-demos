<?php
/**
 * 事例: Intake 後に「AI下書きを生成」。自動 publish 禁止。
 * キー未設定時はモック許可時のみ本文挿入可。
 */
if (!defined('ABSPATH')) {
	exit;
}

add_action('add_meta_boxes', function () {
	add_meta_box(
		'shukatsu_case_ai_draft',
		'AI下書き生成',
		'shukatsu_content_render_case_ai_metabox',
		'shukatsu_case',
		'side',
		'high'
	);
});

function shukatsu_content_allow_mock(): bool {
	if (defined('SHUKATSU_AI_ALLOW_MOCK') && SHUKATSU_AI_ALLOW_MOCK) {
		return true;
	}
	return (bool) get_option('shukatsu_ai_allow_mock', false);
}

function shukatsu_content_render_case_ai_metabox($post) {
	wp_nonce_field('shukatsu_case_ai_draft', 'shukatsu_case_ai_draft_nonce');
	$has_key = shukatsu_content_anthropic_api_key() !== '';
	$allow_mock = shukatsu_content_allow_mock();
	?>
	<p style="margin-top:0;">Intake（属性・背景・ポイント・匿名化など）を<strong>下書き保存</strong>したうえで実行してください。結果は<strong>下書きのまま</strong>本文へ入ります。</p>
	<?php if (!$has_key && !$allow_mock) : ?>
		<p style="color:#b32d2e;"><strong>APIキー未設定</strong> — 会社キー到着後に <code>SHUKATSU_ANTHROPIC_API_KEY</code> を設定してください。それまでは「設定 → 終活コンテンツ」でモック検証をONにできます。</p>
	<?php elseif (!$has_key && $allow_mock) : ?>
		<p style="color:#dba617;">APIキー未設定のため、<strong>モック本文</strong>のみ挿入できます（キー到着前の検証用）。</p>
	<?php endif; ?>
	<p>
		<button type="button" class="button button-primary" id="shukatsu-case-ai-generate" <?php disabled(!$has_key && !$allow_mock); ?>>
			<?php echo $has_key ? 'AI下書きを生成' : 'モック下書きを挿入'; ?>
		</button>
	</p>
	<p id="shukatsu-case-ai-status" style="min-height:1.4em;" aria-live="polite"></p>
	<script>
	(function () {
		const btn = document.getElementById('shukatsu-case-ai-generate');
		const status = document.getElementById('shukatsu-case-ai-status');
		if (!btn) return;
		btn.addEventListener('click', async function () {
			btn.disabled = true;
			status.textContent = '生成中…（数十秒かかることがあります）';
			try {
				const body = new FormData();
				body.append('action', 'shukatsu_generate_case_draft');
				body.append('post_id', '<?php echo (int) $post->ID; ?>');
				body.append('nonce', '<?php echo esc_js(wp_create_nonce('shukatsu_case_ai_draft')); ?>');
				const res = await fetch(ajaxurl, { method: 'POST', body, credentials: 'same-origin' });
				const data = await res.json();
				if (!data || !data.success) {
					status.textContent = (data && data.data && data.data.message) ? data.data.message : '生成に失敗しました';
					btn.disabled = false;
					return;
				}
				status.textContent = data.data.message || '完了しました。ページを再読み込みします。';
				window.setTimeout(function () { window.location.reload(); }, 800);
			} catch (e) {
				status.textContent = '通信エラー: ' + (e && e.message ? e.message : String(e));
				btn.disabled = false;
			}
		});
	})();
	</script>
	<?php
}

add_action('wp_ajax_shukatsu_generate_case_draft', 'shukatsu_content_ajax_generate_case_draft');

function shukatsu_content_ajax_generate_case_draft() {
	if (!current_user_can('edit_posts')) {
		wp_send_json_error(['message' => '権限がありません。'], 403);
	}
	$nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash((string) $_POST['nonce'])) : '';
	if (!wp_verify_nonce($nonce, 'shukatsu_case_ai_draft')) {
		wp_send_json_error(['message' => '不正なリクエストです。'], 403);
	}
	$post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
	$post = get_post($post_id);
	if (!$post || $post->post_type !== 'shukatsu_case') {
		wp_send_json_error(['message' => '事例投稿が見つかりません。'], 404);
	}
	if (!current_user_can('edit_post', $post_id)) {
		wp_send_json_error(['message' => 'この投稿を編集する権限がありません。'], 403);
	}

	$intake = shukatsu_content_collect_case_intake($post_id);
	$missing = shukatsu_content_validate_case_intake($intake);
	if ($missing) {
		wp_send_json_error(['message' => 'Intake が未完了です: ' . implode('、', $missing)]);
	}
	if (empty($intake['case_anonymized'])) {
		wp_send_json_error(['message' => '匿名化確認にチェックを入れて保存してから実行してください。']);
	}

	$api_key = shukatsu_content_anthropic_api_key();
	$allow_mock = shukatsu_content_allow_mock();
	$used_mock = false;

	try {
		if ($api_key !== '') {
			$draft = shukatsu_content_call_claude_case_draft($api_key, $intake);
		} elseif ($allow_mock) {
			$draft = shukatsu_content_mock_case_draft($intake);
			$used_mock = true;
		} else {
			wp_send_json_error(['message' => 'SHUKATSU_ANTHROPIC_API_KEY が未設定です。キー到着前は設定画面でモックをONにしてください。']);
		}
	} catch (Throwable $e) {
		wp_send_json_error(['message' => '生成エラー: ' . $e->getMessage()]);
	}

	$html = (string) ($draft['content'] ?? '');
	$ai_title = trim((string) ($draft['title'] ?? ''));
	$ai_meta = trim((string) ($draft['meta_description'] ?? ''));

	$existing_title = trim((string) $post->post_title);
	$existing_meta = '';
	if (function_exists('get_field')) {
		$existing_meta = trim((string) (get_field('meta_description', $post_id) ?: ''));
	}
	if ($existing_meta === '') {
		$existing_meta = trim((string) get_post_meta($post_id, 'meta_description', true));
	}

	$title_is_placeholder = ($existing_title === '' || $existing_title === '（仮）新しい解決事例');
	if ($title_is_placeholder) {
		$title = $ai_title !== '' ? $ai_title : shukatsu_content_suggest_case_title($intake);
	} else {
		$title = $existing_title;
	}

	if ($existing_meta === '') {
		$meta = $ai_meta !== '' ? $ai_meta : shukatsu_content_fallback_meta_description($intake);
	} else {
		$meta = $existing_meta;
	}
	$meta = shukatsu_content_clip_meta_description($meta);

	$result = wp_update_post([
		'ID'           => $post_id,
		'post_content' => $html,
		'post_status'  => 'draft',
		'post_title'   => $title,
	], true);

	if (is_wp_error($result)) {
		wp_send_json_error(['message' => $result->get_error_message()]);
	}

	if (function_exists('update_field')) {
		update_field('ai_generated', 1, $post_id);
		update_field('needs_review', 1, $post_id);
		update_field('meta_description', $meta, $post_id);
	} else {
		update_post_meta($post_id, 'ai_generated', '1');
		update_post_meta($post_id, 'needs_review', '1');
		update_post_meta($post_id, 'meta_description', $meta);
	}

	clean_post_cache($post_id);

	$parts = ['本文'];
	if ($title_is_placeholder) {
		$parts[] = 'タイトル';
	}
	if ($existing_meta === '') {
		$parts[] = '検索用説明';
	}
	$wrote = implode('・', $parts);

	wp_send_json_success([
		'message' => $used_mock
			? "モック下書きを{$wrote}に書き込みました（要確認・下書き）。"
			: "AI下書きを{$wrote}に書き込みました（要確認・下書き）。内容を確認してから公開してください。",
		'post_id' => $post_id,
		'mock'    => $used_mock,
		'title'   => $title,
	]);
}

function shukatsu_content_anthropic_api_key(): string {
	if (defined('SHUKATSU_ANTHROPIC_API_KEY') && is_string(SHUKATSU_ANTHROPIC_API_KEY)) {
		return trim(SHUKATSU_ANTHROPIC_API_KEY);
	}
	$opt = get_option('shukatsu_anthropic_api_key', '');
	return is_string($opt) ? trim($opt) : '';
}

function shukatsu_content_anthropic_model(): string {
	if (defined('SHUKATSU_ANTHROPIC_MODEL') && is_string(SHUKATSU_ANTHROPIC_MODEL) && SHUKATSU_ANTHROPIC_MODEL !== '') {
		return SHUKATSU_ANTHROPIC_MODEL;
	}
	return 'claude-sonnet-4-5-20250929';
}

/** @return array<string, mixed> */
function shukatsu_content_collect_case_intake(int $post_id): array {
	$get = static function (string $name) use ($post_id) {
		if (function_exists('get_field')) {
			return get_field($name, $post_id);
		}
		return get_post_meta($post_id, $name, true);
	};

	$actions = $get('case_actions');
	if (!is_array($actions)) {
		$actions = $actions ? [$actions] : [];
	}

	$categories = [];
	$terms = get_the_terms($post_id, 'case_category');
	if (is_array($terms)) {
		foreach ($terms as $t) {
			$categories[] = $t->name;
		}
	}

	return [
		'case_audience'   => (string) ($get('case_audience') ?: ''),
		'case_age_band'   => (string) ($get('case_age_band') ?: ''),
		'case_family'     => (string) ($get('case_family') ?: ''),
		'case_period'     => (string) ($get('case_period') ?: ''),
		'case_actions'    => array_values(array_filter(array_map('strval', $actions))),
		'case_result'     => (string) ($get('case_result') ?: ''),
		'case_background' => (string) ($get('case_background') ?: ''),
		'case_point_note' => (string) ($get('case_point_note') ?: ''),
		'case_anonymized' => (bool) $get('case_anonymized'),
		'case_categories' => $categories,
		'post_title'      => (string) get_the_title($post_id),
	];
}

/** @param array<string, mixed> $intake @return list<string> */
function shukatsu_content_validate_case_intake(array $intake): array {
	$missing = [];
	$map = [
		'case_audience'   => '相談者属性',
		'case_age_band'   => '年代',
		'case_family'     => '家族構成',
		'case_period'     => '対応期間',
		'case_result'     => '結果ステータス',
		'case_background' => '相談の背景',
		'case_point_note' => '対応のポイント',
	];
	foreach ($map as $key => $label) {
		if ($intake[$key] === '' || $intake[$key] === null) {
			$missing[] = $label;
		}
	}
	if (empty($intake['case_actions'])) {
		$missing[] = '主な対応内容';
	}
	if (empty($intake['case_categories'])) {
		$missing[] = '相談カテゴリ';
	}
	return $missing;
}

/** @param array<string, mixed> $intake */
function shukatsu_content_suggest_case_title(array $intake): string {
	$cat = $intake['case_categories'][0] ?? '身元保証';
	$aud = $intake['case_audience'] ?: '相談';
	return sprintf('%s｜%sからの解決事例', $cat, $aud);
}

/** @param array<string, mixed> $intake */
function shukatsu_content_fallback_meta_description(array $intake): string {
	$cat = implode('・', $intake['case_categories'] ?: ['身元保証']);
	$aud = $intake['case_audience'] ?: 'ご相談者';
	$bg = trim(wp_strip_all_tags((string) $intake['case_background']));
	$base = sprintf('%sからの%sの解決事例。%s', $aud, $cat, $bg);
	return shukatsu_content_clip_meta_description($base);
}

/**
 * 文の途中で切らない（句点優先）。目安 80〜120 字。
 */
function shukatsu_content_clip_meta_description(string $text): string {
	$text = trim(preg_replace('/\s+/u', ' ', wp_strip_all_tags($text)) ?? '');
	if ($text === '') {
		return '';
	}
	$max = 120;
	if (mb_strlen($text) <= $max) {
		return $text;
	}
	$slice = mb_substr($text, 0, $max);
	foreach (['。', '．', '！', '？', '、'] as $mark) {
		$pos = mb_strrpos($slice, $mark);
		if ($pos !== false && $pos >= 40) {
			$end = $mark === '、' ? $pos : $pos + 1;
			return mb_substr($slice, 0, $end);
		}
	}
	// 区切りが無いときだけ省略記号（途中切れに見せない）
	return rtrim(mb_substr($text, 0, $max - 1)) . '…';
}

/** @param array<string, mixed> $intake */
function shukatsu_content_build_case_prompt(array $intake): string {
	$actions = implode('、', $intake['case_actions']);
	$cats = implode('、', $intake['case_categories']);
	return <<<PROMPT
あなたは終活・身元保証サービスのコーポレートサイト用「解決事例」下書き担当です。
次の Intake データだけを材料に、JSON オブジェクトだけを出力してください（前後の説明文やコードフェンスは不要）。

出力スキーマ:
{
  "title": "記事タイトル（40字以内目安。「課題｜相談経路」の形。AI生成・要確認などの接頭辞は付けない）",
  "meta_description": "検索結果用の説明文。80〜120字の完結した文。途中で切らない。結論先出し。",
  "content": "本文HTML文字列"
}

【絶対条件】
- 個人が特定できる固有名詞・住所・施設名・実名は出さない（すでに匿名化済み前提）
- 制度・料金・医療判断を断定しない。必要なら「要確認」と書く
- 煽り・善悪ジャッジ禁止
- content の見出しは次の順で h2 を使うこと:
  1. （冒頭は p の結論文。h2なしでも可）
  2. この事例で分かること
  3. 相談内容
  4. 課題
  5. 対応内容
  6. 結果
  7. ポイント
- 冒頭は <p><strong>…</strong></p> で結論を1〜2文
- 「この事例で分かること」は <ul><li> を3点前後
- 課題・対応は <ol> または <ul>
- 関連ページリンクは付けない（人間が後で追加）
- meta_description は必ず文として完結させる（最後は「。」が望ましい）

【Intake】
- 相談者属性: {$intake['case_audience']}
- 年代: {$intake['case_age_band']}
- 家族構成: {$intake['case_family']}
- 対応期間: {$intake['case_period']}
- 相談カテゴリ: {$cats}
- 主な対応: {$actions}
- 結果: {$intake['case_result']}
- 背景: {$intake['case_background']}
- 工夫した点: {$intake['case_point_note']}
PROMPT;
}

/**
 * @param array<string, mixed> $intake
 * @return array{title:string,meta_description:string,content:string}
 */
function shukatsu_content_call_claude_case_draft(string $api_key, array $intake): array {
	$prompt = shukatsu_content_build_case_prompt($intake);
	$body = [
		'model'       => shukatsu_content_anthropic_model(),
		'max_tokens'  => 3500,
		'temperature' => 0.3,
		'messages'    => [
			['role' => 'user', 'content' => $prompt],
		],
	];

	$response = wp_remote_post('https://api.anthropic.com/v1/messages', [
		'timeout' => 90,
		'headers' => [
			'content-type'      => 'application/json',
			'x-api-key'         => $api_key,
			'anthropic-version' => '2023-06-01',
		],
		'body' => wp_json_encode($body),
	]);

	if (is_wp_error($response)) {
		throw new RuntimeException($response->get_error_message());
	}
	$code = (int) wp_remote_retrieve_response_code($response);
	$raw = (string) wp_remote_retrieve_body($response);
	$data = json_decode($raw, true);
	if ($code < 200 || $code >= 300) {
		throw new RuntimeException('Claude API HTTP ' . $code . ': ' . mb_substr($raw, 0, 400));
	}
	$text = '';
	if (is_array($data) && !empty($data['content']) && is_array($data['content'])) {
		foreach ($data['content'] as $block) {
			if (($block['type'] ?? '') === 'text') {
				$text .= (string) ($block['text'] ?? '');
			}
		}
	}
	$text = trim($text);
	$text = preg_replace('/^```(?:json)?\s*/i', '', $text) ?? $text;
	$text = preg_replace('/\s*```$/', '', $text) ?? $text;
	$text = trim($text);
	if ($text === '') {
		throw new RuntimeException('Claude の応答が空です。');
	}

	$parsed = json_decode($text, true);
	if (!is_array($parsed)) {
		// 旧形式（HTMLのみ）へのフォールバック
		return [
			'title'            => shukatsu_content_suggest_case_title($intake),
			'meta_description' => shukatsu_content_fallback_meta_description($intake),
			'content'          => $text,
		];
	}

	$content = trim((string) ($parsed['content'] ?? ''));
	if ($content === '') {
		throw new RuntimeException('Claude 応答に本文 content がありません。');
	}
	$content = preg_replace('/^```(?:html)?\s*/i', '', $content) ?? $content;
	$content = preg_replace('/\s*```$/', '', $content) ?? $content;

	return [
		'title'            => trim((string) ($parsed['title'] ?? '')),
		'meta_description' => trim((string) ($parsed['meta_description'] ?? '')),
		'content'          => trim($content),
	];
}

/**
 * @param array<string, mixed> $intake
 * @return array{title:string,meta_description:string,content:string}
 */
function shukatsu_content_mock_case_draft(array $intake): array {
	$cats = esc_html(implode('、', $intake['case_categories']));
	$actions = esc_html(implode('、', $intake['case_actions']));
	$bg = esc_html($intake['case_background']);
	$point = esc_html($intake['case_point_note']);
	$aud = esc_html($intake['case_audience']);
	$age = esc_html($intake['case_age_band']);
	$result = esc_html($intake['case_result']);
	$title = shukatsu_content_suggest_case_title($intake);
	$meta = shukatsu_content_fallback_meta_description($intake);

	$html = <<<HTML
<p><strong>【モック・要確認】{$aud}からの相談を起点に、{$cats}を整えたケースです。</strong> 本テキストは API キー未使用の検証用です。公開前に必ず事実確認してください。</p>
<h2>この事例で分かること</h2>
<ul>
<li>匿名化した Intake から下書きを起こす流れ</li>
<li>多職種連携の進め方の型</li>
<li>結果ステータスの整理（{$result}）</li>
</ul>
<h2>相談内容</h2>
<p>年代: {$age}。背景: {$bg}</p>
<h2>課題</h2>
<ol>
<li>保証・支援の担い手が不足していた</li>
<li>関係者間の情報共有が必要だった</li>
</ol>
<h2>対応内容</h2>
<ol>
<li>{$actions}</li>
<li>工夫した点: {$point}</li>
</ol>
<h2>結果</h2>
<ul>
<li>{$result}</li>
</ul>
<h2>ポイント</h2>
<ul>
<li>{$point}</li>
<li>公開前に個人特定情報がないか再確認する</li>
</ul>
HTML;

	return [
		'title'            => $title,
		'meta_description' => $meta,
		'content'          => $html,
	];
}

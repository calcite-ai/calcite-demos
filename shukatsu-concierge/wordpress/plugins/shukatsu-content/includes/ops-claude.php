<?php
/**
 * /ops/ 向け Claude API ヘルパー（Web検索・再チェック・修正/質問）
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

function shukatsu_ops_claude_api_key(): string {
	if (function_exists('shukatsu_content_anthropic_api_key')) {
		return shukatsu_content_anthropic_api_key();
	}
	return trim((string) get_option('shukatsu_anthropic_api_key', ''));
}

function shukatsu_ops_claude_model(): string {
	if (function_exists('shukatsu_content_anthropic_model')) {
		return shukatsu_content_anthropic_model();
	}
	return 'claude-sonnet-4-5-20250929';
}

/**
 * @return array{type:string,name:string,max_uses:int,allowed_callers:list<string>}
 */
function shukatsu_ops_claude_web_search_tool(): array {
	return [
		'type'            => 'web_search_20250305',
		'name'            => 'web_search',
		'max_uses'        => 6,
		'allowed_callers' => ['direct'],
	];
}

/**
 * Messages API を呼び出す。
 *
 * @param array<string,mixed> $body
 * @return array<string,mixed>|WP_Error
 */
function shukatsu_ops_claude_request(array $body, int $timeout = 180) {
	$api_key = shukatsu_ops_claude_api_key();
	if ($api_key === '') {
		return new WP_Error('no_key', 'APIキーが未設定です。');
	}

	if (!isset($body['model'])) {
		$body['model'] = shukatsu_ops_claude_model();
	}

	$response = wp_remote_post('https://api.anthropic.com/v1/messages', [
		'timeout' => $timeout,
		'headers' => [
			'content-type'      => 'application/json',
			'x-api-key'         => $api_key,
			'anthropic-version' => '2023-06-01',
		],
		'body' => wp_json_encode($body),
	]);

	if (is_wp_error($response)) {
		return $response;
	}

	$code = (int) wp_remote_retrieve_response_code($response);
	$raw  = (string) wp_remote_retrieve_body($response);
	$data = json_decode($raw, true);

	if ($code < 200 || $code >= 300) {
		$msg = 'Claude API HTTP ' . $code;
		if (is_array($data) && !empty($data['error']['message'])) {
			$msg .= ': ' . (string) $data['error']['message'];
		} else {
			$msg .= ': ' . mb_substr($raw, 0, 400);
		}
		return new WP_Error('claude_http', $msg, ['status' => $code, 'body' => $raw]);
	}

	if (!is_array($data)) {
		return new WP_Error('claude_parse', 'Claude応答の解析に失敗しました。');
	}

	return $data;
}

/**
 * @param array<string,mixed> $data
 */
function shukatsu_ops_claude_extract_text(array $data): string {
	$text = '';
	if (empty($data['content']) || !is_array($data['content'])) {
		return '';
	}
	foreach ($data['content'] as $block) {
		if (!is_array($block)) {
			continue;
		}
		if (($block['type'] ?? '') === 'text') {
			$text .= (string) ($block['text'] ?? '');
		}
	}
	return trim($text);
}

/**
 * Web検索の引用URLを集める。
 *
 * @param array<string,mixed> $data
 * @return list<string>
 */
function shukatsu_ops_claude_extract_citation_urls(array $data): array {
	$urls = [];
	if (empty($data['content']) || !is_array($data['content'])) {
		return [];
	}
	foreach ($data['content'] as $block) {
		if (!is_array($block)) {
			continue;
		}
		$citations = $block['citations'] ?? null;
		if (!is_array($citations)) {
			continue;
		}
		foreach ($citations as $cite) {
			if (!is_array($cite)) {
				continue;
			}
			$url = trim((string) ($cite['url'] ?? ''));
			if ($url !== '' && preg_match('#^https?://#i', $url)) {
				$urls[] = $url;
			}
		}
	}
	return array_values(array_unique($urls));
}

/**
 * 応答テキストから最初のJSONオブジェクトを取り出す。
 *
 * @return array<string,mixed>|null
 */
function shukatsu_ops_claude_parse_json_object(string $text): ?array {
	$text = trim($text);
	$text = preg_replace('/^```(?:json)?\s*/i', '', $text) ?? $text;
	$text = preg_replace('/\s*```$/', '', $text) ?? $text;
	$text = trim($text);

	$parsed = json_decode($text, true);
	if (is_array($parsed)) {
		return $parsed;
	}

	$start = strpos($text, '{');
	$end   = strrpos($text, '}');
	if ($start === false || $end === false || $end <= $start) {
		return null;
	}
	$slice = substr($text, $start, $end - $start + 1);
	$parsed = json_decode($slice, true);
	return is_array($parsed) ? $parsed : null;
}

/**
 * @param array<string,mixed> $review
 */
function shukatsu_ops_format_ai_review_html(array $review): string {
	$verdict = (string) ($review['verdict'] ?? 'needs_fix');
	$summary = (string) ($review['summary'] ?? '');
	$issues  = is_array($review['issues'] ?? null) ? $review['issues'] : [];
	$claims  = is_array($review['checked_claims'] ?? null) ? $review['checked_claims'] : [];
	$gaps    = is_array($review['source_gaps'] ?? null) ? $review['source_gaps'] : [];
	$search  = !empty($review['used_web_search']);

	$verdict_label = [
		'ok'          => 'おおむね問題なし（要人間確認）',
		'needs_fix' => '修正・確認推奨',
		'critical'    => '公開前に要対応',
	];
	$label = $verdict_label[ $verdict ] ?? $verdict;

	$html  = '<div class="ops-ai-review ops-ai-review--' . esc_attr($verdict) . '">';
	$html .= '<p class="ops-ai-review__verdict"><strong>AI再チェック:</strong> ' . esc_html($label) . '</p>';
	if ($summary !== '') {
		$html .= '<p class="ops-ai-review__summary">' . esc_html($summary) . '</p>';
	}
	$html .= '<p class="ops-hint">' . ($search ? '生成時にWeb検索を使用しています。' : 'Web検索が使えなかったため、既存知識＋指定ソースのみで生成しています。') . ' この結果は参考です。最終判断は担当者です。</p>';

	if ($issues) {
		$html .= '<h3 class="ops-ai-review__h">指摘事項</h3><ul class="ops-ai-review__list">';
		foreach ($issues as $issue) {
			if (!is_array($issue)) {
				continue;
			}
			$sev  = esc_html((string) ($issue['severity'] ?? ''));
			$loc  = esc_html((string) ($issue['location'] ?? ''));
			$det  = esc_html((string) ($issue['detail'] ?? ''));
			$sug  = esc_html((string) ($issue['suggestion'] ?? ''));
			$html .= '<li><span class="ops-sev ops-sev--' . esc_attr((string) ($issue['severity'] ?? '')) . '">' . $sev . '</span>';
			if ($loc !== '') {
				$html .= ' <em>' . $loc . '</em> — ';
			}
			$html .= $det;
			if ($sug !== '') {
				$html .= ' <span class="ops-muted">→ ' . $sug . '</span>';
			}
			$html .= '</li>';
		}
		$html .= '</ul>';
	}

	if ($claims) {
		$html .= '<h3 class="ops-ai-review__h">事実確認メモ</h3><ul class="ops-ai-review__list">';
		foreach ($claims as $claim) {
			if (!is_array($claim)) {
				continue;
			}
			$html .= '<li><strong>' . esc_html((string) ($claim['status'] ?? '')) . '</strong>: '
				. esc_html((string) ($claim['claim'] ?? ''));
			$note = (string) ($claim['note'] ?? '');
			if ($note !== '') {
				$html .= ' <span class="ops-muted">(' . esc_html($note) . ')</span>';
			}
			$html .= '</li>';
		}
		$html .= '</ul>';
	}

	if ($gaps) {
		$html .= '<h3 class="ops-ai-review__h">ソース不足の疑い</h3><ul class="ops-ai-review__list">';
		foreach ($gaps as $gap) {
			$html .= '<li>' . esc_html((string) $gap) . '</li>';
		}
		$html .= '</ul>';
	}

	$html .= '</div>';
	return $html;
}

/**
 * @param list<array{role?:string,mode?:string,message?:string,reply?:string,at?:string}> $log
 */
function shukatsu_ops_format_assist_log_html(array $log): string {
	if (!$log) {
		return '<p class="ops-hint">まだ会話はありません。下の欄から修正依頼や質問ができます。</p>';
	}
	$html = '<div class="ops-assist-log">';
	foreach (array_slice($log, -12) as $row) {
		if (!is_array($row)) {
			continue;
		}
		$mode = (string) ($row['mode'] ?? 'ask');
		$mode_label = $mode === 'revise' ? '修正依頼' : '質問';
		$html .= '<article class="ops-assist-item">';
		$html .= '<header><span class="ops-assist-mode">' . esc_html($mode_label) . '</span>';
		if (!empty($row['at'])) {
			$html .= ' <time>' . esc_html((string) $row['at']) . '</time>';
		}
		$html .= '</header>';
		$html .= '<p class="ops-assist-q"><strong>あなた:</strong> ' . esc_html((string) ($row['message'] ?? '')) . '</p>';
		$html .= '<p class="ops-assist-a"><strong>AI:</strong> ' . nl2br(esc_html((string) ($row['reply'] ?? ''))) . '</p>';
		$html .= '</article>';
	}
	$html .= '</div>';
	return $html;
}

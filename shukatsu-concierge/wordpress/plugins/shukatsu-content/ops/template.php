<?php
/**
 * /ops/ スタンドアロン画面
 *
 * @package Shukatsu_Content
 */

if (!defined('ABSPATH')) {
	exit;
}

$page = $GLOBALS['shukatsu_ops_page'] ?? (string) get_query_var('shukatsu_ops');
$ops_id = (int) ($GLOBALS['shukatsu_ops_id'] ?? get_query_var('shukatsu_ops_id'));
$is_login = ($page === 'login');

if (!$is_login) {
	shukatsu_ops_enqueue_assets();
}

$user = wp_get_current_user();
?><!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<meta name="robots" content="noindex, nofollow">
	<title>更新ツール｜終活コンシェルジュ</title>
	<?php
	if ($is_login) {
		echo '<style>
		body{margin:0;font-family:"Hiragino Sans","Noto Sans JP",sans-serif;background:#f3f0ea;color:#1f2a24;min-height:100vh;display:grid;place-items:center}
		.card{width:min(420px,92vw);background:#fff;border:1px solid #ddd5c8;border-radius:12px;padding:28px 24px;box-shadow:0 8px 24px rgba(31,42,36,.06)}
		h1{margin:0 0 8px;font-size:1.25rem}.lead{margin:0 0 20px;color:#5c6b63;font-size:.95rem;line-height:1.6}
		label{display:block;font-size:.85rem;margin:0 0 6px;font-weight:600}
		input[type=text],input[type=password]{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cfc6b8;border-radius:8px;margin-bottom:14px;font-size:1rem}
		button{width:100%;padding:12px;border:0;border-radius:8px;background:#2f6f5e;color:#fff;font-weight:700;font-size:1rem;cursor:pointer}
		.err{background:#fde8e8;color:#8a1f1f;padding:10px 12px;border-radius:8px;margin-bottom:14px;font-size:.9rem}
		.hint{margin-top:16px;font-size:.8rem;color:#7a877f;line-height:1.5}
		.chk{font-weight:500;margin-bottom:16px;display:flex;gap:8px;align-items:center}
		</style>';
	} else {
		wp_print_styles();
	}
	?>
</head>
<body class="ops-body">
<?php if ($is_login) :
	$err = isset($_GET['err']) ? (string) $_GET['err'] : '';
	?>
	<div class="card">
		<h1>終活コンシェルジュ 更新ツール</h1>
		<p class="lead">コラム・解決事例・トピックス・踊活日程の確認と公開用です。配布されたログイン情報で入ってください。</p>
		<?php if ($err === 'auth') : ?><div class="err">ログインできませんでした。メール／ユーザー名とパスワードをご確認ください。</div><?php endif; ?>
		<?php if ($err === 'nonce') : ?><div class="err">セッションが切れました。もう一度お試しください。</div><?php endif; ?>
		<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
			<input type="hidden" name="action" value="shukatsu_ops_login">
			<?php wp_nonce_field('shukatsu_ops_login'); ?>
			<label for="log">メールアドレス または ユーザー名</label>
			<input id="log" name="log" type="text" autocomplete="username" required>
			<label for="pwd">パスワード</label>
			<input id="pwd" name="pwd" type="password" autocomplete="current-password" required>
			<label class="chk"><input type="checkbox" name="rememberme" value="1"> ログイン状態を保持</label>
			<button type="submit">ログイン</button>
		</form>
		<p class="hint">パスワードを忘れた場合は、サイト管理者へ連絡してください。</p>
	</div>
<?php else :
	show_admin_bar(false);
	require SHUKATSU_CONTENT_DIR . 'ops/views.php';
	shukatsu_ops_render_app($page, $ops_id, $user);
	wp_print_footer_scripts();
endif; ?>
</body>
</html>

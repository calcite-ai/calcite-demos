<?php
declare(strict_types=1);
$dest = "https://calcite-ai.github.io/calcite-demos/buyout-prospects/fukuzawa-koumuten/b-atelier/";
$key = "fukuzawa-koumuten/b-atelier";
$logDir = dirname(__DIR__, 2) . '/_data';
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
$log = $logDir . '/demo-clicks.csv';
$ua = str_replace(["\n", "\r", ','], ' ', $_SERVER['HTTP_USER_AGENT'] ?? '');
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$line = date('c') . ',' . $key . ',' . $ip . ',' . $ua . "\n";
file_put_contents($log, $line, FILE_APPEND | LOCK_EX);
header('Location: ' . $dest, true, 302);
exit;

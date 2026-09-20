<?php
// The line list: every billing account and voicemail the credentials can see,
// with its unread count.
//
// HTTP: GET api.php[?force=1]
// CLI:  php api.php          (quickest way to check a fresh .env)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/voicemail.php';

require_auth();

$cfg = config();
$ttl = (PHP_SAPI === 'cli' || ($_GET['force'] ?? '') === '1') ? 0 : $cfg['lines_ttl'];

$lines = cache_get('lines', $ttl);

if ($lines === null) {
    try {
        $lines = vm_lines(ovh($cfg), $cfg['only_accounts'], $cfg['only_lines']);
    } catch (Throwable $e) {
        fail_from($e);
    }
    cache_put('lines', $lines);
}

json_out(['lines' => $lines]);

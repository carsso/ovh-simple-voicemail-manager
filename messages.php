<?php
// Messages of one voicemail, newest first.
//
// HTTP: GET messages.php?account=<billingAccount>&voicemail=<serviceName>[&force=1]

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/voicemail.php';

require_auth();

$cfg            = config();
$billingAccount = required_name('account');
$serviceName    = required_name('voicemail');

$key = "messages_{$billingAccount}_{$serviceName}";
$ttl = ($_GET['force'] ?? '') === '1' ? 0 : $cfg['messages_ttl'];

$messages = cache_get($key, $ttl);

if ($messages === null) {
    try {
        $messages = vm_messages(ovh($cfg), $billingAccount, $serviceName);
    } catch (Throwable $e) {
        fail_from($e);
    }
    cache_put($key, $messages);
}

json_out([
    'messages' => $messages,
    'archived' => count(array_filter($messages, fn($m) => $m['archived'])),
]);

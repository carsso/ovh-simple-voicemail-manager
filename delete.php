<?php
// Deletes one message, for good.
//
// HTTP: POST delete.php  (account, voicemail, id)

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/voicemail.php';

require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    fail(405, 'POST only');
}

$cfg            = config();
$billingAccount = required_name('account');
$serviceName    = required_name('voicemail');
$id             = required_id();

try {
    vm_delete(ovh($cfg), $billingAccount, $serviceName, $id);
} catch (Throwable $e) {
    fail_from($e);
}

cache_forget("messages_{$billingAccount}_{$serviceName}");
cache_forget('lines');
@unlink(cache_path("audio_{$billingAccount}_{$serviceName}_{$id}", $cfg['audio_format']));
cache_forget("transcript_{$billingAccount}_{$serviceName}_{$id}");

json_out(['ok' => true]);

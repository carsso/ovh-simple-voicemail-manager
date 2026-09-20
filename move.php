<?php
// Files a message away, or puts it back: "inbox" is where new messages land,
// "old" is the archive.
//
// HTTP: POST move.php  (account, voicemail, id, dir)

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
$dir            = $_POST['dir'] ?? '';

if (!in_array($dir, [VM_INBOX_DIR, VM_ARCHIVE_DIR], true)) {
    fail(400, 'Invalid dir');
}

try {
    vm_move(ovh($cfg), $billingAccount, $serviceName, $id, $dir);
} catch (Throwable $e) {
    fail_from($e);
}

cache_forget("messages_{$billingAccount}_{$serviceName}");
cache_forget('lines');

json_out(['ok' => true, 'dir' => $dir, 'archived' => $dir === VM_ARCHIVE_DIR]);

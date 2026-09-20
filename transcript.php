<?php
// Speech-to-text of a message, when the line has the option.
//
// HTTP: GET transcript.php?account=<billingAccount>&voicemail=<serviceName>&id=<id>

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/voicemail.php';

require_auth();

$cfg            = config();
$billingAccount = required_name('account');
$serviceName    = required_name('voicemail');
$id             = required_id();

$key  = "transcript_{$billingAccount}_{$serviceName}_{$id}";
$text = cache_get($key, $cfg['audio_ttl']);

if ($text === null) {
    try {
        $file = vm_transcript_file(ovh($cfg), $billingAccount, $serviceName, $id, $cfg['file_wait']);
        // An empty transcript is a legitimate answer: nothing was said.
        $text = vm_clean_transcript(vm_fetch($file['url'] ?? ''));
    } catch (Throwable $e) {
        fail_from($e);
    }
    cache_put($key, $text);
}

json_out(['text' => $text]);

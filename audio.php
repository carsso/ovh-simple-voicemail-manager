<?php
// Streams the recording itself.
//
// OVHcloud prepares the file asynchronously and answers with a temporary object
// storage URL. We wait for the job, fetch the file once and serve it from
// data/ — the browser never sees the OVHcloud URL, and replaying a message
// costs nothing. A recording never changes, so the cache only expires to keep
// the directory from growing forever.
//
// HTTP: GET audio.php?account=<billingAccount>&voicemail=<serviceName>&id=<id>[&download=1]

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/voicemail.php';

require_auth();

$cfg            = config();
$billingAccount = required_name('account');
$serviceName    = required_name('voicemail');
$id             = required_id();
$attachment     = ($_GET['download'] ?? '') === '1';

$format = $_GET['format'] ?? $cfg['audio_format'];
if (!vm_valid_format($format)) {
    fail(400, 'Invalid format');
}

$path = cache_path("audio_{$billingAccount}_{$serviceName}_{$id}", $format);
$fresh = is_file($path) && ($cfg['audio_ttl'] <= 0 || time() - filemtime($path) < $cfg['audio_ttl']);

if (!$fresh) {
    try {
        $file = vm_audio_file(ovh($cfg), $billingAccount, $serviceName, $id, $format, $cfg['file_wait']);
        $recording = vm_fetch($file['url'] ?? '');
        if ($recording === '') {
            fail(502, 'OVHcloud returned an empty recording');
        }
        write_atomic($path, $recording);
    } catch (Throwable $e) {
        fail_from($e);
    }
}

if (!is_file($path)) {
    fail(502, 'Could not store the recording');
}

$filename = sprintf('voicemail-%s-%d.%s', $serviceName, $id, $format);

header('Content-Type: ' . vm_mime($format));
header('Content-Length: ' . filesize($path));
header('Cache-Control: private, max-age=86400');
header(sprintf(
    'Content-Disposition: %s; filename="%s"',
    $attachment ? 'attachment' : 'inline',
    $filename
));
readfile($path);

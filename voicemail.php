<?php
// Everything this app asks of the OVHcloud telephony API.
//
// The API client is always passed in rather than looked up, so these functions
// can be driven by a mocked HTTP client in tests.

use Ovh\Api;

// Listing routes answer bare identifiers by default, which would mean one
// extra signed request per object. In this mode they answer the objects
// themselves instead, in a single call.
//
// Over the public /1.0 API, the mode is all that takes effect: page size,
// page number, sort and filter are accepted and then disregarded, so a route
// answers its whole list, unordered, in one call. The size is kept in case
// that ever changes; ordering is done below. Filtering does work, but through
// a route's own query parameters (?dir=old) rather than the header.
const VM_FULL_LIST = [
    'X-Pagination-Mode' => 'CachedObjectList-Pages',
    'X-Pagination-Size' => '50000',
];

// Messages live in folders. Only two of them mean anything here: new messages
// land in "inbox", and "old" is where this app files the ones you archive.
//
// Note that a folder is NOT the read flag: the API keeps the number of unread
// messages in the voicemail settings and never says which ones they are, so a
// line can hold 163 messages in "inbox" with 90 of them unread.
const VM_INBOX_DIR   = 'inbox';
const VM_ARCHIVE_DIR = 'old';

// ===========================================================================
// Lines
// ===========================================================================

// [ { billingAccount, description, voicemails: [ { serviceName, description, unread } ] } ]
function vm_lines(Api $api, array $only_accounts = [], array $only_lines = []): array
{
    // Asking for a handful of named accounts is cheaper one by one than
    // pulling every account the credentials can see.
    $accounts = $only_accounts !== []
        ? array_map(fn($ba) => $api->get("/telephony/{$ba}"), $only_accounts)
        : $api->get('/telephony', null, VM_FULL_LIST);

    $lines = [];
    foreach ($accounts as $account) {
        $billingAccount = (string) ($account['billingAccount'] ?? '');
        if ($billingAccount === '') {
            continue;
        }

        $voicemails = vm_account_voicemails($api, $billingAccount, $only_lines);
        if ($voicemails === []) {
            continue;
        }

        $lines[] = [
            'billingAccount' => $billingAccount,
            'description'    => vm_text($account['description'] ?? null) ?? $billingAccount,
            'voicemails'     => $voicemails,
        ];
    }

    usort($lines, fn($a, $b) => strnatcasecmp($a['description'], $b['description']));

    return $lines;
}

function vm_account_voicemails(Api $api, string $billingAccount, array $only_lines = []): array
{
    $voicemails = [];
    foreach ($api->get("/telephony/{$billingAccount}/voicemail", null, VM_FULL_LIST) as $voicemail) {
        $serviceName = (string) ($voicemail['serviceName'] ?? '');
        if ($serviceName === '' || ($only_lines !== [] && !in_array($serviceName, $only_lines, true))) {
            continue;
        }

        // The unread count lives in the settings, and only as a count.
        $settings = $api->get("/telephony/{$billingAccount}/voicemail/{$serviceName}/settings");
        $voicemails[] = [
            'serviceName' => $serviceName,
            'description' => vm_text($voicemail['description'] ?? null),
            'unread'      => (int) ($settings['unreadMessages'] ?? 0),
        ];
    }

    usort($voicemails, fn($a, $b) => strnatcmp($a['serviceName'], $b['serviceName']));

    return $voicemails;
}

// ===========================================================================
// Messages
// ===========================================================================

function vm_messages(Api $api, string $billingAccount, string $serviceName): array
{
    $raws = $api->get(
        "/telephony/{$billingAccount}/voicemail/{$serviceName}/directories",
        null,
        VM_FULL_LIST
    );

    $messages = [];
    foreach ($raws as $raw) {
        $messages[] = vm_message($raw);
    }

    // Newest first: a voicemail list is read from the top. The sort has to
    // happen here — this route takes X-Pagination-Sort and then ignores it,
    // the way it ignores the page size, and answers in a different order on
    // every call.
    usort($messages, fn($a, $b) => $b['ts'] <=> $a['ts'] ?: $b['id'] <=> $a['id']);

    return $messages;
}

function vm_message(array $raw): array
{
    $at = vm_text($raw['creationDatetime'] ?? null);

    return [
        'id'       => (int) ($raw['id'] ?? 0),
        'caller'   => vm_text($raw['caller'] ?? null),
        'callee'   => vm_text($raw['callee'] ?? null),
        'at'       => $at,
        'ts'       => $at === null ? 0 : (int) strtotime($at),
        'duration' => (int) ($raw['duration'] ?? 0),
        'dir'      => vm_text($raw['dir'] ?? null) ?? VM_INBOX_DIR,
        'archived' => ($raw['dir'] ?? null) === VM_ARCHIVE_DIR,
    ];
}

function vm_delete(Api $api, string $billingAccount, string $serviceName, int $id): void
{
    $api->delete("/telephony/{$billingAccount}/voicemail/{$serviceName}/directories/{$id}");
}

function vm_move(Api $api, string $billingAccount, string $serviceName, int $id, string $dir): void
{
    $api->post(
        "/telephony/{$billingAccount}/voicemail/{$serviceName}/directories/{$id}/move",
        ['dir' => $dir]
    );
}

// ===========================================================================
// Audio and transcript files
// ===========================================================================

// Both endpoints hand back a job rather than a file: status goes todo -> doing
// -> done, and only then is `url` worth anything.
function vm_prepare_file(Api $api, string $path, array $query, int $wait, ?callable $sleep = null): array
{
    $sleep    = $sleep ?? 'sleep';
    $deadline = time() + $wait;

    while (true) {
        $file   = $api->get($path, $query);
        $status = $file['status'] ?? 'error';

        if ($status === 'done') {
            return $file;
        }
        if ($status !== 'todo' && $status !== 'doing') {
            throw new RuntimeException('OVHcloud could not prepare the file (status: ' . $status . ')');
        }
        if (time() >= $deadline) {
            throw new RuntimeException('Timed out waiting for OVHcloud to prepare the file');
        }

        $sleep(1);
    }
}

function vm_audio_file(Api $api, string $billingAccount, string $serviceName, int $id, string $format, int $wait): array
{
    return vm_prepare_file(
        $api,
        "/telephony/{$billingAccount}/voicemail/{$serviceName}/directories/{$id}/download",
        ['format' => $format],
        $wait
    );
}

function vm_transcript_file(Api $api, string $billingAccount, string $serviceName, int $id, int $wait): array
{
    return vm_prepare_file(
        $api,
        "/telephony/{$billingAccount}/voicemail/{$serviceName}/directories/{$id}/transcript",
        ['format' => 'text'],
        $wait
    );
}

// The URL points at OVHcloud's object storage and expires; we fetch it
// server-side so the browser never sees it.
function vm_fetch(string $url, int $timeout = 30): string
{
    if (!preg_match('~^https://~i', $url)) {
        throw new RuntimeException('Refusing to fetch a non-HTTPS file URL');
    }

    return (new GuzzleHttp\Client())
        ->get($url, ['timeout' => $timeout, 'http_errors' => true])
        ->getBody()
        ->__toString();
}

// Transcripts come as subtitle cues. Their timings are unusable — they repeat
// from one block to the next — and a voicemail reads better as plain text.
function vm_clean_transcript(string $raw): string
{
    $lines = [];
    foreach (preg_split('/\R/', $raw) ?: [] as $line) {
        $line = trim($line);
        if ($line !== '' && !preg_match('/^\d{2}:\d{2}\.\d{3}\s*-+>\s*\d{2}:\d{2}\.\d{3}$/', $line)) {
            $lines[] = $line;
        }
    }

    return implode("\n", $lines);
}

// ===========================================================================
// Helpers
// ===========================================================================

function vm_text(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $value = trim($value);

    return $value === '' ? null : $value;
}

// mp3 -> audio/mpeg, and the handful of other formats the API offers.
function vm_mime(string $format): string
{
    return match ($format) {
        'mp3'  => 'audio/mpeg',
        'ogg'  => 'audio/ogg',
        'wav'  => 'audio/wav',
        'aiff' => 'audio/aiff',
        'au'   => 'audio/basic',
        'flac' => 'audio/flac',
        default => 'application/octet-stream',
    };
}

function vm_valid_format(mixed $format): bool
{
    return in_array($format, ['aiff', 'au', 'flac', 'mp3', 'ogg', 'wav'], true);
}

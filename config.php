<?php
// Loads .env via vlucas/phpdotenv and exposes config(), the OVHcloud API client
// and the few helpers every endpoint shares.
// Real environment variables always win over .env (createImmutable).

require_once __DIR__ . '/vendor/autoload.php';

use Ovh\Api;

Dotenv\Dotenv::createImmutable(__DIR__)->safeLoad();

function config(): array
{
    return [
        'endpoint'           => (string) ($_ENV['OVH_ENDPOINT'] ?? 'ovh-eu'),
        'client_id'          => (string) ($_ENV['OVH_CLIENT_ID'] ?? ''),
        'client_secret'      => (string) ($_ENV['OVH_CLIENT_SECRET'] ?? ''),
        'application_key'    => (string) ($_ENV['OVH_APPLICATION_KEY'] ?? ''),
        'application_secret' => (string) ($_ENV['OVH_APPLICATION_SECRET'] ?? ''),
        'consumer_key'       => (string) ($_ENV['OVH_CONSUMER_KEY'] ?? ''),
        // Empty means "every line the credentials can see".
        'only_accounts'      => csv_list($_ENV['BILLING_ACCOUNTS'] ?? ''),
        'only_lines'         => csv_list($_ENV['VOICEMAILS'] ?? ''),
        'audio_format'       => (string) ($_ENV['AUDIO_FORMAT'] ?? 'mp3'),
        'lines_ttl'          => (int) ($_ENV['LINES_TTL'] ?? 300),
        'messages_ttl'       => (int) ($_ENV['MESSAGES_TTL'] ?? 30),
        // A recorded message never changes, so its audio is cached until the
        // message itself is deleted.
        'audio_ttl'          => (int) ($_ENV['AUDIO_TTL'] ?? 2592000),
        // How long an endpoint waits for OVHcloud to prepare a file.
        'file_wait'          => (int) ($_ENV['FILE_WAIT'] ?? 25),
        'auth_user'          => (string) ($_ENV['AUTH_USER'] ?? ''),
        'auth_password'      => (string) ($_ENV['AUTH_PASSWORD'] ?? ''),
    ];
}

// OAuth2 service accounts are what OVHcloud issues today; the older
// application key / secret / consumer key triplet still works and wins nothing
// by being removed, so both are accepted.
function ovh(?array $cfg = null): Api
{
    static $api = null;
    if ($api !== null) {
        return $api;
    }

    $cfg = $cfg ?? config();

    if ($cfg['client_id'] !== '' && $cfg['client_secret'] !== '') {
        return $api = Api::withOAuth2($cfg['client_id'], $cfg['client_secret'], $cfg['endpoint']);
    }

    if ($cfg['application_key'] === '' || $cfg['application_secret'] === '' || $cfg['consumer_key'] === '') {
        throw new RuntimeException(
            'No OVHcloud credentials: set OVH_CLIENT_ID/OVH_CLIENT_SECRET, ' .
            'or OVH_APPLICATION_KEY/OVH_APPLICATION_SECRET/OVH_CONSUMER_KEY in .env'
        );
    }

    return $api = new Api(
        $cfg['application_key'],
        $cfg['application_secret'],
        $cfg['endpoint'],
        $cfg['consumer_key']
    );
}

// ===========================================================================
// HTTP plumbing
// ===========================================================================

// Optional gate in front of the whole app: this thing reads and deletes your
// voicemails, and OVHcloud credentials sit in .env next to it.
function require_auth(?array $cfg = null): void
{
    $cfg = $cfg ?? config();
    if ($cfg['auth_user'] === '' || PHP_SAPI === 'cli') {
        return;
    }

    $user = $_SERVER['PHP_AUTH_USER'] ?? '';
    $pass = $_SERVER['PHP_AUTH_PW'] ?? '';

    if (!hash_equals($cfg['auth_user'], $user) || !hash_equals($cfg['auth_password'], $pass)) {
        header('WWW-Authenticate: Basic realm="Voicemail"');
        http_response_code(401);
        exit;
    }
}

function json_out(mixed $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
    // Endpoints double as CLI commands, which is the quickest way to check a
    // fresh .env: php api.php
    echo json_encode($data, PHP_SAPI === 'cli' ? $flags | JSON_PRETTY_PRINT : $flags), PHP_SAPI === 'cli' ? "\n" : '';
    exit;
}

function fail(int $status, string $message): never
{
    json_out(['error' => $message], $status);
}

// Turns whatever the SDK threw into an HTTP status the UI can act on, without
// echoing OVHcloud's internals back to the browser.
function fail_from(Throwable $e): never
{
    $status = $e instanceof GuzzleHttp\Exception\RequestException && $e->getResponse() !== null
        ? $e->getResponse()->getStatusCode()
        : 502;

    error_log('[voicemail] ' . $e->getMessage());
    fail($status >= 400 && $status < 600 ? $status : 502, api_error_message($e));
}

function api_error_message(Throwable $e): string
{
    if ($e instanceof GuzzleHttp\Exception\RequestException && $e->getResponse() !== null) {
        $body = json_decode((string) $e->getResponse()->getBody(), true);
        if (is_array($body) && is_string($body['message'] ?? null)) {
            return $body['message'];
        }
    }

    return $e->getMessage();
}

// ===========================================================================
// Helpers
// ===========================================================================

function csv_list(string $raw): array
{
    return array_values(array_filter(array_map('trim', explode(',', $raw)), fn($s) => $s !== ''));
}

// Service names and billing accounts land inside OVHcloud API paths, so they
// are whitelisted rather than escaped.
function valid_name(mixed $value): bool
{
    return is_string($value) && $value !== '' && (bool) preg_match('/^[A-Za-z0-9._-]{1,64}$/', $value);
}

function required_name(string $param): string
{
    $value = $_GET[$param] ?? $_POST[$param] ?? '';
    if (!valid_name($value)) {
        fail(400, "Invalid {$param}");
    }

    return (string) $value;
}

function required_id(string $param = 'id'): int
{
    $value = $_GET[$param] ?? $_POST[$param] ?? '';
    if (!is_string($value) || !preg_match('/^\d{1,18}$/', $value)) {
        fail(400, "Invalid {$param}");
    }

    return (int) $value;
}

// ===========================================================================
// Cache
// ===========================================================================

function cache_path(string $key, string $ext = 'json'): string
{
    return __DIR__ . '/data/' . preg_replace('/[^A-Za-z0-9._-]/', '_', $key) . '.' . $ext;
}

function cache_get(string $key, int $ttl): mixed
{
    $path = cache_path($key);
    if ($ttl <= 0 || !is_file($path) || time() - filemtime($path) >= $ttl) {
        return null;
    }

    $data = json_decode((string) @file_get_contents($path), true);

    return $data === null ? null : $data;
}

function cache_put(string $key, mixed $value): void
{
    write_atomic(cache_path($key), (string) json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
}

function cache_forget(string $key): void
{
    @unlink(cache_path($key));
}

function write_atomic(string $path, string $contents): void
{
    @mkdir(dirname($path), 0755, true);
    if (@file_put_contents($path . '.tmp', $contents) !== false) {
        @rename($path . '.tmp', $path);
    }
}

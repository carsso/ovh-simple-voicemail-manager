<?php

use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class HelpersTest extends TestCase
{
    public function testCsvListTrimsAndDropsEmptyEntries(): void
    {
        $this->assertSame(['a', 'b', 'c'], csv_list(' a, b ,,c '));
        $this->assertSame([], csv_list(''));
        $this->assertSame([], csv_list('  ,  '));
    }

    #[DataProvider('names')]
    public function testValidNameRejectsAnythingThatCouldEscapeAnApiPath(mixed $value, bool $expected): void
    {
        $this->assertSame($expected, valid_name($value));
    }

    public static function names(): array
    {
        return [
            'billing account' => ['ab1234567-1', true],
            'phone number'    => ['0033123456789', true],
            'dotted'          => ['voicemail.42', true],
            'empty'           => ['', false],
            'slash'           => ['../me', false],
            'comma'           => ['a,b', false],
            'space'           => ['a b', false],
            'not a string'    => [42, false],
            'too long'        => [str_repeat('a', 65), false],
        ];
    }

    public function testConfigFallsBackToSensibleDefaults(): void
    {
        $cfg = config();

        $this->assertSame('ovh-eu', $cfg['endpoint']);
        $this->assertSame('mp3', $cfg['audio_format']);
        $this->assertSame([], $cfg['only_accounts']);
    }

    public function testConfigReadsTheEnvironment(): void
    {
        $_ENV['OVH_ENDPOINT'] = 'ovh-ca';
        $_ENV['BILLING_ACCOUNTS'] = 'ab1, ab2';
        $_ENV['MESSAGES_TTL'] = '90';

        try {
            $cfg = config();
            $this->assertSame('ovh-ca', $cfg['endpoint']);
            $this->assertSame(['ab1', 'ab2'], $cfg['only_accounts']);
            $this->assertSame(90, $cfg['messages_ttl']);
        } finally {
            unset($_ENV['OVH_ENDPOINT'], $_ENV['BILLING_ACCOUNTS'], $_ENV['MESSAGES_TTL']);
        }
    }

    public function testOvhClientNeedsCredentials(): void
    {
        $this->expectException(RuntimeException::class);
        ovh(['client_id' => '', 'client_secret' => '', 'application_key' => '',
             'application_secret' => '', 'consumer_key' => '', 'endpoint' => 'ovh-eu']);
    }

    public function testAudioFormatsAreLimitedToWhatTheApiOffers(): void
    {
        $this->assertTrue(vm_valid_format('mp3'));
        $this->assertFalse(vm_valid_format('exe'));
        $this->assertSame('audio/mpeg', vm_mime('mp3'));
        $this->assertSame('application/octet-stream', vm_mime('exe'));
    }

    public function testCacheExpires(): void
    {
        $key = 'test_cache_' . getmypid();
        cache_put($key, ['hello' => 'world']);

        $this->assertSame(['hello' => 'world'], cache_get($key, 60));
        $this->assertNull(cache_get($key, 0), 'a zero TTL means never serve from cache');

        // Backdating the file goes behind PHP's stat cache, which would
        // otherwise still report the mtime from cache_put().
        touch(cache_path($key), time() - 120);
        clearstatcache(true, cache_path($key));
        $this->assertNull(cache_get($key, 60));

        cache_forget($key);
        $this->assertNull(cache_get($key, 60));
    }
}

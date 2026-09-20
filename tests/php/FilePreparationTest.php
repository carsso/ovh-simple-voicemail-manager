<?php

use PHPUnit\Framework\TestCase;

// OVHcloud prepares recordings and transcripts asynchronously: the endpoint
// answers todo/doing until the file is ready.
final class FilePreparationTest extends TestCase
{
    public function testWaitsUntilTheFileIsReady(): void
    {
        $statuses = ['todo', 'doing', 'done'];
        $fake = new FakeApi([
            'GET /file' => function () use (&$statuses) {
                return ['status' => array_shift($statuses), 'url' => 'https://storage/file.mp3'];
            },
        ]);

        $slept = 0;
        $file = vm_prepare_file($fake->api(), '/file', [], 25, function () use (&$slept) { $slept++; });

        $this->assertSame('https://storage/file.mp3', $file['url']);
        $this->assertSame(2, $slept);
    }

    public function testGivesUpWhenThePreparationFails(): void
    {
        $fake = new FakeApi(['GET /file' => ['status' => 'error']]);

        $this->expectExceptionMessageMatches('/could not prepare/i');
        vm_prepare_file($fake->api(), '/file', [], 25, fn() => null);
    }

    public function testGivesUpWhenTheDeadlinePasses(): void
    {
        $fake = new FakeApi(['GET /file' => ['status' => 'doing']]);

        $this->expectExceptionMessageMatches('/timed out/i');
        vm_prepare_file($fake->api(), '/file', [], 0, fn() => null);
    }

    public function testTheRequestedFormatIsForwarded(): void
    {
        $fake = new FakeApi([
            'GET /telephony/ab1/voicemail/line/directories/7/download?format=ogg'
                => ['status' => 'done', 'url' => 'https://storage/file.ogg'],
        ]);

        $file = vm_audio_file($fake->api(), 'ab1', 'line', 7, 'ogg', 25);

        $this->assertSame('https://storage/file.ogg', $file['url']);
    }

    public function testPlainHttpFileUrlsAreRefused(): void
    {
        $this->expectExceptionMessageMatches('/non-HTTPS/');
        vm_fetch('http://storage/file.mp3');
    }
}

<?php

use PHPUnit\Framework\TestCase;

final class MessageTest extends TestCase
{
    public function testMessageIsNormalisedForTheFrontend(): void
    {
        $message = vm_message([
            'id'               => '4242',
            'caller'           => '+33612345678',
            'callee'           => '+33499887766',
            'creationDatetime' => '2026-03-14T09:12:00+01:00',
            'dir'              => 'inbox',
            'duration'         => '42',
        ]);

        $this->assertSame(4242, $message['id']);
        $this->assertSame(42, $message['duration']);
        $this->assertSame(strtotime('2026-03-14T09:12:00+01:00'), $message['ts']);
        $this->assertFalse($message['archived']);
    }

    // The folder is not a read flag — the API only ever reports how many
    // unread messages a line has, never which ones.
    public function testOnlyTheOldFolderCountsAsArchived(): void
    {
        $this->assertTrue(vm_message(['dir' => 'old'])['archived']);
        $this->assertFalse(vm_message(['dir' => 'inbox'])['archived']);
        $this->assertFalse(vm_message(['dir' => 'work'])['archived']);
    }

    public function testMissingFieldsDoNotBlowUp(): void
    {
        $message = vm_message([]);

        $this->assertSame(0, $message['id']);
        $this->assertNull($message['caller']);
        $this->assertSame(0, $message['ts']);
        $this->assertSame('inbox', $message['dir']);
    }

    public function testBlankStringsBecomeNull(): void
    {
        $this->assertNull(vm_text('   '));
        $this->assertNull(vm_text(null));
        $this->assertSame('hello', vm_text('  hello '));
    }

    public function testTranscriptCuesAreStripped(): void
    {
        $raw = "01:16.610 -> 01:16.150\nAh, bonjour !\n\n01:16.610 -> 01:16.150\n\n\nC'est pour la commande.\n";

        $this->assertSame("Ah, bonjour !\nC'est pour la commande.", vm_clean_transcript($raw));
    }

    public function testAnEmptyTranscriptStaysEmpty(): void
    {
        $this->assertSame('', vm_clean_transcript(''));
        $this->assertSame('', vm_clean_transcript("00:00.000 -> 00:00.000\n\n"));
    }
}

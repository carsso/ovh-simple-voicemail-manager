<?php

use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

final class VoicemailApiTest extends TestCase
{
    public function testLinesAreListedWithTheirUnreadCount(): void
    {
        $fake = new FakeApi([
            'GET /telephony' => [
                ['billingAccount' => 'ab1', 'description' => 'Office'],
                ['billingAccount' => 'ab2', 'description' => 'Home'],
            ],
            'GET /telephony/ab1/voicemail' => [['serviceName' => '0033111111111', 'description' => 'Reception']],
            'GET /telephony/ab2/voicemail' => [['serviceName' => '0033222222222', 'description' => null]],
            'GET /telephony/ab1/voicemail/0033111111111/settings' => ['unreadMessages' => 3],
            'GET /telephony/ab2/voicemail/0033222222222/settings' => ['unreadMessages' => 0],
        ]);

        $lines = vm_lines($fake->api());

        // Sorted by account description: Home before Office.
        $this->assertSame(['Home', 'Office'], array_column($lines, 'description'));
        $this->assertSame(0, $lines[0]['voicemails'][0]['unread']);
        $this->assertSame(3, $lines[1]['voicemails'][0]['unread']);
        $this->assertSame('Reception', $lines[1]['voicemails'][0]['description']);
        $this->assertNull($lines[0]['voicemails'][0]['description']);
    }

    // Without it, every listing route answers bare identifiers and each object
    // costs one more signed request.
    public function testListingsAskForWholeObjects(): void
    {
        $fake = new FakeApi([
            'GET /telephony'               => [['billingAccount' => 'ab1', 'description' => 'Office']],
            'GET /telephony/ab1/voicemail' => [['serviceName' => 'line1']],
            'GET /telephony/ab1/voicemail/line1/settings' => ['unreadMessages' => 0],
        ]);

        vm_lines($fake->api());

        foreach ($fake->requests as $request) {
            if (str_ends_with($request['path'], '/settings')) {
                continue;
            }
            $this->assertSame(
                'CachedObjectList-Pages',
                $request['headers']['X-Pagination-Mode'] ?? null,
                $request['path']
            );
        }
    }

    public function testConfiguredAccountsSkipTheListingCall(): void
    {
        $fake = new FakeApi([
            'GET /telephony/ab1' => ['billingAccount' => 'ab1', 'description' => 'Office'],
            'GET /telephony/ab1/voicemail' => [
                ['serviceName' => '0033111111111', 'description' => 'Reception'],
                ['serviceName' => '0033999999999', 'description' => 'Warehouse'],
            ],
            'GET /telephony/ab1/voicemail/0033111111111/settings' => ['unreadMessages' => 7],
        ]);

        $lines = vm_lines($fake->api(), ['ab1'], ['0033111111111']);

        $this->assertNotContains('GET /telephony', $fake->pathsCalled());
        $this->assertCount(1, $lines[0]['voicemails'], 'VOICEMAILS filters the lines');
        $this->assertSame('0033111111111', $lines[0]['voicemails'][0]['serviceName']);
    }

    public function testAccountsWithoutVoicemailAreDropped(): void
    {
        $fake = new FakeApi([
            'GET /telephony'               => [['billingAccount' => 'ab1', 'description' => 'Office']],
            'GET /telephony/ab1/voicemail' => [],
        ]);

        $this->assertSame([], vm_lines($fake->api()));
    }

    // Whatever the volume: one request, and the order the API happens to
    // return is not the order we show — it varies between calls.
    public function testEveryMessageComesInOneRequestSortedNewestFirst(): void
    {
        $shuffled = self::messages(range(1, 120));
        shuffle($shuffled);

        $fake = new FakeApi(['GET /telephony/ab1/voicemail/line/directories' => $shuffled]);

        $messages = vm_messages($fake->api(), 'ab1', 'line');

        $this->assertCount(120, $messages);
        $this->assertSame(120, $messages[0]['id'], 'newest first');
        $this->assertSame(1, $messages[119]['id']);
        $this->assertCount(1, $fake->requests);
    }

    public function testAnEmptyVoicemailIsNotAnError(): void
    {
        $fake = new FakeApi(['GET /telephony/ab1/voicemail/line/directories' => []]);

        $this->assertSame([], vm_messages($fake->api(), 'ab1', 'line'));
        $this->assertCount(1, $fake->requests);
    }

    public function testDeleteAndMoveHitTheRightRoutes(): void
    {
        $fake = new FakeApi([
            'DELETE /telephony/ab1/voicemail/line/directories/7' => new Response(204),
            'POST /telephony/ab1/voicemail/line/directories/7/move' => new Response(204),
        ]);
        $api = $fake->api();

        vm_delete($api, 'ab1', 'line', 7);
        vm_move($api, 'ab1', 'line', 7, VM_ARCHIVE_DIR);

        $this->assertSame([
            'DELETE /telephony/ab1/voicemail/line/directories/7',
            'POST /telephony/ab1/voicemail/line/directories/7/move',
        ], array_slice($fake->pathsCalled(), -2));
        $this->assertSame('{"dir":"old"}', end($fake->requests)['body']);
    }

    private static function messages(array $ids): array
    {
        $out = [];
        foreach ($ids as $id) {
            $out[] = [
                'id'               => $id,
                'caller'           => '+3361234567' . ($id % 10),
                'creationDatetime' => date('c', 1740000000 + $id * 60),
                'dir'              => $id % 2 === 0 ? 'inbox' : 'old',
                'duration'         => 30 + $id,
            ];
        }

        return $out;
    }
}

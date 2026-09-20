<?php
// An Ovh\Api talking to canned responses instead of OVHcloud.
//
// The SDK accepts a Guzzle client, so the whole signing path stays under test:
// routes are matched on "METHOD /path" with the /1.0 prefix stripped.

use GuzzleHttp\Client;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Ovh\Api;
use Psr\Http\Message\RequestInterface;

final class FakeApi
{
    /** @var array<int, array{method: string, path: string, query: string, headers: array}> */
    public array $requests = [];

    /** @param array<string, mixed> $routes "GET /telephony" => payload|callable|Response */
    public function __construct(private array $routes)
    {
    }

    public function api(): Api
    {
        $stack = HandlerStack::create(function (RequestInterface $request, array $options) {
            return Create::promiseFor($this->respond($request));
        });

        // Any credentials will do: nothing checks the signature on this side.
        return new Api('ak', 'as', 'ovh-eu', 'ck', new Client(['handler' => $stack]));
    }

    public function pathsCalled(): array
    {
        return array_map(fn($r) => $r['method'] . ' ' . $r['path'], $this->requests);
    }

    private function respond(RequestInterface $request): Response
    {
        $path  = preg_replace('~^/1\.0~', '', $request->getUri()->getPath());
        $query = $request->getUri()->getQuery();

        // The SDK asks the API for the time before signing its first call;
        // that one is plumbing, not something a test should have to count.
        if ($path === '/auth/time') {
            return new Response(200, [], (string) time());
        }

        $this->requests[] = [
            'method'  => $request->getMethod(),
            'path'    => $path,
            'query'   => $query,
            'headers' => array_map(fn($values) => implode(', ', $values), $request->getHeaders()),
            'body'    => (string) $request->getBody(),
        ];

        $key = $request->getMethod() . ' ' . $path . ($query === '' ? '' : '?' . $query);
        $route = $this->routes[$key]
            ?? $this->routes[$request->getMethod() . ' ' . $path]
            ?? null;

        if ($route === null) {
            return new Response(404, ['Content-Type' => 'application/json'], json_encode([
                'message' => 'No route for ' . $key,
            ]));
        }

        if (is_callable($route)) {
            $route = $route($this->requests);
        }
        if ($route instanceof Response) {
            return $route;
        }

        return new Response(200, ['Content-Type' => 'application/json'], json_encode($route));
    }
}

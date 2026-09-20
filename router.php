<?php
// Router for the built-in server: php -S localhost:8080 router.php
//
// Without it, `php -S` cheerfully serves .env and every cached recording as
// plain files. Under Apache or nginx this file is unused; .htaccess does it.

$path = (string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

if (preg_match('~^/(\.|data/|vendor/|tests/|composer\.|router\.php)~', $path)) {
    http_response_code(404);
    return true;
}

return false;

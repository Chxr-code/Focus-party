<?php

/**
 * Settings come from a .env file on your own computer, or from real environment variables on a host
 * (Render, Railway, ...). env('NAME', 'default') reads either.
 */
if (!function_exists('env')) {
    $root = dirname(__DIR__);
    if (class_exists(\Dotenv\Dotenv::class) && is_file($root . '/.env')) {
        \Dotenv\Dotenv::createImmutable($root)->safeLoad();
    }

    function env(string $name, $default = null)
    {
        if (array_key_exists($name, $_ENV)) {
            return $_ENV[$name];
        }
        $value = getenv($name);
        return $value === false ? $default : $value;
    }
}

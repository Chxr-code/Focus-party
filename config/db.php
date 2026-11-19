<?php

require_once __DIR__ . '/env.php';

$db = [
    'class' => \yii\db\Connection::class,
    'dsn' => env('DB_DSN', 'mysql:host=localhost;dbname=focus_party'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8mb4',
];

// cloud databases (TiDB Cloud, PlanetScale, Aiven...) only accept encrypted connections
if (filter_var(env('DB_SSL', false), FILTER_VALIDATE_BOOLEAN)) {
    $db['attributes'] = [
        PDO::MYSQL_ATTR_SSL_CA => env('DB_SSL_CA', '/etc/ssl/certs/ca-certificates.crt'),
        PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT => true,
    ];
}

return $db;

<?php

return [
    'class' => \yii\db\Connection::class,
    'dsn' => $_ENV['DB_DSN'] ?? 'mysql:host=localhost;dbname=focus_party',
    'username' => $_ENV['DB_USERNAME'] ?? 'root',
    'password' => $_ENV['DB_PASSWORD'] ?? '',
    'charset' => 'utf8mb4',
];
<?php

declare(strict_types=1);

// Debug mode only when .env says APP_ENV=dev (on the course server leave it out -> prod)
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/../config/env.php';
$isDev = env('APP_ENV', 'prod') === 'dev';
defined('YII_DEBUG') or define('YII_DEBUG', $isDev);
defined('YII_ENV') or define('YII_ENV', $isDev ? 'dev' : 'prod');

require __DIR__ . '/../vendor/yiisoft/yii2/Yii.php';

$config = require __DIR__ . '/../config/web.php';

(new yii\web\Application($config))->run();

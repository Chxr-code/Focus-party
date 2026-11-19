<?php

require dirname(__DIR__) . '/vendor/autoload.php';
require_once __DIR__ . '/env.php';

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';
// Speed (matters a lot when the database is far away):
// - remember table structures instead of asking the database on every request (12 queries saved per call)
// - keep the encrypted connection open between requests instead of reconnecting each time
// Migrations run in the console app, which doesn't use these, and every deploy starts with an empty cache.
$db['enableSchemaCache'] = YII_ENV_PROD;
$db['schemaCacheDuration'] = 3600;
$db['attributes'] = ($db['attributes'] ?? []) + [PDO::ATTR_PERSISTENT => YII_ENV_PROD];

$config = [
    'id' => 'focus-party',
    'name' => 'Focus Party',
    'basePath' => dirname(__DIR__),
    'timeZone' => 'Asia/Bangkok',

    'bootstrap' => ['log'],

    'container' => [
        'singletons' => [
            \yii\mail\MailerInterface::class => [
                'class' => \yii\symfonymailer\Mailer::class,
                'useFileTransport' => true,
                'viewPath' => '@app/mail',
            ],
        ],
    ],

    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm' => '@vendor/npm-asset',
    ],

    'components' => [

        // Request configuration
        'request' => [
            'cookieValidationKey' => env('COOKIE_VALIDATION_KEY')
                ?? throw new \RuntimeException('COOKIE_VALIDATION_KEY is missing'),
            'parsers' => [
                'application/json' => \yii\web\JsonParser::class,
            ],
        ],

        // Response configuration
        'response' => [
            'format' => \yii\web\Response::FORMAT_JSON,
            'charset' => 'UTF-8',
        ],

        // URL configuration
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'enableStrictParsing' => true,

            'rules' => [
                'GET api/test' => 'api/test',

                // auth + me
                'POST api/auth/register' => 'auth/register',
                'POST api/auth/login' => 'auth/login',
                'GET api/me' => 'me/index',
                'PUT api/me/avatar' => 'me/avatar',
                'PUT api/me/settings' => 'me/settings',
                'GET api/me/garden' => 'me/garden',
                'POST api/me/garden/water' => 'me/water',
                'PUT api/me/garden/<room_id:\d+>' => 'me/rename-tree',

                // rooms
                'GET api/rooms' => 'room/index',
                'POST api/rooms' => 'room/create',
                'GET api/rooms/<id:\d+>' => 'room/view',
                'POST api/rooms/<id:\d+>/join' => 'room/join',
                'POST api/rooms/<id:\d+>/start' => 'room/start',
                'POST api/rooms/<id:\d+>/leave' => 'room/leave',
                'POST api/rooms/<id:\d+>/claim' => 'room/claim',
                'GET api/rooms/<id:\d+>/messages' => 'room/messages',
                'POST api/rooms/<id:\d+>/messages' => 'room/send-message',

                // boss templates
                'GET api/bosses' => 'boss/index',
                'POST api/bosses' => 'boss/create',
                'GET api/bosses/<id:\d+>' => 'boss/view',

                // friends + visiting gardens
                'GET api/friends' => 'friend/index',
                'POST api/friends/requests' => 'friend/request',
                'POST api/friends/requests/<id:\d+>/accept' => 'friend/accept',
                'POST api/friends/requests/<id:\d+>/decline' => 'friend/decline',
                'DELETE api/friends/<user_id:\d+>' => 'friend/remove',
                'GET api/users/<id:\d+>/garden' => 'user/garden',

                // admin
                'PUT api/admin/level' => 'admin/level',

                // CORS preflight for anything under /api
                'OPTIONS api/<path:.*>' => 'api/options',
            ],
        ],

        'cache' => [
            'class' => \yii\caching\FileCache::class,
        ],

        'user' => [
            'identityClass' => \app\models\User::class,
            'enableAutoLogin' => false,
            'enableSession' => false,
            'loginUrl' => null,
        ],

        // no errorAction: errors are answered as JSON
        'errorHandler' => [],

        'mailer' => \yii\mail\MailerInterface::class,

        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                [
                    'class' => \yii\log\FileTarget::class,
                    'levels' => ['error', 'warning'],
                ],
            ],
        ],

        'db' => $db,
    ],

    'params' => $params,
];

// gii / debug only when they are installed (composer install without --no-dev)
if (YII_ENV_DEV && class_exists(\yii\gii\Module::class) && class_exists(\yii\debug\Module::class)) {

    $config['bootstrap'][] = 'debug';

    $config['modules']['debug'] = [
        'class' => \yii\debug\Module::class,
        //'allowedIPs' => ['127.0.0.1', '::1'],
    ];

    $config['bootstrap'][] = 'gii';

    $config['modules']['gii'] = [
        'class' => \yii\gii\Module::class,
        //'allowedIPs' => ['127.0.0.1', '::1'],
    ];
}

return $config;
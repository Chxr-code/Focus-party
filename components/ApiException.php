<?php

namespace app\components;

use yii\web\HttpException;

/** an API error with field messages: {"message": "...", "errors": {"field": ["..."]}} */
class ApiException extends HttpException
{
    public array $errors;

    public function __construct(int $status, string $message, array $errors = [])
    {
        parent::__construct($status, $message);
        $this->errors = $errors;
    }
}

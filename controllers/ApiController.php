<?php

namespace app\controllers;

use Yii;
use app\components\ApiException;
use app\models\User;
use yii\filters\auth\HttpBearerAuth;
use yii\filters\Cors;
use yii\web\Controller;
use yii\web\HttpException;
use yii\web\Response;

/**
 * Base for every /api controller.
 * Success: {"data": ...}      Error: {"message": "...", "errors": {"field": ["..."]}} + HTTP status
 */
class ApiController extends Controller
{
    /** API uses Bearer tokens, not CSRF form tokens */
    public $enableCsrfValidation = false;

    /** actions that work without logging in */
    protected array $publicActions = [];

    public function behaviors()
    {
        $behaviors = parent::behaviors();

        // only needed while developing React on localhost:5173 without the Vite proxy
        $behaviors['corsFilter'] = [
            'class' => Cors::class,
            'cors' => [
                'Origin' => ['http://localhost:5173'],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
                'Access-Control-Request-Headers' => ['Content-Type', 'Authorization'],
                'Access-Control-Max-Age' => 86400,
            ],
        ];

        $behaviors['authenticator'] = [
            'class' => HttpBearerAuth::class,
            'except' => array_merge(['options', 'test'], $this->publicActions),
        ];

        return $behaviors;
    }

    public function beforeAction($action)
    {
        Yii::$app->response->format = Response::FORMAT_JSON;
        return parent::beforeAction($action);
    }

    protected function me(): User
    {
        return Yii::$app->user->identity;
    }

    protected function ok($data): array
    {
        return ['data' => $data];
    }

    /** stop and answer with an error */
    protected function fail(int $status, string $message, array $errors = []): void
    {
        throw new ApiException($status, $message, $errors);
    }

    /** 422 with field errors when $errors is not empty */
    protected function validate(array $errors): void
    {
        if ($errors) {
            $this->fail(422, 'Validation failed', $errors);
        }
    }

    protected function body(): array
    {
        return Yii::$app->request->bodyParams ?: [];
    }

    /** CORS preflight */
    public function actionOptions()
    {
        Yii::$app->response->statusCode = 204;
        return null;
    }

    /** GET /api/test */
    public function actionTest()
    {
        return $this->ok(['message' => 'Focus Party API is running!', 'server_time' => time()]);
    }

    public function runAction($id, $params = [])
    {
        try {
            return parent::runAction($id, $params);
        } catch (ApiException $e) {
            $this->rollBack();
            Yii::$app->response->statusCode = $e->statusCode;
            return ['message' => $e->getMessage(), 'errors' => (object) $e->errors];
        } catch (HttpException $e) {
            $this->rollBack();
            Yii::$app->response->statusCode = $e->statusCode;
            return ['message' => $e->getMessage() ?: 'Request failed', 'errors' => (object) []];
        }
    }

    private function rollBack(): void
    {
        $tx = Yii::$app->db->getTransaction();
        if ($tx && $tx->getIsActive()) {
            $tx->rollBack();
        }
    }
}

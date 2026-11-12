<?php

namespace app\controllers;

use app\components\Rules;

class AdminController extends ApiController
{
    /** PUT /api/admin/level {level} — admin sets their OWN level to preview unlocks */
    public function actionLevel()
    {
        $user = $this->me();
        if (!$user->isAdmin()) {
            $this->fail(403, 'Admins only');
        }
        $level = (int) ($this->body()['level'] ?? 0);
        if ($level < 1 || $level > Rules::MAX_LEVEL) {
            $this->fail(422, 'Validation failed', ['level' => ['Level must be 1–' . Rules::MAX_LEVEL]]);
        }
        $user->exp = ($level - 1) * Rules::EXP_PER_LEVEL;
        $user->updated_at = time();
        $user->save(false, ['exp', 'updated_at']);
        return $this->ok($user->toArray());
    }
}

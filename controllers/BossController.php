<?php

namespace app\controllers;

use app\models\Boss;

/** Boss templates (a boss room copies one and fights its own pest) */
class BossController extends ApiController
{
    /** GET /api/bosses */
    public function actionIndex()
    {
        $bosses = Boss::find()->orderBy(['max_hp' => SORT_ASC, 'id' => SORT_ASC])->all();
        return $this->ok(array_map(fn ($b) => $b->toArray(), $bosses));
    }

    /** GET /api/bosses/{id} */
    public function actionView($id)
    {
        $boss = Boss::findOne((int) $id);
        if (!$boss) {
            $this->fail(404, 'Boss not found');
        }
        return $this->ok($boss->toArray());
    }

    /** POST /api/bosses {name, subject_code, max_hp} — admin only */
    public function actionCreate()
    {
        $user = $this->me();
        if (!$user->isAdmin()) {
            $this->fail(403, 'Admins only');
        }
        $b = $this->body();
        $name = trim((string) ($b['name'] ?? ''));
        $hp = (int) ($b['max_hp'] ?? 0);

        $errors = [];
        if ($name === '' || mb_strlen($name) > 60) {
            $errors['name'][] = 'Name is required (max 60)';
        }
        if ($hp < 15 || $hp > 5000) {
            $errors['max_hp'][] = 'HP must be 15–5000';
        }
        $this->validate($errors);

        $boss = new Boss([
            'name' => $name,
            'subject_code' => trim((string) ($b['subject_code'] ?? 'Any')) ?: 'Any',
            'max_hp' => $hp,
            'current_hp' => $hp,
            'created_by' => $user->id,
        ]);
        $boss->save(false);
        return $this->ok($boss->toArray());
    }
}

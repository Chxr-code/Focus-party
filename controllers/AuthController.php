<?php

namespace app\controllers;

use app\models\User;

class AuthController extends ApiController
{
    protected array $publicActions = ['register', 'login'];

    /** POST /api/auth/register  {username, password, display_name} */
    public function actionRegister()
    {
        $b = $this->body();
        $username = trim((string) ($b['username'] ?? ''));
        $password = (string) ($b['password'] ?? '');
        $displayName = trim((string) ($b['display_name'] ?? ''));

        $errors = [];
        if ($username === '') {
            $errors['username'][] = 'Username is required';
        } elseif (!preg_match('/^[A-Za-z0-9_.]{3,50}$/', $username)) {
            $errors['username'][] = 'Use 3–50 letters, numbers, _ or .';
        } elseif (User::find()->where(['username' => $username])->exists()) {
            $errors['username'][] = 'Username is already taken';
        }
        if (strlen($password) < 6) {
            $errors['password'][] = 'Password must be at least 6 characters';
        }
        if ($displayName === '') {
            $errors['display_name'][] = 'Display name is required';
        } elseif (mb_strlen($displayName) > 30) {
            $errors['display_name'][] = 'Max 30 characters';
        }
        $this->validate($errors);

        $user = new User();
        $user->username = $username;
        $user->display_name = $displayName;
        $user->setPassword($password);
        $user->generateAccessToken();
        $user->exp = 0;
        $user->role = 'student';
        $user->created_at = $user->updated_at = time();
        $user->save(false);
        $user->refresh();

        return $this->ok(['token' => $user->access_token, 'user' => $user->toArray()]);
    }

    /** POST /api/auth/login  {username, password} */
    public function actionLogin()
    {
        $b = $this->body();
        $user = User::findOne(['username' => trim((string) ($b['username'] ?? ''))]);

        if (!$user || !$user->validatePassword((string) ($b['password'] ?? ''))) {
            $this->fail(401, 'Wrong username or password');
        }

        // keep the existing token so logging in on a second device doesn't log out the first
        if (!$user->access_token) {
            $user->generateAccessToken();
            $user->save(false, ['access_token']);
        }

        return $this->ok(['token' => $user->access_token, 'user' => $user->toArray()]);
    }
}

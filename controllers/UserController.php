<?php

namespace app\controllers;

use app\models\FriendRequest;
use app\models\Garden;
use app\models\User;

class UserController extends ApiController
{
    /** GET /api/users/{id}/garden — friends only (your own works too) */
    public function actionGarden($id)
    {
        $me = $this->me();
        $owner = User::findOne((int) $id);
        if (!$owner) {
            $this->fail(404, 'Player not found');
        }
        if ((int) $owner->id !== (int) $me->id && !FriendRequest::areFriends((int) $me->id, (int) $owner->id)) {
            $this->fail(403, 'Only friends can visit this garden');
        }
        return $this->ok([
            'user' => $owner->toPublic() + ['garden_theme' => $owner->garden_theme ?: 'pond'],
            'trees' => Garden::listFor((int) $owner->id, time()),
        ]);
    }
}

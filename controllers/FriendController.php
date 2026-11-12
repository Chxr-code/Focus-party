<?php

namespace app\controllers;

use app\models\FriendRequest;
use app\models\User;

/** Every action answers with the same shape as GET /api/friends: {friends, incoming, outgoing} */
class FriendController extends ApiController
{
    /** GET /api/friends */
    public function actionIndex()
    {
        return $this->ok(FriendRequest::listFor($this->me()->id));
    }

    /** POST /api/friends/requests  {user_id} */
    public function actionRequest()
    {
        $me = $this->me();
        $target = User::findOne((int) ($this->body()['user_id'] ?? 0));

        if (!$target) {
            $this->fail(404, 'Player not found');
        }
        if ((int) $target->id === (int) $me->id) {
            $this->fail(422, "You can't add yourself");
        }
        if (!$target->allow_friend_requests) {
            $this->fail(403, 'This player is not accepting friend requests');
        }

        $existing = FriendRequest::find()
            ->where(['or', ['from_id' => $me->id, 'to_id' => $target->id], ['from_id' => $target->id, 'to_id' => $me->id]])
            ->one();

        if ($existing && $existing->status === 'accepted') {
            $this->fail(422, 'Already friends');
        }
        if ($existing && (int) $existing->from_id === (int) $me->id) {
            $this->fail(422, 'Request already sent');
        }
        if ($existing) {
            // they already asked me -> friends now
            $existing->status = 'accepted';
            $existing->save(false, ['status']);
        } else {
            (new FriendRequest([
                'from_id' => $me->id,
                'to_id' => $target->id,
                'status' => 'pending',
                'created_at' => time(),
            ]))->save(false);
        }
        return $this->ok(FriendRequest::listFor($me->id));
    }

    /** POST /api/friends/requests/{id}/accept (receiver only) */
    public function actionAccept($id)
    {
        $me = $this->me();
        $req = $this->findPending($id);
        if ((int) $req->to_id !== (int) $me->id) {
            $this->fail(403, 'Only the receiver can accept');
        }
        $req->status = 'accepted';
        $req->save(false, ['status']);
        return $this->ok(FriendRequest::listFor($me->id));
    }

    /** POST /api/friends/requests/{id}/decline — receiver declines, sender cancels */
    public function actionDecline($id)
    {
        $this->findPending($id)->delete();
        return $this->ok(FriendRequest::listFor($this->me()->id));
    }

    /** DELETE /api/friends/{user_id} */
    public function actionRemove($user_id)
    {
        $me = $this->me();
        $f = FriendRequest::friendship((int) $me->id, (int) $user_id);
        if ($f) {
            $f->delete();
        }
        return $this->ok(FriendRequest::listFor($me->id));
    }

    private function findPending($id): FriendRequest
    {
        $me = (int) $this->me()->id;
        $req = FriendRequest::findOne(['id' => (int) $id, 'status' => 'pending']);
        if (!$req || ((int) $req->to_id !== $me && (int) $req->from_id !== $me)) {
            $this->fail(404, 'Request not found');
        }
        return $req;
    }
}

<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * @property int $id
 * @property int $from_id
 * @property int $to_id
 * @property string $status  pending | accepted
 * @property int $created_at
 */
class FriendRequest extends ActiveRecord
{
    public static function tableName()
    {
        return '{{%friend_requests}}';
    }

    /** the accepted request between two players, if any */
    public static function friendship(int $a, int $b): ?self
    {
        return static::find()
            ->where(['status' => 'accepted'])
            ->andWhere(['or', ['from_id' => $a, 'to_id' => $b], ['from_id' => $b, 'to_id' => $a]])
            ->one();
    }

    public static function areFriends(int $a, int $b): bool
    {
        return static::friendship($a, $b) !== null;
    }

    /** GET /api/friends shape */
    public static function listFor(int $userId): array
    {
        $rows = static::find()
            ->where(['or', ['from_id' => $userId], ['to_id' => $userId]])
            ->orderBy(['id' => SORT_ASC])
            ->all();

        $ids = [];
        foreach ($rows as $r) {
            $ids[] = (int) $r->from_id === $userId ? (int) $r->to_id : (int) $r->from_id;
        }
        $users = User::find()->where(['id' => array_unique($ids)])->indexBy('id')->all();

        $out = ['friends' => [], 'incoming' => [], 'outgoing' => []];
        foreach ($rows as $r) {
            $otherId = (int) $r->from_id === $userId ? (int) $r->to_id : (int) $r->from_id;
            $other = $users[$otherId] ?? null;
            if (!$other) {
                continue;
            }
            if ($r->status === 'accepted') {
                $out['friends'][] = $other->toPublic();
            } elseif ((int) $r->to_id === $userId) {
                $out['incoming'][] = ['id' => (int) $r->id, 'user' => $other->toPublic()];
            } else {
                $out['outgoing'][] = ['id' => (int) $r->id, 'user' => $other->toPublic()];
            }
        }
        return $out;
    }
}

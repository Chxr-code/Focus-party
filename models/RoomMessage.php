<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * @property int $id
 * @property int $room_id
 * @property int $user_id
 * @property string $body
 * @property int $created_at
 */
class RoomMessage extends ActiveRecord
{
    public static function tableName()
    {
        return '{{%room_messages}}';
    }

    public function getUser()
    {
        return $this->hasOne(User::class, ['id' => 'user_id']);
    }

    public function fields()
    {
        return [
            'id' => fn () => (int) $this->id,
            'user_id' => fn () => (int) $this->user_id,
            'display_name' => fn () => $this->user->display_name ?? '?',
            'body',
            'created_at' => fn () => (int) $this->created_at,
        ];
    }
}

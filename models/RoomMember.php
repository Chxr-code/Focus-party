<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * One player in one room. After the room ends this row is also that player's tree in their garden.
 *
 * @property int $id
 * @property int $room_id
 * @property int $user_id
 * @property string $status  joined | left | completed
 * @property int $focused_seconds
 * @property int $joined_at
 * @property int|null $left_at
 * @property int|null $claimed_at
 * @property int|null $tree_stage  1 seedling, 2 growing, 3 grown, 4 boss win (the tree taken home)
 * @property string|null $tree_name
 * @property int|null $last_watered_at
 * @property int $revive_count
 * @property int|null $revive_started_at
 * @property string|null $revive_last_day  YYYY-MM-DD (UTC)
 */
class RoomMember extends ActiveRecord
{
    public static function tableName()
    {
        return '{{%room_members}}';
    }

    public function getUser()
    {
        return $this->hasOne(User::class, ['id' => 'user_id']);
    }

    public function getRoom()
    {
        return $this->hasOne(Room::class, ['id' => 'room_id']);
    }
}

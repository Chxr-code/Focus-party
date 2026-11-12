<?php

namespace app\models;

use yii\db\ActiveRecord;

/**
 * Boss templates. A boss room copies the name and max HP into the room and fights its own pest,
 * so current_hp / defeated_at here are not used any more.
 *
 * @property int $id
 * @property string $name
 * @property string $subject_code
 * @property int $max_hp
 * @property int $current_hp
 * @property int $created_by
 * @property int|null $defeated_at
 */
class Boss extends ActiveRecord
{
    public static function tableName()
    {
        return '{{%bosses}}';
    }

    public function fields()
    {
        return [
            'id' => fn () => (int) $this->id,
            'name',
            'subject_code',
            'max_hp' => fn () => (int) $this->max_hp,
            'current_hp' => fn () => (int) $this->max_hp,
            'created_by' => fn () => (int) $this->created_by,
            'defeated_at' => fn () => null,
        ];
    }
}

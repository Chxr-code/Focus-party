<?php

namespace app\models;

use Yii;
use app\components\Rules;
use yii\db\ActiveRecord;
use yii\web\IdentityInterface;

/**
 * @property int $id
 * @property string $username
 * @property string $password_hash
 * @property string $access_token
 * @property string $display_name
 * @property string|array|null $avatar
 * @property int $exp
 * @property string $role  student | admin
 * @property int $allow_friend_requests
 * @property string $garden_theme
 * @property int $created_at
 * @property int $updated_at
 */
class User extends ActiveRecord implements IdentityInterface
{
    public static function tableName()
    {
        return '{{%users}}';
    }

    public function init()
    {
        parent::init();
        if ($this->isNewRecord) {
            $this->role ??= 'student';
            $this->exp ??= 0;
        }
    }

    public function rules()
    {
        return [
            [['username', 'password_hash', 'access_token', 'display_name'], 'required'],
            [['exp', 'created_at', 'updated_at'], 'integer'],
            [['avatar'], 'safe'],
            [['username', 'access_token'], 'unique'],
            [['username'], 'string', 'max' => 50],
            [['display_name'], 'string', 'max' => 100],
            [['role'], 'in', 'range' => ['student', 'admin']],
        ];
    }

    // ---------- identity ----------

    public static function findIdentity($id)
    {
        return static::findOne(['id' => $id]);
    }

    public static function findIdentityByAccessToken($token, $type = null)
    {
        return static::findOne(['access_token' => $token]);
    }

    public function getId()
    {
        return $this->id;
    }

    public function getAuthKey()
    {
        return $this->access_token;
    }

    public function validateAuthKey($authKey)
    {
        return $this->access_token === $authKey;
    }

    public function validatePassword($password)
    {
        return Yii::$app->security->validatePassword($password, $this->password_hash);
    }

    public function setPassword($password)
    {
        $this->password_hash = Yii::$app->security->generatePasswordHash($password);
    }

    public function generateAccessToken()
    {
        $this->access_token = Yii::$app->security->generateRandomString(64);
    }

    // ---------- game ----------

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function getLevel(): int
    {
        return Rules::levelOf((int) $this->exp);
    }

    public function getUnlockedTrees(): array
    {
        return Rules::unlockedTrees($this->getLevel());
    }

    /** add (or remove) EXP; never below 0. Returns the change actually applied. */
    public function addExp(int $amount): int
    {
        $before = (int) $this->exp;
        $this->exp = max(0, $before + $amount);
        $this->updated_at = time();
        $this->save(false, ['exp', 'updated_at']);
        return (int) $this->exp - $before;
    }

    public function avatarData()
    {
        $avatar = $this->avatar;
        for ($i = 0; $i < 2 && is_string($avatar); $i++) {
            $decoded = json_decode($avatar, true);
            $avatar = $decoded ?? $avatar;
        }
        return $avatar;
    }

    /** what other players can see (room members, friends, gardens) */
    public function toPublic(): array
    {
        return [
            'id' => (int) $this->id,
            'username' => $this->username,
            'display_name' => $this->display_name,
            'avatar' => $this->avatarData(),
            'level' => $this->getLevel(),
            'allow_friend_requests' => (bool) $this->allow_friend_requests,
        ];
    }

    /** GET /api/me */
    public function fields()
    {
        return [
            'id' => fn () => (int) $this->id,
            'username',
            'display_name',
            'avatar' => fn () => $this->avatarData(),
            'exp' => fn () => (int) $this->exp,
            'level' => fn () => $this->getLevel(),
            'unlocked_trees' => fn () => $this->getUnlockedTrees(),
            'allow_friend_requests' => fn () => (bool) $this->allow_friend_requests,
            'garden_theme' => fn () => $this->garden_theme ?: 'pond',
            'role' => fn () => $this->role ?: 'student',
        ];
    }
}

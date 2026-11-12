<?php

namespace app\controllers;

use app\components\Rules;
use app\models\Garden;

class MeController extends ApiController
{
    /** GET /api/me */
    public function actionIndex()
    {
        return $this->ok($this->me()->toArray());
    }

    /** PUT /api/me/avatar  {avatar: {hair, hairColor, outfit, outfitColor, skin, pet: {type, color, name}}} */
    public function actionAvatar()
    {
        $avatar = $this->body()['avatar'] ?? null;
        if (!is_array($avatar) || !$avatar) {
            $this->fail(422, 'Validation failed', ['avatar' => ['Avatar must be an object']]);
        }
        if (isset($avatar['pet']['name'])) {
            $avatar['pet']['name'] = mb_substr(trim((string) $avatar['pet']['name']), 0, 20);
        }

        $user = $this->me();
        $user->avatar = json_encode($avatar, JSON_UNESCAPED_UNICODE);
        $user->updated_at = time();
        $user->save(false, ['avatar', 'updated_at']);

        return $this->ok($user->toArray());
    }

    /** PUT /api/me/settings  {allow_friend_requests?: bool, garden_theme?: "pond"|"hideout"|"autumn"|"farm"} */
    public function actionSettings()
    {
        $b = $this->body();
        $user = $this->me();

        if (array_key_exists('allow_friend_requests', $b)) {
            $user->allow_friend_requests = filter_var($b['allow_friend_requests'], FILTER_VALIDATE_BOOLEAN) ? 1 : 0;
        }
        if (array_key_exists('garden_theme', $b)) {
            $theme = (string) $b['garden_theme'];
            if (!isset(Rules::GARDEN_THEMES[$theme])) {
                $this->fail(422, 'Validation failed', ['garden_theme' => ['Unknown theme']]);
            }
            if ($user->getLevel() < Rules::GARDEN_THEMES[$theme]) {
                $this->fail(422, 'Validation failed', ['garden_theme' => ['Unlocks at Lv.' . Rules::GARDEN_THEMES[$theme]]]);
            }
            $user->garden_theme = $theme;
        }
        $user->updated_at = time();
        $user->save(false);

        return $this->ok($user->toArray());
    }

    /** GET /api/me/garden */
    public function actionGarden()
    {
        return $this->ok(Garden::listFor($this->me()->id, time()));
    }

    /** POST /api/me/garden/water — waters every tree at once */
    public function actionWater()
    {
        return $this->ok(Garden::water($this->me()->id, time()));
    }

    /** PUT /api/me/garden/{room_id}  {name} — empty name removes it */
    public function actionRenameTree($room_id)
    {
        $name = trim((string) ($this->body()['name'] ?? ''));
        if (mb_strlen($name) > 30) {
            $this->fail(422, 'Validation failed', ['name' => ['Max 30 characters']]);
        }
        foreach (Garden::members($this->me()->id, time()) as $m) {
            if ((int) $m->room_id === (int) $room_id) {
                $m->tree_name = $name === '' ? null : $name;
                $m->save(false, ['tree_name']);
                return $this->ok(Garden::entry($m));
            }
        }
        $this->fail(404, 'Tree not found');
    }
}

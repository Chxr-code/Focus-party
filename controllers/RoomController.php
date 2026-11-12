<?php

namespace app\controllers;

use Yii;
use app\components\Rules;
use app\models\Boss;
use app\models\Room;
use app\models\RoomMember;
use app\models\RoomMessage;

/**
 * Focus rooms. Times are unix seconds. Rules: app\components\Rules (same as frontend/src/rules.js).
 */
class RoomController extends ApiController
{
    /** GET /api/rooms?status=waiting|running|finished */
    public function actionIndex($status = null)
    {
        $now = time();
        $q = Room::find()->with(['host', 'members'])->orderBy(['id' => SORT_DESC])->limit(100);

        if ($status === 'waiting') {
            $q->andWhere(['status' => 'waiting']);
        } elseif ($status === 'running') {
            $q->andWhere(['<>', 'status', 'waiting'])->andWhere(['>', 'ends_at', $now]);
        } elseif ($status === 'finished') {
            $q->andWhere(['<>', 'status', 'waiting'])->andWhere(['<=', 'ends_at', $now]);
        } else {
            // everything still open, plus sessions that ended in the last day
            $q->andWhere(['or', ['status' => 'waiting'], ['>', 'ends_at', $now - Rules::DAY]]);
        }

        return $this->ok(array_map(fn (Room $r) => $r->toSummary($now), $q->all()));
    }

    /** GET /api/rooms/{id} */
    public function actionView($id)
    {
        return $this->ok($this->findRoom($id)->toDetail(time()));
    }

    /**
     * POST /api/rooms
     * {title, subject_code, location, tree_type, duration_minutes, max_members, boss_id?, theme?, chat_enabled?,
     *  break_every?, break_minutes?}
     */
    public function actionCreate()
    {
        $user = $this->me();
        $level = $user->getLevel();
        $b = $this->body();

        $title = trim((string) ($b['title'] ?? ''));
        $topic = trim((string) ($b['subject_code'] ?? $b['topic'] ?? ''));
        $location = trim((string) ($b['location'] ?? '')) ?: 'Online';
        $tree = (string) ($b['tree_type'] ?? '');
        $duration = (int) ($b['duration_minutes'] ?? 0);
        $maxMembers = (int) ($b['max_members'] ?? 0);
        $bossId = !empty($b['boss_id']) ? (int) $b['boss_id'] : null;
        $theme = !empty($b['theme']) ? (string) $b['theme'] : null;
        $chat = !array_key_exists('chat_enabled', $b) || filter_var($b['chat_enabled'], FILTER_VALIDATE_BOOLEAN);
        $every = (int) ($b['break_every'] ?? 0);
        $breakLen = (int) ($b['break_minutes'] ?? 0);
        $breaks = Rules::hasBreaks($every, $breakLen);

        $errors = [];
        if ($title === '') {
            $errors['title'][] = 'Title is required';
        } elseif (mb_strlen($title) > 60) {
            $errors['title'][] = 'Max 60 characters';
        }
        if ($topic === '') {
            $errors['topic'][] = 'Topic is required';
        } elseif (mb_strlen($topic) > 50) {
            $errors['topic'][] = 'Max 50 characters';
        }
        if (mb_strlen($location) > 100) {
            $errors['location'][] = 'Max 100 characters';
        }
        if (!isset(Rules::TREE_UNLOCKS[$tree])) {
            $errors['tree_type'][] = 'Unknown tree type';
        } elseif ($level < Rules::TREE_UNLOCKS[$tree]) {
            $errors['tree_type'][] = 'Unlocks at Lv.' . Rules::TREE_UNLOCKS[$tree];
        }
        $maxMinutes = $bossId ? Rules::MAX_BOSS_DURATION : Rules::MAX_DURATION;
        if ($duration < Rules::MIN_DURATION || $duration > $maxMinutes) {
            $errors['duration_minutes'][] = 'Must be ' . Rules::MIN_DURATION . "–$maxMinutes minutes";
        }
        if ($maxMembers < 2 || $maxMembers > 10) {
            $errors['max_members'][] = 'Must be 2–10 people';
        }
        $boss = null;
        if ($bossId) {
            $boss = Boss::findOne($bossId);
            if (!$boss) {
                $errors['boss_id'][] = 'Boss not found';
            } elseif ($level < Rules::BOSS_MIN_LEVEL) {
                $errors['boss_id'][] = 'Boss rooms unlock at Lv.' . Rules::BOSS_MIN_LEVEL;
            }
        }
        if ($theme !== null && !in_array($theme, Rules::ROOM_THEMES, true)) {
            $errors['theme'][] = 'Unknown theme';
        }
        if ($breaks) {
            if ($duration < Rules::MIN_BREAK_ROOM) {
                $errors['break_every'][] = 'Breaks need a room of ' . Rules::MIN_BREAK_ROOM . '+ minutes';
            } elseif ($every < Rules::MIN_BREAK_EVERY || $every >= $duration) {
                $errors['break_every'][] = 'Must be shorter than the room';
            }
            if ($breakLen > Rules::MAX_BREAK) {
                $errors['break_minutes'][] = 'Breaks are at most ' . Rules::MAX_BREAK . ' minutes';
            }
        }
        $this->validate($errors);

        $now = time();
        $room = new Room();
        $room->setAttributes([
            'host_id' => $user->id,
            'title' => $title,
            'subject_code' => $topic,
            'location' => $location,
            'tree_type' => $tree,
            'duration_minutes' => $duration,
            'max_members' => $maxMembers,
            'status' => 'waiting',
            'boss_id' => $boss ? $boss->id : null,
            'boss_name' => $boss ? $boss->name : null,
            'boss_max_hp' => $boss ? (int) $boss->max_hp : null,
            'bonus_exp' => $boss ? 0 : Rules::rollHarvestBonus($duration),
            'break_every' => $breaks ? $every : 0,
            'break_minutes' => $breaks ? $breakLen : 0,
            'theme' => $theme,
            'chat_enabled' => $chat ? 1 : 0,
            'created_at' => $now,
        ], false);

        $tx = Yii::$app->db->beginTransaction();
        $room->save(false);
        $this->addMember($room, $user->id, $now);
        $tx->commit();

        return $this->ok($this->reload($room)->toDetail($now));
    }

    /** POST /api/rooms/{id}/join */
    public function actionJoin($id)
    {
        $user = $this->me();
        $tx = Yii::$app->db->beginTransaction();
        $room = $this->findRoom($id, true);
        $now = time();

        if ($room->statusAt($now) !== 'waiting') {
            $this->fail(422, 'This room has already started');
        }
        if ($room->memberOf($user->id)) {
            $this->fail(422, 'You are already in this room');
        }
        if (count($room->activeMembers()) >= (int) $room->max_members) {
            $this->fail(422, 'Room is full');
        }
        if ($room->isBossRoom() && $user->getLevel() < Rules::BOSS_MIN_LEVEL) {
            $this->fail(403, 'Boss rooms unlock at Lv.' . Rules::BOSS_MIN_LEVEL);
        }

        $this->addMember($room, $user->id, $now);
        $tx->commit();
        return $this->ok($this->reload($room)->toDetail($now));
    }

    /** POST /api/rooms/{id}/start (host only) */
    public function actionStart($id)
    {
        $user = $this->me();
        $tx = Yii::$app->db->beginTransaction();
        $room = $this->findRoom($id, true);
        $now = time();

        if ((int) $room->host_id !== (int) $user->id) {
            $this->fail(403, 'Only the host can start the room');
        }
        if ($room->statusAt($now) !== 'waiting') {
            $this->fail(422, 'Room has already started');
        }

        $room->status = 'running';
        $room->started_at = $now;
        $room->ends_at = $now + 60 * Rules::sessionMinutes(
            (int) $room->duration_minutes,
            (int) $room->break_every,
            (int) $room->break_minutes
        );
        $room->save(false, ['status', 'started_at', 'ends_at']);
        $tx->commit();

        return $this->ok($this->reload($room)->toDetail($now));
    }

    /** POST /api/rooms/{id}/leave */
    public function actionLeave($id)
    {
        $user = $this->me();
        $tx = Yii::$app->db->beginTransaction();
        $room = $this->findRoom($id, true);
        $now = time();
        $member = $room->memberOf($user->id);

        if (!$member) {
            $this->fail(422, 'You are not in this room');
        }
        $status = $room->statusAt($now);

        // before the start: just step out. Last one out closes the room.
        if ($status === 'waiting') {
            $member->delete();
            $room = $this->reload($room);
            if (!$room->activeMembers()) {
                $room->delete();
            } elseif ((int) $room->host_id === (int) $user->id) {
                $room->passHost();
            }
            $tx->commit();
            return $this->ok(['room' => null, 'exp_gained' => 0, 'user' => $user->toArray()]);
        }
        if ($status === 'finished') {
            $this->fail(422, 'Session is over — harvest instead');
        }
        if ($member->status !== 'joined') {
            $this->fail(422, 'You already left this room');
        }

        // takes home the tree as it is right now
        $member->focused_seconds = $room->memberFocusSeconds($member, $now);
        $member->tree_stage = $room->memberStage($member, $now, false);
        $member->status = 'left';
        $member->left_at = $now;
        $member->last_watered_at = $now;
        $member->save(false);

        // before half of the focus time: -2 EXP (never below 0). Otherwise half the minutes, rounded up.
        $early = (int) $member->focused_seconds * 2 < (int) $room->duration_minutes * 60;
        $expGained = $user->addExp($early
            ? -Rules::EARLY_LEAVE_PENALTY
            : Rules::focusExp(intdiv((int) $member->focused_seconds, 60)));

        $room = $this->reload($room);
        if ((int) $room->host_id === (int) $user->id) {
            $room->passHost();
        }
        $tx->commit();

        return $this->ok(['room' => $room->toDetail($now), 'exp_gained' => $expGained, 'user' => $user->toArray()]);
    }

    /** POST /api/rooms/{id}/claim — harvest within 10 minutes after the end */
    public function actionClaim($id)
    {
        $user = $this->me();
        $tx = Yii::$app->db->beginTransaction();
        $room = $this->findRoom($id, true);
        $now = time();
        $member = $room->memberOf($user->id);

        if (!$member) {
            $this->fail(422, 'You are not in this room');
        }
        if ($room->statusAt($now) !== 'finished') {
            $this->fail(422, 'Session is not over yet');
        }
        if ($member->status === 'completed') {
            $this->fail(422, 'Already harvested');
        }
        if ($member->status !== 'joined') {
            $this->fail(422, 'You left this session early');
        }
        if ($now > (int) $room->ends_at + Rules::CLAIM_WINDOW) {
            $this->fail(422, 'Harvest time is over');
        }

        $end = (int) $room->ends_at;
        $member->focused_seconds = $room->focusSecondsSince($end);
        $member->status = 'completed';
        $member->claimed_at = $now;
        $member->last_watered_at = $now;
        $member->tree_stage = $room->memberStage($member, $end, true);
        $member->save(false);

        // half the minutes + bonus (boss rooms: only if the pest is dead)
        $duration = (int) $room->duration_minutes;
        $bonus = $room->isBossRoom()
            ? ($room->bossHp($end) === 0 ? Rules::bossBonus($duration) : 0)
            : (int) $room->bonus_exp;
        $expGained = $user->addExp(Rules::focusExp($duration) + $bonus);
        $tx->commit();

        return $this->ok(['room' => $this->reload($room)->toDetail($now), 'exp_gained' => $expGained, 'user' => $user->toArray()]);
    }

    /** GET /api/rooms/{id}/messages?after_id=0 */
    public function actionMessages($id, $after_id = 0)
    {
        $room = $this->findRoom($id);
        $rows = RoomMessage::find()
            ->with('user')
            ->where(['room_id' => $room->id])
            ->andWhere(['>', 'id', (int) $after_id])
            ->orderBy(['id' => SORT_DESC])
            ->limit(100)
            ->all();

        return $this->ok(array_map(fn ($m) => $m->toArray(), array_reverse($rows)));
    }

    /** POST /api/rooms/{id}/messages  {body} */
    public function actionSendMessage($id)
    {
        $user = $this->me();
        $room = $this->findRoom($id);

        if (!$room->chat_enabled) {
            $this->fail(403, 'Chat is off in this room');
        }
        if (!$room->memberOf($user->id)) {
            $this->fail(403, 'Join the room to chat');
        }
        $text = trim((string) ($this->body()['body'] ?? ''));
        if ($text === '') {
            $this->fail(422, 'Validation failed', ['body' => ['Message is empty']]);
        }
        if (mb_strlen($text) > 200) {
            $this->fail(422, 'Validation failed', ['body' => ['Max 200 characters']]);
        }

        $msg = new RoomMessage(['room_id' => $room->id, 'user_id' => $user->id, 'body' => $text, 'created_at' => time()]);
        $msg->save(false);

        return $this->ok($msg->toArray());
    }

    // ---------- helpers ----------

    private function findRoom($id, bool $lock = false): Room
    {
        $room = $lock
            ? Room::findBySql('SELECT * FROM {{%rooms}} WHERE id = :id FOR UPDATE', [':id' => (int) $id])->one()
            : Room::findOne((int) $id);
        if (!$room) {
            $this->fail(404, 'Room not found');
        }
        return $room;
    }

    private function reload(Room $room): Room
    {
        return Room::find()->with(['host', 'members.user'])->where(['id' => $room->id])->one();
    }

    private function addMember(Room $room, int $userId, int $now): void
    {
        (new RoomMember([
            'room_id' => $room->id,
            'user_id' => $userId,
            'status' => 'joined',
            'focused_seconds' => 0,
            'joined_at' => $now,
            'revive_count' => 0,
        ]))->save(false);
    }
}

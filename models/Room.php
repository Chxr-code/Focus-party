<?php

namespace app\models;

use app\components\Rules;
use yii\db\ActiveRecord;

/**
 * @property int $id
 * @property int $host_id
 * @property string $title
 * @property string|null $subject_code
 * @property string $location
 * @property string $tree_type
 * @property int $duration_minutes   focus minutes (breaks not included)
 * @property int $max_members
 * @property string $status          waiting | running   ("finished" = running and past ends_at)
 * @property int|null $started_at
 * @property int|null $ends_at       start + focus + breaks
 * @property int|null $boss_id       boss template the pest was copied from
 * @property string|null $boss_name
 * @property int|null $boss_max_hp   this room's own pest
 * @property int $bonus_exp          harvest bonus, rolled at creation (normal rooms)
 * @property int $break_every
 * @property int $break_minutes
 * @property string|null $theme
 * @property int $chat_enabled
 * @property int $created_at
 *
 * @property RoomMember[] $members
 * @property User $host
 */
class Room extends ActiveRecord
{
    public static function tableName()
    {
        return '{{%rooms}}';
    }

    public function getHost()
    {
        return $this->hasOne(User::class, ['id' => 'host_id']);
    }

    public function getMembers()
    {
        return $this->hasMany(RoomMember::class, ['room_id' => 'id'])
            ->orderBy(['joined_at' => SORT_ASC, 'id' => SORT_ASC]);
    }

    // ---------- state ----------

    public function statusAt(int $now): string
    {
        if ($this->status === 'waiting' || !$this->started_at) {
            return 'waiting';
        }
        return $now >= (int) $this->ends_at ? 'finished' : 'running';
    }

    /** @return RoomMember[] players who have not left */
    public function activeMembers(): array
    {
        return array_values(array_filter($this->members, fn ($m) => $m->status !== 'left'));
    }

    public function memberOf(int $userId): ?RoomMember
    {
        foreach ($this->members as $m) {
            if ((int) $m->user_id === $userId) {
                return $m;
            }
        }
        return null;
    }

    /** focused seconds of the whole room from start until $now (break time removed) */
    public function focusSecondsSince(int $now): int
    {
        if (!$this->started_at) {
            return 0;
        }
        $wall = min($now, (int) $this->ends_at) - (int) $this->started_at;
        return Rules::focusSeconds($wall, (int) $this->break_every, (int) $this->break_minutes);
    }

    public function memberFocusSeconds(RoomMember $m, int $now): int
    {
        if ($m->status !== 'joined') {
            return (int) $m->focused_seconds;
        }
        return $this->focusSecondsSince($now);
    }

    // ---------- boss (each room fights its own copy) ----------

    public function isBossRoom(): bool
    {
        return $this->boss_id !== null && (int) $this->boss_max_hp > 0;
    }

    /** 1 damage per focused minute per player */
    public function bossDamage(int $now): int
    {
        if (!$this->isBossRoom() || !$this->started_at) {
            return 0;
        }
        $sum = 0;
        foreach ($this->members as $m) {
            $sum += intdiv($this->memberFocusSeconds($m, $now), 60);
        }
        return $sum;
    }

    public function bossHp(int $now): ?int
    {
        return $this->isBossRoom() ? max(0, (int) $this->boss_max_hp - $this->bossDamage($now)) : null;
    }

    // ---------- tree ----------

    /** the tree in the middle of the room */
    public function roomStage(int $now): int
    {
        if (!$this->started_at) {
            return 1;
        }
        if ($this->isBossRoom()) {
            return Rules::bossStage($this->bossDamage($now), (int) $this->boss_max_hp);
        }
        $elapsed = intdiv($this->focusSecondsSince($now), 60);
        $someoneStayed = false;
        foreach ($this->members as $m) {
            $someoneStayed = $someoneStayed || $m->status !== 'left';
        }
        $finished = $this->statusAt($now) === 'finished';
        return Rules::normalStage($elapsed, (int) $this->duration_minutes, $finished && $someoneStayed);
    }

    /** the tree one player takes home when they leave or harvest */
    public function memberStage(RoomMember $m, int $now, bool $completed): int
    {
        if ($this->isBossRoom()) {
            return Rules::bossStage($this->bossDamage($now), (int) $this->boss_max_hp);
        }
        return Rules::normalStage(intdiv((int) $m->focused_seconds, 60), (int) $this->duration_minutes, $completed);
    }

    public function treeProgress(int $now): int
    {
        if (!$this->started_at) {
            return 0;
        }
        if ($this->isBossRoom()) {
            return min(100, (int) round($this->bossDamage($now) / (int) $this->boss_max_hp * 100));
        }
        return min(100, (int) round($this->focusSecondsSince($now) / ((int) $this->duration_minutes * 60) * 100));
    }

    /** host left: whoever joined first among the people still in the room */
    public function passHost(): void
    {
        foreach ($this->members as $m) {
            if ($m->status !== 'left' && (int) $m->user_id !== (int) $this->host_id) {
                $this->host_id = $m->user_id;
                $this->save(false, ['host_id']);
                return;
            }
        }
    }

    // ---------- output ----------

    public function toSummary(int $now): array
    {
        return [
            'id' => (int) $this->id,
            'title' => $this->title,
            'subject_code' => $this->subject_code,
            'location' => $this->location,
            'tree_type' => $this->tree_type,
            'duration_minutes' => (int) $this->duration_minutes,
            'max_members' => (int) $this->max_members,
            'status' => $this->statusAt($now),
            'started_at' => $this->started_at ? (int) $this->started_at : null,
            'ends_at' => $this->ends_at ? (int) $this->ends_at : null,
            'created_at' => (int) $this->created_at,
            'boss_id' => $this->boss_id ? (int) $this->boss_id : null,
            'boss_name' => $this->boss_name,
            'boss_max_hp' => $this->isBossRoom() ? (int) $this->boss_max_hp : null,
            'bonus_exp' => $this->isBossRoom() ? null : (int) $this->bonus_exp,
            'break_every' => (int) $this->break_every,
            'break_minutes' => (int) $this->break_minutes,
            'theme' => $this->theme,
            'chat_enabled' => (bool) $this->chat_enabled,
            'host' => $this->host ? $this->host->toPublic() : null,
            'member_count' => count($this->activeMembers()),
        ];
    }

    public function toDetail(int $now): array
    {
        $members = [];
        foreach ($this->members as $m) {
            if (!$m->user) {
                continue;
            }
            $members[] = ['user_id' => (int) $m->user_id] + $m->user->toPublic() + ['status' => $m->status];
        }
        $stage = $this->roomStage($now);
        return $this->toSummary($now) + [
            'members' => $members,
            'server_time' => $now,
            'boss_hp' => $this->bossHp($now),
            'tree_stage' => $stage,
            'tree_progress' => $this->treeProgress($now),
            'bloomed' => $stage >= 3 && $this->statusAt($now) === 'finished',
        ];
    }
}

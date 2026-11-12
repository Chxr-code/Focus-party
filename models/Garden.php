<?php

namespace app\models;

use app\components\Rules;

/**
 * A player's garden = their room_members rows in rooms that have finished.
 * Life rules (same as frontend/src/garden/life.js):
 *   dies if not watered for 30 / 60 / 90 / 180 days (stage 1 / 2 / 3 / 4)
 *   a dead tree comes back after waterings on 5 different days within 30 days
 */
class Garden
{
    /** @return RoomMember[] */
    public static function members(int $userId, int $now): array
    {
        $rows = RoomMember::find()
            ->alias('m')
            ->innerJoinWith('room r')
            ->where(['m.user_id' => $userId])
            ->andWhere(['<>', 'r.status', 'waiting'])
            ->andWhere(['not', ['r.started_at' => null]])
            ->andWhere(['<=', 'r.ends_at', $now])
            ->orderBy(['r.ends_at' => SORT_ASC, 'm.id' => SORT_ASC])
            ->all();

        foreach ($rows as $m) {
            // stayed until the end but never pressed harvest: still gets the full tree (no EXP)
            if ($m->status === 'joined' && $m->tree_stage === null) {
                $m->tree_stage = $m->room->memberStage($m, (int) $m->room->ends_at, true);
                $m->focused_seconds = $m->room->focusSecondsSince((int) $m->room->ends_at);
                $m->save(false, ['tree_stage', 'focused_seconds']);
            }
        }
        return $rows;
    }

    public static function stageOf(RoomMember $m): int
    {
        return max(1, min(4, (int) ($m->tree_stage ?? 1)));
    }

    public static function lastWatered(RoomMember $m): int
    {
        return (int) ($m->last_watered_at ?: $m->room->ends_at);
    }

    public static function entry(RoomMember $m): array
    {
        $room = $m->room;
        $stage = self::stageOf($m);
        return [
            'room_id' => (int) $room->id,
            'title' => $room->title,
            'tree_type' => $room->tree_type,
            'boss_id' => $room->boss_id ? (int) $room->boss_id : null,
            'tree_stage' => $stage,
            'bloomed' => $stage >= 3,
            'finished_at' => (int) $room->ends_at,
            'name' => $m->tree_name,
            'last_watered_at' => self::lastWatered($m),
            'revive_count' => (int) $m->revive_count,
            'revive_started_at' => $m->revive_started_at ? (int) $m->revive_started_at : null,
            'revive_last_day' => $m->revive_last_day,
        ];
    }

    public static function listFor(int $userId, int $now): array
    {
        return array_map([self::class, 'entry'], self::members($userId, $now));
    }

    /** one watering for every tree of this player */
    public static function water(int $userId, int $now): array
    {
        $today = Rules::dayKey($now);
        foreach (self::members($userId, $now) as $m) {
            if (!Rules::isDead(self::stageOf($m), self::lastWatered($m), $now)) {
                $m->last_watered_at = $now;
                $m->revive_count = 0;
                $m->revive_started_at = null;
                $m->revive_last_day = null;
            } else {
                $start = $m->revive_started_at ? (int) $m->revive_started_at : null;
                $fresh = $start === null || $now - $start > Rules::REVIVE_WINDOW_DAYS * Rules::DAY;
                if ($fresh) {
                    $m->revive_started_at = $now;
                    $m->revive_count = 1;
                    $m->revive_last_day = $today;
                } elseif ($m->revive_last_day !== $today) {
                    $count = (int) $m->revive_count + 1;
                    if ($count >= Rules::REVIVE_WATERINGS) {
                        // back to life
                        $m->last_watered_at = $now;
                        $m->revive_count = 0;
                        $m->revive_started_at = null;
                        $m->revive_last_day = null;
                    } else {
                        $m->revive_count = $count;
                        $m->revive_last_day = $today;
                    }
                }
            }
            $m->save(false, ['last_watered_at', 'revive_count', 'revive_started_at', 'revive_last_day']);
        }
        return self::listFor($userId, $now);
    }
}

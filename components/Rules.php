<?php

namespace app\components;

/**
 * Game rules — the same numbers as frontend/src/rules.js and frontend/src/garden/life.js.
 * Every result is a whole number: anything that divides rounds UP.
 */
class Rules
{
    // levels
    public const EXP_PER_LEVEL = 100;
    public const MAX_LEVEL = 60;
    public const TREE_UNLOCKS = ['cactus' => 1, 'sakura' => 3, 'mushroom' => 5];
    public const GARDEN_THEMES = ['pond' => 1, 'hideout' => 3, 'autumn' => 5, 'farm' => 8];
    public const ROOM_THEMES = ['forest', 'dark', 'ruins', 'candy', 'dusk', 'city'];

    // rooms
    public const MIN_DURATION = 15;
    public const MAX_DURATION = 180;
    public const MAX_BOSS_DURATION = 360;
    public const BOSS_MIN_LEVEL = 30;
    public const EARLY_LEAVE_PENALTY = 2;
    public const CLAIM_WINDOW = 600; // seconds after the end
    public const HARVEST_BONUS = 10;
    public const LONG_ROOM_MINUTES = 60;
    public const LUCKY_ONE_IN = 5; // 20 %

    // breaks
    public const MIN_BREAK_ROOM = 50;
    public const MAX_BREAK = 20;
    public const MIN_BREAK_EVERY = 15;

    // garden
    public const LIFE_DAYS = [1 => 30, 2 => 60, 3 => 90, 4 => 180];
    public const REVIVE_WATERINGS = 5;
    public const REVIVE_WINDOW_DAYS = 30;
    public const DAY = 86400;

    public static function levelOf(int $exp): int
    {
        return min(self::MAX_LEVEL, intdiv(max(0, $exp), self::EXP_PER_LEVEL) + 1);
    }

    public static function unlockedTrees(int $level): array
    {
        return array_keys(array_filter(self::TREE_UNLOCKS, fn ($lv) => $level >= $lv));
    }

    /** EXP for focused minutes: half, rounded up (25 -> 13, 60 -> 30) */
    public static function focusExp(int $minutes): int
    {
        return (int) ceil(max(0, $minutes) / 2);
    }

    /** harvest bonus of a normal room, rolled once when the room is created */
    public static function rollHarvestBonus(int $duration): int
    {
        if ($duration >= self::LONG_ROOM_MINUTES) {
            return self::HARVEST_BONUS;
        }
        return random_int(1, self::LUCKY_ONE_IN) === 1 ? random_int(1, self::HARVEST_BONUS) : 0;
    }

    /** bonus when the pest dies: 1 per 10 minutes (rounded up), doubled from 100 minutes */
    public static function bossBonus(int $minutes): int
    {
        $base = (int) ceil(max(0, $minutes) / 10);
        return $minutes >= 100 ? $base * 2 : $base;
    }

    /** normal room: grows at half the duration, fully grown only when the session is completed */
    public static function normalStage(int $focusedMinutes, int $duration, bool $completed): int
    {
        if ($completed) {
            return 3;
        }
        return $focusedMinutes >= (int) ceil($duration / 2) ? 2 : 1;
    }

    /** boss room: grows every HP/3, the win tree (4) only when the pest is dead */
    public static function bossStage(int $damage, int $maxHp): int
    {
        if ($damage >= $maxHp) {
            return 4;
        }
        if ($damage >= (int) ceil($maxHp * 2 / 3)) {
            return 3;
        }
        if ($damage >= (int) ceil($maxHp / 3)) {
            return 2;
        }
        return 1;
    }

    // ---------- breaks: focus E min | break B min | focus E | ... | last focus block ----------

    public static function hasBreaks(int $every, int $break): bool
    {
        return $every > 0 && $break > 0;
    }

    public static function breakCount(int $duration, int $every, int $break): int
    {
        return self::hasBreaks($every, $break) ? max(0, (int) ceil($duration / $every) - 1) : 0;
    }

    /** minutes from start to end, breaks included */
    public static function sessionMinutes(int $duration, int $every, int $break): int
    {
        return $duration + self::breakCount($duration, $every, $break) * $break;
    }

    /** wall-clock seconds since the start -> focused seconds (break time removed) */
    public static function focusSeconds(int $wallSeconds, int $every, int $break): int
    {
        $wall = max(0, $wallSeconds);
        if (!self::hasBreaks($every, $break)) {
            return $wall;
        }
        $focus = $every * 60;
        $cycle = $focus + $break * 60;
        $n = intdiv($wall, $cycle);
        return $n * $focus + min($wall - $n * $cycle, $focus);
    }

    // ---------- garden ----------

    public static function isDead(int $stage, int $lastWatered, int $now): bool
    {
        $days = self::LIFE_DAYS[max(1, min(4, $stage))];
        return $now - $lastWatered > $days * self::DAY;
    }

    /** UTC day key, the same as the React side (toISOString().slice(0, 10)) */
    public static function dayKey(int $time): string
    {
        return gmdate('Y-m-d', $time);
    }
}

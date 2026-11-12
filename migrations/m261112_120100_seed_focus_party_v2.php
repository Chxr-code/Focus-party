<?php

use yii\db\Migration;
use yii\db\Query;

/**
 * Demo data for v2 (presentation):
 *   admin / Admin1234 (Lv.30, can set its own level)
 *   focus_demo1..4 / Focus1234 — demo1 + demo2 are friends, demo3 has a pending request to demo1,
 *   demo4 doesn't accept requests, demo1 has 14 trees (2 fields, one dead), boss templates, chat messages.
 */
class m261112_120100_seed_focus_party_v2 extends Migration
{
    private const DAY = 86400;

    public function safeUp()
    {
        $now = time();
        $security = Yii::$app->security;

        // ---------- admin ----------
        if (!$this->userId('admin')) {
            $this->insert('{{%users}}', [
                'username' => 'admin',
                'password_hash' => $security->generatePasswordHash('Admin1234'),
                'access_token' => $security->generateRandomString(64),
                'display_name' => 'Admin',
                'avatar' => json_encode(['hair' => 1, 'hairColor' => 'silver', 'outfit' => 2, 'outfitColor' => 'navy', 'skin' => 'tan']),
                'exp' => 2900,
                'role' => 'admin',
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        $admin = $this->userId('admin');

        // ---------- demo players: real characters + levels ----------
        $demo = [
            'focus_demo1' => [650, ['hair' => 3, 'hairColor' => 'brown', 'outfit' => 3, 'outfitColor' => 'green', 'skin' => 'peach',
                'pet' => ['type' => 'cloudy', 'color' => 'sky', 'name' => 'Mochi']]],
            'focus_demo2' => [180, ['hair' => 2, 'hairColor' => 'mint', 'outfit' => 1, 'outfitColor' => 'white', 'skin' => 'light']],
            'focus_demo3' => [3100, ['hair' => 4, 'hairColor' => 'pink', 'outfit' => 5, 'outfitColor' => 'navy', 'skin' => 'tan',
                'pet' => ['type' => 'cat', 'color' => 'cocoa', 'name' => 'Kuma']]],
            'focus_demo4' => [520, ['hair' => 1, 'hairColor' => 'black', 'outfit' => 2, 'outfitColor' => 'red', 'skin' => 'brown']],
        ];
        foreach ($demo as $username => [$exp, $avatar]) {
            $this->update('{{%users}}', ['exp' => $exp, 'avatar' => json_encode($avatar)], ['username' => $username]);
        }
        $u = [];
        foreach (array_keys($demo) as $username) {
            $u[$username] = $this->userId($username);
        }
        if (in_array(null, $u, true)) {
            return true; // old seed not run: only the admin is added
        }
        $this->update('{{%users}}', ['allow_friend_requests' => 0], ['id' => $u['focus_demo4']]);

        // ---------- friends ----------
        $this->insert('{{%friend_requests}}', ['from_id' => $u['focus_demo1'], 'to_id' => $u['focus_demo2'], 'status' => 'accepted', 'created_at' => $now]);
        $this->insert('{{%friend_requests}}', ['from_id' => $u['focus_demo3'], 'to_id' => $u['focus_demo1'], 'status' => 'pending', 'created_at' => $now]);

        // ---------- boss templates ----------
        foreach ([['Baby Pest', 60], ['Pest Worm', 120], ['Giant Pest', 320]] as [$name, $hp]) {
            $this->insert('{{%bosses}}', ['name' => $name, 'subject_code' => 'Any', 'max_hp' => $hp, 'current_hp' => $hp, 'created_by' => $admin]);
        }
        $babyPest = (int) (new Query())->select('id')->from('{{%bosses}}')->where(['name' => 'Baby Pest'])->scalar($this->db);

        // ---------- old seed fixes: every waiting room has its host inside ----------
        $waiting = (new Query())->select(['id', 'host_id'])->from('{{%rooms}}')->where(['status' => 'waiting'])->all($this->db);
        foreach ($waiting as $r) {
            $in = (new Query())->from('{{%room_members}}')->where(['room_id' => $r['id'], 'user_id' => $r['host_id']])->exists($this->db);
            if (!$in) {
                $this->insert('{{%room_members}}', ['room_id' => $r['id'], 'user_id' => $r['host_id'], 'status' => 'joined', 'focused_seconds' => 0, 'joined_at' => $now]);
            }
        }

        // ---------- open rooms for the demo ----------
        $quiet = $this->room($u['focus_demo2'], 'อ่านเงียบ ๆ ไม่คุย', 'Reading', 'cactus', 50, ['chat_enabled' => 0, 'theme' => 'candy', 'bonus_exp' => 0], $now);
        $this->member($quiet, $u['focus_demo2'], 'joined', $now);

        $chat = $this->room($u['focus_demo3'], 'ติวสอบ Web ด้วยกัน', 'WEB101', 'sakura', 60,
            ['theme' => 'dusk', 'bonus_exp' => 10, 'break_every' => 30, 'break_minutes' => 10], $now);
        $this->member($chat, $u['focus_demo3'], 'joined', $now - 120);
        $this->member($chat, $u['focus_demo4'], 'joined', $now - 60);
        foreach ([[$u['focus_demo3'], 'มาอ่านด้วยกันนะ', 110], [$u['focus_demo4'], 'พร้อมแล้ว!', 50]] as [$who, $text, $ago]) {
            $this->insert('{{%room_messages}}', ['room_id' => $chat, 'user_id' => $who, 'body' => $text, 'created_at' => $now - $ago]);
        }

        $boss = $this->room($u['focus_demo3'], 'ปราบหนอนก่อนสอบ', 'Calculus', 'mushroom', 60,
            ['theme' => 'dark', 'boss_id' => $babyPest, 'boss_name' => 'Baby Pest', 'boss_max_hp' => 60], $now);
        $this->member($boss, $u['focus_demo3'], 'joined', $now);

        // ---------- focus_demo1's garden: 14 trees (scrolls to a 2nd field), one dead ----------
        $types = ['cactus', 'sakura', 'mushroom'];
        for ($i = 0; $i < 14; $i++) {
            $stage = [3, 2, 1, 3, 4, 3, 2, 3, 1, 3, 2, 3, 4, 3][$i];
            $ended = $now - (40 - $i * 2) * self::DAY;
            $room = $this->room($u['focus_demo1'], 'ห้องอ่าน #' . ($i + 1), 'WEB101', $types[$i % 3], 25, [
                'status' => 'running',
                'started_at' => $ended - 25 * 60,
                'ends_at' => $ended,
                'boss_id' => $stage === 4 ? $babyPest : null,
                'boss_name' => $stage === 4 ? 'Baby Pest' : null,
                'boss_max_hp' => $stage === 4 ? 60 : null,
                'created_at' => $ended - 30 * 60,
            ], $now);
            $this->member($room, $u['focus_demo1'], $stage >= 3 ? 'completed' : 'left', $ended - 25 * 60, [
                'focused_seconds' => $stage >= 3 ? 1500 : ($stage === 2 ? 780 : 300),
                'tree_stage' => $stage,
                'tree_name' => $i === 0 ? 'ต้นแรกของฉัน' : null,
                // tree 2 hasn't been watered for 100 days -> dead (a grown tree lives 90)
                'last_watered_at' => $i === 1 ? $now - 100 * self::DAY : $now - 2 * self::DAY,
                'claimed_at' => $stage >= 3 ? $ended + 60 : null,
                'left_at' => $stage >= 3 ? null : $ended - 10 * 60,
            ]);
        }
    }

    public function safeDown()
    {
        $this->delete('{{%users}}', ['username' => 'admin']);
        $this->delete('{{%bosses}}', ['name' => ['Baby Pest', 'Pest Worm', 'Giant Pest']]);
        $this->delete('{{%friend_requests}}');
    }

    private function userId(string $username): ?int
    {
        $id = (new Query())->select('id')->from('{{%users}}')->where(['username' => $username])->scalar($this->db);
        return $id ? (int) $id : null;
    }

    private function room(int $host, string $title, string $topic, string $tree, int $minutes, array $extra, int $now): int
    {
        $this->insert('{{%rooms}}', $extra + [
            'host_id' => $host,
            'title' => $title,
            'subject_code' => $topic,
            'location' => 'Online',
            'tree_type' => $tree,
            'duration_minutes' => $minutes,
            'max_members' => 4,
            'status' => 'waiting',
            'created_at' => $now,
        ]);
        return (int) $this->db->getLastInsertID();
    }

    private function member(int $room, int $user, string $status, int $joinedAt, array $extra = []): void
    {
        $this->insert('{{%room_members}}', $extra + [
            'room_id' => $room,
            'user_id' => $user,
            'status' => $status,
            'focused_seconds' => 0,
            'joined_at' => $joinedAt,
        ]);
    }
}

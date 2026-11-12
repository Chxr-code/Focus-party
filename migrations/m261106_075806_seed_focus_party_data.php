
<?php

use yii\db\Migration;

class m261106_075806_seed_focus_party_data extends Migration
{
    public function safeUp()
    {
        $now = time();
        $passwordHash = Yii::$app->security->generatePasswordHash('Focus1234');

        // 1. Create demo users
        $users = [
            ['focus_demo1', 'นักอ่านมือใหม่', 0],
            ['focus_demo2', 'นักอ่านสายลุย', 80],
            ['focus_demo3', 'นักอ่านตัวจริง', 250],
            ['focus_demo4', 'นักอ่านระดับโปร', 520],
        ];

        foreach ($users as $user) {
            $this->insert('{{%users}}', [
                'username' => $user[0],
                'password_hash' => $passwordHash,
                'access_token' => Yii::$app->security->generateRandomString(64),
                'display_name' => $user[1],
                'avatar' => json_encode([
                    'type' => 'pixel',
                    'color' => '#7BC96F',
                ]),
                'exp' => $user[2],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $userIds = [];
        foreach ($users as $user) {
            $userIds[$user[0]] = (int) $this->db
                ->createCommand(
                    'SELECT id FROM {{%users}} WHERE username = :username',
                    [':username' => $user[0]]
                )
                ->queryScalar();
        }

        // 2. Create bosses
        $bosses = [
            [
                'name' => 'Shadow Dragon',
                'subject_code' => 'WEB101',
                'max_hp' => 500,
                'current_hp' => 500,
                'created_by' => $userIds['focus_demo3'],
            ],
            [
                'name' => 'Exam Monster',
                'subject_code' => 'DB101',
                'max_hp' => 300,
                'current_hp' => 300,
                'created_by' => $userIds['focus_demo4'],
            ],
        ];

        foreach ($bosses as $boss) {
            $this->insert('{{%bosses}}', $boss);
        }

        $boss1 = (int) $this->db->createCommand(
            'SELECT id FROM {{%bosses}} WHERE name = :name',
            [':name' => 'Shadow Dragon']
        )->queryScalar();

        $boss2 = (int) $this->db->createCommand(
            'SELECT id FROM {{%bosses}} WHERE name = :name',
            [':name' => 'Exam Monster']
        )->queryScalar();

        // 3. Create rooms
        $rooms = [
            [
                'title' => 'ห้องอ่าน HTML & CSS',
                'host_id' => $userIds['focus_demo1'],
                'subject_code' => 'WEB101',
                'location' => 'Library Zone A',
                'tree_type' => 'cactus',
                'duration_minutes' => 25,
                'max_members' => 4,
                'status' => 'waiting',
                'started_at' => null,
                'ends_at' => null,
                'boss_id' => null,
                'created_at' => $now,
            ],
            [
                'title' => 'ห้องอ่าน JavaScript',
                'host_id' => $userIds['focus_demo3'],
                'subject_code' => 'WEB102',
                'location' => 'Library Zone B',
                'tree_type' => 'sakura',
                'duration_minutes' => 50,
                'max_members' => 4,
                'status' => 'running',
                'started_at' => $now - 600,
                'ends_at' => $now + 2400,
                'boss_id' => $boss1,
                'created_at' => $now - 600,
            ],
            [
                'title' => 'ห้องอ่าน Database',
                'host_id' => $userIds['focus_demo4'],
                'subject_code' => 'DB101',
                'location' => 'Library Zone C',
                'tree_type' => 'mushroom',
                'duration_minutes' => 60,
                'max_members' => 5,
                'status' => 'finished',
                'started_at' => $now - 7200,
                'ends_at' => $now - 3600,
                'boss_id' => $boss2,
                'created_at' => $now - 7200,
            ],
            [
                'title' => 'ห้องอ่าน UX/UI Design',
                'host_id' => $userIds['focus_demo3'],
                'subject_code' => 'UX101',
                'location' => 'Design Room',
                'tree_type' => 'sakura',
                'duration_minutes' => 25,
                'max_members' => 4,
                'status' => 'waiting',
                'started_at' => null,
                'ends_at' => null,
                'boss_id' => null,
                'created_at' => $now,
            ],
            [
                'title' => 'ห้องอ่าน Python',
                'host_id' => $userIds['focus_demo4'],
                'subject_code' => 'PY101',
                'location' => 'Library Zone D',
                'tree_type' => 'mushroom',
                'duration_minutes' => 50,
                'max_members' => 4,
                'status' => 'waiting',
                'started_at' => null,
                'ends_at' => null,
                'boss_id' => null,
                'created_at' => $now,
            ],
            [
                'title' => 'ห้องอ่าน Project',
                'host_id' => $userIds['focus_demo2'],
                'subject_code' => 'PJ101',
                'location' => 'Group Study Room',
                'tree_type' => 'cactus',
                'duration_minutes' => 25,
                'max_members' => 3,
                'status' => 'waiting',
                'started_at' => null,
                'ends_at' => null,
                'boss_id' => null,
                'created_at' => $now,
            ],
        ];

        foreach ($rooms as $room) {
            $this->insert('{{%rooms}}', $room);
        }

        // 4. Add room members
        $roomIds = [];
        foreach ($rooms as $room) {
            $roomIds[$room['title']] = (int) $this->db
                ->createCommand(
                    'SELECT id FROM {{%rooms}} WHERE title = :title',
                    [':title' => $room['title']]
                )
                ->queryScalar();
        }

        $members = [
            // Waiting room
            [$roomIds['ห้องอ่าน HTML & CSS'], $userIds['focus_demo1'], 'joined', 0, $now],

            // Running room
            [$roomIds['ห้องอ่าน JavaScript'], $userIds['focus_demo3'], 'joined', 600, $now - 600],
            [$roomIds['ห้องอ่าน JavaScript'], $userIds['focus_demo1'], 'joined', 600, $now - 600],
            [$roomIds['ห้องอ่าน JavaScript'], $userIds['focus_demo2'], 'joined', 600, $now - 600],

            // Finished room
            [$roomIds['ห้องอ่าน Database'], $userIds['focus_demo4'], 'completed', 3600, $now - 7200],
            [$roomIds['ห้องอ่าน Database'], $userIds['focus_demo3'], 'completed', 3600, $now - 7200],
        ];

        foreach ($members as $member) {
            $this->insert('{{%room_members}}', [
                'room_id' => $member[0],
                'user_id' => $member[1],
                'status' => $member[2],
                'focused_seconds' => $member[3],
                'joined_at' => $member[4],
                'left_at' => $member[2] === 'completed' ? $now - 3600 : null,
                'claimed_at' => $member[2] === 'completed' ? $now - 3500 : null,
            ]);
        }
    }

    public function safeDown()
    {
        $usernames = [
            'focus_demo1',
            'focus_demo2',
            'focus_demo3',
            'focus_demo4',
        ];

        $userIds = (new \yii\db\Query())
            ->select('id')
            ->from('{{%users}}')
            ->where(['username' => $usernames])
            ->column($this->db);

        $roomIds = (new \yii\db\Query())
            ->select('id')
            ->from('{{%rooms}}')
            ->where(['host_id' => $userIds])
            ->column($this->db);

        $this->delete('{{%room_members}}', ['room_id' => $roomIds]);
        $this->delete('{{%rooms}}', ['id' => $roomIds]);
        $this->delete('{{%bosses}}', ['created_by' => $userIds]);
        $this->delete('{{%users}}', ['id' => $userIds]);
    }
}

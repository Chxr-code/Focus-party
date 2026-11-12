<?php

use yii\db\Migration;

/**
 * Focus Party v2: room themes / chat / breaks / own boss / harvest bonus, chat messages,
 * friends, garden (watering, names, tree stage), user settings.
 */
class m261112_120000_focus_party_v2 extends Migration
{
    public function safeUp()
    {
        // ---------- rooms ----------
        $this->addColumn('{{%rooms}}', 'theme', $this->string(20)->null());
        $this->addColumn('{{%rooms}}', 'chat_enabled', $this->boolean()->notNull()->defaultValue(1));
        $this->addColumn('{{%rooms}}', 'break_every', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%rooms}}', 'break_minutes', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%rooms}}', 'boss_name', $this->string(60)->null());
        $this->addColumn('{{%rooms}}', 'boss_max_hp', $this->integer()->null());
        $this->addColumn('{{%rooms}}', 'bonus_exp', $this->integer()->notNull()->defaultValue(0));
        $this->createIndex('idx-rooms-status-ends_at', '{{%rooms}}', ['status', 'ends_at']);

        // old boss rooms: copy the boss into the room (each room now fights its own pest)
        $this->execute(
            'UPDATE {{%rooms}} r JOIN {{%bosses}} b ON b.id = r.boss_id
             SET r.boss_name = b.name, r.boss_max_hp = b.max_hp'
        );

        // ---------- room_members (one row = one tree in the garden) ----------
        $this->addColumn('{{%room_members}}', 'tree_stage', $this->tinyInteger()->null()
            ->comment('1 seedling, 2 growing, 3 grown, 4 boss win'));
        $this->addColumn('{{%room_members}}', 'tree_name', $this->string(30)->null());
        $this->addColumn('{{%room_members}}', 'last_watered_at', $this->integer()->null());
        $this->addColumn('{{%room_members}}', 'revive_count', $this->integer()->notNull()->defaultValue(0));
        $this->addColumn('{{%room_members}}', 'revive_started_at', $this->integer()->null());
        $this->addColumn('{{%room_members}}', 'revive_last_day', $this->string(10)->null());

        // trees from before v2: harvested = grown (boss room = win), left early = seedling
        $this->execute(
            "UPDATE {{%room_members}} m JOIN {{%rooms}} r ON r.id = m.room_id
             SET m.tree_stage = CASE WHEN m.status = 'completed' THEN IF(r.boss_id IS NULL, 3, 4) ELSE 1 END
             WHERE m.status IN ('completed', 'left')"
        );

        // ---------- users ----------
        $this->addColumn('{{%users}}', 'allow_friend_requests', $this->boolean()->notNull()->defaultValue(1));
        $this->addColumn('{{%users}}', 'garden_theme', $this->string(20)->notNull()->defaultValue('pond'));

        // ---------- chat ----------
        $this->createTable('{{%room_messages}}', [
            'id' => $this->primaryKey(),
            'room_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'body' => $this->string(200)->notNull(),
            'created_at' => $this->integer()->notNull(),
        ], $this->tableOptions());
        $this->createIndex('idx-room_messages-room-id', '{{%room_messages}}', ['room_id', 'id']);
        $this->addForeignKey('fk-room_messages-room_id', '{{%room_messages}}', 'room_id', '{{%rooms}}', 'id', 'CASCADE', 'CASCADE');
        $this->addForeignKey('fk-room_messages-user_id', '{{%room_messages}}', 'user_id', '{{%users}}', 'id', 'CASCADE', 'CASCADE');

        // ---------- friends ----------
        $this->createTable('{{%friend_requests}}', [
            'id' => $this->primaryKey(),
            'from_id' => $this->integer()->notNull(),
            'to_id' => $this->integer()->notNull(),
            'status' => $this->string(10)->notNull()->defaultValue('pending')->comment('pending | accepted'),
            'created_at' => $this->integer()->notNull(),
        ], $this->tableOptions());
        $this->createIndex('uq-friend_requests-from-to', '{{%friend_requests}}', ['from_id', 'to_id'], true);
        $this->createIndex('idx-friend_requests-to', '{{%friend_requests}}', ['to_id']);
        $this->addForeignKey('fk-friend_requests-from_id', '{{%friend_requests}}', 'from_id', '{{%users}}', 'id', 'CASCADE', 'CASCADE');
        $this->addForeignKey('fk-friend_requests-to_id', '{{%friend_requests}}', 'to_id', '{{%users}}', 'id', 'CASCADE', 'CASCADE');
    }

    public function safeDown()
    {
        $this->dropTable('{{%friend_requests}}');
        $this->dropTable('{{%room_messages}}');
        $this->dropColumn('{{%users}}', 'garden_theme');
        $this->dropColumn('{{%users}}', 'allow_friend_requests');
        foreach (['revive_last_day', 'revive_started_at', 'revive_count', 'last_watered_at', 'tree_name', 'tree_stage'] as $c) {
            $this->dropColumn('{{%room_members}}', $c);
        }
        $this->dropIndex('idx-rooms-status-ends_at', '{{%rooms}}');
        foreach (['bonus_exp', 'boss_max_hp', 'boss_name', 'break_minutes', 'break_every', 'chat_enabled', 'theme'] as $c) {
            $this->dropColumn('{{%rooms}}', $c);
        }
    }

    private function tableOptions(): ?string
    {
        return $this->db->driverName === 'mysql'
            ? 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ENGINE=InnoDB'
            : null;
    }
}

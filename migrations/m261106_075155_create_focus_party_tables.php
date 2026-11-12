
<?php

use yii\db\Migration;

class m261106_075155_create_focus_party_tables extends Migration
{
    public function safeUp()
    {
        // 1. Users
        $this->createTable('{{%users}}', [
            'id' => $this->primaryKey(),
            'username' => $this->string(50)->notNull()->unique(),
            'password_hash' => $this->string()->notNull(),
            'access_token' => $this->string(128)->notNull()->unique(),
            'display_name' => $this->string(100)->notNull(),
            'avatar' => $this->json()->null(),
            'exp' => $this->integer()->notNull()->defaultValue(0),
            'created_at' => $this->integer()->notNull(),
            'updated_at' => $this->integer()->notNull(),
        ]);

        // 2. Bosses
        $this->createTable('{{%bosses}}', [
            'id' => $this->primaryKey(),
            'name' => $this->string(100)->notNull(),
            'subject_code' => $this->string(50)->notNull(),
            'max_hp' => $this->integer()->notNull(),
            'current_hp' => $this->integer()->notNull(),
            'created_by' => $this->integer()->notNull(),
            'defeated_at' => $this->integer()->null(),
        ]);

        $this->addForeignKey(
            'fk-bosses-created_by',
            '{{%bosses}}',
            'created_by',
            '{{%users}}',
            'id',
            'CASCADE',
            'RESTRICT'
        );

        // 3. Rooms
        $this->createTable('{{%rooms}}', [
            'id' => $this->primaryKey(),
            'host_id' => $this->integer()->notNull(),
            'title' => $this->string(150)->notNull(),
            'subject_code' => $this->string(50)->null(),
            'location' => $this->string(150)->notNull(),
            'tree_type' => $this->string(20)->notNull(),
            'duration_minutes' => $this->integer()->notNull(),
            'max_members' => $this->integer()->notNull(),
            'status' => $this->string(20)->notNull()->defaultValue('waiting'),
            'started_at' => $this->integer()->null(),
            'ends_at' => $this->integer()->null(),
            'boss_id' => $this->integer()->null(),
            'created_at' => $this->integer()->notNull(),
        ]);

        $this->addForeignKey(
            'fk-rooms-host_id',
            '{{%rooms}}',
            'host_id',
            '{{%users}}',
            'id',
            'CASCADE',
            'RESTRICT'
        );

        $this->addForeignKey(
            'fk-rooms-boss_id',
            '{{%rooms}}',
            'boss_id',
            '{{%bosses}}',
            'id',
            'SET NULL',
            'CASCADE'
        );

        // 4. Room Members
        $this->createTable('{{%room_members}}', [
            'id' => $this->primaryKey(),
            'room_id' => $this->integer()->notNull(),
            'user_id' => $this->integer()->notNull(),
            'status' => $this->string(20)->notNull()->defaultValue('joined'),
            'focused_seconds' => $this->integer()->notNull()->defaultValue(0),
            'joined_at' => $this->integer()->notNull(),
            'left_at' => $this->integer()->null(),
            'claimed_at' => $this->integer()->null(),
        ]);

        $this->createIndex(
            'uq-room_members-room-user',
            '{{%room_members}}',
            ['room_id', 'user_id'],
            true
        );

        $this->addForeignKey(
            'fk-room_members-room_id',
            '{{%room_members}}',
            'room_id',
            '{{%rooms}}',
            'id',
            'CASCADE',
            'CASCADE'
        );

        $this->addForeignKey(
            'fk-room_members-user_id',
            '{{%room_members}}',
            'user_id',
            '{{%users}}',
            'id',
            'CASCADE',
            'RESTRICT'
        );
    }

    public function safeDown()
    {
        $this->dropTable('{{%room_members}}');
        $this->dropTable('{{%rooms}}');
        $this->dropTable('{{%bosses}}');
        $this->dropTable('{{%users}}');
    }
}

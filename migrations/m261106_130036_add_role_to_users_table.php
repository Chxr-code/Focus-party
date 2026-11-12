
<?php

use yii\db\Migration;

class m261106_130036_add_role_to_users_table extends Migration
{
    public function safeUp()
    {
        $this->addColumn(
            '{{%users}}',
            'role',
            $this->string(20)->notNull()->defaultValue('student')
        );
    }

    public function safeDown()
    {
        $this->dropColumn('{{%users}}', 'role');
    }
}

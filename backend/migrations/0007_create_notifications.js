// Migration 0007: in-app notifications.
// Mirrors Wispr Flow's `RemoteNotifications` table (type, key, title, text,
// isRead, isArchived). `key` de-duplicates one-off notifications such as
// word-count milestones.
import { uuidPk, timestamps, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('notifications', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    type: { type: Sequelize.STRING(20), allowNull: false },
    key: { type: Sequelize.STRING(120), allowNull: false },
    title: { type: Sequelize.STRING(255), allowNull: false },
    body: { type: Sequelize.TEXT, allowNull: false },
    action_label: { type: Sequelize.STRING(60), allowNull: true },
    action_url: { type: Sequelize.STRING(255), allowNull: true },
    is_read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    is_archived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'notifications', 'type', [
    'milestone',
    'tip',
    'team',
    'usage',
    'feature',
    'system',
    'learning',
    'billing',
  ]);
  await queryInterface.addConstraint('notifications', {
    type: 'unique',
    fields: ['user_id', 'key'],
    name: 'uq_notifications_user_key',
  });
  await queryInterface.addIndex('notifications', ['user_id', 'is_archived', 'created_at'], {
    name: 'idx_notifications_user_archived_created',
  });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('notifications');
}

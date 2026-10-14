// Migration 0002: plans and billing history.
// Mirrors Wispr Flow's `subscription` object (plan, status, trial, renewal)
// and keeps an append-only ledger of billing events for the Plans page.
import { uuidPk, timestamps, createdAt, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('subscriptions', {
    id: uuidPk(Sequelize),
    user_id: { ...fk(Sequelize, 'users'), unique: true },
    plan: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'FLOW_BASIC' },
    status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'none' },
    billing_interval: { type: Sequelize.STRING(10), allowNull: true },
    source: { type: Sequelize.STRING(20), allowNull: true },
    is_student: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    trial_started_at: { type: Sequelize.DATE, allowNull: true },
    trial_ends_at: { type: Sequelize.DATE, allowNull: true },
    current_period_start: { type: Sequelize.DATE, allowNull: true },
    current_period_end: { type: Sequelize.DATE, allowNull: true },
    cancel_at_period_end: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    canceled_at: { type: Sequelize.DATE, allowNull: true },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'subscriptions', 'plan', ['FLOW_BASIC', 'FLOW_PRO', 'FLOW_TEAMS']);
  await checkIn(queryInterface, 'subscriptions', 'status', ['none', 'trialing', 'active', 'past_due', 'canceled']);
  await checkIn(queryInterface, 'subscriptions', 'billing_interval', ['month', 'year']);

  await queryInterface.createTable('billing_events', {
    id: uuidPk(Sequelize),
    user_id: fk(Sequelize, 'users'),
    subscription_id: fk(Sequelize, 'subscriptions', { allowNull: true, onDelete: 'SET NULL' }),
    event_type: { type: Sequelize.STRING(40), allowNull: false },
    plan: { type: Sequelize.STRING(20), allowNull: true },
    amount_cents: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'USD' },
    description: { type: Sequelize.TEXT, allowNull: true },
    metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: Sequelize.literal("'{}'::jsonb") },
    ...createdAt(Sequelize),
  });
  await queryInterface.addIndex('billing_events', ['user_id', 'created_at'], { name: 'idx_billing_events_user_created' });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('billing_events');
  await queryInterface.dropTable('subscriptions');
}

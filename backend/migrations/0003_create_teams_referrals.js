// Migration 0003: teams (shared dictionary/snippets) and referrals.
// Mirrors Wispr Flow's team features (`/api/v1/teams/{id}/join`,
// `/api/v1/enterprise/invitations`) and `/api/v1/referral/*`.
import { uuidPk, timestamps, fk, checkIn } from '../app/db/migration_helpers.js';

export async function up({ queryInterface, Sequelize }) {
  await queryInterface.createTable('teams', {
    id: uuidPk(Sequelize),
    name: { type: Sequelize.STRING(120), allowNull: false },
    owner_user_id: fk(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    invite_code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
    ...timestamps(Sequelize),
  });

  await queryInterface.createTable('team_members', {
    team_id: { ...fk(Sequelize, 'teams'), primaryKey: true },
    user_id: { ...fk(Sequelize, 'users'), primaryKey: true },
    role: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'member' },
    joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
  });
  await checkIn(queryInterface, 'team_members', 'role', ['admin', 'member']);
  // A user belongs to at most one team, like Wispr Flow.
  await queryInterface.addConstraint('team_members', { type: 'unique', fields: ['user_id'], name: 'uq_team_members_user' });

  await queryInterface.createTable('team_invitations', {
    id: uuidPk(Sequelize),
    team_id: fk(Sequelize, 'teams'),
    email: { type: Sequelize.STRING(255), allowNull: false },
    invited_by_user_id: fk(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    status: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'pending' },
    responded_at: { type: Sequelize.DATE, allowNull: true },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'team_invitations', 'status', ['pending', 'accepted', 'declined', 'revoked']);
  await queryInterface.sequelize.query(
    `CREATE UNIQUE INDEX uq_team_invitations_pending ON team_invitations (team_id, email) WHERE status = 'pending'`,
  );
  await queryInterface.addIndex('team_invitations', ['email', 'status'], { name: 'idx_team_invitations_email_status' });

  await queryInterface.createTable('referrals', {
    id: uuidPk(Sequelize),
    referrer_user_id: fk(Sequelize, 'users'),
    referred_email: { type: Sequelize.STRING(255), allowNull: false },
    referred_user_id: fk(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
    status: { type: Sequelize.STRING(12), allowNull: false, defaultValue: 'invited' },
    rewarded_at: { type: Sequelize.DATE, allowNull: true },
    ...timestamps(Sequelize),
  });
  await checkIn(queryInterface, 'referrals', 'status', ['invited', 'signed_up', 'rewarded']);
  await queryInterface.addConstraint('referrals', {
    type: 'unique',
    fields: ['referrer_user_id', 'referred_email'],
    name: 'uq_referrals_referrer_email',
  });
}

export async function down({ queryInterface }) {
  await queryInterface.dropTable('referrals');
  await queryInterface.dropTable('team_invitations');
  await queryInterface.dropTable('team_members');
  await queryInterface.dropTable('teams');
}

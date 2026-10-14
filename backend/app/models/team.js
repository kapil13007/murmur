// File: app/models/team.js
// Teams share dictionary words and snippets between members.
import { DataTypes, Model } from 'sequelize';

export class Team extends Model {}
export class TeamMember extends Model {}
export class TeamInvitation extends Model {}

export function initTeam(sequelize) {
  Team.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      owner_user_id: { type: DataTypes.UUID, allowNull: true },
      invite_code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
    },
    { sequelize, modelName: 'Team', tableName: 'teams' },
  );

  TeamMember.init(
    {
      team_id: { type: DataTypes.UUID, primaryKey: true },
      user_id: { type: DataTypes.UUID, primaryKey: true },
      role: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'member', validate: { isIn: [['admin', 'member']] } },
      joined_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'TeamMember', tableName: 'team_members', timestamps: false },
  );

  TeamInvitation.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      team_id: { type: DataTypes.UUID, allowNull: false },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        set(value) {
          this.setDataValue('email', String(value).trim().toLowerCase());
        },
      },
      invited_by_user_id: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [['pending', 'accepted', 'declined', 'revoked']] },
      },
      responded_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'TeamInvitation', tableName: 'team_invitations' },
  );

  return { Team, TeamMember, TeamInvitation };
}

// File: app/models/referral.js
// "Refer a friend": invitations sent by a user and their reward state.
import { DataTypes, Model } from 'sequelize';

export class Referral extends Model {}

export function initReferral(sequelize) {
  Referral.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      referrer_user_id: { type: DataTypes.UUID, allowNull: false },
      referred_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        set(value) {
          this.setDataValue('referred_email', String(value).trim().toLowerCase());
        },
      },
      referred_user_id: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(12),
        allowNull: false,
        defaultValue: 'invited',
        validate: { isIn: [['invited', 'signed_up', 'rewarded']] },
      },
      rewarded_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'Referral', tableName: 'referrals' },
  );
  return Referral;
}

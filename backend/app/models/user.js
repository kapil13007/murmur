// File: app/models/user.js
import { DataTypes, Model } from 'sequelize';

export class User extends Model {
  get fullName() {
    return [this.first_name, this.last_name].filter(Boolean).join(' ');
  }

  isLocked(now = new Date()) {
    return Boolean(this.locked_until && this.locked_until > now);
  }
}

export function initUser(sequelize) {
  User.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        set(value) {
          this.setDataValue('email', String(value).trim().toLowerCase());
        },
      },
      password_hash: { type: DataTypes.STRING(255), allowNull: false },
      first_name: { type: DataTypes.STRING(100), allowNull: false },
      last_name: { type: DataTypes.STRING(100), allowNull: true },
      avatar_url: { type: DataTypes.TEXT, allowNull: true },
      groq_key_encrypted: { type: DataTypes.TEXT, allowNull: true },
      groq_key_last4: { type: DataTypes.STRING(4), allowNull: true },
      product_intent: { type: DataTypes.STRING(30), allowNull: true },
      onboarding_completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      onboarding_completed_at: { type: DataTypes.DATE, allowNull: true },
      token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      failed_login_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      locked_until: { type: DataTypes.DATE, allowNull: true },
      last_login_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'User', tableName: 'users' },
  );
  return User;
}

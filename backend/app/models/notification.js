// File: app/models/notification.js
// In-app notifications (Wispr's `RemoteNotifications`).
import { DataTypes, Model } from 'sequelize';
import { NOTIFICATION_TYPES } from './constants.js';

export class Notification extends Model {}

export function initNotification(sequelize) {
  Notification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [NOTIFICATION_TYPES] } },
      // De-duplication key, e.g. "milestone:words:1000".
      key: { type: DataTypes.STRING(120), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      action_label: { type: DataTypes.STRING(60), allowNull: true },
      action_url: { type: DataTypes.STRING(255), allowNull: true },
      is_read: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_archived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      indexes: [{ unique: true, fields: ['user_id', 'key'] }],
    },
  );
  return Notification;
}

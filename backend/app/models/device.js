// File: app/models/device.js
// Desktop / web clients that have signed in (Wispr's registered_devices).
import { DataTypes, Model } from 'sequelize';

export class Device extends Model {}

export function initDevice(sequelize) {
  Device.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      device_uid: { type: DataTypes.STRING(100), allowNull: false },
      platform: { type: DataTypes.STRING(20), allowNull: false },
      arch: { type: DataTypes.STRING(20), allowNull: true },
      device_name: { type: DataTypes.STRING(255), allowNull: true },
      app_version: { type: DataTypes.STRING(30), allowNull: true },
      last_seen_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'Device',
      tableName: 'devices',
      indexes: [{ unique: true, fields: ['user_id', 'device_uid'] }],
    },
  );
  return Device;
}

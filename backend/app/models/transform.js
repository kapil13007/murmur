// File: app/models/transform.js
// AI text transforms ("Polish" + user-defined prompts), their execution log
// (Wispr's `Polish` table) and Command Mode runs (Wispr's `InstructHistory`).
import { DataTypes, Model } from 'sequelize';

export class Transform extends Model {}
export class TransformRun extends Model {}
export class CommandRun extends Model {}

export function initTransform(sequelize) {
  Transform.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      instruction: { type: DataTypes.TEXT, allowNull: false },
      icon: { type: DataTypes.STRING(30), allowNull: true },
      is_builtin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'Transform',
      tableName: 'transforms',
      indexes: [{ unique: true, fields: ['user_id', 'name'] }],
    },
  );

  TransformRun.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      transform_id: { type: DataTypes.UUID, allowNull: true },
      note_id: { type: DataTypes.UUID, allowNull: true },
      instruction: { type: DataTypes.TEXT, allowNull: false },
      input_text: { type: DataTypes.TEXT, allowNull: false },
      output_text: { type: DataTypes.TEXT, allowNull: true },
      input_word_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      output_word_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      app_name: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'success', validate: { isIn: [['success', 'no_changes', 'error']] } },
      provider: { type: DataTypes.STRING(20), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      processing_ms: { type: DataTypes.INTEGER, allowNull: true },
      is_undone: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, modelName: 'TransformRun', tableName: 'transform_runs', updatedAt: false },
  );

  CommandRun.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      transcript_id: { type: DataTypes.UUID, allowNull: true },
      instruction: { type: DataTypes.TEXT, allowNull: false },
      selected_text: { type: DataTypes.TEXT, allowNull: true },
      output_text: { type: DataTypes.TEXT, allowNull: true },
      app_name: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'success', validate: { isIn: [['success', 'error', 'unsupported']] } },
      provider: { type: DataTypes.STRING(20), allowNull: true },
      model: { type: DataTypes.STRING(120), allowNull: true },
      processing_ms: { type: DataTypes.INTEGER, allowNull: true },
    },
    { sequelize, modelName: 'CommandRun', tableName: 'command_runs', updatedAt: false },
  );

  return { Transform, TransformRun, CommandRun };
}

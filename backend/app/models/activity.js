// File: app/models/activity.js
// Usage rollups maintained on every dictation. They back streaks, the
// Insights heatmap, "Top apps" and the weekly word allowance, and are
// independent of transcript retention settings.
import { DataTypes, Model } from 'sequelize';

export class DailyActivity extends Model {}
export class AppUsage extends Model {}

export function initActivity(sequelize) {
  DailyActivity.init(
    {
      user_id: { type: DataTypes.UUID, primaryKey: true },
      activity_date: { type: DataTypes.DATEONLY, primaryKey: true },
      words: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      dictations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      duration_seconds: { type: DataTypes.REAL, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'DailyActivity', tableName: 'daily_activity', timestamps: false },
  );

  AppUsage.init(
    {
      user_id: { type: DataTypes.UUID, primaryKey: true },
      app_name: { type: DataTypes.STRING(255), primaryKey: true },
      app_category: { type: DataTypes.STRING(12), allowNull: true },
      words: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      dictations: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      last_used_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'AppUsage', tableName: 'app_usage', timestamps: false },
  );

  return { DailyActivity, AppUsage };
}

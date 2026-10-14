// File: app/models/style_profile.js
// Writing style per app category (Wispr's `userVoices`): which apps belong to
// the category and whether dictations there come out formal, casual,
// very casual or excited.
import { DataTypes, Model } from 'sequelize';
import { STYLE_CATEGORIES, STYLES } from './constants.js';

export class StyleProfile extends Model {}

export function initStyleProfile(sequelize) {
  StyleProfile.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      category: { type: DataTypes.STRING(12), allowNull: false, validate: { isIn: [STYLE_CATEGORIES] } },
      name: { type: DataTypes.STRING(100), allowNull: false },
      app_names: { type: DataTypes.ARRAY(DataTypes.STRING(100)), allowNull: false, defaultValue: [] },
      style: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'formal', validate: { isIn: [STYLES] } },
    },
    {
      sequelize,
      modelName: 'StyleProfile',
      tableName: 'style_profiles',
      indexes: [{ unique: true, fields: ['user_id', 'category'] }],
    },
  );
  return StyleProfile;
}

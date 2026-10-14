// File: app/models/note.js
// Scratchpad notes and their version history (Wispr's Notes / NoteVersions).
import { DataTypes, Model } from 'sequelize';

export class Note extends Model {}
export class NoteVersion extends Model {}

export function initNote(sequelize) {
  Note.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      content_preview: { type: DataTypes.STRING(300), allowNull: false, defaultValue: '' },
      searchable_content: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
      is_pinned: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      source: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'typed', validate: { isIn: [['typed', 'dictated']] } },
    },
    {
      sequelize,
      modelName: 'Note',
      tableName: 'notes',
      hooks: {
        // Keep the derived columns in step with title/content on every save.
        beforeSave(note) {
          const content = note.content || '';
          note.content_preview = content.replace(/\s+/g, ' ').trim().slice(0, 280);
          note.searchable_content = `${note.title || ''}\n${content}`.toLowerCase();
        },
      },
    },
  );

  NoteVersion.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      note_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false, defaultValue: '' },
      content: { type: DataTypes.TEXT, allowNull: false },
      source: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [['snapshot', 'transform', 'restore']] } },
      transform_prompt: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'NoteVersion', tableName: 'note_versions', updatedAt: false },
  );

  return { Note, NoteVersion };
}

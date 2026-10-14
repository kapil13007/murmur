// File: app/crud/transform_crud.js
import { CommandRun, Transform, TransformRun } from '../models/index.js';

// Built-in transforms every account starts with. "Polish" takes its exact
// instruction from the polish toggles in the user's preferences.
export const BUILTIN_TRANSFORMS = Object.freeze([
  { name: 'Polish', icon: 'sparkles', instruction: 'Polish this text using my polish settings.' },
  { name: 'Make it concise', icon: 'scissors', instruction: 'Make this text more concise without losing any information.' },
  { name: 'Fix grammar', icon: 'spell-check', instruction: 'Fix spelling, grammar and punctuation. Change nothing else.' },
  { name: 'Make it formal', icon: 'briefcase', instruction: 'Rewrite this in a clear, professional, formal tone.' },
  { name: 'Make it friendly', icon: 'smile', instruction: 'Rewrite this in a warm, friendly, casual tone.' },
  { name: 'Bullet points', icon: 'list', instruction: 'Turn this into a concise bulleted list of the key points.' },
  { name: 'Summarize', icon: 'align-left', instruction: 'Summarize this in two or three sentences.' },
]);

export async function ensureBuiltinTransforms(userId, options = {}) {
  const existing = await Transform.findAll({ where: { user_id: userId, is_builtin: true }, ...options });
  const have = new Set(existing.map((t) => t.name));
  const missing = BUILTIN_TRANSFORMS.map((t, i) => ({ ...t, sort_order: i })).filter((t) => !have.has(t.name));
  if (missing.length) {
    await Transform.bulkCreate(
      missing.map((t) => ({ ...t, user_id: userId, is_builtin: true })),
      options,
    );
  }
}

export async function listTransforms(userId) {
  await ensureBuiltinTransforms(userId);
  return Transform.findAll({
    where: { user_id: userId },
    order: [
      ['sort_order', 'ASC'],
      ['created_at', 'ASC'],
    ],
  });
}

export function getTransform(userId, id) {
  return Transform.findOne({ where: { id, user_id: userId } });
}

export async function createTransform(userId, data) {
  const count = await Transform.count({ where: { user_id: userId } });
  return Transform.create({ ...data, user_id: userId, is_builtin: false, sort_order: count });
}

export async function updateTransform(transform, data) {
  Object.assign(transform, data);
  await transform.save();
  return transform;
}

export function deleteTransform(userId, id) {
  return Transform.destroy({ where: { id, user_id: userId, is_builtin: false } });
}

export function createTransformRun(data) {
  return TransformRun.create(data);
}

export function listTransformRuns(userId, limit = 50) {
  return TransformRun.findAll({
    where: { user_id: userId },
    include: [{ model: Transform, as: 'transform', attributes: ['id', 'name'] }],
    order: [['created_at', 'DESC']],
    limit,
  });
}

export function getTransformRun(userId, id) {
  return TransformRun.findOne({ where: { id, user_id: userId } });
}

export function createCommandRun(data) {
  return CommandRun.create(data);
}

export function listCommandRuns(userId, limit = 50) {
  return CommandRun.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']], limit });
}

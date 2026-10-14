// File: app/crud/notification_crud.js
import { Notification } from '../models/index.js';

export function listNotifications(userId, { includeArchived = false } = {}) {
  const where = { user_id: userId };
  if (!includeArchived) where.is_archived = false;
  return Notification.findAll({ where, order: [['created_at', 'DESC']], limit: 100 });
}

export function countUnread(userId) {
  return Notification.count({ where: { user_id: userId, is_read: false, is_archived: false } });
}

// Returns [notification, created]; an existing key is never duplicated.
export function createUniqueNotification(userId, data, options = {}) {
  return Notification.findOrCreate({
    where: { user_id: userId, key: data.key },
    defaults: { ...data, user_id: userId },
    ...options,
  });
}

export function getNotification(userId, id) {
  return Notification.findOne({ where: { id, user_id: userId } });
}

export async function updateNotification(notification, data) {
  Object.assign(notification, data);
  await notification.save();
  return notification;
}

export function markAllRead(userId) {
  return Notification.update({ is_read: true }, { where: { user_id: userId, is_read: false } });
}

export function archiveAll(userId) {
  return Notification.update({ is_archived: true, is_read: true }, { where: { user_id: userId, is_archived: false } });
}

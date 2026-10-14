// File: app/api/notifications_router.js
import { Router } from 'express';
import { notFound } from '../core/errors.js';
import { uuidParam, validate } from '../core/validators.js';
import {
  archiveAll,
  countUnread,
  getNotification,
  listNotifications,
  markAllRead,
  updateNotification,
} from '../crud/notification_crud.js';
import { NotificationsQuery, toNotificationOut } from '../schemas/misc_schema.js';

const router = Router();

router.get('', validate({ query: NotificationsQuery }), async (req, res) => {
  const [items, unread] = await Promise.all([
    listNotifications(req.user.id, { includeArchived: req.validatedQuery.include_archived }),
    countUnread(req.user.id),
  ]);
  res.json({ items: items.map(toNotificationOut), unread_count: unread });
});

router.post('/read-all', async (req, res) => {
  await markAllRead(req.user.id);
  res.status(204).end();
});

router.post('/archive-all', async (req, res) => {
  await archiveAll(req.user.id);
  res.status(204).end();
});

async function requireNotification(userId, id) {
  const n = await getNotification(userId, id);
  if (!n) throw notFound('Notification not found');
  return n;
}

router.post('/:id/read', validate({ params: uuidParam() }), async (req, res) => {
  const n = await requireNotification(req.user.id, req.params.id);
  res.json(toNotificationOut(await updateNotification(n, { is_read: true })));
});

router.post('/:id/archive', validate({ params: uuidParam() }), async (req, res) => {
  const n = await requireNotification(req.user.id, req.params.id);
  res.json(toNotificationOut(await updateNotification(n, { is_archived: true, is_read: true })));
});

export default router;

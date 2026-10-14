// File: app/schemas/misc_schema.js
// Small request schemas for devices, referrals and notifications.
import { z } from 'zod';

export const RegisterDeviceRequest = z.object({
  device_uid: z.string().trim().min(8).max(100),
  platform: z.string().trim().min(2).max(20),
  arch: z.string().trim().max(20).optional().nullable(),
  device_name: z.string().trim().max(255).optional().nullable(),
  app_version: z.string().trim().max(30).optional().nullable(),
});

export function toDeviceOut(d) {
  return {
    id: d.id,
    device_uid: d.device_uid,
    platform: d.platform,
    arch: d.arch,
    device_name: d.device_name,
    app_version: d.app_version,
    last_seen_at: d.last_seen_at,
    created_at: d.created_at,
  };
}

export const ReferralInviteRequest = z.object({
  email: z.email('Enter a valid email address').transform((e) => e.trim().toLowerCase()),
});

export const NotificationsQuery = z.object({
  include_archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

export function toNotificationOut(n) {
  return {
    id: n.id,
    type: n.type,
    key: n.key,
    title: n.title,
    body: n.body,
    action_label: n.action_label,
    action_url: n.action_url,
    is_read: n.is_read,
    is_archived: n.is_archived,
    created_at: n.created_at,
  };
}

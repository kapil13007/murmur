// File: app/crud/subscription_crud.js
import { BillingEvent, Subscription } from '../models/index.js';

export function getSubscription(userId, options = {}) {
  return Subscription.findOne({ where: { user_id: userId }, ...options });
}

export function createSubscription(data, options = {}) {
  return Subscription.create(data, options);
}

export async function updateSubscription(subscription, data, options = {}) {
  Object.assign(subscription, data);
  await subscription.save(options);
  return subscription;
}

export function createBillingEvent(data, options = {}) {
  return BillingEvent.create(data, options);
}

export function listBillingEvents(userId, limit = 50) {
  return BillingEvent.findAll({ where: { user_id: userId }, order: [['created_at', 'DESC']], limit });
}

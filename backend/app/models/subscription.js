// File: app/models/subscription.js
// The user's plan (Basic / Pro / Teams), trial window and renewal state.
import { DataTypes, Model } from 'sequelize';
import { PLANS, SUBSCRIPTION_STATUSES } from './constants.js';

export class Subscription extends Model {
  // Pro features apply while trialing or paid, and until the end of a
  // cancelled period.
  isPro(now = new Date()) {
    if (this.plan === PLANS.BASIC) return false;
    if (this.status === 'trialing') return Boolean(this.trial_ends_at && this.trial_ends_at > now);
    if (this.status === 'active' || this.status === 'past_due') {
      return !this.current_period_end || this.current_period_end > now;
    }
    if (this.status === 'canceled') return Boolean(this.current_period_end && this.current_period_end > now);
    return false;
  }
}

export function initSubscription(sequelize) {
  Subscription.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false, unique: true },
      plan: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: PLANS.BASIC,
        validate: { isIn: [Object.values(PLANS)] },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'none',
        validate: { isIn: [SUBSCRIPTION_STATUSES] },
      },
      billing_interval: { type: DataTypes.STRING(10), allowNull: true },
      source: { type: DataTypes.STRING(20), allowNull: true },
      is_student: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      trial_started_at: { type: DataTypes.DATE, allowNull: true },
      trial_ends_at: { type: DataTypes.DATE, allowNull: true },
      current_period_start: { type: DataTypes.DATE, allowNull: true },
      current_period_end: { type: DataTypes.DATE, allowNull: true },
      cancel_at_period_end: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      canceled_at: { type: DataTypes.DATE, allowNull: true },
    },
    { sequelize, modelName: 'Subscription', tableName: 'subscriptions' },
  );
  return Subscription;
}

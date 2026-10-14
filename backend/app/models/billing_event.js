// File: app/models/billing_event.js
// Append-only ledger of plan changes (trial started, upgraded, cancelled...).
import { DataTypes, Model } from 'sequelize';

export class BillingEvent extends Model {}

export function initBillingEvent(sequelize) {
  BillingEvent.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      user_id: { type: DataTypes.UUID, allowNull: false },
      subscription_id: { type: DataTypes.UUID, allowNull: true },
      event_type: { type: DataTypes.STRING(40), allowNull: false },
      plan: { type: DataTypes.STRING(20), allowNull: true },
      amount_cents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
      description: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: () => ({}) },
    },
    { sequelize, modelName: 'BillingEvent', tableName: 'billing_events', updatedAt: false },
  );
  return BillingEvent;
}

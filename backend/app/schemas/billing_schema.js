// File: app/schemas/billing_schema.js
import { z } from 'zod';

export const CheckoutRequest = z.object({
  plan: z.enum(['FLOW_PRO', 'FLOW_TEAMS']),
  interval: z.enum(['month', 'year']).default('month'),
  seats: z.number().int().min(1).max(500).default(1),
  // Simulated card details: the demo checkout never contacts a processor.
  cardholder_name: z.string().trim().min(1).max(120),
  card_last4: z.string().regex(/^\d{4}$/, 'Enter the last 4 digits of the card'),
});

export function toBillingEventOut(e) {
  return {
    id: e.id,
    event_type: e.event_type,
    plan: e.plan,
    amount_cents: e.amount_cents,
    currency: e.currency,
    description: e.description,
    created_at: e.created_at,
  };
}

// File: app/schemas/user_schema.js
import { z } from 'zod';

export const UpdateProfileRequest = z
  .object({
    first_name: z.string().trim().min(1).max(100).optional(),
    last_name: z.string().trim().max(100).nullable().optional(),
    // Small inline images only (data URL), e.g. a cropped avatar from the hub.
    avatar_url: z
      .string()
      .max(400_000, 'Avatar image is too large (max ~300KB)')
      .refine((v) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) || /^https?:\/\//.test(v), 'Avatar must be an image')
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const OnboardingRequest = z.object({
  product_intent: z.enum(['dictation', 'notetaker', 'dictation_and_notetaker']).default('dictation'),
  role: z.string().trim().max(60).optional(),
  writing_needs: z.array(z.string().max(60)).max(20).default([]),
  typing_locations: z.array(z.string().max(50)).max(20).default([]),
  selected_languages: z.array(z.string().min(2).max(10)).max(10).optional(),
  timezone: z.string().max(64).optional(),
});

export const DeleteAccountRequest = z.object({
  password: z.string().min(1, 'Password is required'),
});

export function toUserOut(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    full_name: user.fullName,
    avatar_url: user.avatar_url,
    referral_code: user.referral_code,
    product_intent: user.product_intent,
    onboarding_completed: user.onboarding_completed,
    onboarding_completed_at: user.onboarding_completed_at,
    created_at: user.created_at,
  };
}

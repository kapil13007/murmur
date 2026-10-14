// File: app/schemas/style_schema.js
import { z } from 'zod';
import { STYLE_CATEGORIES, STYLES } from '../models/constants.js';

export const CategoryParam = z.object({ category: z.enum(STYLE_CATEGORIES) });

export const UpdateStyleRequest = z
  .object({
    style: z.enum(STYLES),
    app_names: z.array(z.string().trim().min(1).max(100)).max(50),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export function toStyleOut(profile) {
  return {
    id: profile.id,
    category: profile.category,
    name: profile.name,
    app_names: profile.app_names,
    style: profile.style,
    updated_at: profile.updated_at,
  };
}

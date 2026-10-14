// File: app/schemas/team_schema.js
import { z } from 'zod';

export const CreateTeamRequest = z.object({
  name: z.string().trim().min(2, 'Team name is too short').max(120),
});

export const RenameTeamRequest = CreateTeamRequest;

export const InviteRequest = z.object({
  emails: z
    .array(z.email('Enter valid email addresses').transform((e) => e.trim().toLowerCase()))
    .min(1)
    .max(50),
});

export const JoinTeamRequest = z.object({
  invite_code: z.string().trim().min(4).max(20).transform((c) => c.toUpperCase()),
});

export const MemberParams = z.object({ userId: z.uuid() });

export const UpdateMemberRequest = z.object({
  role: z.enum(['admin', 'member']),
});

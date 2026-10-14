// File: app/services/team_service.js
// Teams share vocabulary and snippets. One team per user; the creator is the
// owner and an admin. Admins invite people and manage members.
import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { badRequest, conflict, forbidden, notFound } from '../core/errors.js';
import { withTransaction } from '../db/session.js';
import {
  addMember,
  countMembers,
  createInvitation,
  createTeam,
  findPendingInvitation,
  getInvitation,
  getMembership,
  getTeam,
  getTeamByInviteCode,
  listInvitationsForEmail,
  listMembers,
  listPendingInvitations,
  removeMember,
  revokePendingInvitations,
  updateInvitation,
} from '../crud/team_crud.js';
import { getUserByEmail } from '../crud/user_crud.js';
import { DictionaryEntry, TeamMember } from '../models/index.js';
import { notify } from './notification_service.js';

const newInviteCode = () => crypto.randomBytes(5).toString('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 8).padEnd(8, 'X');

async function requireMembership(userId) {
  const membership = await getMembership(userId);
  if (!membership) throw notFound("You're not part of a team yet");
  return membership;
}

async function requireAdmin(userId) {
  const membership = await requireMembership(userId);
  if (membership.role !== 'admin') throw forbidden('Only team admins can do that');
  return membership;
}

export async function getMyTeam(user) {
  const membership = await getMembership(user.id);
  const invitations = await listInvitationsForEmail(user.email);
  const pendingForMe = invitations.map((inv) => ({
    id: inv.id,
    team_id: inv.team_id,
    team_name: inv.team?.name,
    invited_by: inv.invitedBy ? inv.invitedBy.fullName : null,
    created_at: inv.created_at,
  }));
  if (!membership) return { team: null, invitations: pendingForMe };

  const team = await getTeam(membership.team_id);
  const [members, pending, sharedWords, sharedSnippets] = await Promise.all([
    listMembers(team.id),
    membership.role === 'admin' ? listPendingInvitations(team.id) : Promise.resolve([]),
    DictionaryEntry.count({ where: { team_id: team.id, is_snippet: false } }),
    DictionaryEntry.count({ where: { team_id: team.id, is_snippet: true } }),
  ]);
  return {
    team: {
      id: team.id,
      name: team.name,
      invite_code: membership.role === 'admin' ? team.invite_code : null,
      is_owner: team.owner_user_id === user.id,
      my_role: membership.role,
      shared_words: sharedWords,
      shared_snippets: sharedSnippets,
      created_at: team.created_at,
      members: members.map((m) => ({
        user_id: m.user_id,
        name: m.user ? m.user.fullName : 'Former member',
        email: m.user?.email,
        avatar_url: m.user?.avatar_url,
        role: m.role,
        is_owner: team.owner_user_id === m.user_id,
        joined_at: m.joined_at,
      })),
      pending_invitations: pending.map((inv) => ({ id: inv.id, email: inv.email, created_at: inv.created_at })),
    },
    invitations: pendingForMe,
  };
}

export async function createNewTeam(user, name) {
  if (await getMembership(user.id)) throw conflict('Leave your current team before creating a new one');
  await withTransaction(async (transaction) => {
    const team = await createTeam({ name, owner_user_id: user.id, invite_code: newInviteCode() }, { transaction });
    await addMember(team.id, user.id, 'admin', { transaction });
  });
  return getMyTeam(user);
}

export async function renameTeam(user, name) {
  const membership = await requireAdmin(user.id);
  const team = await getTeam(membership.team_id);
  team.name = name;
  await team.save();
  return getMyTeam(user);
}

export async function inviteMembers(user, emails) {
  const membership = await requireAdmin(user.id);
  const team = await getTeam(membership.team_id);
  const results = [];
  for (const email of [...new Set(emails)]) {
    if (email === user.email) {
      results.push({ email, status: 'skipped', reason: "That's you" });
      continue;
    }
    const existingUser = await getUserByEmail(email);
    if (existingUser && (await getMembership(existingUser.id))) {
      results.push({ email, status: 'skipped', reason: 'Already in a team' });
      continue;
    }
    if (await findPendingInvitation(team.id, email)) {
      results.push({ email, status: 'skipped', reason: 'Already invited' });
      continue;
    }
    const invitation = await createInvitation({ team_id: team.id, email, invited_by_user_id: user.id });
    if (existingUser) {
      await notify(existingUser.id, {
        type: 'team',
        key: `team:invite:${invitation.id}`,
        title: `${user.first_name} invited you to ${team.name}`,
        body: 'Join to share a dictionary and snippets with your team.',
        action_label: 'View invite',
        action_url: '/settings/team',
      });
    }
    results.push({ email, status: 'invited' });
  }
  return { results, ...(await getMyTeam(user)) };
}

async function joinTeam(user, team, { transaction } = {}) {
  if (await getMembership(user.id, { transaction })) throw conflict('Leave your current team before joining another');
  await addMember(team.id, user.id, 'member', { transaction });
  if (team.owner_user_id) {
    await notify(team.owner_user_id, {
      type: 'team',
      key: `team:joined:${team.id}:${user.id}`,
      title: `${user.first_name} joined ${team.name}`,
      body: 'They now share your team dictionary and snippets.',
    });
  }
}

export async function joinWithCode(user, code) {
  const team = await getTeamByInviteCode(code);
  if (!team) throw notFound('That invite code is not valid');
  await joinTeam(user, team);
  // Any pending invitations for this team are now fulfilled.
  const invitation = await findPendingInvitation(team.id, user.email);
  if (invitation) await updateInvitation(invitation, { status: 'accepted', responded_at: new Date() });
  return getMyTeam(user);
}

export async function respondToInvitation(user, invitationId, accept) {
  const invitation = await getInvitation(invitationId);
  if (!invitation || invitation.email !== user.email || invitation.status !== 'pending') {
    throw notFound('Invitation not found');
  }
  if (accept) {
    const team = await getTeam(invitation.team_id);
    await joinTeam(user, team);
  }
  await updateInvitation(invitation, { status: accept ? 'accepted' : 'declined', responded_at: new Date() });
  return getMyTeam(user);
}

export async function revokeInvitation(user, invitationId) {
  const membership = await requireAdmin(user.id);
  const invitation = await getInvitation(invitationId);
  if (!invitation || invitation.team_id !== membership.team_id) throw notFound('Invitation not found');
  await updateInvitation(invitation, { status: 'revoked', responded_at: new Date() });
  return getMyTeam(user);
}

export async function regenerateInviteCode(user) {
  const membership = await requireAdmin(user.id);
  const team = await getTeam(membership.team_id);
  team.invite_code = newInviteCode();
  await team.save();
  return getMyTeam(user);
}

// Shared entries a departing member created become personal again.
async function unshareEntriesOf(userId, teamId, transaction) {
  await DictionaryEntry.update({ team_id: null }, { where: { user_id: userId, team_id: teamId }, transaction });
}

export async function leaveTeam(user) {
  const membership = await requireMembership(user.id);
  const team = await getTeam(membership.team_id);
  await withTransaction(async (transaction) => {
    await unshareEntriesOf(user.id, team.id, transaction);
    await removeMember(team.id, user.id, { transaction });
    const remaining = await countMembers(team.id, { transaction });
    if (remaining === 0) {
      await revokePendingInvitations(team.id, { transaction });
      await team.destroy({ transaction });
      return;
    }
    if (team.owner_user_id === user.id) {
      // Hand ownership to the longest-standing admin, else the oldest member.
      const successor = await TeamMember.findOne({
        where: { team_id: team.id, user_id: { [Op.ne]: user.id } },
        order: [
          ['role', 'ASC'],
          ['joined_at', 'ASC'],
        ],
        transaction,
      });
      successor.role = 'admin';
      await successor.save({ transaction });
      team.owner_user_id = successor.user_id;
      await team.save({ transaction });
    }
  });
  return getMyTeam(user);
}

export async function removeTeamMember(user, memberUserId) {
  const membership = await requireAdmin(user.id);
  if (memberUserId === user.id) throw badRequest('Use "Leave team" to remove yourself');
  const team = await getTeam(membership.team_id);
  if (team.owner_user_id === memberUserId) throw forbidden("The team owner can't be removed");
  const target = await getMembership(memberUserId);
  if (!target || target.team_id !== team.id) throw notFound('Member not found');
  await withTransaction(async (transaction) => {
    await unshareEntriesOf(memberUserId, team.id, transaction);
    await removeMember(team.id, memberUserId, { transaction });
  });
  return getMyTeam(user);
}

export async function setMemberRole(user, memberUserId, role) {
  const membership = await requireAdmin(user.id);
  const team = await getTeam(membership.team_id);
  if (team.owner_user_id === memberUserId && role !== 'admin') throw forbidden('The team owner is always an admin');
  const target = await getMembership(memberUserId);
  if (!target || target.team_id !== team.id) throw notFound('Member not found');
  target.role = role;
  await target.save();
  return getMyTeam(user);
}

// Called after sign-up so invitations sent before the account existed show up.
export async function acceptPendingInvitationsNotice(user) {
  const invitations = await listInvitationsForEmail(user.email);
  for (const inv of invitations) {
    await notify(user.id, {
      type: 'team',
      key: `team:invite:${inv.id}`,
      title: `You're invited to join ${inv.team?.name || 'a team'}`,
      body: 'Join to share a dictionary and snippets with your team.',
      action_label: 'View invite',
      action_url: '/settings/team',
    });
  }
}

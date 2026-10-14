// File: app/crud/team_crud.js
import { Op } from 'sequelize';
import { Team, TeamInvitation, TeamMember, User } from '../models/index.js';

export function getMembership(userId, options = {}) {
  return TeamMember.findOne({ where: { user_id: userId }, ...options });
}

export async function getTeamIdForUser(userId) {
  const membership = await TeamMember.findOne({ where: { user_id: userId }, attributes: ['team_id'], raw: true });
  return membership ? membership.team_id : null;
}

export function getTeam(id, options = {}) {
  return Team.findByPk(id, options);
}

export function getTeamByInviteCode(code) {
  return Team.findOne({ where: { invite_code: code } });
}

export function createTeam(data, options = {}) {
  return Team.create(data, options);
}

export function addMember(teamId, userId, role = 'member', options = {}) {
  return TeamMember.create({ team_id: teamId, user_id: userId, role }, options);
}

export function removeMember(teamId, userId, options = {}) {
  return TeamMember.destroy({ where: { team_id: teamId, user_id: userId }, ...options });
}

export function listMembers(teamId, options = {}) {
  return TeamMember.findAll({
    where: { team_id: teamId },
    include: [{ model: User, as: 'user', attributes: ['id', 'email', 'first_name', 'last_name', 'avatar_url'] }],
    order: [['joined_at', 'ASC']],
    ...options,
  });
}

export function countMembers(teamId, options = {}) {
  return TeamMember.count({ where: { team_id: teamId }, ...options });
}

export function listPendingInvitations(teamId) {
  return TeamInvitation.findAll({ where: { team_id: teamId, status: 'pending' }, order: [['created_at', 'DESC']] });
}

export function listInvitationsForEmail(email) {
  return TeamInvitation.findAll({
    where: { email: email.toLowerCase(), status: 'pending' },
    include: [
      { model: Team, as: 'team', attributes: ['id', 'name'] },
      { model: User, as: 'invitedBy', attributes: ['id', 'first_name', 'last_name'] },
    ],
    order: [['created_at', 'DESC']],
  });
}

export function getInvitation(id, options = {}) {
  return TeamInvitation.findByPk(id, options);
}

export function findPendingInvitation(teamId, email) {
  return TeamInvitation.findOne({ where: { team_id: teamId, email: email.toLowerCase(), status: 'pending' } });
}

export function createInvitation(data) {
  return TeamInvitation.create(data);
}

export function updateInvitation(invitation, data, options = {}) {
  Object.assign(invitation, data);
  return invitation.save(options);
}

export function revokePendingInvitations(teamId, options = {}) {
  return TeamInvitation.update(
    { status: 'revoked', responded_at: new Date() },
    { where: { team_id: teamId, status: { [Op.eq]: 'pending' } }, ...options },
  );
}

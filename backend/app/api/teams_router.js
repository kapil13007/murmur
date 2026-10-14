// File: app/api/teams_router.js
import { Router } from 'express';
import { uuidParam, validate } from '../core/validators.js';
import {
  CreateTeamRequest,
  InviteRequest,
  JoinTeamRequest,
  MemberParams,
  RenameTeamRequest,
  UpdateMemberRequest,
} from '../schemas/team_schema.js';
import {
  createNewTeam,
  getMyTeam,
  inviteMembers,
  joinWithCode,
  leaveTeam,
  regenerateInviteCode,
  removeTeamMember,
  renameTeam,
  respondToInvitation,
  revokeInvitation,
  setMemberRole,
} from '../services/team_service.js';

const router = Router();

router.get('/me', async (req, res) => res.json(await getMyTeam(req.user)));

router.post('', validate({ body: CreateTeamRequest }), async (req, res) => {
  res.status(201).json(await createNewTeam(req.user, req.body.name));
});

router.patch('', validate({ body: RenameTeamRequest }), async (req, res) => {
  res.json(await renameTeam(req.user, req.body.name));
});

router.post('/invite', validate({ body: InviteRequest }), async (req, res) => {
  res.json(await inviteMembers(req.user, req.body.emails));
});

router.post('/join', validate({ body: JoinTeamRequest }), async (req, res) => {
  res.json(await joinWithCode(req.user, req.body.invite_code));
});

router.post('/leave', async (req, res) => res.json(await leaveTeam(req.user)));

router.post('/invite-code/regenerate', async (req, res) => res.json(await regenerateInviteCode(req.user)));

router.post('/invitations/:id/accept', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await respondToInvitation(req.user, req.params.id, true));
});

router.post('/invitations/:id/decline', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await respondToInvitation(req.user, req.params.id, false));
});

router.delete('/invitations/:id', validate({ params: uuidParam() }), async (req, res) => {
  res.json(await revokeInvitation(req.user, req.params.id));
});

router.patch('/members/:userId', validate({ params: MemberParams, body: UpdateMemberRequest }), async (req, res) => {
  res.json(await setMemberRole(req.user, req.params.userId, req.body.role));
});

router.delete('/members/:userId', validate({ params: MemberParams }), async (req, res) => {
  res.json(await removeTeamMember(req.user, req.params.userId));
});

export default router;

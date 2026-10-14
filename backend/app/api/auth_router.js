// File: app/api/auth_router.js
import { Router } from 'express';
import { getCurrentActiveUser } from '../core/deps.js';
import { loginLimiter, passwordLimiter, registerLimiter } from '../core/limiter.js';
import { createAccessToken } from '../core/security.js';
import { validate } from '../core/validators.js';
import { ChangePasswordRequest, LoginRequest, RegisterRequest } from '../schemas/auth_schema.js';
import { toUserOut } from '../schemas/user_schema.js';
import { authenticate, changePassword, logoutEverywhere, registerUser } from '../services/auth_service.js';

const router = Router();

// Sign-up signs the user straight in, so onboarding can start immediately.
router.post('/register', registerLimiter, validate({ body: RegisterRequest }), async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({ user: toUserOut(user), ...createAccessToken(user, { rememberMe: true }) });
});

router.post('/login', loginLimiter, validate({ body: LoginRequest }), async (req, res) => {
  const user = await authenticate(req.body.email, req.body.password);
  res.json({ user: toUserOut(user), ...createAccessToken(user, { rememberMe: req.body.remember_me }) });
});

router.post(
  '/change-password',
  getCurrentActiveUser,
  passwordLimiter,
  validate({ body: ChangePasswordRequest }),
  async (req, res) => {
    const token = await changePassword(req.user, req.body.old_password, req.body.new_password);
    res.json({ message: 'Password updated. Other sessions were signed out.', ...token });
  },
);

router.post('/logout-all', getCurrentActiveUser, async (req, res) => {
  await logoutEverywhere(req.user);
  res.status(204).end();
});

export default router;

// File: app/api/api_router.js
// Mounts every router under /api/v1 (see main.js).
import { Router } from 'express';
import { getCurrentActiveUser } from '../core/deps.js';
import authRouter from './auth_router.js';
import dataRouter from './data_router.js';
import devicesRouter from './devices_router.js';
import dictationRouter from './dictation_router.js';
import dictionaryRouter from './dictionary_router.js';
import historyRouter from './history_router.js';
import notificationsRouter from './notifications_router.js';
import preferencesRouter from './preferences_router.js';
import snippetsRouter from './snippets_router.js';
import statsRouter from './stats_router.js';
import stylesRouter from './styles_router.js';
import syncRouter from './sync_router.js';
import systemRouter from './system_router.js';
import transformsRouter from './transforms_router.js';
import usersRouter from './users_router.js';

export const apiRouter = Router();
const auth = getCurrentActiveUser;

// --- Public ---
apiRouter.use('/auth', authRouter);
apiRouter.use('/system', systemRouter);

// --- Account ---
apiRouter.use('/users', auth, usersRouter);
apiRouter.use('/preferences', auth, preferencesRouter);
apiRouter.use('/devices', auth, devicesRouter);
apiRouter.use('/data', auth, dataRouter);
apiRouter.use('/notifications', auth, notificationsRouter);
apiRouter.use('/sync', auth, syncRouter);

// --- Dictation and the hub's screens ---
apiRouter.use('/dictation', auth, dictationRouter);
apiRouter.use('/history', auth, historyRouter);
apiRouter.use('/stats', auth, statsRouter);
apiRouter.use('/dictionary', auth, dictionaryRouter);
apiRouter.use('/snippets', auth, snippetsRouter);
apiRouter.use('/styles', auth, stylesRouter);
apiRouter.use('/transforms', auth, transformsRouter);

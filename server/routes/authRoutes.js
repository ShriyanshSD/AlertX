import { Router } from 'express';
import { changePassword, currentSession, currentUser, login, logout, register, updateProfile } from '../controllers/authController.js';
import { authRateLimit } from '../middleware/rateLimit.js';
import { authenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { authSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.post('/register', authRateLimit, validate({ body: authSchemas.register }), register);
router.post('/login', authRateLimit, validate({ body: authSchemas.login }), login);
router.get('/session', currentSession);
router.get('/me', authenticate, currentUser);
router.patch('/me', authenticate, validate({ body: authSchemas.profile }), updateProfile);
router.patch('/password', authenticate, validate({ body: authSchemas.password }), changePassword);
router.post('/logout', logout);

export default router;

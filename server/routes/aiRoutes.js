import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { aiRateLimit } from '../middleware/rateLimit.js';
import { chat, clearConversation, getConversation } from '../controllers/aiController.js';
import { adminSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.use(authenticate);
router.get('/conversation', getConversation);
router.delete('/conversation', clearConversation);
router.post('/chat', aiRateLimit, validate({ body: adminSchemas.aiChat }), chat);

export default router;

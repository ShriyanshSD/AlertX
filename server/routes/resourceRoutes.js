import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { nearbyResources } from '../controllers/aiResourceController.js';
import { adminSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.use(authenticate);
router.post('/nearby', validate({ body: adminSchemas.nearbyResources }), nearbyResources);

export default router;

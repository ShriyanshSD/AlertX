import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import {
  assignSos,
  changeSosStatus,
  createSos,
  getSos,
  listActiveSos,
  listSos,
} from '../controllers/sosController.js';
import { sosSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.use(authenticate);
router.post('/', validate({ body: sosSchemas.create }), createSos);
router.get('/', listSos);
router.get('/active', listActiveSos);
router.get('/:sosId', validate({ params: sosSchemas.id }), getSos);
router.patch('/:sosId/status', validate({ params: sosSchemas.id, body: sosSchemas.status }), changeSosStatus);
router.post('/:sosId/assign', authorize('admin', 'operator'), validate({ params: sosSchemas.id, body: sosSchemas.assign }), assignSos);

export default router;

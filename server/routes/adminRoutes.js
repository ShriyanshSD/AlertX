import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import { analytics, createUser, dashboard, deleteUser, listUsers, resetSimulation, simulationStatus, startSimulation, stopSimulation, updateUser } from '../controllers/adminController.js';
import { adminSchemas, adminUserSchemas } from '../utils/validationSchemas.js';

const router = Router();

router.use(authenticate, authorize('admin'));
router.get('/dashboard', dashboard);
router.get('/users', validate({ query: adminSchemas.users }), listUsers);
router.post('/users', validate({ body: adminUserSchemas.create }), createUser);
router.patch('/users/:userId', validate({ params: adminUserSchemas.id, body: adminUserSchemas.update }), updateUser);
router.delete('/users/:userId', validate({ params: adminUserSchemas.id }), deleteUser);
router.get('/analytics', validate({ query: adminSchemas.analytics }), analytics);
router.get('/simulation', simulationStatus);
router.post('/simulation/start', startSimulation);
router.post('/simulation/stop', stopSimulation);
router.post('/simulation/reset', resetSimulation);

export default router;

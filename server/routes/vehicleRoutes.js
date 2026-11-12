import { Router } from 'express';
import {
  createVehicle,
  deleteVehicle,
  getVehicle,
  listVehicles,
  nearbyVehicles,
  simulationStatus,
  updateVehicleLocation,
  updateVehicleStatus,
} from '../controllers/vehicleController.js';
import { authenticate } from '../middleware/auth.js';
import authorize from '../middleware/authorize.js';
import validate from '../middleware/validate.js';
import { vehicleSchemas } from '../utils/validationSchemas.js';

const router = Router();
router.use(authenticate);
router.get('/', listVehicles);
router.post('/', authorize('admin', 'operator'), validate({ body: vehicleSchemas.create }), createVehicle);
router.get('/simulation', authorize('admin', 'operator'), simulationStatus);
router.get('/nearby', authorize('admin', 'operator'), validate({ query: vehicleSchemas.nearby }), nearbyVehicles);
router.get('/:vehicleId', validate({ params: vehicleSchemas.id }), getVehicle);
router.patch('/:vehicleId/status', authorize('admin', 'operator'), validate({ params: vehicleSchemas.id, body: vehicleSchemas.status }), updateVehicleStatus);
router.post('/:vehicleId/location', authorize('driver'), validate({ params: vehicleSchemas.id, body: vehicleSchemas.location }), updateVehicleLocation);
router.delete('/:vehicleId', authorize('admin', 'operator'), validate({ params: vehicleSchemas.id }), deleteVehicle);

export default router;

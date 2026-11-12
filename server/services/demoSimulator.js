import LocationHistory from '../models/LocationHistory.js';
import Vehicle from '../models/Vehicle.js';
import { DEMO_AREA, DEMO_VEHICLES } from '../data/demoData.js';
import { serializeVehicle } from '../utils/serializers.js';
import { emitToAdmin, emitToOperations, emitToSos, emitToUser } from './events.js';

export function createDemoSimulator({ io: initialIo, intervalMs = 2000, historyIntervalMs = 10000 }) {
  let io = initialIo;
  let timer = null;
  let inTick = false;
  const lastHistoryWrite = new Map();

  async function tick() {
    if (inTick) return;
    inTick = true;
    try {
      const vehicles = await Vehicle.find({
        isDemo: true,
        status: { $in: ['en_route', 'responding', 'patrolling'] },
      });
      for (const vehicle of vehicles) {
        const [lng, lat] = vehicle.currentLocation.coordinates;
        const distanceKm = ((vehicle.speed || 0) * (intervalMs / 1000)) / 3600;
        const angle = (vehicle.heading * Math.PI) / 180;
        const nextLat = lat + (distanceKm / 111.32) * Math.cos(angle);
        const nextLng = lng + (distanceKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
        const outOfBounds = nextLat < DEMO_AREA.minLat || nextLat > DEMO_AREA.maxLat
          || nextLng < DEMO_AREA.minLng || nextLng > DEMO_AREA.maxLng;
        vehicle.currentLocation = outOfBounds
          ? vehicle.currentLocation
          : { type: 'Point', coordinates: [nextLng, nextLat] };
        if (outOfBounds) vehicle.heading = (vehicle.heading + 180) % 360;
        vehicle.lastUpdated = new Date();
        await vehicle.save();

        const serialized = serializeVehicle(vehicle);
        const payload = { vehicle: serialized, isDemo: true, timestamp: vehicle.lastUpdated };
        emitToAdmin(io, 'vehicleLocationUpdated', payload);
        emitToOperations(io, 'vehicleLocationUpdated', payload);
        io?.to(`vehicle:${vehicle.vehicleId}`).emit('vehicleLocationUpdated', payload);
        if (vehicle.assignedSOS) {
          const sosId = await vehicle.populate({ path: 'assignedSOS', select: 'sosId userId' });
          if (sosId.assignedSOS) {
            emitToSos(io, sosId.assignedSOS.sosId, 'vehicleLocationUpdated', payload);
            emitToUser(io, sosId.assignedSOS.userId, 'vehicleLocationUpdated', payload);
          }
        }

        const lastWrite = lastHistoryWrite.get(String(vehicle._id)) || 0;
        if (Date.now() - lastWrite >= historyIntervalMs) {
          await LocationHistory.create({
            vehicleId: vehicle._id,
            location: vehicle.currentLocation,
            speed: vehicle.speed,
            timestamp: vehicle.lastUpdated,
            isDemo: true,
          });
          lastHistoryWrite.set(String(vehicle._id), Date.now());
        }
      }
    } finally {
      inTick = false;
    }
  }

  return {
    setIo(socketServer) {
      io = socketServer;
    },
    start() {
      if (timer) return false;
      timer = setInterval(() => {
        tick().catch((error) => console.error('Demo GPS simulation tick failed.', error));
      }, intervalMs);
      return true;
    },
    stop() {
      if (!timer) return false;
      clearInterval(timer);
      timer = null;
      return true;
    },
    async reset() {
      const updates = DEMO_VEHICLES.map(({ vehicleId, lat, lng, heading }) => Vehicle.findOneAndUpdate(
        { vehicleId, isDemo: true },
        { $set: { currentLocation: { type: 'Point', coordinates: [lng, lat] }, heading, lastUpdated: new Date() } },
        { returnDocument: 'after' },
      ).populate('assignedSOS', 'sosId userId'));
      const vehicles = await Promise.all(updates);
      for (const vehicle of vehicles.filter(Boolean)) {
        const payload = { vehicle: serializeVehicle(vehicle), isDemo: true };
        emitToAdmin(io, 'vehicleLocationUpdated', payload);
        emitToOperations(io, 'vehicleLocationUpdated', payload);
        io?.to(`vehicle:${vehicle.vehicleId}`).emit('vehicleLocationUpdated', payload);
        if (vehicle.assignedSOS) {
          emitToSos(io, vehicle.assignedSOS.sosId, 'vehicleLocationUpdated', payload);
          emitToUser(io, vehicle.assignedSOS.userId, 'vehicleLocationUpdated', payload);
        }
      }
      lastHistoryWrite.clear();
    },
    getState() {
      return { running: Boolean(timer), intervalMs };
    },
  };
}

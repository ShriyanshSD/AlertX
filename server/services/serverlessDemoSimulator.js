import { randomUUID } from 'node:crypto';
import DemoSimulationState from '../models/DemoSimulationState.js';
import LocationHistory from '../models/LocationHistory.js';
import Vehicle from '../models/Vehicle.js';
import { DEMO_AREA, DEMO_VEHICLES } from '../data/demoData.js';
import { serializeVehicle } from '../utils/serializers.js';
import { emitToAdmin, emitToOperations, emitToSos, emitToUser } from './events.js';

const stateId = 'ghaziabad-demo';
const leaseDurationMs = 30000;

function emitVehicleUpdate(io, vehicle) {
  const payload = { vehicle: serializeVehicle(vehicle), isDemo: true };
  emitToAdmin(io, 'vehicleLocationUpdated', payload);
  emitToOperations(io, 'vehicleLocationUpdated', payload);
  io?.to(`vehicle:${vehicle.vehicleId}`).emit('vehicleLocationUpdated', payload);
  if (vehicle.assignedSOS) {
    emitToSos(io, vehicle.assignedSOS.sosId, 'vehicleLocationUpdated', payload);
    emitToUser(io, vehicle.assignedSOS.userId, 'vehicleLocationUpdated', payload);
  }
}

export function createServerlessDemoSimulator({
  intervalMs = 2000,
  historyIntervalMs = 10000,
} = {}) {
  const instanceId = randomUUID();
  let io;
  let timer;
  let inTick = false;

  async function getState() {
    const state = await DemoSimulationState.findById(stateId).select('running').lean();
    return { running: Boolean(state?.running), intervalMs };
  }

  async function tick() {
    if (inTick) return;
    inTick = true;
    let hasLease = false;
    try {
      const now = new Date();
      const state = await DemoSimulationState.findOneAndUpdate({
        _id: stateId,
        running: true,
        leaseExpiresAt: { $lte: now },
        lastTickAt: { $lte: new Date(now.getTime() - intervalMs) },
      }, {
        $set: {
          leaseOwner: instanceId,
          leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
          lastTickAt: now,
        },
      });
      if (!state) return;
      hasLease = true;

      const vehicles = await Vehicle.find({
        isDemo: true,
        status: { $in: ['en_route', 'responding', 'patrolling'] },
      }).populate('assignedSOS', 'sosId userId');
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
        vehicle.lastUpdated = now;
        await vehicle.save();
        emitVehicleUpdate(io, vehicle);

        const latestHistory = await LocationHistory.findOne({
          vehicleId: vehicle._id,
          isDemo: true,
        }).sort({ timestamp: -1 }).select('timestamp').lean();
        if (!latestHistory || now.getTime() - latestHistory.timestamp.getTime() >= historyIntervalMs) {
          await LocationHistory.create({
            vehicleId: vehicle._id,
            location: vehicle.currentLocation,
            speed: vehicle.speed,
            timestamp: now,
            isDemo: true,
          });
        }
      }
    } finally {
      if (hasLease) {
        await DemoSimulationState.updateOne({
          _id: stateId,
          leaseOwner: instanceId,
        }, {
          $unset: { leaseOwner: 1 },
          $set: { leaseExpiresAt: new Date(0) },
        });
      }
      inTick = false;
    }
  }

  function startTicking() {
    if (timer) return;
    timer = setInterval(() => {
      tick().catch((error) => console.error('Demo GPS simulation tick failed.', error));
    }, intervalMs);
    timer.unref?.();
  }

  function stopTickingWhenIdle(socketServer) {
    setTimeout(() => {
      if (socketServer.engine.clientsCount === 0 && timer) {
        clearInterval(timer);
        timer = undefined;
      }
    }, 100);
  }

  return {
    setIo(socketServer) {
      io = socketServer;
      socketServer.on('connection', (socket) => {
        startTicking();
        socket.once('disconnect', () => stopTickingWhenIdle(socketServer));
      });
    },
    async start() {
      await DemoSimulationState.findByIdAndUpdate(
        stateId,
        { $set: { running: true } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );
      return getState();
    },
    async stop() {
      await DemoSimulationState.findByIdAndUpdate(
        stateId,
        { $set: { running: false } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true },
      );
      return getState();
    },
    async reset() {
      const updates = DEMO_VEHICLES.map(({ vehicleId, lat, lng, heading }) => Vehicle.findOneAndUpdate(
        { vehicleId, isDemo: true },
        {
          $set: {
            currentLocation: { type: 'Point', coordinates: [lng, lat] },
            heading,
            lastUpdated: new Date(),
          },
        },
        { returnDocument: 'after' },
      ).populate('assignedSOS', 'sosId userId'));
      const vehicles = await Promise.all(updates);
      for (const vehicle of vehicles.filter(Boolean)) emitVehicleUpdate(io, vehicle);
    },
    getState,
  };
}

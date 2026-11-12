import LocationHistory from '../models/LocationHistory.js';
import SOS from '../models/SOS.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { haversineDistanceKm, toPoint } from '../utils/geo.js';
import { serializeVehicle } from '../utils/serializers.js';
import { emitToAdmin, emitToOperations, emitToSos, emitToUser } from '../services/events.js';

async function vehicleScope(user) {
  if (['admin', 'operator'].includes(user.role)) return {};
  if (user.role === 'driver') return { operatorId: user._id };
  const sosRecords = await SOS.find({
    userId: user._id,
    status: { $ne: 'resolved' },
    assignedVehicle: { $ne: null },
  }).select('assignedVehicle');
  return { _id: { $in: sosRecords.map((record) => record.assignedVehicle) } };
}

export const listVehicles = asyncHandler(async (request, response) => {
  const scope = await vehicleScope(request.user);
  const vehicles = await Vehicle.find(scope).populate('assignedSOS', 'sosId');
  response.json({ data: { vehicles: vehicles.map(serializeVehicle) } });
});

export const getVehicle = asyncHandler(async (request, response) => {
  const vehicle = await Vehicle.findOne({
    vehicleId: request.params.vehicleId.toUpperCase(),
    ...(await vehicleScope(request.user)),
  }).populate('assignedSOS', 'sosId');
  if (!vehicle) throw new AppError(404, 'Vehicle not found or not authorized.');
  response.json({ data: { vehicle: serializeVehicle(vehicle) } });
});

export const nearbyVehicles = asyncHandler(async (request, response) => {
  const { lat, lng, radiusKm, type } = request.query;
  const center = toPoint({ lat, lng });
  const filter = {
    status: 'available',
    ...(type ? { type } : {}),
    currentLocation: {
      $near: {
        $geometry: center,
        $maxDistance: radiusKm * 1000,
      },
    },
  };
  const vehicles = await Vehicle.find(filter).limit(100);
  response.json({
    data: {
      vehicles: vehicles.map((vehicle) => ({
        ...serializeVehicle(vehicle),
        distanceKm: Number(haversineDistanceKm(center, vehicle.currentLocation).toFixed(2)),
      })),
    },
  });
});

export const simulationStatus = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  response.json({ data: { ...await simulator.getState(), enabled: true } });
});

export const createVehicle = asyncHandler(async (request, response) => {
  if (request.body.operatorId) {
    const operator = await User.findOne({ _id: request.body.operatorId, role: 'driver' });
    if (!operator) throw new AppError(400, 'operatorId must belong to a driver account.');
  }
  const vehicle = await Vehicle.create({
    vehicleId: request.body.vehicleId.toUpperCase(),
    type: request.body.type,
    driverName: request.body.driverName,
    operatorId: request.body.operatorId || null,
    status: 'available',
    currentLocation: toPoint(request.body.location),
    isDemo: config.demoMode,
  });
  response.status(201).json({ data: { vehicle: serializeVehicle(vehicle) } });
});

export const updateVehicleStatus = asyncHandler(async (request, response) => {
  const vehicle = await Vehicle.findOne({ vehicleId: request.params.vehicleId.toUpperCase() });
  if (!vehicle) throw new AppError(404, 'Vehicle not found.');
  const previousStatus = vehicle.status;
  if (['available', 'offline'].includes(request.body.status) && vehicle.assignedSOS) {
    throw new AppError(409, 'Resolve or reassign the active SOS before changing this vehicle status.');
  }
  vehicle.status = request.body.status;
  if (['available', 'offline'].includes(vehicle.status)) vehicle.speed = 0;
  vehicle.lastUpdated = new Date();
  await vehicle.save();
  const serialized = serializeVehicle(vehicle);
  const io = request.app.get('io');
  const statusEvent = { vehicle: serialized, previousStatus, isDemo: vehicle.isDemo };
  emitToAdmin(io, 'vehicleStatusChanged', statusEvent);
  emitToOperations(io, 'vehicleStatusChanged', statusEvent);
  if (vehicle.assignedSOS) {
    const sos = await SOS.findById(vehicle.assignedSOS).select('sosId userId');
    if (sos) {
      emitToSos(io, sos.sosId, 'vehicleStatusChanged', statusEvent);
      emitToUser(io, sos.userId, 'vehicleStatusChanged', statusEvent);
    }
  }
  response.json({ data: { vehicle: serialized } });
});

export const updateVehicleLocation = asyncHandler(async (request, response) => {
  const vehicle = await Vehicle.findOne({
    vehicleId: request.params.vehicleId.toUpperCase(),
    operatorId: request.user._id,
    isDemo: false,
  });
  if (!vehicle || request.user.role !== 'driver') {
    throw new AppError(403, 'Only the assigned driver device can update this real vehicle.');
  }
  vehicle.currentLocation = toPoint(request.body.location);
  vehicle.speed = request.body.speed;
  vehicle.lastUpdated = new Date();
  await vehicle.save();
  await LocationHistory.create({
    vehicleId: vehicle._id,
    location: vehicle.currentLocation,
    speed: vehicle.speed,
    isDemo: false,
  });
  const payload = { vehicle: serializeVehicle(vehicle), isDemo: false };
  const io = request.app.get('io');
  emitToAdmin(io, 'vehicleLocationUpdated', payload);
  emitToOperations(io, 'vehicleLocationUpdated', payload);
  io?.to(`vehicle:${vehicle.vehicleId}`).emit('vehicleLocationUpdated', payload);
  if (vehicle.assignedSOS) {
    const assignedSos = await SOS.findById(vehicle.assignedSOS).select('sosId userId');
    if (assignedSos) {
      emitToSos(io, assignedSos.sosId, 'vehicleLocationUpdated', payload);
      emitToUser(io, assignedSos.userId, 'vehicleLocationUpdated', payload);
    }
  }
  response.json({ data: { vehicle: payload.vehicle } });
});

export const deleteVehicle = asyncHandler(async (request, response) => {
  const vehicle = await Vehicle.findOne({ vehicleId: request.params.vehicleId.toUpperCase() });
  if (!vehicle) throw new AppError(404, 'Vehicle not found.');
  if (vehicle.assignedSOS) throw new AppError(409, 'Resolve the active SOS before removing this vehicle.');
  await vehicle.deleteOne();
  response.json({ data: { deleted: vehicle.vehicleId } });
});


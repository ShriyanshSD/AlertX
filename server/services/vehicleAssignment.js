import SOS from '../models/SOS.js';
import Vehicle from '../models/Vehicle.js';
import AppError from '../utils/AppError.js';
import { haversineDistanceKm } from '../utils/geo.js';
import { serializeSos, serializeVehicle } from '../utils/serializers.js';
import { emitToAdmin, emitToOperations, emitToSos, emitToUser } from './events.js';

const vehicleTypesByEmergency = {
  medical: ['ambulance'],
  fire: ['fire_truck'],
  accident: ['ambulance', 'police'],
  personal_safety: ['police'],
  other: [],
};

export async function assignNearestVehicle(sos, io) {
  const candidates = await Vehicle.find({
    type: { $in: vehicleTypesByEmergency[sos.emergencyType] },
    status: 'available',
    isDemo: sos.isDemo,
    currentLocation: { $exists: true },
  });
  candidates.sort((first, second) => (
    haversineDistanceKm(sos.location, first.currentLocation)
    - haversineDistanceKm(sos.location, second.currentLocation)
  ));

  for (const candidate of candidates) {
    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: candidate._id, status: 'available', assignedSOS: null },
      { $set: { status: 'en_route', assignedSOS: sos._id, lastUpdated: new Date() } },
      { returnDocument: 'after' },
    );
    if (!vehicle) continue;

    sos.assignedVehicle = vehicle._id;
    sos.status = 'assigned';
    await sos.save();
    const payload = { sos: serializeSos(sos), vehicle: serializeVehicle(vehicle) };
    const statusPayload = { vehicle: payload.vehicle, previousStatus: 'available', isDemo: vehicle.isDemo };
    emitToAdmin(io, 'vehicleStatusChanged', statusPayload);
    emitToOperations(io, 'vehicleStatusChanged', statusPayload);
    emitToUser(io, sos.userId, 'vehicleStatusChanged', statusPayload);
    emitToSos(io, sos.sosId, 'vehicleStatusChanged', statusPayload);
    emitToAdmin(io, 'vehicleAssigned', payload);
    emitToOperations(io, 'vehicleAssigned', payload);
    emitToSos(io, sos.sosId, 'vehicleAssigned', payload);
    emitToUser(io, sos.userId, 'vehicleAssigned', payload);
    return vehicle;
  }

  sos.assignedVehicle = null;
  sos.status = 'pending';
  await sos.save();
  return null;
}

export async function assignSpecificVehicle(sos, vehicleId, io) {
  const vehicle = await Vehicle.findOne({ vehicleId: vehicleId.toUpperCase() });
  if (!vehicle) throw new AppError(404, 'Vehicle not found.');
  if (vehicle.isDemo !== sos.isDemo) throw new AppError(409, 'Vehicle and SOS demo modes do not match.');
  const eligibleTypes = vehicleTypesByEmergency[sos.emergencyType] || [];
  if (eligibleTypes.length && !eligibleTypes.includes(vehicle.type)) {
    throw new AppError(400, 'This vehicle type is not suitable for the emergency.');
  }
  if (vehicle.status !== 'available' || vehicle.assignedSOS) {
    throw new AppError(409, 'Vehicle is not available for assignment.');
  }

  const assigned = await Vehicle.findOneAndUpdate(
    { _id: vehicle._id, status: 'available', assignedSOS: null },
    { $set: { status: 'en_route', assignedSOS: sos._id, lastUpdated: new Date() } },
    { returnDocument: 'after' },
  );
  if (!assigned) throw new AppError(409, 'Vehicle was assigned to another request.');

  if (sos.assignedVehicle) {
    const released = await Vehicle.findOneAndUpdate(
      { _id: sos.assignedVehicle, assignedSOS: sos._id },
      { $set: { status: 'available', assignedSOS: null, speed: 0, lastUpdated: new Date() } },
      { returnDocument: 'after' },
    );
    if (released) {
      const releasedPayload = { vehicle: serializeVehicle(released), previousStatus: 'en_route', isDemo: released.isDemo };
      emitToAdmin(io, 'vehicleStatusChanged', releasedPayload);
      emitToOperations(io, 'vehicleStatusChanged', releasedPayload);
    }
  }
  sos.assignedVehicle = assigned._id;
  sos.status = 'assigned';
  await sos.save();
  const payload = { sos: serializeSos(sos), vehicle: serializeVehicle(assigned) };
  const statusPayload = { vehicle: payload.vehicle, previousStatus: 'available', isDemo: assigned.isDemo };
  emitToAdmin(io, 'vehicleStatusChanged', statusPayload);
  emitToOperations(io, 'vehicleStatusChanged', statusPayload);
  emitToUser(io, sos.userId, 'vehicleStatusChanged', statusPayload);
  emitToSos(io, sos.sosId, 'vehicleStatusChanged', statusPayload);
  emitToAdmin(io, 'vehicleAssigned', payload);
  emitToOperations(io, 'vehicleAssigned', payload);
  emitToSos(io, sos.sosId, 'vehicleAssigned', payload);
  emitToUser(io, sos.userId, 'vehicleAssigned', payload);
  return assigned;
}

export async function updateSosStatus(sos, status, io) {
  const validTransitions = {
    pending: ['assigned', 'resolved'],
    assigned: ['responding', 'resolved'],
    responding: ['resolved'],
    resolved: [],
  };
  if (sos.status !== status && !validTransitions[sos.status].includes(status)) {
    throw new AppError(409, `Cannot change an SOS from ${sos.status} to ${status}.`);
  }
  if (status === 'assigned' && !sos.assignedVehicle) {
    throw new AppError(409, 'Assign an eligible vehicle before setting this SOS to assigned.');
  }
  if (status === 'responding' && !sos.assignedVehicle) {
    throw new AppError(409, 'Assign a vehicle before setting this SOS to responding.');
  }
  sos.status = status;
  let changedVehicle = null;
  let previousVehicleStatus = '';
  if (status === 'resolved') {
    sos.resolvedAt = new Date();
    if (sos.assignedVehicle) {
      const currentVehicle = await Vehicle.findById(sos.assignedVehicle).select('status');
      previousVehicleStatus = currentVehicle?.status || '';
      changedVehicle = await Vehicle.findOneAndUpdate(
        { _id: sos.assignedVehicle, assignedSOS: sos._id },
        { $set: { status: 'available', assignedSOS: null, speed: 0, lastUpdated: new Date() } },
        { returnDocument: 'after' },
      );
    }
  }
  if (status === 'responding' && sos.assignedVehicle) {
    const currentVehicle = await Vehicle.findById(sos.assignedVehicle).select('status');
    previousVehicleStatus = currentVehicle?.status || '';
    changedVehicle = await Vehicle.findByIdAndUpdate(
      sos.assignedVehicle,
      { $set: { status: 'responding', lastUpdated: new Date() } },
      { returnDocument: 'after' },
    );
  }
  await sos.save();
  const payload = serializeSos(sos);
  if (changedVehicle && previousVehicleStatus !== changedVehicle.status) {
    const vehicleEvent = {
      vehicle: serializeVehicle(changedVehicle),
      previousStatus: previousVehicleStatus,
      isDemo: changedVehicle.isDemo,
    };
    emitToAdmin(io, 'vehicleStatusChanged', vehicleEvent);
    emitToOperations(io, 'vehicleStatusChanged', vehicleEvent);
    emitToSos(io, sos.sosId, 'vehicleStatusChanged', vehicleEvent);
    emitToUser(io, sos.userId, 'vehicleStatusChanged', vehicleEvent);
  }
  emitToAdmin(io, 'sosUpdated', payload);
  emitToOperations(io, 'sosUpdated', payload);
  emitToSos(io, sos.sosId, 'sosUpdated', payload);
  emitToUser(io, sos.userId, 'sosUpdated', payload);
  if (status === 'resolved') {
    emitToAdmin(io, 'sosResolved', payload);
    emitToOperations(io, 'sosResolved', payload);
    emitToSos(io, sos.sosId, 'sosResolved', payload);
    emitToUser(io, sos.userId, 'sosResolved', payload);
  }
  return sos;
}


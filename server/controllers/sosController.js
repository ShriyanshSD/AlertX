import { randomUUID } from 'node:crypto';
import SOS from '../models/SOS.js';
import Vehicle from '../models/Vehicle.js';
import { config } from '../config/env.js';
import AppError from '../utils/AppError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { toPoint } from '../utils/geo.js';
import { serializeSos } from '../utils/serializers.js';
import { assignNearestVehicle, assignSpecificVehicle, updateSosStatus } from '../services/vehicleAssignment.js';
import { notifyTrustedContacts } from '../services/notificationService.js';
import { emitToAdmin, emitToOperations, emitToUser } from '../services/events.js';

const priorityForType = {
  medical: 'critical',
  fire: 'high',
  accident: 'high',
  personal_safety: 'high',
  other: 'medium',
};

function canViewAll(user) {
  return ['admin', 'operator'].includes(user.role);
}

async function findAuthorizedSos(user, sosId) {
  const sos = await SOS.findOne({ sosId }).populate('assignedVehicle', 'vehicleId operatorId');
  if (!sos) throw new AppError(404, 'SOS request not found.');
  if (!canViewAll(user) && String(sos.userId) !== String(user._id)) {
    const assignedVehicle = await Vehicle.exists({ assignedSOS: sos._id, operatorId: user._id });
    if (!assignedVehicle) throw new AppError(404, 'SOS request not found.');
  }
  return sos;
}

export const createSos = asyncHandler(async (request, response) => {
  const {
    emergencyType,
    description,
    location,
    locationLabel,
    reportedFor,
    personName,
    personRelationship,
    alertContactIds,
  } = request.body;
  const sos = await SOS.create({
    sosId: `SOS-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomUUID().slice(0, 6).toUpperCase()}`,
    userId: request.user._id,
    emergencyType,
    priority: priorityForType[emergencyType],
    description,
    reportedFor,
    personName: reportedFor === 'other' ? personName : '',
    personRelationship: reportedFor === 'other' ? personRelationship : '',
    location: toPoint(location),
    locationLabel: locationLabel || (config.demoMode ? 'Indirapuram, Ghaziabad' : ''),
    status: 'pending',
    isDemo: config.demoMode,
  });
  await assignNearestVehicle(sos, request.app.get('io'));
  await notifyTrustedContacts({ sos, contactIds: alertContactIds, io: request.app.get('io') });
  await sos.populate('assignedVehicle', 'vehicleId');
  const serialized = serializeSos(sos);
  const io = request.app.get('io');
  emitToAdmin(io, 'sosCreated', serialized);
  emitToOperations(io, 'sosCreated', serialized);
  emitToUser(io, request.user._id, 'sosCreated', serialized);
  response.status(201).json({ data: { sos: serialized } });
});

export const listSos = asyncHandler(async (request, response) => {
  const query = canViewAll(request.user) ? {} : { userId: request.user._id };
  const records = await SOS.find(query).sort({ createdAt: -1 }).populate('assignedVehicle', 'vehicleId');
  response.json({ data: { sos: records.map(serializeSos) } });
});

export const listActiveSos = asyncHandler(async (request, response) => {
  const query = { status: { $ne: 'resolved' } };
  if (!canViewAll(request.user)) query.userId = request.user._id;
  const records = await SOS.find(query).sort({ createdAt: -1 }).populate('assignedVehicle', 'vehicleId');
  response.json({ data: { sos: records.map(serializeSos) } });
});

export const getSos = asyncHandler(async (request, response) => {
  const sos = await findAuthorizedSos(request.user, request.params.sosId);
  response.json({ data: { sos: serializeSos(sos) } });
});

export const changeSosStatus = asyncHandler(async (request, response) => {
  const sos = await findAuthorizedSos(request.user, request.params.sosId);
  const isDispatcher = ['admin', 'operator'].includes(request.user.role);
  const isAssignedDriver = request.user.role === 'driver'
    && sos.assignedVehicle
    && String(sos.assignedVehicle.operatorId) === String(request.user._id);
  if (!isDispatcher && !isAssignedDriver) {
    throw new AppError(403, 'Only an authorized dispatcher or assigned driver can update this SOS.');
  }
  const updated = await updateSosStatus(sos, request.body.status, request.app.get('io'));
  await updated.populate('assignedVehicle', 'vehicleId');
  response.json({ data: { sos: serializeSos(updated) } });
});

export const assignSos = asyncHandler(async (request, response) => {
  const sos = await findAuthorizedSos(request.user, request.params.sosId);
  await assignSpecificVehicle(sos, request.body.vehicleId, request.app.get('io'));
  await sos.populate('assignedVehicle', 'vehicleId');
  response.json({ data: { sos: serializeSos(sos) } });
});

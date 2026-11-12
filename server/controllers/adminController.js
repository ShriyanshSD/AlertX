import Contact from '../models/Contact.js';
import SOS from '../models/SOS.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import AIActivity from '../models/AIActivity.js';
import asyncHandler from '../utils/asyncHandler.js';
import { serializeUser } from '../utils/serializers.js';

export const dashboard = asyncHandler(async (_request, response) => {
  const [vehicles, availableVehicles, activeSos, users, contacts, recentSos] = await Promise.all([
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ status: 'available' }),
    SOS.countDocuments({ status: { $ne: 'resolved' } }),
    User.countDocuments(),
    Contact.countDocuments({ isActive: true }),
    SOS.find().sort({ createdAt: -1 }).limit(5).populate('assignedVehicle', 'vehicleId'),
  ]);
  response.json({
    data: {
      totals: { vehicles, availableVehicles, activeSos, users, contacts },
      recentSos: recentSos.map((record) => ({
        sosId: record.sosId,
        emergencyType: record.emergencyType,
        priority: record.priority,
        status: record.status,
        vehicle: record.assignedVehicle?.vehicleId || null,
        createdAt: record.createdAt,
        isDemo: record.isDemo,
      })),
    },
  });
});

export const listUsers = asyncHandler(async (request, response) => {
  const { page, limit } = request.query;
  const [users, total] = await Promise.all([
    User.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(),
  ]);
  response.json({ data: { users: users.map(serializeUser), page, limit, total } });
});

export const analytics = asyncHandler(async (request, response) => {
  const { from, to, type, priority, status } = request.query;
  const sosFilter = {};
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    dateFilter.$lt = end;
  }
  if (Object.keys(dateFilter).length) sosFilter.createdAt = dateFilter;
  if (type) sosFilter.emergencyType = type;
  if (priority) sosFilter.priority = priority;
  if (status) sosFilter.status = status;
  const activityFilter = Object.keys(dateFilter).length ? { createdAt: dateFilter } : {};

  const [byType, byStatus, byPriority, alertCount, sosCount, totalVehicles, busyVehicles, aiRequests, aiEmergencyRequests] = await Promise.all([
    SOS.aggregate([{ $match: sosFilter }, { $group: { _id: '$emergencyType', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    SOS.aggregate([{ $match: sosFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    SOS.aggregate([{ $match: sosFilter }, { $group: { _id: '$priority', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    EmergencyAlert.countDocuments(),
    SOS.countDocuments(sosFilter),
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ status: { $in: ['en_route', 'responding'] } }),
    AIActivity.countDocuments(activityFilter),
    AIActivity.countDocuments({ ...activityFilter, emergencyRelated: true }),
  ]);
  response.json({
    data: {
      byType,
      byStatus,
      byPriority,
      alertCount,
      sosCount,
      vehicleUtilization: { total: totalVehicles, busy: busyVehicles },
      aiActivity: { requests: aiRequests, emergencyRelated: aiEmergencyRequests },
    },
  });
});

export const simulationStatus = (request, response) => {
  const simulator = request.app.get('demoSimulator');
  response.json({ data: { ...simulator.getState(), enabled: true } });
};

export const startSimulation = (request, response) => {
  const simulator = request.app.get('demoSimulator');
  simulator.start();
  response.json({ data: simulator.getState() });
};

export const stopSimulation = (request, response) => {
  const simulator = request.app.get('demoSimulator');
  simulator.stop();
  response.json({ data: simulator.getState() });
};

export const resetSimulation = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  await simulator.reset();
  response.json({ data: { ...simulator.getState(), reset: true } });
});

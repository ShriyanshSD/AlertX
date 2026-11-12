import bcrypt from 'bcryptjs';
import Contact from '../models/Contact.js';
import SOS from '../models/SOS.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import AIActivity from '../models/AIActivity.js';
import AIConversation from '../models/AIConversation.js';
import AppError from '../utils/AppError.js';
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

export const createUser = asyncHandler(async (request, response) => {
  const { name, email, phone = '', password, role } = request.body;
  if (await User.exists({ email })) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await User.create({ name, email, phone, passwordHash, role });
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError(409, 'An account with this email already exists.');
    }
    throw error;
  }
  response.status(201).json({ data: { user: serializeUser(user) } });
});

export const updateUser = asyncHandler(async (request, response) => {
  const user = await User.findById(request.params.userId);
  if (!user) throw new AppError(404, 'User account not found.');

  const { name, email, phone, role } = request.body;
  if (role && role !== user.role) {
    if (String(user._id) === String(request.user._id)) {
      throw new AppError(409, 'You cannot change your own account role.');
    }
    if (user.role === 'admin' && role !== 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
      throw new AppError(409, 'The last administrator cannot be demoted.');
    }
  }
  if (email && email !== user.email && await User.exists({ email, _id: { $ne: user._id } })) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  const previousRole = user.role;
  if (previousRole === 'driver' && role && role !== 'driver') {
    const assignedVehicleIds = await Vehicle.find({ operatorId: user._id }).distinct('_id');
    if (await SOS.exists({
      assignedVehicle: { $in: assignedVehicleIds },
      status: { $in: ['pending', 'assigned', 'responding'] },
    })) {
      throw new AppError(409, 'Resolve active SOS requests assigned to this driver before changing their role.');
    }
  }
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  await user.save();

  if (previousRole === 'driver' && user.role !== 'driver') {
    await Vehicle.updateMany(
      { operatorId: user._id },
      { $set: { operatorId: null, driverName: 'Unassigned', assignedSOS: null } },
    );
  }
  response.json({ data: { user: serializeUser(user) } });
});

export const deleteUser = asyncHandler(async (request, response) => {
  const user = await User.findById(request.params.userId);
  if (!user) throw new AppError(404, 'User account not found.');
  if (String(user._id) === String(request.user._id)) {
    throw new AppError(409, 'You cannot remove your own administrator account.');
  }
  if (user.role === 'admin' && await User.countDocuments({ role: 'admin' }) <= 1) {
    throw new AppError(409, 'The last administrator cannot be removed.');
  }
  const assignedVehicleIds = await Vehicle.find({ operatorId: user._id }).distinct('_id');
  if (await SOS.exists({
    status: { $in: ['pending', 'assigned', 'responding'] },
    $or: [
      { userId: user._id },
      { assignedVehicle: { $in: assignedVehicleIds } },
    ],
  })) {
    throw new AppError(409, "Resolve active SOS requests owned by this user or assigned to their fleet units before removing this account.");
  }

  const [contacts, sosRecords] = await Promise.all([
    Contact.find({ userId: user._id }).select('_id').lean(),
    SOS.find({ userId: user._id }).select('_id').lean(),
  ]);
  const contactIds = contacts.map(({ _id }) => _id);
  const sosIds = sosRecords.map(({ _id }) => _id);
  const alertReferences = [{ recipientUserId: user._id }];
  if (contactIds.length) alertReferences.push({ contactId: { $in: contactIds } });
  if (sosIds.length) alertReferences.push({ sosId: { $in: sosIds } });

  const cleanup = [
    EmergencyAlert.deleteMany({ $or: alertReferences }),
    Contact.deleteMany({ userId: user._id }),
    SOS.deleteMany({ userId: user._id }),
    AIConversation.deleteOne({ userId: user._id }),
    AIActivity.deleteMany({ userId: user._id }),
    Vehicle.updateMany(
      { operatorId: user._id },
      { $set: { operatorId: null, driverName: 'Unassigned', assignedSOS: null } },
    ),
  ];
  if (contactIds.length) {
    cleanup.push(SOS.updateMany(
      { 'alertContacts.contactId': { $in: contactIds } },
      { $pull: { alertContacts: { contactId: { $in: contactIds } } } },
    ));
  }
  if (sosIds.length) {
    cleanup.push(Vehicle.updateMany(
      { assignedSOS: { $in: sosIds } },
      { $set: { assignedSOS: null } },
    ));
  }
  await Promise.all(cleanup);

  const result = await User.deleteOne({ _id: user._id });
  if (result.deletedCount !== 1) throw new AppError(409, 'The account changed before it could be removed.');
  response.json({ data: { deleted: true, userId: String(user._id) } });
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

export const simulationStatus = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  response.json({ data: { ...await simulator.getState(), enabled: true } });
});

export const startSimulation = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  await simulator.start();
  response.json({ data: await simulator.getState() });
});

export const stopSimulation = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  await simulator.stop();
  response.json({ data: await simulator.getState() });
});

export const resetSimulation = asyncHandler(async (request, response) => {
  const simulator = request.app.get('demoSimulator');
  await simulator.reset();
  response.json({ data: { ...await simulator.getState(), reset: true } });
});

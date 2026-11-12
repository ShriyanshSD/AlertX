import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import LocationHistory from '../models/LocationHistory.js';
import SOS from '../models/SOS.js';
import User from '../models/User.js';
import Vehicle from '../models/Vehicle.js';
import { config } from '../config/env.js';
import { toPoint } from '../utils/geo.js';
import { serializeVehicle } from '../utils/serializers.js';
import { emitToAdmin, emitToOperations, emitToSos, emitToUser } from '../services/events.js';

function readSocketToken(socket) {
  if (socket.handshake.auth?.token) return socket.handshake.auth.token;
  const cookies = socket.handshake.headers.cookie || '';
  const entry = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith('resq_token='));
  return entry ? decodeURIComponent(entry.slice('resq_token='.length)) : null;
}

function sendResult(socket, acknowledgement, error) {
  const result = error ? { error: error.message } : { ok: true };
  if (typeof acknowledgement === 'function') acknowledgement(result);
  else if (error) socket.emit('socketError', result);
}

export function attachSocketServer(httpServer, app) {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    maxHttpBufferSize: 1e5,
  });

  io.use(async (socket, next) => {
    const token = readSocketToken(socket);
    if (!token) return next(new Error('Authentication required.'));
    try {
      const claims = jwt.verify(token, config.jwtSecret, { issuer: 'resq-api', audience: 'resq-client' });
      const user = await User.findById(claims.sub);
      if (!user) return next(new Error('Account is unavailable.'));
      socket.data.user = { id: String(user._id), role: user.role };
      return next();
    } catch {
      return next(new Error('Socket authentication failed.'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);

    socket.on('joinTrackingRoom', async (payload = {}, acknowledgement) => {
      try {
        const { type, id } = payload;
        if (type === 'admin') {
          if (user.role !== 'admin') throw new Error('Admin access is required.');
          socket.join('dashboard:admin');
        } else if (type === 'operations') {
          if (!['admin', 'operator'].includes(user.role)) throw new Error('Dispatcher access is required.');
          socket.join('dashboard:operations');
        } else if (type === 'sos' && typeof id === 'string') {
          const sos = await SOS.findOne({ sosId: id }).select('userId assignedVehicle');
          if (!sos) throw new Error('SOS request not found.');
          const owner = String(sos.userId) === user.id;
          const dispatcher = ['admin', 'operator'].includes(user.role);
          const assignedDriver = user.role === 'driver' && await Vehicle.exists({
            _id: sos.assignedVehicle,
            operatorId: user.id,
          });
          if (!owner && !dispatcher && !assignedDriver) throw new Error('You are not authorized to track this SOS.');
          socket.join(`sos:${id}`);
        } else if (type === 'vehicle' && typeof id === 'string') {
          const vehicle = await Vehicle.findOne({ vehicleId: id.toUpperCase() }).select('operatorId');
          if (!vehicle) throw new Error('Vehicle not found.');
          const assignedDriver = user.role === 'driver' && String(vehicle.operatorId) === user.id;
          if (!['admin', 'operator'].includes(user.role) && !assignedDriver) {
            const assignedSos = await SOS.exists({ userId: user.id, assignedVehicle: vehicle._id });
            if (!assignedSos) throw new Error('You are not authorized to track this vehicle.');
          }
          socket.join(`vehicle:${vehicle.vehicleId}`);
        } else if (type === 'user' && (!id || id === user.id)) {
          socket.join(`user:${user.id}`);
        } else {
          throw new Error('Tracking room request is invalid.');
        }
        sendResult(socket, acknowledgement);
      } catch (error) {
        sendResult(socket, acknowledgement, error);
      }
    });

    socket.on('leaveTrackingRoom', (payload = {}, acknowledgement) => {
      const { type, id } = payload;
      if (type === 'sos' && typeof id === 'string') socket.leave(`sos:${id}`);
      else if (type === 'vehicle' && typeof id === 'string') socket.leave(`vehicle:${id.toUpperCase()}`);
      sendResult(socket, acknowledgement);
    });

    socket.on('vehicleLocationUpdate', async (payload = {}, acknowledgement) => {
      try {
        if (user.role !== 'driver') throw new Error('Only assigned driver devices may update vehicle locations.');
        const { vehicleId, location, speed = 0 } = payload;
        if (typeof vehicleId !== 'string'
          || !Number.isFinite(location?.lat) || location.lat < -90 || location.lat > 90
          || !Number.isFinite(location?.lng) || location.lng < -180 || location.lng > 180
          || !Number.isFinite(speed) || speed < 0 || speed > 250) {
          throw new Error('Vehicle location payload is invalid.');
        }
        const now = Date.now();
        if (socket.data.lastLocationUpdate && now - socket.data.lastLocationUpdate < 500) {
          throw new Error('Vehicle location updates are rate limited.');
        }
        const vehicle = await Vehicle.findOne({
          vehicleId: vehicleId.toUpperCase(),
          operatorId: user.id,
          isDemo: false,
        });
        if (!vehicle) throw new Error('This device is not authorized for that vehicle.');

        vehicle.currentLocation = toPoint(location);
        vehicle.speed = speed;
        vehicle.lastUpdated = new Date(now);
        await vehicle.save();
        await LocationHistory.create({
          vehicleId: vehicle._id,
          location: vehicle.currentLocation,
          speed,
          isDemo: false,
          timestamp: vehicle.lastUpdated,
        });
        socket.data.lastLocationUpdate = now;
        const event = { vehicle: serializeVehicle(vehicle), isDemo: false };
        emitToAdmin(io, 'vehicleLocationUpdated', event);
        emitToOperations(io, 'vehicleLocationUpdated', event);
        io.to(`vehicle:${vehicle.vehicleId}`).emit('vehicleLocationUpdated', event);
        if (vehicle.assignedSOS) {
          const sos = await SOS.findById(vehicle.assignedSOS).select('sosId userId');
          if (sos) {
            emitToSos(io, sos.sosId, 'vehicleLocationUpdated', event);
            emitToUser(io, sos.userId, 'vehicleLocationUpdated', event);
          }
        }
        sendResult(socket, acknowledgement);
      } catch (error) {
        sendResult(socket, acknowledgement, error);
      }
    });
  });

  app.set('io', io);
  return io;
}

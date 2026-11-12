import { useCallback, useEffect, useState } from 'react';
import { initialVehicles } from '../data/demoData.js';
import { useAuth } from '../context/AuthContext.jsx';
import { advanceVehicles } from '../services/gpsSimulation.js';
import api, { getApiError } from '../services/api.js';
import { connectRealtime } from '../services/realtime.js';
import { readStored, writeStored } from '../services/storage.js';

const typeNames = { ambulance: 'Ambulance', fire_truck: 'Fire Truck', police: 'Police Car' };

function toUiVehicle(vehicle) {
  return {
    ...vehicle,
    id: vehicle.vehicleId || vehicle.id,
    type: typeNames[vehicle.type] || vehicle.type,
    crew: vehicle.driverName || 'Unassigned',
    eta: '—',
    updatedAt: vehicle.lastUpdated,
  };
}

export default function useVehicles() {
  const { user } = useAuth();
  const [vehicles, setVehicles] = useState(() => readStored('resq-vehicles', initialVehicles));
  const [running, setRunning] = useState(!user);
  const [speed, setSpeed] = useState(1);
  const [enabled] = useState(() => readStored('resq-preferences', { location: true }).location !== false);
  const [error, setError] = useState('');
  const backend = Boolean(user);

  useEffect(() => {
    if (!user) {
      setVehicles(readStored('resq-vehicles', initialVehicles));
      setRunning(enabled);
      setError('');
      return undefined;
    }

    let active = true;
    let hasConnected = false;
    const loadVehicles = () => api.get('/vehicles')
      .then(({ data }) => {
        if (active) setVehicles(data.data.vehicles.map(toUiVehicle));
      })
      .catch((requestError) => {
        if (active) setError(getApiError(requestError));
      });
    loadVehicles();

    const socket = connectRealtime();
    const roomType = user.role === 'admin' ? 'admin' : ['operator'].includes(user.role) ? 'operations' : 'user';
    const updateVehicle = (event) => {
      const vehicle = event.vehicle ? toUiVehicle(event.vehicle) : null;
      if (!vehicle) return;
      setVehicles((current) => [
        vehicle,
        ...current.filter((entry) => entry.id !== vehicle.id),
      ]);
    };
    const joinTrackingRoom = () => {
      if (active) setError('');
      if (hasConnected) loadVehicles();
      hasConnected = true;
      if (roomType === 'user') return;
      socket.emit('joinTrackingRoom', { type: roomType }, (result) => {
        if (active && result?.error) setError(`Live updates unavailable: ${result.error}`);
      });
    };
    const onSocketError = (socketError) => {
      if (active) setError(`Live updates unavailable: ${socketError.message}`);
    };
    const onVehicleAssigned = ({ vehicle }) => vehicle && updateVehicle({ vehicle });
    socket.on('connect', joinTrackingRoom);
    socket.on('connect_error', onSocketError);
    socket.on('vehicleLocationUpdated', updateVehicle);
    socket.on('vehicleAssigned', onVehicleAssigned);
    if (socket.connected) joinTrackingRoom();

    if (['admin', 'operator'].includes(user.role)) {
      api.get('/vehicles/simulation')
        .then(({ data }) => { if (active) setRunning(data.data.running); })
        .catch((requestError) => { if (active) setError(getApiError(requestError)); });
    } else {
      setRunning(false);
    }

    return () => {
      active = false;
      socket.off('connect', joinTrackingRoom);
      socket.off('connect_error', onSocketError);
      socket.off('vehicleLocationUpdated', updateVehicle);
      socket.off('vehicleAssigned', onVehicleAssigned);
      socket.disconnect();
    };
  }, [enabled, user]);

  useEffect(() => {
    if (backend || !running || !enabled) return undefined;
    const timer = window.setInterval(() => {
      setVehicles((current) => advanceVehicles(current, speed));
    }, 2000);
    return () => window.clearInterval(timer);
  }, [backend, running, speed, enabled]);

  useEffect(() => {
    if (!backend) writeStored('resq-vehicles', vehicles);
  }, [backend, vehicles]);

  const setSimulationRunning = useCallback(async (nextRunning) => {
    if (backend) {
      if (user?.role !== 'admin') {
        setError('Only an administrator can control the server location simulator.');
        return;
      }
      try {
        const { data } = await api.post(`/admin/simulation/${nextRunning ? 'start' : 'stop'}`);
        setRunning(data.data.running);
        setError('');
      } catch (requestError) {
        setError(getApiError(requestError));
      }
      return;
    }
    setRunning(nextRunning);
  }, [backend, user]);

  const reset = useCallback(async () => {
    if (backend) {
      if (user?.role !== 'admin') {
        setError('Only an administrator can reset the server location simulator.');
        return;
      }
      try {
        await api.post('/admin/simulation/reset');
        const { data } = await api.get('/vehicles');
        setVehicles(data.data.vehicles.map(toUiVehicle));
        setError('');
      } catch (requestError) {
        setError(getApiError(requestError));
      }
      return;
    }
    setVehicles(initialVehicles.map((vehicle) => ({ ...vehicle })));
    setRunning(false);
  }, [backend, user]);

  return {
    vehicles,
    setVehicles,
    running: running && (backend || enabled),
    enabled: backend || enabled,
    setRunning: setSimulationRunning,
    speed,
    setSpeed,
    reset,
    backend,
    error,
  };
}

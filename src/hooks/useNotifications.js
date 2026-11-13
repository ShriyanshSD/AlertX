import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { connectRealtime } from '../services/realtime.js';

let notificationSequence = 0;

function prependNotification(setItems, notification) {
  setItems((current) => [
    { ...notification, time: 'Just now', id: `${Date.now()}-${++notificationSequence}`, read: false },
    ...current,
  ].slice(0, 8));
}

export default function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return undefined;
    }
    setItems([]);
    const socket = connectRealtime();
    const roomType = user.role === 'admin' ? 'admin' : user.role === 'operator' ? 'operations' : null;
    const joinRoom = () => {
      if (roomType) {
        socket.emit('joinTrackingRoom', { type: roomType }, (result) => {
          if (result?.error) prependNotification(setItems, {
            title: 'Live notification access unavailable',
            detail: result.error,
            tone: 'orange',
          });
        });
      }
    };
    const onSocketError = () => prependNotification(setItems, {
      title: 'Live notifications disconnected',
      detail: 'Reconnect to receive emergency and vehicle status updates.',
      tone: 'orange',
    });
    const onSosCreated = (sos) => prependNotification(setItems, {
      title: `New ${sos.type || 'emergency'} request${sos.reportedFor === 'other' && sos.personName ? ` for ${sos.personName}` : ''}`,
      detail: `${sos.sosId || sos.id} · ${sos.location || 'Location unavailable'}`,
      tone: 'red',
    });
    const onVehicleAssigned = ({ sos, vehicle }) => {
      if (!sos || !vehicle) return;
      prependNotification(setItems, {
        title: `Unit ${vehicle.vehicleId || vehicle.id} assigned`,
        detail: `${sos.sosId || sos.id} · ${sos.type}`,
        tone: 'blue',
      });
    };
    const onContactAlert = (alert) => prependNotification(setItems, {
      title: 'Trusted-contact alert status',
      detail: `${alert.contact} · Delivery: ${String(alert.status || 'unknown').replaceAll('_', ' ')}`,
      tone: alert.status === 'consent_required' ? 'orange' : 'green',
    });
    const onVehicleStatusChanged = ({ vehicle, previousStatus }) => {
      if (!vehicle) return;
      prependNotification(setItems, {
        title: `Unit ${vehicle.vehicleId || vehicle.id} status changed`,
        detail: `${previousStatus || 'Previous status unavailable'} → ${String(vehicle.status).replaceAll('_', ' ')}`,
        tone: vehicle.status === 'offline' ? 'orange' : 'blue',
      });
    };
    const onSosResolved = (sos) => prependNotification(setItems, {
      title: `Emergency ${sos.sosId || sos.id} resolved`,
      detail: `${sos.type || 'Emergency'} · Status: resolved`,
      tone: 'green',
    });
    socket.on('connect', joinRoom);
    socket.on('connect_error', onSocketError);
    if (socket.connected) joinRoom();
    socket.on('sosCreated', onSosCreated);
    socket.on('vehicleAssigned', onVehicleAssigned);
    socket.on('emergencyNotification', onContactAlert);
    socket.on('vehicleStatusChanged', onVehicleStatusChanged);
    socket.on('sosResolved', onSosResolved);
    return () => {
      socket.off('connect', joinRoom);
      socket.off('connect_error', onSocketError);
      socket.off('sosCreated', onSosCreated);
      socket.off('vehicleAssigned', onVehicleAssigned);
      socket.off('emergencyNotification', onContactAlert);
      socket.off('vehicleStatusChanged', onVehicleStatusChanged);
      socket.off('sosResolved', onSosResolved);
      socket.disconnect();
    };
  }, [user]);

  const markRead = (id) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  };
  const markAllRead = () => setItems((current) => current.map((item) => ({ ...item, read: true })));
  return { items, unreadCount: items.filter((item) => !item.read).length, markRead, markAllRead };
}

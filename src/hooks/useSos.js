import { useCallback, useEffect, useState } from 'react';
import { initialSos } from '../data/demoData.js';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getApiError } from '../services/api.js';
import { connectRealtime } from '../services/realtime.js';
import { readStored, writeStored } from '../services/storage.js';

const emergencyTypes = {
  Medical: 'medical',
  Fire: 'fire',
  Accident: 'accident',
  'Personal Safety': 'personal_safety',
  'Other Emergency': 'other',
};

function mergeRequest(current, incoming, activeOnly = false) {
  const id = incoming.sosId || incoming.id;
  if (activeOnly && incoming.status === 'Resolved') {
    return current.filter((request) => (request.sosId || request.id) !== id);
  }
  return [incoming, ...current.filter((request) => (request.sosId || request.id) !== id)];
}

export default function useSos({ activeOnly = false } = {}) {
  const { user } = useAuth();
  const [requests, setRequests] = useState(() => readStored('resq-sos', initialSos));
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) {
      setRequests(readStored('resq-sos', initialSos));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(activeOnly ? '/sos/active' : '/sos');
      setRequests(data.data.sos);
      setError('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [activeOnly, user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return undefined;
    const socket = connectRealtime();
    const onCreated = (request) => setRequests((current) => mergeRequest(current, request, activeOnly));
    const onUpdated = (request) => setRequests((current) => mergeRequest(current, request, activeOnly));
    const onAssigned = ({ sos }) => {
      if (sos) setRequests((current) => mergeRequest(current, sos, activeOnly));
    };
    socket.on('sosCreated', onCreated);
    socket.on('sosUpdated', onUpdated);
    socket.on('vehicleAssigned', onAssigned);
    return () => {
      socket.off('sosCreated', onCreated);
      socket.off('sosUpdated', onUpdated);
      socket.off('vehicleAssigned', onAssigned);
      socket.disconnect();
    };
  }, [activeOnly, user]);

  const createRequest = async (type, contactIds = [], details = {}) => {
    if (!user) {
      const request = {
        id: `SOS-${String(Date.now()).slice(-5)}`,
        type: type === 'Other Emergency' ? 'Other' : type,
        priority: type === 'Medical' ? 'Critical' : type === 'Other Emergency' ? 'Medium' : 'High',
        status: type === 'Other Emergency' ? 'Pending' : 'Assigned',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        location: details.locationLabel || 'Selected map location',
        vehicle: type === 'Other Emergency' ? 'Awaiting dispatch' : type === 'Fire' ? 'FIRE-201' : type === 'Personal Safety' ? 'POL-301' : 'AMB-101',
        description: details.description || '',
        reportedFor: details.reportedFor || 'self',
        personName: details.personName || '',
        personRelationship: details.personRelationship || '',
        lat: details.location?.lat,
        lng: details.location?.lng,
        isDemo: true,
      };
      setRequests((current) => {
        const next = [request, ...current];
        writeStored('resq-sos', next);
        return next;
      });
      return request;
    }

    const { data } = await api.post('/sos', {
      emergencyType: emergencyTypes[type],
      description: details.description || '',
      location: details.location,
      locationLabel: details.locationLabel || '',
      reportedFor: details.reportedFor || 'self',
      personName: details.personName || '',
      personRelationship: details.personRelationship || '',
      alertContactIds: contactIds,
    });
    const request = data.data.sos;
    setRequests((current) => mergeRequest(current, request));
    return request;
  };

  return { requests, setRequests, loading, error, refresh, createRequest };
}

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Flame, MapPin, Search, Siren, X } from 'lucide-react';
import { EmergencyModal, FilterTabs, SectionHeading, SOSButton, StatusBadge } from '../components/UI.jsx';
import useContacts from '../hooks/useContacts.js';
import useSos from '../hooks/useSos.js';
import { useAuth } from '../context/AuthContext.jsx';
import useVehicles from '../hooks/useVehicles.js';
import api, { getApiError } from '../services/api.js';

export default function SosPage() {
  const { requests, setRequests, createRequest, error, loading } = useSos();
  const { contacts } = useContacts();
  const { vehicles } = useVehicles();
  const { user } = useAuth();
  const [modal, setModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [actionError, setActionError] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const matchesFilter = (request) => {
    if (filter === 'active') return request.status.toLowerCase() !== 'resolved';
    if (filter === 'critical') return request.priority?.toLowerCase() === 'critical';
    if (filter === 'assigned') return ['assigned', 'responding'].includes(request.status.toLowerCase());
    if (filter === 'resolved') return request.status.toLowerCase() === 'resolved';
    return true;
  };
  const filteredRequests = requests.filter((request) => (
    matchesFilter(request)
    && `${request.id} ${request.type} ${request.location || ''} ${request.vehicle || ''} ${request.status}`.toLowerCase().includes(query.toLowerCase())
  ));
  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId),
    [requests, selectedRequestId],
  );
  const canDispatch = ['admin', 'operator'].includes(user?.role);
  const matchingVehicles = selectedRequest
    ? vehicles.filter((vehicle) => {
      if (vehicle.status !== 'available' || Boolean(vehicle.isDemo) !== Boolean(selectedRequest.isDemo)) return false;
      if (selectedRequest.emergencyType === 'other') return true;
      const suitable = {
        Medical: ['Ambulance'],
        Fire: ['Fire Truck'],
        Accident: ['Ambulance', 'Police Car'],
        'Personal Safety': ['Police Car'],
      };
      return suitable[selectedRequest.type]?.includes(vehicle.type);
    })
    : [];
  const tabs = [
    { value: 'all', label: 'All requests', count: requests.length },
    { value: 'active', label: 'Active', count: requests.filter((request) => request.status.toLowerCase() !== 'resolved').length },
    { value: 'critical', label: 'Critical', count: requests.filter((request) => request.priority?.toLowerCase() === 'critical').length },
    { value: 'assigned', label: 'Assigned', count: requests.filter((request) => ['assigned', 'responding'].includes(request.status.toLowerCase())).length },
    { value: 'resolved', label: 'Resolved', count: requests.filter((request) => request.status.toLowerCase() === 'resolved').length },
  ];
  const resolvedRequests = requests.filter((request) => request.resolvedAt && request.createdAt);
  const averageResponse = resolvedRequests.length
    ? `${Math.round(resolvedRequests.reduce((total, request) => total + (new Date(request.resolvedAt) - new Date(request.createdAt)) / 60000, 0) / resolvedRequests.length)}m`
    : '—';

  const updateRequest = (updated) => {
    setRequests((current) => current.map((request) => request.id === updated.id ? updated : request));
    setSelectedRequestId(updated.id);
  };

  const assignVehicle = async () => {
    if (!selectedRequest || !assignmentId) return;
    setActionError('');
    setSavingAction(true);
    try {
      const { data } = await api.post(`/sos/${encodeURIComponent(selectedRequest.sosId || selectedRequest.id)}/assign`, { vehicleId: assignmentId });
      updateRequest(data.data.sos);
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setSavingAction(false);
    }
  };

  const changeStatus = async (status) => {
    if (!selectedRequest) return;
    setActionError('');
    setSavingAction(true);
    try {
      const { data } = await api.patch(`/sos/${encodeURIComponent(selectedRequest.sosId || selectedRequest.id)}/status`, { status });
      updateRequest(data.data.sos);
    } catch (requestError) {
      setActionError(getApiError(requestError));
    } finally {
      setSavingAction(false);
    }
  };

  return <><SectionHeading eyebrow="INCIDENT RESPONSE" title="Emergency SOS" description="Create and review AlertX requests. This workspace cannot call or dispatch real emergency services." action={<SOSButton compact onClick={() => setModal(true)} />} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="sos-hero panel"><div className="sos-hero-glow" /><div className="sos-hero-copy"><span className="eyebrow danger-text"><i className="live-dot danger-dot" /> SOS REQUEST CENTER</span><h2>Request help and<br />track the response.</h2><p>Submit an incident record with a location you choose to share. AlertX will show only assignments and contact-alert statuses confirmed by the service.</p><SOSButton onClick={() => setModal(true)} /><small><AlertTriangle size={13} /> If there is immediate danger, call local emergency services directly.</small></div><div className="sos-hero-orbit"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><Siren size={32} /></div><span className="orbit-signal s1" /><span className="orbit-signal s2" /><span className="orbit-signal s3" /></div></section>
    <div className="sos-summary-row"><div className="panel summary-chip"><span className="summary-icon red"><Siren size={17} /></span><span><small>Open requests</small><strong>{requests.filter((request) => request.status.toLowerCase() !== 'resolved').length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon orange"><AlertTriangle size={17} /></span><span><small>Critical priority</small><strong>{requests.filter((request) => request.priority?.toLowerCase() === 'critical').length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon blue"><Clock3 size={17} /></span><span><small>Avg. resolution time</small><strong>{averageResponse}</strong></span></div></div>
    <FilterTabs tabs={tabs} value={filter} onChange={setFilter} label="Filter SOS requests" />
    <section className="panel sos-table-panel"><div className="panel-heading"><div><h2>Emergency requests</h2><p>{loading ? 'Loading requests…' : `${filteredRequests.length} of ${requests.length} requests shown`}</p></div><div className="search-field table-search"><Search size={15} /><input placeholder="Search ID, type, status..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Request</th><th>Incident</th><th>Location</th><th>Priority</th><th>Assigned unit</th><th>Status</th><th>Time</th><th>Details</th></tr></thead><tbody>{filteredRequests.map((request) => <tr key={request.id}><td><strong className="table-id">{request.id}</strong></td><td><span className="incident-cell-icon">{request.type === 'Fire' ? <Flame size={15} /> : <Siren size={15} />}</span>{request.type}</td><td><span className="table-location"><MapPin size={13} />{request.location || 'Location unavailable'}</span></td><td><StatusBadge tone={request.priority?.toLowerCase()}>{request.priority}</StatusBadge></td><td>{request.assignedVehicle || (request.vehicle !== 'Awaiting dispatch' ? request.vehicle : 'Not assigned')}</td><td><StatusBadge>{request.status}</StatusBadge></td><td className="muted">{request.time}</td><td><button className="button secondary table-action" onClick={() => { setSelectedRequestId(request.id); setAssignmentId(''); setActionError(''); }}>View</button></td></tr>)}</tbody></table>{!loading && filteredRequests.length === 0 && <p className="empty-table">No requests match this filter.</p>}</div><div className="table-note">Simulated records are labeled by their source. A displayed assignment is not a real-world dispatch.</div></section>
    {selectedRequest && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelectedRequestId('')}><section className="modal-card sos-details-modal" role="dialog" aria-modal="true" aria-labelledby="request-detail-title"><button className="icon-button modal-close" onClick={() => setSelectedRequestId('')} aria-label="Close request details"><X size={18} /></button><span className="eyebrow">REQUEST DETAILS</span><h2 id="request-detail-title">{selectedRequest.sosId || selectedRequest.id}</h2><div className="sos-detail-summary"><span>{selectedRequest.type} · {selectedRequest.priority} priority</span><StatusBadge>{selectedRequest.status}</StatusBadge></div><dl className="sos-detail-grid"><div><dt>Location</dt><dd>{selectedRequest.location || 'Unavailable'}</dd></div><div><dt>Coordinates</dt><dd>{Number.isFinite(selectedRequest.lat) && Number.isFinite(selectedRequest.lng) ? `${selectedRequest.lat.toFixed(5)}, ${selectedRequest.lng.toFixed(5)}` : 'Unavailable'}</dd></div><div><dt>Assigned unit</dt><dd>{selectedRequest.assignedVehicle || (selectedRequest.vehicle !== 'Awaiting dispatch' ? selectedRequest.vehicle : 'Not assigned')}</dd></div><div><dt>Record source</dt><dd>{selectedRequest.isDemo ? 'Simulated' : 'Reported'}</dd></div></dl>{selectedRequest.description && <p className="sos-description-detail">{selectedRequest.description}</p>}{selectedRequest.alertContacts?.length > 0 && <p className="muted small">Contact alert records: {selectedRequest.alertContacts.map((item) => item.status.replaceAll('_', ' ')).join(', ')}</p>}{actionError && <p className="form-error" role="alert">{actionError}</p>}{canDispatch && selectedRequest.status.toLowerCase() === 'pending' && !selectedRequest.assignedVehicle && <div className="sos-assignment-control"><label>Assign available unit<select value={assignmentId} onChange={(event) => setAssignmentId(event.target.value)}><option value="">Select an eligible unit</option>{matchingVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.id} · {vehicle.type}</option>)}</select></label><button className="button primary" disabled={!assignmentId || savingAction} onClick={assignVehicle}>{savingAction ? 'Assigning…' : 'Assign unit'}</button>{matchingVehicles.length === 0 && <small className="muted">No eligible available units were returned for this request.</small>}</div>}{['admin', 'operator', 'driver'].includes(user?.role) && selectedRequest.status.toLowerCase() !== 'resolved' && <div className="sos-detail-actions">{selectedRequest.status.toLowerCase() === 'assigned' && <button className="button secondary" disabled={savingAction} onClick={() => changeStatus('responding')}>Mark responding</button>}<button className="button danger" disabled={savingAction} onClick={() => changeStatus('resolved')}>{savingAction ? 'Updating…' : 'Resolve request'}</button></div>}<p className="sos-success-disclaimer">Status and assignments are saved only after the AlertX API confirms the change. Simulated resources are not dispatched in the real world.</p></section></div>}
    {modal && <EmergencyModal contacts={contacts} allowSimulatedLocation={!user} onClose={() => setModal(false)} onSubmit={createRequest} />}
  </>;
}

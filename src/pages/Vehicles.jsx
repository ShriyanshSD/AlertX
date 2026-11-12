import { useState } from 'react';
import { Ambulance, ArrowUpRight, Pencil, Plus, Search, Shield, Truck, X } from 'lucide-react';
import { FilterTabs, SectionHeading, StatusBadge } from '../components/UI.jsx';
import useVehicles from '../hooks/useVehicles.js';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getApiError } from '../services/api.js';

const vehicleTypes = ['Ambulance', 'Fire Truck', 'Police Car'];
const apiVehicleTypes = { Ambulance: 'ambulance', 'Fire Truck': 'fire_truck', 'Police Car': 'police' };
const initialForm = { type: 'Ambulance', id: '' };
export default function Vehicles() {
  const { vehicles, setVehicles, backend, error: vehicleError } = useVehicles();
  const { user } = useAuth();
  const canManage = !backend || ['admin', 'operator'].includes(user?.role);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [editForm, setEditForm] = useState({ type: 'Ambulance', driverName: '' });
  const [pageError, setPageError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const matchesStatus = (vehicle, filter) => {
    if (filter === 'available' || filter === 'en_route' || filter === 'offline') return vehicle.status === filter;
    if (filter === 'busy') return ['responding', 'patrolling'].includes(vehicle.status);
    return true;
  };
  const filtered = vehicles.filter((vehicle) => (
    (vehicle.id.toLowerCase().includes(query.toLowerCase()) || vehicle.type.toLowerCase().includes(query.toLowerCase()))
    && matchesStatus(vehicle, statusFilter)
  ));
  const statusTabs = [
    { value: 'all', label: 'All vehicles', count: vehicles.length },
    { value: 'available', label: 'Available', count: vehicles.filter((vehicle) => vehicle.status === 'available').length },
    { value: 'en_route', label: 'En route', count: vehicles.filter((vehicle) => vehicle.status === 'en_route').length },
    { value: 'busy', label: 'Busy', count: vehicles.filter((vehicle) => ['responding', 'patrolling'].includes(vehicle.status)).length },
    { value: 'offline', label: 'Offline', count: vehicles.filter((vehicle) => vehicle.status === 'offline').length },
  ];
  const setStatus = async (id, status) => {
    setPageError('');
    try {
      if (backend) {
        const { data } = await api.patch(`/vehicles/${encodeURIComponent(id)}/status`, { status });
        const changed = { ...data.data.vehicle, id: data.data.vehicle.vehicleId, type: vehicleTypes.find((type) => apiVehicleTypes[type] === data.data.vehicle.type) };
        setVehicles((current) => current.map((vehicle) => vehicle.id === id ? { ...vehicle, ...changed } : vehicle));
      } else {
        setVehicles((current) => current.map((vehicle) => vehicle.id === id ? { ...vehicle, status, speed: status === 'available' || status === 'offline' ? 0 : vehicle.speed || 25 } : vehicle));
      }
    } catch (requestError) {
      setPageError(getApiError(requestError));
    }
  };
  const remove = async (id) => {
    if (!window.confirm(`Remove ${id} from this fleet? This removes its AlertX vehicle record.`)) return;
    setPageError('');
    try {
      if (backend) await api.delete(`/vehicles/${encodeURIComponent(id)}`);
      setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    } catch (requestError) {
      setPageError(getApiError(requestError));
    }
  };

  const editVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setEditForm({
      type: vehicleTypes.includes(vehicle.type) ? vehicle.type : 'Ambulance',
      driverName: vehicle.driverName || vehicle.crew || '',
    });
    setPageError('');
  };

  const saveVehicleDetails = async (event) => {
    event.preventDefault();
    if (!editingVehicle) return;
    setPageError('');
    try {
      if (backend) {
        const { data } = await api.patch(`/vehicles/${encodeURIComponent(editingVehicle.id)}`, {
          type: apiVehicleTypes[editForm.type],
          driverName: editForm.driverName.trim(),
        });
        const changed = {
          ...data.data.vehicle,
          id: data.data.vehicle.vehicleId,
          type: vehicleTypes.find((type) => apiVehicleTypes[type] === data.data.vehicle.type),
          crew: data.data.vehicle.driverName || 'Unassigned',
        };
        setVehicles((current) => current.map((vehicle) => vehicle.id === editingVehicle.id ? { ...vehicle, ...changed } : vehicle));
      } else {
        setVehicles((current) => current.map((vehicle) => vehicle.id === editingVehicle.id
          ? { ...vehicle, type: editForm.type, crew: editForm.driverName || 'Unassigned' }
          : vehicle));
      }
      setEditingVehicle(null);
    } catch (requestError) {
      setPageError(getApiError(requestError));
    }
  };
  const addVehicle = async (event) => {
    event.preventDefault();
    if (vehicles.some((vehicle) => vehicle.id.toLowerCase() === form.id.trim().toLowerCase())) {
      window.alert('That vehicle ID already exists.');
      return;
    }
    setPageError('');
    try {
      let newVehicle;
      if (backend) {
        const { data } = await api.post('/vehicles', {
          vehicleId: form.id.trim().toUpperCase(),
          type: apiVehicleTypes[form.type],
          location: { lat: 28.671 + Math.random() * 0.006, lng: 77.45 + Math.random() * 0.006 },
        });
        const serverVehicle = data.data.vehicle;
        newVehicle = { ...serverVehicle, id: serverVehicle.vehicleId, type: form.type, crew: serverVehicle.driverName || 'Unassigned', eta: '—' };
      } else {
          newVehicle = { id: form.id.trim().toUpperCase(), type: form.type, status: 'available', lat: 28.671 + Math.random() * 0.006, lng: 77.45 + Math.random() * 0.006, speed: 0, heading: 0, crew: 'Unassigned', eta: '—', isDemo: true };
      }
      setVehicles((current) => [...current, newVehicle]);
      setForm(initialForm);
      setAdding(false);
    } catch (requestError) {
      setPageError(getApiError(requestError));
    }
  };
  return <><SectionHeading eyebrow="FLEET OPERATIONS" title="Vehicle management" description="Review, update, and organize response vehicles." action={canManage && <button className="button primary" onClick={() => setAdding(!adding)}><Plus size={16} /> Add vehicle</button>} />
    {(vehicleError || pageError) && <p className="form-error" role="alert">{pageError || vehicleError}</p>}
    <div className="vehicle-summary"><div className="panel summary-chip"><span className="summary-icon blue"><Ambulance size={17} /></span><span><small>Ambulances</small><strong>{vehicles.filter((item) => item.type === 'Ambulance').length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon orange"><Truck size={17} /></span><span><small>Fire trucks</small><strong>{vehicles.filter((item) => item.type === 'Fire Truck').length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon purple"><Shield size={17} /></span><span><small>Police vehicles</small><strong>{vehicles.filter((item) => item.type === 'Police Car').length}</strong></span></div></div>
    {editingVehicle && <form className="panel add-contact-form" onSubmit={saveVehicleDetails}>
      <div className="panel-heading">
        <div><h2>Edit {editingVehicle.id}</h2><p>Manage its emergency service type and assigned crew label.</p></div>
        <button type="button" className="icon-button" onClick={() => setEditingVehicle(null)} aria-label="Close edit form"><X size={16} /></button>
      </div>
      <div className="form-grid">
        <label>Service type<select value={editForm.type} onChange={(event) => setEditForm({ ...editForm, type: event.target.value })}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label>Driver / crew<input maxLength={100} value={editForm.driverName} onChange={(event) => setEditForm({ ...editForm, driverName: event.target.value })} /></label>
        <button className="button primary" type="submit">Save service details</button>
      </div>
    </form>}
    {adding && <form className="panel add-contact-form" onSubmit={addVehicle}><div className="panel-heading"><div><h2>Add fleet unit</h2><p>Choose a service type and unique vehicle ID</p></div><button type="button" className="icon-button" onClick={() => setAdding(false)} aria-label="Close form"><X size={16} /></button></div><div className="form-grid"><label>Vehicle ID<input required value={form.id} onChange={(event) => setForm({ ...form, id: event.target.value })} placeholder="e.g. AMB-103" /></label><label>Service type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{vehicleTypes.map((type) => <option key={type}>{type}</option>)}</select></label><button className="button primary" type="submit"><Plus size={15} /> Add to fleet</button></div></form>}
    <FilterTabs tabs={statusTabs} value={statusFilter} onChange={setStatusFilter} label="Filter vehicles by status" />
    <section className="panel vehicles-table-panel"><div className="panel-heading"><div><h2>Response fleet</h2><p>{vehicles.length} units · {backend ? 'server-managed fleet' : 'locally simulated status'}</p></div><div className="search-field table-search"><Search size={15} /><input placeholder="Search fleet..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Vehicle</th><th>Type</th><th>Current status</th><th>Crew</th><th>Position</th><th>Speed</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{filtered.map((vehicle) => <tr key={vehicle.id}><td><strong className="table-id">{vehicle.id}</strong></td><td>{vehicle.type}</td><td><select className="table-status-select" value={vehicle.status} disabled={!canManage} onChange={(event) => setStatus(vehicle.id, event.target.value)} aria-label={`Set ${vehicle.id} status`}>{['available', 'en_route', 'responding', 'patrolling', 'offline'].map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</option>)}</select></td><td>{vehicle.crew}</td><td className="muted">{Number.isFinite(vehicle.lat) && Number.isFinite(vehicle.lng) ? `${vehicle.lat.toFixed(4)}, ${vehicle.lng.toFixed(4)}` : 'Unavailable'}</td><td>{vehicle.speed || 0} km/h</td>{canManage && <td>    <button type="button" className="icon-button" disabled={!canManage} onClick={() => editVehicle(vehicle)} aria-label={`Edit ${vehicle.id}`}><Pencil size={15} /></button>
    <button type="button" className="icon-button danger-hover" disabled={!canManage} onClick={() => remove(vehicle.id)} aria-label={`Remove ${vehicle.id}`}><X size={15} /></button></td>}</tr>)}</tbody></table>{filtered.length === 0 && <p className="muted small empty-filter">No vehicles match your filters.</p>}</div></section>
    <p className="privacy-note"><ArrowUpRight size={14} /> Vehicle records are managed in this workspace; AlertX is not connected to real emergency services.</p>
  </>;
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Ambulance, ArrowUpRight, Pause, Play, RotateCcw, Search, Shield, Truck, Users } from 'lucide-react';
import LiveMap, { MapLegend } from '../components/LiveMap.jsx';
import VehicleDetailsPanel from '../components/VehicleDetailsPanel.jsx';
import { FilterTabs, SectionHeading, StatusBadge } from '../components/UI.jsx';
import useVehicles from '../hooks/useVehicles.js';
import useContacts from '../hooks/useContacts.js';
import { useAuth } from '../context/AuthContext.jsx';
import NearbyAssistance from '../components/NearbyAssistance.jsx';

export default function Tracking() {
  const { vehicles, running, enabled, setRunning, speed, setSpeed, reset, backend, error: vehicleError } = useVehicles();
  const { contacts, error: contactError } = useContacts();
  const { user } = useAuth();
  const canControl = !backend || user?.role === 'admin';
  const [query, setQuery] = useState('');
  const [resourceType, setResourceType] = useState('all');
  const [showVehicles, setShowVehicles] = useState(true);
  const [showContacts, setShowContacts] = useState(true);
  const [focus, setFocus] = useState(null);
  const [selectedId, setSelectedId] = useState('AMB-101');
  const searchRef = useRef(null);
  const selected = vehicles.find((vehicle) => vehicle.id === selectedId);
  const filteredVehicles = useMemo(() => vehicles.filter((vehicle) =>
    resourceType !== 'contacts'
      && vehicle.id.toLowerCase().includes(query.toLowerCase())
      && (resourceType === 'all' || vehicle.type === resourceType),
  ), [vehicles, query, resourceType]);
  const filteredContacts = useMemo(() => contacts.filter((contact) => (
    `${contact.name} ${contact.relationship}`.toLowerCase().includes(query.toLowerCase())
  )), [contacts, query]);
  const tabs = [
    { value: 'all', label: 'All resources', count: vehicles.length + contacts.length },
    { value: 'Ambulance', label: 'Ambulances', count: vehicles.filter((vehicle) => vehicle.type === 'Ambulance').length },
    { value: 'Fire Truck', label: 'Fire & rescue', count: vehicles.filter((vehicle) => vehicle.type === 'Fire Truck').length },
    { value: 'Police Car', label: 'Police', count: vehicles.filter((vehicle) => vehicle.type === 'Police Car').length },
    { value: 'contacts', label: 'Emergency contacts', count: contacts.length },
  ];

  useEffect(() => {
    const focusSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  return <><SectionHeading eyebrow="FLEET OPERATIONS" title="Live tracking" description="Monitor response vehicles and trusted contacts across the Ghaziabad coverage area." action={<span className="demo-pill"><i className="live-dot" /> {backend ? 'API FEED' : 'LOCAL SIMULATION'}</span>} />
    {(vehicleError || contactError) && <p className="form-error" role="alert">{vehicleError || contactError}</p>}
    <FilterTabs tabs={tabs} value={resourceType} onChange={setResourceType} label="Filter map resources" />
    <div className="tracking-toolbar panel"><div className="search-field"><Search size={16} /><input ref={searchRef} placeholder={resourceType === 'contacts' ? 'Search contacts...' : 'Search vehicle ID...'} value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>Ctrl K</kbd></div><div className="toolbar-divider" /><label className="toggle-control"><input type="checkbox" checked={showVehicles} onChange={(event) => setShowVehicles(event.target.checked)} /><span className="toggle-track" /><span><Activity size={14} /> Vehicles</span></label><label className="toggle-control"><input type="checkbox" checked={showContacts} onChange={(event) => setShowContacts(event.target.checked)} /><span className="toggle-track" /><span><Users size={14} /> Contacts</span></label></div>
    <div className="tracking-layout"><section className="panel tracking-map-panel"><div className="tracking-map-wrap"><LiveMap vehicles={filteredVehicles} contacts={filteredContacts} showVehicles={showVehicles && resourceType !== 'contacts'} showContacts={showContacts} selectedId={selectedId} onSelectVehicle={(vehicle) => setSelectedId(vehicle.id)} focus={focus} /></div><div className="tracking-map-footer"><MapLegend /><span><i className="live-dot" /> {backend ? 'Server-reported locations' : 'Simulated positions update every 2 sec'}</span></div></section>
      <aside className="tracking-side"><section className="panel simulation-panel"><div className="panel-heading"><div><h2><span className={`live-dot ${running ? '' : 'paused-dot'}`} /> Location feed</h2><p>{backend ? 'API locations; simulated or real source is identified per record' : enabled ? 'All vehicle positions are simulated' : 'Location simulation is disabled in settings'}</p></div><span className={`sim-status ${running ? 'running' : ''}`}>{enabled ? running ? 'RUNNING' : 'PAUSED' : 'DISABLED'}</span></div><div className="sim-controls"><button className={`button ${running ? 'secondary' : 'primary'}`} disabled={!enabled || !canControl} onClick={() => setRunning(!running)}>{running ? <Pause size={15} /> : <Play size={15} />}{running ? 'Pause' : 'Start'}</button><button className="button secondary" disabled={!canControl} onClick={reset}><RotateCcw size={15} />Reset</button></div>{!backend && <div className="speed-control"><span>Simulation speed</span><div>{[0.5, 1, 2].map((value) => <button key={value} className={speed === value ? 'active' : ''} onClick={() => setSpeed(value)}>{value}×</button>)}</div></div>}{backend && !canControl && <small className="muted">Server simulation controls are administrator-only.</small>}</section>
        {resourceType !== 'contacts' && <section className="panel selected-vehicle-panel"><div className="panel-heading"><div><h2>Selected unit</h2><p>Location and status details</p></div><ArrowUpRight size={16} className="muted" /></div><VehicleDetailsPanel vehicle={selected} /></section>}
        <section className="panel fleet-list-panel"><div className="panel-heading"><div><h2>{resourceType === 'contacts' ? 'Emergency contacts' : 'Fleet units'}</h2><p>{resourceType === 'contacts' ? `${filteredContacts.length} contacts visible to you` : `${filteredVehicles.length} vehicles in this view`}</p></div></div><div className="fleet-list">{resourceType === 'contacts' ? filteredContacts.map((contact) => <div key={contact.contactId || contact.id} className="fleet-list-row contact-map-row"><span className="fleet-type-dot green"><Users size={14} /></span><span className="fleet-list-info"><strong>{contact.name}</strong><small>{contact.relationship} · {contact.phone}</small></span></div>) : filteredVehicles.map((vehicle) => <button key={vehicle.id} className={`fleet-list-row ${selectedId === vehicle.id ? 'selected' : ''}`} onClick={() => setSelectedId(vehicle.id)}><span className={`fleet-type-dot ${vehicle.type === 'Ambulance' ? 'blue' : vehicle.type === 'Fire Truck' ? 'orange' : 'purple'}`}>{vehicle.type === 'Ambulance' ? <Ambulance size={14} /> : vehicle.type === 'Fire Truck' ? <Truck size={14} /> : <Shield size={14} />}</span><span className="fleet-list-info"><strong>{vehicle.id}</strong><small>{vehicle.type}</small></span><StatusBadge>{vehicle.status}</StatusBadge></button>)}{(resourceType === 'contacts' ? filteredContacts.length : filteredVehicles.length) === 0 && <p className="muted small empty-filter">No resources match your search.</p>}</div></section>
      </aside></div>
    <NearbyAssistance />
  </>;
}

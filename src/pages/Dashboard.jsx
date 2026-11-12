import { useState } from 'react';
import { Activity, Ambulance, ArrowRight, Clock3, Flame, MapPin, Shield, Siren, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import LiveMap from '../components/LiveMap.jsx';
import { ActivityAreaChart } from '../components/Charts.jsx';
import { DashboardCard, EmergencyModal, NotificationPanel, SectionHeading, SOSButton, StatusBadge } from '../components/UI.jsx';
import { activityData } from '../data/demoData.js';
import useContacts from '../hooks/useContacts.js';
import useNotifications from '../hooks/useNotifications.js';
import useSos from '../hooks/useSos.js';
import useVehicles from '../hooks/useVehicles.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const { user } = useAuth();
  const { vehicles, running, error: vehicleError } = useVehicles();
  const { requests, createRequest, error: sosError } = useSos({ activeOnly: true });
  const { contacts, error: contactError } = useContacts();
  const { items: notifications } = useNotifications();
  const [modal, setModal] = useState(false);
  const available = vehicles.filter((vehicle) => vehicle.type === 'Ambulance' && vehicle.status === 'available').length;
  const activePolice = vehicles.filter((vehicle) => vehicle.type === 'Police Car' && !['available', 'offline'].includes(vehicle.status)).length;
  const errors = [vehicleError, sosError, contactError].filter(Boolean);

  return <><SectionHeading eyebrow={today} title={`${greeting}, ${user?.name?.split(' ')[0] || 'Alex'}`} description="Here’s the latest across your Ghaziabad response network." action={<SOSButton compact onClick={() => setModal(true)} />} />
    {errors.map((error) => <p className="form-error" role="alert" key={error}>{error}</p>)}
    <div className="stat-grid">
      <DashboardCard label="Total ambulances" value={vehicles.filter((item) => item.type === 'Ambulance').length} note="Across the region" icon={Ambulance} tone="blue" />
      <DashboardCard label="Available ambulances" value={available} note="Ready for dispatch" icon={Activity} tone="green" />
      <DashboardCard label="Active fire trucks" value={vehicles.filter((item) => item.type === 'Fire Truck' && !['available', 'offline'].includes(item.status)).length} note="Responding to incidents" icon={Flame} tone="orange" />
      <DashboardCard label="Active police units" value={activePolice} note="On patrol & responding" icon={Shield} tone="purple" />
      <DashboardCard label="Active SOS requests" value={requests.filter((item) => item.status !== 'Resolved').length} note="Needs attention" icon={Siren} tone="red" />
      <DashboardCard label="Trusted contacts" value={contacts.length} note="In your network" icon={Users} tone="teal" />
    </div>
    <div className="dashboard-main-grid"><section className="panel activity-panel"><div className="panel-heading"><div><h2>Emergency activity</h2><p>Response requests across today</p></div><span className="chart-period"><i /> Today</span></div><div className="chart-legend"><span><i className="legend-blue" /> Medical</span><span><i className="legend-red" /> Fire</span><span><i className="legend-green" /> Personal safety</span></div><ActivityAreaChart data={activityData} /></section>
      <section className="panel notifications-panel"><div className="panel-heading"><div><h2>Recent notifications</h2><p>Latest activity in your network</p></div><span className="notification-count">{notifications.length}</span></div><NotificationPanel notifications={notifications} /><Link className="panel-link" to="/history">View activity log <ArrowRight size={14} /></Link></section></div>
    <div className="dashboard-bottom-grid"><section className="panel map-preview-panel"><div className="panel-heading"><div><h2>Live response map</h2><p><span className={`live-dot ${running ? '' : 'paused-dot'}`} /> Ghaziabad region · {running ? 'simulated feed' : 'simulation paused'}</p></div><Link className="panel-link" to="/tracking">Full map <ArrowRight size={14} /></Link></div><div className="dashboard-map"><LiveMap vehicles={vehicles} contacts={contacts} sosRequests={requests} showContacts={false} /></div><div className="map-preview-foot"><span><MapPin size={14} /> Indirapuram · Ghaziabad, UP</span><span><Clock3 size={14} /> {running ? 'Simulated location updates' : 'Simulation paused'}</span></div></section>
      <section className="panel request-panel"><div className="panel-heading"><div><h2>Recent SOS requests</h2><p>Live incident queue</p></div><Link className="panel-link" to="/sos">View all <ArrowRight size={14} /></Link></div><div className="request-list">{requests.slice(0, 4).map((request) => <div className="request-row" key={request.id}><div className={`request-icon ${request.type === 'Fire' ? 'red' : 'blue'}`}>{request.type === 'Fire' ? <Flame size={16} /> : <Siren size={16} />}</div><div className="request-info"><strong>{request.id} <small>· {request.type}</small></strong><span>{request.location || 'Ghaziabad simulated area'}</span></div><div className="request-meta"><StatusBadge>{request.status}</StatusBadge><small>{request.time}</small></div></div>)}</div><Link className="panel-link request-bottom-link" to="/sos">Manage emergency requests <ArrowRight size={14} /></Link></section></div>
    {modal && <EmergencyModal contacts={contacts} allowSimulatedLocation={!user} onClose={() => setModal(false)} onSubmit={createRequest} />}
  </>;
}

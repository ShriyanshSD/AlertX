import { useEffect, useMemo, useState } from 'react';
import { Activity, Ambulance, ArrowRight, ArrowUpRight, Bot, Clock3, Shield, Siren, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActivityBarChart } from '../components/Charts.jsx';
import { DashboardCard, FilterTabs, SectionHeading, StatusBadge } from '../components/UI.jsx';
import { activityData, initialContacts, initialSos } from '../data/demoData.js';
import useContacts from '../hooks/useContacts.js';
import useSos from '../hooks/useSos.js';
import useVehicles from '../hooks/useVehicles.js';
import { useAuth } from '../context/AuthContext.jsx';
import api, { getApiError } from '../services/api.js';
import { readStored } from '../services/storage.js';

const emptyFilters = { from: '', to: '', type: '', priority: '', status: '' };

function breakdownRows(items) {
  return items?.length
    ? items.map((item) => <div className="analytics-breakdown-row" key={item._id}><StatusBadge>{String(item._id).replaceAll('_', ' ')}</StatusBadge><strong>{item.count}</strong></div>)
    : <p className="muted small">No incidents match the selected filters.</p>;
}

export default function Admin() {
  const { user, backendAvailable } = useAuth();
  const { vehicles, error: vehicleError } = useVehicles();
  const { requests } = useSos();
  const { contacts } = useContacts();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const [activeTab, setActiveTab] = useState('overview');
  const isAdmin = !user || user.role === 'admin';
  const sos = user ? requests : readStored('resq-sos', initialSos);
  const localContacts = user ? contacts : readStored('resq-contacts', initialContacts);
  const analyticsQuery = useMemo(() => (
    new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()
  ), [filters]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return undefined;
    let active = true;
    Promise.all([api.get('/admin/dashboard'), api.get('/admin/users')])
      .then(([dashboardResponse, usersResponse]) => {
        if (!active) return;
        setSummary(dashboardResponse.data.data);
        setUsers(usersResponse.data.data.users);
      })
      .catch((requestError) => { if (active) setError(getApiError(requestError)); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return undefined;
    let active = true;
    api.get(`/admin/analytics${analyticsQuery ? `?${analyticsQuery}` : ''}`)
      .then(({ data }) => { if (active) setAnalytics(data.data); })
      .catch((requestError) => { if (active) setError(getApiError(requestError)); });
    return () => { active = false; };
  }, [analyticsQuery, user]);

  if (!isAdmin) {
    return <><SectionHeading eyebrow="OPERATIONS CONTROL" title="Admin dashboard" description="Administrator access is required to view regional data." /><div className="panel"><p className="muted">Your account role does not have permission to access user management or regional analytics.</p><Link className="panel-link" to="/dashboard">Return to overview <ArrowRight size={14} /></Link></div></>;
  }

  const chartData = analytics ? [{
    time: 'Filtered requests',
    medical: analytics.byType.find((item) => item._id === 'medical')?.count || 0,
    fire: analytics.byType.find((item) => item._id === 'fire')?.count || 0,
    safety: analytics.byType.filter((item) => item._id === 'personal_safety' || item._id === 'accident').reduce((total, item) => total + item.count, 0),
  }] : activityData;
  const vehicleCount = summary?.totals.vehicles ?? vehicles.length;
  const availableCount = summary?.totals.availableVehicles ?? vehicles.filter((unit) => unit.status === 'available').length;
  const activeCount = summary?.totals.activeSos ?? sos.filter((item) => item.status !== 'Resolved').length;
  const contactCount = summary?.totals.contacts ?? localContacts.length;
  const totalVehicles = analytics?.vehicleUtilization?.total ?? vehicleCount;
  const busyVehicles = analytics?.vehicleUtilization?.busy ?? 0;
  const filteredSos = sos.filter((item) => {
    const type = String(item.emergencyType || item.type || '').toLowerCase().replaceAll(' ', '_');
    const priority = String(item.priority || '').toLowerCase();
    const status = String(item.status || '').toLowerCase();
    const created = item.createdAt ? new Date(item.createdAt) : null;
    return (!filters.type || type === filters.type)
      && (!filters.priority || priority === filters.priority)
      && (!filters.status || status === filters.status)
      && (!filters.from || (created && created >= new Date(`${filters.from}T00:00:00`)))
      && (!filters.to || (created && created < new Date(`${filters.to}T23:59:59.999`)));
  });

  return <>
    <SectionHeading eyebrow="OPERATIONS CONTROL" title="Admin dashboard" description="A regional view of fleet readiness and response activity." action={<span className="demo-pill">{!user || vehicles.some((vehicle) => vehicle.isDemo) ? 'SIMULATED FEED · GHAZIABAD' : 'REGIONAL FEED · GHAZIABAD'}</span>} />
    {(error || vehicleError) && <p className="form-error" role="alert">{error || vehicleError}</p>}
    <FilterTabs tabs={[
      { value: 'overview', label: 'Overview' },
      { value: 'trends', label: 'Emergency trends' },
      { value: 'vehicles', label: 'Vehicle performance' },
      { value: 'response', label: 'Response statistics' },
    ]} value={activeTab} onChange={setActiveTab} label="Analytics sections" />
    {activeTab === 'overview' && <div className="stat-grid admin-stat-grid">
      <DashboardCard label="Total fleet units" value={vehicleCount} note="Across all service types" icon={Ambulance} tone="blue" />
      <DashboardCard label="Ready for dispatch" value={availableCount} note="Available now" icon={Activity} tone="green" />
      <DashboardCard label="Active incidents" value={activeCount} note="All priority levels" icon={Siren} tone="red" />
      <DashboardCard label="Registered contacts" value={contactCount} note="In the response network" icon={Users} tone="purple" />
    </div>}
    <section className="panel analytics-filter-panel">
      <div className="panel-heading"><div><h2>Emergency analytics filters</h2><p>Filters apply to incident statistics and the recent incident list.</p></div><button className="button secondary" type="button" onClick={() => setFilters(emptyFilters)}>Clear filters</button></div>
      <div className="analytics-filter-grid">
        <label>From<input type="date" value={filters.from} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></label>
        <label>To<input type="date" value={filters.to} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></label>
        <label>Emergency type<select value={filters.type} onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}><option value="">All types</option><option value="medical">Medical</option><option value="fire">Fire</option><option value="accident">Accident</option><option value="personal_safety">Personal safety</option><option value="other">Other</option></select></label>
        <label>Priority<select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}><option value="">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option></select></label>
        <label>Status<select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="pending">Pending</option><option value="assigned">Assigned</option><option value="responding">Responding</option><option value="resolved">Resolved</option></select></label>
      </div>
    </section>
    {user?.role === 'admin' && ['overview', 'response'].includes(activeTab) && <div className="stat-grid admin-ai-grid">
      <DashboardCard label="Vehicle utilization" value={totalVehicles ? `${Math.round((busyVehicles / totalVehicles) * 100)}%` : '0%'} note={`${busyVehicles} of ${totalVehicles} units responding`} icon={Ambulance} tone="orange" />
      <DashboardCard label="AI assistant activity" value={analytics?.aiActivity?.requests || 0} note="Requests · message content not shown" icon={Bot} tone="purple" />
      <DashboardCard label="Emergency-related AI queries" value={analytics?.aiActivity?.emergencyRelated || 0} note="Metadata only; prompts are not included" icon={Shield} tone="red" />
    </div>}
    <div className="admin-content-grid">
      {['overview', 'trends'].includes(activeTab) && <section className="panel activity-panel"><div className="panel-heading"><div><h2>Response activity</h2><p>{analytics ? 'Recorded SOS totals by emergency type' : 'Simulated request volume'}</p></div><span className="chart-period"><i /> {analytics ? 'Filtered results' : 'Today'}</span></div><ActivityBarChart data={chartData} /></section>}
      {['overview', 'vehicles'].includes(activeTab) && <section className="panel readiness-panel"><div className="panel-heading"><div><h2>Fleet readiness</h2><p>Current simulated or reported status</p></div><Link to="/vehicles" className="icon-button" aria-label="Manage vehicles"><ArrowUpRight size={16} /></Link></div>{vehicles.map((vehicle) => <div className="readiness-row" key={vehicle.id}><span className={`readiness-symbol ${vehicle.type === 'Ambulance' ? 'blue' : vehicle.type === 'Fire Truck' ? 'orange' : 'purple'}`}>{vehicle.type === 'Ambulance' ? <Ambulance size={15} /> : vehicle.type === 'Fire Truck' ? <span>▲</span> : <Shield size={15} />}</span><span className="readiness-name"><strong>{vehicle.id}</strong><small>{vehicle.type}</small></span><StatusBadge>{vehicle.status}</StatusBadge></div>)}{vehicles.length === 0 && <p className="muted small">No vehicles are visible to this account.</p>}<Link to="/vehicles" className="panel-link">Open vehicle management <ArrowRight size={14} /></Link></section>}
    </div>
    {['trends', 'response'].includes(activeTab) && <section className="admin-breakdown-grid">
      {activeTab === 'trends' && <div className="panel admin-breakdown-panel"><div className="panel-heading"><div><h2>Emergency category</h2><p>Filtered incident counts</p></div></div>{breakdownRows(analytics?.byType)}</div>}
      <div className="panel admin-breakdown-panel"><div className="panel-heading"><div><h2>Emergency priority distribution</h2><p>Filtered incident counts</p></div></div>{breakdownRows(analytics?.byPriority)}</div>
      <div className="panel admin-breakdown-panel"><div className="panel-heading"><div><h2>Response status</h2><p>Filtered incident counts</p></div></div>{breakdownRows(analytics?.byStatus)}</div>
    </section>}
    {['overview', 'response'].includes(activeTab) && <section className="panel admin-sos-preview"><div className="panel-heading"><div><h2>Latest incident requests</h2><p>Recent records · source shown where available</p></div><Link to="/history" className="panel-link">View history <ArrowRight size={14} /></Link></div><div className="admin-sos-list">{filteredSos.slice(0, 5).map((item) => <div className="admin-sos-item" key={item.sosId || item.id}><span className="admin-sos-icon"><Siren size={15} /></span><span><strong>{item.sosId || item.id} · {item.type}</strong><small>{item.location || 'Location unavailable'} · {item.isDemo ? 'Simulated record' : 'Reported record'}</small></span><StatusBadge tone={item.priority?.toLowerCase()}>{item.priority}</StatusBadge><small className="muted"><Clock3 size={12} /> {item.time}</small></div>)}{filteredSos.length === 0 && <p className="muted small">No incidents match the selected filters.</p>}</div></section>}
    {user?.role === 'admin' && activeTab === 'response' && <section className="panel vehicles-table-panel"><div className="panel-heading"><div><h2>Registered users</h2><p>{summary?.totals.users ?? users.length} accounts · password data is never displayed</p></div><span className="demo-pill">ADMIN ONLY</span></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead><tbody>{users.map((account) => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td><td><StatusBadge>{account.role}</StatusBadge></td><td>{new Date(account.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></section>}
    {backendAvailable && user?.role === 'admin' && <p className="privacy-note"><ArrowUpRight size={14} /> AI metrics contain request counts and categories only, not prompt text. Straight-line distance is not an ETA.</p>}
  </>;
}

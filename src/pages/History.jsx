import { useMemo, useState } from 'react';
import { Check, Download, Filter, Siren } from 'lucide-react';
import { SectionHeading, StatusBadge } from '../components/UI.jsx';
import useSos from '../hooks/useSos.js';

export default function History() {
  const { requests, error, loading } = useSos();
  const [filter, setFilter] = useState('All incidents');
  const [exported, setExported] = useState(false);
  const filtered = useMemo(() => requests.filter((request) => filter === 'All incidents' || request.type === filter), [requests, filter]);
  const exportCsv = () => {
    const header = ['ID', 'Type', 'Priority', 'Status', 'Location', 'Vehicle', 'Time'];
    const rows = filtered.map((item) => [item.id, item.type, item.priority, item.status, item.location || 'Location unavailable', item.vehicle, item.time]);
    const csv = [header, ...rows].map((row) => row.map((field) => `"${String(field ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'resq-emergency-history.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExported(true);
    window.setTimeout(() => setExported(false), 2500);
  };
  return <><SectionHeading eyebrow="NETWORK ACTIVITY" title="Emergency history" description="Browse and export emergency requests available to your account." action={<button className={`button ${exported ? 'exported' : 'secondary'}`} onClick={exportCsv}>{exported ? <Check size={16} /> : <Download size={16} />}{exported ? 'CSV ready' : 'Export CSV'}</button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="history-summary"><div className="panel summary-chip"><span className="summary-icon red"><Siren size={17} /></span><span><small>Total alerts</small><strong>{requests.length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon orange"><Filter size={17} /></span><span><small>Critical priority</small><strong>{requests.filter((request) => request.priority?.toLowerCase() === 'critical').length}</strong></span></div><div className="panel summary-chip"><span className="summary-icon blue"><Siren size={17} /></span><span><small>Currently open</small><strong>{requests.filter((request) => request.status !== 'Resolved').length}</strong></span></div></div>
    <section className="panel history-panel"><div className="panel-heading"><div><h2>Incident log</h2><p>{loading ? 'Loading records…' : `${filtered.length} records shown`}</p></div><label className="filter-control"><Filter size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter incidents"><option>All incidents</option>{['Medical', 'Fire', 'Accident', 'Personal Safety', 'Other'].map((type) => <option key={type}>{type}</option>)}</select></label></div><div className="table-scroll"><table className="data-table"><thead><tr><th>Incident ID</th><th>Type</th><th>Priority</th><th>Location</th><th>Assigned unit</th><th>Status</th><th>Reported</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong className="table-id">{item.id}</strong></td><td>{item.type}</td><td><StatusBadge tone={item.priority?.toLowerCase()}>{item.priority}</StatusBadge></td><td>{item.location || 'Location unavailable'}</td><td>{item.assignedVehicle || item.vehicle}</td><td><StatusBadge>{item.status}</StatusBadge></td><td className="muted">{item.time}</td></tr>)}</tbody></table>{!loading && filtered.length === 0 && <div className="empty-table">No incidents match this filter.</div>}</div><div className="table-note">Only requests visible to your account are listed. Simulated records are not real emergencies or dispatches.</div></section>
  </>;
}

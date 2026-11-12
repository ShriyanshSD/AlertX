import { useState } from 'react';
import { AlertTriangle, Ambulance, Bell, Check, ChevronRight, Clock3, Flame, LocateFixed, MapPin, Menu, Plus, Shield, X } from 'lucide-react';

export function StatusBadge({ children, tone }) {
  const raw = String(children);
  const value = tone || raw.toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
  const label = raw.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  return <span className={`status-badge status-${value}`}>{label}</span>;
}

export function DashboardCard({ label, value, note, icon: Icon, tone = 'blue', trend }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon && <Icon size={19} />}</div>
      <div className="stat-copy">
        <span className="muted small">{label}</span>
        <strong>{value}</strong>
        {note && <span className="stat-note">{trend && <span className="trend">{trend}</span>} {note}</span>}
      </div>
    </article>
  );
}

export function SectionHeading({ eyebrow, title, description, action }) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FilterTabs({ tabs, value, onChange, label }) {
  return <div className="filter-tabs" role="group" aria-label={label}>
    {tabs.map((tab) => <button
      key={tab.value}
      type="button"
      className={`filter-tab ${value === tab.value ? 'active' : ''}`}
      aria-pressed={value === tab.value}
      onClick={() => onChange(tab.value)}
    >
      <span>{tab.label}</span>
      {tab.count !== undefined && <small>{tab.count}</small>}
    </button>)}
  </div>;
}

export function EmptyState({ title = 'Nothing here yet', detail = 'Your updates will appear here.' }) {
  return <div className="empty-state"><div className="empty-icon"><Bell size={20} /></div><strong>{title}</strong><p className="muted">{detail}</p></div>;
}

export function LoadingSpinner({ label = 'Loading' }) {
  return <div className="loading-state"><span className="spinner" />{label}</div>;
}

export function NotificationPanel({ notifications, onRead }) {
  if (!notifications.length) return <div className="notification-empty">No recent notifications.</div>;
  return <div className="notification-list">{notifications.map((item) => (
    <div className={`notification-item ${item.read ? 'read' : 'unread'}`} key={item.id || `${item.title}-${item.time}`}>
      <span className={`notification-dot ${item.tone}`} /><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.time}</small></div>
      {onRead && !item.read && <button className="notification-read" onClick={() => onRead(item.id)} aria-label={`Mark ${item.title} as read`}>Mark read</button>}
    </div>
  ))}</div>;
}

export function ContactCard({ contact, onRemove }) {
  return <article className="contact-card">
    <div className="contact-avatar">{contact.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div>
    <div className="contact-main"><div className="row-between"><strong>{contact.name}</strong><StatusBadge tone={contact.isDemo ? 'blue' : 'green'}>{contact.isDemo ? 'Fictional sample' : 'Trusted'}</StatusBadge></div><p>{contact.relationship} · {contact.phone}</p>{Number.isFinite(contact.lat) && Number.isFinite(contact.lng) && <small>Saved location · {contact.lat.toFixed(4)}, {contact.lng.toFixed(4)}</small>}</div>
    {onRemove && <button className="icon-button danger-hover" aria-label={`Remove ${contact.name}`} onClick={() => onRemove(contact)}><X size={16} /></button>}
  </article>;
}

export function SOSButton({ onClick, compact = false }) {
  return <button className={`sos-button ${compact ? 'compact' : ''}`} onClick={onClick}><span className="sos-pulse"><AlertTriangle size={compact ? 17 : 22} /></span><span>{compact ? 'SOS' : 'SEND EMERGENCY SOS'}</span><ChevronRight size={17} /></button>;
}

const incidentOptions = [
  { value: 'Medical', label: 'Medical emergency', icon: Ambulance, color: 'blue' },
  { value: 'Fire', label: 'Fire emergency', icon: Flame, color: 'orange' },
  { value: 'Accident', label: 'Road accident', icon: AlertTriangle, color: 'red' },
  { value: 'Personal Safety', label: 'Personal safety', icon: Shield, color: 'green' },
  { value: 'Other Emergency', label: 'Other emergency', icon: AlertTriangle, color: 'purple' },
];

export function EmergencyModal({ onClose, onSubmit, contacts = [], allowSimulatedLocation = false }) {
  const [selected, setSelected] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [locationSource, setLocationSource] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location sharing is not supported by this browser.');
      return;
    }
    setLocationError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocationSource('shared');
      setLocating(false);
    }, (locationRequestError) => {
      setLocationError(locationRequestError.code === 1
        ? 'Location permission was denied. Allow location access in your browser and retry.'
        : 'Could not determine your location. Check your connection or retry.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const useSimulatedLocation = () => {
    setLocation({ lat: 28.6702, lng: 77.4524 });
    setLocationSource('simulated');
    setLocationError('');
  };
  const submit = async () => {
    if (!selected || !location) return;
    setSubmitting(true);
    setError('');
    try {
      setSubmitted(await onSubmit(selected, selectedContacts, { description: description.trim(), location, locationSource }));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || requestError.message || 'The emergency request could not be created.');
    } finally {
      setSubmitting(false);
    }
  };
  const locationLabel = location
    ? `${locationSource === 'simulated' ? 'Simulated Ghaziabad location' : 'Shared current location'} · ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : 'Location not selected';
  const contactAlertLabel = submitted?.alertContacts?.length
    ? submitted.alertContacts.every((item) => item.status === 'consent_required')
      ? 'Consent required; no alert delivered'
      : 'In-app alert status confirmed by AlertX'
    : 'No trusted-contact alerts were confirmed';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="sos-title">
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
      {!submitted ? <>
        <span className="eyebrow danger-text">EMERGENCY REQUEST</span>
        <h2 id="sos-title">{confirming ? 'Review and confirm' : 'What do you need help with?'}</h2>
        {confirming ? <><div className="confirm-box"><AlertTriangle size={20} /><span>This submits an AlertX request for <strong>{selected}</strong>. It does not call emergency services or guarantee dispatch.</span></div><div className="sos-confirm-details"><p><MapPin size={14} />{locationLabel}</p>{description && <p>{description}</p>}{selectedContacts.length > 0 && <p>{selectedContacts.length} trusted contact{selectedContacts.length === 1 ? '' : 's'} selected; delivery status will be shown only if AlertX confirms it.</p>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setConfirming(false)} disabled={submitting}>Go back</button><button className="button danger" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Confirm request'}</button></div></> : <>
          <div className="incident-options">{incidentOptions.map(({ value, label, icon: Icon, color }) => <button key={value} type="button" className={`incident-option ${selected === value ? 'selected' : ''}`} aria-pressed={selected === value} onClick={() => setSelected(value)}><span className={`stat-icon ${color}`}><Icon size={19} /></span><strong>{label}</strong><span className="radio-dot">{selected === value && <Check size={12} />}</span></button>)}</div>
          <label className="sos-description-label">Brief description <textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Share any useful details (optional)" /></label>
          <div className="sos-location-box"><div><strong>Request location</strong><small>{locationLabel}</small></div><button className="button secondary" type="button" onClick={requestLocation} disabled={locating}>{locating ? 'Locating…' : <><LocateFixed size={14} /> Share location</>}</button></div>
          {allowSimulatedLocation && !location && <button className="use-simulated-location" type="button" onClick={useSimulatedLocation}>Use the simulated Ghaziabad location instead</button>}
          {locationError && <p className="form-error" role="alert">{locationError}</p>}
          {contacts.length > 0 && <fieldset className="sos-contact-selection"><legend>Trusted contacts</legend>{contacts.map((contact) => <label key={contact.contactId || contact.id}><input type="checkbox" checked={selectedContacts.includes(contact.contactId || contact.id)} onChange={(event) => setSelectedContacts((current) => event.target.checked ? [...current, contact.contactId || contact.id] : current.filter((id) => id !== (contact.contactId || contact.id)))} /><span>{contact.name}<small>{contact.notificationConsent ? 'Consent recorded' : 'Consent not recorded'}</small></span></label>)}<small>Only in-app alert records are supported; no SMS or email is sent.</small></fieldset>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-foot"><small>No real emergency services are contacted.</small><button className="button danger" disabled={!selected || !location} onClick={() => setConfirming(true)}>Review request <ChevronRight size={16} /></button></div>
        </>}
      </> : <div className="success-state"><div className="success-check"><Check size={26} /></div><span className="eyebrow">REQUEST RECORDED</span><h2>{submitted.sosId || submitted.id}</h2><p>{submitted.type} · {String(submitted.priority).replace(/\b\w/g, (letter) => letter.toUpperCase())} priority</p><div className="confirm-box"><Clock3 size={18} /><span>Status: <strong>{submitted.status}</strong><br />Assigned unit: <strong>{submitted.assignedVehicle || (submitted.vehicle !== 'Awaiting dispatch' ? submitted.vehicle : '') || 'Not assigned'}</strong><br />Contact alert: <strong>{contactAlertLabel}</strong></span></div><p className="sos-success-disclaimer">This request is not a call to emergency services. If you are in immediate danger, call your local emergency number directly.</p><button className="button primary full" onClick={onClose}>Done</button></div>}
    </div>
  </div>;
}

export function MobileMenuButton({ onClick }) {
  return <button className="icon-button mobile-menu-button" onClick={onClick} aria-label="Open navigation"><Menu size={19} /></button>;
}

export function AddButton({ children = 'Add new', onClick }) {
  return <button className="button primary" onClick={onClick}><Plus size={16} />{children}</button>;
}

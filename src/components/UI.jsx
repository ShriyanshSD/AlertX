import { useState } from 'react';
import { AlertTriangle, Ambulance, Bell, Check, ChevronRight, Clock3, Flame, LocateFixed, MapPin, Menu, Plus, Shield, UserRound, X } from 'lucide-react';
import SOSLocationPicker from './SOSLocationPicker.jsx';

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
  const [requestFor, setRequestFor] = useState('self');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [personName, setPersonName] = useState('');
  const [personRelationship, setPersonRelationship] = useState('');
  const [location, setLocation] = useState(null);
  const [locationDescription, setLocationDescription] = useState('');
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
      setLocationSource('current');
      setLocating(false);
    }, (locationRequestError) => {
      setLocationError(locationRequestError.code === 1
        ? 'Location permission was denied. Allow location access in your browser and retry.'
        : 'Could not determine your location. Check your connection or retry.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const selectMapLocation = (point) => {
    setLocation(point);
    setLocationSource('manual');
    setLocationError('');
  };
  const selectPerson = (contactId) => {
    setSelectedContactId(contactId);
    const contact = contacts.find((item) => (item.contactId || item.id) === contactId);
    setPersonName(contact?.name || '');
    setPersonRelationship(contact?.relationship || '');
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
      setSubmitted(await onSubmit(selected, selectedContacts, {
        description: description.trim(),
        location,
        locationSource,
        locationLabel: locationDescription.trim() || (locationSource === 'manual' ? 'Selected map location' : locationSource === 'current' ? 'Current device location' : 'Simulated Ghaziabad location'),
        reportedFor: requestFor,
        personName: requestFor === 'other' ? personName.trim() : '',
        personRelationship: requestFor === 'other' ? personRelationship.trim() : '',
      }));
    } catch (requestError) {
      setError(requestError.response?.data?.error?.message || requestError.message || 'The emergency request could not be created.');
    } finally {
      setSubmitting(false);
    }
  };
  const locationLabel = location
    ? `${locationSource === 'simulated' ? 'Simulated Ghaziabad location' : locationSource === 'current' ? 'Current device location' : 'Pinned map location'}${locationDescription.trim() ? ` · ${locationDescription.trim()}` : ''} · ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
    : 'Location not selected';
  const canReview = Boolean(selected && location && (requestFor === 'self' || personName.trim().length >= 2));
  const contactAlertLabel = submitted?.alertContacts?.length
    ? submitted.alertContacts.every((item) => item.status === 'consent_required')
      ? 'Consent required; no alert delivered'
      : 'In-app alert status confirmed by AlertX'
    : 'No trusted-contact alerts were confirmed';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal-card sos-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title">
      <button className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
      {!submitted ? <>
        <span className="eyebrow danger-text">EMERGENCY REQUEST</span>
        <h2 id="sos-title">{confirming ? 'Review and confirm' : 'What do you need help with?'}</h2>
        {confirming ? <><div className="confirm-box"><AlertTriangle size={20} /><span>This submits an AlertX <strong>{selected}</strong> request {requestFor === 'other' ? <>for <strong>{personName}</strong>{personRelationship ? ` (${personRelationship})` : ''}</> : 'for you'}. It does not call emergency services or guarantee dispatch.</span></div><div className="sos-confirm-details"><p><MapPin size={14} />{locationLabel}</p>{description && <p>{description}</p>}{selectedContacts.length > 0 && <p>{selectedContacts.length} trusted contact{selectedContacts.length === 1 ? '' : 's'} selected; delivery status will be shown only if AlertX confirms it.</p>}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" onClick={() => setConfirming(false)} disabled={submitting}>Go back</button><button className="button danger" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Confirm request'}</button></div></> : <>
          <fieldset className="sos-request-for"><legend>Who needs help?</legend><label><input type="radio" name="sos-request-for" value="self" checked={requestFor === 'self'} onChange={() => setRequestFor('self')} /><UserRound size={14} /> Myself</label><label><input type="radio" name="sos-request-for" value="other" checked={requestFor === 'other'} onChange={() => setRequestFor('other')} />A friend or relative</label></fieldset>
          {requestFor === 'other' && <div className="sos-person-fields">{contacts.length > 0 && <label>Choose a saved contact<select value={selectedContactId} onChange={(event) => selectPerson(event.target.value)}><option value="">Someone not saved / enter details</option>{contacts.map((contact) => <option key={contact.contactId || contact.id} value={contact.contactId || contact.id}>{contact.name} · {contact.relationship}</option>)}</select></label>}<label>Person’s name<input value={personName} onChange={(event) => setPersonName(event.target.value)} maxLength={100} placeholder="Name of the person needing help" /></label><label>Relationship<input value={personRelationship} onChange={(event) => setPersonRelationship(event.target.value)} maxLength={50} placeholder="Friend, parent, sibling…" /></label><small>For a saved contact, verify the pin shows that person’s location before submitting.</small></div>}
          <strong className="sos-service-label">Select emergency service or incident type</strong>
          <div className="incident-options">{incidentOptions.map(({ value, label, icon: Icon, color }) => <button key={value} type="button" className={`incident-option ${selected === value ? 'selected' : ''}`} aria-pressed={selected === value} onClick={() => setSelected(value)}><span className={`stat-icon ${color}`}><Icon size={19} /></span><strong>{label}</strong><span className="radio-dot">{selected === value && <Check size={12} />}</span></button>)}</div>
          <label className="sos-description-label">Brief description <textarea maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Share any useful details (optional)" /></label>
          <div className="sos-location-box"><div><strong>Request location</strong><small>{locationLabel}</small></div><button className="button secondary" type="button" onClick={requestLocation} disabled={locating}>{locating ? 'Locating…' : <><LocateFixed size={14} /> Use my current location</>}</button></div>
          {allowSimulatedLocation && !location && <button className="use-simulated-location" type="button" onClick={useSimulatedLocation}>Use the simulated Ghaziabad location instead</button>}
          {locationError && <p className="form-error" role="alert">{locationError}</p>}
          <SOSLocationPicker location={location} onChange={selectMapLocation} />
          {requestFor === 'other' && <p className="sos-location-guidance">Your device location is not necessarily the other person’s location. Move the map pin to where they need help.</p>}
          <label className="sos-location-description">Address or landmark (optional)<input value={locationDescription} onChange={(event) => setLocationDescription(event.target.value)} maxLength={120} placeholder="Street, building, or nearby landmark" /></label>
          {contacts.length > 0 && <fieldset className="sos-contact-selection"><legend>Trusted contacts</legend>{contacts.map((contact) => <label key={contact.contactId || contact.id}><input type="checkbox" checked={selectedContacts.includes(contact.contactId || contact.id)} onChange={(event) => setSelectedContacts((current) => event.target.checked ? [...current, contact.contactId || contact.id] : current.filter((id) => id !== (contact.contactId || contact.id)))} /><span>{contact.name}<small>{contact.notificationConsent ? 'Consent recorded' : 'Consent not recorded'}</small></span></label>)}<small>Only in-app alert records are supported; no SMS or email is sent.</small></fieldset>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-foot"><small>No real emergency services are contacted.</small><button className="button danger" disabled={!canReview} onClick={() => setConfirming(true)}>Review request <ChevronRight size={16} /></button></div>
        </>}
      </> : <div className="success-state"><div className="success-check"><Check size={26} /></div><span className="eyebrow">REQUEST RECORDED</span><h2>{submitted.sosId || submitted.id}</h2><p>{submitted.type} · {String(submitted.priority).replace(/\b\w/g, (letter) => letter.toUpperCase())} priority{submitted.reportedFor === 'other' ? ` · For ${submitted.personName}` : ''}</p><div className="confirm-box"><Clock3 size={18} /><span>Status: <strong>{submitted.status}</strong><br />Assigned unit: <strong>{submitted.assignedVehicle || (submitted.vehicle !== 'Awaiting dispatch' ? submitted.vehicle : '') || 'Not assigned'}</strong><br />Contact alert: <strong>{contactAlertLabel}</strong></span></div><p className="sos-success-disclaimer">This request is not a call to emergency services. If you are in immediate danger, call your local emergency number directly.</p><button className="button primary full" onClick={onClose}>Done</button></div>}
    </div>
  </div>;
}

export function MobileMenuButton({ onClick }) {
  return <button className="icon-button mobile-menu-button" onClick={onClick} aria-label="Open navigation"><Menu size={19} /></button>;
}

export function AddButton({ children = 'Add new', onClick }) {
  return <button className="button primary" onClick={onClick}><Plus size={16} />{children}</button>;
}

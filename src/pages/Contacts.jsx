import { useState } from 'react';
import { MapPin, Plus, Search, ShieldCheck, UserRoundPlus, X } from 'lucide-react';
import { ContactCard, SectionHeading } from '../components/UI.jsx';
import useContacts from '../hooks/useContacts.js';

export default function Contacts() {
  const { contacts, loading, error, addContact, removeContact } = useContacts();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', relationship: '', notificationConsent: false });
  const filtered = contacts.filter((contact) => `${contact.name} ${contact.relationship}`.toLowerCase().includes(query.toLowerCase()));

  const remove = async (contact) => {
    if (!window.confirm('Remove this trusted contact from your list?')) return;
    setPageError('');
    try {
      await removeContact(contact);
    } catch (requestError) {
      setPageError(requestError.response?.data?.error?.message || requestError.message);
    }
  };

  const add = async (event) => {
    event.preventDefault();
    setSaving(true);
    setPageError('');
    try {
      await addContact(form);
      setForm({ name: '', phone: '', relationship: '', notificationConsent: false });
      setAdding(false);
    } catch (requestError) {
      setPageError(requestError.response?.data?.error?.message || requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return <><SectionHeading eyebrow="YOUR NETWORK" title="Trusted contacts" description="Manage the people in your personal response network." action={<button className="button primary" onClick={() => setAdding(!adding)}><UserRoundPlus size={16} /> Add contact</button>} />
    {(error || pageError) && <p className="form-error" role="alert">{pageError || error}</p>}
    <div className="contact-intro panel"><div className="contact-intro-icon"><ShieldCheck size={23} /></div><div><strong>Your trusted circle</strong><p>Precise saved locations are only visible to your account. Alerts are in-app simulation records only; no SMS or email is sent.</p></div><span className="contact-count">{contacts.length} CONTACTS</span></div>
    {adding && <form className="panel add-contact-form" onSubmit={add}><div className="panel-heading"><div><h2>Add trusted contact</h2><p>Enter contact details and record notification consent</p></div><button type="button" className="icon-button" onClick={() => setAdding(false)} aria-label="Cancel adding"><X size={17} /></button></div><div className="form-grid"><label>Full name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contact name" /></label><label>Phone<input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 98765 43210" /></label><label>Relationship<input required value={form.relationship} onChange={(event) => setForm({ ...form, relationship: event.target.value })} placeholder="e.g. Family" /></label><label className="check-label"><input type="checkbox" checked={form.notificationConsent} onChange={(event) => setForm({ ...form, notificationConsent: event.target.checked })} /><span>Consent recorded for in-app simulation alerts</span></label><button className="button primary" type="submit" disabled={saving}><Plus size={15} /> {saving ? 'Saving…' : 'Save contact'}</button></div></form>}
    <div className="contacts-toolbar"><div><h2>People</h2><p className="muted">{contacts.length} trusted contacts</p></div><div className="search-field contact-search"><Search size={16} /><input placeholder="Search contacts..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
    <div className="contacts-grid">{filtered.map((contact) => <ContactCard key={contact.contactId || contact.id} contact={contact} onRemove={remove} />)}{!loading && filtered.length === 0 && <div className="panel no-contacts"><MapPin size={18} /><strong>No contacts found</strong><p>Try a different search or add a new contact.</p></div>}</div>
    {loading && <p className="muted small">Loading contacts…</p>}
    <div className="privacy-note"><ShieldCheck size={15} /> Contact details and optional locations are scoped to your account.</div>
  </>;
}

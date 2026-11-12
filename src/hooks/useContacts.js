import { useCallback, useEffect, useState } from 'react';
import { initialContacts } from '../data/demoData.js';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import { getApiError } from '../services/api.js';
import { readStored, writeStored } from '../services/storage.js';

function contactPayload(contact) {
  return {
    ...contact,
    lat: Number.isFinite(contact.lat) ? contact.lat : undefined,
    lng: Number.isFinite(contact.lng) ? contact.lng : undefined,
  };
}

export default function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState(() => readStored('resq-contacts', initialContacts));
  const [loading, setLoading] = useState(Boolean(user));
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!user) {
      setContacts(readStored('resq-contacts', initialContacts));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/contacts');
      setContacts(data.data.contacts.map(contactPayload));
      setError('');
    } catch (requestError) {
      setError(getApiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addContact = async (contact) => {
    if (!user) {
      const nextContact = { ...contact, id: `C-${String(Date.now()).slice(-5)}` };
      setContacts((current) => {
        const next = [...current, nextContact];
        writeStored('resq-contacts', next);
        return next;
      });
      return nextContact;
    }
    const { data } = await api.post('/contacts', contact);
    const nextContact = contactPayload(data.data.contact);
    setContacts((current) => [...current, nextContact]);
    return nextContact;
  };

  const updateContact = async (contactId, updates) => {
    if (!user) {
      setContacts((current) => {
        const next = current.map((contact) => contact.id === contactId ? { ...contact, ...updates } : contact);
        writeStored('resq-contacts', next);
        return next;
      });
      return;
    }
    const { data } = await api.patch(`/contacts/${contactId}`, updates);
    const updated = contactPayload(data.data.contact);
    setContacts((current) => current.map((contact) => (contact.contactId || contact.id) === contactId ? updated : contact));
  };

  const removeContact = async (contact) => {
    if (!user) {
      setContacts((current) => {
        const next = current.filter((entry) => entry.id !== contact.id);
        writeStored('resq-contacts', next);
        return next;
      });
      return;
    }
    const id = contact.contactId || contact.id;
    await api.delete(`/contacts/${id}`);
    setContacts((current) => current.filter((entry) => (entry.contactId || entry.id) !== id));
  };

  return { contacts, setContacts, loading, error, refresh, addContact, updateContact, removeContact };
}

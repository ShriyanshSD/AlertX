import Contact from '../models/Contact.js';
import EmergencyAlert from '../models/EmergencyAlert.js';
import { emitToUser } from './events.js';

export async function notifyTrustedContacts({ sos, contactIds = [], io }) {
  if (!contactIds.length) return [];
  const contacts = await Contact.find({
    _id: { $in: contactIds },
    userId: sos.userId,
    isActive: true,
  });
  const alerts = contacts.map((contact) => ({
    sosId: sos._id,
    contactId: contact._id,
    recipientUserId: sos.userId,
    status: contact.notificationConsent ? 'created' : 'consent_required',
    isDemo: sos.isDemo,
  }));
  if (!alerts.length) return [];
  await EmergencyAlert.insertMany(alerts);
  sos.alertContacts = contacts.map((contact) => ({
    contactId: contact._id,
    status: contact.notificationConsent ? 'in_app_created' : 'consent_required',
  }));
  await sos.save();

  for (const contact of contacts) {
    emitToUser(io, sos.userId, 'emergencyNotification', {
      sosId: sos.sosId,
      contact: contact.contactCode || String(contact._id),
      status: contact.notificationConsent ? 'in_app_created' : 'consent_required',
      isDemo: sos.isDemo,
    });
  }
  return alerts;
}

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
  if (!contacts.length) return [];

  const alerts = [];
  const deliveryResults = [];
  for (const contact of contacts) {
    if (!contact.notificationConsent) {
      alerts.push({
        sosId: sos._id,
        contactId: contact._id,
        recipientUserId: sos.userId,
        status: 'consent_required',
        isDemo: sos.isDemo,
      });
      deliveryResults.push({ contactId: contact._id, status: 'consent_required' });
      continue;
    }
    const channel = 'whatsapp';
    const status = 'created';
    alerts.push({
      sosId: sos._id,
      contactId: contact._id,
      recipientUserId: sos.userId,
      channel,
      status,
      isDemo: sos.isDemo,
    });
    deliveryResults.push({ contactId: contact._id, status, channel });
  }
  await EmergencyAlert.insertMany(alerts);
  sos.alertContacts = deliveryResults.map((result) => ({
    contactId: result.contactId,
    status: result.status === 'created' ? 'whatsapp_ready' : 'consent_required',
  }));
  await sos.save();

  for (const result of deliveryResults) {
    emitToUser(io, sos.userId, 'emergencyNotification', {
      sosId: sos.sosId,
      contact: String(result.contactId),
      status: result.status,
      channel: result.channel || null,
      isDemo: sos.isDemo,
    });
  }
  return alerts;
}

import { fromPoint } from './geo.js';

export function serializeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export function serializeVehicle(vehicle) {
  return {
    id: vehicle.vehicleId,
    vehicleId: vehicle.vehicleId,
    type: vehicle.type,
    driverName: vehicle.driverName,
    status: vehicle.status,
    ...fromPoint(vehicle.currentLocation),
    speed: vehicle.speed,
    heading: vehicle.heading,
    assignedSOS: vehicle.assignedSOS?.sosId || vehicle.assignedSOS || null,
    isDemo: vehicle.isDemo,
    lastUpdated: vehicle.lastUpdated,
  };
}

export function serializeSos(sos) {
  return {
    id: sos.sosId,
    sosId: sos.sosId,
    userId: String(sos.userId?._id || sos.userId),
    type: sos.emergencyType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    emergencyType: sos.emergencyType,
    priority: sos.priority,
    description: sos.description,
    reportedFor: sos.reportedFor || 'self',
    personName: sos.personName || '',
    personRelationship: sos.personRelationship || '',
    status: sos.status.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    vehicle: sos.assignedVehicle?.vehicleId || 'Awaiting dispatch',
    assignedVehicle: sos.assignedVehicle?.vehicleId || null,
    location: sos.locationLabel || 'Ghaziabad demo area',
    ...fromPoint(sos.location),
    createdAt: sos.createdAt,
    time: new Date(sos.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    resolvedAt: sos.resolvedAt,
    isDemo: sos.isDemo,
    alertContacts: sos.alertContacts,
  };
}

export function serializeContact(contact) {
  return {
    id: contact.contactCode || String(contact._id),
    contactId: String(contact._id),
    name: contact.name,
    phone: contact.phone,
    relationship: contact.relationship,
    ...fromPoint(contact.location),
    notificationConsent: contact.notificationConsent,
    isActive: contact.isActive,
  };
}

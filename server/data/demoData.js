export const DEMO_VEHICLES = [
  { vehicleId: 'AMB-101', type: 'ambulance', status: 'en_route', lat: 28.6692, lng: 77.4538, speed: 42, heading: 25, driverName: 'Demo ambulance crew' },
  { vehicleId: 'AMB-102', type: 'ambulance', status: 'available', lat: 28.676, lng: 77.442, speed: 0, heading: 0, driverName: 'Demo ambulance crew' },
  { vehicleId: 'FIRE-201', type: 'fire_truck', status: 'responding', lat: 28.6615, lng: 77.46, speed: 36, heading: 190, driverName: 'Demo fire crew' },
  { vehicleId: 'POL-301', type: 'police', status: 'patrolling', lat: 28.674, lng: 77.465, speed: 28, heading: 130, driverName: 'Demo police unit' },
  { vehicleId: 'POL-302', type: 'police', status: 'available', lat: 28.68, lng: 77.451, speed: 0, heading: 0, driverName: 'Demo police unit' },
];

export const DEMO_CONTACTS = [
  { contactCode: 'C-101', name: 'Rahul Sharma', phone: '+91 98765 43210', relationship: 'Brother', lat: 28.671, lng: 77.455 },
  { contactCode: 'C-102', name: 'Priya Verma', phone: '+91 98765 12340', relationship: 'Sister', lat: 28.665, lng: 77.449 },
  { contactCode: 'C-103', name: 'Amit Kumar', phone: '+91 98100 54210', relationship: 'Friend', lat: 28.678, lng: 77.461 },
  { contactCode: 'C-104', name: 'Neha Singh', phone: '+91 98990 12560', relationship: 'Partner', lat: 28.663, lng: 77.457 },
];

export const DEMO_SOS = [
  { sosId: 'SOS-001', emergencyType: 'medical', priority: 'critical', status: 'assigned', location: { lat: 28.6698, lng: 77.4518 }, locationLabel: 'Indirapuram, Ghaziabad', vehicleId: 'AMB-101', createdAt: '2025-01-15T10:42:00.000Z' },
  { sosId: 'SOS-002', emergencyType: 'fire', priority: 'high', status: 'responding', location: { lat: 28.6624, lng: 77.4591 }, locationLabel: 'Vasundhara, Ghaziabad', vehicleId: 'FIRE-201', createdAt: '2025-01-15T10:36:00.000Z' },
  { sosId: 'SOS-003', emergencyType: 'personal_safety', priority: 'high', status: 'pending', location: { lat: 28.6742, lng: 77.446 }, locationLabel: 'Vaishali, Ghaziabad', vehicleId: null, createdAt: '2025-01-15T10:21:00.000Z' },
];

export const DEMO_AREA = { minLat: 28.658, maxLat: 28.684, minLng: 77.438, maxLng: 77.469 };

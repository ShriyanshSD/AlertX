export const initialVehicles = [
  { id: 'AMB-101', type: 'Ambulance', status: 'en_route', lat: 28.6692, lng: 77.4538, speed: 42, heading: 25, crew: '2 paramedics', eta: '04 min', isDemo: true },
  { id: 'AMB-102', type: 'Ambulance', status: 'available', lat: 28.676, lng: 77.442, speed: 0, heading: 0, crew: '2 paramedics', eta: '—', isDemo: true },
  { id: 'FIRE-201', type: 'Fire Truck', status: 'responding', lat: 28.6615, lng: 77.46, speed: 36, heading: 190, crew: '4 firefighters', eta: '07 min', isDemo: true },
  { id: 'POL-301', type: 'Police Car', status: 'patrolling', lat: 28.674, lng: 77.465, speed: 28, heading: 130, crew: '2 officers', eta: '—', isDemo: true },
  { id: 'POL-302', type: 'Police Car', status: 'available', lat: 28.68, lng: 77.451, speed: 0, heading: 0, crew: '2 officers', eta: '—', isDemo: true },
];

export const initialContacts = [
  { id: 'C-101', name: 'Rahul Sharma', phone: '+91 98765 43210', relationship: 'Brother', lat: 28.671, lng: 77.455, isDemo: true },
  { id: 'C-102', name: 'Priya Verma', phone: '+91 98765 12340', relationship: 'Sister', lat: 28.665, lng: 77.449, isDemo: true },
  { id: 'C-103', name: 'Amit Kumar', phone: '+91 98100 54210', relationship: 'Friend', lat: 28.678, lng: 77.461, isDemo: true },
  { id: 'C-104', name: 'Neha Singh', phone: '+91 98990 12560', relationship: 'Partner', lat: 28.663, lng: 77.457, isDemo: true },
];

export const initialSos = [
  { id: 'SOS-001', type: 'Medical', priority: 'Critical', status: 'Assigned', time: '10:42 AM', location: 'Indirapuram, Ghaziabad', vehicle: 'AMB-101', lat: 28.6698, lng: 77.4518, isDemo: true },
  { id: 'SOS-002', type: 'Fire', priority: 'High', status: 'Responding', time: '10:36 AM', location: 'Vasundhara, Ghaziabad', vehicle: 'FIRE-201', lat: 28.6624, lng: 77.4591, isDemo: true },
  { id: 'SOS-003', type: 'Personal Safety', priority: 'High', status: 'Pending', time: '10:21 AM', location: 'Vaishali, Ghaziabad', vehicle: 'Awaiting dispatch', lat: 28.6742, lng: 77.446, isDemo: true },
];

export const activityData = [
  { time: '06:00', medical: 3, fire: 1, safety: 1 },
  { time: '08:00', medical: 5, fire: 2, safety: 2 },
  { time: '10:00', medical: 7, fire: 3, safety: 1 },
  { time: '12:00', medical: 4, fire: 1, safety: 3 },
  { time: '14:00', medical: 8, fire: 2, safety: 2 },
  { time: '16:00', medical: 6, fire: 4, safety: 3 },
  { time: '18:00', medical: 9, fire: 2, safety: 4 },
];

export const notifications = [
  { title: 'Unit AMB-101 en route', detail: 'Medical response · Indirapuram', time: '2 min ago', tone: 'blue' },
  { title: 'New emergency request', detail: 'Fire alert · Vasundhara', time: '8 min ago', tone: 'red' },
  { title: 'Contact location updated', detail: 'Priya Verma · Ghaziabad', time: '14 min ago', tone: 'green' },
];

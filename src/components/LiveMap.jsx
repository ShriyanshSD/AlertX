import { Fragment, useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair } from 'lucide-react';

const colors = { Ambulance: '#4f8cff', 'Fire Truck': '#ff794f', 'Police Car': '#b18cff', Contact: '#34d399', SOS: '#ff455e' };
const glyphs = { Ambulance: '✚', 'Fire Truck': '▲', 'Police Car': '◆', Contact: '●', SOS: '!' };
const facilityStyles = {
  Hospital: { color: '#ff596d', glyph: 'H' },
  Clinic: { color: '#ff9a57', glyph: '+' },
  'Police station': { color: '#6f9fff', glyph: 'P' },
  'Fire station': { color: '#ff794f', glyph: 'F' },
  'Ambulance station': { color: '#42c9bd', glyph: 'A' },
};
const currentLocationIcon = L.divIcon({
  className: 'user-location-marker',
  html: '<span class="user-location-pin"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function MapFocus({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 15, { duration: 0.8 });
  }, [center, map]);
  return null;
}

function MapUserLocationControl({ onLocation, onError, locating, setLocating }) {
  const map = useMap();
  const locateUser = () => {
    if (!navigator.geolocation) {
      onError('Your browser does not support location sharing.');
      return;
    }
    onError('');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const location = [coords.latitude, coords.longitude];
      onLocation(location);
      map.flyTo(location, 16, { duration: 0.8 });
      setLocating(false);
    }, (error) => {
      onError(error.code === 1
        ? 'Location permission was denied. Allow location access and try again.'
        : 'Your current location could not be determined. Try again.');
      setLocating(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  return <button
    className="map-locate"
    aria-label={locating ? 'Finding your current location' : 'Show my current location'}
    title={locating ? 'Finding location…' : 'Show my current location'}
    onClick={locateUser}
    disabled={locating}
  ><Crosshair size={16} /></button>;
}

export function VehicleMarker({ vehicle, selected, onSelect }) {
  const color = colors[vehicle.type];
  const icon = useMemo(() => L.divIcon({
    className: 'resq-map-marker',
    html: `<span class="map-marker-pin ${vehicle.type.toLowerCase().replaceAll(' ', '-')}" style="--marker-color:${color}">${glyphs[vehicle.type]}</span>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  }), [vehicle.type, color]);
  return <Fragment>
    <CircleMarker center={[vehicle.lat, vehicle.lng]} radius={selected ? 13 : 10} pathOptions={{ color, fillColor: color, fillOpacity: 0.17, weight: 1 }} />
    <Marker position={[vehicle.lat, vehicle.lng]} icon={icon} eventHandlers={{ click: () => onSelect?.(vehicle) }}>
      <Popup><div className="map-popup"><strong>{vehicle.id}</strong><span>{vehicle.type} · {vehicle.status.replaceAll('_', ' ')}</span><small>{vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}</small></div></Popup>
    </Marker>
  </Fragment>;
}

function FacilityMarker({ facility }) {
  const { color, glyph } = facilityStyles[facility.type] || { color: '#98a8bb', glyph: '•' };
  const icon = useMemo(() => L.divIcon({
    className: 'resq-map-marker',
    html: `<span class="facility-map-marker" style="--marker-color:${color}">${glyph}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  }), [color, glyph]);
  return <Marker position={[facility.lat, facility.lng]} icon={icon}>
    <Popup><div className="map-popup"><strong>{facility.name}</strong><span>{facility.type} · OpenStreetMap community data</span><small>{facility.distanceKm.toFixed(1)} km straight-line distance</small></div></Popup>
  </Marker>;
}

export default function LiveMap({ vehicles = [], contacts = [], sosRequests = [], resources = [], showVehicles = true, showContacts = true, selectedId, onSelectVehicle, focus, label = 'SIMULATED FEED' }) {
  const center = [28.6719, 77.4538];
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locating, setLocating] = useState(false);
  return <div className="map-shell">
    <MapContainer center={center} zoom={14} scrollWheelZoom className="live-map">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapFocus center={focus} />
      <MapUserLocationControl onLocation={setCurrentLocation} onError={setLocationError} locating={locating} setLocating={setLocating} />
      {currentLocation && <Marker position={currentLocation} icon={currentLocationIcon}><Popup>Your current device location</Popup></Marker>}
      {showVehicles && vehicles.map((vehicle) => <VehicleMarker key={vehicle.id} vehicle={vehicle} selected={selectedId === vehicle.id} onSelect={onSelectVehicle} />)}
      {showContacts && contacts.filter((contact) => Number.isFinite(contact.lat) && Number.isFinite(contact.lng)).map((contact) => <CircleMarker key={contact.contactId || contact.id} center={[contact.lat, contact.lng]} radius={7} pathOptions={{ color: colors.Contact, fillColor: colors.Contact, fillOpacity: 0.9, weight: 2 }}><Popup><div className="map-popup"><strong>{contact.name}</strong><span>Trusted contact · {contact.id}</span></div></Popup></CircleMarker>)}
      {sosRequests.map((request) => <CircleMarker key={request.id} center={[request.lat, request.lng]} radius={9} pathOptions={{ color: colors.SOS, fillColor: colors.SOS, fillOpacity: 0.85, weight: 2 }}><Popup><div className="map-popup"><strong>{request.id} · {request.type}</strong><span>{request.priority} priority · {request.status}</span></div></Popup></CircleMarker>)}
      {resources.map((facility) => <FacilityMarker key={facility.id} facility={facility} />)}
    </MapContainer>
    <div className="map-overlay-label"><span className="live-dot" /> {label}</div>
    {locationError && <p className="map-location-error" role="status">{locationError}</p>}
  </div>;
}

export function MapLegend() {
  return <div className="map-legend">{Object.entries(colors).map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}</span>)}</div>;
}

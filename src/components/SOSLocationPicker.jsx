import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const defaultCenter = [28.6719, 77.4538];
const selectedLocationIcon = L.divIcon({
  className: 'sos-location-marker',
  html: '<span class="sos-location-pin"></span>',
  iconSize: [30, 36],
  iconAnchor: [15, 32],
});

function MapClickSelector({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function MapFocus({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 15), { duration: 0.45 });
  }, [location, map]);
  return null;
}

export default function SOSLocationPicker({ location, onChange }) {
  const markerPosition = useMemo(
    () => location && [location.lat, location.lng],
    [location?.lat, location?.lng],
  );
  return <div className="sos-location-picker" aria-label="Select emergency location">
    <MapContainer center={markerPosition || defaultCenter} zoom={markerPosition ? 15 : 12} scrollWheelZoom={false} className="sos-location-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickSelector onSelect={onChange} />
      <MapFocus location={location} />
      {markerPosition && <Marker
        position={markerPosition}
        icon={selectedLocationIcon}
        draggable
        eventHandlers={{
          dragend(event) {
            const point = event.target.getLatLng();
            onChange({ lat: point.lat, lng: point.lng });
          },
        }}
      />}
    </MapContainer>
    <small>Click the map to place the pin, or drag it to the person’s location.</small>
  </div>;
}

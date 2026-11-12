import { useState } from 'react';
import { Ambulance, ExternalLink, LocateFixed, MapPin, Phone, RefreshCw, Shield, Siren, Truck } from 'lucide-react';
import LiveMap from './LiveMap.jsx';
import { SectionHeading, StatusBadge } from './UI.jsx';
import api, { getApiError } from '../services/api.js';

const vehicleIcons = { Ambulance, 'Fire Truck': Truck, 'Police Car': Shield };

function ResourceRow({ resource, demo = false }) {
  const Icon = demo ? (vehicleIcons[resource.type] || Ambulance) : resource.type === 'Police station' ? Shield : resource.type === 'Fire station' ? Siren : Ambulance;
  const mapUrl = `https://www.openstreetmap.org/?mlat=${resource.lat}&mlon=${resource.lng}#map=17/${resource.lat}/${resource.lng}`;
  return <article className="nearby-result-row">
    <span className={`nearby-result-icon ${demo ? 'demo' : ''}`}><Icon size={16} /></span>
    <span className="nearby-result-info">
      <strong>{resource.name || resource.vehicleId}</strong>
      <small>{resource.type}{demo ? ' · Simulated unit, not an operating service' : ' · OpenStreetMap community listing'}</small>
    </span>
    {demo && <StatusBadge>{resource.status}</StatusBadge>}
    <span className="nearby-distance">{resource.distanceKm.toFixed(1)} km</span>
    {resource.phone && !demo
      ? <a className="icon-button" href={`tel:${resource.phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${resource.name}`} title="Call listed number"><Phone size={15} /></a>
      : <a className="icon-button" href={mapUrl} target="_blank" rel="noreferrer" aria-label={`Open map for ${resource.name || resource.vehicleId}`} title="Open map"><ExternalLink size={15} /></a>}
  </article>;
}

export default function NearbyAssistance() {
  const [position, setPosition] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [attribution, setAttribution] = useState('');
  const [facilityError, setFacilityError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const findNearby = () => {
    if (!navigator.geolocation) {
      setError('Location permission is not supported by this browser. You can still open the simulated Ghaziabad tracking map.');
      return;
    }
    setLoading(true);
    setError('');
    setFacilityError('');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const currentPosition = { lat: coords.latitude, lng: coords.longitude };
      setPosition(currentPosition);
      try {
        const { data } = await api.post('/resources/nearby', { ...currentPosition, radiusKm: 10 });
        setFacilities(data.data.facilities || []);
        setVehicles(data.data.demoVehicles || []);
        setAttribution(data.data.attribution || '');
        setFacilityError(data.data.facilityError || '');
      } catch (requestError) {
        setError(getApiError(requestError));
        setFacilities([]);
        setVehicles([]);
      } finally {
        setLoading(false);
      }
    }, (locationError) => {
      setLoading(false);
      if (locationError.code === 1) {
        setError('Location sharing was not allowed. AlertX did not receive your location. You can enable permission and try again.');
      } else if (locationError.code === 3) {
        setError('Your location could not be determined in time. Try again or check browser location settings.');
      } else {
        setError('Your location is unavailable. Try again or check browser location settings.');
      }
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  };

  return <section className="nearby-assistance">
    <SectionHeading eyebrow="LOCATION-BASED HELP · OPTIONAL" title="Nearby assistance" description="Find community-mapped facilities and clearly labeled simulated units near a location you choose to share." action={<span className="demo-pill"><MapPin size={13} /> CONSENT REQUIRED</span>} />
    <div className="panel nearby-consent">
      <div><strong><LocateFixed size={16} /> Your location stays opt-in</strong><p>Only when you press the button will AlertX request your browser location, send it to this backend, and query OpenStreetMap. Coordinates are not saved to your account or sent to Gemini.</p></div>
      <button className="button primary" type="button" onClick={findNearby} disabled={loading}>{loading ? <RefreshCw size={15} className="spinner-icon" /> : <LocateFixed size={15} />}{loading ? 'Finding nearby help…' : position ? 'Refresh nearby help' : 'Use my location'}</button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {position && <>
      <div className="nearby-map-grid">
        <section className="panel nearby-map-panel">
          <div className="nearby-map-wrap"><LiveMap vehicles={vehicles} resources={facilities} showContacts={false} focus={[position.lat, position.lng]} label="OSM DATA · SIMULATED UNITS" /></div>
          <div className="nearby-map-caption">Vehicle markers are simulated; facility markers come from OpenStreetMap community data.</div>
        </section>
        <section className="panel nearby-list-panel">
          <div className="panel-heading"><div><h2>Nearby resources</h2><p>Within 10 km · straight-line distance, not travel time</p></div></div>
          {facilityError && <p className="nearby-warning" role="status">{facilityError}</p>}
          <div className="nearby-results">
            {facilities.map((facility) => <ResourceRow key={facility.id} resource={facility} />)}
            {vehicles.map((vehicle) => <ResourceRow key={vehicle.id} resource={vehicle} demo />)}
            {!facilities.length && !vehicles.length && !facilityError && <p className="muted small">No mapped facilities or simulated units were found within 10 km.</p>}
            {!facilities.length && !vehicles.length && facilityError && <p className="muted small">No simulated units are available nearby. For emergencies, call your local emergency service directly.</p>}
          </div>
          {attribution && <small className="nearby-attribution">{attribution}</small>}
        </section>
      </div>
      <p className="nearby-disclaimer">OpenStreetMap facilities may be incomplete, outdated, or closed; confirm details directly. AlertX does not verify operating status. Simulated vehicles are fictional and cannot be dispatched. In India, call 112 for emergencies.</p>
    </>}
  </section>;
}

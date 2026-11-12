import { Ambulance, Shield, Truck } from 'lucide-react';
import { StatusBadge } from './UI.jsx';

export default function VehicleDetailsPanel({ vehicle }) {
  if (!vehicle) return <div className="vehicle-details empty-details"><div className="empty-icon"><Shield size={19} /></div><strong>Select a vehicle</strong><p>Choose a unit on the map or from the list to inspect its live details.</p></div>;
  const typeTone = vehicle.type === 'Ambulance' ? 'blue' : vehicle.type === 'Fire Truck' ? 'orange' : 'purple';
  const TypeIcon = vehicle.type === 'Ambulance' ? Ambulance : vehicle.type === 'Fire Truck' ? Truck : Shield;
  return <div className="vehicle-details"><div className="vehicle-detail-title"><span className={`vehicle-type-icon ${typeTone}`}><TypeIcon size={18} /></span><div><strong>{vehicle.id}</strong><small>{vehicle.type}</small></div><StatusBadge>{vehicle.status}</StatusBadge></div><div className="detail-grid"><div><small>Coordinates</small><strong>{vehicle.lat.toFixed(5)}, {vehicle.lng.toFixed(5)}</strong></div><div><small>Current speed</small><strong>{vehicle.speed || 0} km/h</strong></div><div><small>Response crew</small><strong>{vehicle.crew}</strong></div><div><small>Estimated arrival</small><strong>{vehicle.eta}</strong></div></div><div className="detail-live"><i className="live-dot" /> GPS signal active <span>Updated {vehicle.updatedAt ? new Date(vehicle.updatedAt).toLocaleTimeString() : 'just now'}</span></div></div>;
}

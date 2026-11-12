export function toPoint({ lat, lng }) {
  return { type: 'Point', coordinates: [Number(lng), Number(lat)] };
}

export function fromPoint(point) {
  if (!point?.coordinates || point.coordinates.length !== 2) return null;
  return { lat: point.coordinates[1], lng: point.coordinates[0] };
}

export function haversineDistanceKm(first, second) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const [firstLng, firstLat] = first.coordinates;
  const [secondLng, secondLat] = second.coordinates;
  const deltaLat = radians(secondLat - firstLat);
  const deltaLng = radians(secondLng - firstLng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(firstLat)) * Math.cos(radians(secondLat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

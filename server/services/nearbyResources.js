import { haversineDistanceKm, toPoint } from '../utils/geo.js';

const facilityTypes = new Map([
  ['hospital', 'Hospital'],
  ['clinic', 'Clinic'],
  ['police', 'Police station'],
  ['fire_station', 'Fire station'],
  ['ambulance_station', 'Ambulance station'],
]);

export async function fetchNearbyFacilities({ lat, lng, radiusKm, endpoint, fetchImpl = fetch }) {
  const radiusMeters = Math.round(radiusKm * 1000);
  const query = `[out:json][timeout:12];(node["amenity"~"^(hospital|clinic|police|fire_station|ambulance_station)$"](around:${radiusMeters},${lat},${lng});way["amenity"~"^(hospital|clinic|police|fire_station|ambulance_station)$"](around:${radiusMeters},${lat},${lng});relation["amenity"~"^(hospital|clinic|police|fire_station|ambulance_station)$"](around:${radiusMeters},${lat},${lng}););out center tags 60;`;
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError' || error instanceof TypeError) {
      throw new Error('The OpenStreetMap facility service is temporarily unavailable.');
    }
    throw error;
  }
  if (!response.ok) throw new Error('The OpenStreetMap facility service is temporarily unavailable.');
  const payload = await response.json();
  const center = toPoint({ lat, lng });

  return (payload.elements || [])
    .map((element) => {
      const tags = element.tags || {};
      const amenity = tags.amenity;
      const point = element.center || element;
      if (!facilityTypes.has(amenity) || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return null;
      const location = toPoint({ lat: point.lat, lng: point.lon });
      return {
        id: `osm-${element.type}-${element.id}`,
        name: tags.name || tags.operator || `Unnamed ${facilityTypes.get(amenity)}`,
        type: facilityTypes.get(amenity),
        lat: point.lat,
        lng: point.lon,
        distanceKm: Number(haversineDistanceKm(center, location).toFixed(2)),
        phone: tags.phone || tags['contact:phone'] || tags.telephone || '',
        source: 'OpenStreetMap',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
    })
    .filter(Boolean)
    .filter((facility) => facility.distanceKm <= radiusKm)
    .sort((first, second) => first.distanceKm - second.distanceKm)
    .slice(0, 40);
}

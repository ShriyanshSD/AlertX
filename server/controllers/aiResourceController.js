import Vehicle from '../models/Vehicle.js';
import { config } from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { haversineDistanceKm, toPoint } from '../utils/geo.js';
import { fetchNearbyFacilities } from '../services/nearbyResources.js';
import { serializeVehicle } from '../utils/serializers.js';

export const nearbyResources = asyncHandler(async (request, response) => {
  const { lat, lng, radiusKm } = request.body;
  let facilities = [];
  let facilityError = '';
  try {
    facilities = await fetchNearbyFacilities({
      lat,
      lng,
      radiusKm,
      endpoint: config.overpassUrl,
    });
  } catch {
    facilityError = 'Nearby OpenStreetMap facility data is temporarily unavailable. DEMO fleet results are shown separately.';
  }

  const vehicles = config.demoMode
    ? await Vehicle.find({ isDemo: true, status: 'available' }).lean()
    : [];
  const origin = toPoint({ lat, lng });
  const demoVehicles = vehicles.map((vehicle) => ({
    ...serializeVehicle(vehicle),
    distanceKm: Number(haversineDistanceKm(origin, vehicle.currentLocation).toFixed(2)),
    isDemo: true,
  }))
    .filter((vehicle) => vehicle.distanceKm <= radiusKm)
    .sort((first, second) => first.distanceKm - second.distanceKm);

  response.json({
    data: {
      facilities,
      demoVehicles,
      facilityError,
      attribution: 'Facility listings are community-mapped OpenStreetMap data; verify availability directly. Demo vehicles are fictional.',
    },
  });
});

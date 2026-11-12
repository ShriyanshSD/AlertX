const AREA = { minLat: 28.658, maxLat: 28.684, minLng: 77.438, maxLng: 77.469 };

export function advanceVehicles(vehicles, speed = 1) {
  return vehicles.map((vehicle) => {
    if (vehicle.status === 'available' || vehicle.status === 'offline') return vehicle;
    const distanceKm = ((vehicle.speed || 0) * speed * 2) / 3600;
    const heading = (vehicle.heading * Math.PI) / 180;
    const latStep = (distanceKm / 111.32) * Math.cos(heading);
    const lngStep = (distanceKm / (111.32 * Math.cos((vehicle.lat * Math.PI) / 180))) * Math.sin(heading);
    const nextLat = vehicle.lat + latStep;
    const nextLng = vehicle.lng + lngStep;
    const outOfBounds =
      nextLat < AREA.minLat || nextLat > AREA.maxLat || nextLng < AREA.minLng || nextLng > AREA.maxLng;
    return {
      ...vehicle,
      lat: outOfBounds ? vehicle.lat : nextLat,
      lng: outOfBounds ? vehicle.lng : nextLng,
      heading: outOfBounds ? (vehicle.heading + 180) % 360 : vehicle.heading,
      updatedAt: new Date().toISOString(),
    };
  });
}

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/** Device location, or null when unavailable/denied. Never rejects. */
export function getCurrentLocation(timeout = 10_000): Promise<GeoLocation | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout },
    ),
  );
}

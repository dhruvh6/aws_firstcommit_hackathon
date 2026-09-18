import type { GeoPoint } from '@dse/shared';

/** Haversine distance in kilometres, rounded once to one decimal place. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const radiusKm = 6371;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lon - a.lon);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(a.lat))
      * Math.cos(toRadians(b.lat))
      * Math.sin(longitudeDelta / 2) ** 2;
  return Math.round(2 * radiusKm * Math.asin(Math.sqrt(haversine)) * 10) / 10;
}

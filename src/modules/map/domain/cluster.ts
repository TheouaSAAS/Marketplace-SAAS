/**
 * Regroupement des marqueurs proches à un niveau de zoom donné (grille de
 * pixels en projection Web Mercator) : sans bibliothèque supplémentaire,
 * déterministe et testable. Un groupe d'un seul élément reste un marqueur.
 */

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
}

export interface Cluster {
  key: string;
  lat: number;
  lng: number;
  ids: string[];
}

/** Coordonnées en pixels du monde au zoom donné (tuiles de 256 px). */
export function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = 256 * 2 ** zoom;
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

export function clusterPoints(points: readonly ClusterPoint[], zoom: number, cellPx = 56): Cluster[] {
  const cells = new Map<string, ClusterPoint[]>();
  for (const point of points) {
    const { x, y } = project(point.lat, point.lng, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    const cell = cells.get(key);
    if (cell) cell.push(point);
    else cells.set(key, [point]);
  }
  return [...cells.entries()]
    .map(([key, members]) => ({
      key,
      lat: members.reduce((sum, point) => sum + point.lat, 0) / members.length,
      lng: members.reduce((sum, point) => sum + point.lng, 0) / members.length,
      ids: members.map((point) => point.id).sort(),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

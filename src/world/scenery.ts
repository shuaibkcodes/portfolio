/**
 * Deterministic procedural scenery. Everything is generated from the road
 * graph + placements with a seeded RNG, then rendered with instancing.
 * Density scales with the device tier.
 */
import { edgeList, futurePath, ROAD_HALF_WIDTH, SHOULDER, type EdgeId } from "./graph";
import { chronoAt, placements, stations, type BuildingStyle, type StationPlacement } from "./layout";

export interface Instance {
  x: number;
  z: number;
  y?: number;
  rot: number;
  sx: number;
  sy: number;
  sz: number;
  seed: number;
}

export const LAMP_SPACING = 36;
export const LAMP_POLE_LAT = ROAD_HALF_WIDTH + SHOULDER + 0.6;
export const LAMP_HEAD_LAT = 3.0;
export const lampRange = (edge: EdgeId) => {
  const e = edgeList.find((x) => x.id === edge)!;
  return { start: e.plain.start + 10, end: e.path.length - e.plain.end - 10 };
};

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// --- spatial checks ----------------------------------------------------------

const CELL = 20;
const roadGrid = new Map<string, [number, number][]>();
const key = (cx: number, cz: number) => `${cx},${cz}`;
for (const e of edgeList) {
  for (const p of e.path.samples(4)) {
    const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
    if (!roadGrid.has(k)) roadGrid.set(k, []);
    roadGrid.get(k)!.push([p.x, p.z]);
  }
}
for (const p of futurePath.samples(4)) {
  const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
  if (!roadGrid.has(k)) roadGrid.set(k, []);
  roadGrid.get(k)!.push([p.x, p.z]);
}

export function distanceToRoad(x: number, z: number, max = 60): number {
  const r = Math.ceil(max / CELL);
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  let best = max;
  for (let i = -r; i <= r; i++)
    for (let j = -r; j <= r; j++) {
      const pts = roadGrid.get(key(cx + i, cz + j));
      if (!pts) continue;
      for (const [px, pz] of pts) {
        const d = Math.hypot(px - x, pz - z);
        if (d < best) best = d;
      }
    }
  return best;
}

export const stationSetback: Record<BuildingStyle, number> = { studio: 24, office: 32, tower: 46, campus: 40, solarSite: 56, estate: 30, fintech: 24, lab: 30, hydro: 26 };
const stationClearance: Record<BuildingStyle, number> = { studio: 24, office: 32, tower: 95, campus: 75, solarSite: 78, estate: 46, fintech: 34, lab: 44, hydro: 36 };

export function stationAnchor(st: StationPlacement) {
  const e = edgeList.find((x) => x.id === st.edge)!;
  const lat = (st.side === "left" ? -1 : 1) * stationSetback[st.building];
  const p = e.path.pointAt(st.d, lat);
  // Local +Z faces the carriageway, angled towards approaching traffic (except fields).
  const angle = st.building === "solarSite" ? 0 : 0.55;
  const rot = st.side === "left" ? p.h + Math.PI / 2 - angle : p.h - Math.PI / 2 + angle;
  return { x: p.x, z: p.z, h: p.h, rot };
}

const clearZones = stations.map((st) => ({ ...stationAnchor(st), r: stationClearance[st.building] }));
const blocked = (x: number, z: number) => clearZones.some((c) => Math.hypot(c.x - x, c.z - z) < c.r);

// --- generation --------------------------------------------------------------

export interface Scenery {
  lamps: Instance[];
  pines: Instance[];
  broadleaf: Instance[];
  buildings: Instance[];
  cones: Instance[];
  futureLights: Instance[];
}

export function generateScenery(density = 1): Scenery {
  const rand = rng(1703931);
  const lamps: Instance[] = [];
  const pines: Instance[] = [];
  const broadleaf: Instance[] = [];
  const buildings: Instance[] = [];
  const cones: Instance[] = [];
  const futureLights: Instance[] = [];

  for (const e of edgeList) {
    const { start, end } = lampRange(e.id);
    for (let i = 0, d = start; d <= end; i++, d += LAMP_SPACING) {
      const side = i % 2 === 0 ? -1 : 1;
      const p = e.path.pointAt(d, side * LAMP_POLE_LAT);
      lamps.push({ x: p.x, z: p.z, rot: p.h + (side < 0 ? 0 : Math.PI), sx: 1, sy: 1, sz: 1, seed: i });
    }

    for (let d = 0; d < e.path.length; d += 6) {
      const year = chronoAt(e.id, d);
      const city = e.district === "career" ? Math.min(Math.max((year - 2021.3) / 3.5, 0), 1) : 0;
      for (const side of [-1, 1]) {
        // Trees — thin out as the city grows.
        const treeChance = (e.district === "education" ? 0.75 : e.district === "projects" ? 0.25 : 0.55 - city * 0.35) * density;
        if (rand() < treeChance) {
          const lat = side * (13 + Math.pow(rand(), 1.6) * 110);
          const p = e.path.pointAt(d + rand() * 6, lat);
          if (distanceToRoad(p.x, p.z, 14) >= 12 && !blocked(p.x, p.z)) {
            const s = 0.8 + rand() * 0.7;
            const inst = { x: p.x, z: p.z, rot: rand() * Math.PI * 2, sx: s, sy: s * (0.85 + rand() * 0.4), sz: s, seed: rand() };
            const broad = e.district === "education" ? rand() < 0.85 : rand() < 0.2 + city * 0.6;
            (broad ? broadleaf : pines).push(inst);
          }
        }
        // Buildings — the city densifies with the career.
        if (city > 0 && rand() < city * 0.22 * density) {
          const lat = side * (38 + rand() * 150);
          const p = e.path.pointAt(d, lat);
          const w = 12 + rand() * 18;
          const dp = 12 + rand() * 18;
          const clear = Math.max(w, dp) * 0.75 + 16;
          if (distanceToRoad(p.x, p.z, clear + 2) >= clear && !blocked(p.x, p.z)) {
            const hgt = 8 + Math.pow(rand(), 2.2) * (18 + city * 62);
            buildings.push({ x: p.x, z: p.z, rot: p.h, sx: w, sy: hgt, sz: dp, seed: rand() });
          }
        }
      }
    }
  }

  // Campus buildings along the education road.
  const edu = edgeList.find((x) => x.id === "educationRoad")!;
  for (let d = 170; d < 440; d += 38) {
    for (const side of [-1, 1]) {
      if (rand() < 0.35) continue;
      const lat = side * (30 + rand() * 30);
      const p = edu.path.pointAt(d, lat);
      if (distanceToRoad(p.x, p.z, 30) < 24 || blocked(p.x, p.z)) continue;
      buildings.push({ x: p.x, z: p.z, rot: p.h, sx: 22 + rand() * 16, sy: 9 + rand() * 8, sz: 14 + rand() * 8, seed: rand() });
    }
  }

  for (const pl of placements) {
    if (pl.kind !== "cones") continue;
    const e = edgeList.find((x) => x.id === pl.edge)!;
    for (let d = pl.d; d <= pl.d + pl.length; d += 5) {
      const p = e.path.pointAt(d, -(ROAD_HALF_WIDTH + 0.5));
      cones.push({ x: p.x, z: p.z, rot: 0, sx: 1, sy: 1, sz: 1, seed: d });
    }
  }

  for (let d = 70; d < futurePath.length; d += 42) {
    for (const side of [-1, 1]) {
      const p = futurePath.pointAt(d, side * LAMP_POLE_LAT);
      futureLights.push({ x: p.x, z: p.z, y: 7.6, rot: 0, sx: 1, sy: 1, sz: 1, seed: d });
    }
  }

  return { lamps, pines, broadleaf, buildings, cones, futureLights };
}


/**
 * Where content lives in the world. Placements reference portfolio content by
 * id (src/data/portfolio.ts) and roads by edge id + distance along the edge.
 *
 * Chronology: each edge maps distance → fractional year. Year gates are
 * derived from integer crossings, and lighting (sunrise → night) follows it.
 */
import { projects } from "@/data/portfolio";
import { SEP } from "@/lib/text";
import { edges, type EdgeId, type NodeId } from "./graph";

export type Side = "left" | "right";
export type SignStyle = "career" | "education" | "project" | "info" | "warning" | "construction" | "success";
export type BuildingStyle = "studio" | "office" | "tower" | "campus" | "solarSite" | "estate" | "fintech" | "lab" | "hydro";
export type ContentRef = { type: "experience" | "education" | "project"; id: string };

export interface StationPlacement {
  kind: "station";
  id: string;
  edge: EdgeId;
  d: number;
  side: Side;
  content: ContentRef;
  building: BuildingStyle;
  /** Advance warning sign text, placed ~120 m before. */
  approach?: string;
  /** Short GPS label. */
  gpsLabel: string;
  /** Project exit number on the Project Highway. */
  exit?: number;
}

export interface SignPlacement {
  kind: "sign";
  id: string;
  edge: EdgeId;
  d: number;
  side: Side;
  style: SignStyle;
  lines: string[];
  shape?: "rect" | "diamond";
  /** Arrow drawn on the sign. */
  arrow?: "left" | "right" | "up";
}

export interface GantryPlacement {
  kind: "junctionGantry";
  id: string;
  edge: EdgeId;
  d: number;
  node: NodeId;
}

export interface ConesPlacement {
  kind: "cones";
  id: string;
  edge: EdgeId;
  d: number;
  length: number;
}

export type Placement = StationPlacement | SignPlacement | GantryPlacement | ConesPlacement;

export interface YearGate {
  id: string;
  edge: EdgeId;
  d: number;
  year: number;
  sub?: string;
}

// --- chronology ------------------------------------------------------------

const JL = edges.careerEarly.path.length;
const SL = edges.careerStraight.path.length;
const LL = edges.careerLate.path.length;

/** [distance, fractional year] anchors, ascending. */
export const chronology: Record<EdgeId, [number, number][]> = {
  careerEarly: [[0, 2018.9], [60, 2019], [240, 2020], [410, 2021], [JL, 2021.9]],
  careerStraight: [[0, 2021.9], [SL, 2021.99]],
  educationRoad: [[0, 2021.9], [edges.educationRoad.path.length, 2021.99]],
  projectHighway: [[0, 2021.9], [edges.projectHighway.path.length, 2021.99]],
  careerLate: [[0, 2021.99], [30, 2022], [180, 2023], [330, 2024], [560, 2025], [680, 2026], [LL, 2026.9]],
};

export function chronoAt(edge: EdgeId, d: number): number {
  const a = chronology[edge];
  if (d <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    if (d <= a[i][0]) {
      const [d0, y0] = a[i - 1];
      const [d1, y1] = a[i];
      return y0 + ((d - d0) / (d1 - d0)) * (y1 - y0);
    }
  }
  return a[a.length - 1][1];
}

const gateSubs: Record<number, string> = {
  2019: "Career begins",
  2021: `Graduated${SEP}BurjSoft`,
  2024: "Promoted",
  2026: "Present",
};

export const yearGates: YearGate[] = (Object.keys(chronology) as EdgeId[]).flatMap((edge) =>
  chronology[edge]
    .filter(([, y]) => Number.isInteger(y))
    .map(([d, year]) => ({ id: `year-${year}`, edge, d, year, sub: gateSubs[year] })),
);

// --- placements ------------------------------------------------------------

export const stopLine = { edge: "careerEarly" as EdgeId, d: JL - (15 - 12) - 2 };
export const END_BARRIER_D = LL - 8;

/**
 * Project exits, in the order of `projects` in the data file. Each site's
 * position and architecture is a world concern and lives here.
 */
const projectSites: Record<string, { d: number; side: Side; building: BuildingStyle }> = {
  rotormaps: { d: 100, side: "right", building: "solarSite" },
  zlivio: { d: 255, side: "right", building: "estate" },
  rapaydo: { d: 355, side: "left", building: "fintech" },
  terranai: { d: 455, side: "right", building: "lab" },
  "water-reminder": { d: 615, side: "right", building: "hydro" },
};

const projectStations: StationPlacement[] = projects.flatMap((p, i) => {
  const site = projectSites[p.id];
  if (!site) {
    if (process.env.NODE_ENV !== "production") console.warn(`[world] project "${p.id}" has no site on the Project Highway`);
    return [];
  }
  return [{ kind: "station", id: `st-${p.id}`, edge: "projectHighway", ...site, content: { type: "project", id: p.id }, gpsLabel: p.name, exit: i + 1 }];
});

export const placements: Placement[] = [
  // Start — localhost.
  { kind: "sign", id: "localhost", edge: "careerEarly", d: 45, side: "left", style: "info", lines: ["127.0.0.1", "You are here"] },

  { kind: "sign", id: "new-role-noor", edge: "careerEarly", d: 105, side: "left", style: "career", lines: ["New role", "ahead"] },
  {
    kind: "station",
    id: "st-noor",
    edge: "careerEarly",
    d: 175,
    side: "left",
    content: { type: "experience", id: "noor-it" },
    building: "studio",
    gpsLabel: `Noor IT${SEP}2019`,
  },

  { kind: "sign", id: "edu-ahead", edge: "careerEarly", d: 320, side: "left", style: "education", lines: ["University", "Next junction"], arrow: "left" },

  { kind: "sign", id: "new-role-burj", edge: "careerEarly", d: 430, side: "left", style: "career", lines: ["New role", "ahead"] },
  {
    kind: "station",
    id: "st-burj-mean",
    edge: "careerEarly",
    d: 500,
    side: "left",
    content: { type: "experience", id: "burjsoft-mean" },
    building: "office",
    gpsLabel: `BurjSoft${SEP}2021`,
  },

  { kind: "sign", id: "projects-next-right", edge: "careerEarly", d: JL - 88, side: "left", style: "project", lines: ["Projects", "Next right"], arrow: "right" },
  { kind: "junctionGantry", id: "gantry-a", edge: "careerEarly", d: JL - 58, node: "junctionA" },

  // Straight on — the career road between 2021 and 2022.
  { kind: "sign", id: "refactoring", edge: "careerStraight", d: 70, side: "left", style: "construction", lines: ["Refactoring", "in progress"], shape: "diamond" },
  { kind: "cones", id: "cones-1", edge: "careerStraight", d: 85, length: 55 },

  // Education road.
  { kind: "sign", id: "uni-district", edge: "educationRoad", d: 40, side: "left", style: "education", lines: ["University", "District"] },
  {
    kind: "station",
    id: "st-uoe",
    edge: "educationRoad",
    d: 300,
    side: "left",
    content: { type: "education", id: "uoe" },
    building: "campus",
    approach: "Campus ahead",
    gpsLabel: "University",
  },
  { kind: "sign", id: "edu-merge", edge: "educationRoad", d: 470, side: "left", style: "career", lines: ["Career Road", "Merge ahead"], arrow: "right" },
  { kind: "sign", id: "merge-conflict", edge: "educationRoad", d: 540, side: "left", style: "warning", lines: ["Merge", "conflict", "ahead"], shape: "diamond" },

  // Project highway.
  { kind: "sign", id: "proj-hwy", edge: "projectHighway", d: 32, side: "left", style: "project", lines: ["Project Highway", `${projectStations.length} exits`] },
  ...projectStations,

  // Later career.
  { kind: "sign", id: "prod-dev", edge: "careerLate", d: 110, side: "left", style: "info", lines: ["Production ↑", "Development"], arrow: "left" },
  { kind: "sign", id: "new-role-lead", edge: "careerLate", d: 370, side: "left", style: "career", lines: ["New role", "ahead"] },
  {
    kind: "station",
    id: "st-burj-lead",
    edge: "careerLate",
    d: 450,
    side: "left",
    content: { type: "experience", id: "burjsoft-lead" },
    building: "tower",
    gpsLabel: `BurjSoft${SEP}Lead`,
  },
  { kind: "sign", id: "deploy-ok", edge: "careerLate", d: 620, side: "left", style: "success", lines: ["Deployment", "successful"] },
  { kind: "sign", id: "end-ahead", edge: "careerLate", d: 720, side: "left", style: "info", lines: ["End of the road", "ahead"] },
];

export const stations = placements.filter((p): p is StationPlacement => p.kind === "station");

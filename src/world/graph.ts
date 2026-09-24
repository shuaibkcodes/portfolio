/**
 * The portfolio world as an explicit road graph.
 *
 *                       end
 *                        │ careerLate
 *                     mergeB ✚
 *            ┌───────────┼───────────┐
 *   educationRoad   careerStraight   projectHighway
 *            └───────────┼───────────┘
 *                   junctionA ✚
 *                        │ careerEarly
 *                      start
 *
 * Branches leave junctionA with a 90° turn, run parallel to the main road
 * and rejoin at mergeB. Their segment lengths are chosen so they land exactly
 * on mergeB (verified at module load in development).
 */
import { RoadPath, line, left, right, type Pose } from "./path";

export type EdgeId = "careerEarly" | "careerStraight" | "educationRoad" | "projectHighway" | "careerLate";
export type NodeId = "start" | "junctionA" | "mergeB" | "end";
export type District = "career" | "education" | "projects";
export type TurnDir = "left" | "straight" | "right";

export const ROAD_HALF_WIDTH = 4; // two 4 m lanes
export const SHOULDER = 1.6;
/** Driving on the left (Pakistan). Lateral offsets are + to the right of travel. */
export const OWN_LANE = -2;
export const ONCOMING_LANE = 2;

/** Crossroad plates: square asphalt pads centred PLATE_AHEAD metres past the junction node. */
export const TURN_RADIUS = 12;
export const PLATE_HALF = 15;
export const PLATE_AHEAD = TURN_RADIUS;

const BEND_RADIUS = 40;
const BRANCH_RUN = 300;

export interface Edge {
  id: EdgeId;
  name: string;
  from: NodeId;
  to: NodeId;
  district: District;
  path: RoadPath;
  /** Metres at each end without lane markings / lamps (covered by junction plates). */
  plain: { start: number; end: number };
}

export interface JunctionExit {
  edge: EdgeId;
  dir: TurnDir;
  label: string;
  sub: string;
  district: District;
}

export interface GraphNode {
  id: NodeId;
  kind: "start" | "junction" | "merge" | "end";
  name: string;
  pose: Pose;
  exits: JunctionExit[];
  /** Autopilot picks the first unvisited exit in this order. */
  autopilotOrder?: EdgeId[];
}

// --- geometry --------------------------------------------------------------

const careerEarlyPath = new RoadPath({ x: 0, z: 0, h: 0 }, [
  line(90),
  left(500, 10),
  line(110),
  right(500, 20),
  line(70),
  left(500, 10),
  line(50),
]);

const J = careerEarlyPath.end;
const branch = (turn: typeof left, back: typeof left, spur: number) => [
  turn(TURN_RADIUS, 90),
  line(spur),
  back(BEND_RADIUS, 90),
  line(BRANCH_RUN),
  back(BEND_RADIUS, 90),
  line(spur),
  turn(TURN_RADIUS, 90),
];

const educationPath = new RoadPath(J, branch(left, right, 70));
// Longer spurs: the highway carries five project exits.
const projectPath = new RoadPath(J, branch(right, left, 110));
const straightPath = new RoadPath(J, [line(2 * TURN_RADIUS + 2 * BEND_RADIUS + BRANCH_RUN)]);
const M = straightPath.end;

const careerLatePath = new RoadPath(M, [
  line(80),
  right(600, 12),
  line(150),
  left(600, 20),
  line(150),
  right(600, 8),
  line(50),
]);

/** Decorative road beyond the end barrier — "the road continues". Never driven. */
export const futurePath = new RoadPath(careerLatePath.end, [line(60), left(1600, 18), line(2600)]);

// Plate coverage: a branch's first/last TURN_RADIUS arc plus the few metres of
// straight still inside the plate.
const branchPlain = (Math.PI / 2) * TURN_RADIUS + (PLATE_HALF - TURN_RADIUS) + 1;
const platePlainStraight = PLATE_AHEAD + PLATE_HALF + 1;

export const edges: Record<EdgeId, Edge> = {
  careerEarly: { id: "careerEarly", name: "Career Road", from: "start", to: "junctionA", district: "career", path: careerEarlyPath, plain: { start: 0, end: PLATE_HALF - PLATE_AHEAD + 1 } },
  careerStraight: { id: "careerStraight", name: "Career Road", from: "junctionA", to: "mergeB", district: "career", path: straightPath, plain: { start: platePlainStraight, end: platePlainStraight } },
  educationRoad: { id: "educationRoad", name: "Education Road", from: "junctionA", to: "mergeB", district: "education", path: educationPath, plain: { start: branchPlain, end: branchPlain } },
  projectHighway: { id: "projectHighway", name: "Project Highway", from: "junctionA", to: "mergeB", district: "projects", path: projectPath, plain: { start: branchPlain, end: branchPlain } },
  careerLate: { id: "careerLate", name: "Career Road", from: "mergeB", to: "end", district: "career", path: careerLatePath, plain: { start: PLATE_HALF - PLATE_AHEAD + 1, end: 0 } },
};

export const edgeList = Object.values(edges);

export const nodes: Record<NodeId, GraphNode> = {
  start: { id: "start", kind: "start", name: "Start", pose: careerEarlyPath.start, exits: [{ edge: "careerEarly", dir: "straight", label: "Career Road", sub: "", district: "career" }] },
  junctionA: {
    id: "junctionA",
    kind: "junction",
    name: "Junction",
    pose: J,
    exits: [
      { edge: "educationRoad", dir: "left", label: "Education", sub: "University", district: "education" },
      { edge: "careerStraight", dir: "straight", label: "Career Road", sub: "2022 →", district: "career" },
      { edge: "projectHighway", dir: "right", label: "Projects", sub: "5 exits", district: "projects" },
    ],
    autopilotOrder: ["projectHighway", "educationRoad", "careerStraight"],
  },
  mergeB: { id: "mergeB", kind: "merge", name: "Career Road", pose: M, exits: [{ edge: "careerLate", dir: "straight", label: "Career Road", sub: "", district: "career" }] },
  end: { id: "end", kind: "end", name: "End of the Road", pose: careerLatePath.end, exits: [] },
};

/** Junction plates (crossroads) — centre and heading. */
export const plates = (["junctionA", "mergeB"] as const).map((id) => {
  const p = nodes[id].pose;
  // junctionA: plate lies ahead of the node; mergeB: behind it.
  const sign = id === "junctionA" ? 1 : -1;
  return { id, x: p.x - Math.sin(p.h) * PLATE_AHEAD * sign, z: p.z - Math.cos(p.h) * PLATE_AHEAD * sign, h: p.h };
});

if (process.env.NODE_ENV !== "production") {
  for (const e of [educationPath, projectPath]) {
    const err = Math.hypot(e.end.x - M.x, e.end.z - M.z);
    if (err > 0.05) console.warn(`[world] branch misses merge by ${err.toFixed(3)} m`);
  }
}

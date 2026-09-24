/**
 * GPS destinations, derived from the graph + placements.
 */
import { exitLabel, SEP } from "@/lib/text";
import { edges, type EdgeId } from "./graph";
import { stations, stopLine, type ContentRef } from "./layout";
import { routeFromChoices } from "./route";

export interface Destination {
  id: string;
  label: string;
  sub: string;
  edge: EdgeId;
  /** Arrival point, metres along the edge. */
  d: number;
  kind: "start" | "station" | "junction" | "end";
  content?: ContentRef;
  x: number;
  z: number;
}

const at = (edge: EdgeId, d: number) => edges[edge].path.pointAt(d);

const endLimit = routeFromChoices({ junctionA: "careerStraight" });
const endD = endLimit.limit - (endLimit.offsetOf("careerLate") ?? 0);

const subFor: Record<string, string> = {
  "st-noor": `Web Developer${SEP}2019`,
  "st-burj-mean": `MEAN Stack Developer${SEP}2021`,
  "st-uoe": "Education",
  "st-burj-lead": `Lead Software Engineer${SEP}2024`,
};

export const destinations: Destination[] = [
  { id: "start", label: "Start", sub: "127.0.0.1", edge: "careerEarly", d: 0, kind: "start", ...at("careerEarly", 0) },
  ...stations
    .filter((st) => st.edge === "careerEarly")
    .map((st) => ({ id: st.id, label: st.gpsLabel, sub: subFor[st.id] ?? "", edge: st.edge, d: st.d - 55, kind: "station" as const, content: st.content, ...at(st.edge, st.d) })),
  { id: "junction", label: "Junction", sub: "Choose your road", edge: stopLine.edge, d: stopLine.d - 2, kind: "junction", ...at(stopLine.edge, stopLine.d) },
  ...stations
    .filter((st) => st.edge !== "careerEarly")
    .map((st) => ({
      id: st.id,
      label: st.gpsLabel,
      sub: st.exit ? `${exitLabel(st.exit)}${SEP}Project` : (subFor[st.id] ?? ""),
      edge: st.edge,
      // Stop where the site is in view ahead: projects are closer together.
      d: st.d - (st.building === "solarSite" ? 62 : st.exit ? 42 : 55),
      kind: "station" as const,
      content: st.content,
      ...at(st.edge, st.d),
    })),
  { id: "end", label: "End of the Road", sub: "Contact", edge: "careerLate", d: endD, kind: "end", ...at("careerLate", endD) },
];

/**
 * A Route is the concrete path the car follows: a chain of edges from `start`
 * chosen by the junction decisions made so far. The car's whole state along
 * the road is a single number `s` — metres from the start of the route.
 */
import { edges, nodes, type Edge, type EdgeId, type GraphNode, type NodeId, type TurnDir } from "./graph";
import { chronoAt, stations, stopLine, END_BARRIER_D, type StationPlacement } from "./layout";
import type { PathSample } from "./path";

export type Choices = Partial<Record<NodeId, EdgeId>>;

export interface RouteLeg {
  edge: Edge;
  /** Route distance at which this edge starts. */
  offset: number;
}

export type RouteEventKind = "station" | "junction" | "turn" | "merge" | "end";

export interface RouteEvent {
  s: number;
  kind: RouteEventKind;
  label: string;
  dir?: TurnDir;
  station?: StationPlacement;
}

const CAR_STOP_BACKOFF = 2; // eye sits ~2 m behind the stop line when stopped

export class Route {
  readonly legs: RouteLeg[];
  readonly length: number;
  /** Node where the route currently ends. */
  readonly endNode: NodeId;
  /** Furthest the car may travel (stop line when undecided, barrier at the end). */
  readonly limit: number;
  readonly events: RouteEvent[];

  constructor(readonly edgeIds: EdgeId[]) {
    let offset = 0;
    this.legs = edgeIds.map((id) => {
      const leg = { edge: edges[id], offset };
      offset += edges[id].path.length;
      return leg;
    });
    this.length = offset;
    this.endNode = this.legs[this.legs.length - 1].edge.to;
    const endNode = nodes[this.endNode];
    if (endNode.kind === "junction") {
      this.limit = this.offsetOf(stopLine.edge)! + stopLine.d - CAR_STOP_BACKOFF;
    } else {
      this.limit = this.length - (this.legs[this.legs.length - 1].edge.path.length - END_BARRIER_D) - 42;
    }
    this.events = this.buildEvents();
  }

  offsetOf(edge: EdgeId): number | undefined {
    return this.legs.find((l) => l.edge.id === edge)?.offset;
  }

  legAt(s: number): { leg: RouteLeg; d: number; index: number } {
    for (let i = this.legs.length - 1; i >= 0; i--) {
      if (s >= this.legs[i].offset || i === 0) return { leg: this.legs[i], d: s - this.legs[i].offset, index: i };
    }
    return { leg: this.legs[0], d: s, index: 0 };
  }

  sample(s: number, out?: PathSample): PathSample {
    const { leg, d } = this.legAt(Math.min(Math.max(s, 0), this.length));
    return leg.edge.path.sample(d, out);
  }

  chrono(s: number): number {
    const { leg, d } = this.legAt(s);
    return chronoAt(leg.edge.id, d);
  }

  /** Route distance of a point on an edge, if that edge is on this route. */
  toS(edge: EdgeId, d: number): number | undefined {
    const o = this.offsetOf(edge);
    return o === undefined ? undefined : o + d;
  }

  private buildEvents(): RouteEvent[] {
    const ev: RouteEvent[] = [];
    for (const leg of this.legs) {
      for (const st of stations) {
        if (st.edge === leg.edge.id) ev.push({ s: leg.offset + st.d, kind: "station", label: st.gpsLabel, station: st });
      }
      const to = nodes[leg.edge.to];
      const end = leg.offset + leg.edge.path.length;
      if (to.kind === "junction") {
        const next = this.legs[this.legs.indexOf(leg) + 1];
        const exit = next && to.exits.find((x) => x.edge === next.edge.id);
        ev.push(
          exit
            ? { s: end, kind: "turn", label: exit.label, dir: exit.dir }
            : { s: this.limit, kind: "junction", label: "Choose your road" },
        );
      } else if (to.kind === "merge") {
        ev.push({ s: end - 12, kind: "merge", label: "Career Road", dir: leg.edge.id === "educationRoad" ? "right" : leg.edge.id === "projectHighway" ? "left" : "straight" });
      } else if (to.kind === "end") {
        ev.push({ s: this.limit, kind: "end", label: "End of the Road" });
      }
    }
    return ev.sort((a, b) => a.s - b.s);
  }

  nextEvent(s: number): RouteEvent | undefined {
    return this.events.find((e) => e.s > s + 3 || ((e.kind === "junction" || e.kind === "end") && e.s >= s - 1));
  }
}

/** Follow the graph from start using the given junction choices. */
export function routeFromChoices(choices: Choices): Route {
  const ids: EdgeId[] = [];
  let node: NodeId = "start";
  for (let guard = 0; guard < 16; guard++) {
    const n: GraphNode = nodes[node];
    if (n.kind === "end") break;
    const next: EdgeId | undefined = n.kind === "junction" ? choices[node] : n.exits[0]?.edge;
    if (!next) break;
    ids.push(next);
    node = edges[next].to;
  }
  return new Route(ids);
}

/** Junction choices required to reach an edge. */
export function choicesFor(target: EdgeId, current: Choices): Choices {
  const next = { ...current };
  for (const n of Object.values(nodes)) {
    if (n.kind === "junction" && n.exits.some((x) => x.edge === target)) next[n.id] = target;
  }
  return next;
}

/** Length of the full journey assuming autopilot defaults at undecided junctions. */
export function estimatedJourneyLength(choices: Choices, visited: Set<EdgeId>): number {
  const filled: Choices = { ...choices };
  for (const n of Object.values(nodes)) {
    if (n.kind === "junction" && !filled[n.id]) filled[n.id] = autopilotChoice(n.id, visited);
  }
  return routeFromChoices(filled).limit;
}

export function autopilotChoice(node: NodeId, visited: Set<EdgeId>): EdgeId {
  const order = nodes[node].autopilotOrder ?? nodes[node].exits.map((x) => x.edge);
  return order.find((e) => !visited.has(e)) ?? order[order.length - 1];
}


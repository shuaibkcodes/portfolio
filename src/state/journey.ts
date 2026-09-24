/**
 * Journey logic: vehicle controller, junction decisions, GPS route travel,
 * intro sequence and the throttled HUD snapshot. Framework-agnostic — the
 * scene calls `stepJourney` once per frame.
 */
import gsap from "gsap";
import { audio } from "@/lib/audio";
import { edges, nodes, OWN_LANE, type EdgeId, type NodeId } from "@/world/graph";
import { rightX, rightZ, type PathSample } from "@/world/path";
import { destinations } from "@/world/destinations";
import type { ContentRef } from "@/world/layout";
import { autopilotChoice, choicesFor, estimatedJourneyLength, routeFromChoices, type Choices } from "@/world/route";
import { drive, resetDrive } from "./drive";
import { useJourney, type HudSnapshot } from "./store";

const CRUISE = 17; // m/s ≈ 61 km/h
const STATION_SPEED = 10.5;
const LATERAL_ACCEL = 2.6; // comfortable cornering, m/s²
const ACCEL = 4.2;
const INPUT_ACCEL = 8; // scroll should feel responsive
const BRAKE = 9;
const COUNTDOWN_S = 7;

const get = useJourney.getState;
const tmp: PathSample = { x: 0, z: 0, h: 0, k: 0 };
const clamp = (x: number, a: number, b: number) => Math.min(Math.max(x, a), b);

// ---------------------------------------------------------------------------
// Intro

export const intro = { rig: 0, cockpit: 0 };

export function startJourney() {
  const st = get();
  if (st.phase !== "title") return;
  st.setPhase("intro");
  audio.setEnabled(st.sound);
  const tl = gsap.timeline({
    onComplete: () => {
      get().setPhase("driving");
      get().showToast("Autopilot engaged", st.mobile ? "Swipe to drive yourself" : "Scroll or use ↑ ↓ to take the wheel");
    },
  });
  tl.to(intro, { rig: 1, duration: st.reducedMotion ? 1.2 : 3.4, ease: "power2.inOut" }, 0.15);
  tl.to(intro, { cockpit: 1, duration: 1.6, ease: "power3.out" }, st.reducedMotion ? 0.3 : 1.9);
  tl.call(() => audio.engineStart(), [], st.reducedMotion ? 0.8 : 2.6);
}

// ---------------------------------------------------------------------------
// Input

export function applyScroll(deltaPx: number) {
  const st = get();
  if (st.phase !== "driving" && st.phase !== "arrived") return;
  if (st.panel || st.mapOpen) return;
  if (drive.travelling) cancelTravel();
  const now = performance.now();
  if (now - drive.lastInputAt > 900) drive.targetS = drive.s;
  drive.targetS = clamp(drive.targetS + deltaPx * 0.2, Math.max(0, drive.s - 120), Math.min(drive.route.limit, drive.s + 220));
  drive.lastInputAt = now;
}

export function setThrottle(v: number) {
  if (v !== 0 && drive.travelling) cancelTravel();
  drive.throttle = v;
  if (v !== 0) drive.lastInputAt = performance.now();
}

export function setSteer(v: number) {
  drive.steer = v;
  if (v !== 0) drive.lastSteerAt = performance.now();
}

// ---------------------------------------------------------------------------
// Junctions

export function choose(node: NodeId, edge: EdgeId) {
  const st = get();
  if (st.choices[node] === edge) return;
  const choices: Choices = { ...st.choices, [node]: edge };
  useJourney.setState({ choices });
  drive.route = routeFromChoices(choices);
  const offset = drive.route.offsetOf(edge) ?? 0;
  // Creep through the turn if we are stopped at (or near) the line.
  if (drive.s > offset - 40) drive.maneuverUntil = offset + 30;
  const exit = nodes[node].exits.find((x) => x.edge === edge)!;
  st.showToast(exit.dir === "straight" ? "Continue straight" : `Turn ${exit.dir}`, `${exit.label}`);
  audio.chime();
}

/** Undecided junction the route currently ends at, if any. */
function pendingJunction(): NodeId | null {
  const n = nodes[drive.route.endNode];
  return n.kind === "junction" ? n.id : null;
}

// ---------------------------------------------------------------------------
// Panels

export function openPanel(content: ContentRef) {
  if (drive.travelling) cancelTravel();
  useJourney.setState({ panel: content, mapOpen: false });
}

export function closePanel() {
  useJourney.setState({ panel: null });
  drive.lastInputAt = performance.now() - 1000;
}

// ---------------------------------------------------------------------------
// GPS route travel

let travelTl: gsap.core.Timeline | null = null;

export function cancelTravel() {
  travelTl?.kill();
  travelTl = null;
  drive.travelling = false;
  drive.v = clamp(drive.v, -12, 26);
  drive.targetS = drive.s;
  useJourney.setState({ travelTarget: null });
}

export function travelTo(destId: string) {
  const dest = destinations.find((d) => d.id === destId);
  if (!dest) return;
  const st = get();
  if (st.phase !== "driving" && st.phase !== "arrived") return;
  cancelTravel();
  useJourney.setState({ panel: null, mapOpen: false, travelTarget: destId, phase: "driving" });

  let choices = choicesFor(dest.edge, st.choices);
  let target = routeFromChoices(choices);
  if (target.toS(dest.edge, dest.d) === undefined) {
    choices = { ...choices, junctionA: choices.junctionA ?? "careerStraight" };
    target = routeFromChoices(choices);
  }
  const targetS = Math.min(target.toS(dest.edge, dest.d)!, target.limit);

  // Shared prefix between the current and target routes.
  let common = 0;
  const cur = drive.route.edgeIds;
  for (let i = 0; i < Math.min(cur.length, target.edgeIds.length) && cur[i] === target.edgeIds[i]; i++) common += edges[cur[i]].path.length;

  const proxy = { s: drive.s };
  const tl = gsap.timeline({
    onUpdate: () => {
      drive.s = proxy.s;
    },
    onComplete: () => {
      drive.travelling = false;
      drive.v = 0;
      drive.targetS = drive.s;
      travelTl = null;
      useJourney.setState({ travelTarget: null });
      if (dest.kind === "station" && dest.content) openPanel(dest.content);
    },
  });
  const duration = (dist: number) => clamp(1.3 + Math.sqrt(Math.abs(dist)) * 0.085, 1.4, 5.5);

  const swap = () => {
    useJourney.setState({ choices });
    drive.route = target;
  };

  if (drive.s > common + 0.01) {
    st.showToast("Rerouting…", dest.label);
    tl.to(proxy, { s: common, duration: duration(drive.s - common), ease: "power2.inOut" });
    tl.call(swap);
  } else {
    swap();
    st.showToast("Route set", dest.label);
  }
  tl.to(proxy, { s: targetS, duration: duration(targetS - (drive.s > common ? common : drive.s)), ease: "power2.inOut" });

  drive.travelling = true;
  drive.maneuverUntil = -1;
  travelTl = tl;
  audio.chime();
}

if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __journey: unknown }).__journey = { drive, useJourney, travelTo, choose, openPanel };
}

// ---------------------------------------------------------------------------
// Restart

export function restart() {
  cancelTravel();
  resetDrive();
  useJourney.setState({
    phase: "driving",
    choices: {},
    visitedEdges: ["careerEarly"],
    visitedStations: [],
    panel: null,
    mapOpen: false,
  });
  get().showToast("Back to 127.0.0.1", "The road so far — again");
}

// ---------------------------------------------------------------------------
// Per-frame controller

let prevS = 0;
let hudTimer = 0;
let countdownStart = -1;
let lastSignalTick = 0;
let announcedJunction = false;

export function stepJourney(dt: number, now: number) {
  const st = get();
  const r = drive.route;
  const driving = st.phase === "driving" || st.phase === "arrived";

  if (driving && drive.travelling) {
    const v = (drive.s - prevS) / Math.max(dt, 1e-3);
    drive.accel += ((v - drive.v) / Math.max(dt, 1e-3) - drive.accel) * 0.1;
    drive.v = v;
  } else if (driving) {
    let vd = 0;
    // Scroll/touch target: Explore chases it until reached; Autopilot resumes cruising shortly after input stops.
    const inputWindow = st.mode === "explore" ? 6000 : 1500;
    const inputActive = now - drive.lastInputAt < inputWindow && Math.abs(drive.targetS - drive.s) > 0.25;
    if (drive.throttle > 0) vd = 26;
    else if (drive.throttle < 0) vd = drive.v > 0.5 ? 0 : -7;
    else if (inputActive) vd = clamp((drive.targetS - drive.s) * 1.4, -16, 42);
    else if (drive.maneuverUntil > drive.s) vd = 7;
    else if (st.mode === "autopilot" && now - drive.lastInputAt > 1500) {
      vd = CRUISE;
      const next = r.events.find((e) => e.kind === "station" && e.s > drive.s - 40);
      if (next && next.s - drive.s < 180) vd = STATION_SPEED;
    }
    if (st.panel) vd = 0;

    // Corner speed look-ahead: never enter a curve faster than LATERAL_ACCEL allows.
    if (vd > 0) {
      for (let a = 0; a <= 70; a += 7) {
        const k = Math.abs(r.sample(drive.s + a, tmp).k);
        if (k > 1e-4) vd = Math.min(vd, Math.sqrt(LATERAL_ACCEL / k + 2 * 3.5 * a));
      }
    }
    // Smooth stop at the route limit (stop line / end barrier) and at the start.
    vd = Math.min(vd, Math.sqrt(2 * 3.6 * Math.max(r.limit - drive.s, 0)));
    vd = Math.max(vd, -Math.sqrt(2 * 5 * Math.max(drive.s, 0)));

    const dv = vd - drive.v;
    const braking = Math.sign(dv) !== Math.sign(drive.v) && Math.abs(drive.v) > 0.05;
    const lim = (braking ? BRAKE : inputActive ? INPUT_ACCEL : ACCEL) * dt;
    const prevV = drive.v;
    drive.v += clamp(dv, -lim, lim);
    drive.accel += ((drive.v - prevV) / Math.max(dt, 1e-3) - drive.accel) * 0.12;
    drive.s += drive.v * dt;
    if (drive.s >= r.limit) {
      drive.s = r.limit;
      drive.v = Math.min(drive.v, 0);
    }
    if (drive.s <= 0) {
      drive.s = 0;
      drive.v = Math.max(drive.v, 0);
    }
  }
  prevS = drive.s;

  // Lateral: keyboard steering within the carriageway; autopilot returns to lane.
  const sample = r.sample(drive.s, tmp);
  const cornering = Math.abs(sample.k) > 0.01;
  const steerIdle = now - drive.lastSteerAt > 2500;
  let latTarget = drive.lateral;
  if (drive.steer !== 0 && !cornering) latTarget = drive.lateral + drive.steer * 2.5;
  else if (cornering || (st.mode === "autopilot" && steerIdle) || drive.travelling) latTarget = OWN_LANE;
  latTarget = clamp(latTarget, -3.2, 3.2);
  const latAcc = (latTarget - drive.lateral) * 6 - drive.lateralV * 4.2;
  drive.lateralV += latAcc * dt;
  drive.lateral += drive.lateralV * dt;

  drive.x = sample.x + rightX(sample.h) * drive.lateral;
  drive.z = sample.z + rightZ(sample.h) * drive.lateral;
  drive.heading = sample.h - Math.atan2(drive.lateralV, Math.max(Math.abs(drive.v), 3)) * 0.9;
  drive.curvature = sample.k;
  drive.chrono = st.phase === "loading" || st.phase === "title" ? 2018.9 : r.chrono(drive.s);

  audio.update(drive.v, drive.accel, st.phase !== "loading" && st.phase !== "title");

  if (!driving) return;

  // Junction: announce, then (autopilot) count down to a default choice.
  const pj = pendingJunction();
  if (pj && drive.s > r.limit - 320 && !announcedJunction) {
    announcedJunction = true;
    st.showToast("Junction ahead", "Choose your road");
    audio.chime();
  }
  if (!pj) announcedJunction = false;
  const waiting = !!pj && drive.s >= r.limit - 0.6 && !drive.travelling;
  if (waiting && st.mode === "autopilot" && !st.panel) {
    if (countdownStart < 0) countdownStart = now;
    if (now - countdownStart > COUNTDOWN_S * 1000) {
      countdownStart = -1;
      choose(pj!, autopilotChoice(pj!, new Set(st.visitedEdges)));
    }
  } else countdownStart = -1;

  // Visits.
  const { leg } = r.legAt(drive.s);
  if (!st.visitedEdges.includes(leg.edge.id)) useJourney.setState({ visitedEdges: [...st.visitedEdges, leg.edge.id] });
  for (const e of r.events) {
    if (e.kind === "station" && e.station && drive.s > e.s - 60 && !st.visitedStations.includes(e.station.id)) {
      useJourney.setState({ visitedStations: [...get().visitedStations, e.station.id] });
    }
  }

  // Arrival at the end of the road.
  const atEnd = drive.route.endNode === "end" && drive.s >= r.limit - 0.5 && Math.abs(drive.v) < 0.4;
  if (atEnd && st.phase === "driving") st.setPhase("arrived");
  else if (!atEnd && st.phase === "arrived" && drive.s < r.limit - 5) st.setPhase("driving");

  hudTimer += dt;
  if (hudTimer >= 0.1) {
    hudTimer = 0;
    updateHud(now, waiting);
  }
}

function updateHud(now: number, waiting: boolean) {
  const st = get();
  const r = drive.route;
  const { leg } = r.legAt(drive.s);
  const next = r.nextEvent(drive.s);
  const pj = pendingJunction();

  let signal: HudSnapshot["signal"] = null;
  if (next && (next.kind === "turn" || next.kind === "merge") && next.dir && next.dir !== "straight" && next.s - drive.s < 110) signal = next.dir;
  if (drive.maneuverUntil > drive.s) {
    const edge = r.legAt(drive.maneuverUntil).leg.edge.id;
    const exit = nodes.junctionA.exits.find((x) => x.edge === edge);
    if (exit && exit.dir !== "straight") signal = exit.dir;
  }
  if (signal && now - lastSignalTick > 400) {
    lastSignalTick = now;
    audio.tick();
  }

  const stationEv = r.events
    .filter((e) => e.kind === "station" && drive.s > e.s - 170 && drive.s < e.s + 45)
    .sort((a, b) => Math.abs(a.s - drive.s) - Math.abs(b.s - drive.s))[0];

  const year = leg.edge.district === "career" ? Math.max(2019, Math.floor(drive.chrono + 1e-6)) : null;

  const hud: HudSnapshot = {
    year,
    location: leg.edge.name,
    district: leg.edge.district,
    next: next ? { kind: next.kind, label: next.label, dir: next.dir, distance: Math.max(0, next.s - drive.s) } : null,
    progress: clamp(drive.s / estimatedJourneyLength(st.choices, new Set(st.visitedEdges)), 0, 1),
    speed: Math.round(Math.abs(drive.v) * 3.6),
    nearby: stationEv?.station ? { stationId: stationEv.station.id, label: stationEv.station.gpsLabel, content: stationEv.station.content } : null,
    signal,
    junction: pj && drive.s > r.limit - 260 ? (waiting ? "waiting" : "approaching") : "none",
    countdown: waiting && st.mode === "autopilot" && countdownStart > 0 ? Math.max(0, Math.ceil(COUNTDOWN_S - (now - countdownStart) / 1000)) : null,
  };
  const prev = st.hud;
  const changed = (Object.keys(hud) as (keyof HudSnapshot)[]).some((k) => JSON.stringify(hud[k]) !== JSON.stringify(prev[k]));
  if (changed) useJourney.setState({ hud });
}

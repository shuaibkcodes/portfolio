/**
 * High-frequency vehicle state, mutated every frame outside React.
 * UI reads it via requestAnimationFrame / the throttled HUD snapshot.
 */
import { OWN_LANE } from "@/world/graph";
import { routeFromChoices, type Route } from "@/world/route";

export const drive = {
  route: routeFromChoices({}) as Route,
  /** metres along the route */
  s: 0,
  /** m/s along the route (negative = reversing) */
  v: 0,
  /** smoothed longitudinal acceleration, m/s² */
  accel: 0,

  /** Scroll / touch target. The car chases it with speed & acceleration limits. */
  targetS: 0,
  lastInputAt: -1e9,
  /** Keyboard: -1 brake/reverse … 1 accelerate */
  throttle: 0,
  /** Keyboard: -1 left … 1 right */
  steer: 0,
  lastSteerAt: -1e9,

  lateral: OWN_LANE,
  lateralV: 0,

  /** A GPS route animation owns `s` while true. */
  travelling: false,
  /** Car creeps through a junction turn until this route distance. */
  maneuverUntil: -1,

  /** Normalised pointer position for look-around, -1…1. */
  look: { x: 0, y: 0 },

  // Derived pose (written by the controller each frame).
  x: 0,
  z: 0,
  heading: 0,
  curvature: 0,
  chrono: 2018.9,
};

export type Drive = typeof drive;

export function resetDrive() {
  drive.route = routeFromChoices({});
  drive.s = 0;
  drive.v = 0;
  drive.accel = 0;
  drive.targetS = 0;
  drive.lastInputAt = -1e9;
  drive.throttle = 0;
  drive.steer = 0;
  drive.lateral = OWN_LANE;
  drive.lateralV = 0;
  drive.travelling = false;
  drive.maneuverUntil = -1;
}

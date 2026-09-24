/**
 * Road centre-lines are authored as exact line/arc sequences (a "turtle" path),
 * so branch roads provably rejoin the main road and curvature is known
 * analytically (used for steering wheel angle, body roll and look-ahead).
 *
 * Conventions (world space, metres, y up):
 *   heading h = 0 points along -Z ("north"); positive h turns LEFT (towards -X).
 */

export type Segment =
  | { kind: "line"; length: number }
  | { kind: "arc"; radius: number; /** signed radians, + = left */ angle: number };

export interface Pose {
  x: number;
  z: number;
  h: number;
}

export interface PathSample extends Pose {
  /** Signed curvature (1/m), + = turning left. */
  k: number;
}

export const line = (length: number): Segment => ({ kind: "line", length });
export const left = (radius: number, degrees: number): Segment => ({ kind: "arc", radius, angle: (degrees * Math.PI) / 180 });
export const right = (radius: number, degrees: number): Segment => ({ kind: "arc", radius, angle: (-degrees * Math.PI) / 180 });

export const dirX = (h: number) => -Math.sin(h);
export const dirZ = (h: number) => -Math.cos(h);
/** Unit vector pointing to the RIGHT of heading h. */
export const rightX = (h: number) => Math.cos(h);
export const rightZ = (h: number) => -Math.sin(h);

const STEP = 0.5;

export class RoadPath {
  readonly length: number;
  readonly start: Pose;
  readonly end: Pose;
  private readonly xs: Float32Array;
  private readonly zs: Float32Array;
  private readonly hs: Float32Array;
  private readonly ks: Float32Array;

  constructor(start: Pose, segments: Segment[]) {
    const total = segments.reduce((sum, s) => sum + (s.kind === "line" ? s.length : Math.abs(s.angle) * s.radius), 0);
    const n = Math.ceil(total / STEP) + 1;
    this.xs = new Float32Array(n);
    this.zs = new Float32Array(n);
    this.hs = new Float32Array(n);
    this.ks = new Float32Array(n);
    this.start = { ...start };

    // Integrate in float64; store float32 samples every STEP metres.
    let x = start.x;
    let z = start.z;
    let h = start.h;
    let i = 0;
    let carried = 0; // distance travelled into the current STEP
    this.xs[0] = x;
    this.zs[0] = z;
    this.hs[0] = h;
    this.ks[0] = segments[0]?.kind === "arc" ? Math.sign(segments[0].angle) / segments[0].radius : 0;

    for (const seg of segments) {
      const segLen = seg.kind === "line" ? seg.length : Math.abs(seg.angle) * seg.radius;
      const k = seg.kind === "line" ? 0 : Math.sign(seg.angle) / seg.radius;
      let remaining = segLen;
      while (remaining > 1e-9) {
        const ds = Math.min(STEP - carried, remaining);
        if (k === 0) {
          x += dirX(h) * ds;
          z += dirZ(h) * ds;
        } else {
          // Exact chord of a circular arc.
          const dh = k * ds;
          const chord = (2 * Math.sin(dh / 2)) / k;
          x += dirX(h + dh / 2) * chord;
          z += dirZ(h + dh / 2) * chord;
          h += dh;
        }
        remaining -= ds;
        carried += ds;
        if (carried >= STEP - 1e-9 && i + 1 < n) {
          i++;
          this.xs[i] = x;
          this.zs[i] = z;
          this.hs[i] = h;
          this.ks[i] = k;
          carried = 0;
        }
      }
    }
    // Final exact point (the last partial step).
    const last = Math.min(i + 1, n - 1);
    this.xs[last] = x;
    this.zs[last] = z;
    this.hs[last] = h;
    this.ks[last] = this.ks[i];
    this.length = total;
    this.end = { x, z, h };
  }

  /** Sample at distance d (clamped). Writes into `out` to avoid allocation in the frame loop. */
  sample(d: number, out: PathSample = { x: 0, z: 0, h: 0, k: 0 }): PathSample {
    const clamped = Math.min(Math.max(d, 0), this.length);
    const f = clamped / STEP;
    const i = Math.min(Math.floor(f), this.xs.length - 2);
    // The final interval is usually shorter than STEP.
    const span = i === this.xs.length - 2 ? this.length - i * STEP : STEP;
    const t = span > 1e-9 ? Math.min((clamped - i * STEP) / span, 1) : 0;
    out.x = this.xs[i] + (this.xs[i + 1] - this.xs[i]) * t;
    out.z = this.zs[i] + (this.zs[i + 1] - this.zs[i]) * t;
    out.h = this.hs[i] + (this.hs[i + 1] - this.hs[i]) * t;
    out.k = t < 0.5 ? this.ks[i] : this.ks[i + 1];
    return out;
  }

  /** World position offset laterally (+ = right of travel direction). */
  pointAt(d: number, lateral = 0): { x: number; z: number; h: number } {
    const s = this.sample(d);
    return { x: s.x + rightX(s.h) * lateral, z: s.z + rightZ(s.h) * lateral, h: s.h };
  }

  /** Evenly spaced samples for building geometry / map paths. */
  samples(spacing: number): PathSample[] {
    const out: PathSample[] = [];
    const count = Math.max(1, Math.ceil(this.length / spacing));
    for (let j = 0; j <= count; j++) out.push(this.sample((j / count) * this.length, { x: 0, z: 0, h: 0, k: 0 }));
    return out;
  }
}

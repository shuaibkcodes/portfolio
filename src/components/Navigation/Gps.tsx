"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useJourney, type HudSnapshot } from "@/state/store";
import { drive } from "@/state/drive";
import { choose, travelTo } from "@/state/journey";
import { edgeList, nodes, type EdgeId } from "@/world/graph";
import { destinations } from "@/world/destinations";
import { routeFromChoices } from "@/world/route";
import { projects } from "@/data/portfolio";
import { SEP } from "@/lib/text";
import s from "@/components/Dashboard/hud.module.css";
import { Close, Flag, Merge, Pin, Split, Straight, TurnLeft, TurnRight } from "@/components/Dashboard/icons";

// --- geometry ---------------------------------------------------------------------

const mapPaths = edgeList.map((e) => {
  const pts = e.path.samples(6);
  return { id: e.id, length: e.path.length, d: "M" + pts.map((p) => `${p.x.toFixed(1)} ${p.z.toFixed(1)}`).join("L") };
});

const allPts = edgeList.flatMap((e) => e.path.samples(20));
const bounds = {
  minX: Math.min(...allPts.map((p) => p.x)),
  maxX: Math.max(...allPts.map((p) => p.x)),
  minZ: Math.min(...allPts.map((p) => p.z)),
  maxZ: Math.max(...allPts.map((p) => p.z)),
};

export function formatDistance(m: number) {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  if (m < 20) return "now";
  return `${Math.round(m / 10) * 10} m`;
}

export function NextIcon({ next, className }: { next: HudSnapshot["next"]; className?: string }) {
  if (!next) return <Pin className={className} />;
  if (next.kind === "junction") return <Split className={className} />;
  if (next.kind === "end") return <Flag className={className} />;
  if (next.kind === "merge") return <Merge className={className} />;
  if (next.kind === "turn") return next.dir === "left" ? <TurnLeft className={className} /> : next.dir === "right" ? <TurnRight className={className} /> : <Straight className={className} />;
  return <Pin className={className} />;
}

/** Road network drawn in world units. `traveled` refs are dash-animated per frame. */
function Network({ routeIds, pending, traveledRef, strokeScale = 1 }: { routeIds: EdgeId[]; pending: boolean; traveledRef?: React.RefObject<Record<string, SVGPathElement | null>>; strokeScale?: number }) {
  const onRoute = new Set(routeIds);
  const options = pending ? new Set(nodes.junctionA.exits.map((x) => x.edge)) : new Set<EdgeId>();
  return (
    <>
      {mapPaths.map((p) => (
        <path key={`base-${p.id}`} d={p.d} fill="none" stroke="#263241" strokeWidth={10 * strokeScale} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
      {mapPaths.map((p) =>
        onRoute.has(p.id) ? (
          <path key={`route-${p.id}`} d={p.d} fill="none" stroke="#5aa9ff" strokeWidth={5 * strokeScale} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ) : options.has(p.id) ? (
          <path key={`opt-${p.id}`} d={p.d} fill="none" stroke="#5aa9ff" strokeOpacity={0.45} strokeDasharray="2 6" strokeWidth={3 * strokeScale} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
      {traveledRef &&
        mapPaths.map((p) => (
          <path
            key={`done-${p.id}`}
            ref={(el) => {
              traveledRef.current[p.id] = el;
            }}
            d={p.d}
            fill="none"
            stroke="#8b96a3"
            strokeWidth={4.5 * strokeScale}
            strokeLinecap="round"
            pathLength={p.length}
            strokeDasharray={`0 ${p.length + 10}`}
            vectorEffect="non-scaling-stroke"
          />
        ))}
    </>
  );
}

function useRouteState() {
  const choices = useJourney((st) => st.choices);
  return useMemo(() => {
    const r = routeFromChoices(choices);
    return { ids: r.edgeIds, pending: nodes[r.endNode].kind === "junction" };
  }, [choices]);
}

/** Per-frame: update traveled overlay on the current route. */
function updateTraveled(refs: Record<string, SVGPathElement | null>) {
  const { index, d } = drive.route.legAt(drive.s);
  const onRoute = new Map(drive.route.legs.map((l, i) => [l.edge.id, i]));
  for (const p of mapPaths) {
    const el = refs[p.id];
    if (!el) continue;
    const i = onRoute.get(p.id);
    const done = i === undefined ? 0 : i < index ? p.length : i === index ? d : 0;
    el.setAttribute("stroke-dasharray", `${done.toFixed(1)} ${p.length + 10}`);
  }
}

// --- dashboard GPS --------------------------------------------------------------

const W = 320;
const H = 184;
const SCALE = 0.36;

export function Gps() {
  const hud = useJourney((st) => st.hud);
  const setMapOpen = useJourney((st) => st.setMapOpen);
  const visited = useJourney((st) => st.visitedStations.length);
  const route = useRouteState();
  const group = useRef<SVGGElement>(null);
  const labels = useRef<(SVGGElement | null)[]>([]);
  const traveled = useRef<Record<string, SVGPathElement | null>>({});

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const deg = (drive.heading * 180) / Math.PI;
      group.current?.setAttribute("transform", `translate(${W / 2} ${H * 0.7}) rotate(${deg.toFixed(2)}) scale(${SCALE}) translate(${(-drive.x).toFixed(2)} ${(-drive.z).toFixed(2)})`);
      // Keep labels upright.
      labels.current.forEach((el, i) => {
        const dst = destinations[i];
        el?.setAttribute("transform", `translate(${dst.x} ${dst.z}) rotate(${-deg.toFixed(2)}) scale(${1 / SCALE})`);
      });
      updateTraveled(traveled.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const next = hud.next;
  const label =
    next?.kind === "junction" ? "Junction — choose your road" : next?.kind === "turn" ? `Turn ${next.dir === "straight" ? "straight" : next.dir}${SEP}${next.label}` : next?.kind === "merge" ? `Merge${SEP}Career Road` : next?.label ?? "Keep going";

  return (
    <section className={`${s.gps} ${s.glass}`} aria-label="Navigation">
      <div className={s.gpsHead}>
        <NextIcon next={next} className={s.gpsIcon} />
        <div style={{ minWidth: 0 }}>
          <div className={s.gpsNext}>NEXT</div>
          <div className={s.gpsLabel}>{label}</div>
        </div>
        <div className={s.gpsDist}>{next ? formatDistance(next.distance) : ""}</div>
      </div>
      <svg className={s.gpsMap} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map. Current road: ${hud.location}.`}>
        <defs>
          <radialGradient id="gpsFade" cx="50%" cy="70%" r="75%">
            <stop offset="60%" stopColor="#070b10" stopOpacity="0" />
            <stop offset="100%" stopColor="#070b10" stopOpacity="1" />
          </radialGradient>
        </defs>
        <g ref={group}>
          <Network routeIds={route.ids} pending={route.pending} traveledRef={traveled} />
          {destinations.map((dst, i) => (
            <g key={dst.id} ref={(el) => void (labels.current[i] = el)}>
              <circle r={4} fill="#070b10" stroke={dst.kind === "end" ? "#ffb547" : "#e8eef5"} strokeWidth={2} />
              <text x={8} y={4} fontSize={10.5} fontWeight={700} fill="#c7d0da" style={{ fontFamily: "var(--font-sans)" }}>
                {dst.label}
              </text>
            </g>
          ))}
        </g>
        <rect width={W} height={H} fill="url(#gpsFade)" pointerEvents="none" />
        <g transform={`translate(${W / 2} ${H * 0.7})`}>
          <circle r={14} fill="rgba(90,169,255,0.15)" />
          <path d="M0 -9 L7 7 L0 3 L-7 7 Z" fill="#fff" stroke="#5aa9ff" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      </svg>
      <div className={s.gpsFoot}>
        <span>
          {hud.location}
          {SEP}
          {visited}/{destinations.filter((d) => d.kind === "station").length} stops
        </span>
        <button type="button" className={s.textBtn} onClick={() => setMapOpen(true)}>
          Destinations
        </button>
      </div>
    </section>
  );
}

// --- full map -----------------------------------------------------------------------

export function MapOverlay() {
  const open = useJourney((st) => st.mapOpen);
  const setMapOpen = useJourney((st) => st.setMapOpen);
  const visited = useJourney((st) => st.visitedStations);
  const route = useRouteState();
  const car = useRef<SVGGElement>(null);
  const traveled = useRef<Record<string, SVGPathElement | null>>({});
  const closeRef = useRef<HTMLButtonElement>(null);

  // Journey runs left → right: rotate(90) maps world (x, z) → (−z, x), so north points right.
  const pad = 90;
  const vbW = bounds.maxZ - bounds.minZ + pad * 2;
  const vbH = bounds.maxX - bounds.minX + pad * 2;
  const transform = `translate(${bounds.maxZ + pad} ${-bounds.minX + pad}) rotate(90)`;
  const u = vbW / 1000; // one screen pixel at ~1000px map width

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    let raf = 0;
    const loop = () => {
      car.current?.setAttribute("transform", `translate(${drive.x.toFixed(1)} ${drive.z.toFixed(1)}) rotate(${((-drive.heading * 180) / Math.PI).toFixed(1)})`);
      updateTraveled(traveled.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  if (!open) return null;

  return (
    <div className={s.mapOverlay} onClick={() => setMapOpen(false)} role="dialog" aria-modal="true" aria-label="Journey map">
      <div className={`${s.mapCard} ${s.glass}`} onClick={(e) => e.stopPropagation()} data-scroll-lock>
        <div className={s.mapCardHead}>
          <h2 className={s.mapTitle}>The road so far — map</h2>
          <button ref={closeRef} type="button" className={`${s.iconBtn}`} style={{ border: 0, background: "none" }} onClick={() => setMapOpen(false)} aria-label="Close map">
            <Close width={20} />
          </button>
        </div>
        <svg className={s.mapBig} viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet">
          <g transform={transform}>
            <Network routeIds={route.ids} pending={route.pending} traveledRef={traveled} strokeScale={1.2} />
            {destinations.map((dst) => (
              <g key={dst.id} transform={`translate(${dst.x} ${dst.z})`} style={{ cursor: "pointer" }} onClick={() => travelTo(dst.id)}>
                <circle r={6 * u} fill={visited.includes(dst.id) ? "#5aa9ff" : "#0b1016"} stroke={dst.kind === "end" ? "#ffb547" : "#e8eef5"} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
                <g transform="rotate(-90)">
                  <text y={-12 * u} textAnchor="middle" fontSize={12.5 * u} fontWeight={800} fill="#e8eef5" style={{ fontFamily: "var(--font-sans)" }}>
                    {dst.label}
                  </text>
                </g>
              </g>
            ))}
            <g ref={car}>
              <g transform={`scale(${u * 0.7})`}>
                <circle r={16} fill="rgba(90,169,255,0.2)" />
                <path d="M0 -12 L9 9 L0 4 L-9 9 Z" fill="#fff" stroke="#5aa9ff" strokeWidth={2} />
              </g>
            </g>
          </g>
        </svg>
        <ul className={s.destList} aria-label="Destinations">
          {destinations.map((dst) => (
            <li key={dst.id}>
              <button type="button" className={s.dest} onClick={() => travelTo(dst.id)}>
                <span className={`${s.destDot} ${visited.includes(dst.id) ? s.destVisited : ""}`} aria-hidden />
                <span className={s.destLabel}>{dst.label}</span>
                <span className={s.destSub}>
                  {dst.sub}
                  {visited.includes(dst.id) ? `${SEP}visited` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// --- junction chooser -------------------------------------------------------------------

const exitColor = { education: "var(--education)", career: "var(--career)", projects: "var(--project)" } as const;
const exitIcon: Record<string, ReactNode> = {
  left: <TurnLeft className={s.choiceArrow} />,
  straight: <Straight className={s.choiceArrow} />,
  right: <TurnRight className={s.choiceArrow} />,
};

export function JunctionChooser() {
  const junction = useJourney((st) => st.hud.junction);
  const countdown = useJourney((st) => st.hud.countdown);
  const decided = useJourney((st) => !!st.choices.junctionA);
  const visited = useJourney((st) => st.visitedEdges);
  const mode = useJourney((st) => st.mode);
  if (junction === "none" || decided) return null;
  return (
    <div className={s.chooser} role="group" aria-label="Junction — choose a road">
      <div className={s.chooserTitle}>Choose your road</div>
      <div className={s.choices}>
        {nodes.junctionA.exits.map((x) => (
          <button key={x.edge} type="button" className={s.choice} style={{ background: exitColor[x.district] }} onClick={() => choose("junctionA", x.edge)}>
            {exitIcon[x.dir]}
            <span className={s.choiceLabel}>{x.label}</span>
            <span className={s.choiceSub}>
              {x.edge === "educationRoad" ? "University of Education" : x.edge === "projectHighway" ? `${projects.length} project exits` : "Straight on to 2022 →"}
              {visited.includes(x.edge) ? `${SEP}visited` : ""}
            </span>
            <span className={s.choiceKey}>{x.dir === "left" ? "← / A" : x.dir === "right" ? "→ / D" : "↑ / W"}</span>
          </button>
        ))}
      </div>
      {mode === "autopilot" && countdown !== null && <div className={s.countdown}>Autopilot continues to Projects in {countdown}s</div>}
    </div>
  );
}


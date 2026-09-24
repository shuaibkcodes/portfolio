"use client";

import { memo, useMemo, useRef, useState } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Color, MeshLambertMaterial, MeshStandardMaterial } from "three";
import { useJourney } from "@/state/store";
import { choose } from "@/state/journey";
import { drive } from "@/state/drive";
import { edges, nodes, OWN_LANE, ROAD_HALF_WIDTH, SHOULDER, type EdgeId } from "@/world/graph";
import { END_BARRIER_D, placements, stopLine, yearGates, type Placement, type SignPlacement, type YearGate } from "@/world/layout";
import { FONT_BOLD, arrowGeometry, arrowRotation, darkMetal, metal } from "@/components/Scene/materials";
import { DiamondSign, GantryFrame, PostSign, SignPanel, panelSize, type SignLine } from "@/components/RoadSigns/Sign";
import { Station } from "@/components/Experience/Station";

const SIGN_LAT = ROAD_HALF_WIDTH + SHOULDER + 1.6;
const GANTRY_H = 6.3;

function place(edge: EdgeId, d: number, lateral = 0) {
  return edges[edge].path.pointAt(d, lateral);
}

const paint = new MeshLambertMaterial({ color: "#8e8e8a", emissive: new Color("#8e8e8a"), emissiveIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

// --- year gates ----------------------------------------------------------------------

const YearGateView = memo(function YearGateView({ gate }: { gate: YearGate }) {
  const p = place(gate.edge, gate.d);
  const road = place(gate.edge, gate.d - 32, OWN_LANE);
  const lines: SignLine[] = [{ text: String(gate.year), size: 1.45 }];
  if (gate.sub) lines.push({ text: gate.sub, size: 0.42, bold: false });
  return (
    <>
      <group position={[p.x, 0, p.z]} rotation-y={p.h}>
        <GantryFrame span={2 * (ROAD_HALF_WIDTH + SHOULDER) + 0.6} height={GANTRY_H} />
        <group position={[OWN_LANE, GANTRY_H + 1.2, 0.05]}>
          <SignPanel style="info" lines={lines} minWidth={5.4} pad={0.45} />
        </group>
      </group>
      {/* Year painted on the asphalt, stretched for a driver's grazing view. */}
      <group position={[road.x, 0.04, road.z]} rotation-y={road.h}>
        <Text font={FONT_BOLD} fontSize={2.2} rotation-x={-Math.PI / 2} scale={[1, 2.4, 1]} anchorX="center" anchorY="middle" material={paint}>
          {String(gate.year)}
        </Text>
      </group>
    </>
  );
});

// --- generic signs --------------------------------------------------------------------

const SignView = memo(function SignView({ sign }: { sign: SignPlacement }) {
  const lat = (sign.side === "left" ? -1 : 1) * SIGN_LAT;
  const p = place(sign.edge, sign.d, lat);
  const yaw = p.h + (sign.side === "left" ? 0.18 : -0.18);
  if (sign.shape === "diamond") {
    return (
      <group position={[p.x, 0, p.z]} rotation-y={yaw}>
        <PostSign w={1} h={3.1} clearance={1.4}>
          <DiamondSign style={sign.style} lines={sign.lines} />
        </PostSign>
      </group>
    );
  }
  const lines: SignLine[] = sign.lines.map((t, i) => ({ text: t, size: i === 0 ? 0.62 : 0.46, bold: i === 0 }));
  const { w, h } = panelSize(lines, sign.arrow);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={yaw}>
      <PostSign w={w} h={h}>
        <SignPanel style={sign.style} lines={lines} arrow={sign.arrow} />
      </PostSign>
    </group>
  );
});

// --- junction ---------------------------------------------------------------------------

function JunctionGantry({ edge, d }: { edge: EdgeId; d: number }) {
  const p = place(edge, d);
  const chosen = useJourney((s) => s.choices.junctionA);
  const exits = nodes.junctionA.exits;
  const xs = { left: -4.7, straight: 0, right: 4.7 } as const;
  const style = { education: "education", career: "career", projects: "project" } as const;
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.h}>
      <GantryFrame span={2 * (ROAD_HALF_WIDTH + SHOULDER) + 3} height={GANTRY_H} />
      {exits.map((x) => (
        <group key={x.edge} position={[xs[x.dir], GANTRY_H + 1.25, 0.05]}>
          <SignPanel
            style={style[x.district]}
            lines={[
              { text: x.label, size: 0.6 },
              { text: x.sub, size: 0.4, bold: false },
            ]}
            arrow={x.dir === "straight" ? "up" : x.dir}
            minWidth={4.5}
            pad={0.4}
            highlight={chosen === x.edge}
            onClick={(e) => {
              e.stopPropagation();
              choose("junctionA", x.edge);
            }}
          />
        </group>
      ))}
    </group>
  );
}

const lampOff = new MeshStandardMaterial({ color: "#15171a", roughness: 0.3 });
const lampRed = new MeshStandardMaterial({ color: "#3a0505", emissive: new Color("#ff2a1a"), emissiveIntensity: 4, toneMapped: false });
const lampGreen = new MeshStandardMaterial({ color: "#053a1a", emissive: new Color("#1aff7a"), emissiveIntensity: 4, toneMapped: false });

function TrafficLight({ x, z, h, green }: { x: number; z: number; h: number; green: boolean }) {
  return (
    <group position={[x, 0, z]} rotation-y={h}>
      <mesh material={metal} position={[0, 1.9, 0]}>
        <cylinderGeometry args={[0.07, 0.09, 3.8, 8]} />
      </mesh>
      <mesh material={darkMetal} position={[0, 4.35, 0]}>
        <boxGeometry args={[0.42, 1.25, 0.32]} />
      </mesh>
      {[0.36, 0, -0.36].map((dy, i) => (
        <mesh key={i} position={[0, 4.35 + dy, 0.17]} material={i === 0 && !green ? lampRed : i === 2 && green ? lampGreen : lampOff}>
          <circleGeometry args={[0.13, 16]} />
        </mesh>
      ))}
    </group>
  );
}

function JunctionProps() {
  const decided = useJourney((s) => !!s.choices.junctionA);
  const near = place(stopLine.edge, stopLine.d + 0.5, -(ROAD_HALF_WIDTH + 1.2));
  const J = nodes.junctionA.pose;
  const far = { x: J.x + Math.cos(J.h) * 7 - Math.sin(J.h) * 26, z: J.z - Math.sin(J.h) * 7 - Math.cos(J.h) * 26 };
  // Lane arrows on the approach: left / straight / right.
  const arrows = [22, 52].map((back) => place(stopLine.edge, stopLine.d - back, OWN_LANE));
  return (
    <>
      <TrafficLight x={near.x} z={near.z} h={near.h} green={decided} />
      <TrafficLight x={far.x} z={far.z} h={J.h} green={decided} />
      {arrows.map((a, i) => (
        <group key={i} position={[a.x, 0.04, a.z]} rotation-y={a.h}>
          {/* Stretched along the lane after rotation so all three read at a grazing angle. */}
          <group rotation-x={-Math.PI / 2} scale={[1, 3, 1]}>
            {(["left", "up", "right"] as const).map((dir, j) => (
              <mesh key={dir} geometry={arrowGeometry()} material={paint} position={[(j - 1) * 1.2, 0, 0]} rotation-z={arrowRotation[dir]} />
            ))}
          </group>
        </group>
      ))}
    </>
  );
}

// --- end of the road ---------------------------------------------------------------------

const chevronWhite = new MeshStandardMaterial({ color: "#e9e9e6", emissive: new Color("#e9e9e6"), emissiveIntensity: 0.25 });
const chevronRed = new MeshStandardMaterial({ color: "#b3121c", emissive: new Color("#b3121c"), emissiveIntensity: 0.35 });
const amber = new MeshStandardMaterial({ color: "#402400", emissive: new Color("#ffae2a"), emissiveIntensity: 0, toneMapped: false });

function EndOfRoad() {
  const p = place("careerLate", END_BARRIER_D);
  useFrame(({ clock }) => {
    amber.emissiveIntensity = Math.sin(clock.elapsedTime * 4) > 0 ? 5 : 0.2;
  });
  const boards = Array.from({ length: 9 }, (_, i) => i - 4);
  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.h}>
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} material={metal} position={[x, 0.7, 0]}>
          <boxGeometry args={[0.14, 1.4, 0.14]} />
        </mesh>
      ))}
      {boards.map((i) => (
        <mesh key={i} material={i % 2 === 0 ? chevronRed : chevronWhite} position={[i * 1.15, 1.0, 0.08]}>
          <boxGeometry args={[1.15, 0.5, 0.05]} />
        </mesh>
      ))}
      {[-5.2, 5.2].map((x) => (
        <mesh key={x} material={amber} position={[x, 1.55, 0.1]}>
          <sphereGeometry args={[0.13, 12, 8]} />
        </mesh>
      ))}
      <group position={[0, 0, 1.5]}>
        <PostSign w={9} h={3.1} clearance={1.6}>
          <SignPanel
            style="info"
            lines={[
              { text: "End of the road", size: 0.85 },
              { text: "For now.", size: 0.55, bold: false },
            ]}
            minWidth={9}
          />
        </PostSign>
      </group>
    </group>
  );
}

// --- proximity mounting ---------------------------------------------------------------------

interface FeatureEntry {
  key: string;
  x: number;
  z: number;
  render: () => React.ReactNode;
}

const MOUNT_RADIUS = 720;

function featureEntries(): FeatureEntry[] {
  const out: FeatureEntry[] = [];
  for (const g of yearGates) {
    const p = place(g.edge, g.d);
    out.push({ key: g.id, x: p.x, z: p.z, render: () => <YearGateView key={g.id} gate={g} /> });
  }
  for (const pl of placements as Placement[]) {
    const p = place(pl.edge, pl.d);
    if (pl.kind === "sign") out.push({ key: pl.id, x: p.x, z: p.z, render: () => <SignView key={pl.id} sign={pl} /> });
    if (pl.kind === "station") out.push({ key: pl.id, x: p.x, z: p.z, render: () => <Station key={pl.id} station={pl} /> });
    if (pl.kind === "junctionGantry") out.push({ key: pl.id, x: p.x, z: p.z, render: () => <JunctionGantry key={pl.id} edge={pl.edge} d={pl.d} /> });
  }
  const J = nodes.junctionA.pose;
  out.push({ key: "junction-props", x: J.x, z: J.z, render: () => <JunctionProps key="junction-props" /> });
  const E = place("careerLate", END_BARRIER_D);
  out.push({ key: "end", x: E.x, z: E.z, render: () => <EndOfRoad key="end" /> });
  return out;
}

/**
 * Mounts world features near the car only. During loading everything is
 * mounted once (`warm`) so shaders and glyph layouts are prepared up front.
 */
export function Features({ warm }: { warm: boolean }) {
  const entries = useMemo(() => featureEntries(), []);
  const [visible, setVisible] = useState<string>("");
  const timer = useRef(0);

  useFrame((_, dt) => {
    timer.current += dt;
    if (timer.current < 0.3) return;
    timer.current = 0;
    const keys = entries
      .filter((e) => Math.hypot(e.x - drive.x, e.z - drive.z) < MOUNT_RADIUS)
      .map((e) => e.key)
      .join("|");
    if (keys !== visible) setVisible(keys);
  });

  const set = new Set(visible.split("|"));
  return <>{entries.filter((e) => warm || set.has(e.key)).map((e) => e.render())}</>;
}

"use client";

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, ShaderMaterial } from "three";
import { edgeList, futurePath, plates, PLATE_HALF, ROAD_HALF_WIDTH, SHOULDER, type Edge } from "@/world/graph";
import { stopLine } from "@/world/layout";
import { LAMP_HEAD_LAT, LAMP_SPACING, lampRange } from "@/world/scenery";
import type { RoadPath } from "@/world/path";
import { envUniforms, plateFragment, plateVertex, roadFragment, roadVertex } from "@/components/Scene/shaders";

/** Cross-section: gravel shoulder dips slightly below the carriageway. */
const PROFILE: [number, number][] = [
  [-(ROAD_HALF_WIDTH + SHOULDER), -0.12],
  [-ROAD_HALF_WIDTH, 0],
  [0, 0.015],
  [ROAD_HALF_WIDTH, 0],
  [ROAD_HALF_WIDTH + SHOULDER, -0.12],
];

function ribbonGeometry(path: RoadPath, spacing = 2): BufferGeometry {
  const samples = path.samples(spacing);
  const cols = PROFILE.length;
  const pos = new Float32Array(samples.length * cols * 3);
  const lat = new Float32Array(samples.length * cols);
  const dist = new Float32Array(samples.length * cols);
  samples.forEach((p, i) => {
    const rx = Math.cos(p.h);
    const rz = -Math.sin(p.h);
    const d = (i / (samples.length - 1)) * path.length;
    PROFILE.forEach(([l, y], j) => {
      const o = i * cols + j;
      pos[o * 3] = p.x + rx * l;
      pos[o * 3 + 1] = y;
      pos[o * 3 + 2] = p.z + rz * l;
      lat[o] = l;
      dist[o] = d;
    });
  });
  const index: number[] = [];
  for (let i = 0; i < samples.length - 1; i++) {
    for (let j = 0; j < cols - 1; j++) {
      const a = i * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      index.push(a, b, c, b, d, c); // CCW seen from above
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aLat", new BufferAttribute(lat, 1));
  g.setAttribute("aDist", new BufferAttribute(dist, 1));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

function roadMaterial(edge: Edge | null, length: number): ShaderMaterial {
  const lamps = edge ? lampRange(edge.id) : { start: 0, end: -1 };
  return new ShaderMaterial({
    uniforms: {
      ...envUniforms(),
      uLen: { value: length },
      uPlainStart: { value: edge?.plain.start ?? 0 },
      uPlainEnd: { value: edge?.plain.end ?? 0 },
      uHalfW: { value: ROAD_HALF_WIDTH },
      uLampStart: { value: lamps.start },
      uLampEnd: { value: lamps.end },
      uLampSpacing: { value: LAMP_SPACING },
      uLampHeadLat: { value: LAMP_HEAD_LAT },
      uStopLine: { value: edge?.id === stopLine.edge ? stopLine.d : 0 },
      uFade: { value: 1 },
    },
    vertexShader: roadVertex,
    fragmentShader: roadFragment,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

export function Roads() {
  const meshes = useMemo(
    () => edgeList.map((e) => ({ id: e.id, geometry: ribbonGeometry(e.path), material: roadMaterial(e, e.path.length) })),
    [],
  );
  const plateMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...envUniforms(), uHalf: { value: PLATE_HALF }, uHalfW: { value: ROAD_HALF_WIDTH }, uShoulder: { value: SHOULDER } },
        vertexShader: plateVertex,
        fragmentShader: plateFragment,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      }),
    [],
  );
  const future = useMemo(() => {
    const m = roadMaterial(null, futurePath.length);
    m.uniforms.uPlainStart.value = 1e6; // unpainted — not built yet
    return { geometry: ribbonGeometry(futurePath, 6), material: m };
  }, []);

  return (
    <group>
      {meshes.map((m) => (
        <mesh key={m.id} geometry={m.geometry} material={m.material} />
      ))}
      {plates.map((p) => (
        <mesh key={p.id} material={plateMaterial} position={[p.x, 0.03, p.z]} rotation={[-Math.PI / 2, 0, p.h]}>
          <planeGeometry args={[PLATE_HALF * 2, PLATE_HALF * 2]} />
        </mesh>
      ))}
      <mesh geometry={future.geometry} material={future.material} position-y={-0.01} />
    </group>
  );
}

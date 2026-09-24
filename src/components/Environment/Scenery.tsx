"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { env } from "@/world/environment";
import { edges, ONCOMING_LANE, type EdgeId } from "@/world/graph";
import { generateScenery, LAMP_HEAD_LAT, LAMP_POLE_LAT, type Instance } from "@/world/scenery";
import { buildingFragment, buildingVertex, envUniforms, glowFragment, glowVertex } from "@/components/Scene/shaders";

const dummy = new Object3D();

function useInstanced(ref: React.RefObject<InstancedMesh | null>, items: Instance[], local?: Matrix4, color?: (i: Instance) => Color) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y ?? 0, it.z);
      dummy.rotation.set(0, it.rot, 0);
      dummy.scale.set(it.sx, it.sy, it.sz);
      dummy.updateMatrix();
      m.copy(dummy.matrix);
      if (local) m.multiply(local);
      mesh.setMatrixAt(i, m);
      if (color) mesh.setColorAt(i, color(it));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [ref, items, local, color]);
}

function Instanced({ items, geometry, material, local, color }: { items: Instance[]; geometry: BufferGeometry; material: Material; local?: Matrix4; color?: (i: Instance) => Color }) {
  const ref = useRef<InstancedMesh>(null);
  useInstanced(ref, items, local, color);
  return <instancedMesh ref={ref} args={[geometry, material, Math.max(items.length, 1)]} frustumCulled={false} />;
}

export function glowMaterial(color: string, size: number) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uIntensity: { value: 0 }, uSize: { value: size }, uFogDensity: env.uFogDensity },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
}

const lampPole = new MeshStandardMaterial({ color: "#4b5157", roughness: 0.5, metalness: 0.6 });
const lampHeadMat = new MeshStandardMaterial({ color: "#20242a", emissive: new Color("#ffc58a"), emissiveIntensity: 0, roughness: 0.4 });

export function Scenery({ density }: { density: number }) {
  const s = useMemo(() => generateScenery(density), [density]);

  const geo = useMemo(() => {
    const pole = new CylinderGeometry(0.08, 0.12, 8, 8).translate(0, 4, 0);
    const arm = new BoxGeometry(LAMP_POLE_LAT - LAMP_HEAD_LAT + 0.3, 0.08, 0.08).translate((LAMP_POLE_LAT - LAMP_HEAD_LAT) / 2, 7.9, 0);
    const head = new BoxGeometry(0.75, 0.14, 0.34).translate(LAMP_POLE_LAT - LAMP_HEAD_LAT, 7.82, 0);
    const trunk = new CylinderGeometry(0.12, 0.2, 2.4, 6).translate(0, 1.2, 0);
    const pine = new ConeGeometry(1.7, 6.2, 7).translate(0, 5, 0);
    const crown = new IcosahedronGeometry(2.4, 1).scale(1, 0.9, 1).translate(0, 4.3, 0);
    const box = new BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const cone = mergeGeometries([new ConeGeometry(0.22, 0.7, 10).translate(0, 0.35, 0), new BoxGeometry(0.5, 0.04, 0.5).translate(0, 0.02, 0)])!;
    const quad = new PlaneGeometry(1, 1);
    return { pole: mergeGeometries([pole, arm])!, head, trunk, pine, crown, box, cone, quad };
  }, []);

  const mats = useMemo(() => {
    const building = new ShaderMaterial({
      uniforms: { ...envUniforms(), uBase: { value: new Color("#6f7680") }, uGlass: { value: 0.6 }, uFloorH: { value: 3.6 }, uLit: { value: 0.42 } },
      vertexShader: buildingVertex,
      fragmentShader: buildingFragment,
    });
    return {
      trunk: new MeshLambertMaterial({ color: "#3a2c22" }),
      foliage: new MeshLambertMaterial({ color: "#ffffff" }),
      cone: new MeshLambertMaterial({ color: "#e0691a", emissive: new Color("#e0691a"), emissiveIntensity: 0.1 }),
      building,
      lampGlow: glowMaterial("#ffc58a", 1.6),
      futureGlow: glowMaterial("#ffc58a", 2.4),
    };
  }, []);

  // Per-instance seeds for building variation.
  const buildingRef = useRef<InstancedMesh>(null);
  useInstanced(buildingRef, s.buildings);
  useLayoutEffect(() => {
    const seeds = new Float32Array(s.buildings.map((b) => b.seed));
    geo.box.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  }, [geo.box, s.buildings]);

  const lampHeads = useMemo(
    () =>
      s.lamps.map((l) => {
        const rx = Math.cos(l.rot);
        const rz = -Math.sin(l.rot);
        const off = LAMP_POLE_LAT - LAMP_HEAD_LAT;
        return { ...l, x: l.x + rx * off, z: l.z + rz * off, y: 7.7, rot: 0 };
      }),
    [s.lamps],
  );

  const pineColor = useMemo(() => {
    const a = new Color("#18301f");
    const b = new Color("#2a4526");
    return (i: Instance) => a.clone().lerp(b, i.seed);
  }, []);
  const leafColor = useMemo(() => {
    const a = new Color("#2c4a22");
    const b = new Color("#566b2a");
    return (i: Instance) => a.clone().lerp(b, i.seed);
  }, []);

  useFrame(() => {
    const night = env.uNight.value;
    lampHeadMat.emissiveIntensity = night * 3.5;
    mats.lampGlow.uniforms.uIntensity.value = night * 1.1;
    mats.futureGlow.uniforms.uIntensity.value = 0.4 + night * 1.2;
  });

  return (
    <group>
      <Instanced items={s.lamps} geometry={geo.pole} material={lampPole} />
      <Instanced items={s.lamps} geometry={geo.head} material={lampHeadMat} />
      <Instanced items={lampHeads} geometry={geo.quad} material={mats.lampGlow} />
      <Instanced items={s.pines} geometry={geo.trunk} material={mats.trunk} />
      <Instanced items={s.pines} geometry={geo.pine} material={mats.foliage} color={pineColor} />
      <Instanced items={s.broadleaf} geometry={geo.trunk} material={mats.trunk} />
      <Instanced items={s.broadleaf} geometry={geo.crown} material={mats.foliage} color={leafColor} />
      <instancedMesh ref={buildingRef} args={[geo.box, mats.building, Math.max(s.buildings.length, 1)]} frustumCulled={false} />
      <Instanced items={s.cones} geometry={geo.cone} material={mats.cone} />
      <Instanced items={s.futureLights} geometry={geo.quad} material={mats.futureGlow} />
      <Traffic count={density > 0.6 ? 10 : 5} />
    </group>
  );
}

// --- oncoming traffic -------------------------------------------------------------

const TRAFFIC_EDGES: EdgeId[] = ["careerEarly", "careerStraight", "careerLate", "projectHighway"];
const carColors = ["#1c1f24", "#6c7178", "#e9e9e6", "#39465a", "#5a1f23", "#23262b"];

function Traffic({ count }: { count: number }) {
  const body = useRef<InstancedMesh>(null);
  const lights = useRef<InstancedMesh>(null);
  const cars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const edge = TRAFFIC_EDGES[i % TRAFFIC_EDGES.length];
        return { edge, d: ((i * 0.37) % 1) * edges[edge].path.length, speed: 11 + (i % 3) * 2.5, color: new Color(carColors[i % carColors.length]) };
      }),
    [count],
  );
  const geo = useMemo(
    () =>
      mergeGeometries([
        new BoxGeometry(1.8, 0.62, 4.3).translate(0, 0.62, 0),
        new BoxGeometry(1.55, 0.52, 2.2).translate(0, 1.18, 0.25),
      ])!,
    [],
  );
  const mat = useMemo(() => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.35, metalness: 0.6 }), []);
  const glow = useMemo(() => glowMaterial("#fff4e0", 0.9), []);
  const quad = useMemo(() => new PlaneGeometry(1, 1), []);
  const m = useMemo(() => new Matrix4(), []);
  const v = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    cars.forEach((c, i) => body.current?.setColorAt(i, c.color));
    if (body.current?.instanceColor) body.current.instanceColor.needsUpdate = true;
  }, [cars]);

  useFrame((_, dt) => {
    if (!body.current || !lights.current) return;
    const step = Math.min(dt, 0.05);
    cars.forEach((c, i) => {
      const path = edges[c.edge].path;
      c.d -= c.speed * step;
      if (c.d < 0) c.d += path.length;
      const p = path.pointAt(c.d, ONCOMING_LANE);
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, p.h + Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      body.current!.setMatrixAt(i, dummy.matrix);
      // Two headlights at the front (local -Z after the 180° turn faces us).
      for (let j = 0; j < 2; j++) {
        v.set(j === 0 ? -0.62 : 0.62, 0.7, -2.2).applyMatrix4(dummy.matrix);
        m.makeTranslation(v.x, v.y, v.z);
        lights.current!.setMatrixAt(i * 2 + j, m);
      }
    });
    body.current.instanceMatrix.needsUpdate = true;
    lights.current.instanceMatrix.needsUpdate = true;
    glow.uniforms.uIntensity.value = 0.25 + env.uNight.value * 1.2;
  });

  return (
    <>
      <instancedMesh ref={body} args={[geo, mat, count]} frustumCulled={false} />
      <instancedMesh ref={lights} args={[quad, glow, count * 2]} frustumCulled={false} />
    </>
  );
}

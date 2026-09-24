"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
} from "three";
import { env } from "@/world/environment";
import { SignPanel } from "@/components/RoadSigns/Sign";
import { darkMetal, metal } from "@/components/Scene/materials";

/**
 * Rotormaps destination: a solar plant being surveyed. Panel rows, a drone
 * flying a lawn-mower survey pattern with capture flashes, ground control
 * point targets and an orthomosaic tile grid being "processed" across the site.
 * Local +Z faces the road.
 */
const FIELD_W = 150;
const FIELD_D = 110;

const panelMat = new MeshStandardMaterial({ color: "#2b4f8c", roughness: 0.2, metalness: 0.2, emissive: new Color("#10254a"), emissiveIntensity: 0.35 });
const frameMat = new MeshStandardMaterial({ color: "#aeb4bb", roughness: 0.5, metalness: 0.6 });
const dirtMat = new MeshLambertMaterial({ color: "#6b6152" });
const white = new MeshBasicMaterial({ color: "#f2f2f2", fog: true });
const black = new MeshBasicMaterial({ color: "#111111", fog: true });
const navRed = new MeshBasicMaterial({ color: "#ff3b30", toneMapped: false });
const navGreen = new MeshBasicMaterial({ color: "#34ff7a", toneMapped: false });
const strobe = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false, transparent: true });
const cabinMat = new MeshStandardMaterial({ color: "#d9dbdd", roughness: 0.7 });

const gridMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: env.uTime, uNight: env.uNight },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uNight;
      varying vec2 vP;
      float gridLine(float x, float w) { float f = fract(x); return max(step(f, w), step(1.0 - w, f)); }
      void main() {
        vec2 fine = vP / 10.0;
        vec2 tile = vP / 40.0;
        float f = max(gridLine(fine.x, 0.02), gridLine(fine.y, 0.02));
        float t = max(gridLine(tile.x, 0.008), gridLine(tile.y, 0.008));
        // Processing sweep: tiles "render" as the scan line passes.
        float sweep = fract(uTime * 0.05);
        float x01 = vP.x / ${FIELD_W.toFixed(1)} + 0.5;
        float band = exp(-pow((x01 - sweep) * 18.0, 2.0));
        float processed = step(x01, sweep);
        vec3 c = vec3(0.35, 0.8, 1.0);
        float a = f * 0.35 + t * 0.8 + band * 0.6 + processed * 0.05;
        gl_FragColor = vec4(c * a * (0.9 + uNight * 0.6), 1.0);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

export function SolarSite({ name }: { name: string }) {
  const panels = useRef<InstancedMesh>(null);
  const drone = useRef<Group>(null);
  const footprint = useRef<MeshBasicMaterial>(null);
  const grid = useMemo(() => gridMaterial(), []);
  const rows = useMemo(() => {
    const out: { x: number; z: number }[] = [];
    // Rows run away from the road so they read as receding lines from the car.
    for (let x = -FIELD_W / 2 + 6; x <= FIELD_W / 2 - 6; x += 7.5) {
      for (let z = -FIELD_D / 2 + 6; z <= FIELD_D / 2 - 10; z += 3.5) out.push({ x, z });
    }
    return out;
  }, []);

  useLayoutEffect(() => {
    const d = new Object3D();
    rows.forEach((r, i) => {
      d.position.set(r.x, 1.7, r.z);
      d.rotation.set(0, 0, -0.55); // tilted toward local +X — towards approaching traffic
      d.updateMatrix();
      panels.current?.setMatrixAt(i, d.matrix);
    });
    if (panels.current) panels.current.instanceMatrix.needsUpdate = true;
  }, [rows]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (drone.current) {
      // Lawn-mower survey: sweep X, step Z.
      const lane = Math.floor(t / 9) % 6;
      const phase = (t % 9) / 9;
      const dir = lane % 2 === 0 ? 1 : -1;
      const x = (phase - 0.5) * FIELD_W * 0.8 * dir;
      const z = FIELD_D / 2 - 12 - lane * 12;
      drone.current.position.set(x, 17 + Math.sin(t * 1.3) * 0.3, z);
      drone.current.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const flash = (t % 1.6) < 0.12 ? 1 : 0;
    strobe.opacity = flash;
    if (footprint.current) footprint.current.opacity = 0.05 + flash * 0.2;
  });

  return (
    <group>
      <instancedMesh ref={panels} args={[undefined, panelMat, rows.length]} frustumCulled={false}>
        <boxGeometry args={[3.2, 0.07, 3.4]} />
      </instancedMesh>
      {/* Row frames */}
      {Array.from(new Set(rows.map((r) => r.x))).map((x) => (
        <mesh key={x} material={frameMat} position={[x, 0.85, -2]}>
          <boxGeometry args={[0.12, 0.12, FIELD_D - 14]} />
        </mesh>
      ))}
      {/* Graded site and the orthomosaic tile grid being processed over it. */}
      <mesh material={dirtMat} rotation-x={-Math.PI / 2} position-y={0.03}>
        <planeGeometry args={[FIELD_W + 10, FIELD_D + 6]} />
      </mesh>
      <mesh material={grid} rotation-x={-Math.PI / 2} position-y={0.08}>
        <planeGeometry args={[FIELD_W, FIELD_D]} />
      </mesh>

      {/* Ground control points (checkerboard targets). */}
      {[
        [-FIELD_W / 2 + 6, FIELD_D / 2 - 6],
        [FIELD_W / 2 - 6, FIELD_D / 2 - 6],
        [0, FIELD_D / 2 - 10],
        [-FIELD_W / 2 + 6, -FIELD_D / 2 + 6],
        [FIELD_W / 2 - 6, -FIELD_D / 2 + 6],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.1, z]} rotation-x={-Math.PI / 2}>
          {[0, 1, 2, 3].map((q) => (
            <mesh key={q} material={q % 3 === 0 ? black : white} position={[q % 2 === 0 ? -0.9 : 0.9, q < 2 ? 0.9 : -0.9, 0]}>
              <planeGeometry args={[1.8, 1.8]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Survey drone (scaled up for legibility) with camera footprint. */}
      <group ref={drone} scale={2.4}>
        <mesh material={darkMetal}>
          <boxGeometry args={[0.55, 0.16, 0.55]} />
        </mesh>
        {[Math.PI / 4, -Math.PI / 4].map((r) => (
          <mesh key={r} material={darkMetal} rotation-y={r}>
            <boxGeometry args={[1.5, 0.05, 0.07]} />
          </mesh>
        ))}
        {[
          [0.53, 0.53],
          [-0.53, 0.53],
          [0.53, -0.53],
          [-0.53, -0.53],
        ].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.07, z]} material={metal}>
            <cylinderGeometry args={[0.3, 0.3, 0.01, 16]} />
          </mesh>
        ))}
        <mesh material={navRed} position={[-0.55, 0.02, 0.55]}>
          <sphereGeometry args={[0.06, 8, 6]} />
        </mesh>
        <mesh material={navGreen} position={[0.55, 0.02, 0.55]}>
          <sphereGeometry args={[0.06, 8, 6]} />
        </mesh>
        <mesh material={strobe} position={[0, -0.12, 0]}>
          <sphereGeometry args={[0.08, 8, 6]} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-6.9}>
          <planeGeometry args={[6, 4.2]} />
          <meshBasicMaterial ref={footprint} color="#7fd6ff" transparent opacity={0.08} depthWrite={false} side={DoubleSide} blending={AdditiveBlending} />
        </mesh>
      </group>

      {/* Site office with rooftop sign, near the road. */}
      <group position={[FIELD_W / 2 - 22, 0, FIELD_D / 2 + 2]}>
        <mesh material={cabinMat} position={[0, 1.6, 0]}>
          <boxGeometry args={[10, 3.2, 3.4]} />
        </mesh>
        <mesh material={metal} position={[4.2, 5.5, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 8, 6]} />
        </mesh>
        <group position={[0, 5.2, 0.4]}>
          <SignPanel style="project" lines={[{ text: name, size: 0.9 }]} pad={0.45} />
        </group>
      </group>
    </group>
  );
}


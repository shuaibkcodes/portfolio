"use client";

/**
 * Roadside destinations for the Project Highway. Each site hints at what the
 * project does. All face local +Z (the road). SolarSite (Rotormaps) lives in
 * its own file.
 */
import { useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  type Group,
  type InstancedMesh,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  ShaderMaterial,
  Shape,
  ShapeGeometry,
} from "three";
import { env } from "@/world/environment";
import { buildingFragment, buildingVertex, envUniforms } from "@/components/Scene/shaders";
import { FONT, FONT_BOLD, metal, roundedRect, signText } from "@/components/Scene/materials";
import { SignPanel } from "@/components/RoadSigns/Sign";

function facade(base: string, glass: number, seed: number, lit = 0.5, floorH = 3.4) {
  return new ShaderMaterial({
    uniforms: { ...envUniforms(), uBase: { value: new Color(base) }, uGlass: { value: glass }, uFloorH: { value: floorH }, uLit: { value: lit }, aSeed: { value: seed } },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
}

const white = new MeshStandardMaterial({ color: "#e9ebee", roughness: 0.6 });
const dark = new MeshStandardMaterial({ color: "#1c1f24", roughness: 0.5, metalness: 0.3 });
const glow = (color: string, intensity = 2) => new MeshStandardMaterial({ color: "#111", emissive: new Color(color), emissiveIntensity: intensity, toneMapped: false });

// --- Zlivio CRM: real estate --------------------------------------------------------

const pinMat = glow("#5aa9ff", 2.2);
const houseTones = ["#d8d2c6", "#c9ccd1", "#e4ddd0", "#bfc5cc"];
const listings = ["For sale", "Sold", "Open house", "Listed"];

/** Map-pin marker (CRM listing) floating above a house. */
function Pin({ y }: { y: number }) {
  const ref = useRef<Group>(null);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = y + Math.sin(clock.elapsedTime * 1.4 + phase) * 0.35;
    ref.current.rotation.y = clock.elapsedTime * 0.8 + phase;
  });
  return (
    <group ref={ref}>
      <mesh material={pinMat} position-y={1.1}>
        <sphereGeometry args={[0.9, 18, 12]} />
      </mesh>
      <mesh material={pinMat} rotation-x={Math.PI}>
        <coneGeometry args={[0.78, 1.8, 18]} />
      </mesh>
      <mesh material={dark} position={[0, 1.1, 0.72]}>
        <circleGeometry args={[0.32, 16]} />
      </mesh>
    </group>
  );
}

export function EstateSite({ name }: { name: string }) {
  const mats = useMemo(() => houseTones.map((c, i) => facade(c, 0.75, 0.2 + i * 0.17, 0.6, 3.2)), []);
  const pavilion = useMemo(() => facade("#48525e", 1, 0.9, 0.55, 4), []);
  const houses = [-27, -13, 1, 15];
  return (
    <group>
      {houses.map((x, i) => (
        <group key={x} position={[x, 0, -6 - (i % 2) * 3]}>
          <mesh material={mats[i]} position={[0, 3, 0]}>
            <boxGeometry args={[10, 6, 9]} />
          </mesh>
          {/* Cantilevered upper storey */}
          <mesh material={mats[(i + 1) % 4]} position={[i % 2 ? -1.2 : 1.2, 7.4, 0.9]}>
            <boxGeometry args={[7.6, 2.8, 8.4]} />
          </mesh>
          <Pin y={12.6} />
          {/* Listing board by the kerb */}
          <group position={[3.4, 0, 7]}>
            <mesh material={metal} position={[0, 0.9, 0]}>
              <boxGeometry args={[0.08, 1.8, 0.08]} />
            </mesh>
            <group position={[0, 1.9, 0.06]}>
              <mesh geometry={roundedRect(2.4, 0.8, 0.08)} material={i === 1 ? glow("#b3121c", 0.4) : white} />
              <Text font={FONT_BOLD} fontSize={0.3} position-z={0.02} anchorX="center" anchorY="middle" material={signText(i === 1 ? "#ffffff" : "#1b2129")}>
                {listings[i].toUpperCase()}
              </Text>
            </group>
          </group>
        </group>
      ))}
      {/* Sales pavilion with the product name */}
      <group position={[30, 0, 2]}>
        <mesh material={pavilion} position={[0, 2.6, 0]}>
          <boxGeometry args={[12, 5.2, 8]} />
        </mesh>
        <mesh material={white} position={[0, 5.45, 0.6]}>
          <boxGeometry args={[14, 0.5, 10]} />
        </mesh>
        <group position={[0, 7, 1]}>
          <SignPanel style="project" lines={[{ text: name, size: 0.8 }]} pad={0.4} />
        </group>
      </group>
    </group>
  );
}

// --- Rapaydo: e-commerce & virtual POS ---------------------------------------------

const cardMaterial = () =>
  new ShaderMaterial({
    uniforms: { uNight: env.uNight },
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying vec2 vUv;
      void main() {
        vec3 a = vec3(0.16, 0.08, 0.42);
        vec3 b = vec3(0.05, 0.32, 0.62);
        vec3 col = mix(a, b, clamp(vUv.x * 0.8 + vUv.y * 0.4, 0.0, 1.0));
        col += vec3(0.25, 0.3, 0.6) * pow(1.0 - abs(vUv.y - 0.72), 12.0) * 0.4;
        gl_FragColor = vec4(col * (0.9 + uNight * 0.5), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });

function cardShapeGeometry(w: number, h: number, r: number) {
  // Rounded rectangle with 0..1 UVs (ShapeGeometry UVs are in shape units).
  const g = roundedRect(w, h, r).clone();
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / w + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / h + 0.5;
  }
  g.setAttribute("uv", new BufferAttribute(uv, 2));
  return g;
}

const chip = new MeshStandardMaterial({ color: "#d9b25a", roughness: 0.3, metalness: 0.9 });
const approved = glow("#3ddc84", 1.6);

export function FintechSite({ name }: { name: string }) {
  const card = useMemo(() => ({ geo: cardShapeGeometry(8.56, 5.4, 0.45), mat: cardMaterial() }), []);
  const hall = useMemo(() => facade("#3b4450", 1, 0.41, 0.55, 4.2), []);
  const waves = [0.35, 0.6, 0.85];
  return (
    <group>
      <mesh material={hall} position={[-6, 3.2, -8]}>
        <boxGeometry args={[26, 6.4, 12]} />
      </mesh>
      <mesh material={white} position={[-6, 6.65, -7]}>
        <boxGeometry args={[28, 0.5, 14]} />
      </mesh>
      <group position={[-6, 8.3, -1.5]}>
        <SignPanel style="project" lines={[{ text: name, size: 0.8 }]} pad={0.4} />
      </group>

      {/* A payment card, standing on its edge — 4242 is Stripe's test card. */}
      <group position={[9, 0, 2]} rotation-y={-0.25}>
        <mesh material={dark} position={[0, 0.3, 0]}>
          <boxGeometry args={[6, 0.6, 1.4]} />
        </mesh>
        <group position={[0, 3.35, 0]}>
          <mesh geometry={card.geo} material={card.mat} />
          <mesh geometry={card.geo} material={dark} position-z={-0.12} rotation-y={Math.PI} />
          <mesh geometry={roundedRect(1.2, 0.9, 0.12)} material={chip} position={[-2.7, 0.45, 0.02]} />
          {waves.map((r) => (
            <mesh key={r} position={[-1.6, 0.45, 0.02]} rotation-z={-Math.PI / 4}>
              <ringGeometry args={[r, r + 0.08, 24, 1, 0, Math.PI / 2]} />
              <meshBasicMaterial color="#e6ecff" />
            </mesh>
          ))}
          <Text font={FONT} fontSize={0.5} position={[-3.6, -0.9, 0.03]} anchorX="left" anchorY="middle" material={signText("#e6ecff")} letterSpacing={0.12}>
            {"•••• •••• •••• 4242"}
          </Text>
          <Text font={FONT_BOLD} fontSize={0.42} position={[3.6, -1.95, 0.03]} anchorX="right" anchorY="middle" material={signText("#ffffff")}>
            {name.toUpperCase()}
          </Text>
        </group>
      </group>

      {/* POS terminal */}
      <group position={[16, 0, 3]} rotation-y={-0.35}>
        <mesh material={dark} position={[0, 1.6, 0]}>
          <boxGeometry args={[1.6, 3.2, 1]} />
        </mesh>
        <mesh material={approved} position={[0, 2.35, 0.51]}>
          <planeGeometry args={[1.25, 0.9]} />
        </mesh>
        <Text font={FONT_BOLD} fontSize={0.22} position={[0, 2.35, 0.53]} anchorX="center" anchorY="middle" material={signText("#062a14")}>
          APPROVED
        </Text>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} material={metal} position={[(i % 3) * 0.36 - 0.36, 1.45 - Math.floor(i / 3) * 0.3, 0.51]}>
            <boxGeometry args={[0.26, 0.2, 0.04]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// --- TerranAi: AI discovery for researchers ------------------------------------------

const domeMat = new MeshStandardMaterial({ color: "#dfe3e8", roughness: 0.25, metalness: 0.55 });
const nodeMat = glow("#8fd8ff", 2.4);

export function LabSite({ name }: { name: string }) {
  const lab = useMemo(() => facade("#dde1e6", 0.55, 0.63, 0.5, 3.8), []);
  const graph = useRef<Group>(null);
  const nodesRef = useRef<InstancedMesh>(null);

  // A knowledge-graph constellation: nodes + nearest-neighbour edges.
  const { points, lines } = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pts: [number, number, number][] = Array.from({ length: 34 }, () => {
      const r = 3 + rand() * 6;
      const a = rand() * Math.PI * 2;
      return [Math.cos(a) * r, (rand() - 0.5) * 6, Math.sin(a) * r];
    });
    const seg: number[] = [];
    pts.forEach((p, i) => {
      const near = pts
        .map((q, j) => ({ j, d: Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      for (const n of near) seg.push(...p, ...pts[n.j]);
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(seg), 3));
    return { points: pts, lines: g };
  }, []);
  const lineMat = useMemo(() => new LineBasicMaterial({ color: "#8fd8ff", transparent: true, opacity: 0.45, blending: AdditiveBlending, depthWrite: false }), []);

  useMemo(() => {
    // Instance matrices set once the mesh exists (below, in the ref callback).
  }, []);

  useFrame(({ clock }) => {
    if (graph.current) graph.current.rotation.y = clock.elapsedTime * 0.12;
    lineMat.opacity = 0.35 + env.uNight.value * 0.35;
  });

  return (
    <group>
      <mesh material={lab} position={[0, 3.8, -8]}>
        <boxGeometry args={[34, 7.6, 14]} />
      </mesh>
      {/* Observatory */}
      <group position={[10, 7.6, -8]}>
        <mesh material={white} position-y={0.8}>
          <cylinderGeometry args={[4.6, 4.6, 1.6, 32]} />
        </mesh>
        <mesh material={domeMat} position-y={1.6}>
          <sphereGeometry args={[4.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={dark} position={[0, 4.2, 2.2]} rotation-x={-0.55}>
          <boxGeometry args={[1.1, 4.4, 0.2]} />
        </mesh>
      </group>
      <group position={[-9, 9.4, -1]}>
        <SignPanel style="project" lines={[{ text: name, size: 0.8 }]} pad={0.4} />
      </group>
      <group ref={graph} position={[-4, 19, -6]}>
        <lineSegments geometry={lines} material={lineMat} />
        <instancedMesh
          ref={(mesh) => {
            nodesRef.current = mesh;
            if (!mesh) return;
            const d = new Object3D();
            points.forEach((p, i) => {
              d.position.set(...p);
              d.scale.setScalar(i % 5 === 0 ? 1.8 : 1);
              d.updateMatrix();
              mesh.setMatrixAt(i, d.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
          }}
          args={[undefined, nodeMat, points.length]}
        >
          <icosahedronGeometry args={[0.28, 1]} />
        </instancedMesh>
      </group>
    </group>
  );
}

// --- Water Reminder: hydration app ---------------------------------------------------

const tankMat = new MeshStandardMaterial({ color: "#e7eef5", roughness: 0.45, metalness: 0.3 });
const dropMat = new MeshBasicMaterial({ color: "#2f86ff", side: DoubleSide });
const phoneMat = new MeshStandardMaterial({ color: "#0e1116", roughness: 0.3, metalness: 0.6 });
const screenMat = glow("#0b2a4a", 1);
const ringMat = glow("#4db2ff", 2.2);

function dropGeometry() {
  const s = new Shape();
  s.moveTo(0, 1);
  s.bezierCurveTo(0.15, 0.6, 0.62, 0.25, 0.62, -0.18);
  s.bezierCurveTo(0.62, -0.55, 0.34, -0.8, 0, -0.8);
  s.bezierCurveTo(-0.34, -0.8, -0.62, -0.55, -0.62, -0.18);
  s.bezierCurveTo(-0.62, 0.25, -0.15, 0.6, 0, 1);
  return new ShapeGeometry(s, 12);
}

const pondMaterial = () =>
  new ShaderMaterial({
    uniforms: { uTime: env.uTime, uSkyTop: env.uSkyTop, uSkyHorizon: env.uSkyHorizon },
    vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSkyTop; uniform vec3 uSkyHorizon;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float ripple = sin(r * 3.2 - uTime * 2.2) * 0.5 + 0.5;
        vec3 water = mix(vec3(0.02, 0.08, 0.14), mix(uSkyHorizon, uSkyTop, 0.5) * 0.6, 0.35 + ripple * 0.2);
        gl_FragColor = vec4(water, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

export function HydroSite({ name }: { name: string }) {
  const drop = useMemo(dropGeometry, []);
  const pond = useMemo(() => pondMaterial(), []);
  const legs: [number, number][] = [
    [-3, -3],
    [3, -3],
    [-3, 3],
    [3, 3],
  ];
  return (
    <group>
      {/* Water tower */}
      <group position={[-8, 0, -6]}>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} material={metal} position={[x * 0.8, 7, z * 0.8]} rotation={[z * -0.03, 0, x * 0.03]}>
            <cylinderGeometry args={[0.18, 0.24, 14, 8]} />
          </mesh>
        ))}
        {[4, 9].map((y) => (
          <mesh key={y} material={metal} position-y={y}>
            <torusGeometry args={[3.4, 0.08, 6, 24]} />
          </mesh>
        ))}
        <mesh material={tankMat} position-y={17.5}>
          <cylinderGeometry args={[4.8, 4.8, 7, 32]} />
        </mesh>
        <mesh material={tankMat} position-y={21}>
          <coneGeometry args={[5, 2.6, 32]} />
        </mesh>
        <mesh geometry={drop} material={dropMat} position={[0, 17.6, 4.83]} scale={2.4} />
      </group>

      {/* Pond */}
      <mesh material={pond} rotation-x={-Math.PI / 2} position={[5, 0.06, 1]}>
        <circleGeometry args={[6, 40]} />
      </mesh>
      <mesh material={white} rotation-x={-Math.PI / 2} position={[5, 0.04, 1]}>
        <ringGeometry args={[6, 6.6, 40]} />
      </mesh>

      {/* Phone billboard: hydration progress */}
      <group position={[13, 0, -2]} rotation-y={-0.3}>
        <mesh material={metal} position={[0, 2, -0.2]}>
          <boxGeometry args={[0.3, 4, 0.3]} />
        </mesh>
        <mesh geometry={roundedRect(4.4, 8.4, 0.7)} material={phoneMat} position-y={8} />
        <mesh geometry={roundedRect(3.9, 7.6, 0.45)} material={screenMat} position={[0, 8, 0.02]} />
        <mesh material={ringMat} position={[0, 9.2, 0.04]}>
          <ringGeometry args={[1.15, 1.45, 48, 1, Math.PI / 2, Math.PI * 1.5]} />
        </mesh>
        <mesh geometry={drop} material={dropMat} position={[0, 9.2, 0.05]} scale={0.6} />
        <Text font={FONT_BOLD} fontSize={0.5} position={[0, 7.2, 0.05]} anchorX="center" anchorY="middle" material={signText("#ffffff")}>
          6 / 8 GLASSES
        </Text>
        <Text font={FONT} fontSize={0.3} position={[0, 6.55, 0.05]} anchorX="center" anchorY="middle" material={signText("#9fc6ff")}>
          TIME FOR A DRINK
        </Text>
      </group>
      <group position={[2, 6.5, -5]}>
        <SignPanel style="project" lines={[{ text: name, size: 0.7 }]} pad={0.4} />
      </group>
    </group>
  );
}

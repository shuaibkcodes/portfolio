"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Hud, PerspectiveCamera, useFBO } from "@react-three/drei";
import {
  BoxGeometry,
  Color,
  type DirectionalLight,
  ExtrudeGeometry,
  type Group,
  type HemisphereLight,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera as ThreePerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  ShaderMaterial,
  Shape,
  Vector3,
} from "three";
import { drive } from "@/state/drive";
import { intro } from "@/state/journey";
import { useJourney } from "@/state/store";
import { env } from "@/world/environment";
import { outputChunk } from "@/components/Scene/shaders";

const EYE_HEIGHT = 1.2;

/** Head motion shared by the world camera and the cockpit camera. */
export const head = { yaw: 0, pitch: 0, roll: 0, bob: 0, vib: 0 };

export function fovFor(aspect: number) {
  if (aspect >= 1.3) return 55;
  return MathUtils.clamp(MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(35)) / aspect)), 55, 78);
}

const noise = (t: number) => Math.sin(t) * 0.5 + Math.sin(t * 2.31 + 1.3) * 0.3 + Math.sin(t * 4.7 + 0.2) * 0.2;
const damp = (x: number, target: number, lambda: number, dt: number) => MathUtils.damp(x, target, lambda, dt);

/** Drives the world camera from the vehicle state (priority -2: after physics, before rendering). */
export function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const camera = useThree((s) => s.camera) as ThreePerspectiveCamera;
  const size = useThree((s) => s.size);
  const tmp = useMemo(() => ({ x: 0, z: 0, h: 0, k: 0 }), []);

  useEffect(() => {
    camera.fov = fovFor(size.width / size.height);
    camera.near = 0.3;
    camera.far = 6000;
    camera.updateProjectionMatrix();
  }, [camera, size]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = clock.elapsedTime;
    const v = drive.v;
    const speedNorm = Math.min(Math.abs(v) / 25, 1);
    const motion = reducedMotion ? 0 : 1;

    // Look into curves: compare heading here with heading a little ahead.
    const aheadH = drive.route.sample(drive.s + 10 + Math.abs(v) * 0.7, tmp).h;
    const hereH = drive.route.sample(drive.s, tmp).h;
    const lookYaw = MathUtils.clamp((aheadH - hereH) * 0.5, -0.35, 0.35) - drive.look.x * 0.14;
    const lookPitch = MathUtils.clamp(drive.accel * 0.004, -0.03, 0.02) * motion - drive.look.y * 0.07;
    const roll = MathUtils.clamp(-v * v * drive.curvature * 0.0035, -0.03, 0.03) * motion;

    head.yaw = damp(head.yaw, lookYaw, 3, dt);
    head.pitch = damp(head.pitch, lookPitch, 4, dt);
    head.roll = damp(head.roll, roll, 3, dt);
    head.bob = Math.sin(t * 1.9) * 0.005 * speedNorm * motion;
    head.vib = (noise(t * 23) * 0.0016 + noise(t * 41) * 0.0008) * speedNorm * motion;

    const eyeX = drive.x;
    const eyeZ = drive.z;
    const eyeY = EYE_HEIGHT + head.bob + head.vib;
    const h = drive.heading;

    // Opening shot: low on the asphalt ahead of the car, rising into the driver's seat.
    const k = useJourney.getState().phase === "loading" || useJourney.getState().phase === "title" ? 0 : intro.rig;
    const drift = Math.sin(t * 0.15) * 0.6;
    const lowX = eyeX - Math.sin(h) * (7 + drift) + Math.cos(h) * 1.5;
    const lowZ = eyeZ - Math.cos(h) * (7 + drift) - Math.sin(h) * 1.5;

    camera.position.set(MathUtils.lerp(lowX, eyeX, k), MathUtils.lerp(0.34, eyeY, k), MathUtils.lerp(lowZ, eyeZ, k));
    camera.rotation.set(MathUtils.lerp(0.035, head.pitch, k), h + MathUtils.lerp(0.04, head.yaw, k), MathUtils.lerp(0, head.roll, k), "YXZ");
  }, -2);

  return null;
}

// ---------------------------------------------------------------------------
// Cockpit (rendered in its own pass on top of the world)

const dashMat = new MeshStandardMaterial({ color: "#0c0d0f", roughness: 0.88, metalness: 0.05 });
const trimMat = new MeshStandardMaterial({ color: "#141518", roughness: 0.92 });
const wheelMat = new MeshStandardMaterial({ color: "#0f1012", roughness: 0.55, metalness: 0.1 });
const mirrorGlassSide = new MeshStandardMaterial({ color: "#1a2530", roughness: 0.08, metalness: 0.9 });

function dashboardGeometry() {
  // Profile in (forward, height); extruded across the car.
  const s = new Shape();
  s.moveTo(1.06, -0.375);
  s.bezierCurveTo(0.86, -0.385, 0.72, -0.395, 0.64, -0.41);
  s.quadraticCurveTo(0.6, -0.42, 0.6, -0.46);
  s.lineTo(0.6, -1.0);
  s.lineTo(1.2, -1.0);
  s.lineTo(1.2, -0.375);
  s.closePath();
  const g = new ExtrudeGeometry(s, { depth: 3.4, bevelEnabled: false, curveSegments: 12 });
  g.translate(0, 0, -1.7);
  g.rotateY(Math.PI / 2);
  return g;
}

function barBetween(a: Vector3, b: Vector3, w: number, d: number) {
  const len = a.distanceTo(b);
  const g = new BoxGeometry(w, len, d);
  const m = new Mesh(g);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { geometry: g, position: m.position.clone(), quaternion: m.quaternion.clone() };
}

function hoodMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uSkyTop: env.uSkyTop,
      uSkyHorizon: env.uSkyHorizon,
      uSunColor: env.uSunColor,
      uSunIntensity: env.uSunIntensity,
      uSunDirLocal: { value: new Vector3(0, 1, 0) },
      uHemiSky: env.uHemiSky,
      uHemiGround: env.uHemiGround,
      uHemi: env.uHemi,
      uNight: env.uNight,
    },
    vertexShader: /* glsl */ `
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normal);
        vV = normalize(-(modelMatrix * vec4(position, 1.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform vec3 uSunColor; uniform float uSunIntensity;
      uniform vec3 uSunDirLocal; uniform vec3 uHemiSky; uniform vec3 uHemiGround; uniform float uHemi; uniform float uNight;
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(vV);
        vec3 R = reflect(-V, N);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 sky = mix(uSkyHorizon, uSkyTop, clamp(R.y * 1.5, 0.0, 1.0));
        vec3 paint = vec3(0.012, 0.013, 0.015) * (mix(uHemiGround, uHemiSky, 0.8) * uHemi + uSunColor * uSunIntensity * max(dot(N, uSunDirLocal), 0.0));
        vec3 col = paint + sky * (0.035 + fres * 0.45);
        col += uSunColor * uSunIntensity * pow(max(dot(R, uSunDirLocal), 0.0), 160.0) * 0.5;
        gl_FragColor = vec4(col, 1.0);
        ${outputChunk}
      }
    `,
  });
}

function hoodGeometry() {
  const g = new PlaneGeometry(1.9, 1.7, 16, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i); // along the hood
    const crown = 0.07 * (1 - (x / 0.95) ** 2);
    // Map plane Y → -Z so the surface faces up; taper towards the nose.
    p.setXYZ(i, x * (1 - (y + 0.85) * 0.08), crown, -y);
  }
  g.computeVertexNormals();
  g.rotateX(-0.16); // slopes down away from the windshield
  g.translate(0, -0.53, -1.9);
  return g;
}

export function Cockpit({ tier, mirror }: { tier: "high" | "medium" | "low"; mirror: boolean }) {
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const aspect = size.width / size.height;
  const portrait = aspect < 1;
  const cam = useRef<ThreePerspectiveCamera>(null);
  const rig = useRef<Group>(null);
  const wheel = useRef<Group>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);

  const geo = useMemo(() => {
    const pl = (sx: number) => barBetween(new Vector3(0.86 * sx, -0.37, -1.0), new Vector3(0.64 * sx, 0.3, -0.55), 0.065, 0.06);
    return { dash: dashboardGeometry(), hood: hoodGeometry(), pillarL: pl(-1), pillarR: pl(1) };
  }, []);
  const hood = useMemo(() => hoodMaterial(), []);

  // Rear-view mirror: the road behind — literally "the road so far".
  const fbo = useFBO(tier === "high" ? 512 : 256, tier === "high" ? 150 : 76, { samples: 0 });
  const rearCam = useMemo(() => new ThreePerspectiveCamera(26, 512 / 150, 0.5, 900), []);
  const mirrorMat = useMemo(() => {
    const m = new MeshBasicMaterial({ map: fbo.texture, color: new Color("#d8dde2") });
    fbo.texture.repeat.x = -1;
    fbo.texture.offset.x = 1;
    return m;
  }, [fbo]);
  const frame = useRef(0);
  const q = useMemo(() => new Quaternion(), []);
  const sunLocal = useMemo(() => new Vector3(), []);

  useFrame(() => {
    const phase = useJourney.getState().phase;
    const inCar = phase === "intro" || phase === "driving" || phase === "arrived";
    // Mirror pass before the main render (priority -1).
    if (mirror && inCar && intro.cockpit > 0.2) {
      frame.current++;
      if (frame.current % 2 === 0) {
        rearCam.position.set(drive.x, 1.35, drive.z);
        rearCam.rotation.set(-0.02, drive.heading + Math.PI, 0, "YXZ");
        rearCam.updateMatrixWorld();
        gl.setRenderTarget(fbo);
        gl.render(scene, rearCam);
        gl.setRenderTarget(null);
      }
    }
  }, -1);

  useFrame(() => {
    if (!cam.current || !rig.current) return;
    cam.current.fov = fovFor(aspect);
    cam.current.aspect = aspect;
    cam.current.updateProjectionMatrix();
    cam.current.position.set(0, head.bob + head.vib, 0);
    cam.current.rotation.set(head.pitch, head.yaw, head.roll, "YXZ");

    // Seat-in: dashboard rises into view, roof lowers.
    const c = intro.cockpit;
    const e = 1 - Math.pow(1 - c, 3);
    rig.current.position.y = (1 - e) * -0.45;
    rig.current.visible = c > 0.001;

    // Steering wheel follows road curvature (wheelbase × steering ratio) plus lane changes.
    if (wheel.current) {
      const ahead = drive.route.sample(drive.s + 4, { x: 0, z: 0, h: 0, k: 0 }).k;
      const target = MathUtils.clamp(ahead * 2.7 * 15 + drive.lateralV * 0.25, -3.6, 3.6);
      wheel.current.rotation.z = MathUtils.damp(wheel.current.rotation.z, target, 5, 1 / 60);
    }

    // Lights in car space.
    q.setFromAxisAngle(new Vector3(0, 1, 0), -drive.heading);
    sunLocal.copy(env.uSunDir.value).applyQuaternion(q);
    hood.uniforms.uSunDirLocal.value.copy(sunLocal);
    if (sun.current) {
      sun.current.position.copy(sunLocal).multiplyScalar(5);
      sun.current.color.copy(env.uSunColor.value);
      sun.current.intensity = env.uSunIntensity.value * Math.PI * 0.6 * Math.max(0, Math.min(1, env.uSunDir.value.y * 8 + 0.3));
    }
    if (hemi.current) {
      hemi.current.color.copy(env.uHemiSky.value);
      hemi.current.groundColor.copy(env.uHemiGround.value);
      hemi.current.intensity = env.uHemi.value * Math.PI * 0.55 + env.uNight.value * 0.25;
    }
  });

  return (
    <Hud renderPriority={1}>
      <PerspectiveCamera ref={cam} makeDefault near={0.05} far={20} fov={fovFor(aspect)} />
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
      {/* Dash screens glow at night */}
      <pointLight position={[0.35, -0.3, -0.7]} color="#6fb7ff" intensity={0.15} distance={1.2} />
      <group ref={rig}>
        <mesh geometry={geo.hood} material={hood} />
        <mesh geometry={geo.dash} material={dashMat} />
        {!portrait && (
          <>
            <mesh geometry={geo.pillarL.geometry} material={trimMat} position={geo.pillarL.position} quaternion={geo.pillarL.quaternion} />
            <mesh geometry={geo.pillarR.geometry} material={trimMat} position={geo.pillarR.position} quaternion={geo.pillarR.quaternion} />
            <mesh material={trimMat} position={[0, 0.355, -0.36]}>
              <boxGeometry args={[1.8, 0.1, 0.5]} />
            </mesh>
            {/* Side mirrors at the corners */}
            {[-1, 1].map((sx) => (
              <group key={sx} position={[1.02 * sx, -0.27, -1.0]} rotation-y={-0.25 * sx}>
                <mesh material={trimMat}>
                  <boxGeometry args={[0.2, 0.12, 0.07]} />
                </mesh>
                <mesh material={mirrorGlassSide} position-z={0.036}>
                  <planeGeometry args={[0.18, 0.1]} />
                </mesh>
              </group>
            ))}
          </>
        )}
        {/* Rear-view mirror */}
        {!portrait && (
          <group position={[0, 0.235, -0.68]} rotation-x={0.08}>
            <mesh material={trimMat} position={[0, 0.05, -0.02]}>
              <boxGeometry args={[0.014, 0.06, 0.014]} />
            </mesh>
            <mesh material={trimMat} position-z={-0.012}>
              <boxGeometry args={[0.172, 0.056, 0.022]} />
            </mesh>
            <mesh material={mirror ? mirrorMat : mirrorGlassSide} position-z={0.002}>
              <planeGeometry args={[0.16, 0.044]} />
            </mesh>
          </group>
        )}
        {/* Steering wheel: top of the rim, tilted toward the dash */}
        <group position={[0, -0.47, -0.47]} rotation-x={-0.44} visible={!portrait}>
          <group ref={wheel}>
            <mesh material={wheelMat}>
              <torusGeometry args={[0.19, 0.022, 12, 48]} />
            </mesh>
            {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((a) => (
              <mesh key={a} material={wheelMat} rotation-z={a - Math.PI} position={[Math.cos(a - Math.PI / 2) * 0.1, Math.sin(a - Math.PI / 2) * 0.1, -0.01]}>
                <boxGeometry args={[0.035, 0.18, 0.02]} />
              </mesh>
            ))}
            <mesh material={wheelMat} position-z={-0.02} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.055, 0.06, 0.04, 20]} />
            </mesh>
          </group>
        </group>
      </group>
    </Hud>
  );
}


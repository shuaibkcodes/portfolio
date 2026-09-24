"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, FogExp2, type DirectionalLight, type HemisphereLight, type Mesh, ShaderMaterial } from "three";
import { env } from "@/world/environment";
import { envUniforms, groundFragment, groundVertex, horizonFragment, horizonVertex, skyFragment, skyVertex } from "@/components/Scene/shaders";
import { updateSignMaterials } from "@/components/Scene/materials";

/** Keeps three.js lights + fog in sync with the shared environment uniforms. */
export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const scene = useThree((s) => s.scene);
  const fog = useMemo(() => new FogExp2("#000000", 0.002), []);
  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(({ camera }) => {
    // Custom shaders use albedo × irradiance; three's physical lights divide by π.
    if (sun.current) {
      sun.current.color.copy(env.uSunColor.value);
      sun.current.intensity = env.uSunIntensity.value * Math.PI * Math.max(0, Math.min(1, env.uSunDir.value.y * 8 + 0.3));
      sun.current.position.copy(camera.position).addScaledVector(env.uSunDir.value, 100);
      sun.current.target.position.copy(camera.position);
      sun.current.target.updateMatrixWorld();
    }
    if (hemi.current) {
      hemi.current.color.copy(env.uHemiSky.value);
      hemi.current.groundColor.copy(env.uHemiGround.value);
      hemi.current.intensity = env.uHemi.value * Math.PI;
    }
    fog.color.copy(env.uFogColor.value);
    fog.density = env.uFogDensity.value;
    updateSignMaterials(env.uNight.value);
  }, -1);

  return (
    <>
      <hemisphereLight ref={hemi} />
      <directionalLight ref={sun} />
    </>
  );
}

export function Sky() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () => new ShaderMaterial({ uniforms: envUniforms(), vertexShader: skyVertex, fragmentShader: skyFragment, side: BackSide, depthWrite: false, fog: false }),
    [],
  );
  useFrame(({ camera }) => ref.current?.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[4000, 48, 24]} />
    </mesh>
  );
}

/** Distant mountains + a city skyline that grows with the career. */
export function Horizon() {
  const ref = useRef<Mesh>(null);
  const material = useMemo(
    () => new ShaderMaterial({ uniforms: envUniforms(), vertexShader: horizonVertex, fragmentShader: horizonFragment, side: BackSide, fog: false }),
    [],
  );
  useFrame(({ camera }) => ref.current?.position.set(camera.position.x, 140, camera.position.z));
  return (
    <mesh ref={ref} material={material} renderOrder={-9} frustumCulled={false}>
      <cylinderGeometry args={[2600, 2600, 320, 128, 1, true]} />
    </mesh>
  );
}

export function Ground() {
  const material = useMemo(() => new ShaderMaterial({ uniforms: envUniforms(), vertexShader: groundVertex, fragmentShader: groundFragment }), []);
  const ref = useRef<Mesh>(null);
  // Follow the camera in 50 m steps so the plane never ends (noise is world-space).
  useFrame(({ camera }) => ref.current?.position.set(Math.round(camera.position.x / 50) * 50, -0.22, Math.round(camera.position.z / 50) * 50));
  return (
    <mesh ref={ref} material={material} rotation-x={-Math.PI / 2} frustumCulled={false}>
      <planeGeometry args={[7000, 7000, 1, 1]} />
    </mesh>
  );
}

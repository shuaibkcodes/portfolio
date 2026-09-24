"use client";

import { useCallback, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { stepJourney } from "@/state/journey";
import { drive } from "@/state/drive";
import type { Tier } from "@/state/store";
import { applyChrono, env } from "@/world/environment";
import { Roads } from "@/components/Road/Roads";
import { Ground, Horizon, Lights, Sky } from "@/components/Environment/Environment";
import { Scenery } from "@/components/Environment/Scenery";
import { Features } from "@/components/Timeline/Features";
import { CameraRig, Cockpit } from "@/components/Car/CarRig";
import { preloadFont } from "troika-three-text";
import { FONT, FONT_BOLD, SIGN_CHARACTERS } from "@/lib/fonts";

/** Pre-generate SDF glyph atlases for every sign character (real loading work). */
export function preloadGlyphs(): Promise<void> {
  return Promise.all(
    [FONT, FONT_BOLD].map((font) => new Promise<void>((resolve) => preloadFont({ font, characters: SIGN_CHARACTERS }, resolve))),
  ).then(() => undefined);
}

function Controller() {
  const gl = useThree((s) => s.gl);
  useFrame(({ clock }, dt) => {
    stepJourney(Math.min(dt, 0.05), performance.now());
    applyChrono(drive.chrono);
    env.uTime.value = clock.elapsedTime;
    gl.toneMappingExposure = env.exposure;
    env.uCarPos.value.set(drive.x, 0, drive.z);
    env.uCarDir.value.set(-Math.sin(drive.heading), 0, -Math.cos(drive.heading));
  }, -3);
  return null;
}

/** Compiles every shader once the warm scene is mounted, then reports ready. */
function Warmup({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let cancelled = false;
    // Two frames so instanced meshes and text geometry exist before compiling.
    requestAnimationFrame(() =>
      requestAnimationFrame(async () => {
        try {
          await gl.compileAsync(scene, camera);
        } catch {
          /* compileAsync unsupported — shaders compile lazily instead */
        }
        if (!cancelled) onReady();
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

export interface SceneProps {
  tier: Tier;
  reducedMotion: boolean;
  onReady: () => void;
}

export default function Scene({ tier, reducedMotion, onReady }: SceneProps) {
  // Never render above the screen's density; phones need ≥1.25 for legible sign text.
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const maxDpr = Math.min(deviceDpr, tier === "high" ? 1.75 : tier === "medium" ? 1.5 : 1.25);
  const [dpr, setDpr] = useState(maxDpr);
  const [warm, setWarm] = useState(true);
  const density = tier === "high" ? 1 : tier === "medium" ? 0.7 : 0.45;
  const handleReady = useCallback(() => {
    setWarm(false);
    onReady();
  }, [onReady]);

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 55, near: 0.3, far: 6000, position: [0, 1.2, 0] }}
      onCreated={({ gl }) => {
        gl.toneMapping = ACESFilmicToneMapping;
      }}
      aria-hidden="true"
    >
      <PerformanceMonitor
        onDecline={() => setDpr((d) => Math.max(1, +(d - 0.25).toFixed(2)))}
        onIncline={() => setDpr((d) => Math.min(maxDpr, +(d + 0.15).toFixed(2)))}
        flipflops={4}
      />
      <Controller />
      <CameraRig reducedMotion={reducedMotion} />
      <Lights />
      <Sky />
      <Horizon />
      <Ground />
      <Roads />
      <Scenery density={density} />
      <Features warm={warm} />
      <Cockpit tier={tier} mirror={tier !== "low"} />
      {warm && <Warmup onReady={handleReady} />}
    </Canvas>
  );
}

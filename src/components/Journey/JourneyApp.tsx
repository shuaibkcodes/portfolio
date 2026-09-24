"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { detectDevice, viewOverride, type DeviceInfo } from "@/lib/device";
import { FONT, FONT_BOLD } from "@/lib/fonts";
import { SEP } from "@/lib/text";
import { useJourney } from "@/state/store";
import { useDriveInput } from "@/hooks/useDriveInput";
import { Hud } from "@/components/Dashboard/Hud";
import type { SceneProps } from "@/components/Scene/Scene";
import s from "@/components/Dashboard/hud.module.css";
import d from "@/components/Fallback/document.module.css";

type View = "pending" | "journey" | "document";

async function fetchWithProgress(url: string, onProgress: (f: number) => void) {
  const res = await fetch(url);
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) {
    await res.arrayBuffer();
    onProgress(1);
    return;
  }
  const reader = res.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    onProgress(Math.min(received / total, 1));
  }
}

function Loader({ value, label, hidden }: { value: number; label: string; hidden: boolean }) {
  return (
    <div id="journey-loader" className={`${s.loader} ${hidden ? s.loaderHidden : ""}`} role="status" aria-live="polite" aria-hidden={hidden}>
      <div className={s.loaderInner}>
        <div className={s.loaderRow}>
          <span>The road so far</span>
          <span className={s.loaderPct}>{Math.round(value * 100)}%</span>
        </div>
        <div className={s.road}>
          <div className={s.roadFill} style={{ width: `${value * 100}%` }} />
        </div>
        <div className={s.loaderStep}>{label}</div>
      </div>
    </div>
  );
}

function Journey({ device, onClassic }: { device: DeviceInfo; onClassic: () => void }) {
  const [SceneComp, setSceneComp] = useState<ComponentType<SceneProps> | null>(null);
  const [progress, setProgress] = useState({ value: 0.02, label: "Starting the engine" });
  const phase = useJourney((st) => st.phase);
  const started = useRef(false);
  useDriveInput(phase === "driving" || phase === "arrived");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    useJourney.setState({ tier: device.tier, mobile: device.mobile, reducedMotion: device.reducedMotion, phase: "loading" });
    (async () => {
      // 1. 3D engine chunk (three.js, world, shaders)
      const mod = await import("@/components/Scene/Scene");
      setProgress({ value: 0.3, label: "Fetching road-sign typeface" });
      // 2. Fonts, with byte-level progress
      const parts = [0, 0];
      await Promise.all(
        [FONT, FONT_BOLD].map((url, i) =>
          fetchWithProgress(url, (f) => {
            parts[i] = f;
            setProgress({ value: 0.3 + ((parts[0] + parts[1]) / 2) * 0.2, label: "Fetching road-sign typeface" });
          }),
        ),
      );
      // 3. Glyph atlases for every sign
      setProgress({ value: 0.5, label: "Painting road signs" });
      await mod.preloadGlyphs();
      // 4. World generation + shader compilation happen when the scene mounts
      setProgress({ value: 0.68, label: ["Paving roads", "planting trees", "calibrating GPS"].join(SEP) });
      setSceneComp(() => mod.default);
    })();
  }, [device]);

  const onReady = useCallback(() => {
    setProgress({ value: 1, label: "Ready" });
    setTimeout(() => useJourney.getState().setPhase("title"), 350);
  }, []);

  return (
    <div className={s.stage}>
      <div className={s.canvas}>{SceneComp && <SceneComp tier={device.tier} reducedMotion={device.reducedMotion} onReady={onReady} />}</div>
      <div className={s.windshield} aria-hidden />
      <Hud onClassic={onClassic} />
      <Loader value={progress.value} label={progress.label} hidden={phase !== "loading"} />
    </div>
  );
}

function DocumentBar({ canDrive, reason, onDrive }: { canDrive: boolean; reason: string | null; onDrive: () => void }) {
  return (
    <div className={d.bar} role="region" aria-label="View options">
      <span>{reason ?? "You're reading the classic version."}</span>
      {canDrive && (
        <button type="button" className={d.barBtn} onClick={onDrive}>
          Take the drive →
        </button>
      )}
    </div>
  );
}

/**
 * Chooses between the 3D journey and the semantic document (fallback),
 * based on WebGL support, device strength and reduced-motion preference.
 */
export default function JourneyApp() {
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [view, setView] = useState<View>("pending");
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    const dev = detectDevice();
    const forced = viewOverride();
    // Deferred so the first client render matches the server-rendered loader.
    queueMicrotask(() => {
      setDevice(dev);
      if (forced === "document" || (forced !== "3d" && !dev.webgl)) {
        setReason(dev.webgl ? null : "Your browser can't run the 3D drive, so here's the same road in 2D.");
        setView("document");
      } else if (forced !== "3d" && dev.reducedMotion) {
        setReason("Reduced motion is on, so here's the road without the drive.");
        setView("document");
      } else if (forced !== "3d" && dev.weak) {
        setReason("This device is rendering without a GPU, so here's the lightweight road.");
        setView("document");
      } else setView("journey");
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.view = view;
    if (view === "document") window.scrollTo(0, 0);
  }, [view]);

  if (view === "journey" && device) return <Journey device={device} onClassic={() => setView("document")} />;
  if (view === "document") return <DocumentBar canDrive={!!device?.webgl} reason={reason} onDrive={() => setView("journey")} />;
  return <Loader value={0.02} label="Starting the engine" hidden={false} />;
}

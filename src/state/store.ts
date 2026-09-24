/**
 * UI-facing journey state (React re-renders on change).
 * Per-frame vehicle state lives in `drive` instead.
 */
import { create } from "zustand";
import type { District, EdgeId, TurnDir } from "@/world/graph";
import type { ContentRef } from "@/world/layout";
import type { Choices, RouteEventKind } from "@/world/route";

export type Phase = "loading" | "title" | "intro" | "driving" | "arrived";
export type Mode = "autopilot" | "explore";
export type Tier = "high" | "medium" | "low";

export interface HudSnapshot {
  year: number | null;
  location: string;
  district: District;
  next: { kind: RouteEventKind; label: string; dir?: TurnDir; distance: number } | null;
  progress: number;
  speed: number;
  nearby: { stationId: string; label: string; content: ContentRef } | null;
  signal: "left" | "right" | null;
  junction: "none" | "approaching" | "waiting";
  countdown: number | null;
}

export interface Toast {
  id: number;
  text: string;
  sub?: string;
}

interface JourneyState {
  phase: Phase;
  mode: Mode;
  choices: Choices;
  visitedEdges: EdgeId[];
  visitedStations: string[];
  panel: ContentRef | null;
  sound: boolean;
  mapOpen: boolean;
  toast: Toast | null;
  travelTarget: string | null;
  tier: Tier;
  mobile: boolean;
  reducedMotion: boolean;
  hud: HudSnapshot;

  setPhase: (p: Phase) => void;
  setMode: (m: Mode) => void;
  setSound: (on: boolean) => void;
  setMapOpen: (open: boolean) => void;
  showToast: (text: string, sub?: string) => void;
}

export const initialHud: HudSnapshot = {
  year: 2019,
  location: "Career Road",
  district: "career",
  next: null,
  progress: 0,
  speed: 0,
  nearby: null,
  signal: null,
  junction: "none",
  countdown: null,
};

let toastId = 0;

export const useJourney = create<JourneyState>((set) => ({
  phase: "loading",
  mode: "autopilot",
  choices: {},
  visitedEdges: ["careerEarly"],
  visitedStations: [],
  panel: null,
  sound: false,
  mapOpen: false,
  toast: null,
  travelTarget: null,
  tier: "high",
  mobile: false,
  reducedMotion: false,
  hud: initialHud,

  setPhase: (phase) => set({ phase }),
  setMode: (mode) => set({ mode }),
  setSound: (sound) => set({ sound }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  showToast: (text, sub) => set({ toast: { id: ++toastId, text, sub } }),
}));

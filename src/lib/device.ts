import type { Tier } from "@/state/store";

export interface DeviceInfo {
  webgl: boolean;
  /** Software rasteriser or very weak GPU: recommend the 2D document view. */
  weak: boolean;
  tier: Tier;
  mobile: boolean;
  reducedMotion: boolean;
}

/**
 * Capability detection. Query overrides for testing:
 *   ?view=3d | ?view=document     ?tier=high|medium|low
 */
export function detectDevice(): DeviceInfo {
  const params = new URLSearchParams(window.location.search);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = window.matchMedia("(pointer: coarse)").matches && Math.min(window.screen.width, window.screen.height) < 820;

  const canvas = document.createElement("canvas");
  const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
  if (!gl) return { webgl: false, weak: true, tier: "low", mobile, reducedMotion };

  let renderer = "";
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  const software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;

  let tier: Tier = "high";
  if (software) tier = "low";
  else if (mobile) tier = memory >= 6 && cores >= 8 ? "medium" : "low";
  else if (memory < 4 || cores < 4) tier = "medium";

  const forced = params.get("tier");
  if (forced === "high" || forced === "medium" || forced === "low") tier = forced;

  return { webgl: true, weak: software, tier, mobile, reducedMotion };
}

export function viewOverride(): "3d" | "document" | null {
  const v = new URLSearchParams(window.location.search).get("view");
  return v === "3d" || v === "document" ? v : null;
}

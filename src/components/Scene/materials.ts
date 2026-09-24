/**
 * Shared materials & geometry helpers. Materials are module singletons so a
 * single per-frame update (night emissive) affects every sign in the world.
 */
import { Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, Shape, ShapeGeometry, type BufferGeometry } from "three";
import type { SignStyle } from "@/world/layout";

export { FONT, FONT_BOLD } from "@/lib/fonts";

export const SIGN_COLORS: Record<SignStyle, { bg: string; fg: string; border: string }> = {
  career: { bg: "#0c4a37", fg: "#ffffff", border: "#e9efeb" },
  education: { bg: "#1b4786", fg: "#ffffff", border: "#e7edf6" },
  project: { bg: "#5b3a1f", fg: "#ffffff", border: "#f0e7dd" },
  info: { bg: "#1b2129", fg: "#ffffff", border: "#cfd6de" },
  warning: { bg: "#f0b400", fg: "#101010", border: "#101010" },
  construction: { bg: "#e0691a", fg: "#101010", border: "#101010" },
  success: { bg: "#0c4a37", fg: "#ffffff", border: "#e9efeb" },
};

const panelCache = new Map<string, MeshStandardMaterial>();
/** Retro-reflective sign face: slightly emissive, more so at night (headlights). */
export function signFace(color: string): MeshStandardMaterial {
  let m = panelCache.get(color);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, emissive: new Color(color), emissiveIntensity: 0.08 });
    panelCache.set(color, m);
  }
  return m;
}

const textCache = new Map<string, MeshBasicMaterial>();
export function signText(color: string): MeshBasicMaterial {
  let m = textCache.get(color);
  if (!m) {
    m = new MeshBasicMaterial({ color, toneMapped: false, fog: true });
    textCache.set(color, m);
  }
  return m;
}

export const metal = new MeshStandardMaterial({ color: "#6d737a", roughness: 0.45, metalness: 0.7 });
export const darkMetal = new MeshStandardMaterial({ color: "#2a2e33", roughness: 0.6, metalness: 0.5 });
export const signBack = new MeshStandardMaterial({ color: "#5d636a", roughness: 0.7, metalness: 0.4, side: DoubleSide });

/** Update emissive boosts for night-time legibility. */
export function updateSignMaterials(night: number) {
  for (const m of panelCache.values()) m.emissiveIntensity = 0.06 + night * 0.32;
}

// --- geometry ------------------------------------------------------------------

const rectCache = new Map<string, BufferGeometry>();
export function roundedRect(w: number, h: number, r: number): BufferGeometry {
  const key = `${w.toFixed(2)}:${h.toFixed(2)}:${r.toFixed(2)}`;
  let g = rectCache.get(key);
  if (!g) {
    const s = new Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    g = new ShapeGeometry(s, 6);
    rectCache.set(key, g);
  }
  return g;
}

let diamond: BufferGeometry | null = null;
/** Unit diamond (vertices at ±1) with rounded corners. */
export function diamondGeometry(): BufferGeometry {
  if (!diamond) {
    const v: [number, number][] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    const r = 0.16;
    const lerp = (a: [number, number], b: [number, number], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] as const;
    const s = new Shape();
    const start = lerp(v[0], v[1], r);
    s.moveTo(start[0], start[1]);
    for (let i = 0; i < 4; i++) {
      const corner = v[(i + 1) % 4];
      const before = lerp(corner, v[i], r);
      const after = lerp(corner, v[(i + 2) % 4], r);
      s.lineTo(before[0], before[1]);
      s.quadraticCurveTo(corner[0], corner[1], after[0], after[1]);
    }
    diamond = new ShapeGeometry(s, 6);
  }
  return diamond;
}

let arrow: BufferGeometry | null = null;
/** Upward-pointing arrow, 1 unit tall, centred. Rotate for left/right. */
export function arrowGeometry(): BufferGeometry {
  if (!arrow) {
    const s = new Shape();
    const sw = 0.13; // half shaft width
    const hw = 0.36; // half head width
    const hh = 0.42; // head height
    s.moveTo(-sw, -0.5);
    s.lineTo(sw, -0.5);
    s.lineTo(sw, 0.5 - hh);
    s.lineTo(hw, 0.5 - hh);
    s.lineTo(0, 0.5);
    s.lineTo(-hw, 0.5 - hh);
    s.lineTo(-sw, 0.5 - hh);
    s.closePath();
    arrow = new ShapeGeometry(s);
  }
  return arrow;
}

export const arrowRotation = { up: 0, left: Math.PI / 2, right: -Math.PI / 2 } as const;

/** Rough text width for Overpass caps, in units of font size. */
export const textWidth = (text: string, size: number) => text.length * size * 0.64;
